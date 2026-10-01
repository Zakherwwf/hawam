/**
 * Shared contract for both map renderers (TECHNICAL_REVIEW.md §5.2 "MapSurface"):
 * the MapLibre native view (development/production builds) and the WebView
 * fallback (Expo Go). Screens depend on these types and <InteractiveMap/> only.
 */
import type { DimensionValue } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  species: 'cat' | 'dog' | 'unknown';
  title?: string;
  subtitle?: string;
  identifier?: string;
  label?: string;
  distance_from_path_m?: number;
}

export interface ColonyMarker {
  id: string;
  name: string;
  species?: 'cat' | 'dog' | 'mixed';
  latitude: number;
  longitude: number;
  estimatedPopulation: number;
  tnrPercent: number;
  hasWaterStation?: boolean;
  hasShelter?: boolean;
}

export interface FocusCoordinate {
  latitude: number;
  longitude: number;
  zoom?: number;
}

export interface TransectMarker {
  id: string;
  name: string;
  nameAr?: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  isAdopted: boolean;
  isSelected?: boolean;
}

export const CAMERA_STORAGE_KEY = 'hawem_map_camera_v1';
export const USER_LOCATION_ZOOM = 15;

export interface SavedCamera {
  latitude: number;
  longitude: number;
  zoom: number;
}

export async function loadSavedCamera(): Promise<SavedCamera | null> {
  try {
    const raw = await AsyncStorage.getItem(CAMERA_STORAGE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (
      Number.isFinite(c?.latitude) &&
      Math.abs(c.latitude) <= 90 &&
      Number.isFinite(c?.longitude) &&
      Math.abs(c.longitude) <= 180 &&
      Number.isFinite(c?.zoom)
    ) {
      return { latitude: c.latitude, longitude: c.longitude, zoom: c.zoom };
    }
  } catch {}
  return null;
}

export function saveCamera(camera: SavedCamera): void {
  AsyncStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(camera)).catch(() => {});
}

export interface InteractiveMapViewProps {
  initialLat?: number;
  initialLon?: number;
  initialZoom?: number;
  focusCoordinate?: FocusCoordinate | null;
  markers?: MapMarker[];
  colonyMarkers?: ColonyMarker[];
  transectMarkers?: TransectMarker[];
  trackCoordinates?: [number, number][]; // [lat, lon]
  routeCorridorCoordinates?: [number, number][]; // Planned transect corridor [lat, lon]
  showUserLocation?: boolean;
  onMarkerPress?: (markerId: string) => void;
  onColonyPress?: (colonyId: string) => void;
  onTransectPress?: (transectId: string) => void;
  height?: DimensionValue;
  /** Hide the renderer's own floating controls (the screen provides its own) */
  hideControls?: boolean;
  /** Base map style, when the screen controls it */
  mapStyle?: MapStyle;
}

export type MapStyle = 'streets' | 'satellite' | 'outdoors';
