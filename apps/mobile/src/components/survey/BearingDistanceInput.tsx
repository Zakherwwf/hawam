import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import Svg, {
  Circle,
  Line,
  Path,
  Text as SvgText,
  G,
  Defs,
  LinearGradient,
  Stop,
  Polygon,
} from 'react-native-svg';
import * as Location from 'expo-location';
import { DesignTokens } from '../../design-system/tokens';
import { IOSIcon } from '../ios';
import {
  hapticTabSwitch,
  hapticButtonPress,
  hapticSuccess,
  hapticWarning,
} from '../../utils/haptics';
import { getBearingMetadata, normalizeBearing } from '../../services/georef/geoUtils';
import { Species } from '@tunisia-survey/shared';
import { formatDistance, measurementSystemForLocale } from '../../utils/units';

interface BearingDistanceInputProps {
  distanceMeters: number;
  onDistanceChange: (val: number) => void;
  bearingDeg: number;
  onBearingChange: (val: number) => void;
  perpendicularDistanceM?: number;
  species?: Species;
  transectHeading?: number;
}

// Values are metres; labels are rendered in the volunteer's unit
const DISTANCE_PRESETS = [
  { sublabel: 'ui_bearingDistanceInput.direct', value: 1 },
  { sublabel: 'ui_bearingDistanceInput.pavement', value: 3 },
  { sublabel: 'ui_bearingDistanceInput.car', value: 6 },
  { sublabel: 'ui_bearingDistanceInput.lane', value: 10 },
  { sublabel: 'ui_bearingDistanceInput.street', value: 15 },
  { sublabel: 'ui_bearingDistanceInput.courtyard', value: 25 },
  { sublabel: 'ui_bearingDistanceInput.far_field', value: 50 },
];

const RELATIVE_PRESETS = [
  {
    label: 'ui_bearingDistanceInput.0_ahead',
    sublabel: 'ui_bearingDistanceInput.path_heading',
    deg: 0,
  },
  {
    label: 'ui_bearingDistanceInput.45_right',
    sublabel: 'ui_bearingDistanceInput.front_right',
    deg: 45,
  },
  {
    label: 'ui_bearingDistanceInput.90_right',
    sublabel: 'ui_bearingDistanceInput.perpendicular',
    deg: 90,
  },
  {
    label: 'ui_bearingDistanceInput.135_back',
    sublabel: 'ui_bearingDistanceInput.rear_right',
    deg: 135,
  },
  {
    label: 'ui_bearingDistanceInput.180_behind',
    sublabel: 'ui_bearingDistanceInput.reverse_path',
    deg: 180,
  },
  {
    label: 'ui_bearingDistanceInput.225_back',
    sublabel: 'ui_bearingDistanceInput.rear_left',
    deg: 225,
  },
  {
    label: 'ui_bearingDistanceInput.90_left',
    sublabel: 'ui_bearingDistanceInput.perpendicular',
    deg: 270,
  },
  {
    label: 'ui_bearingDistanceInput.45_left',
    sublabel: 'ui_bearingDistanceInput.front_left',
    deg: 315,
  },
];

const CARDINAL_TICKS = [
  { label: 'N', deg: 0, isMajor: true },
  { label: 'ui_bearingDistanceInput.ne', deg: 45, isMajor: false },
  { label: 'E', deg: 90, isMajor: true },
  { label: 'ui_bearingDistanceInput.se', deg: 135, isMajor: false },
  { label: 'S', deg: 180, isMajor: true },
  { label: 'ui_bearingDistanceInput.sw', deg: 225, isMajor: false },
  { label: 'W', deg: 270, isMajor: true },
  { label: 'ui_bearingDistanceInput.nw', deg: 315, isMajor: false },
];

export const BearingDistanceInput: React.FC<BearingDistanceInputProps> = ({
  distanceMeters,
  onDistanceChange,
  bearingDeg,
  onBearingChange,
  perpendicularDistanceM,
  species = 'cat',
}) => {
  const { t } = useTranslation();
  const units = useMemo(() => measurementSystemForLocale(), []);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [isLiveSensorActive, setIsLiveSensorActive] = useState<boolean>(false);
  const headingSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const normalizedBearing = normalizeBearing(bearingDeg);
  const metadata = getBearingMetadata(normalizedBearing);

  // Stop sensor subscription on unmount
  useEffect(() => {
    return () => {
      if (headingSubscriptionRef.current) {
        headingSubscriptionRef.current.remove();
        headingSubscriptionRef.current = null;
      }
    };
  }, []);

  // Toggle Live Magnetometer Compass Sensor
  const handleToggleLiveSensor = async () => {
    if (isLiveSensorActive) {
      if (headingSubscriptionRef.current) {
        headingSubscriptionRef.current.remove();
        headingSubscriptionRef.current = null;
      }
      setIsLiveSensorActive(false);
      hapticSuccess();
      return;
    }

    try {
      if (!Location.watchHeadingAsync) {
        hapticWarning();
        return;
      }

      hapticButtonPress();
      setIsLiveSensorActive(true);

      const sub = await Location.watchHeadingAsync((headingData) => {
        const heading =
          headingData.trueHeading >= 0 ? headingData.trueHeading : headingData.magHeading;
        if (heading >= 0) {
          onBearingChange(Math.round(heading));
        }
      });

      headingSubscriptionRef.current = sub;
    } catch (e) {
      console.warn('Compass sensor unavailable:', e);
      setIsLiveSensorActive(false);
      hapticWarning();
    }
  };

  // Nudge angle by step (+/- degrees)
  const handleNudge = (delta: number) => {
    hapticButtonPress();
    onBearingChange(normalizeBearing(normalizedBearing + delta));
  };

  // Compass Radar Canvas Math (Compact 170 x 170, Center: 85, 85)
  const dialCenter = 85;
  const outerRadius = 72;

  // Convert touch coordinate to bearing angle (0° = North = Top)
  const handleDialTouch = (evt: GestureResponderEvent) => {
    const { locationX, locationY } = evt.nativeEvent;
    const dx = locationX - dialCenter;
    const dy = locationY - dialCenter;

    // Small deadzone around center
    if (Math.hypot(dx, dy) < 12) return;

    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (deg < 0) deg += 360;

    onBearingChange(Math.round(deg));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        handleDialTouch(evt);
        hapticButtonPress();
      },
      onPanResponderMove: (evt) => {
        handleDialTouch(evt);
      },
      onPanResponderRelease: () => {
        hapticSuccess();
      },
    })
  ).current;

  // Calculate target reticle position based on bearing and distance
  const bearingRad = (normalizedBearing * Math.PI) / 180;
  // Scaled distance radius (min 22px, max 64px)
  const distScale = Math.min(1, Math.max(0.15, distanceMeters / 30));
  const targetRadius = 22 + distScale * 42;

  const targetX = dialCenter + targetRadius * Math.sin(bearingRad);
  const targetY = dialCenter - targetRadius * Math.cos(bearingRad);

  const rimX = dialCenter + outerRadius * Math.sin(bearingRad);
  const rimY = dialCenter - outerRadius * Math.cos(bearingRad);

  // Direction pointer arrow vertices
  const arrowSize = 7;
  const arrowTipX = rimX;
  const arrowTipY = rimY;
  const arrowBaseLeftX =
    dialCenter +
    (outerRadius - arrowSize) * Math.sin(bearingRad) -
    arrowSize * 0.6 * Math.cos(bearingRad);
  const arrowBaseLeftY =
    dialCenter -
    (outerRadius - arrowSize) * Math.cos(bearingRad) -
    arrowSize * 0.6 * Math.sin(bearingRad);
  const arrowBaseRightX =
    dialCenter +
    (outerRadius - arrowSize) * Math.sin(bearingRad) +
    arrowSize * 0.6 * Math.cos(bearingRad);
  const arrowBaseRightY =
    dialCenter -
    (outerRadius - arrowSize) * Math.cos(bearingRad) +
    arrowSize * 0.6 * Math.sin(bearingRad);

  return (
    <View style={styles.container}>
      {/* ----------------- SECTION 1: DISTANCE ESTIMATION ----------------- */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.headerTitleRow}>
          <IOSIcon name="ruler" size={16} color={DesignTokens.colors.tint} />
          <Text style={styles.sectionTitle}>
            {t('ui_bearingDistanceInput.sighting_distance_r_meters')}
          </Text>
        </View>
        <Text style={styles.currentValText}>{formatDistance(distanceMeters, units)}</Text>
      </View>

      <Text style={styles.helperText}>
        {t('ui_bearingDistanceInput.direct_radial_distance_from_your_observation')}
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
                {formatDistance(p.value, units, 0)}
                {p.value >= 50 ? '+' : ''}
              </Text>
              <Text style={[styles.presetSubText, isSelected && styles.presetSubTextActive]}>
                {t(p.sublabel)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Distance Stepper Adjustment */}
      <View style={styles.stepperRow}>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => onDistanceChange(Math.max(1, distanceMeters - 1))}
          activeOpacity={0.7}
        >
          <IOSIcon name="minus" size={16} color={DesignTokens.colors.label} />
        </TouchableOpacity>

        <Text style={styles.stepperDisplay}>{formatDistance(distanceMeters, units)}</Text>

        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => onDistanceChange(distanceMeters + 1)}
          activeOpacity={0.7}
        >
          <IOSIcon name="plus" size={16} color={DesignTokens.colors.label} />
        </TouchableOpacity>
      </View>

      {/* ----------------- SECTION 2: SIGHTING ANGLE & COMPASS RADAR ----------------- */}
      <View style={[styles.sectionHeaderRow, { marginTop: DesignTokens.spacing.lg }]}>
        <View style={styles.headerTitleRow}>
          <IOSIcon name="compass" size={16} color={DesignTokens.colors.tint} />
          <Text style={styles.sectionTitle}>
            {t('ui_bearingDistanceInput.sighting_angle_bearing')}
          </Text>
        </View>
        <View style={styles.bearingDisplayPill}>
          <Text style={styles.bearingDegreeValue}>{Math.round(normalizedBearing)}°</Text>
          <Text style={styles.bearingCardinalValue}>{metadata.cardinal}</Text>
        </View>
      </View>

      {/* Sublabel Relative Direction Badge */}
      <View style={styles.relativeDirectionRow}>
        <View style={styles.relativeDirectionBadge}>
          <Text style={styles.relativeDirectionText}>{metadata.relativeLabel}</Text>
        </View>
        {isLiveSensorActive && (
          <View style={styles.liveSensorActiveBadge}>
            <View style={styles.livePulseDot} />
            <Text style={styles.liveSensorActiveText}>
              {t('ui_bearingDistanceInput.live_sensor')}
            </Text>
          </View>
        )}
      </View>

      {/* Educational Guide Toggle Button */}
      <TouchableOpacity
        style={styles.guideToggleButton}
        onPress={() => {
          hapticButtonPress();
          setShowGuide(!showGuide);
        }}
        activeOpacity={0.7}
      >
        <IOSIcon name="info" size={14} color="#0284C7" />
        <Text style={styles.guideToggleText}>
          {showGuide
            ? t('ui_bearingDistanceInput.hide_sighting_angle_guide')
            : t('ui_bearingDistanceInput.how_to_measure_sighting_angles_guide')}
        </Text>
        <IOSIcon
          name={showGuide ? 'chevronUp' : 'chevronDown'}
          size={12}
          color={DesignTokens.colors.secondaryLabel}
        />
      </TouchableOpacity>

      {/* Collapsible Illustrated Visual Field Guide Card */}
      {showGuide && (
        <View style={styles.visualGuideCard}>
          <Text style={styles.guideCardTitle}>
            {t('ui_bearingDistanceInput.field_protocol_sighting_angle')}
          </Text>

          {/* SVG Scientific Infographic Diagram */}
          <View style={styles.guideSvgWrapper}>
            <Svg width="100%" height={125} viewBox="0 0 320 125">
              <Defs>
                <LinearGradient id="pathGradient" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0%" stopColor="#0284C7" stopOpacity="0.2" />
                  <Stop offset="50%" stopColor="#0284C7" stopOpacity="0.4" />
                  <Stop offset="100%" stopColor="#0284C7" stopOpacity="0.2" />
                </LinearGradient>
              </Defs>

              {/* Transect Walking Path Corridor (Vertical center line) */}
              <Path d="M 60 120 L 60 10" stroke="#0284C7" strokeWidth="3" strokeDasharray="6 4" />
              {/* Path Arrow */}
              <Polygon points="60,6 56,14 64,14" fill="#0284C7" />
              <SvgText x="50" y="20" fontSize="10" fontWeight="700" fill="#0284C7" textAnchor="end">
                {t('ui_bearingDistanceInput.path_ahead_0')}
              </SvgText>

              {/* Surveyor Node */}
              <Circle cx="60" cy="95" r="9" fill="#0F172A" />
              <Circle cx="60" cy="95" r="5" fill="#38BDF8" />
              <SvgText
                x="60"
                y="114"
                fontSize="10"
                fontWeight="700"
                fill="#0F172A"
                textAnchor="middle"
              >
                {t('ui_bearingDistanceInput.you_observer')}
              </SvgText>

              {/* Line of Sight Ray (Hypotenuse r) */}
              <Line x1="60" y1="95" x2="210" y2="40" stroke="#DD4B34" strokeWidth="2.5" />
              <SvgText x="130" y="60" fontSize="10" fontWeight="700" fill="#DD4B34">
                {t('ui_bearingDistanceInput.radial_distance_r')}
              </SvgText>

              {/* Sighting Angle Arc θ */}
              <Path d="M 60 65 A 30 30 0 0 1 82 74" fill="none" stroke="#F59E0B" strokeWidth="2" />
              <SvgText x="78" y="65" fontSize="11" fontWeight="800" fill="#F59E0B">
                {t('ui_bearingDistanceInput.angle')}
              </SvgText>

              {/* Animal Target Reticle */}
              <Circle cx="210" cy="40" r="12" fill={species === 'dog' ? '#EA580C' : '#0284C7'} />
              <Circle cx="210" cy="40" r="5" fill="#FFFFFF" />
              <SvgText
                x="210"
                y="20"
                fontSize="10"
                fontWeight="700"
                fill={species === 'dog' ? '#EA580C' : '#0284C7'}
                textAnchor="middle"
              >
                {species === 'dog'
                  ? t('ui_bearingDistanceInput.dog')
                  : t('ui_bearingDistanceInput.cat')}
              </SvgText>

              {/* Perpendicular Distance Line g(x) */}
              <Line
                x1="210"
                y1="40"
                x2="60"
                y2="40"
                stroke="#059669"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
              <SvgText
                x="135"
                y="34"
                fontSize="9.5"
                fontWeight="700"
                fill="#059669"
                textAnchor="middle"
              >
                {t('ui_bearingDistanceInput.perpendicular_g_x_r_sin')}
              </SvgText>

              {/* Right Angle Indicator */}
              <Path d="M 60 48 L 68 48 L 68 40" fill="none" stroke="#059669" strokeWidth="1.5" />
            </Svg>
          </View>

          {/* 3 Step Scientific Guidance */}
          <View style={styles.guideStepRow}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.stepInstructionText}>
              <Text style={styles.stepBold}>
                {t('ui_bearingDistanceInput.face_forward_along_your_transect_path')}
              </Text>{' '}
              {t('ui_bearingDistanceInput.this_represents_0_ahead')}
            </Text>
          </View>

          <View style={styles.guideStepRow}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.stepInstructionText}>
              <Text style={styles.stepBold}>{t('ui_bearingDistanceInput.point_top_of_phone')}</Text>{' '}
              {t('ui_bearingDistanceInput.or_drag_the_compass_dial_directly')}
            </Text>
          </View>

          <View style={styles.guideStepRow}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.stepInstructionText}>
              <Text style={styles.stepBold}>{t('ui_bearingDistanceInput.distance_sampling')}</Text>{' '}
              {t('ui_bearingDistanceInput.automatically_converts_radial_distance_and_angle')}
            </Text>
          </View>
        </View>
      )}

      {/* ----------------- INTERACTIVE COMPASS RADAR DIAL ----------------- */}
      <View style={styles.radarWrapper}>
        <View
          style={styles.radarTouchArea}
          {...panResponder.panHandlers}
          accessibilityLabel={t('ui_bearingDistanceInput.interactive_sighting_compass_dial')}
          accessibilityHint={t('ui_bearingDistanceInput.drag_or_tap_around_the_dial')}
        >
          <Svg width={dialCenter * 2} height={dialCenter * 2}>
            {/* Outer Circular Boundary */}
            <Circle
              cx={dialCenter}
              cy={dialCenter}
              r={outerRadius}
              fill="rgba(241, 245, 249, 0.7)"
              stroke="#CBD5E1"
              strokeWidth="1.5"
            />

            {/* Range Concentric Rings (10m, 20m, 30m distance zones) */}
            <Circle
              cx={dialCenter}
              cy={dialCenter}
              r={22}
              fill="none"
              stroke="rgba(148, 163, 184, 0.3)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <Circle
              cx={dialCenter}
              cy={dialCenter}
              r={44}
              fill="none"
              stroke="rgba(148, 163, 184, 0.3)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <Circle
              cx={dialCenter}
              cy={dialCenter}
              r={64}
              fill="none"
              stroke="rgba(148, 163, 184, 0.35)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />

            {/* Transect Line of Travel (North-South Path Line) */}
            <Line
              x1={dialCenter}
              y1={dialCenter * 2 - 10}
              x2={dialCenter}
              y2={10}
              stroke="#0284C7"
              strokeWidth="2"
              strokeDasharray="4 4"
            />

            {/* Path Forward Indicator Arrow */}
            <Polygon
              points={`${dialCenter},6 ${dialCenter - 4},14 ${dialCenter + 4},14`}
              fill="#0284C7"
            />

            {/* 8-Point Compass Tick Marks & Labels */}
            {CARDINAL_TICKS.map((tick) => {
              const rad = (tick.deg * Math.PI) / 180;
              const innerTickR = tick.isMajor ? outerRadius - 8 : outerRadius - 4;
              const x1 = dialCenter + outerRadius * Math.sin(rad);
              const y1 = dialCenter - outerRadius * Math.cos(rad);
              const x2 = dialCenter + innerTickR * Math.sin(rad);
              const y2 = dialCenter - innerTickR * Math.cos(rad);

              const labelR = outerRadius - 14;
              const lx = dialCenter + labelR * Math.sin(rad);
              const ly = dialCenter - labelR * Math.cos(rad) + 3;

              return (
                <G key={tick.deg}>
                  <Line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={tick.isMajor ? '#0F172A' : '#94A3B8'}
                    strokeWidth={tick.isMajor ? 1.5 : 1}
                  />
                  <SvgText
                    x={lx}
                    y={ly}
                    fontSize={tick.isMajor ? 9 : 7.5}
                    fontWeight={tick.isMajor ? '800' : '600'}
                    fill={tick.deg === 0 ? '#0284C7' : tick.isMajor ? '#0F172A' : '#64748B'}
                    textAnchor="middle"
                  >
                    {t(tick.label)}
                  </SvgText>
                </G>
              );
            })}

            {/* Radial Sighting Beam to Target */}
            <Line
              x1={dialCenter}
              y1={dialCenter}
              x2={rimX}
              y2={rimY}
              stroke="#06B6D4"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <Line
              x1={dialCenter}
              y1={dialCenter}
              x2={targetX}
              y2={targetY}
              stroke="#0891B2"
              strokeWidth="2.5"
            />

            {/* Outer Aim Arrow on Rim */}
            <Polygon
              points={`${arrowTipX},${arrowTipY} ${arrowBaseLeftX},${arrowBaseLeftY} ${arrowBaseRightX},${arrowBaseRightY}`}
              fill="#0891B2"
            />

            {/* Observer Center Pin */}
            <Circle cx={dialCenter} cy={dialCenter} r={8} fill="#0F172A" />
            <Circle cx={dialCenter} cy={dialCenter} r={4} fill="#38BDF8" />

            {/* Animal Target Badge at Radial Distance */}
            <Circle
              cx={targetX}
              cy={targetY}
              r={10}
              fill={species === 'dog' ? '#EA580C' : '#0284C7'}
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
            <SvgText
              x={targetX}
              y={targetY + 3.5}
              fontSize="9"
              fontWeight="800"
              fill="#FFFFFF"
              textAnchor="middle"
            >
              {species === 'dog' ? 'D' : 'C'}
            </SvgText>
          </Svg>
        </View>

        {/* Center Digital Readout Overlay */}
        <View style={styles.radarLegendRow}>
          <Text style={styles.radarLegendHint}>
            {t('ui_bearingDistanceInput.tap_or_drag_around_dial_to')}
          </Text>
        </View>
      </View>

      {/* ----------------- ANGLE STEPPERS ROW ----------------- */}
      <View style={styles.angleStepperRow}>
        <TouchableOpacity
          style={styles.nudgeBtn}
          onPress={() => handleNudge(-15)}
          activeOpacity={0.7}
        >
          <Text style={styles.nudgeBtnText}>–15°</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.nudgeBtn}
          onPress={() => handleNudge(-5)}
          activeOpacity={0.7}
        >
          <Text style={styles.nudgeBtnText}>–5°</Text>
        </TouchableOpacity>

        <View style={styles.nudgeCenterBadge}>
          <Text style={styles.nudgeCenterDeg}>{Math.round(normalizedBearing)}°</Text>
          <Text style={styles.nudgeCenterCardinal}>{metadata.cardinal}</Text>
        </View>

        <TouchableOpacity
          style={styles.nudgeBtn}
          onPress={() => handleNudge(5)}
          activeOpacity={0.7}
        >
          <Text style={styles.nudgeBtnText}>+5°</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.nudgeBtn}
          onPress={() => handleNudge(15)}
          activeOpacity={0.7}
        >
          <Text style={styles.nudgeBtnText}>+15°</Text>
        </TouchableOpacity>
      </View>

      {/* ----------------- QUICK PRESET CHIPS ----------------- */}
      <Text style={styles.presetsLabel}>
        {t('ui_bearingDistanceInput.quick_orientation_presets')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetsScroll}
      >
        {RELATIVE_PRESETS.map((p) => {
          const isSelected = Math.abs(normalizedBearing - p.deg) < 5.0;
          return (
            <TouchableOpacity
              key={p.deg}
              style={[styles.presetChip, isSelected && styles.presetChipActive]}
              onPress={() => {
                hapticTabSwitch();
                onBearingChange(p.deg);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.presetText, isSelected && styles.presetTextActive]}>
                {t(p.label)}
              </Text>
              <Text style={[styles.presetSubText, isSelected && styles.presetSubTextActive]}>
                {t(p.sublabel)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ----------------- LIVE DEVICE COMPASS ACTION BUTTON ----------------- */}
      <TouchableOpacity
        style={[styles.liveSensorButton, isLiveSensorActive && styles.liveSensorButtonActive]}
        onPress={handleToggleLiveSensor}
        activeOpacity={0.8}
      >
        <View style={styles.liveSensorRow}>
          {isLiveSensorActive ? (
            <View style={styles.livePulseDotWhite} />
          ) : (
            <IOSIcon name="compass" size={15} color={DesignTokens.colors.label} />
          )}
          <Text
            style={[
              styles.liveSensorButtonText,
              isLiveSensorActive && styles.liveSensorButtonTextActive,
            ]}
          >
            {isLiveSensorActive
              ? t('ui_bearingDistanceInput.aiming_point_top_of_phone_at')
              : t('ui_bearingDistanceInput.point_phone_to_aim_live_compass')}
          </Text>
        </View>
      </TouchableOpacity>

      {/* ----------------- CALCULATED PERPENDICULAR DISTANCE ----------------- */}
      {perpendicularDistanceM !== undefined ? (
        <View style={styles.secrCalculatedBox}>
          <IOSIcon name="ruler" size={14} color={DesignTokens.colors.tintDark} />
          <Text style={styles.secrCalculatedText}>
            {t('ui_bearingDistanceInput.calculated_perpendicular_distance_from_transect_', {
              v1: perpendicularDistanceM.toFixed(1),
            })}
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
    minWidth: 70,
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
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
    shadowColor: '#0F172A',
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
  bearingDisplayPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bearingDegreeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0284C7',
  },
  bearingCardinalValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  relativeDirectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: DesignTokens.spacing.xs,
  },
  relativeDirectionBadge: {
    backgroundColor: DesignTokens.colors.systemGroupedBackground,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DesignTokens.colors.separator,
  },
  relativeDirectionText: {
    fontSize: 11,
    fontWeight: '600',
    color: DesignTokens.colors.secondaryLabel,
  },
  liveSensorActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveSensorActiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.5,
  },
  guideToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(2, 132, 199, 0.06)',
    borderRadius: 8,
    marginVertical: 6,
  },
  guideToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
    flex: 1,
    marginLeft: 6,
  },
  visualGuideCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 6,
  },
  guideCardTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  guideSvgWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    marginVertical: 4,
    overflow: 'hidden',
  },
  guideStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
  },
  stepNumberBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepInstructionText: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
    flex: 1,
  },
  stepBold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  radarWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  radarTouchArea: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveSensorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  livePulseDotWhite: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  radarLegendRow: {
    marginTop: 4,
  },
  radarLegendHint: {
    fontSize: 11,
    color: DesignTokens.colors.secondaryLabel,
    textAlign: 'center',
  },
  angleStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: DesignTokens.colors.systemGroupedBackground,
    borderRadius: 10,
    padding: 6,
    marginBottom: 8,
  },
  nudgeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: DesignTokens.colors.secondarySystemGroupedBackground,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DesignTokens.colors.separator,
  },
  nudgeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: DesignTokens.colors.label,
  },
  nudgeCenterBadge: {
    alignItems: 'center',
  },
  nudgeCenterDeg: {
    fontSize: 15,
    fontWeight: '800',
    color: DesignTokens.colors.label,
  },
  nudgeCenterCardinal: {
    fontSize: 10,
    fontWeight: '700',
    color: DesignTokens.colors.secondaryLabel,
  },
  presetsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: DesignTokens.colors.secondaryLabel,
    marginBottom: 4,
    marginTop: 2,
  },
  liveSensorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: DesignTokens.colors.systemGroupedBackground,
    borderRadius: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: DesignTokens.colors.separator,
    marginTop: 4,
  },
  liveSensorButtonActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  liveSensorButtonText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: DesignTokens.colors.label,
  },
  liveSensorButtonTextActive: {
    color: '#FFFFFF',
  },
  secrCalculatedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: DesignTokens.spacing.sm,
    padding: 9,
    backgroundColor: 'rgba(8, 145, 178, 0.08)',
    borderRadius: DesignTokens.radii.sm,
  },
  secrCalculatedText: {
    ...DesignTokens.typography.caption2,
    fontWeight: '600',
    color: DesignTokens.colors.tintDark,
    flex: 1,
  },
});
