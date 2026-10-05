/**
 * Resilient Outbox Worker for Hawem
 * Starts uploads when the network returns or the app comes to the
 * foreground, honouring Wi-Fi-only. The upload itself is the sync store's
 * triggerSync, so there is a single uploader.
 */

import { localDb } from '../../db/localDb.ts';
import { useSyncStore } from '../../features/sync/syncStore.ts';

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

    // One uploader for the whole app: the sync store owns the queue
    const res = await useSyncStore.getState().triggerSync();
    processed = pendingItems.length;
    succeeded = res.syncedCount + res.alreadyUploaded;
    failed = useSyncStore.getState().pendingCount;
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
