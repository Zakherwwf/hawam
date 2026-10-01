/**
 * Universal Local Database Repository for Hawem
 * SQLite + Drizzle ORM for React Native Hermes runtime,
 * with fast in-memory fallback for Node.js test suites.
 */

import { storage } from '../services/storageAdapter.ts';
import type {
  LocalSessionRecord,
  NewLocalSessionRecord,
  LocalTrackPointRecord,
  NewLocalTrackPointRecord,
  LocalObservationRecord,
  NewLocalObservationRecord,
  LocalPhotoRecord,
  NewLocalPhotoRecord,
  SyncOutboxRecord,
  NewSyncOutboxRecord,
} from './schema.ts';

let expoSqlite: any = null;
try {
  expoSqlite = require('expo-sqlite');
} catch {}

let dbInstance: any = null;

const inMemorySessions = new Map<string, LocalSessionRecord>();
const inMemoryTrackPoints = new Map<string, LocalTrackPointRecord[]>();
const inMemoryObservations = new Map<string, LocalObservationRecord[]>();
const inMemoryPhotos = new Map<string, LocalPhotoRecord[]>();
const inMemoryOutbox = new Map<string, SyncOutboxRecord>();

function isNativeSqliteAvailable(): boolean {
  return Boolean(expoSqlite && typeof expoSqlite.openDatabaseSync === 'function');
}

export function getDatabase() {
  if (!isNativeSqliteAvailable()) {
    return null;
  }
  if (!dbInstance) {
    try {
      dbInstance = expoSqlite.openDatabaseSync('hawem.db');
      initNativeTables(dbInstance);
    } catch {
      dbInstance = null;
    }
  }
  return dbInstance;
}

function initNativeTables(db: any) {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS local_sessions (
      id TEXT PRIMARY KEY,
      protocol TEXT NOT NULL,
      route_id TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_min REAL DEFAULT 0,
      distance_km REAL DEFAULT 0,
      complete_checklist INTEGER NOT NULL DEFAULT 1,
      number_of_observers INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      synced INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_track_points (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy_m REAL,
      speed_mps REAL,
      mocked INTEGER DEFAULT 0,
      rejected_reason TEXT,
      recorded_at TEXT NOT NULL,
      FOREIGN KEY(session_id) REFERENCES local_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS local_observations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      observer_lat REAL NOT NULL,
      observer_lon REAL NOT NULL,
      animal_lat REAL NOT NULL,
      animal_lon REAL NOT NULL,
      gps_accuracy_m REAL,
      bearing_deg REAL,
      distance_estimate_m REAL NOT NULL DEFAULT 0,
      perpendicular_distance_m REAL,
      h3_res9 TEXT NOT NULL DEFAULT '',
      species TEXT NOT NULL,
      group_size INTEGER NOT NULL DEFAULT 1,
      body_condition_score INTEGER,
      health_issues_json TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      synced INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(session_id) REFERENCES local_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS local_photos (
      id TEXT PRIMARY KEY,
      observation_id TEXT NOT NULL,
      local_file_uri TEXT NOT NULL,
      storage_path TEXT,
      taken_at TEXT NOT NULL,
      uploaded INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sync_outbox (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      backoff_until TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tp_session ON local_track_points(session_id);
    CREATE INDEX IF NOT EXISTS idx_obs_session ON local_observations(session_id);
    CREATE INDEX IF NOT EXISTS idx_outbox_status ON sync_outbox(status);
  `);
}

export const localDb = {
  // Session methods
  insertSession: async (session: NewLocalSessionRecord): Promise<void> => {
    const record: LocalSessionRecord = {
      ...session,
      routeId: session.routeId ?? null,
      endedAt: session.endedAt ?? null,
      durationMin: session.durationMin ?? 0,
      distanceKm: session.distanceKm ?? 0,
      completeChecklist: session.completeChecklist ?? true,
      numberOfObservers: session.numberOfObservers ?? 1,
      status: session.status ?? 'active',
      synced: session.synced ?? false,
    };
    inMemorySessions.set(session.id, record);

    const db = getDatabase();
    if (db) {
      try {
        db.runSync(
          `INSERT OR REPLACE INTO local_sessions (id, protocol, route_id, started_at, ended_at, duration_min, distance_km, complete_checklist, number_of_observers, status, synced, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.id,
            record.protocol,
            record.routeId,
            record.startedAt,
            record.endedAt,
            record.durationMin,
            record.distanceKm,
            record.completeChecklist ? 1 : 0,
            record.numberOfObservers,
            record.status,
            record.synced ? 1 : 0,
            record.createdAt,
          ]
        );
      } catch (err) {
        console.warn('[localDb] Error inserting session:', err);
      }
    }
  },

  updateSessionStatus: async (
    sessionId: string,
    status: string,
    endedAt?: string
  ): Promise<void> => {
    const mem = inMemorySessions.get(sessionId);
    if (mem) {
      mem.status = status;
      if (endedAt) mem.endedAt = endedAt;
    }

    const db = getDatabase();
    if (db) {
      try {
        if (endedAt) {
          db.runSync(`UPDATE local_sessions SET status = ?, ended_at = ? WHERE id = ?`, [
            status,
            endedAt,
            sessionId,
          ]);
        } else {
          db.runSync(`UPDATE local_sessions SET status = ? WHERE id = ?`, [status, sessionId]);
        }
      } catch (err) {
        console.warn('[localDb] Error updating session status:', err);
      }
    }
  },

  updateSessionMetrics: async (
    sessionId: string,
    durationMin: number,
    distanceKm: number
  ): Promise<void> => {
    const mem = inMemorySessions.get(sessionId);
    if (mem) {
      mem.durationMin = durationMin;
      mem.distanceKm = distanceKm;
    }

    const db = getDatabase();
    if (db) {
      try {
        db.runSync(`UPDATE local_sessions SET duration_min = ?, distance_km = ? WHERE id = ?`, [
          durationMin,
          distanceKm,
          sessionId,
        ]);
      } catch (err) {
        console.warn('[localDb] Error updating session metrics:', err);
      }
    }
  },

  getUnfinishedSession: async (): Promise<LocalSessionRecord | null> => {
    const db = getDatabase();
    if (db) {
      try {
        const row = db.getFirstSync(
          `SELECT * FROM local_sessions WHERE status IN ('active', 'paused', 'recovered') ORDER BY started_at DESC LIMIT 1`
        );
        if (row) {
          return {
            id: row.id,
            protocol: row.protocol,
            routeId: row.route_id,
            startedAt: row.started_at,
            endedAt: row.ended_at,
            durationMin: row.duration_min,
            distanceKm: row.distance_km,
            completeChecklist: Boolean(row.complete_checklist),
            numberOfObservers: row.number_of_observers,
            status: row.status,
            synced: Boolean(row.synced),
            createdAt: row.created_at,
          };
        }
      } catch (err) {
        console.warn('[localDb] Error querying unfinished session:', err);
      }
    }

    for (const session of inMemorySessions.values()) {
      if (['active', 'paused', 'recovered'].includes(session.status)) {
        return session;
      }
    }
    return null;
  },

  // Track Points
  insertTrackPoint: async (point: NewLocalTrackPointRecord): Promise<void> => {
    const record: LocalTrackPointRecord = {
      ...point,
      accuracyM: point.accuracyM ?? null,
      speedMps: point.speedMps ?? null,
      mocked: point.mocked ?? false,
      rejectedReason: point.rejectedReason ?? null,
    };
    const list = inMemoryTrackPoints.get(point.sessionId) || [];
    list.push(record);
    inMemoryTrackPoints.set(point.sessionId, list);

    const db = getDatabase();
    if (db) {
      try {
        db.runSync(
          `INSERT INTO local_track_points (id, session_id, latitude, longitude, accuracy_m, speed_mps, mocked, rejected_reason, recorded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.id,
            record.sessionId,
            record.latitude,
            record.longitude,
            record.accuracyM,
            record.speedMps,
            record.mocked ? 1 : 0,
            record.rejectedReason,
            record.recordedAt,
          ]
        );
      } catch (err) {
        console.warn('[localDb] Error inserting track point:', err);
      }
    }
  },

  getTrackPointsBySession: async (sessionId: string): Promise<LocalTrackPointRecord[]> => {
    const db = getDatabase();
    if (db) {
      try {
        const rows = db.getAllSync(
          `SELECT * FROM local_track_points WHERE session_id = ? ORDER BY recorded_at ASC`,
          [sessionId]
        );
        return rows.map((r: any) => ({
          id: r.id,
          sessionId: r.session_id,
          latitude: r.latitude,
          longitude: r.longitude,
          accuracyM: r.accuracy_m,
          speedMps: r.speed_mps,
          mocked: Boolean(r.mocked),
          rejectedReason: r.rejected_reason,
          recordedAt: r.recorded_at,
        }));
      } catch (err) {
        console.warn('[localDb] Error querying track points:', err);
      }
    }
    return inMemoryTrackPoints.get(sessionId) || [];
  },

  // Observations
  insertObservation: async (obs: NewLocalObservationRecord): Promise<void> => {
    const record: LocalObservationRecord = {
      ...obs,
      gpsAccuracyM: obs.gpsAccuracyM ?? null,
      bearingDeg: obs.bearingDeg ?? null,
      distanceEstimateM: obs.distanceEstimateM ?? 0,
      perpendicularDistanceM: obs.perpendicularDistanceM ?? null,
      h3Res9: obs.h3Res9 ?? '',
      groupSize: obs.groupSize ?? 1,
      bodyConditionScore: obs.bodyConditionScore ?? null,
      healthIssuesJson: obs.healthIssuesJson ?? '[]',
      notes: obs.notes ?? null,
      synced: obs.synced ?? false,
    };
    const list = inMemoryObservations.get(obs.sessionId) || [];
    list.push(record);
    inMemoryObservations.set(obs.sessionId, list);

    const db = getDatabase();
    if (db) {
      try {
        db.runSync(
          `INSERT OR REPLACE INTO local_observations (id, session_id, observed_at, observer_lat, observer_lon, animal_lat, animal_lon, gps_accuracy_m, bearing_deg, distance_estimate_m, perpendicular_distance_m, h3_res9, species, group_size, body_condition_score, health_issues_json, notes, synced)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.id,
            record.sessionId,
            record.observedAt,
            record.observerLat,
            record.observerLon,
            record.animalLat,
            record.animalLon,
            record.gpsAccuracyM,
            record.bearingDeg,
            record.distanceEstimateM,
            record.perpendicularDistanceM,
            record.h3Res9,
            record.species,
            record.groupSize,
            record.bodyConditionScore,
            record.healthIssuesJson,
            record.notes,
            record.synced ? 1 : 0,
          ]
        );
      } catch (err) {
        console.warn('[localDb] Error inserting observation:', err);
      }
    }
  },

  getObservationsBySession: async (sessionId: string): Promise<LocalObservationRecord[]> => {
    const db = getDatabase();
    if (db) {
      try {
        const rows = db.getAllSync(
          `SELECT * FROM local_observations WHERE session_id = ? ORDER BY observed_at ASC`,
          [sessionId]
        );
        return rows.map((r: any) => ({
          id: r.id,
          sessionId: r.session_id,
          observedAt: r.observed_at,
          observerLat: r.observer_lat,
          observerLon: r.observer_lon,
          animalLat: r.animal_lat,
          animalLon: r.animal_lon,
          gpsAccuracyM: r.gps_accuracy_m,
          bearingDeg: r.bearing_deg,
          distanceEstimateM: r.distance_estimate_m,
          perpendicularDistanceM: r.perpendicular_distance_m,
          h3Res9: r.h3_res9,
          species: r.species,
          groupSize: r.group_size,
          bodyConditionScore: r.body_condition_score,
          healthIssuesJson: r.health_issues_json,
          notes: r.notes,
          synced: Boolean(r.synced),
        }));
      } catch (err) {
        console.warn('[localDb] Error querying observations:', err);
      }
    }
    return inMemoryObservations.get(sessionId) || [];
  },

  deleteObservation: async (id: string, sessionId: string): Promise<void> => {
    const list = inMemoryObservations.get(sessionId) || [];
    inMemoryObservations.set(
      sessionId,
      list.filter((o) => o.id !== id)
    );

    const db = getDatabase();
    if (db) {
      try {
        db.runSync(`DELETE FROM local_observations WHERE id = ?`, [id]);
      } catch (err) {
        console.warn('[localDb] Error deleting observation:', err);
      }
    }
  },

  // Outbox
  enqueueOutbox: async (item: NewSyncOutboxRecord): Promise<void> => {
    const record: SyncOutboxRecord = {
      ...item,
      status: item.status ?? 'pending',
      attempts: item.attempts ?? 0,
      lastError: item.lastError ?? null,
      backoffUntil: item.backoffUntil ?? null,
    };
    inMemoryOutbox.set(item.id, record);

    const db = getDatabase();
    if (db) {
      try {
        db.runSync(
          `INSERT OR REPLACE INTO sync_outbox (id, session_id, payload_json, created_at, status, attempts, last_error, backoff_until)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.id,
            record.sessionId,
            record.payloadJson,
            record.createdAt,
            record.status,
            record.attempts,
            record.lastError,
            record.backoffUntil,
          ]
        );
      } catch (err) {
        console.warn('[localDb] Error enqueueing outbox:', err);
      }
    }
  },

  getPendingOutbox: async (): Promise<SyncOutboxRecord[]> => {
    const nowIso = new Date().toISOString();
    const db = getDatabase();
    if (db) {
      try {
        const rows = db.getAllSync(
          `SELECT * FROM sync_outbox WHERE status != 'synced' AND (backoff_until IS NULL OR backoff_until <= ?) ORDER BY created_at ASC`,
          [nowIso]
        );
        return rows.map((r: any) => ({
          id: r.id,
          sessionId: r.session_id,
          payloadJson: r.payload_json,
          createdAt: r.created_at,
          status: r.status,
          attempts: r.attempts,
          lastError: r.last_error,
          backoffUntil: r.backoff_until,
        }));
      } catch (err) {
        console.warn('[localDb] Error querying pending outbox:', err);
      }
    }

    const result: SyncOutboxRecord[] = [];
    for (const item of inMemoryOutbox.values()) {
      if (item.status !== 'synced') {
        if (!item.backoffUntil || item.backoffUntil <= nowIso) {
          result.push(item);
        }
      }
    }
    return result;
  },

  updateOutboxStatus: async (
    id: string,
    status: 'pending' | 'syncing' | 'failed' | 'synced',
    attempts: number,
    lastError?: string,
    backoffUntil?: string
  ): Promise<void> => {
    const mem = inMemoryOutbox.get(id);
    if (mem) {
      mem.status = status;
      mem.attempts = attempts;
      if (lastError !== undefined) mem.lastError = lastError;
      if (backoffUntil !== undefined) mem.backoffUntil = backoffUntil;
    }

    const db = getDatabase();
    if (db) {
      try {
        db.runSync(
          `UPDATE sync_outbox SET status = ?, attempts = ?, last_error = ?, backoff_until = ? WHERE id = ?`,
          [status, attempts, lastError ?? null, backoffUntil ?? null, id]
        );
      } catch (err) {
        console.warn('[localDb] Error updating outbox status:', err);
      }
    }
  },

  removeOutboxItem: async (id: string): Promise<void> => {
    inMemoryOutbox.delete(id);
    const db = getDatabase();
    if (db) {
      try {
        db.runSync(`DELETE FROM sync_outbox WHERE id = ?`, [id]);
      } catch (err) {
        console.warn('[localDb] Error removing outbox item:', err);
      }
    }
  },

  getAllOutbox: async (): Promise<SyncOutboxRecord[]> => {
    const db = getDatabase();
    if (db) {
      try {
        const rows = db.getAllSync(`SELECT * FROM sync_outbox ORDER BY created_at ASC`);
        return rows.map((r: any) => ({
          id: r.id,
          sessionId: r.session_id,
          payloadJson: r.payload_json,
          createdAt: r.created_at,
          status: r.status,
          attempts: r.attempts,
          lastError: r.last_error,
          backoffUntil: r.backoff_until,
        }));
      } catch (err) {
        console.warn('[localDb] Error querying all outbox:', err);
      }
    }
    return Array.from(inMemoryOutbox.values());
  },

  clearAllForTesting: () => {
    inMemorySessions.clear();
    inMemoryTrackPoints.clear();
    inMemoryObservations.clear();
    inMemoryPhotos.clear();
    inMemoryOutbox.clear();
  },

  // One-time legacy migration from AsyncStorage
  migrateFromAsyncStorage: async (): Promise<{ migratedOutboxCount: number }> => {
    let migratedOutboxCount = 0;
    try {
      const storedOutbox = await storage.getItem('hawem_outbox_v2');
      if (storedOutbox) {
        const parsed = JSON.parse(storedOutbox);
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const item of parsed) {
            if (item && item.payload && item.payload.session) {
              await localDb.enqueueOutbox({
                id: item.id || `outbox-${item.payload.session.id}`,
                sessionId: item.payload.session.id,
                payloadJson: JSON.stringify(item.payload),
                createdAt: item.created_at || new Date().toISOString(),
                status: item.status || 'pending',
                attempts: item.attempts || 0,
                lastError: item.lastError || null,
              });
              migratedOutboxCount++;
            }
          }
        }
        // Moved, not copied: a copy left behind brought uploaded records back
        // on every launch, and they were sent again
        await storage.removeItem('hawem_outbox_v2');
      }
    } catch (err) {
      console.warn('[localDb] Legacy migration warning:', err);
    }
    return { migratedOutboxCount };
  },
};
