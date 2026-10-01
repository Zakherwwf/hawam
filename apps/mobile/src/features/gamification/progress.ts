/**
 * Progress v3: the pure rules behind the Progress tab.
 *
 * Everything here is computed from server data (user_stats and the user's own
 * sessions), never from a device counter, so reinstalling the app or signing in
 * on another phone shows the same progress. CLAUDE.md section 2: effort earns
 * progress (distance, time, complete checklists, photos, new ground); animal
 * counts never drive a quest, a badge threshold or a ranking.
 */

import { LEVEL_START_XP, computeLevel, levelBounds } from './gamificationStore.ts';

/** The subset of public.user_stats the app reads. */
export interface ServerStats {
  xp: number;
  distance_km: number;
  minutes_surveyed: number;
  observation_count: number;
  cell_count: number;
  photo_count: number;
  session_count: number;
  completed_session_count: number;
  /** Present once 20260930000100 is deployed */
  complete_checklist_count?: number | null;
  zero_checklist_count?: number | null;
  photographed_observation_count?: number | null;
}

/** One of the user's own sessions, as read from public.sessions. */
export interface SessionSummary {
  start_time: string;
  end_time: string | null;
  distance_km: number | null;
  duration_min: number | null;
  complete_session: boolean;
  protocol: string;
}

export const EMPTY_STATS: ServerStats = {
  xp: 0,
  distance_km: 0,
  minutes_surveyed: 0,
  observation_count: 0,
  cell_count: 0,
  photo_count: 0,
  session_count: 0,
  completed_session_count: 0,
};

export function isCompleteChecklist(s: SessionSummary): boolean {
  return s.protocol !== 'incidental' && s.complete_session && s.end_time != null;
}

export function completeChecklists(stats: ServerStats): number {
  return stats.complete_checklist_count ?? stats.completed_session_count;
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

export const RANK_KEYS = [
  'ui_progress_v3.rank_1',
  'ui_progress_v3.rank_2',
  'ui_progress_v3.rank_3',
  'ui_progress_v3.rank_4',
  'ui_progress_v3.rank_5',
  'ui_progress_v3.rank_6',
  'ui_progress_v3.rank_7',
] as const;

export interface LevelProgress {
  level: number;
  maxLevel: number;
  rankKey: (typeof RANK_KEYS)[number];
  /** 0..1 through the current level; 1 at the top level */
  fraction: number;
  /** XP still needed for the next level; null at the top */
  toNext: number | null;
  nextAt: number | null;
}

export function levelProgress(xp: number): LevelProgress {
  const safe = Math.max(0, Math.floor(xp || 0));
  const { level } = computeLevel(safe);
  const { start, end } = levelBounds(level);
  return {
    level,
    maxLevel: LEVEL_START_XP.length,
    rankKey: RANK_KEYS[level - 1],
    fraction: end == null ? 1 : Math.min(1, (safe - start) / (end - start)),
    toNext: end == null ? null : end - safe,
    nextAt: end,
  };
}

// ---------------------------------------------------------------------------
// Weeks (Monday start, device local time: a week is what the volunteer lives)
// ---------------------------------------------------------------------------

/** Local midnight of the Monday starting the week that contains `d`. */
export function weekStart(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (m.getDay() + 6) % 7; // Monday = 0
  m.setDate(m.getDate() - dow);
  return m;
}

function weekIndex(d: Date): number {
  // Whole weeks since a fixed Monday; noon avoids DST hour shifts
  const ws = weekStart(d);
  const noon = Date.UTC(ws.getFullYear(), ws.getMonth(), ws.getDate(), 12);
  return Math.round((noon - Date.UTC(2024, 0, 1, 12)) / (7 * 86400000));
}

export interface WeeklyStreak {
  /** Consecutive weeks with at least one survey, ending this week or last */
  weeks: number;
  /** Whether this week already has a survey */
  thisWeekDone: boolean;
  best: number;
}

/**
 * A week counts when it holds at least one session of any kind. The streak
 * stays alive through the current week: it only breaks when a whole week
 * passes with nothing, which is kinder than daily streaks for volunteers.
 */
export function weeklyStreak(
  sessions: Pick<SessionSummary, 'start_time'>[],
  now = new Date()
): WeeklyStreak {
  const weeks = new Set(sessions.map((s) => weekIndex(new Date(s.start_time))));
  const current = weekIndex(now);
  const thisWeekDone = weeks.has(current);
  let run = 0;
  for (let w = thisWeekDone ? current : current - 1; weeks.has(w); w--) run++;

  let best = 0;
  let len = 0;
  let prev: number | null = null;
  for (const w of [...weeks].sort((a, b) => a - b)) {
    len = prev != null && w === prev + 1 ? len + 1 : 1;
    best = Math.max(best, len);
    prev = w;
  }
  return { weeks: run, thisWeekDone, best };
}

// ---------------------------------------------------------------------------
// Weekly quests: three effort goals, reset every Monday
// ---------------------------------------------------------------------------

export interface Quest {
  id: 'walk' | 'checklists' | 'minutes';
  titleKey: string;
  icon: 'walk' | 'checkCircle' | 'timer';
  progress: number;
  target: number;
  unit: 'km' | 'count' | 'min';
  done: boolean;
}

export function weeklyQuests(sessions: SessionSummary[], now = new Date()): Quest[] {
  const from = weekStart(now).getTime();
  const week = sessions.filter((s) => new Date(s.start_time).getTime() >= from);
  const km = week.reduce((a, s) => a + (s.distance_km ?? 0), 0);
  const minutes = week.reduce((a, s) => a + (s.duration_min ?? 0), 0);
  const checklists = week.filter(isCompleteChecklist).length;
  const q = (
    id: Quest['id'],
    titleKey: string,
    icon: Quest['icon'],
    progress: number,
    target: number,
    unit: Quest['unit']
  ): Quest => ({ id, titleKey, icon, progress, target, unit, done: progress >= target });
  return [
    q('walk', 'ui_progress_v3.quest_walk', 'walk', Math.round(km * 10) / 10, 2, 'km'),
    q('checklists', 'ui_progress_v3.quest_checklists', 'checkCircle', checklists, 2, 'count'),
    q('minutes', 'ui_progress_v3.quest_minutes', 'timer', Math.round(minutes), 45, 'min'),
  ];
}

/** Days left until the Monday reset, counting today. */
export function daysUntilReset(now = new Date()): number {
  const next = weekStart(now);
  next.setDate(next.getDate() + 7);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

// ---------------------------------------------------------------------------
// Badges: tiered, always showing the way to the next tier
// ---------------------------------------------------------------------------

export type BadgeTier = 0 | 1 | 2 | 3; // 0 = not yet earned

export interface BadgeProgress {
  id: string;
  titleKey: string;
  descKey: string;
  icon: 'walk' | 'checkCircle' | 'pin' | 'camera' | 'timer' | 'eye';
  value: number;
  tier: BadgeTier;
  /** The threshold for the next tier; null when gold */
  next: number | null;
  /** 0..1 towards `next` from the previous threshold */
  fraction: number;
}

interface BadgeDef {
  id: string;
  icon: BadgeProgress['icon'];
  tiers: [number, number, number];
  value: (s: ServerStats) => number;
}

const BADGES: BadgeDef[] = [
  { id: 'distance', icon: 'walk', tiers: [5, 25, 100], value: (s) => s.distance_km },
  { id: 'checklists', icon: 'checkCircle', tiers: [1, 10, 50], value: completeChecklists },
  { id: 'zero', icon: 'eye', tiers: [1, 5, 20], value: (s) => s.zero_checklist_count ?? 0 },
  { id: 'cells', icon: 'pin', tiers: [3, 15, 50], value: (s) => s.cell_count },
  {
    id: 'photos',
    icon: 'camera',
    tiers: [5, 25, 100],
    value: (s) => s.photographed_observation_count ?? s.photo_count,
  },
  { id: 'hours', icon: 'timer', tiers: [2, 10, 40], value: (s) => s.minutes_surveyed / 60 },
];

export function badges(stats: ServerStats): BadgeProgress[] {
  return BADGES.map((b) => {
    const value = Math.max(0, b.value(stats) || 0);
    const tier = b.tiers.filter((t) => value >= t).length as BadgeTier;
    const next: number | null = tier < 3 ? b.tiers[tier as 0 | 1 | 2] : null;
    const prev = tier === 0 ? 0 : b.tiers[tier - 1];
    return {
      id: b.id,
      titleKey: `ui_progress_v3.badge_${b.id}`,
      descKey: `ui_progress_v3.badge_${b.id}_desc`,
      icon: b.icon,
      value,
      tier,
      next,
      fraction: next == null ? 1 : Math.min(1, (value - prev) / (next - prev)),
    };
  });
}

// ---------------------------------------------------------------------------
// Leaderboard (effort only)
// ---------------------------------------------------------------------------

export interface LeaderRow {
  user_id: string;
  display_name: string;
  distance_km: number;
  complete_checklist_count: number;
}

export type BoardMetric = 'km' | 'checklists';

export interface RankedRow extends LeaderRow {
  rank: number;
  value: number;
  isMe: boolean;
}

/** Standard competition ranking (1, 2, 2, 4) on one effort metric. */
export function rankBoard(
  rows: LeaderRow[],
  metric: BoardMetric,
  meId: string | null
): RankedRow[] {
  const val = (r: LeaderRow) => (metric === 'km' ? r.distance_km : r.complete_checklist_count);
  const sorted = rows
    .filter((r) => val(r) > 0)
    .sort((a, b) => val(b) - val(a) || a.display_name.localeCompare(b.display_name));
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || val(r) !== val(sorted[i - 1])) rank = i + 1;
    return { ...r, rank, value: val(r), isMe: r.user_id === meId };
  });
}

// ---------------------------------------------------------------------------
// XP preview shown after saving (the server is the judge; this only explains)
// ---------------------------------------------------------------------------

export const XP_WEIGHTS = {
  observation: 10,
  extraAnimal: 2,
  completedSession: 25,
  kilometre: 5,
  photo: 15,
  newCell: 30,
} as const;

/** Expected XP for a quick sighting, before the server confirms it. */
export function quickSightingXp({
  animals,
  hasPhoto,
}: {
  animals: number;
  hasPhoto: boolean;
}): number {
  return (
    XP_WEIGHTS.observation +
    Math.min(Math.max(animals - 1, 0) * XP_WEIGHTS.extraAnimal, 20) +
    (hasPhoto ? XP_WEIGHTS.photo : 0)
  );
}

/** For the streak strip: whether each of the last `n` weeks (oldest first) had a session. */
export function recentWeeks(
  sessions: Pick<SessionSummary, 'start_time'>[],
  n = 8,
  now = new Date()
): boolean[] {
  const weeks = new Set(sessions.map((s) => weekIndex(new Date(s.start_time))));
  const current = weekIndex(now);
  return Array.from({ length: n }, (_, i) => weeks.has(current - (n - 1 - i)));
}

/**
 * This week, Monday to Sunday: kilometres, minutes and number of surveys per
 * day, and today's index. A day counts as surveyed with any session, even a
 * point count with no distance.
 */
export function weekDays(
  sessions: SessionSummary[],
  now = new Date()
): { km: number[]; minutes: number[]; surveys: number[]; today: number } {
  const start = weekStart(now);
  const km = new Array(7).fill(0);
  const minutes = new Array(7).fill(0);
  const surveys = new Array(7).fill(0);
  for (const s of sessions) {
    const d = new Date(s.start_time);
    const day = Math.floor(
      (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start.getTime()) /
        86400000 +
        0.5
    );
    if (day < 0 || day > 6) continue;
    km[day] += s.distance_km ?? 0;
    minutes[day] += s.duration_min ?? 0;
    surveys[day] += 1;
  }
  return {
    km: km.map((v) => Math.round(v * 1000) / 1000),
    minutes,
    surveys,
    today: (now.getDay() + 6) % 7,
  };
}
