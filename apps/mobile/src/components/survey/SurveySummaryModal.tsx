import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { IOSColors, IOSTypography } from '../../theme/ios';
import { LinearGradient } from 'expo-linear-gradient';
import { IOSIcon } from '../ios';
import { FixedRoute } from '../../features/routes/routesStore';
import { AnimatedHeroBanner } from '../common/AnimatedHeroBanner';
import {
  hapticModalClose,
  hapticButtonPress,
  hapticSuccess,
} from '../../utils/haptics';

export interface SurveySummaryData {
  protocol: string;
  durationSeconds: number;
  distanceKm: number;
  detectionsCount: number;
  catsCount: number;
  dogsCount: number;
  completeChecklist: boolean;
  selectedRoute: FixedRoute | null;
  isAcademyCertified: boolean;
  effortXp: number;
  completeBonus: number;
  animalsBonus: number;
  routeBonus: number;
  certifiedBonus: number;
  totalXp: number;
}

interface SurveySummaryModalProps {
  visible: boolean;
  data: SurveySummaryData;
  onConfirmAndClose: () => void;
}

export const SurveySummaryModal: React.FC<SurveySummaryModalProps> = ({
  visible,
  data,
  onConfirmAndClose,
}) => {
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const avgPaceKmH =
    data.durationSeconds > 0
      ? ((data.distanceKm / (data.durationSeconds / 3600))).toFixed(1)
      : '0.0';

  const handleShare = () => {
    Alert.alert(
      'Scientific Debrief Ready',
      `Hawem Observatory Survey Record:\n• Distance: ${data.distanceKm.toFixed(2)} km\n• Duration: ${formatTime(data.durationSeconds)}\n• Animals: ${data.detectionsCount} (${data.catsCount} cats, ${data.dogsCount} dogs)\n• eBird Complete: ${data.completeChecklist ? 'YES' : 'NO'}\n• XP Awarded: +${data.totalXp} XP`,
      [{ text: 'OK' }]
    );
  };

  // Ring calculations (percentages capped at 100%)
  const timeProgress = Math.min(100, Math.round((data.durationSeconds / 1200) * 100)); // 20 min baseline
  const distProgress = Math.min(100, Math.round((data.distanceKm / 1.5) * 100)); // 1.5 km baseline
  const obsProgress = data.completeChecklist ? 100 : Math.min(100, data.detectionsCount * 20);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        hapticModalClose();
        onConfirmAndClose();
      }}
    >
      <View style={styles.outerContainer}>
        <LinearGradient
          colors={['#FDF2EC', '#FAF5EE', '#F3F6F2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* TripGlide Full-Bleed Animated Video Hero with floating modal controls */}
            <AnimatedHeroBanner
              height={230}
              variant="backgroundHero"
              scene="dog"
              headline="Outstanding Effort"
              subheadline={
                data.selectedRoute
                  ? `${data.selectedRoute.name} • ${data.selectedRoute.zone}`
                  : 'Free-form Transect Survey • Tunisia'
              }
            >
              {/* Floating Top Controls Row on Hero: Title Pill & Frosted Done Button */}
              <View style={styles.modalHeroTopRow}>
                <View style={styles.frostedModalTitlePill}>
                  <Text style={styles.frostedModalTitleText}>SURVEY DEBRIEF</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    hapticModalClose();
                    onConfirmAndClose();
                  }}
                  style={styles.frostedDoneBtn}
                  activeOpacity={0.75}
                >
                  <Text style={styles.frostedDoneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </AnimatedHeroBanner>

            {/* Overlapping Content Sheet (TripGlide Pattern) */}
            <View style={styles.overlappingSheet}>
              {/* Protocol and Certification Badges */}
              <View style={styles.sheetBadgesRow}>
                <View style={styles.heroProtocolBadge}>
                  <IOSIcon name="location" size={12} color="#0284C7" />
                  <Text style={styles.heroProtocolBadgeText}>{data.protocol.toUpperCase()} PROTOCOL</Text>
                </View>
                {data.completeChecklist && (
                  <View style={styles.heroCompleteBadge}>
                    <IOSIcon name="check" size={12} color="#059669" />
                    <Text style={styles.heroCompleteBadgeText}>EBIRD CERTIFIED</Text>
                  </View>
                )}
              </View>

          {/* Activity Rings Metric Display (Apple Fitness Inspired) */}
          <View style={styles.ringsCard}>
            <View style={styles.ringsVisual}>
              {/* Outer Ring Bar: Time */}
              <View style={styles.ringBarRow}>
                <View style={[styles.ringIndicatorDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.ringBarLabel}>Effort Time</Text>
                <View style={styles.ringTrack}>
                  <View style={[styles.ringFill, { width: `${timeProgress}%`, backgroundColor: '#10B981' }]} />
                </View>
                <Text style={styles.ringPercent}>{timeProgress}%</Text>
              </View>

              {/* Middle Ring Bar: Distance */}
              <View style={styles.ringBarRow}>
                <View style={[styles.ringIndicatorDot, { backgroundColor: '#0284C7' }]} />
                <Text style={styles.ringBarLabel}>Transect Dist</Text>
                <View style={styles.ringTrack}>
                  <View style={[styles.ringFill, { width: `${distProgress}%`, backgroundColor: '#0284C7' }]} />
                </View>
                <Text style={styles.ringPercent}>{distProgress}%</Text>
              </View>

              {/* Inner Ring Bar: Protocol Completeness */}
              <View style={styles.ringBarRow}>
                <View style={[styles.ringIndicatorDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.ringBarLabel}>Completeness</Text>
                <View style={styles.ringTrack}>
                  <View style={[styles.ringFill, { width: `${obsProgress}%`, backgroundColor: '#F59E0B' }]} />
                </View>
                <Text style={styles.ringPercent}>{obsProgress}%</Text>
              </View>
            </View>
          </View>

          {/* Telemetry Metric Cards */}
          <View style={styles.telemetryGrid}>
            <View style={styles.telemetryCard}>
              <Text style={styles.telemetryLabel}>ACTIVE TIME</Text>
              <Text style={styles.telemetryValue}>{formatTime(data.durationSeconds)}</Text>
              <Text style={styles.telemetrySub}>Elapsed Survey</Text>
            </View>

            <View style={styles.telemetryCard}>
              <Text style={styles.telemetryLabel}>DISTANCE</Text>
              <Text style={styles.telemetryValue}>{data.distanceKm.toFixed(2)}</Text>
              <Text style={styles.telemetrySub}>Kilometers</Text>
            </View>

            <View style={styles.telemetryCard}>
              <Text style={styles.telemetryLabel}>AVG PACE</Text>
              <Text style={styles.telemetryValue}>{avgPaceKmH}</Text>
              <Text style={styles.telemetrySub}>km / hour</Text>
            </View>

            <View style={styles.telemetryCard}>
              <Text style={styles.telemetryLabel}>ANIMALS LOGGED</Text>
              <Text style={styles.telemetryValue}>{data.detectionsCount}</Text>
              <Text style={styles.telemetrySub}>
                {data.catsCount} cats • {data.dogsCount} dogs
              </Text>
            </View>
          </View>

          {/* Zero Non-Detection Highlight */}
          {data.detectionsCount === 0 && data.completeChecklist && (
            <View style={styles.zeroHighlightCard}>
              <View style={styles.zeroHighlightHeader}>
                <IOSIcon name="shield" size={18} color="#059669" />
                <Text style={styles.zeroHighlightTitle}>Scientific Non-Detection Recorded</Text>
              </View>
              <Text style={styles.zeroHighlightText}>
                Zero animal sightings recorded during a complete transect is high-value negative evidence for municipal density estimation.
              </Text>
            </View>
          )}

          {/* Itemized Calibrated XP Breakdown */}
          <View style={styles.xpCard}>
            <View style={styles.xpHeaderRow}>
              <View>
                <Text style={styles.xpCardTitle}>Observatory Credit</Text>
                <Text style={styles.xpCardSub}>Scientifically weighted effort breakdown</Text>
              </View>
              <View style={styles.totalXpPill}>
                <Text style={styles.totalXpText}>+{data.totalXp} XP</Text>
              </View>
            </View>

            <View style={styles.xpDivider} />

            <View style={styles.xpItemRow}>
              <View style={styles.xpItemLeft}>
                <IOSIcon name="clock" size={15} color={IOSColors.systemTeal} />
                <Text style={styles.xpItemLabel}>Survey Effort Time</Text>
              </View>
              <Text style={styles.xpItemVal}>+{data.effortXp} XP</Text>
            </View>

            {data.completeBonus > 0 && (
              <View style={styles.xpItemRow}>
                <View style={styles.xpItemLeft}>
                  <IOSIcon name="check" size={15} color="#10B981" />
                  <Text style={styles.xpItemLabel}>eBird Complete Checklist</Text>
                </View>
                <Text style={styles.xpItemVal}>+{data.completeBonus} XP</Text>
              </View>
            )}

            {data.animalsBonus > 0 && (
              <View style={styles.xpItemRow}>
                <View style={styles.xpItemLeft}>
                  <IOSIcon name="paw" size={15} color="#F97316" />
                  <Text style={styles.xpItemLabel}>Animal Observations ({data.detectionsCount})</Text>
                </View>
                <Text style={styles.xpItemVal}>+{data.animalsBonus} XP</Text>
              </View>
            )}

            {data.routeBonus > 0 && (
              <View style={styles.xpItemRow}>
                <View style={styles.xpItemLeft}>
                  <IOSIcon name="compass" size={15} color={IOSColors.systemIndigo} />
                  <Text style={styles.xpItemLabel}>Adopted Route Guardian Bonus</Text>
                </View>
                <Text style={styles.xpItemVal}>+{data.routeBonus} XP</Text>
              </View>
            )}

            {data.certifiedBonus > 0 && (
              <View style={styles.xpItemRow}>
                <View style={styles.xpItemLeft}>
                  <IOSIcon name="shield" size={15} color="#8B5CF6" />
                  <Text style={styles.xpItemLabel}>Academy Certified Multiplier (+10%)</Text>
                </View>
                <Text style={styles.xpItemVal}>+{data.certifiedBonus} XP</Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionGroup}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                hapticSuccess();
                onConfirmAndClose();
              }}
              activeOpacity={0.8}
            >
              <IOSIcon name="check" size={18} color="#FFFFFF" />
              <Text style={styles.primaryBtnText} numberOfLines={1}>Save & Sync</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                hapticButtonPress();
                handleShare();
              }}
              activeOpacity={0.7}
            >
              <IOSIcon name="share" size={16} color={IOSColors.label} />
              <Text style={styles.secondaryBtnText} numberOfLines={1}>Share Summary</Text>
            </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  </Modal>
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
    paddingBottom: 40,
  },
  overlappingSheet: {
    marginTop: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingTop: 14,
    zIndex: 20,
    gap: 12,
  },
  modalHeroTopRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  frostedModalTitlePill: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
  },
  frostedModalTitleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  frostedDoneBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  frostedDoneBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  sheetBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  heroProtocolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  heroProtocolBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 0.5,
  },
  heroCompleteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  heroCompleteBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  protocolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFEDE8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  protocolBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DD4B34',
  },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  completeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  congratsTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: IOSColors.label,
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  routeSubtitle: {
    fontSize: 14,
    color: IOSColors.secondaryLabel,
  },
  ringsCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  ringsVisual: {
    gap: 12,
  },
  ringBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ringIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ringBarLabel: {
    width: 90,
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  ringTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  ringFill: {
    height: '100%',
    borderRadius: 4,
  },
  ringPercent: {
    width: 38,
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'right',
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  telemetryCard: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  telemetryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: IOSColors.tertiaryLabel,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  telemetryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: IOSColors.label,
    letterSpacing: -0.4,
  },
  telemetrySub: {
    fontSize: 11,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
  },
  zeroHighlightCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 16,
  },
  zeroHighlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  zeroHighlightTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  zeroHighlightText: {
    fontSize: 12,
    color: '#047857',
    lineHeight: 17,
  },
  xpCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  xpHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: IOSColors.label,
  },
  xpCardSub: {
    fontSize: 12,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
  },
  totalXpPill: {
    backgroundColor: '#D9F944',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  totalXpText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  xpDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  xpItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  xpItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  xpItemLabel: {
    fontSize: 13,
    color: IOSColors.secondaryLabel,
  },
  xpItemVal: {
    fontSize: 13,
    fontWeight: '700',
    color: IOSColors.label,
  },
  actionGroup: {
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: IOSColors.systemTeal,
    paddingVertical: 15,
    borderRadius: 14,
    shadowColor: IOSColors.systemTeal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
    borderRadius: 14,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOSColors.label,
  },
});
