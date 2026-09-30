import type { Species } from '@tunisia-survey/shared';

/** One sighting as the app lists and maps it. */
export interface SightingItem {
  id: string;
  species: Species;
  group_size: number;
  distance_from_path_m?: number;
  latitude: number;
  longitude: number;
  observed_at: string;
  body_condition_score?: number;
  protocol: 'transect' | 'stationary_point' | 'incidental';
  health_issues?: string[];
  photos?: string[];
  notes?: string;
  identifier?: string; // the observer's own tag, editable
  observer_name?: string;
  publicCode?: string; // permanent code assigned by the database (CAT-000123)
  syncPending?: boolean; // saved on this phone, not yet on the server
}

/** The signed-in volunteer's profile. */
export interface UserAccount {
  name: string;
  email: string;
  organization: string;
  role: 'surveyor' | 'volunteer' | 'researcher';
  governorate: string;
  surveyorId: string;
  avatarUri?: string;
  createdAt: string;
}
