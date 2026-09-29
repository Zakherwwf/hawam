/**
 * Map entry point for screens. Picks the renderer once per app run:
 *  - MapLibre native view in development and production builds
 *  - WebView renderer in Expo Go, which cannot load the MapLibre native module
 * EXPO_PUBLIC_MAP_RENDERER=webview forces the WebView renderer everywhere
 * (e.g. to compare the two during rollout).
 */
import React from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { InteractiveMapView } from './InteractiveMapView';
import type { InteractiveMapViewProps } from './mapTypes';

const useNative =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient &&
  process.env.EXPO_PUBLIC_MAP_RENDERER !== 'webview';

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
} from './mapTypes';
