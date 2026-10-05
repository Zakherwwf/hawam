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

import { formatTime } from '../../utils/formatObservation.ts';
import { create } from 'zustand';
import { storage } from '../../services/storageAdapter.ts';
import { localDb } from '../../db/localDb.ts';
import {
  hasAuthSession,
  pushSurveyBundle,
  type SurveyBundlePayload,
} from '../../services/supabase.ts';
import { isBucketPath, uploadAnimalPhoto } from '../../services/storageService.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A UUID derived from an old non-UUID id (cyrb128 hash). The same record must
 * get the same id on every retry; a random one made each retry a new walk on
 * the server.
 */
export function stableUuid(legacyId: string): string {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < legacyId.length; i++) {
    const k = legacyId.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  const hex = [h1, h2, h3, h4].map((h) => (h >>> 0).toString(16).padStart(8, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function sanitizeBundleUuids(payload: SurveyBundlePayload): SurveyBundlePayload {
  const p: SurveyBundlePayload = {
    ...payload,
    session: { ...payload.session },
    observations: payload.observations ? payload.observations.map((o) => ({ ...o })) : [],
    photos: payload.photos ? payload.photos.map((ph) => ({ ...ph })) : [],
  };

  if (p.session && !UUID_REGEX.test(p.session.id)) {
    p.session.id = stableUuid(p.session.id);
  }

  if (p.observations && p.observations.length > 0) {
    p.observations = p.observations.map((obs) => {
      let obsId = obs.id;
      if (!UUID_REGEX.test(obsId)) {
        const oldId = obs.id;
        const newObsId = stableUuid(oldId);
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
        return { ...ph, id: stableUuid(ph.id) };
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
  /** alreadyUploaded: records the server already had from another account */
  triggerSync: () => Promise<{ success: boolean; syncedCount: number; alreadyUploaded: number }>;
  setWifiOnly: (enabled: boolean) => void;
  clearOutbox: () => void;
  /** Drop only the queued uploads that keep failing; nothing else is touched */
  discardFailed: () => void;
}

/** Rejects after ms, so one stalled request can never freeze the queue. */
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} timed out`)), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e))
    );
  });
}

/** False when a queued photo's file is gone (cache cleared, app reinstalled). */
async function photoFileExists(uri: string): Promise<boolean> {
  if (uri.startsWith('data:')) return true;
  try {
    const res = await withTimeout(fetch(uri), 8000, 'Photo check');
    const blob = await res.blob();
    return blob.size > 0;
  } catch {
    return false;
  }
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isSyncing: false,
  lastSyncedAt: null, // never claim a sync that has not happened
  pendingCount: 0,
  wifiOnly: false,
  outbox: [],

  loadOutbox: async () => {
    try {
      // Moves any queue an older build kept in AsyncStorage into SQLite, once
      await localDb.migrateFromAsyncStorage().catch(() => {});
      const dbItems = await localDb.getAllOutbox().catch(() => []);
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
    } catch (err) {
      console.warn('[syncStore] Failed loading outbox from storage:', err);
    }
  },

  enqueueSurvey: async (bundle: SurveyBundlePayload) => {
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
    const deduplicated = get().outbox.filter(
      (item) => item.payload.session.id !== bundle.session.id
    );
    const updated = [...deduplicated, newItem];

    set({ outbox: updated, pendingCount: updated.length });

    // Trigger immediate background sync
    get()
      .triggerSync()
      .catch(() => {});
  },

  triggerSync: async () => {
    // The only uploader: the background worker calls this too, so a record
    // is never sent twice at once
    if (get().isSyncing) return { success: true, syncedCount: 0, alreadyUploaded: 0 };
    set({ isSyncing: true });
    try {
      await get().loadOutbox();
      const outbox = get().outbox;
      if (outbox.length === 0) return { success: true, syncedCount: 0, alreadyUploaded: 0 };

      // Guests keep their bundles queued until they sign in
      if (!(await hasAuthSession())) return { success: false, syncedCount: 0, alreadyUploaded: 0 };

      const syncedItemIds = new Set<string>();
      let alreadyUploaded = 0;
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
                const uploadRes = await withTimeout(
                  uploadAnimalPhoto(photo.storage_path, photo.observation_id, photo.id),
                  60000,
                  'Photo upload'
                ).catch((e: Error) => ({
                  success: false as const,
                  storagePath: photo.storage_path,
                  error: e.message,
                }));
                if (uploadRes.success && uploadRes.storagePath) {
                  photo.storage_path = uploadRes.storagePath;
                } else if (!(await photoFileExists(photo.storage_path))) {
                  // The file is gone for good; the record itself still counts.
                  // Mark it so it is dropped below instead of blocking forever.
                  photo.storage_path = '';
                } else {
                  photoUploadFailed = true;
                  photoErrorMsg = uploadRes.error || 'Photo upload failed';
                  break; // Stop uploading subsequent photos for this observation
                }
              }
            }
          }

          if (payload.photos)
            payload.photos = payload.photos.filter((ph) => ph.storage_path !== '');

          // CRITICAL DATA INTEGRITY: If photo upload failed, never push bundle with local file:// paths!
          if (photoUploadFailed) {
            failedItemsMap.set(item.id, {
              attempts: item.attempts + 1,
              lastError: photoErrorMsg || 'Photo upload failed - will retry',
            });
            continue;
          }

          const result = await withTimeout(pushSurveyBundle(payload), 45000, 'Upload').catch(
            (e: Error) => ({
              success: false as const,
              error: e.message,
            })
          );
          if (result.success) {
            syncedCount++;
            syncedItemIds.add(item.id);
            localDb.removeOutboxItem(item.id).catch(() => {});
            localDb.updateSessionStatus(payload.session.id, 'finished').catch(() => {});
          } else if (/belongs to another observer/.test(result.error ?? '')) {
            // The server already holds this exact walk, uploaded while another
            // account was signed in on this phone. Nothing is lost by letting go.
            alreadyUploaded++;
            syncedItemIds.add(item.id);
            localDb.removeOutboxItem(item.id).catch(() => {});
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

      const nowStr = formatTime(new Date());

      set({
        isSyncing: false,
        outbox: finalOutbox,
        pendingCount: finalOutbox.length,
        lastSyncedAt: syncedCount > 0 ? nowStr : get().lastSyncedAt,
      });

      return {
        success: finalOutbox.length === 0,
        syncedCount,
        alreadyUploaded,
      };
    } finally {
      // Whatever happened, the queue must be usable again
      if (get().isSyncing) set({ isSyncing: false });
    }
  },

  setWifiOnly: (wifiOnly) => {
    set({ wifiOnly });
  },

  discardFailed: () => {
    const failed = get().outbox.filter((o) => o.lastError);
    for (const o of failed) localDb.removeOutboxItem(o.id).catch(() => {});
    const outbox = get().outbox.filter((o) => !o.lastError);
    set({ outbox, pendingCount: outbox.length });
  },

  clearOutbox: () => {
    set({ outbox: [], pendingCount: 0 });
    storage.removeItem('hawem_outbox_v2').catch(() => {});
    localDb.clearAllForTesting();
  },
}));
