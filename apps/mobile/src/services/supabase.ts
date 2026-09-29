/**
 * Supabase Full-Stack Client & Services
 * Hawem (حايم) Citizen-Science Platform
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://opglgsidxoedlmgegojz.supabase.co';
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZ2xnc2lkeG9lZGxtZ2Vnb2p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxOTI0NzYsImV4cCI6MjEwNTc2ODQ3Nn0.XURVPJme6rqr3HPiQUnOXgcjfYMwuaMMNtZNy2hNh0w';

const storageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (typeof AsyncStorage?.getItem === 'function') {
        return await AsyncStorage.getItem(key);
      }
      if (typeof (AsyncStorage as any)?.default?.getItem === 'function') {
        return await (AsyncStorage as any).default.getItem(key);
      }
      return null;
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (typeof AsyncStorage?.setItem === 'function') {
        await AsyncStorage.setItem(key, value);
      } else if (typeof (AsyncStorage as any)?.default?.setItem === 'function') {
        await (AsyncStorage as any).default.setItem(key, value);
      }
    } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (typeof AsyncStorage?.removeItem === 'function') {
        await AsyncStorage.removeItem(key);
      } else if (typeof (AsyncStorage as any)?.default?.removeItem === 'function') {
        await (AsyncStorage as any).default.removeItem(key);
      }
    } catch {}
  },
};

const isTestEnv = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || !process.env.EXPO_OS);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: storageAdapter,
    persistSession: true,
    autoRefreshToken: !isTestEnv,
    detectSessionInUrl: false,
  },
});

export interface SurveyBundlePayload {
  session: {
    id: string;
    observer_id?: string;
    protocol: 'transect' | 'stationary_point' | 'incidental';
    route_id?: string | null;
    start_time: string;
    end_time?: string | null;
    distance_km?: number | null;
    complete_session: boolean;
    number_of_observers?: number;
    weather?: string | null;
    time_of_day?: string | null;
    app_version?: string;
    device_gps_accuracy_avg?: number | null;
    notes?: string | null;
  };
  track?: {
    type: 'LineString';
    coordinates: [number, number][]; // [lon, lat]
  } | null;
  track_points?: Array<{
    recorded_at: string;
    latitude: number;
    longitude: number;
    accuracy_m?: number | null;
    speed_mps?: number | null;
  }>;
  observations: Array<{
    id: string;
    observed_at: string;
    species: 'cat' | 'dog' | 'unknown';
    group_size?: number;
    distance_from_path_m?: number | null;
    body_condition_score?: number | null;
    observer_location?: {
      latitude?: number;
      longitude?: number;
      type?: 'Point';
      coordinates?: [number, number]; // [lon, lat]
    };
    bearing_deg?: number | null;
    distance_estimate_m?: number | null;
    gps_accuracy_m?: number | null;
    location: {
      latitude?: number;
      longitude?: number;
      type?: 'Point';
      coordinates?: [number, number]; // [lon, lat]
    };
    notes?: string | null;
  }>;
  photos?: Array<{
    id: string;
    observation_id: string;
    storage_path: string;
    angle: 'left_flank' | 'right_flank' | 'face' | 'other';
    taken_at: string;
  }>;
}

/**
 * Uploads and submit_survey_bundle require a signed-in user. Sync callers
 * check this first so guest data stays queued locally instead of burning
 * retry attempts on requests the server will reject.
 */
export async function hasAuthSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return !!data?.session?.user?.id;
  } catch {
    return false;
  }
}

/**
 * Ensures the authenticated user has accepted consent in public.users on Supabase.
 * The submit_survey_bundle RPC requires consent_accepted_at to be non-null.
 */
export async function ensureUserConsentAccepted(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      await supabase
        .from('users')
        .update({
          consent_version: 1,
          consent_accepted_at: new Date().toISOString(),
        })
        .eq('id', session.user.id)
        .is('consent_accepted_at', null);
    }
  } catch (err) {
    console.warn('Failed to ensure user consent:', err);
  }
}

/**
 * Pushes a complete survey bundle to PostgreSQL via the secure submit_survey_bundle RPC
 */
export async function pushSurveyBundle(payload: SurveyBundlePayload) {
  try {
    await ensureUserConsentAccepted();

    const { data, error } = await supabase.rpc('submit_survey_bundle', {
      payload,
    });

    if (error) {
      console.warn('Supabase submit_survey_bundle RPC error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    console.warn('Network error pushing survey bundle to Supabase:', err);
    return { success: false, error: err?.message || 'Network error' };
  }
}

/**
 * Right of access: every server row keyed to the signed-in user, as JSON.
 */
export async function exportMyData(): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('export_my_data');
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

/**
 * Right to erasure. The delete-account Edge Function keeps de-identified
 * observations for science, removes precise locations, tracks, notes and
 * photos, then deletes the auth user.
 */
export async function deleteMyAccount(): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('delete-account', {
      body: { confirm: 'DELETE' },
    });
    if (error || !data?.success) {
      return { success: false, error: error?.message || data?.error || 'Deletion failed' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

/**
 * Pulls active official fixed routes from PostgreSQL
 */
export async function pullActiveRoutes() {
  try {
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.warn('Error fetching routes from Supabase:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('Network error fetching routes:', err);
    return [];
  }
}

/**
 * Pulls persistent cat colonies from PostgreSQL
 */
export async function pullColonies() {
  try {
    const { data, error } = await supabase.from('colonies').select('*');
    if (error) {
      console.warn('Error fetching colonies from Supabase:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('Network error fetching colonies:', err);
    return [];
  }
}

/**
 * Pulls known individuals for capture-recapture from PostgreSQL
 */
export async function pullKnownIndividuals() {
  try {
    const { data, error } = await supabase.from('individuals').select('*');
    if (error) {
      console.warn('Error fetching individuals from Supabase:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('Network error fetching individuals:', err);
    return [];
  }
}
