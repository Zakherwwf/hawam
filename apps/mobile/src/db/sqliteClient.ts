/**
 * Local SQLite Database Client for Offline-First Data Collection.
 * Stores observations, photos, and sessions locally before syncing to Supabase.
 */

export interface LocalObservation {
  id: string;
  session_id: string;
  observed_at: string;
  exact_lat: number;
  exact_lon: number;
  gps_accuracy_m: number;
  species: 'cat' | 'dog' | 'unknown';
  group_size: number;
  distance_from_path_m?: number | null;
  sex: 'male' | 'female' | 'unknown';
  age_class: 'juvenile' | 'adult' | 'unknown';
  reproductive_status: 'lactating' | 'visibly_pregnant' | 'none_visible' | 'unknown';
  body_condition_score: number;
  visible_health_issues_json: string;
  ear_tip_or_notch: 'yes' | 'no' | 'unknown';
  collar_or_tag: 'yes' | 'no' | 'unknown';
  behaviour: 'approachable' | 'neutral' | 'fearful' | 'aggressive';
  being_fed_by_people: 'yes' | 'no' | 'unknown';
  habitat_type: string;
  food_sources_json: string;
  notes?: string | null;
  synced: number; // 0 = false, 1 = true
}

export interface LocalSession {
  id: string;
  protocol: 'transect' | 'stationary_point' | 'incidental';
  route_id?: string | null;
  start_time: string;
  end_time?: string | null;
  duration_min?: number | null;
  track_json?: string | null;
  distance_km?: number | null;
  complete_session: number; // 0 or 1
  number_of_observers: number;
  synced: number;
}

export interface LocalPhoto {
  id: string;
  observation_id: string;
  local_file_uri: string;
  angle: 'left_flank' | 'right_flank' | 'face' | 'other';
  coat_pattern?: string | null;
  taken_at: string;
  uploaded: number;
  storage_path?: string | null;
}

export interface SyncQueueItem {
  id: string;
  entity_type: 'session' | 'observation' | 'photo';
  entity_id: string;
  action: 'insert' | 'update';
  payload_json: string;
  attempts: number;
  last_attempt?: string | null;
  status: 'pending' | 'in_progress' | 'failed' | 'synced';
}

/**
 * SQL statements to create all local tables in SQLite.
 */
export const LOCAL_DATABASE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS local_sessions (
    id TEXT PRIMARY KEY,
    protocol TEXT NOT NULL,
    route_id TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_min REAL,
    track_json TEXT,
    distance_km REAL,
    complete_session INTEGER NOT NULL DEFAULT 0,
    number_of_observers INTEGER NOT NULL DEFAULT 1,
    synced INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS local_observations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    observed_at TEXT NOT NULL,
    exact_lat REAL NOT NULL,
    exact_lon REAL NOT NULL,
    gps_accuracy_m REAL NOT NULL,
    species TEXT NOT NULL,
    group_size INTEGER NOT NULL DEFAULT 1,
    distance_from_path_m REAL,
    sex TEXT NOT NULL,
    age_class TEXT NOT NULL,
    reproductive_status TEXT NOT NULL,
    body_condition_score INTEGER NOT NULL,
    visible_health_issues_json TEXT NOT NULL DEFAULT '[]',
    ear_tip_or_notch TEXT NOT NULL,
    collar_or_tag TEXT NOT NULL,
    behaviour TEXT NOT NULL,
    being_fed_by_people TEXT NOT NULL,
    habitat_type TEXT NOT NULL,
    food_sources_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT,
    synced INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(session_id) REFERENCES local_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS local_photos (
    id TEXT PRIMARY KEY,
    observation_id TEXT NOT NULL,
    local_file_uri TEXT NOT NULL,
    angle TEXT NOT NULL,
    coat_pattern TEXT,
    taken_at TEXT NOT NULL,
    uploaded INTEGER NOT NULL DEFAULT 0,
    storage_path TEXT,
    FOREIGN KEY(observation_id) REFERENCES local_observations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_local_obs_session ON local_observations(session_id);
`;
