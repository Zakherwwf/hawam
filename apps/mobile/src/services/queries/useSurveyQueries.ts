/**
 * TanStack Query Server State Hooks for Hawem
 * Provides cached, typed queries for routes, user profile, and leaderboard.
 */

import { QueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase.ts';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes cache
      refetchOnWindowFocus: false,
    },
  },
});

export const QUERY_KEYS = {
  routes: ['routes'] as const,
  profile: (userId?: string) => ['profile', userId] as const,
  leaderboard: (governorate?: string) => ['leaderboard', governorate] as const,
};

export function useActiveRoutesQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.routes,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        throw new Error(error.message);
      }
      return data || [];
    },
  });
}

export function useUserProfileQuery(userId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.profile(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(error.message);
      }
      return data || null;
    },
  });
}

export function useLeaderboardQuery(governorate?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.leaderboard(governorate),
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, full_name, call_sign, xp, km_walked, sessions_completed, governorate, organization')
        .order('xp', { ascending: false })
        .limit(50);

      if (governorate && governorate !== 'all') {
        query = query.eq('governorate', governorate);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }
      return data || [];
    },
  });
}
