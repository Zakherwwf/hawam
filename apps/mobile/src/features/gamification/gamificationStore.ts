/**
 * Gamification Zustand Store
 * Hawem (حايم) Citizen-Science Platform
 *
 * Implements:
 * - XP calculation & levels 1–30
 * - Effort-weighted scientific scoring
 * - Badge definitions & unlocks
 * - Weekly streak tracking & freezes
 * - Rotating weekly quests
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Badge {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold';
  icon: string;
  unlockedAt?: string;
}

export interface Quest {
  id: string;
  title: string;
  titleAr: string;
  description: string;
  xpReward: number;
  progress: number;
  target: number;
  completed: boolean;
  claimed?: boolean;
}

export const INITIAL_BADGES: Badge[] = [
  {
    id: 'first_walk',
    name: 'First Steps',
    nameAr: 'الخطوة الأولى',
    description: 'Complete 1 structured transect survey',
    tier: 'bronze',
    icon: 'compass',
  },
  {
    id: 'distance_10km',
    name: '10 km Surveyor',
    nameAr: 'مسّاح 10 كم',
    description: 'Survey 10 km total walking distance',
    tier: 'bronze',
    icon: 'location',
  },
  {
    id: 'zero_hero',
    name: 'Zero Hero',
    nameAr: 'بطل الصفر',
    description: 'Complete 5 complete zero-count surveys (essential non-detections)',
    tier: 'silver',
    icon: 'shield',
  },
  {
    id: 'photo_pro',
    name: 'Photographic Master',
    nameAr: 'محترف التوثيق',
    description: 'Record 25 full 3-angle photo sets (Left, Right, Face)',
    tier: 'silver',
    icon: 'camera',
  },
  {
    id: 'recapture_master',
    name: 'Mark-Resight Specialist',
    nameAr: 'خبير إعادة الرصد',
    description: 'Confirm 10 resightings of previously registered animals',
    tier: 'gold',
    icon: 'eye',
  },
  {
    id: 'explorer_50',
    name: 'Terra Incognita',
    nameAr: 'مستكشف الخلايا',
    description: 'Survey in 50 distinct H3 resolution-9 hex cells',
    tier: 'gold',
    icon: 'map',
  },
  {
    id: 'academy_graduate',
    name: 'Academy Graduate',
    nameAr: 'خريج الأكاديمية الميدانية',
    description: 'Complete all 5 Field Academy modules with certified competency',
    tier: 'bronze',
    icon: 'paw',
  },
  {
    id: 'route_guardian',
    name: 'Route Guardian',
    nameAr: 'حارس المسارات',
    description: 'Repeat an official fixed transect 5 times for repeat-visit modeling',
    tier: 'silver',
    icon: 'compass',
  },
  {
    id: 'colony_keeper',
    name: 'Colony Monitor',
    nameAr: 'راصد المستعمرات',
    description: 'Monitor or register a persistent cat colony or feeding station',
    tier: 'bronze',
    icon: 'shield',
  },
];

export const INITIAL_QUESTS: Quest[] = [
  {
    id: 'quest_hex',
    title: 'Spatial Pioneer',
    titleAr: 'استكشاف خلايا جديدة',
    description: 'Survey in 2 H3 hex cells you have never visited',
    xpReward: 30,
    progress: 0,
    target: 2,
    completed: false,
  },
  {
    id: 'quest_complete_survey',
    title: 'Complete Checklist',
    titleAr: 'قائمة كاملة',
    description: 'Complete a full transect survey following the eBird standard',
    xpReward: 20,
    progress: 0,
    target: 1,
    completed: false,
  },
  {
    id: 'quest_photo_set',
    title: 'Identification Angles',
    titleAr: 'زوايا التوثيق',
    description: 'Capture left flank, right flank, and face of a free-roaming cat or dog',
    xpReward: 25,
    progress: 0,
    target: 1,
    completed: false,
  },
];

interface GamificationState {
  xpTotal: number;
  level: number;
  rankTitle: string;
  rankTitleAr: string;
  currentStreakWeeks: number;
  longestStreakWeeks: number;
  freezesAvailable: number;
  badges: Badge[];
  quests: Quest[];
  isAcademyCertified: boolean;
  recentXpAward: { amount: number; reason: string } | null;

  // Actions
  loadGamification: (userId?: string) => Promise<void>;
  resetGamification: () => void;
  awardXp: (amount: number, reason: string) => void;
  clearRecentXp: () => void;
  unlockBadge: (badgeId: string) => void;
  updateQuestProgress: (questId: string, delta: number) => void;
  claimQuestReward: (questId: string) => boolean;
  consumeStreakFreeze: () => boolean;
  completeAcademyCertification: () => void;
}

export function computeLevel(xp: number): {
  level: number;
  rankTitle: string;
  rankTitleAr: string;
} {
  if (xp < 300) return { level: 1, rankTitle: 'Newcomer Observer', rankTitleAr: 'راصد جديد' };
  if (xp < 700) return { level: 2, rankTitle: 'Street Observer', rankTitleAr: 'راصد شوارع' };
  if (xp < 1200) return { level: 3, rankTitle: 'Neighbourhood Watcher', rankTitleAr: 'حارس الحي' };
  if (xp < 2000) return { level: 4, rankTitle: 'Field Surveyor', rankTitleAr: 'مسّاح ميداني' };
  if (xp < 3500)
    return { level: 5, rankTitle: 'Senior Field Surveyor', rankTitleAr: 'خبير مسح ميداني' };
  if (xp < 6000) return { level: 6, rankTitle: 'Research Naturalist', rankTitleAr: 'باحث طبيعي' };
  return { level: 7, rankTitle: 'Field Scientist', rankTitleAr: 'عالم ميداني' };
}

let activeGamificationUserId: string | null = null;

export const useGamificationStore = create<GamificationState>((set, get) => ({
  xpTotal: 0,
  level: 1,
  rankTitle: 'Newcomer Observer',
  rankTitleAr: 'راصد جديد',
  currentStreakWeeks: 0,
  longestStreakWeeks: 0,
  freezesAvailable: 1,
  badges: INITIAL_BADGES,
  quests: INITIAL_QUESTS,
  isAcademyCertified: false,
  recentXpAward: null,

  resetGamification: () => {
    activeGamificationUserId = null;
    set({
      xpTotal: 0,
      level: 1,
      rankTitle: 'Newcomer Observer',
      rankTitleAr: 'راصد جديد',
      currentStreakWeeks: 0,
      longestStreakWeeks: 0,
      freezesAvailable: 1,
      badges: INITIAL_BADGES.map((b) => ({ ...b, unlockedAt: undefined })),
      quests: INITIAL_QUESTS.map((q) => ({ ...q, progress: 0, completed: false })),
      isAcademyCertified: false,
      recentXpAward: null,
    });
  },

  loadGamification: async (userId?: string) => {
    if (userId) activeGamificationUserId = userId;
    const storageKey = activeGamificationUserId
      ? `hawem_gamification_${activeGamificationUserId}`
      : 'hawem_gamification_v2';
    try {
      if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          set(parsed);
          return;
        }
      }
    } catch (e) {}

    // Clean reset for new user
    get().resetGamification();
    if (userId) activeGamificationUserId = userId;
  },

  awardXp: (amount, reason) => {
    const { xpTotal, badges, quests } = get();
    const newXp = xpTotal + amount;
    const { level, rankTitle, rankTitleAr } = computeLevel(newXp);

    const updated = {
      xpTotal: newXp,
      level,
      rankTitle,
      rankTitleAr,
      recentXpAward: { amount, reason },
    };

    set(updated);
    const storageKey = activeGamificationUserId
      ? `hawem_gamification_${activeGamificationUserId}`
      : 'hawem_gamification_v2';
    if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
      AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          xpTotal: newXp,
          level,
          rankTitle,
          rankTitleAr,
          badges,
          quests,
        })
      ).catch(() => {});
    }
  },

  clearRecentXp: () => {
    set({ recentXpAward: null });
  },

  unlockBadge: (badgeId) => {
    const { badges } = get();
    const updated = badges.map((b) =>
      b.id === badgeId && !b.unlockedAt ? { ...b, unlockedAt: new Date().toISOString() } : b
    );
    set({ badges: updated });
  },

  updateQuestProgress: (questId, delta) => {
    const { quests } = get();
    const updated = quests.map((q) => {
      if (q.id === questId) {
        const newProgress = Math.min(q.target, q.progress + delta);
        return {
          ...q,
          progress: newProgress,
          completed: newProgress >= q.target,
        };
      }
      return q;
    });
    set({ quests: updated });
  },

  claimQuestReward: (questId) => {
    const { quests, awardXp } = get();
    const targetQuest = quests.find((q) => q.id === questId);
    if (!targetQuest || targetQuest.claimed || targetQuest.progress < targetQuest.target) {
      return false;
    }
    const updated = quests.map((q) =>
      q.id === questId ? { ...q, claimed: true, completed: true } : q
    );
    set({ quests: updated });
    awardXp(targetQuest.xpReward, `Completed quest: ${targetQuest.title}`);
    return true;
  },

  consumeStreakFreeze: () => {
    const { freezesAvailable } = get();
    if (freezesAvailable > 0) {
      set({ freezesAvailable: freezesAvailable - 1 });
      return true;
    }
    return false;
  },

  completeAcademyCertification: () => {
    const { isAcademyCertified, awardXp, unlockBadge } = get();
    if (!isAcademyCertified) {
      set({ isAcademyCertified: true });
      awardXp(25, 'Field Academy Certification Passed');
      unlockBadge('academy_graduate');
    }
  },
}));
