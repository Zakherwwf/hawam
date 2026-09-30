import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_STATS,
  badges,
  daysUntilReset,
  levelProgress,
  quickSightingXp,
  rankBoard,
  weekStart,
  weeklyQuests,
  weeklyStreak,
  type SessionSummary,
} from '../features/gamification/progress.ts';

const session = (start: string, extra: Partial<SessionSummary> = {}): SessionSummary => ({
  start_time: start,
  end_time: start,
  distance_km: 0,
  duration_min: 0,
  complete_session: true,
  protocol: 'transect',
  ...extra,
});

test('levelProgress: fraction and XP to next level', () => {
  const p = levelProgress(500);
  assert.equal(p.level, 2);
  assert.equal(p.toNext, 200);
  assert.equal(p.fraction, 0.5);
  assert.equal(p.rankKey, 'ui_progress_v3.rank_2');
  const top = levelProgress(99999);
  assert.equal(top.level, 7);
  assert.equal(top.toNext, null);
  assert.equal(top.fraction, 1);
  assert.equal(levelProgress(-5).level, 1);
});

test('weekStart: Monday local midnight', () => {
  const ws = weekStart(new Date(2026, 8, 30, 15)); // Wed 30 Sep 2026
  assert.equal(ws.getDay(), 1);
  assert.equal(ws.getDate(), 28);
  assert.equal(weekStart(new Date(2026, 9, 4, 23)).getDate(), 28); // Sunday
});

test('weeklyStreak: survives the current week until it ends, breaks on a gap', () => {
  const now = new Date(2026, 8, 30, 12);
  const lastWeek = new Date(2026, 8, 22, 9).toISOString();
  const twoAgo = new Date(2026, 8, 15, 9).toISOString();
  const fourAgo = new Date(2026, 8, 1, 9).toISOString();
  const s = weeklyStreak(
    [{ start_time: lastWeek }, { start_time: twoAgo }, { start_time: fourAgo }],
    now
  );
  assert.deepEqual(s, { weeks: 2, thisWeekDone: false, best: 2 });
  const withThis = weeklyStreak(
    [{ start_time: new Date(2026, 8, 29).toISOString() }, { start_time: lastWeek }],
    now
  );
  assert.equal(withThis.weeks, 2);
  assert.equal(withThis.thisWeekDone, true);
  assert.equal(weeklyStreak([], now).weeks, 0);
});

test('weeklyQuests: effort only, this week only, zero-animal checklists count', () => {
  const now = new Date(2026, 8, 30, 12);
  const q = weeklyQuests(
    [
      session(new Date(2026, 8, 29, 8).toISOString(), { distance_km: 1.26, duration_min: 30 }),
      session(new Date(2026, 8, 30, 8).toISOString(), { distance_km: 1, duration_min: 20 }),
      session(new Date(2026, 8, 30, 9).toISOString(), {
        protocol: 'incidental',
        complete_session: false,
      }),
      session(new Date(2026, 8, 20, 8).toISOString(), { distance_km: 10 }), // last week
    ],
    now
  );
  const byId = Object.fromEntries(q.map((x) => [x.id, x]));
  assert.equal(byId.walk.progress, 2.3);
  assert.equal(byId.walk.done, true);
  assert.equal(byId.checklists.progress, 2);
  assert.equal(byId.minutes.progress, 50);
  assert.equal(byId.minutes.done, true);
});

test('daysUntilReset counts today', () => {
  assert.equal(daysUntilReset(new Date(2026, 8, 28, 10)), 7); // Monday
  assert.equal(daysUntilReset(new Date(2026, 9, 4, 22)), 1); // Sunday
});

test('badges: tiers and progress to the next tier; no badge counts animals', () => {
  const b = badges({
    ...EMPTY_STATS,
    distance_km: 30,
    completed_session_count: 0,
    complete_checklist_count: 12,
  });
  const dist = b.find((x) => x.id === 'distance')!;
  assert.equal(dist.tier, 2);
  assert.equal(dist.next, 100);
  assert.ok(Math.abs(dist.fraction - 5 / 75) < 1e-9);
  const cl = b.find((x) => x.id === 'checklists')!;
  assert.equal(cl.tier, 2);
  assert.ok(!b.some((x) => /animal|cat|dog/.test(x.id)));
  const zero = badges(EMPTY_STATS);
  assert.ok(zero.every((x) => x.tier === 0 && x.fraction === 0));
});

test('rankBoard: competition ranking by effort, excluding zero', () => {
  const rows = [
    { user_id: 'a', display_name: 'A', distance_km: 5, complete_checklist_count: 1 },
    { user_id: 'b', display_name: 'B', distance_km: 9, complete_checklist_count: 1 },
    { user_id: 'c', display_name: 'C', distance_km: 5, complete_checklist_count: 4 },
    { user_id: 'd', display_name: 'D', distance_km: 0, complete_checklist_count: 2 },
  ];
  const km = rankBoard(rows, 'km', 'c');
  assert.deepEqual(
    km.map((r) => [r.user_id, r.rank]),
    [
      ['b', 1],
      ['a', 2],
      ['c', 2],
    ]
  );
  assert.equal(km.find((r) => r.isMe)!.user_id, 'c');
  const cl = rankBoard(rows, 'checklists', null);
  assert.deepEqual(
    cl.map((r) => r.user_id),
    ['c', 'd', 'a', 'b']
  );
});

test('quickSightingXp: photo pays, extra animals capped at 20', () => {
  assert.equal(quickSightingXp({ animals: 1, hasPhoto: false }), 10);
  assert.equal(quickSightingXp({ animals: 1, hasPhoto: true }), 25);
  assert.equal(quickSightingXp({ animals: 50, hasPhoto: false }), 30);
});

test('recentWeeks: oldest first, current week last', async () => {
  const { recentWeeks } = await import('../features/gamification/progress.ts');
  const now = new Date(2026, 8, 30, 12);
  const w = recentWeeks(
    [
      { start_time: new Date(2026, 8, 29).toISOString() },
      { start_time: new Date(2026, 8, 15).toISOString() },
    ],
    4,
    now
  );
  assert.deepEqual(w, [false, true, false, true]);
});
