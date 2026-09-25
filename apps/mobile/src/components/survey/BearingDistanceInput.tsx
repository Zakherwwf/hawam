import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { DesignTokens } from '../../design-system/tokens';
import { IOSIcon } from '../ios';
import { hapticTabSwitch } from '../../utils/haptics';

interface BearingDistanceInputProps {
  distanceMeters: number;
  onDistanceChange: (val: number) => void;
  bearingDeg: number;
  onBearingChange: (val: number) => void;
  perpendicularDistanceM?: number;
}

const DISTANCE_PRESETS = [
  { label: '1m', sublabel: 'Direct', value: 1 },
  { label: '3m', sublabel: 'Pavement', value: 3 },
  { label: '6m', sublabel: 'Car', value: 6 },
  { label: '10m', sublabel: 'Lane', value: 10 },
  { label: '15m', sublabel: 'Street', value: 15 },
  { label: '25m', sublabel: 'Courtyard', value: 25 },
  { label: '50m+', sublabel: 'Far Field', value: 50 },
];

export const BearingDistanceInput: React.FC<BearingDistanceInputProps> = ({
  distanceMeters,
  onDistanceChange,
  bearingDeg,
  onBearingChange,
  perpendicularDistanceM,
}) => {
  return (
    <View style={styles.container}>
      {/* Distance Estimation Section */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.headerTitleRow}>
          <IOSIcon name="ruler" size={16} color={DesignTokens.colors.tint} />
          <Text style={styles.sectionTitle}>Perpendicular Distance g(x)</Text>
        </View>
        <Text style={styles.currentValText}>{distanceMeters.toFixed(1)} meters</Text>
      </View>

      <Text style={styles.helperText}>
        Distance sampling estimates detection probability. Select approximate distance:
      </Text>

      {/* Preset Distance Scrolling Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetsScroll}
      >
        {DISTANCE_PRESETS.map((p) => {
          const isSelected = Math.abs(distanceMeters - p.value) < 1.0;
          return (
            <TouchableOpacity
              key={p.value}
              style={[styles.presetChip, isSelected && styles.presetChipActive]}
              onPress={() => {
                hapticTabSwitch();
                onDistanceChange(p.value);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.presetText, isSelected && styles.presetTextActive]}>
                {p.label}
              </Text>
              <Text style={[styles.presetSubText, isSelected && styles.presetSubTextActive]}>
                {p.sublabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Stepper adjustment */}
      <View style={styles.stepperRow}>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => onDistanceChange(Math.max(1, distanceMeters - 1))}
          activeOpacity={0.7}
        >
          <IOSIcon name="minus" size={16} color={DesignTokens.colors.label} />
        </TouchableOpacity>

        <Text style={styles.stepperDisplay}>{distanceMeters.toFixed(1)} m</Text>

        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => onDistanceChange(distanceMeters + 1)}
          activeOpacity={0.7}
        >
          <IOSIcon name="plus" size={16} color={DesignTokens.colors.label} />
        </TouchableOpacity>
      </View>

      {/* Compass Bearing Section */}
      <View style={[styles.sectionHeaderRow, { marginTop: DesignTokens.spacing.md }]}>
        <View style={styles.headerTitleRow}>
          <IOSIcon name="compass" size={16} color={DesignTokens.colors.tint} />
          <Text style={styles.sectionTitle}>Compass Bearing to Animal</Text>
        </View>
        <Text style={styles.currentValText}>{Math.round(bearingDeg)}°</Text>
      </View>

      <View style={styles.bearingBar}>
        <Text style={styles.bearingHint}>Point device toward spotted animal</Text>
        <View style={styles.bearingBadge}>
          <Text style={styles.bearingBadgeText}>{Math.round(bearingDeg)}° N</Text>
        </View>
      </View>

      {perpendicularDistanceM !== undefined ? (
        <View style={styles.secrCalculatedBox}>
          <Text style={styles.secrCalculatedText}>
            Calculated Perpendicular Distance from Transect: {perpendicularDistanceM.toFixed(1)}m
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: DesignTokens.colors.secondarySystemGroupedBackground,
    borderRadius: DesignTokens.radii.md,
    padding: DesignTokens.spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DesignTokens.colors.separator,
    marginVertical: DesignTokens.spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: DesignTokens.spacing.xs,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    ...DesignTokens.typography.subheadline,
    fontWeight: '700',
    color: DesignTokens.colors.label,
  },
  currentValText: {
    ...DesignTokens.typography.subheadline,
    fontWeight: '700',
    color: DesignTokens.colors.tint,
  },
  helperText: {
    ...DesignTokens.typography.footnote,
    color: DesignTokens.colors.secondaryLabel,
    marginBottom: DesignTokens.spacing.sm,
    lineHeight: 18,
  },
  presetsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
    marginBottom: DesignTokens.spacing.sm,
  },
  presetChip: {
    minWidth: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: DesignTokens.radii.sm,
    backgroundColor: DesignTokens.colors.systemGroupedBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DesignTokens.colors.separator,
  },
  presetChipActive: {
    backgroundColor: DesignTokens.colors.tint,
    borderColor: DesignTokens.colors.tint,
    shadowColor: DesignTokens.colors.tint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  presetText: {
    ...DesignTokens.typography.caption2,
    fontSize: 13,
    fontWeight: '700',
    color: DesignTokens.colors.label,
  },
  presetTextActive: {
    color: '#FFFFFF',
  },
  presetSubText: {
    fontSize: 10,
    fontWeight: '500',
    color: DesignTokens.colors.secondaryLabel,
    marginTop: 2,
  },
  presetSubTextActive: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: DesignTokens.colors.systemGroupedBackground,
    borderRadius: DesignTokens.radii.sm,
    paddingVertical: 6,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DesignTokens.colors.secondarySystemGroupedBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DesignTokens.colors.separator,
  },
  stepperDisplay: {
    ...DesignTokens.typography.body,
    fontWeight: '700',
    color: DesignTokens.colors.label,
    minWidth: 70,
    textAlign: 'center',
  },
  bearingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: DesignTokens.colors.systemGroupedBackground,
    borderRadius: DesignTokens.radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
  },
  bearingHint: {
    ...DesignTokens.typography.footnote,
    color: DesignTokens.colors.secondaryLabel,
  },
  bearingBadge: {
    backgroundColor: DesignTokens.colors.tintLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: DesignTokens.radii.xs,
  },
  bearingBadgeText: {
    ...DesignTokens.typography.caption1,
    fontWeight: '700',
    color: DesignTokens.colors.tint,
  },
  secrCalculatedBox: {
    marginTop: DesignTokens.spacing.sm,
    padding: 8,
    backgroundColor: 'rgba(8, 145, 178, 0.08)',
    borderRadius: DesignTokens.radii.sm,
  },
  secrCalculatedText: {
    ...DesignTokens.typography.caption2,
    fontWeight: '600',
    color: DesignTokens.colors.tintDark,
    textAlign: 'center',
  },
});
