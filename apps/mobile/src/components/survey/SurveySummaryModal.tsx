import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { colors, typography, spacing, radius, touchTargets } from '@tunisia-survey/design-tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../design-system/Icon';
import { Button } from '../design-system/Button';
import { FixedRoute } from '../../features/routes/routesStore';
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
  onConfirmAndClose: (checklistComplete: boolean) => void;
}

export const SurveySummaryModal: React.FC<SurveySummaryModalProps> = ({
  visible,
  data,
  onConfirmAndClose,
}) => {
  const [step, setStep] = useState<'checklist' | 'summary'>('checklist');
  const [isChecklistComplete, setIsChecklistComplete] = useState<boolean>(data.completeChecklist);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const avgPaceKmH =
    data.durationSeconds > 0
      ? (data.distanceKm / (data.durationSeconds / 3600)).toFixed(1)
      : '0.0';

  const handleSelectChecklist = (complete: boolean) => {
    hapticButtonPress();
    setIsChecklistComplete(complete);
    setStep('summary');
  };

  const handleSaveAndFinish = () => {
    hapticSuccess();
    onConfirmAndClose(isChecklistComplete);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        hapticModalClose();
        onConfirmAndClose(isChecklistComplete);
      }}
    >
      <View style={styles.outerContainer}>
        <LinearGradient
          colors={['#F8FAFC', '#F1F5F9', '#E2E8F0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safeArea}>
          {step === 'checklist' ? (
            /* STEP 1: Scientific Complete Checklist Validation Question */
            <View style={styles.stepContainer}>
              <View style={styles.stepHeader}>
                <View style={styles.badgePill}>
                  <Text style={styles.badgePillText}>SCIENTIFIC PROTOCOL</Text>
                </View>
                <Text style={styles.questionTitle}>
                  Did you record every cat and dog you saw?
                </Text>
                <Text style={styles.questionContext}>
                  Complete checklists allow scientists to calculate true encounter rates,
                  including areas where zero animals were present. A zero-sighting walk is
                  scientifically just as valuable.
                </Text>
              </View>

              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    isChecklistComplete && styles.optionCardSelected,
                  ]}
                  onPress={() => handleSelectChecklist(true)}
                  activeOpacity={0.8}
                >
                  <View style={styles.optionIconContainer}>
                    <Icon name="check" size={24} color={colors.light.success} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Yes, all animals were recorded</Text>
                    <Text style={styles.optionDescription}>
                      Every cat and dog observed along the transect was logged. Eligible for full scientific XP.
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    !isChecklistComplete && styles.optionCardSelected,
                  ]}
                  onPress={() => handleSelectChecklist(false)}
                  activeOpacity={0.8}
                >
                  <View style={styles.optionIconContainer}>
                    <Icon name="close" size={24} color={colors.light.warning} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>No, some animals were missed</Text>
                    <Text style={styles.optionDescription}>
                      The survey was opportunistic or interrupted. Sightings will be recorded as incidental encounters.
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* STEP 2: Scientific Summary Card & Effort XP Breakdown */
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.summaryHeader}>
                <View style={styles.debriefPill}>
                  <Text style={styles.debriefPillText}>SURVEY DEBRIEF</Text>
                </View>
                <Text style={styles.summaryHeadline}>Survey Complete</Text>
                <Text style={styles.summarySubheadline}>
                  {data.selectedRoute
                    ? `${data.selectedRoute.name} · ${data.selectedRoute.zone}`
                    : `${data.protocol.toUpperCase()} TRANSECT`}
                </Text>
              </View>

              {/* Status Badges */}
              <View style={styles.statusBadgesRow}>
                <View style={styles.protocolBadge}>
                  <Icon name="map" size={14} color={colors.light.accent} />
                  <Text style={styles.protocolBadgeText}>{data.protocol.toUpperCase()}</Text>
                </View>
                {isChecklistComplete && (
                  <View style={styles.completeBadge}>
                    <Icon name="check" size={14} color={colors.light.success} />
                    <Text style={styles.completeBadgeText}>COMPLETE CHECKLIST</Text>
                  </View>
                )}
              </View>

              {/* Core Telemetry Grid */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricBig}>{data.distanceKm.toFixed(2)}</Text>
                  <Text style={styles.metricLabel}>KM WALKED</Text>
                </View>

                <View style={styles.metricCard}>
                  <Text style={styles.metricBig}>{formatTime(data.durationSeconds)}</Text>
                  <Text style={styles.metricLabel}>DURATION</Text>
                </View>

                <View style={styles.metricCard}>
                  <Text style={styles.metricBig}>{avgPaceKmH}</Text>
                  <Text style={styles.metricLabel}>KM/H PACE</Text>
                </View>

                <View style={styles.metricCard}>
                  <Text style={styles.metricBig}>{data.detectionsCount}</Text>
                  <Text style={styles.metricLabel}>
                    SIGHTINGS ({data.catsCount}C · {data.dogsCount}D)
                  </Text>
                </View>
              </View>

              {/* Transparent XP Effort Breakdown */}
              <View style={styles.xpCard}>
                <Text style={styles.xpCardTitle}>EFFORT-FIRST REWARD</Text>
                <View style={styles.xpRow}>
                  <Text style={styles.xpLabel}>Distance & Pace Effort</Text>
                  <Text style={styles.xpValue}>+{data.effortXp} XP</Text>
                </View>
                {isChecklistComplete && (
                  <View style={styles.xpRow}>
                    <Text style={styles.xpLabel}>Complete Scientific Checklist</Text>
                    <Text style={styles.xpValue}>+{data.completeBonus || 25} XP</Text>
                  </View>
                )}
                {data.detectionsCount > 0 && (
                  <View style={styles.xpRow}>
                    <Text style={styles.xpLabel}>Individual Encounters ({data.detectionsCount})</Text>
                    <Text style={styles.xpValue}>+{data.animalsBonus} XP</Text>
                  </View>
                )}
                {data.selectedRoute && (
                  <View style={styles.xpRow}>
                    <Text style={styles.xpLabel}>Fixed Observatory Route</Text>
                    <Text style={styles.xpValue}>+{data.routeBonus || 15} XP</Text>
                  </View>
                )}

                <View style={styles.xpDivider} />

                <View style={styles.xpRowTotal}>
                  <Text style={styles.xpTotalLabel}>TOTAL REWARD</Text>
                  <Text style={styles.xpTotalValue}>
                    +{data.totalXp + (isChecklistComplete ? 0 : -(data.completeBonus || 0))} XP
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtonsCol}>
                <Button
                  label="Save Survey & Sync"
                  onPress={handleSaveAndFinish}
                  variant="primary"
                  size="hero"
                />

                <TouchableOpacity
                  style={styles.backStepBtn}
                  onPress={() => setStep('checklist')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.backStepText}>Change checklist answer</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    padding: spacing[6],
    justifyContent: 'center',
  },
  stepHeader: {
    marginBottom: spacing[6],
  },
  badgePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginBottom: spacing[3],
  },
  badgePillText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.light.accent,
    letterSpacing: 0.5,
  },
  questionTitle: {
    ...typography.title1,
    color: colors.light.label,
    marginBottom: spacing[3],
  },
  questionContext: {
    ...typography.body,
    color: colors.light.labelSecondary,
    lineHeight: 22,
  },
  optionsContainer: {
    gap: spacing[4],
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: spacing[4],
    borderWidth: 1.5,
    borderColor: colors.light.separator,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    gap: spacing[3],
  },
  optionCardSelected: {
    borderColor: colors.light.accent,
    backgroundColor: '#F8FAFC',
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    ...typography.headline,
    color: colors.light.label,
    marginBottom: 4,
  },
  optionDescription: {
    ...typography.caption,
    color: colors.light.labelSecondary,
    lineHeight: 16,
  },
  scrollContent: {
    padding: spacing[6],
  },
  summaryHeader: {
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  debriefPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginBottom: spacing[2],
  },
  debriefPillText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.light.labelSecondary,
    letterSpacing: 0.6,
  },
  summaryHeadline: {
    ...typography.largeTitle,
    color: colors.light.label,
  },
  summarySubheadline: {
    ...typography.subhead,
    color: colors.light.labelSecondary,
    marginTop: 2,
  },
  statusBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[2],
    marginBottom: spacing[5],
  },
  protocolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(2, 132, 199, 0.10)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  protocolBadgeText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.light.accent,
  },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(22, 163, 74, 0.10)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  completeBadgeText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.light.success,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginBottom: spacing[5],
  },
  metricCard: {
    width: '47.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.light.separator,
    alignItems: 'center',
  },
  metricBig: {
    ...typography.title2,
    fontWeight: '700',
    color: colors.light.label,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.light.labelSecondary,
    marginTop: 2,
    fontSize: 10,
  },
  xpCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.light.separator,
    marginBottom: spacing[6],
  },
  xpCardTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.light.labelSecondary,
    letterSpacing: 0.6,
    marginBottom: spacing[3],
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  xpLabel: {
    ...typography.callout,
    color: colors.light.labelSecondary,
  },
  xpValue: {
    ...typography.callout,
    fontWeight: '600',
    color: colors.light.label,
  },
  xpDivider: {
    height: 1,
    backgroundColor: colors.light.separator,
    marginVertical: spacing[3],
  },
  xpRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpTotalLabel: {
    ...typography.headline,
    color: colors.light.label,
  },
  xpTotalValue: {
    ...typography.title3,
    color: colors.light.accent,
    fontWeight: '700',
  },
  actionButtonsCol: {
    gap: spacing[3],
    marginBottom: spacing[8],
  },
  backStepBtn: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  backStepText: {
    ...typography.callout,
    color: colors.light.labelSecondary,
    textDecorationLine: 'underline',
  },
});
