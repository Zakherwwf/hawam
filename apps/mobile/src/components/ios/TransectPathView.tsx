import { useTranslation } from 'react-i18next';
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Polyline, Rect, Line, G } from 'react-native-svg';
import { IOSColors, IOSTypography } from '../../theme/ios';
import { IOSIcon } from './IOSIcon';

export interface ObservationWaypoint {
  id: string;
  species: 'cat' | 'dog' | 'unknown';
  distance_from_path_m: number;
  latitude: number;
  longitude: number;
}

interface TransectPathViewProps {
  currentLat: number;
  currentLon: number;
  gpsAccuracyM: number;
  altitudeM?: number;
  distanceKm: number;
  waypoints?: ObservationWaypoint[];
  routePathCoordinates?: [number, number][]; // [lon, lat]
}

export const TransectPathView: React.FC<TransectPathViewProps> = ({
  currentLat,
  currentLon,
  gpsAccuracyM = 3.5,
  altitudeM = 14,
  distanceKm = 0.85,
  waypoints = [],
  routePathCoordinates,
}) => {
  const { t } = useTranslation();
  // SVG Canvas dimensions for map track
  const svgWidth = 330;
  const svgHeight = 160;

  // Visual path simulation coordinates using standard SVG Path d
  const simulatedPathD = 'M 30 130 L 70 110 L 120 115 L 170 75 L 220 60 L 270 40 L 300 35';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <IOSIcon name="map" size={16} color={IOSColors.systemTeal} />
          <Text style={styles.headerTitle}>{t('ui_transectPathView.transect_track')}</Text>
        </View>
        <View style={styles.liveBeacon}>
          <Text style={styles.liveText}>
            {t('ui_transectPathView.km', { v0: distanceKm.toFixed(2) })}
          </Text>
        </View>
      </View>

      {/* Visual Transect Path Map Canvas */}
      <View style={styles.canvasWrapper}>
        <Svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          {/* Subtle Grid Lines */}
          <Line
            x1="0"
            y1="40"
            x2={svgWidth}
            y2="40"
            stroke="rgba(0,0,0,0.05)"
            strokeDasharray="4 4"
          />
          <Line
            x1="0"
            y1="80"
            x2={svgWidth}
            y2="80"
            stroke="rgba(0,0,0,0.05)"
            strokeDasharray="4 4"
          />
          <Line
            x1="0"
            y1="120"
            x2={svgWidth}
            y2="120"
            stroke="rgba(0,0,0,0.05)"
            strokeDasharray="4 4"
          />
          <Line
            x1="80"
            y1="0"
            x2="80"
            y2={svgHeight}
            stroke="rgba(0,0,0,0.05)"
            strokeDasharray="4 4"
          />
          <Line
            x1="160"
            y1="0"
            x2="160"
            y2={svgHeight}
            stroke="rgba(0,0,0,0.05)"
            strokeDasharray="4 4"
          />
          <Line
            x1="240"
            y1="0"
            x2="240"
            y2={svgHeight}
            stroke="rgba(0,0,0,0.05)"
            strokeDasharray="4 4"
          />

          {/* Planned / Traversed Search Path (Teal line) */}
          <Path
            d={simulatedPathD}
            fill="none"
            stroke={IOSColors.systemTeal}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* GPS Search Strip Buffer Zone (Distance Sampling Width 2w) */}
          <Path
            d={simulatedPathD}
            fill="none"
            stroke="rgba(48, 176, 199, 0.12)"
            strokeWidth={24}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Start Point Marker */}
          <Circle cx="30" cy="130" r="5" fill="#34C759" />
          <Circle cx="30" cy="130" r="8" fill="none" stroke="#34C759" strokeWidth={1.5} />

          {/* Plotted Observation Waypoints along Transect */}
          {waypoints.map((wp, idx) => {
            // Plot points along simulated path
            const x = 70 + ((idx * 55) % 200);
            const y = 110 - ((idx * 25) % 80);
            const isCat = wp.species === 'cat';
            return (
              <G key={wp.id || idx}>
                <Line
                  x1={x}
                  y1={y}
                  x2={x}
                  y2={y - 12}
                  stroke="#3C3C43"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
                <Circle
                  cx={x}
                  cy={y - 14}
                  r="8"
                  fill={isCat ? IOSColors.systemTeal : IOSColors.systemOrange}
                />
                <Circle cx={x} cy={y} r="3" fill="#000" />
              </G>
            );
          })}

          {/* Current Live Surveyor Position */}
          <Circle cx="300" cy="35" r="14" fill="rgba(0, 122, 255, 0.2)" />
          <Circle cx="300" cy="35" r="7" fill={IOSColors.systemBlue} />
          <Circle cx="300" cy="35" r="2" fill="#FFFFFF" />
        </Svg>

        {/* Floating Path Legend */}
        <View style={styles.legendOverlay}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
            <Text style={styles.legendText}>{t('ui_transectPathView.start')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: IOSColors.systemBlue }]} />
            <Text style={styles.legendText}>{t('ui_transectPathView.current')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: IOSColors.systemTeal }]} />
            <Text style={styles.legendText}>{t('ui_transectPathView.cat')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: IOSColors.systemOrange }]} />
            <Text style={styles.legendText}>{t('ui_transectPathView.dog')}</Text>
          </View>
        </View>
      </View>

      {/* High-Accuracy Telemetry Bar */}
      <View style={styles.telemetryBar}>
        <View style={styles.telemetryCol}>
          <Text style={styles.telemetryLabel}>{t('ui_transectPathView.latitude')}</Text>
          <Text style={styles.telemetryValue}>{currentLat.toFixed(6)}° N</Text>
        </View>
        <View style={styles.telemetryDivider} />
        <View style={styles.telemetryCol}>
          <Text style={styles.telemetryLabel}>{t('ui_transectPathView.longitude')}</Text>
          <Text style={styles.telemetryValue}>{currentLon.toFixed(6)}° E</Text>
        </View>
        <View style={styles.telemetryDivider} />
        <View style={styles.telemetryCol}>
          <Text style={styles.telemetryLabel}>{t('ui_transectPathView.accuracy')}</Text>
          <Text style={styles.telemetryValue}>±{gpsAccuracyM.toFixed(1)} m</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.15)',
    marginHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOSColors.separator,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    ...IOSTypography.caption1,
    fontWeight: '700',
    color: IOSColors.secondaryLabel,
    letterSpacing: 0.5,
  },
  liveBeacon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IOSColors.systemGreen,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: IOSColors.systemGreen,
    letterSpacing: 0.5,
  },
  canvasWrapper: {
    backgroundColor: '#F8F9FA',
    position: 'relative',
    height: 160,
    justifyContent: 'center',
  },
  legendOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
  },
  telemetryBar: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
  },
  telemetryCol: {
    flex: 1,
    alignItems: 'center',
  },
  telemetryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: IOSColors.secondaryLabel,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  telemetryValue: {
    ...IOSTypography.caption1,
    fontWeight: '700',
    color: IOSColors.label,
    fontVariant: ['tabular-nums'],
  },
  telemetryDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: IOSColors.separator,
    alignSelf: 'center',
  },
});
