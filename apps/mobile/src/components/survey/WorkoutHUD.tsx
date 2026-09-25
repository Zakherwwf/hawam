import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { colors, typography, spacing, radius, touchTargets } from '@tunisia-survey/design-tokens';
import { GlassView } from '../design-system/GlassView';
import { Icon } from '../design-system/Icon';
import { hapticQuickLog, hapticButtonPress, hapticWarning } from '../../utils/haptics';

interface WorkoutHUDProps {
  elapsedSeconds: number;
  distanceKm: number;
  detectionsCount: number;
  catsCount: number;
  dogsCount: number;
  isPaused: boolean;
  gpsAccuracyM?: number;
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

export { POCKET_SAFE_DELAY_MS, getGpsQuality } from './hudUtils';
import { getGpsQuality, POCKET_SAFE_DELAY_MS } from './hudUtils';

export const WorkoutHUD: React.FC<WorkoutHUDProps> = ({
  elapsedSeconds,
  distanceKm,
  detectionsCount,
  catsCount,
  dogsCount,
  isPaused,
  gpsAccuracyM,
  onPauseToggle,
  onLogCat,
  onLogDog,
  onFinish,
}) => {
  const [hintMessage, setHintMessage] = useState<string | null>(null);

  const pace = elapsedSeconds > 10 ? (distanceKm / (elapsedSeconds / 3600)).toFixed(1) : '3.6';

  // GPS Quality determination
  const gpsQuality = getGpsQuality(gpsAccuracyM, isPaused);
  const gpsStatusText = gpsQuality.label;
  const gpsDotColor =
    gpsQuality.level === 'good'
      ? colors.light.gpsGood
      : gpsQuality.level === 'poor'
      ? colors.light.gpsPoor
      : colors.light.gpsFair;

  const handleLogCat = () => {
    hapticQuickLog();
    onLogCat();
  };

  const handleLogDog = () => {
    hapticQuickLog();
    onLogDog();
  };

  const handleLongPressPause = () => {
    hapticButtonPress();
    setHintMessage(null);
    onPauseToggle();
  };

  const handleLongPressFinish = () => {
    hapticWarning();
    setHintMessage(null);
    onFinish();
  };

  const showTapHint = (action: 'pause' | 'finish') => {
    hapticButtonPress();
    setHintMessage(`Hold for 1s to ${action}`);
    setTimeout(() => setHintMessage(null), 2500);
  };

  return (
    <GlassView style={styles.hudContainer}>
      {/* Primary Apple Fitness Metric: Tabular Elapsed Time & GPS Status */}
      <View style={styles.primaryMetricRow}>
        <View>
          <Text style={styles.timerText}>{formatTimer(elapsedSeconds)}</Text>
          <Text style={styles.metricLabel}>ELAPSED TIME</Text>
        </View>

        <View style={styles.statusPill}>
          <View style={[styles.statusDot, { backgroundColor: gpsDotColor }]} />
          <Text style={styles.statusText}>{gpsStatusText}</Text>
        </View>
      </View>

      {/* Secondary Metrics Grid */}
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
            SIGHTINGS ({catsCount}C · {dogsCount}D)
          </Text>
        </View>
      </View>

      {/* Large Thumb-Zone Quick Log Buttons: Cat and Dog (64pt height) */}
      <View style={styles.quickLogButtonsRow}>
        <TouchableOpacity
          style={[styles.heroLogBtn, styles.catBtn]}
          onPress={handleLogCat}
          activeOpacity={0.75}
          accessibilityLabel="Record Cat sighting immediately"
          accessibilityRole="button"
        >
          <Icon name="cat" size={24} color="#FFFFFF" />
          <Text style={styles.heroLogBtnText}>+ Cat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.heroLogBtn, styles.dogBtn]}
          onPress={handleLogDog}
          activeOpacity={0.75}
          accessibilityLabel="Record Dog sighting immediately"
          accessibilityRole="button"
        >
          <Icon name="dog" size={24} color="#FFFFFF" />
          <Text style={styles.heroLogBtnText}>+ Dog</Text>
        </TouchableOpacity>
      </View>

      {/* Optional Hint Banner for Long-Press Education */}
      {hintMessage && (
        <View style={styles.hintBanner}>
          <Text style={styles.hintText}>{hintMessage}</Text>
        </View>
      )}

      {/* Pocket-Safe Session Controls: Long-Press Pause and Long-Press Finish */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.pauseBtn]}
          onPress={() => showTapHint('pause')}
          onLongPress={handleLongPressPause}
          delayLongPress={POCKET_SAFE_DELAY_MS}
          activeOpacity={0.8}
          accessibilityLabel={isPaused ? 'Hold to resume survey' : 'Hold to pause survey'}
          accessibilityRole="button"
        >
          <Icon name={isPaused ? 'play' : 'pause'} size={16} color={colors.light.label} />
          <Text style={styles.pauseBtnText} numberOfLines={1}>
            {isPaused ? 'Hold to Resume' : 'Hold to Pause'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.finishBtn]}
          onPress={() => showTapHint('finish')}
          onLongPress={handleLongPressFinish}
          delayLongPress={POCKET_SAFE_DELAY_MS}
          activeOpacity={0.8}
          accessibilityLabel="Hold to finish survey"
          accessibilityRole="button"
        >
          <Icon name="stop" size={16} color={colors.light.danger} />
          <Text style={styles.finishBtnText} numberOfLines={1}>
            Hold to Finish
          </Text>
        </TouchableOpacity>
      </View>
    </GlassView>
  );
};

const styles = StyleSheet.create({
  hudContainer: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    borderRadius: radius.lg,
    padding: spacing[4],
  },
  primaryMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
  },
  timerText: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '700',
    color: colors.light.label,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.light.labelSecondary,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.light.label,
    fontSize: 11,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
    borderRadius: radius.md,
    paddingVertical: spacing[2],
    marginVertical: spacing[2],
  },
  metricColumn: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    ...typography.title2,
    fontWeight: '700',
    color: colors.light.label,
    fontVariant: ['tabular-nums'],
  },
  metricSubLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.light.labelSecondary,
    marginTop: 2,
    fontSize: 10,
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: colors.light.separator,
  },
  quickLogButtonsRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[2],
    marginBottom: spacing[2],
  },
  heroLogBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: touchTargets.hero, // 64 pt thumb zone
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  catBtn: {
    backgroundColor: colors.light.cat,
  },
  dogBtn: {
    backgroundColor: colors.light.dog,
  },
  heroLogBtnText: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  hintBanner: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  hintText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  actionBtn: {
    flex: 1,
    minHeight: touchTargets.min, // 44 pt minimum
    paddingHorizontal: spacing[2],
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  pauseBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    borderWidth: 1,
    borderColor: colors.light.separator,
  },
  pauseBtnText: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.light.label,
  },
  finishBtn: {
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.25)',
  },
  finishBtnText: {
    ...typography.subhead,
    fontWeight: '700',
    color: colors.light.danger,
  },
});
