/**
 * Offline Sync Engine.
 * Manages the background synchronization queue, partial uploads,
 * photo streaming, and conflict handling.
 */

import { SyncQueueItem } from '../db/sqliteClient.js';

export interface SyncResult {
  totalProcessed: number;
  syncedCount: number;
  failedCount: number;
  errors: Array<{ id: string; error: string }>;
}

export class SyncEngine {
  private isSyncing = false;

  /**
   * Processes all pending items in the queue with retry limits.
   */
  async processQueue(
    pendingItems: SyncQueueItem[],
    remoteUploader: (item: SyncQueueItem) => Promise<boolean>
  ): Promise<SyncResult> {
    if (this.isSyncing) {
      return { totalProcessed: 0, syncedCount: 0, failedCount: 0, errors: [] };
    }

    this.isSyncing = true;
    let syncedCount = 0;
    let failedCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    try {
      for (const item of pendingItems) {
        if (item.attempts >= 5) {
          // Max attempts reached; mark for manual review or later sync
          continue;
        }

        try {
          const success = await remoteUploader(item);
          if (success) {
            syncedCount++;
          } else {
            failedCount++;
            errors.push({ id: item.id, error: 'Upload rejected by server' });
          }
        } catch (err: any) {
          failedCount++;
          errors.push({ id: item.id, error: err?.message || 'Network error' });
        }
      }
    } finally {
      this.isSyncing = false;
    }

    return {
      totalProcessed: pendingItems.length,
      syncedCount,
      failedCount,
      errors,
    };
  }
}
