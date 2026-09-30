/**
 * Native MapLibre renderer (TECHNICAL_REVIEW.md §5.2). Observations, colonies
 * and transects are GeoJSON sources drawn by style layers on the GPU, so the
 * map scales to tens of thousands of features with clustering and no
 * per-marker bridge traffic. Requires a development or production build; Expo
 * Go falls back to the WebView renderer (see InteractiveMap.tsx).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  UserLocation,
  type CameraRef,
  type GeoJSONSourceRef,
} from '@maplibre/maplibre-react-native';

import { IOSColors, IOSTypography } from '../../theme/ios';
import { IOSIcon } from '../ios';
import { MAP_STYLE_URL, WORLD_VIEW } from '../../config/map';
import {
  USER_LOCATION_ZOOM,
  loadSavedCamera,
  saveCamera,
  type InteractiveMapViewProps,
} from './mapTypes';

type Feature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
const collection = (features: Feature[]): GeoJSON.FeatureCollection => ({
  type: 'FeatureCollection',
  features,
});
const point = (lon: number, lat: number, properties: Record<string, unknown>): Feature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties,
});
// Props carry [lat, lon] pairs; GeoJSON wants [lon, lat]
const line = (coords: [number, number][]): GeoJSON.Feature => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: coords.map(([lat, lon]) => [lon, lat]) },
  properties: {},
});

// Same palette as the WebView pins
const SPECIES_COLOR = ['match', ['get', 'species'], 'cat', '#0284C7', 'dog', '#D97706', '#64748B'];

export const NativeMapView: React.FC<InteractiveMapViewProps> = ({
  initialLat,
  initialLon,
  initialZoom,
  focusCoordinate,
  markers = [],
  colonyMarkers = [],
  transectMarkers = [],
  trackCoordinates = [],
  routeCorridorCoordinates = [],
  showUserLocation = true,
  onMarkerPress,
  onColonyPress,
  onTransectPress,
  height = '100%',
  hideControls = false,
}) => {
  const { t } = useTranslation();
  const cameraRef = useRef<CameraRef>(null);
  const observationsRef = useRef<GeoJSONSourceRef>(null);
  const [showColonies, setShowColonies] = useState(true);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lon: number;
    acc: number;
  } | null>(null);

  const hasExplicitCenter = initialLat !== undefined && initialLon !== undefined;
  const viewportResolved = useRef(hasExplicitCenter || !!focusCoordinate);
  const [savedCameraChecked, setSavedCameraChecked] = useState(hasExplicitCenter);

  // Device location (same permission flow as the WebView renderer)
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 3 },
          (loc) =>
            setUserLocation({
              lat: loc.coords.latitude,
              lon: loc.coords.longitude,
              acc: loc.coords.accuracy || 5,
            })
        );
      } catch {
        // No fix: no user marker rather than a fabricated position
      }
    })();
    return () => sub?.remove();
  }, []);

  // Viewport: last camera, then device location, then the world view
  useEffect(() => {
    if (viewportResolved.current) return;
    let cancelled = false;
    loadSavedCamera().then((saved) => {
      if (cancelled) return;
      if (saved && !viewportResolved.current) {
        viewportResolved.current = true;
        cameraRef.current?.jumpTo({ center: [saved.longitude, saved.latitude], zoom: saved.zoom });
      }
      setSavedCameraChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!savedCameraChecked || viewportResolved.current || !userLocation) return;
    viewportResolved.current = true;
    cameraRef.current?.flyTo({
      center: [userLocation.lon, userLocation.lat],
      zoom: USER_LOCATION_ZOOM,
    });
  }, [savedCameraChecked, userLocation]);

  useEffect(() => {
    if (!focusCoordinate) return;
    cameraRef.current?.flyTo({
      center: [focusCoordinate.longitude, focusCoordinate.latitude],
      zoom: focusCoordinate.zoom || 16,
    });
  }, [focusCoordinate]);

  const observations = useMemo(
    () =>
      collection(
        markers.map((m, idx) =>
          point(m.longitude, m.latitude, {
            id: m.id,
            species: m.species,
            label:
              m.identifier ||
              m.label ||
              `${m.species === 'cat' ? 'CAT' : 'DOG'}-${String(idx + 1).padStart(3, '0')}`,
          })
        )
      ),
    [markers]
  );
  const colonies = useMemo(
    () =>
      collection(
        showColonies
          ? colonyMarkers.map((c) =>
              point(c.longitude, c.latitude, {
                id: c.id,
                name: c.name,
                species: c.species ?? 'cat',
              })
            )
          : []
      ),
    [colonyMarkers, showColonies]
  );
  const transects = useMemo(
    () =>
      collection(
        transectMarkers.map((tr) =>
          point(tr.longitude, tr.latitude, {
            id: tr.id,
            name: tr.name,
            adopted: tr.isAdopted,
            selected: !!tr.isSelected,
          })
        )
      ),
    [transectMarkers]
  );

  const initialViewState = hasExplicitCenter
    ? { center: [initialLon!, initialLat!] as [number, number], zoom: initialZoom ?? 16 }
    : { center: WORLD_VIEW.center, zoom: initialZoom ?? WORLD_VIEW.zoom };

  const firstId = (e: { nativeEvent: { features?: GeoJSON.Feature[] } }) =>
    e.nativeEvent.features?.[0]?.properties as Record<string, any> | undefined;

  return (
    <View style={[styles.container, { height }, hideControls && { borderRadius: 0 }]}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE_URL}
        attribution
        attributionPosition={{ bottom: 8, left: 8 }}
        logo={false}
        onRegionDidChange={(e) => {
          const { center, zoom, userInteraction } = e.nativeEvent;
          if (hasExplicitCenter) return;
          // A pan or zoom by the user settles the viewport; GPS must not yank it away
          if (userInteraction) viewportResolved.current = true;
          if (viewportResolved.current) {
            saveCamera({ longitude: center[0], latitude: center[1], zoom });
          }
        }}
      >
        <Camera ref={cameraRef} initialViewState={initialViewState} />

        {routeCorridorCoordinates.length >= 2 ? (
          <GeoJSONSource id="corridor" data={line(routeCorridorCoordinates)}>
            <Layer
              id="corridor-glow"
              type="line"
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{ 'line-color': '#06B6D4', 'line-width': 18, 'line-opacity': 0.2 }}
            />
            <Layer
              id="corridor-line"
              type="line"
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{
                'line-color': '#0284C7',
                'line-width': 3,
                'line-dasharray': [2, 2],
                'line-opacity': 0.9,
              }}
            />
          </GeoJSONSource>
        ) : null}

        {trackCoordinates.length >= 2 ? (
          <GeoJSONSource id="track" data={line(trackCoordinates)}>
            <Layer
              id="track-glow"
              type="line"
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{ 'line-color': '#0284C7', 'line-width': 8, 'line-opacity': 0.25 }}
            />
            <Layer
              id="track-line"
              type="line"
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{ 'line-color': '#0284C7', 'line-width': 4, 'line-opacity': 0.95 }}
            />
          </GeoJSONSource>
        ) : null}

        <GeoJSONSource
          id="transects"
          data={transects}
          onPress={(e) => {
            const p = firstId(e);
            if (p?.id) onTransectPress?.(String(p.id));
          }}
        >
          <Layer
            id="transect-points"
            type="circle"
            paint={{
              'circle-radius': 9,
              'circle-color': ['case', ['get', 'adopted'], '#0D9488', '#0284C7'],
              'circle-stroke-width': ['case', ['get', 'selected'], 3, 2],
              'circle-stroke-color': ['case', ['get', 'selected'], '#FDE047', '#FFFFFF'],
            }}
          />
        </GeoJSONSource>

        <GeoJSONSource
          id="colonies"
          data={colonies}
          onPress={(e) => {
            const p = firstId(e);
            if (p?.id) onColonyPress?.(String(p.id));
          }}
        >
          <Layer
            id="colony-points"
            type="circle"
            paint={{
              'circle-radius': 11,
              'circle-color': ['match', ['get', 'species'], 'dog', '#EA580C', '#7C3AED'],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#FFFFFF',
            }}
          />
          <Layer
            id="colony-labels"
            type="symbol"
            minzoom={13}
            layout={{
              'text-field': ['get', 'name'],
              'text-size': 11,
              'text-offset': [0, 1.5],
              'text-anchor': 'top',
            }}
            paint={{
              'text-color': '#0F172A',
              'text-halo-color': '#FFFFFF',
              'text-halo-width': 1.5,
            }}
          />
        </GeoJSONSource>

        <GeoJSONSource
          id="observations"
          ref={observationsRef}
          data={observations}
          cluster
          clusterRadius={40}
          clusterMaxZoom={15}
          onPress={async (e) => {
            const p = firstId(e);
            if (!p) return;
            if (p.cluster && typeof p.cluster_id === 'number') {
              const zoom = await observationsRef.current?.getClusterExpansionZoom(p.cluster_id);
              const coords = e.nativeEvent.lngLat;
              if (zoom !== undefined) cameraRef.current?.flyTo({ center: coords, zoom });
              return;
            }
            if (p.id) onMarkerPress?.(String(p.id));
          }}
        >
          <Layer
            id="observation-clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': '#0F172A',
              'circle-radius': ['step', ['get', 'point_count'], 16, 25, 22, 100, 28],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#FFFFFF',
            }}
          />
          <Layer
            id="observation-cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{ 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 }}
            paint={{ 'text-color': '#FFFFFF' }}
          />
          <Layer
            id="observation-points"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-radius': 8,
              'circle-color': SPECIES_COLOR as any,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#FFFFFF',
            }}
          />
          <Layer
            id="observation-labels"
            type="symbol"
            minzoom={15}
            filter={['!', ['has', 'point_count']]}
            layout={{
              'text-field': ['get', 'label'],
              'text-size': 10,
              'text-offset': [0, 1.4],
              'text-anchor': 'top',
            }}
            paint={{
              'text-color': '#0F172A',
              'text-halo-color': '#FFFFFF',
              'text-halo-width': 1.5,
            }}
          />
        </GeoJSONSource>

        {showUserLocation ? <UserLocation accuracy heading /> : null}
      </Map>

      {!hideControls ? (
        <View style={styles.floatingControls}>
          {colonyMarkers.length > 0 && (
            <TouchableOpacity
              style={[styles.controlPill, showColonies && styles.controlPillActive]}
              onPress={() => setShowColonies(!showColonies)}
              activeOpacity={0.7}
            >
              <IOSIcon name="shield" size={13} color={showColonies ? '#FFFFFF' : '#7C3AED'} />
              <Text style={[styles.controlPillText, showColonies && styles.controlPillTextActive]}>
                {t('ui_interactiveMapView.colonies', { v1: showColonies ? 'ON' : 'OFF' })}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.controlCircle}
            onPress={() => {
              if (userLocation) {
                cameraRef.current?.flyTo({
                  center: [userLocation.lon, userLocation.lat],
                  zoom: 16,
                });
              }
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('ui_interactiveMapView.center_on_me')}
          >
            <IOSIcon name="location" size={18} color={IOSColors.systemTeal} />
          </TouchableOpacity>
        </View>
      ) : null}

      {userLocation && !hideControls ? (
        <View style={styles.accuracyTag}>
          <View style={styles.pulseDot} />
          <Text style={styles.accuracyText}>
            {t('ui_interactiveMapView.gps_m_live', { v1: userLocation.acc.toFixed(1) })}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    overflow: 'hidden',
  },
  floatingControls: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'column',
    gap: 10,
    alignItems: 'flex-end',
  },
  controlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    minHeight: 44,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  controlPillActive: { backgroundColor: '#7C3AED' },
  controlPillText: { ...IOSTypography.caption1, fontWeight: '700', color: IOSColors.label },
  controlPillTextActive: { color: '#FFFFFF' },
  controlCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  accuracyTag: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  pulseDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981' },
  accuracyText: { ...IOSTypography.caption1, color: '#FFFFFF', fontWeight: '700' },
});
