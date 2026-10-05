/**
 * Map entry point for screens. Picks the renderer once per app run:
 *  - Mapbox GL JS in a WebView (default): globe projection and the
 *    Streets / Satellite / Outdoors switch
 *  - MapLibre native view, opt-in with EXPO_PUBLIC_MAP_RENDERER=maplibre in a
 *    development or production build. It scales to far larger observation
 *    sets, but MapLibre React Native 11 has no globe projection and the
 *    tokenless basemap has no satellite imagery, so it is not the default yet.
 * Expo Go always uses the WebView renderer: it cannot load the native module.
 */
import React from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { InteractiveMapView } from './InteractiveMapView';
import type { InteractiveMapViewProps } from './mapTypes';

const useNative =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient &&
  process.env.EXPO_PUBLIC_MAP_RENDERER === 'maplibre';

// Required lazily so Expo Go never evaluates the native module
const NativeMapView: React.FC<InteractiveMapViewProps> | null = useNative
  ? require('./NativeMapView').NativeMapView
  : null;

export const MAP_RENDERER: 'maplibre' | 'webview' = NativeMapView ? 'maplibre' : 'webview';

export const InteractiveMap: React.FC<InteractiveMapViewProps> = (props) =>
  NativeMapView ? <NativeMapView {...props} /> : <InteractiveMapView {...props} />;

export type {
  MapMarker,
  ColonyMarker,
  FocusCoordinate,
  TransectMarker,
  InteractiveMapViewProps,
  MapLine,
} from './mapTypes';
