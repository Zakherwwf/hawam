import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import {
  hapticModalClose,
  hapticButtonPress,
  hapticTabSwitch,
  hapticSuccess,
} from '../utils/haptics';
import { DesignTokens } from '../design-system/tokens';
import { IOSIcon, IOSNavigationBar, IOSSegmentedControl } from '../components/ios';
import { useGamificationStore, Badge } from '../features/gamification/gamificationStore';
import { UserAccount } from './AccountScreen';
import { supabase } from '../services/supabase';

interface SurveyorProfile {
  rank: number;
  name: string;
  metric: string;
  isUser: boolean;
  governorate: string;
  sector: string;
  badgesEarned: number;
  surveysCount: number;
  kmCount: number;
  role: string;
  avatar: any;
}

const BADGE_ASSET_MAP: Record<string, any> = {
  first_walk: require('../../assets/cat_pose_1_primary.png'),
  distance_10km: require('../../assets/dog_pose_2_amber.png'),
  zero_hero: require('../../assets/cat_pose_4_primary.png'),
  photo_pro: require('../../assets/icon_cat_primary.png'),
  recapture_master: require('../../assets/dog_pose_1_amber.png'),
  explorer_50: require('../../assets/cat_pose_3_primary.png'),
  academy_graduate: require('../../assets/icon_dog_amber.png'),
  route_guardian: require('../../assets/dog_pose_5_amber.png'),
  colony_keeper: require('../../assets/cat_pose_5_primary.png'),
};
const GOVERNORATES = [
  { key: 'all', label: 'All Tunisia' },
  { key: 'Tunis', label: 'Tunis' },
  { key: 'Sfax', label: 'Sfax' },
  { key: 'Sousse', label: 'Sousse' },
  { key: 'Nabeul', label: 'Nabeul' },
];

interface ProgressScreenProps {
  userAccount?: UserAccount | null;
  stats?: {
    sessionsCompleted: number;
    kmWalked: number;
    animalsRecorded: number;
  };
}

export const ProgressScreen: React.FC<ProgressScreenProps> = ({ userAccount, stats }) => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const userGov = userAccount?.governorate || 'Tunis';
  const governorateList = React.useMemo(() => {
    const list = [...GOVERNORATES];
    if (userGov && !list.some((g) => g.key.toLowerCase() === userGov.toLowerCase())) {
      list.push({ key: userGov, label: userGov });
    }
    return list;
  }, [userGov]);

  const {
    xpTotal,
    level,
    rankTitle,
    rankTitleAr,
    currentStreakWeeks,
    freezesAvailable,
    badges,
    quests,
    useStreakFreeze,
    claimQuestReward,
  } = useGamificationStore();

  const [leaderboardTab, setLeaderboardTab] = useState<'km' | 'surveys'>('km');
  const [selectedGov, setSelectedGov] = useState<string>('all');
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [selectedSurveyor, setSelectedSurveyor] = useState<SurveyorProfile | null>(null);
  const [cloudParticipants, setCloudParticipants] = useState<SurveyorProfile[]>([]);

  React.useEffect(() => {
    let isMounted = true;
    const fetchCloudProfiles = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, name, role, governorate')
          .limit(20);
        if (!error && data && isMounted) {
          const currentName = userAccount?.name?.toLowerCase().trim();
          const others = data
            .filter((p: any) => {
              const pName = (p.full_name || p.name || '').toLowerCase().trim();
              return pName && pName !== currentName;
            })
            .map((p: any, idx: number) => ({
              rank: idx + 2,
              name: p.full_name || p.name || 'Field Surveyor',
              metric: leaderboardTab === 'km' ? '0.0 km' : '0 surveys',
              isUser: false,
              governorate: p.governorate || 'Tunis',
              sector: `${p.governorate || 'Tunis'} Sector`,
              badgesEarned: 0,
              surveysCount: 0,
              kmCount: 0,
              role: p.role ? String(p.role).toUpperCase() : 'SURVEYOR',
              avatar: require('../../assets/icon_cat_primary.png'),
            }));
          setCloudParticipants(others);
        }
      } catch {}
    };
    fetchCloudProfiles();
    return () => {
      isMounted = false;
    };
  }, [userAccount?.name, leaderboardTab]);

  const handleCloseBadge = () => {
    hapticModalClose();
    setSelectedBadge(null);
  };

  const handleCloseSurveyor = () => {
    hapticModalClose();
    setSelectedSurveyor(null);
  };

  const handleUseFreeze = () => {
    if (freezesAvailable <= 0) {
      Alert.alert(
        'No Freezes Available',
        'You receive 1 complimentary streak freeze every 30 days. You have used all available freezes for this cycle.'
      );
      return;
    }

    Alert.alert(
      'Activate Monthly Streak Freeze?',
      `You currently hold a ${currentStreakWeeks}-week active survey streak. Activating a freeze protects your streak from resetting if you miss a field survey this week.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate Freeze',
          onPress: () => {
            hapticButtonPress();
            const success = useStreakFreeze();
            if (success) {
              Alert.alert(
                'Streak Shielded',
                'Your survey streak is now protected for this week. Keep up the high-rigor field work!'
              );
            }
          },
        },
      ]
    );
  };

  // Next level calculation
  const nextLevelXp = level * 750;
  const prevLevelXp = (level - 1) * 750;
  const levelProgress = Math.min(
    1.0,
    Math.max(0.05, (xpTotal - prevLevelXp) / Math.max(1, nextLevelXp - prevLevelXp))
  );

  return (
    <View style={styles.outerContainer}>
      <LinearGradient
        colors={['#F2F8F4', '#F8FBF8', '#F7F6F2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <IOSNavigationBar title={isArabic ? 'التقدم والمساهمات' : 'Scientific Progress'} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Level & Scientific Rank Hero Card */}
        <View style={styles.levelCard}>
          <View style={styles.levelTopRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Image
                source={require('../../assets/icon_cat_primary.png')}
                style={{ width: 36, height: 36, resizeMode: 'contain' }}
              />
              <View>
                <Text style={styles.levelNumber}>LEVEL {level}</Text>
                <Text style={styles.rankTitle}>{isArabic ? rankTitleAr : rankTitle}</Text>
              </View>
            </View>
            <View style={styles.xpBadge}>
              <IOSIcon name="chart" size={14} color={DesignTokens.colors.tint} />
              <Text style={styles.xpBadgeText}>{xpTotal} XP</Text>
            </View>
          </View>

          {/* Progress Bar to next level */}
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${Math.round(levelProgress * 100)}%` }]} />
          </View>

          <View style={styles.progressSubRow}>
            <Text style={styles.progressSubText}>
              {xpTotal} / {nextLevelXp} XP to Level {level + 1}
            </Text>
            <Text style={styles.progressSubText}>{Math.round(levelProgress * 100)}%</Text>
          </View>
        </View>

        {/* Weekly Streak & Freezes Row */}
        {(() => {
          const isStreakShielded = freezesAvailable === 0;
          return (
            <View style={styles.streakRow}>
              <View style={[styles.streakBox, isStreakShielded && styles.streakBoxShielded]}>
                {isStreakShielded && (
                  <View style={styles.streakShieldGlowBadge}>
                    <IOSIcon name="shield" size={10} color="#0F172A" />
                    <Text style={styles.streakShieldGlowText}>SHIELDED</Text>
                  </View>
                )}
                <View
                  style={[
                    styles.streakIconCircle,
                    isStreakShielded && styles.streakIconCircleShielded,
                  ]}
                >
                  <IOSIcon
                    name={isStreakShielded ? 'shield' : 'clock'}
                    size={18}
                    color={isStreakShielded ? '#0F172A' : DesignTokens.colors.dog}
                  />
                </View>
                <View>
                  <Text style={styles.streakNumber}>{currentStreakWeeks} WEEKS</Text>
                  <Text style={styles.streakLabel}>
                    {isStreakShielded ? 'SHIELD PROTECTED' : 'SURVEY STREAK'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.streakBox}
                activeOpacity={0.7}
                onPress={handleUseFreeze}
              >
                <View
                  style={[
                    styles.streakIconCircle,
                    { backgroundColor: 'rgba(8, 145, 178, 0.12)' },
                  ]}
                >
                  <IOSIcon name="shield" size={18} color={DesignTokens.colors.tint} />
                </View>
                <View>
                  <Text style={styles.streakNumber}>{freezesAvailable} AVAILABLE</Text>
                  <Text style={styles.streakLabel}>MONTHLY FREEZE</Text>
                </View>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* Rotating Weekly Quests */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              {isArabic ? 'المهام العلمية لهذا الأسبوع' : 'Weekly Research Quests'}
            </Text>
            <Text style={styles.sectionBadge}>3 ACTIVE</Text>
          </View>

          {quests.map((quest) => {
            const isClaimable =
              (quest.completed || quest.progress >= quest.target) && !quest.claimed;
            const isClaimed = Boolean(quest.claimed);

            return (
              <View key={quest.id} style={styles.questCard}>
                <View style={styles.questTopRow}>
                  <View style={styles.questTitleRow}>
                    {quest.completed || isClaimed ? (
                      <View style={styles.questCheckCircle}>
                        <IOSIcon name="check" size={12} color="#FFFFFF" />
                      </View>
                    ) : null}
                    <Text
                      style={[
                        styles.questTitle,
                        (quest.completed || isClaimed) && styles.questTitleDone,
                      ]}
                    >
                      {isArabic ? quest.titleAr : quest.title}
                    </Text>
                  </View>
                  <View style={styles.questRewardPill}>
                    <Text style={styles.questRewardText}>+{quest.xpReward} XP</Text>
                  </View>
                </View>

                <Text style={styles.questDesc}>{quest.description}</Text>

                {/* Quest Progress bar */}
                <View style={styles.questBarTrack}>
                  <View
                    style={[
                      styles.questBarFill,
                      {
                        width: `${Math.min(
                          100,
                          Math.round((quest.progress / quest.target) * 100)
                        )}%`,
                      },
                      (quest.completed || isClaimed) && {
                        backgroundColor: DesignTokens.colors.success,
                      },
                    ]}
                  />
                </View>

                <View style={styles.questBottomRow}>
                  <Text style={styles.questProgressText}>
                    {quest.progress} / {quest.target} completed
                  </Text>
                  {isClaimable ? (
                    <TouchableOpacity
                      style={styles.claimXpBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        hapticSuccess();
                        claimQuestReward(quest.id);
                        Alert.alert(
                          'XP Claimed!',
                          `You received +${quest.xpReward} XP for advancing public health research.`
                        );
                      }}
                    >
                      <IOSIcon name="star" size={13} color="#0F172A" />
                      <Text style={styles.claimXpBtnText} numberOfLines={1}>
                        +{quest.xpReward} XP CLAIM
                      </Text>
                    </TouchableOpacity>
                  ) : isClaimed ? (
                    <View style={styles.claimedPill}>
                      <IOSIcon name="check" size={11} color="#166534" />
                      <Text style={styles.claimedPillText}>CLAIMED</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {/* Scientific Badges Showcase */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              {isArabic ? 'الأوسمة والشهادات الميدانية' : 'Surveyor Badges'}
            </Text>
            <Text style={styles.sectionBadge}>
              {badges.filter((b) => b.unlockedAt).length} / {badges.length} UNLOCKED
            </Text>
          </View>

          <View style={styles.badgesGrid}>
            {badges.map((badge) => {
              const isUnlocked = Boolean(badge.unlockedAt);
              const tierColor =
                badge.tier === 'gold'
                  ? '#D97706'
                  : badge.tier === 'silver'
                  ? '#64748B'
                  : '#B45309';

              return (
                <TouchableOpacity
                  key={badge.id}
                  style={[styles.badgeCard, !isUnlocked && styles.badgeCardLocked]}
                  activeOpacity={0.7}
                  onPress={() => {
                    hapticButtonPress();
                    setSelectedBadge(badge);
                  }}
                >
                  <View
                    style={[
                      styles.badgeIconCircle,
                      { backgroundColor: isUnlocked ? `${tierColor}18` : '#E2E8F0' },
                    ]}
                  >
                    {BADGE_ASSET_MAP[badge.id] ? (
                      <Image
                        source={BADGE_ASSET_MAP[badge.id]}
                        style={{
                          width: 26,
                          height: 26,
                          resizeMode: 'contain',
                          opacity: isUnlocked ? 1 : 0.35,
                        }}
                      />
                    ) : (
                      <IOSIcon
                        name={badge.icon as any}
                        size={22}
                        color={isUnlocked ? tierColor : DesignTokens.colors.tertiaryLabel}
                      />
                    )}
                  </View>
                  <Text
                    style={[styles.badgeName, !isUnlocked && styles.badgeTextLocked]}
                    numberOfLines={1}
                  >
                    {isArabic ? badge.nameAr : badge.name}
                  </Text>
                  <Text style={styles.badgeTier}>{badge.tier.toUpperCase()}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Effort-Based Leaderboard (Ranked by KM / Complete Surveys) */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              {isArabic ? 'لوحة الشرف للمسح الميداني' : 'Effort Leaderboard'}
            </Text>
            <Text style={styles.sectionSubtitle}>Ranked strictly by survey effort</Text>
          </View>

          <View style={{ marginBottom: 10 }}>
            <IOSSegmentedControl<'km' | 'surveys'>
              selectedValue={leaderboardTab}
              onValueChange={(val) => {
                hapticTabSwitch();
                setLeaderboardTab(val);
              }}
              values={[
                { label: 'Km Surveyed', value: 'km' },
                { label: 'Complete Surveys', value: 'surveys' },
              ]}
            />
          </View>

          {/* Governorate Filter Strip */}
          <View style={styles.govFilterWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.govFilterScroll}
            >
              {governorateList.map((gov) => {
                const isActive = selectedGov === gov.key;
                return (
                  <TouchableOpacity
                    key={gov.key}
                    style={[styles.govPill, isActive && styles.govPillActive]}
                    onPress={() => {
                      hapticTabSwitch();
                      setSelectedGov(gov.key);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.govPillText, isActive && styles.govPillTextActive]}>
                      {gov.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.govFadeLeft}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.95)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.govFadeRight}
              pointerEvents="none"
            />
          </View>

          {/* Authentic Scientific Leaderboard Table */}
          <View style={styles.leaderboardList}>
            {(() => {
              const actualKm = Number(stats?.kmWalked ? stats.kmWalked.toFixed(1) : '0');
              const actualSurveys = stats?.sessionsCompleted || 0;

              const userParticipant: SurveyorProfile = {
                rank: 1,
                name: userAccount?.name ? `${userAccount.name} (You)` : 'You (Surveyor)',
                metric:
                  leaderboardTab === 'km'
                    ? `${actualKm.toFixed(1)} km`
                    : `${actualSurveys} ${actualSurveys === 1 ? 'survey' : 'surveys'}`,
                isUser: true,
                governorate: userAccount?.governorate || 'Tunis',
                sector: userAccount?.governorate ? `${userAccount.governorate} Urban Transects` : 'Coastal Urban Transects',
                badgesEarned: badges.filter((b) => b.unlockedAt).length,
                surveysCount: actualSurveys,
                kmCount: actualKm,
                role: userAccount?.role ? `${userAccount.role.toUpperCase()} • ${rankTitle}` : rankTitle,
                avatar: userAccount?.avatarUri ? { uri: userAccount.avatarUri } : require('../../assets/icon_cat_primary.png'),
              };

              const allParticipants: SurveyorProfile[] = [userParticipant, ...cloudParticipants];

              const filtered = allParticipants
                .filter(
                  (entry) =>
                    selectedGov === 'all' ||
                    entry.governorate.toLowerCase() === selectedGov.toLowerCase()
                )
                .sort((a, b) => {
                  if (leaderboardTab === 'km') {
                    return b.kmCount - a.kmCount;
                  }
                  return b.surveysCount - a.surveysCount;
                })
                .map((entry, idx) => ({
                  ...entry,
                  displayRank: idx + 1,
                }));

              if (filtered.length === 0) {
                return (
                  <View style={styles.emptyGovLeaderboard}>
                    <IOSIcon name="location" size={24} color="#94A3B8" />
                    <Text style={styles.emptyGovText}>
                      No registered surveyors in this governorate yet
                    </Text>
                  </View>
                );
              }

              return filtered.map((entry) => (
                <TouchableOpacity
                  key={entry.name}
                  style={[
                    styles.leaderboardRow,
                    entry.isUser && styles.leaderboardRowUser,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    hapticButtonPress();
                    setSelectedSurveyor(entry);
                  }}
                >
                  <Text style={styles.leaderboardRank}>#{entry.displayRank}</Text>
                  <View
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Text
                      style={[
                        styles.leaderboardName,
                        entry.isUser && { fontWeight: '700' },
                      ]}
                    >
                      {entry.name}
                    </Text>
                    <Text style={styles.leaderboardGovTag}>• {entry.governorate}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.leaderboardMetric}>{entry.metric}</Text>
                    <IOSIcon name="chevronRight" size={14} color="#94A3B8" />
                  </View>
                </TouchableOpacity>
              ));
            })()}
          </View>
        </View>
      </ScrollView>

      {/* Badge Inspection Modal */}
      <Modal
        visible={Boolean(selectedBadge)}
        animationType="fade"
        transparent
        onRequestClose={handleCloseBadge}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selectedBadge ? (
              <>
                <View
                  style={[
                    styles.modalIconCircle,
                    {
                      backgroundColor: selectedBadge.unlockedAt
                        ? selectedBadge.tier === 'gold'
                          ? '#FEF3C7'
                          : selectedBadge.tier === 'silver'
                          ? '#F1F5F9'
                          : '#FFEDD5'
                        : '#F1F5F9',
                    },
                  ]}
                >
                  {BADGE_ASSET_MAP[selectedBadge.id] ? (
                    <Image
                      source={BADGE_ASSET_MAP[selectedBadge.id]}
                      style={{
                        width: 48,
                        height: 48,
                        resizeMode: 'contain',
                        opacity: selectedBadge.unlockedAt ? 1 : 0.35,
                      }}
                    />
                  ) : (
                    <IOSIcon
                      name={selectedBadge.icon as any}
                      size={38}
                      color={
                        selectedBadge.unlockedAt
                          ? selectedBadge.tier === 'gold'
                            ? '#D97706'
                            : selectedBadge.tier === 'silver'
                            ? '#475569'
                            : '#B45309'
                          : DesignTokens.colors.tertiaryLabel
                      }
                    />
                  )}
                </View>

                <View
                  style={[
                    styles.modalTierPill,
                    {
                      backgroundColor:
                        selectedBadge.tier === 'gold'
                          ? '#FEF3C7'
                          : selectedBadge.tier === 'silver'
                          ? '#F1F5F9'
                          : '#FFEDD5',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.modalTierText,
                      {
                        color:
                          selectedBadge.tier === 'gold'
                            ? '#D97706'
                            : selectedBadge.tier === 'silver'
                            ? '#475569'
                            : '#B45309',
                      },
                    ]}
                  >
                    {selectedBadge.tier.toUpperCase()} TIER
                  </Text>
                </View>

                <Text style={styles.modalBadgeTitle}>
                  {isArabic ? selectedBadge.nameAr : selectedBadge.name}
                </Text>

                <Text style={styles.modalBadgeDesc}>{selectedBadge.description}</Text>

                <View
                  style={[
                    styles.modalStatusBox,
                    selectedBadge.unlockedAt ? styles.modalStatusUnlocked : styles.modalStatusLocked,
                  ]}
                >
                  <IOSIcon
                    name={selectedBadge.unlockedAt ? 'check' : 'lock'}
                    size={16}
                    color={
                      selectedBadge.unlockedAt
                        ? DesignTokens.colors.success
                        : DesignTokens.colors.secondaryLabel
                    }
                  />
                  <Text
                    style={[
                      styles.modalStatusText,
                      selectedBadge.unlockedAt
                        ? styles.modalStatusTextUnlocked
                        : styles.modalStatusTextLocked,
                    ]}
                  >
                    {selectedBadge.unlockedAt
                      ? `Unlocked ${new Date(selectedBadge.unlockedAt).toLocaleDateString()}`
                      : 'Locked • Complete scientific field requirement'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.modalDismissBtn}
                  onPress={handleCloseBadge}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalDismissText}>Done</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Surveyor Summary Modal */}
      <Modal
        visible={Boolean(selectedSurveyor)}
        animationType="fade"
        transparent
        onRequestClose={handleCloseSurveyor}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selectedSurveyor ? (
              <>
                <View style={styles.surveyorAvatarCircle}>
                  <Image
                    source={selectedSurveyor.avatar}
                    style={{ width: 44, height: 44, resizeMode: 'contain' }}
                  />
                  <View style={styles.surveyorRankBadge}>
                    <Text style={styles.surveyorRankBadgeText}>#{selectedSurveyor.rank}</Text>
                  </View>
                </View>

                <Text style={styles.modalBadgeTitle}>
                  {selectedSurveyor.name} {selectedSurveyor.isUser ? '(You)' : ''}
                </Text>
                <Text style={styles.surveyorRoleText}>{selectedSurveyor.role}</Text>

                <View style={styles.surveyorGovPill}>
                  <IOSIcon name="location" size={13} color="#0284C7" />
                  <Text style={styles.surveyorGovPillText}>
                    {selectedSurveyor.governorate} • {selectedSurveyor.sector}
                  </Text>
                </View>

                {/* Bento Metrics */}
                <View style={styles.surveyorMetricsGrid}>
                  <View style={styles.surveyorMetricTile}>
                    <Text style={styles.surveyorMetricVal}>{selectedSurveyor.badgesEarned}</Text>
                    <Text style={styles.surveyorMetricLabel}>BADGES</Text>
                  </View>
                  <View style={styles.surveyorMetricTile}>
                    <Text style={styles.surveyorMetricVal}>{selectedSurveyor.kmCount} km</Text>
                    <Text style={styles.surveyorMetricLabel}>DISTANCE</Text>
                  </View>
                  <View style={styles.surveyorMetricTile}>
                    <Text style={styles.surveyorMetricVal}>{selectedSurveyor.surveysCount}</Text>
                    <Text style={styles.surveyorMetricLabel}>SURVEYS</Text>
                  </View>
                </View>

                <View style={styles.surveyorAssuranceBox}>
                  <IOSIcon name="shield" size={14} color="#166534" />
                  <Text style={styles.surveyorAssuranceText}>
                    eBird / Darwin Core Verified Field Observer
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.modalDismissBtn}
                  onPress={handleCloseSurveyor}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalDismissText}>Close Profile</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#F7F6F2',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: DesignTokens.spacing.md,
    paddingVertical: DesignTokens.spacing.md,
    gap: 16,
    paddingBottom: 110,
  },
  levelCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  levelTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: DesignTokens.spacing.sm,
  },
  levelNumber: {
    ...DesignTokens.typography.caption2,
    fontWeight: '800',
    color: '#D9F944',
    letterSpacing: 0.8,
  },
  rankTitle: {
    ...DesignTokens.typography.title2,
    color: '#FFFFFF',
    fontWeight: '800',
    marginTop: 2,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D9F944',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: DesignTokens.radii.full,
  },
  xpBadgeText: {
    ...DesignTokens.typography.caption1,
    fontWeight: '800',
    color: '#0F172A',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
    marginVertical: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#D9F944',
    borderRadius: 4,
  },
  progressSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressSubText: {
    ...DesignTokens.typography.caption2,
    color: '#94A3B8',
  },
  streakRow: {
    flexDirection: 'row',
    gap: 12,
  },
  streakBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: DesignTokens.colors.secondarySystemGroupedBackground,
    borderRadius: DesignTokens.radii.md,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DesignTokens.colors.separator,
  },
  streakIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DesignTokens.colors.dogLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakNumber: {
    ...DesignTokens.typography.caption1,
    fontWeight: '800',
    color: DesignTokens.colors.label,
  },
  streakLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: DesignTokens.colors.secondaryLabel,
  },
  sectionContainer: {
    backgroundColor: DesignTokens.colors.secondarySystemGroupedBackground,
    borderRadius: DesignTokens.radii.lg,
    padding: DesignTokens.spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DesignTokens.colors.separator,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: DesignTokens.spacing.sm,
  },
  sectionTitle: {
    ...DesignTokens.typography.headline,
    color: DesignTokens.colors.label,
  },
  sectionSubtitle: {
    ...DesignTokens.typography.caption2,
    color: DesignTokens.colors.secondaryLabel,
  },
  sectionBadge: {
    ...DesignTokens.typography.caption2,
    fontWeight: '700',
    color: DesignTokens.colors.tint,
  },
  questCard: {
    backgroundColor: DesignTokens.colors.systemGroupedBackground,
    borderRadius: DesignTokens.radii.md,
    padding: 12,
    marginVertical: 6,
  },
  questTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  questCheckCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: DesignTokens.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questTitle: {
    ...DesignTokens.typography.subheadline,
    fontWeight: '700',
    color: DesignTokens.colors.label,
  },
  questTitleDone: {
    textDecorationLine: 'line-through',
    color: DesignTokens.colors.secondaryLabel,
  },
  questRewardPill: {
    backgroundColor: DesignTokens.colors.tintLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: DesignTokens.radii.full,
  },
  questRewardText: {
    fontSize: 11,
    fontWeight: '700',
    color: DesignTokens.colors.tint,
  },
  questDesc: {
    ...DesignTokens.typography.caption1,
    color: DesignTokens.colors.secondaryLabel,
    marginTop: 4,
    marginBottom: 8,
  },
  questBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  questBarFill: {
    height: '100%',
    backgroundColor: DesignTokens.colors.tint,
  },
  questProgressText: {
    ...DesignTokens.typography.caption2,
    color: DesignTokens.colors.tertiaryLabel,
    marginTop: 4,
    textAlign: 'right',
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  badgeCard: {
    width: '30%',
    alignItems: 'center',
    backgroundColor: DesignTokens.colors.systemGroupedBackground,
    borderRadius: DesignTokens.radii.md,
    padding: 10,
  },
  badgeCardLocked: {
    opacity: 0.5,
  },
  badgeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  badgeName: {
    ...DesignTokens.typography.caption2,
    fontWeight: '600',
    color: DesignTokens.colors.label,
    textAlign: 'center',
  },
  badgeTextLocked: {
    color: DesignTokens.colors.tertiaryLabel,
  },
  badgeTier: {
    fontSize: 9,
    fontWeight: '700',
    color: DesignTokens.colors.secondaryLabel,
    marginTop: 2,
  },
  govFilterWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  govFilterScroll: {
    gap: 6,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  govPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: DesignTokens.radii.full,
    backgroundColor: DesignTokens.colors.systemGroupedBackground,
    borderWidth: 1,
    borderColor: DesignTokens.colors.separator,
  },
  govPillActive: {
    backgroundColor: DesignTokens.colors.tint,
    borderColor: DesignTokens.colors.tint,
  },
  govPillText: {
    ...DesignTokens.typography.caption2,
    fontWeight: '600',
    color: DesignTokens.colors.secondaryLabel,
  },
  govPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  govFadeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 14,
    zIndex: 2,
  },
  govFadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 14,
    zIndex: 2,
  },
  emptyGovLeaderboard: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGovText: {
    ...DesignTokens.typography.caption1,
    color: DesignTokens.colors.secondaryLabel,
    textAlign: 'center',
  },
  leaderboardList: {
    gap: 6,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: DesignTokens.radii.sm,
    backgroundColor: DesignTokens.colors.systemGroupedBackground,
  },
  leaderboardRowUser: {
    backgroundColor: DesignTokens.colors.tintLight,
  },
  leaderboardRank: {
    ...DesignTokens.typography.caption1,
    fontWeight: '800',
    color: DesignTokens.colors.secondaryLabel,
    width: 32,
  },
  leaderboardName: {
    ...DesignTokens.typography.subheadline,
    color: DesignTokens.colors.label,
    flex: 1,
  },
  leaderboardMetric: {
    ...DesignTokens.typography.caption1,
    fontWeight: '700',
    color: DesignTokens.colors.tintDark,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: DesignTokens.colors.secondarySystemGroupedBackground,
    borderRadius: DesignTokens.radii.xl,
    padding: 24,
    alignItems: 'center',
    ...DesignTokens.shadows.medium,
  },
  modalIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTierPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: DesignTokens.radii.full,
    marginBottom: 8,
  },
  modalTierText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalBadgeTitle: {
    ...DesignTokens.typography.title2,
    color: DesignTokens.colors.label,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalBadgeDesc: {
    ...DesignTokens.typography.body,
    color: DesignTokens.colors.secondaryLabel,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  modalStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: DesignTokens.radii.sm,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 18,
  },
  modalStatusUnlocked: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  modalStatusLocked: {
    backgroundColor: DesignTokens.colors.systemGroupedBackground,
  },
  modalStatusText: {
    ...DesignTokens.typography.caption1,
    fontWeight: '600',
  },
  modalStatusTextUnlocked: {
    color: DesignTokens.colors.success,
  },
  modalStatusTextLocked: {
    color: DesignTokens.colors.secondaryLabel,
  },
  modalDismissBtn: {
    width: '100%',
    backgroundColor: DesignTokens.colors.tint,
    paddingVertical: 12,
    borderRadius: DesignTokens.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDismissText: {
    ...DesignTokens.typography.body,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  streakBoxShielded: {
    borderColor: '#D9F944',
    borderWidth: 2,
    backgroundColor: '#FDFEED',
    shadowColor: '#D9F944',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  streakIconCircleShielded: {
    backgroundColor: '#D9F944',
  },
  streakShieldGlowBadge: {
    position: 'absolute',
    top: -8,
    right: 10,
    backgroundColor: '#D9F944',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: '#0F172A',
  },
  streakShieldGlowText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  questBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  claimXpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D9F944',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0F172A',
  },
  claimXpBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  claimedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  claimedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  leaderboardGovTag: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  surveyorAvatarCircle: {
    position: 'relative',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  surveyorRankBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#D9F944',
  },
  surveyorRankBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D9F944',
  },
  surveyorRoleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  surveyorGovPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 16,
  },
  surveyorGovPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0369A1',
  },
  surveyorMetricsGrid: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginBottom: 16,
  },
  surveyorMetricTile: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  surveyorMetricVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  surveyorMetricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  surveyorAssuranceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 16,
    width: '100%',
    justifyContent: 'center',
  },
  surveyorAssuranceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
  },
});
