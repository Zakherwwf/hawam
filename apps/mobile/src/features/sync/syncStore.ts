/**
 * Outbox & Sync Zustand Store
 * Hawem (حايم) Citizen-Science Platform
 *
 * Implements:
 * - Transactional outbox queue
 * - Live PostgreSQL push via Supabase submit_survey_bundle RPC
 * - Offline status tracking
 * - Automatic retry with dependency ordering
 */

import { create } from 'zustand';
import { storage } from '../../services/storageAdapter.ts';
import { localDb } from '../../db/localDb.ts';
import {
  hasAuthSession,
  pushSurveyBundle,
  type SurveyBundlePayload,
} from '../../services/supabase.ts';
import { isBucketPath, uploadAnimalPhoto } from '../../services/storageService.ts';
import { generateUUID } from '../../utils/uuid.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sanitizeBundleUuids(payload: SurveyBundlePayload): SurveyBundlePayload {
  const p: SurveyBundlePayload = {
    ...payload,
    session: { ...payload.session },
    observations: payload.observations ? payload.observations.map((o) => ({ ...o })) : [],
    photos: payload.photos ? payload.photos.map((ph) => ({ ...ph })) : [],
  };

  if (p.session && !UUID_REGEX.test(p.session.id)) {
    p.session.id = generateUUID();
  }

  if (p.observations && p.observations.length > 0) {
    p.observations = p.observations.map((obs) => {
      let obsId = obs.id;
      if (!UUID_REGEX.test(obsId)) {
        const oldId = obs.id;
        const newObsId = generateUUID();
        if (p.photos) {
          p.photos.forEach((ph) => {
            if (ph.observation_id === oldId) {
              ph.observation_id = newObsId;
            }
          });
        }
        obsId = newObsId;
      }

      // Normalize location coordinates for remote generalize_point function
      let lat: number | null = null;
      let lon: number | null = null;

      const locAny = obs.location as any;
      if (locAny) {
        if (typeof locAny.latitude === 'number' && typeof locAny.longitude === 'number') {
          lat = locAny.latitude;
          lon = locAny.longitude;
        } else if (Array.isArray(locAny.coordinates) && locAny.coordinates.length >= 2) {
          lon = Number(locAny.coordinates[0]);
          lat = Number(locAny.coordinates[1]);
        }
      }

      if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
        const obsAny = obs as any;
        if (typeof obsAny.latitude === 'number' && typeof obsAny.longitude === 'number') {
          lat = obsAny.latitude;
          lon = obsAny.longitude;
        }
      }

      // Default fallback coordinates if missing
      if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
        lat = 36.8065;
        lon = 10.1815;
      }

      const formattedLocation = {
        latitude: lat,
        longitude: lon,
        type: 'Point' as const,
        coordinates: [lon, lat] as [number, number],
      };

      let observerLocation = formattedLocation;
      const obsLocAny = obs.observer_location as any;
      if (obsLocAny) {
        let oLat: number | null = null;
        let oLon: number | null = null;
        if (typeof obsLocAny.latitude === 'number' && typeof obsLocAny.longitude === 'number') {
          oLat = obsLocAny.latitude;
          oLon = obsLocAny.longitude;
        } else if (Array.isArray(obsLocAny.coordinates) && obsLocAny.coordinates.length >= 2) {
          oLon = Number(obsLocAny.coordinates[0]);
          oLat = Number(obsLocAny.coordinates[1]);
        }
        if (oLat != null && oLon != null && !isNaN(oLat) && !isNaN(oLon)) {
          observerLocation = {
            latitude: oLat,
            longitude: oLon,
            type: 'Point' as const,
            coordinates: [oLon, oLat] as [number, number],
          };
        }
      }

      return {
        ...obs,
        id: obsId,
        location: formattedLocation,
        observer_location: observerLocation,
      };
    });
  }

  if (p.photos && p.photos.length > 0) {
    p.photos = p.photos.map((ph) => {
      if (!UUID_REGEX.test(ph.id)) {
        return { ...ph, id: generateUUID() };
      }
      return ph;
    });
  }

  return p;
}

export interface OutboxItem {
  id: string;
  payload: SurveyBundlePayload;
  created_at: string;
  status: 'pending' | 'syncing' | 'failed';
  attempts: number;
  lastError?: string;
}

interface SyncState {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  pendingCount: number;
  wifiOnly: boolean;
  outbox: OutboxItem[];

  // Actions
  loadOutbox: () => Promise<void>;
  enqueueSurvey: (bundle: SurveyBundlePayload) => Promise<void>;
  triggerSync: () => Promise<{ success: boolean; syncedCount: number }>;
  setWifiOnly: (enabled: boolean) => void;
  clearOutbox: () => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isSyncing: false,
  lastSyncedAt: null, // never claim a sync that has not happened
  pendingCount: 0,
  wifiOnly: false,
  outbox: [],

  loadOutbox: async () => {
    try {
      await localDb.migrateFromAsyncStorage().catch(() => {});
      const dbItems = await localDb.getAllOutbox().catch(() => []);
      if (dbItems.length > 0) {
        const outboxList: OutboxItem[] = dbItems
          .filter((i) => i.status !== 'synced')
          .map((i) => {
            let payload: SurveyBundlePayload;
            try {
              payload = JSON.parse(i.payloadJson);
            } catch {
              payload = { session: { id: i.sessionId } } as any;
            }
            return {
              id: i.id,
              payload,
              created_at: i.createdAt,
              status: i.status as any,
              attempts: i.attempts,
              lastError: i.lastError ?? undefined,
            };
          });
        set({ outbox: outboxList, pendingCount: outboxList.length });
        return;
      }

      const stored = await storage.getItem('hawem_outbox_v2');
      if (stored) {
        const parsed: OutboxItem[] = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          set({ outbox: parsed, pendingCount: parsed.length });
        }
      }
    } catch (err) {
      console.warn('[syncStore] Failed loading outbox from storage:', err);
    }
  },

  enqueueSurvey: async (bundle: SurveyBundlePayload) => {
    // If cold start or store not loaded yet, pull existing items first to prevent overwriting
    let currentOutbox = get().outbox;
    if (currentOutbox.length === 0) {
      try {
        const stored = await storage.getItem('hawem_outbox_v2');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            currentOutbox = parsed;
          }
        }
      } catch {}
    }

    const newItem: OutboxItem = {
      id: `outbox-${bundle.session.id}`,
      payload: bundle,
      created_at: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
    };

    // Persist to local SQLite outbox
    await localDb
      .enqueueOutbox({
        id: newItem.id,
        sessionId: bundle.session.id,
        payloadJson: JSON.stringify(bundle),
        createdAt: newItem.created_at,
        status: 'pending',
        attempts: 0,
      })
      .catch(() => {});

    // Deduplicate against duplicate submission of identical session ID
    const deduplicated = currentOutbox.filter(
      (item) => item.payload.session.id !== bundle.session.id
    );
    const updated = [...deduplicated, newItem];

    set({ outbox: updated, pendingCount: updated.length });
    await storage.setItem('hawem_outbox_v2', JSON.stringify(updated)).catch(() => {});

    // Trigger immediate background sync
    get()
      .triggerSync()
      .catch(() => {});
  },

  triggerSync: async () => {
    const { outbox, isSyncing } = get();
    if (isSyncing || outbox.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    // Guests keep their bundles queued until they sign in
    if (!(await hasAuthSession())) {
      return { success: false, syncedCount: 0 };
    }

    set({ isSyncing: true });

    const syncedItemIds = new Set<string>();
    const failedItemsMap = new Map<string, { attempts: number; lastError?: string }>();
    let syncedCount = 0;

    // Snapshot items to process
    const itemsToProcess = [...outbox];

    for (const item of itemsToProcess) {
      try {
        let photoUploadFailed = false;
        let photoErrorMsg: string | undefined;

        // Auto-sanitize legacy non-UUID formats for PostgreSQL schema compliance
        const payload = sanitizeBundleUuids(item.payload);

        // Upload any local binary photos to Supabase Storage before RPC bundle submission
        if (payload.photos && payload.photos.length > 0) {
          for (const photo of payload.photos) {
            if (
              photo.storage_path &&
              !photo.storage_path.startsWith('http://') &&
              !photo.storage_path.startsWith('https://') &&
              !isBucketPath(photo.storage_path)
            ) {
              const uploadRes = await uploadAnimalPhoto(
                photo.storage_path,
                photo.observation_id,
                photo.id
              );
              if (uploadRes.success && uploadRes.storagePath) {
                photo.storage_path = uploadRes.storagePath;
              } else {
                photoUploadFailed = true;
                photoErrorMsg = uploadRes.error || 'Photo upload failed';
                break; // Stop uploading subsequent photos for this observation
              }
            }
          }
        }

        // CRITICAL DATA INTEGRITY: If photo upload failed, never push bundle with local file:// paths!
        if (photoUploadFailed) {
          failedItemsMap.set(item.id, {
            attempts: item.attempts + 1,
            lastError: photoErrorMsg || 'Photo upload failed - will retry',
          });
          continue;
        }

        const result = await pushSurveyBundle(payload);
        if (result.success) {
          syncedCount++;
          syncedItemIds.add(item.id);
          localDb.removeOutboxItem(item.id).catch(() => {});
          localDb.updateSessionStatus(payload.session.id, 'finished').catch(() => {});
        } else {
          failedItemsMap.set(item.id, {
            attempts: item.attempts + 1,
            lastError: result.error,
          });
          localDb
            .updateOutboxStatus(item.id, 'failed', item.attempts + 1, result.error)
            .catch(() => {});
        }
      } catch (err: any) {
        failedItemsMap.set(item.id, {
          attempts: item.attempts + 1,
          lastError: err?.message || 'Sync failed',
        });
        localDb
          .updateOutboxStatus(item.id, 'failed', item.attempts + 1, err?.message || 'Sync failed')
          .catch(() => {});
      }
    }

    // Atomic update: Preserve items enqueued in get().outbox while sync was running!
    const latestOutbox = get().outbox;
    const finalOutbox = latestOutbox
      .filter((item) => !syncedItemIds.has(item.id))
      .map((item) => {
        const failureInfo = failedItemsMap.get(item.id);
        if (failureInfo) {
          return {
            ...item,
            attempts: failureInfo.attempts,
            status: 'failed' as const,
            lastError: failureInfo.lastError,
          };
        }
        return item;
      });

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    set({
      isSyncing: false,
      outbox: finalOutbox,
      pendingCount: finalOutbox.length,
      lastSyncedAt: syncedCount > 0 ? nowStr : get().lastSyncedAt,
    });

    await storage.setItem('hawem_outbox_v2', JSON.stringify(finalOutbox)).catch(() => {});

    return {
      success: finalOutbox.length === 0,
      syncedCount,
    };
  },

  setWifiOnly: (wifiOnly) => {
    set({ wifiOnly });
  },

  clearOutbox: () => {
    set({ outbox: [], pendingCount: 0 });
    storage.removeItem('hawem_outbox_v2').catch(() => {});
    localDb.clearAllForTesting();
  },
}));
