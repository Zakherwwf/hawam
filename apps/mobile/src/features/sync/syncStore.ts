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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushSurveyBundle, SurveyBundlePayload } from '../../services/supabase';
import { uploadAnimalPhoto } from '../../services/storageService';

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
  lastSyncedAt: 'Just now',
  pendingCount: 0,
  wifiOnly: false,
  outbox: [],

  loadOutbox: async () => {
    try {
      const stored = await AsyncStorage.getItem('hawem_outbox_v2');
      if (stored) {
        const parsed: OutboxItem[] = JSON.parse(stored);
        set({ outbox: parsed, pendingCount: parsed.length });
      }
    } catch (err) {
      console.warn('Failed loading outbox from storage:', err);
    }
  },

  enqueueSurvey: async (bundle: SurveyBundlePayload) => {
    const { outbox } = get();
    const newItem: OutboxItem = {
      id: `outbox-${bundle.session.id}`,
      payload: bundle,
      created_at: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
    };

    const updated = [...outbox, newItem];
    set({ outbox: updated, pendingCount: updated.length });
    await AsyncStorage.setItem('hawem_outbox_v2', JSON.stringify(updated)).catch(() => {});

    // Try immediate background sync
    get().triggerSync().catch(() => {});
  },

  triggerSync: async () => {
    const { outbox, isSyncing } = get();
    if (isSyncing || outbox.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    set({ isSyncing: true });

    const remainingItems: OutboxItem[] = [];
    let syncedCount = 0;

    for (const item of outbox) {
      try {
        // Upload any local binary photos to Supabase Storage before RPC bundle submission
        if (item.payload.photos && item.payload.photos.length > 0) {
          for (const photo of item.payload.photos) {
            if (
              photo.storage_path &&
              !photo.storage_path.startsWith('http://') &&
              !photo.storage_path.startsWith('https://') &&
              !photo.storage_path.startsWith('observations/')
            ) {
              const uploadRes = await uploadAnimalPhoto(
                photo.storage_path,
                photo.observation_id,
                photo.id
              );
              if (uploadRes.success) {
                photo.storage_path = uploadRes.storagePath;
              }
            }
          }
        }

        const result = await pushSurveyBundle(item.payload);
        if (result.success) {
          syncedCount++;
        } else {
          remainingItems.push({
            ...item,
            attempts: item.attempts + 1,
            status: 'failed',
            lastError: result.error,
          });
        }
      } catch (err: any) {
        remainingItems.push({
          ...item,
          attempts: item.attempts + 1,
          status: 'failed',
          lastError: err?.message || 'Sync failed',
        });
      }
    }

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    set({
      isSyncing: false,
      outbox: remainingItems,
      pendingCount: remainingItems.length,
      lastSyncedAt: syncedCount > 0 ? nowStr : get().lastSyncedAt,
    });

    await AsyncStorage.setItem('hawem_outbox_v2', JSON.stringify(remainingItems)).catch(() => {});

    return {
      success: remainingItems.length === 0,
      syncedCount,
    };
  },

  setWifiOnly: (wifiOnly) => {
    set({ wifiOnly });
  },

  clearOutbox: () => {
    set({ outbox: [], pendingCount: 0 });
    AsyncStorage.removeItem('hawem_outbox_v2').catch(() => {});
  },
}));
