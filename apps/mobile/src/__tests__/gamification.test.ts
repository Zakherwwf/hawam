import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLevel,
  useGamificationStore,
  INITIAL_BADGES,
  INITIAL_QUESTS,
} from '../features/gamification/gamificationStore.ts';

test('gamification: computeLevel maps XP monotonically across all 7 rank tiers', () => {
  // Level 1: < 300
  const l1_zero = computeLevel(0);
  assert.equal(l1_zero.level, 1);
  assert.equal(l1_zero.rankTitle, 'Newcomer Observer');

  const l1_edge = computeLevel(299);
  assert.equal(l1_edge.level, 1);

  // Level 2: 300..699
  const l2_start = computeLevel(300);
  assert.equal(l2_start.level, 2);
  assert.equal(l2_start.rankTitle, 'Street Observer');

  // Level 3: 700..1199
  const l3_start = computeLevel(700);
  assert.equal(l3_start.level, 3);
  assert.equal(l3_start.rankTitle, 'Neighbourhood Watcher');

  // Level 4: 1200..1999
  const l4_start = computeLevel(1200);
  assert.equal(l4_start.level, 4);
  assert.equal(l4_start.rankTitle, 'Field Surveyor');

  // Level 5: 2000..3499
  const l5_start = computeLevel(2000);
  assert.equal(l5_start.level, 5);
  assert.equal(l5_start.rankTitle, 'Senior Field Surveyor');

  // Level 6: 3500..5999
  const l6_start = computeLevel(3500);
  assert.equal(l6_start.level, 6);
  assert.equal(l6_start.rankTitle, 'Research Naturalist');

  // Level 7: >= 6000
  const l7_start = computeLevel(6000);
  assert.equal(l7_start.level, 7);
  assert.equal(l7_start.rankTitle, 'Field Scientist');

  const l7_high = computeLevel(25000);
  assert.equal(l7_high.level, 7);
});

test('gamification: store awards XP, updates level, and records recent award metadata', () => {
  const store = useGamificationStore.getState();
  const initialXp = store.xpTotal;

  store.awardXp(50, 'Completed Transect Walk');

  const updated = useGamificationStore.getState();
  assert.equal(updated.xpTotal, initialXp + 50);
  assert.deepEqual(updated.recentXpAward, {
    amount: 50,
    reason: 'Completed Transect Walk',
  });

  store.clearRecentXp();
  assert.equal(useGamificationStore.getState().recentXpAward, null);
});

test('gamification: streak freeze consumption logic', () => {
  // Set known state
  useGamificationStore.setState({ freezesAvailable: 1 });

  const freezeUsed1 = useGamificationStore.getState().useStreakFreeze();
  assert.equal(freezeUsed1, true);
  assert.equal(useGamificationStore.getState().freezesAvailable, 0);

  // Subsequent attempt when 0 freezes remaining returns false
  const freezeUsed2 = useGamificationStore.getState().useStreakFreeze();
  assert.equal(freezeUsed2, false);
  assert.equal(useGamificationStore.getState().freezesAvailable, 0);
});

test('gamification: badge unlocks record timestamp without duplicating', () => {
  const targetBadgeId = 'route_guardian';
  useGamificationStore.getState().unlockBadge(targetBadgeId);

  const state = useGamificationStore.getState();
  const unlocked = state.badges.find((b) => b.id === targetBadgeId);
  assert.ok(unlocked);
  assert.ok(unlocked?.unlockedAt);

  const firstTimestamp = unlocked?.unlockedAt;

  // Attempting to unlock again does not overwrite original timestamp
  useGamificationStore.getState().unlockBadge(targetBadgeId);
  const secondState = useGamificationStore.getState();
  const stillUnlocked = secondState.badges.find((b) => b.id === targetBadgeId);
  assert.equal(stillUnlocked?.unlockedAt, firstTimestamp);
});

test('gamification: quest progress clamping and completion', () => {
  const questId = 'quest_hex';
  const initial = useGamificationStore.getState().quests.find((q) => q.id === questId)!;

  // Advance by 1
  useGamificationStore.getState().updateQuestProgress(questId, 1);
  const after1 = useGamificationStore.getState().quests.find((q) => q.id === questId)!;
  assert.equal(after1.progress, Math.min(after1.target, initial.progress + 1));

  // Advance well beyond target -> progress clamps to target, completed is true
  useGamificationStore.getState().updateQuestProgress(questId, 10);
  const completedQuest = useGamificationStore.getState().quests.find((q) => q.id === questId)!;
  assert.equal(completedQuest.progress, completedQuest.target);
  assert.equal(completedQuest.completed, true);
});

test('gamification: completeAcademyCertification triggers XP and badge unlock only once', () => {
  useGamificationStore.setState({ isAcademyCertified: false });
  const xpBefore = useGamificationStore.getState().xpTotal;

  useGamificationStore.getState().completeAcademyCertification();

  const stateAfter = useGamificationStore.getState();
  assert.equal(stateAfter.isAcademyCertified, true);
  assert.equal(stateAfter.xpTotal, xpBefore + 25);
  const academyBadge = stateAfter.badges.find((b) => b.id === 'academy_graduate');
  assert.ok(academyBadge?.unlockedAt);

  // Calling again should be idempotent
  useGamificationStore.getState().completeAcademyCertification();
  assert.equal(useGamificationStore.getState().xpTotal, xpBefore + 25);
});
