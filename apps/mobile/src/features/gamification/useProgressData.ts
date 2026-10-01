/**
 * Server data behind the Progress tab: the user's own totals, their sessions
 * (for weekly streak and quests) and the effort leaderboard. All three refetch
 * whenever a sync lands, so progress moves as soon as the server has the data.
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { queryClient } from '../../services/queries/useSurveyQueries';
import { useSyncStore } from '../sync/syncStore';
import { PREVIEW_MODE } from '../../app-state/previewData';
import { EMPTY_STATS, type LeaderRow, type ServerStats, type SessionSummary } from './progress';

const KEY = ['progress'] as const;

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

// Sample data for the design preview (web, EXPO_PUBLIC_PREVIEW_MODE=1)
const daysAgo = (n: number, h = 8) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};
const PREVIEW_STATS: ServerStats = {
  xp: 540,
  distance_km: 14.2,
  minutes_surveyed: 410,
  observation_count: 18,
  cell_count: 6,
  photo_count: 9,
  session_count: 11,
  completed_session_count: 8,
  complete_checklist_count: 7,
  zero_checklist_count: 2,
  photographed_observation_count: 9,
};
const PREVIEW_SESSIONS: SessionSummary[] = [
  {
    start_time: daysAgo(0),
    end_time: daysAgo(0, 9),
    distance_km: 1.4,
    duration_min: 38,
    complete_session: true,
    protocol: 'transect',
  },
  {
    start_time: daysAgo(8),
    end_time: daysAgo(8, 9),
    distance_km: 2.1,
    duration_min: 44,
    complete_session: true,
    protocol: 'transect',
  },
  {
    start_time: daysAgo(15),
    end_time: daysAgo(15, 9),
    distance_km: 1.8,
    duration_min: 40,
    complete_session: true,
    protocol: 'transect',
  },
];
const PREVIEW_BOARD: LeaderRow[] = [
  { user_id: 'p1', display_name: 'Amel', distance_km: 31.5, complete_checklist_count: 16 },
  { user_id: 'p2', display_name: 'Youssef', distance_km: 22.0, complete_checklist_count: 11 },
  { user_id: 'me', display_name: 'You', distance_km: 14.2, complete_checklist_count: 7 },
  { user_id: 'p3', display_name: 'Sarra', distance_km: 9.8, complete_checklist_count: 9 },
  { user_id: 'p4', display_name: 'Karim', distance_km: 3.1, complete_checklist_count: 2 },
];

export function useMyStats() {
  return useQuery({
    queryKey: [...KEY, 'stats'],
    queryFn: async (): Promise<ServerStats> => {
      if (PREVIEW_MODE) return PREVIEW_STATS;
      const id = await myId();
      if (!id) return EMPTY_STATS;
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { ...EMPTY_STATS, ...(data as Partial<ServerStats>) } : EMPTY_STATS;
    },
  });
}

export function useMySessions() {
  return useQuery({
    queryKey: [...KEY, 'sessions'],
    queryFn: async (): Promise<SessionSummary[]> => {
      if (PREVIEW_MODE) return PREVIEW_SESSIONS;
      const id = await myId();
      if (!id) return [];
      // A year is plenty for the streak and this week's quests
      const since = new Date(Date.now() - 366 * 86400000).toISOString();
      const { data, error } = await supabase
        .from('sessions')
        .select('start_time,end_time,distance_km,duration_min,complete_session,protocol')
        .eq('observer_id', id)
        .is('deleted_at', null)
        .gte('start_time', since)
        .order('start_time', { ascending: false })
        .limit(1000);
      if (error) throw new Error(error.message);
      return (data ?? []) as SessionSummary[];
    },
  });
}

export function useEffortBoard() {
  return useQuery({
    queryKey: [...KEY, 'board'],
    queryFn: async (): Promise<{ rows: LeaderRow[]; meId: string | null }> => {
      if (PREVIEW_MODE) return { rows: PREVIEW_BOARD, meId: 'me' };
      const meId = await myId();
      const effort = await supabase
        .from('effort_leaderboard')
        .select('user_id,display_name,distance_km,complete_checklist_count')
        .limit(500);
      if (!effort.error) return { rows: (effort.data ?? []) as LeaderRow[], meId };
      // Before 20260930000100 is deployed: the older XP board, re-ranked by km
      // (it has no complete-checklist column, so that board shows sessions)
      const old = await supabase
        .from('leaderboard')
        .select('user_id,display_name,distance_km,session_count')
        .limit(500);
      if (old.error) throw new Error(old.error.message);
      return {
        rows: (old.data ?? []).map((r: any) => ({
          user_id: r.user_id,
          display_name: r.display_name,
          distance_km: r.distance_km ?? 0,
          complete_checklist_count: r.session_count ?? 0,
        })),
        meId,
      };
    },
  });
}

/** Refetch progress after every successful sync. */
export function useRefreshProgressOnSync() {
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  useEffect(() => {
    if (lastSyncedAt) queryClient.invalidateQueries({ queryKey: KEY });
  }, [lastSyncedAt]);
}
