import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  I18nManager,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { IOSColors, IOSTypography } from '../theme/ios';
import { IOSGroupedList, IOSListRow, IOSIcon } from '../components/ios';
import { AnimatedHeroBanner } from '../components/common/AnimatedHeroBanner';
import { hapticButtonPress, hapticQuickLog, hapticTabSwitch } from '../utils/haptics';
import { useThemeStore } from '../features/theme/themeStore';
import { UserAccount } from './AccountScreen';

interface HomeScreenProps {
  onStartSurvey: () => void;
  onQuickSighting: () => void;
  onOpenTraining: () => void;
  onOpenSettings?: () => void;
  onToggleMap?: () => void;
  stats: {
    sessionsCompleted: number;
    kmWalked: number;
    animalsRecorded: number;
  };
  userAccount?: UserAccount | null;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartSurvey,
  onQuickSighting,
  onOpenTraining,
  onOpenSettings,
  onToggleMap,
  stats,
  userAccount,
}) => {
  const { t } = useTranslation();
  const { themeMode, colors, toggleTheme } = useThemeStore();

  const dateFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).toUpperCase();

  const effortIndexPercent = Math.min(100, Math.max(15, stats.sessionsCompleted * 10));

  return (
    <View style={[styles.outerContainer, { backgroundColor: colors.screenBg }]}>
      <LinearGradient
        colors={colors.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* TripGlide Full-Bleed Video Background Hero */}
          <AnimatedHeroBanner
            height={250}
            variant="backgroundHero"
            scene="patrol"
            titleBadge="NATIONAL FAUNA OBSERVATORY"
            headline={t('app_name')}
            subheadline={t('tagline')}
          >
            {/* Top Floating Controls on Hero */}
            <View style={styles.heroTopControls}>
              <View style={styles.heroTopLeftRow}>
                <View style={styles.frostedDatePill}>
                  <Text style={styles.frostedDateText}>{dateFormatted}</Text>
                </View>
                <View style={styles.frostedInstitutionPill}>
                  <IOSIcon name="shield" size={12} color="#D9F944" />
                  <Text style={styles.frostedInstitutionText}>{userAccount?.organization || 'Institut Pasteur'}</Text>
                </View>
              </View>

              <View style={styles.heroTopRightRow}>
                {onToggleMap && (
                  <TouchableOpacity
                    style={styles.heroMapToggleBtn}
                    onPress={() => {
                      hapticTabSwitch();
                      onToggleMap();
                    }}
                    activeOpacity={0.8}
                  >
                    <IOSIcon name="map" size={13} color="#0F172A" />
                    <Text style={styles.heroMapToggleText}>Live Map</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.heroSettingsBtn}
                  onPress={toggleTheme}
                  activeOpacity={0.8}
                  accessibilityLabel="Toggle Day or Night theme"
                >
                  <IOSIcon name={themeMode === 'night' ? 'moon' : 'sun'} size={15} color="#FFFFFF" />
                </TouchableOpacity>
                {onOpenSettings && (
                  <TouchableOpacity
                    style={styles.heroSettingsBtn}
                    onPress={() => {
                      hapticButtonPress();
                      onOpenSettings();
                    }}
                    activeOpacity={0.8}
                  >
                    <IOSIcon name="gear" size={15} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </AnimatedHeroBanner>

          {/* Content Sheet */}
          <View style={styles.sheetContent}>
            {/* OxeliaMetrix Bento Hero Card for Telemetry Stats */}
            <View style={styles.bentoTile}>
              <View style={styles.bentoTopRow}>
                <View style={styles.bentoLabelGroup}>
                  <Text style={styles.bentoLabelText}>FIELD TELEMETRY EFFORT</Text>
                  <Text style={styles.bentoSubLabelText}>Verified Standardized Surveys</Text>
                </View>
                <View style={styles.bentoCitronBadge}>
                  <Text style={styles.bentoCitronBadgeText}>TIER 1</Text>
                </View>
              </View>

              <View style={styles.bentoMetricsRow}>
                <View style={styles.bentoMetricItem}>
                  <Text style={styles.bentoMetricVal}>{stats.sessionsCompleted}</Text>
                  <Text style={styles.bentoMetricLabel}>{t('home.sessions_completed')}</Text>
                </View>
                <View style={styles.bentoDivider} />
                <View style={styles.bentoMetricItem}>
                  <Text style={styles.bentoMetricVal}>{stats.kmWalked.toFixed(1)}</Text>
                  <Text style={styles.bentoMetricLabel}>{t('home.km_walked')}</Text>
                </View>
                <View style={styles.bentoDivider} />
                <View style={styles.bentoMetricItem}>
                  <Text style={styles.bentoMetricVal}>{stats.animalsRecorded}</Text>
                  <Text style={styles.bentoMetricLabel}>{t('home.animals_recorded')}</Text>
                </View>
              </View>

              {/* Electric Citron Progress Bar */}
              <View style={styles.bentoProgressContainer}>
                <View style={styles.bentoProgressTrack}>
                  <View
                    style={[
                      styles.bentoProgressFill,
                      { width: `${effortIndexPercent}%` },
                    ]}
                  />
                </View>
                <View style={styles.bentoProgressFoot}>
                  <Text style={styles.bentoProgressFootText}>Census Effort Completion</Text>
                  <Text style={styles.bentoProgressFootVal}>{effortIndexPercent}%</Text>
                </View>
              </View>
            </View>

            {/* Field Operations Section Header */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Field Operations</Text>
              <Text style={styles.sectionBadge}>ACTIVE WORKFLOWS</Text>
            </View>

            {/* Featured Action Bento Card: Start Standardized Transect */}
            <TouchableOpacity
              style={styles.featuredActionCard}
              activeOpacity={0.88}
              onPress={() => {
                hapticButtonPress();
                onStartSurvey();
              }}
            >
              <LinearGradient
                colors={['#0F172A', '#1E293B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.featuredCardGradient}
              >
                <View style={styles.featuredCardTop}>
                  <View style={styles.featuredIconPill}>
                    <IOSIcon name="compass" size={18} color="#D9F944" />
                  </View>
                  <View style={styles.featuredProtocolBadge}>
                    <Text style={styles.featuredProtocolText}>DISTANCE SAMPLING</Text>
                  </View>
                </View>

                <Text style={styles.featuredTitle}>{t('home.start_survey_btn')}</Text>
                <Text style={styles.featuredSubtitle}>
                  {t('home.start_survey_subtitle')}
                </Text>

                <View style={styles.featuredBottomRow}>
                  <View style={styles.activePillLive}>
                    <View style={styles.livePulseDot} />
                    <Text style={styles.activePillLiveText}>Standard Protocol</Text>
                  </View>
                  <View style={styles.startArrowCircle}>
                    <IOSIcon name="chevronRight" size={13} color="#0F172A" />
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Split Bento Actions: Opportunistic & Academy */}
            <View style={styles.splitActionsRow}>
              {/* Quick Observation Card */}
              <TouchableOpacity
                style={styles.splitCard}
                activeOpacity={0.85}
                onPress={() => {
                  hapticQuickLog();
                  onQuickSighting();
                }}
              >
                <View style={[styles.splitIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <Image
                    source={require('../../assets/icon_cat_primary.png')}
                    style={{ width: 22, height: 22, resizeMode: 'contain' }}
                  />
                </View>
                <Text style={styles.splitCardTitle}>{t('home.quick_sighting_btn')}</Text>
                <Text style={styles.splitCardSubtitle} numberOfLines={2}>
                  {t('home.quick_sighting_subtitle')}
                </Text>
                <View style={styles.splitCardFooter}>
                  <Text style={[styles.splitFooterTag, { color: '#D97706' }]}>Incidental</Text>
                  <IOSIcon name="chevronRight" size={12} color="#94A3B8" />
                </View>
              </TouchableOpacity>

              {/* Surveyor Academy Training Card */}
              <TouchableOpacity
                style={styles.splitCard}
                activeOpacity={0.85}
                onPress={() => {
                  hapticButtonPress();
                  onOpenTraining();
                }}
              >
                <View style={[styles.splitIconBox, { backgroundColor: '#E0E7FF' }]}>
                  <IOSIcon name="shield" size={18} color="#4F46E5" />
                </View>
                <Text style={styles.splitCardTitle}>{t('home.training_btn')}</Text>
                <Text style={styles.splitCardSubtitle} numberOfLines={2}>
                  {t('home.training_subtitle')}
                </Text>
                <View style={styles.splitCardFooter}>
                  <Text style={[styles.splitFooterTag, { color: '#4F46E5' }]}>Certification</Text>
                  <IOSIcon name="chevronRight" size={12} color="#94A3B8" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Scientific Methodology & Standards Group */}
            <IOSGroupedList header={t('home.governance_header')}>
              <IOSListRow
                title={t('home.spatial_charter_title')}
                subtitle={t('home.spatial_charter_sub')}
                icon="location"
                iconColor={IOSColors.systemGreen}
                value="Active"
              />
              <IOSListRow
                title={t('home.statistical_models_title')}
                subtitle={t('home.statistical_models_sub')}
                icon="chart"
                iconColor={IOSColors.systemIndigo}
                value="Standard"
              />
              <IOSListRow
                title="Darwin Core & SECR Matrices"
                subtitle="Automated export compatibility for R and GBIF"
                icon="squareStack"
                iconColor={IOSColors.systemPurple}
                value="Ready"
                isLast
              />
            </IOSGroupedList>
          </View>
        </ScrollView>
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
    paddingBottom: 120,
  },
  heroTopControls: {
    position: 'absolute',
    top: 14,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
  heroTopLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroTopRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMapToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#D9F944',
    borderWidth: 1,
    borderColor: '#0F172A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  heroMapToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  heroSettingsBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frostedDatePill: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  frostedDateText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.6,
  },
  frostedInstitutionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(217, 249, 68, 0.35)',
  },
  frostedInstitutionText: {
    fontSize: 11,
    color: '#D9F944',
    fontWeight: '700',
  },
  sheetContent: {
    marginTop: 0,
    paddingTop: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  bentoTile: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  bentoTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  bentoLabelGroup: {
    flex: 1,
  },
  bentoLabelText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  bentoSubLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F8FAFC',
    marginTop: 2,
  },
  bentoCitronBadge: {
    backgroundColor: '#D9F944',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bentoCitronBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.6,
  },
  bentoMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  bentoMetricItem: {
    alignItems: 'center',
    flex: 1,
  },
  bentoMetricVal: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  bentoMetricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 3,
    textAlign: 'center',
  },
  bentoDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  bentoProgressContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  bentoProgressTrack: {
    height: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bentoProgressFill: {
    height: '100%',
    backgroundColor: '#D9F944',
    borderRadius: 4,
  },
  bentoProgressFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  bentoProgressFootText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  bentoProgressFootVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D9F944',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: -4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  sectionBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  featuredActionCard: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 6,
  },
  featuredCardGradient: {
    padding: 18,
    borderRadius: 22,
  },
  featuredCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  featuredIconPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(217, 249, 68, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredProtocolBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  featuredProtocolText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D9F944',
    letterSpacing: 0.6,
  },
  featuredTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  featuredSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 17,
  },
  featuredBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  activePillLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  activePillLiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  startArrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D9F944',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  splitCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    justifyContent: 'space-between',
  },
  splitIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  splitCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  splitCardSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    lineHeight: 15,
    marginBottom: 10,
  },
  splitCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F1F5F9',
  },
  splitFooterTag: {
    fontSize: 11,
    fontWeight: '700',
  },
});
