import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const localSessionsTable = sqliteTable('local_sessions', {
  id: text('id').primaryKey(),
  protocol: text('protocol').notNull(),
  routeId: text('route_id'),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  durationMin: real('duration_min').default(0),
  distanceKm: real('distance_km').default(0),
  completeChecklist: integer('complete_checklist', { mode: 'boolean' }).notNull().default(true),
  numberOfObservers: integer('number_of_observers').notNull().default(1),
  status: text('status').notNull().default('active'), // 'active' | 'paused' | 'finished' | 'recovered'
  synced: integer('synced', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

export const localTrackPointsTable = sqliteTable('local_track_points', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  accuracyM: real('accuracy_m'),
  speedMps: real('speed_mps'),
  mocked: integer('mocked', { mode: 'boolean' }).default(false),
  rejectedReason: text('rejected_reason'),
  recordedAt: text('recorded_at').notNull(),
});

export const localObservationsTable = sqliteTable('local_observations', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  observedAt: text('observed_at').notNull(),
  observerLat: real('observer_lat').notNull(),
  observerLon: real('observer_lon').notNull(),
  animalLat: real('animal_lat').notNull(),
  animalLon: real('animal_lon').notNull(),
  gpsAccuracyM: real('gps_accuracy_m'),
  bearingDeg: real('bearing_deg'),
  distanceEstimateM: real('distance_estimate_m').notNull().default(0),
  perpendicularDistanceM: real('perpendicular_distance_m'),
  h3Res9: text('h3_res9').notNull().default(''),
  species: text('species').notNull(), // 'cat' | 'dog' | 'unknown'
  groupSize: integer('group_size').notNull().default(1),
  bodyConditionScore: integer('body_condition_score'),
  healthIssuesJson: text('health_issues_json').notNull().default('[]'),
  notes: text('notes'),
  synced: integer('synced', { mode: 'boolean' }).notNull().default(false),
});

export const localPhotosTable = sqliteTable('local_photos', {
  id: text('id').primaryKey(),
  observationId: text('observation_id').notNull(),
  localFileUri: text('local_file_uri').notNull(),
  storagePath: text('storage_path'),
  takenAt: text('taken_at').notNull(),
  uploaded: integer('uploaded', { mode: 'boolean' }).notNull().default(false),
});

export const syncOutboxTable = sqliteTable('sync_outbox', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  payloadJson: text('payload_json').notNull(),
  createdAt: text('created_at').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'syncing' | 'failed'
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  backoffUntil: text('backoff_until'),
});

export type LocalSessionRecord = typeof localSessionsTable.$inferSelect;
export type NewLocalSessionRecord = typeof localSessionsTable.$inferInsert;

export type LocalTrackPointRecord = typeof localTrackPointsTable.$inferSelect;
export type NewLocalTrackPointRecord = typeof localTrackPointsTable.$inferInsert;

export type LocalObservationRecord = typeof localObservationsTable.$inferSelect;
export type NewLocalObservationRecord = typeof localObservationsTable.$inferInsert;

export type LocalPhotoRecord = typeof localPhotosTable.$inferSelect;
export type NewLocalPhotoRecord = typeof localPhotosTable.$inferInsert;

export type SyncOutboxRecord = typeof syncOutboxTable.$inferSelect;
export type NewSyncOutboxRecord = typeof syncOutboxTable.$inferInsert;
