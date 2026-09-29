/**
 * Resilient Outbox Worker for Hawem
 * Background sync worker with NetInfo, exponential backoff with jitter,
 * resumable photo uploads, and Wi-Fi-only enforcement.
 */

import { localDb } from '../../db/localDb.ts';
import { hasAuthSession, pushSurveyBundle, type SurveyBundlePayload } from '../supabase.ts';
import { isBucketPath, uploadAnimalPhoto } from '../storageService.ts';
import { sanitizeBundleUuids } from '../../features/sync/syncStore.ts';

export interface NetworkConnectionState {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
  type?: string;
  [key: string]: any;
}

let NetInfoClient: any = null;
try {
  const mod = require('@react-native-community/netinfo');
  NetInfoClient = mod.default || mod;
} catch {}

let AppStateClient: any = null;
try {
  const RN = require('react-native');
  AppStateClient = RN.AppState;
} catch {}

let isProcessing = false;
let netInfoUnsubscribe: (() => void) | null = null;
let appStateSubscription: any = null;

export function computeBackoffMs(
  attempts: number,
  baseMs: number = 1000,
  maxMs: number = 300000
): number {
  const exponential = baseMs * Math.pow(2, attempts);
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(maxMs, exponential + jitter);
}

export async function processOutboxNow(options?: {
  wifiOnly?: boolean;
  forcedNetState?: NetworkConnectionState | null;
}): Promise<{ processed: number; succeeded: number; failed: number }> {
  if (isProcessing) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  isProcessing = true;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    const netState =
      options?.forcedNetState !== undefined
        ? options.forcedNetState
        : await (NetInfoClient?.fetch ? NetInfoClient.fetch() : Promise.resolve(null)).catch(
            () => null
          );

    // If device is offline, skip processing
    if (netState && (!netState.isConnected || netState.isInternetReachable === false)) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    // Check Wi-Fi only restriction
    if (options?.wifiOnly && netState && netState.type !== 'wifi') {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    const pendingItems = await localDb.getPendingOutbox();
    if (pendingItems.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    // Guests keep their bundles queued until they sign in
    if (!(await hasAuthSession())) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    for (const item of pendingItems) {
      processed++;
      let payload: SurveyBundlePayload;
      try {
        payload = sanitizeBundleUuids(JSON.parse(item.payloadJson));
      } catch {
        await localDb.updateOutboxStatus(
          item.id,
          'failed',
          item.attempts + 1,
          'Malformed payload JSON'
        );
        failed++;
        continue;
      }

      await localDb.updateOutboxStatus(item.id, 'syncing', item.attempts);

      // Phase 1: Upload local photo binaries to private bucket
      let photoFailure = false;
      let photoErrorMsg: string | undefined;

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
              photoFailure = true;
              photoErrorMsg = uploadRes.error || 'Photo upload failed';
              break;
            }
          }
        }
      }

      if (photoFailure) {
        const nextAttempts = item.attempts + 1;
        const delayMs = computeBackoffMs(nextAttempts);
        const backoffUntil = new Date(Date.now() + delayMs).toISOString();

        await localDb.updateOutboxStatus(
          item.id,
          'failed',
          nextAttempts,
          photoErrorMsg || 'Photo upload failed',
          backoffUntil
        );
        failed++;
        continue;
      }

      // Phase 2: Submit bundle to idempotent Supabase RPC
      try {
        const result = await pushSurveyBundle(payload);
        if (result.success) {
          succeeded++;
          await localDb.updateOutboxStatus(item.id, 'synced', item.attempts);
          await localDb.removeOutboxItem(item.id);
        } else {
          failed++;
          const nextAttempts = item.attempts + 1;
          const delayMs = computeBackoffMs(nextAttempts);
          const backoffUntil = new Date(Date.now() + delayMs).toISOString();

          await localDb.updateOutboxStatus(
            item.id,
            'failed',
            nextAttempts,
            result.error || 'Server error',
            backoffUntil
          );
        }
      } catch (err: any) {
        failed++;
        const nextAttempts = item.attempts + 1;
        const delayMs = computeBackoffMs(nextAttempts);
        const backoffUntil = new Date(Date.now() + delayMs).toISOString();

        await localDb.updateOutboxStatus(
          item.id,
          'failed',
          nextAttempts,
          err?.message || 'Network exception',
          backoffUntil
        );
      }
    }
  } finally {
    isProcessing = false;
  }

  return { processed, succeeded, failed };
}

export function startOutboxWorker(getWifiOnly?: () => boolean): () => void {
  // Listen to network changes
  if (NetInfoClient?.addEventListener) {
    netInfoUnsubscribe = NetInfoClient.addEventListener((state: any) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        const wifiOnly = getWifiOnly ? getWifiOnly() : false;
        processOutboxNow({ wifiOnly }).catch(() => {});
      }
    });
  }

  // Listen to app foregrounding
  const handleAppStateChange = (nextState: string) => {
    if (nextState === 'active') {
      const wifiOnly = getWifiOnly ? getWifiOnly() : false;
      processOutboxNow({ wifiOnly }).catch(() => {});
    }
  };

  if (AppStateClient?.addEventListener) {
    appStateSubscription = AppStateClient.addEventListener('change', handleAppStateChange);
  }

  // Trigger initial check
  const wifiOnly = getWifiOnly ? getWifiOnly() : false;
  processOutboxNow({ wifiOnly }).catch(() => {});

  return () => {
    if (netInfoUnsubscribe) {
      netInfoUnsubscribe();
      netInfoUnsubscribe = null;
    }
    if (appStateSubscription) {
      if (typeof appStateSubscription.remove === 'function') {
        appStateSubscription.remove();
      }
      appStateSubscription = null;
    }
  };
}
