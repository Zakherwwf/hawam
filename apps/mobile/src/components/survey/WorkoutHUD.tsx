import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';
import { DesignTokens } from '../../design-system/tokens';
import { IOSIcon } from '../ios';
import { hapticQuickLog, hapticButtonPress } from '../../utils/haptics';

interface WorkoutHUDProps {
  elapsedSeconds: number;
  distanceKm: number;
  detectionsCount: number;
  catsCount: number;
  dogsCount: number;
  isPaused: boolean;
  onPauseToggle: () => void;
  onLogCat: () => void;
  onLogDog: () => void;
  onFinish: () => void;
}

function formatTimer(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${pad(h)}:${pad(remM)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

export const WorkoutHUD: React.FC<WorkoutHUDProps> = ({
  elapsedSeconds,
  distanceKm,
  detectionsCount,
  catsCount,
  dogsCount,
  isPaused,
  onPauseToggle,
  onLogCat,
  onLogDog,
  onFinish,
}) => {
  const pace = elapsedSeconds > 10 ? (distanceKm / (elapsedSeconds / 3600)).toFixed(1) : '3.6';

  const handleLogCat = () => {
    hapticQuickLog();
    onLogCat();
  };

  const handleLogDog = () => {
    hapticQuickLog();
    onLogDog();
  };

  const handlePause = () => {
    hapticButtonPress();
    onPauseToggle();
  };

  const handleFinish = () => {
    hapticButtonPress();
    onFinish();
  };

  return (
    <View style={styles.cardContainer}>
      {/* Primary Apple Fitness Metric: Tabular Elapsed Time */}
      <View style={styles.primaryMetricRow}>
        <View>
          <Text style={styles.timerText}>{formatTimer(elapsedSeconds)}</Text>
          <Text style={styles.metricLabel}>ELAPSED SURVEY TIME</Text>
        </View>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, isPaused && styles.statusDotPaused]} />
          <Text style={styles.statusText}>{isPaused ? 'PAUSED' : 'LIVE GPS FIX'}</Text>
        </View>
      </View>

      {/* Secondary Metrics Row */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricColumn}>
          <Text style={styles.metricValue}>{distanceKm.toFixed(2)}</Text>
          <Text style={styles.metricSubLabel}>KILOMETERS</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricColumn}>
          <Text style={styles.metricValue}>{pace}</Text>
          <Text style={styles.metricSubLabel}>KM/H PACE</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricColumn}>
          <Text style={styles.metricValue}>{detectionsCount}</Text>
          <Text style={styles.metricSubLabel} numberOfLines={1} adjustsFontSizeToFit>
            ANIMALS ({catsCount}C · {dogsCount}D)
          </Text>
        </View>
      </View>

      {/* Large Quick-Log Buttons: + Cat and + Dog */}
      <View style={styles.quickLogButtonsRow}>
        <TouchableOpacity
          style={[styles.bigLogBtn, styles.catBtn]}
          onPress={handleLogCat}
          activeOpacity={0.7}
        >
          <Image
            source={require('../../../assets/icon_cat_white.png')}
            style={{ width: 18, height: 18, resizeMode: 'contain' }}
          />
          <Text style={styles.bigLogBtnText}>+ Cat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bigLogBtn, styles.dogBtn]}
          onPress={handleLogDog}
          activeOpacity={0.7}
        >
          <Image
            source={require('../../../assets/icon_dog_white.png')}
            style={{ width: 18, height: 18, resizeMode: 'contain' }}
          />
          <Text style={styles.bigLogBtnText}>+ Dog</Text>
        </TouchableOpacity>
      </View>

      {/* Session Controls: Pause/Resume and End Survey */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.pauseBtn]}
          onPress={handlePause}
          activeOpacity={0.7}
        >
          <IOSIcon name={isPaused ? 'play' : 'pause'} size={15} color={DesignTokens.colors.label} />
          <Text style={styles.pauseBtnText} numberOfLines={1} ellipsizeMode="tail">
            {isPaused ? 'Resume' : 'Pause'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.endBtn]}
          onPress={handleFinish}
          activeOpacity={0.7}
        >
          <IOSIcon name="flag" size={15} color={DesignTokens.colors.welfareAlert} />
          <Text style={styles.endBtnText} numberOfLines={1} ellipsizeMode="tail">
            End Survey
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: DesignTokens.radii.lg,
    padding: DesignTokens.spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DesignTokens.colors.glassBorder,
    ...DesignTokens.shadows.glass,
    marginHorizontal: DesignTokens.spacing.md,
    marginBottom: DesignTokens.spacing.md,
  },
  primaryMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: DesignTokens.spacing.sm,
  },
  timerText: {
    ...DesignTokens.typography.workoutMetricLarge,
    color: DesignTokens.colors.label,
  },
  metricLabel: {
    ...DesignTokens.typography.caption2,
    fontWeight: '700',
    color: DesignTokens.colors.secondaryLabel,
    letterSpacing: 0.5,
    marginTop: -2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(8, 145, 178, 0.10)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: DesignTokens.radii.full,
    marginTop: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: DesignTokens.colors.success,
  },
  statusDotPaused: {
    backgroundColor: DesignTokens.colors.warning,
  },
  statusText: {
    ...DesignTokens.typography.caption2,
    fontWeight: '700',
    color: DesignTokens.colors.tint,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: DesignTokens.colors.secondarySystemBackground,
    borderRadius: DesignTokens.radii.md,
    paddingVertical: 10,
    marginVertical: DesignTokens.spacing.sm,
  },
  metricColumn: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    ...DesignTokens.typography.workoutMetricMedium,
    color: DesignTokens.colors.label,
  },
  metricSubLabel: {
    ...DesignTokens.typography.caption2,
    fontWeight: '600',
    color: DesignTokens.colors.secondaryLabel,
    marginTop: 2,
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: DesignTokens.colors.separator,
  },
  quickLogButtonsRow: {
    flexDirection: 'row',
    gap: DesignTokens.spacing.sm,
    marginTop: DesignTokens.spacing.xs,
    marginBottom: DesignTokens.spacing.xs,
  },
  bigLogBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: DesignTokens.radii.md,
  },
  catBtn: {
    backgroundColor: DesignTokens.colors.cat,
  },
  dogBtn: {
    backgroundColor: DesignTokens.colors.dog,
  },
  bigLogBtnText: {
    ...DesignTokens.typography.headline,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: DesignTokens.spacing.sm,
    marginTop: DesignTokens.spacing.xs,
  },
  actionBtn: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: DesignTokens.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  pauseBtn: {
    backgroundColor: DesignTokens.colors.secondarySystemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DesignTokens.colors.separator,
  },
  pauseBtnText: {
    ...DesignTokens.typography.subheadline,
    fontWeight: '600',
    color: DesignTokens.colors.label,
  },
  endBtn: {
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.22)',
  },
  endBtnText: {
    ...DesignTokens.typography.subheadline,
    fontWeight: '700',
    color: DesignTokens.colors.welfareAlert,
  },
});
