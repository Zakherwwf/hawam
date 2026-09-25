/**
 * Supabase Client for Researcher Dashboard
 */

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL || 'https://opglgsidxoedlmgegojz.supabase.co';
export const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZ2xnc2lkeG9lZGxtZ2Vnb2p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxOTI0NzYsImV4cCI6MjEwNTc2ODQ3Nn0.XURVPJme6rqr3HPiQUnOXgcjfYMwuaMMNtZNy2hNh0w';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Fetch all sessions from PostgreSQL
 */
export async function getLiveSessions() {
  const { data, error } = await supabase
    .from('sessions')
    .select('*, session_tracks(track)')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Error fetching live sessions:', error);
    return [];
  }
  return data || [];
}

/**
 * Fetch all observations from PostgreSQL
 */
export async function getLiveObservations() {
  const { data, error } = await supabase
    .from('observations')
    .select('*')
    .order('observed_at', { ascending: false });

  if (error) {
    console.warn('Error fetching live observations:', error);
    return [];
  }
  return data || [];
}

/**
 * Fetch all routes from PostgreSQL
 */
export async function getLiveRoutes() {
  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Error fetching live routes:', error);
    return [];
  }
  return data || [];
}

/**
 * Create a new route in PostgreSQL
 */
export async function createRoute(route: {
  name: string;
  length_km: number;
  governorate?: string;
  delegation?: string;
  habitat_notes?: string;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}) {
  const { data, error } = await supabase
    .from('routes')
    .insert([
      {
        name: route.name,
        length_km: route.length_km,
        governorate: route.governorate,
        delegation: route.delegation,
        habitat_notes: route.habitat_notes,
        geometry: route.geometry,
        is_active: true,
      },
    ])
    .select();

  if (error) {
    throw error;
  }
  return data?.[0];
}
