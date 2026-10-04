/**
 * Shared contract for both map renderers (TECHNICAL_REVIEW.md §5.2 "MapSurface"):
 * the MapLibre native view (development/production builds) and the WebView
 * fallback (Expo Go). Screens depend on these types and <InteractiveMap/> only.
 */
import type { DimensionValue } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { directionChevrons, isLoop, type DirectionRule } from '../../features/routes/routeGuidance';

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
  /**
   * The corridor's walking rule. When set, the start (green) and end (dark)
   * points are drawn, and for one-way routes chevrons point the direction.
   */
  routeDirection?: DirectionRule | null;
  /** Further lines: observer-to-animal bearing, an animal's movement path */
  extraLines?: MapLine[];
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

export interface MapLine {
  id: string;
  coords: [number, number][]; // [lat, lon]
  color: string;
  width?: number;
  dashed?: boolean;
}

export const ROUTE_START_COLOR = '#2F7A2B';
export const ROUTE_END_COLOR = '#16181D';
const CHEVRON_COLOR = '#0284C7';

type GJ = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

/**
 * Shared by both renderers: chevrons and extra lines as one line collection
 * (properties carry colour, width and dash), start/end as points. [lon, lat].
 */
export function routeExtrasGeoJSON(
  corridor: [number, number][],
  direction: DirectionRule | null | undefined,
  extra: MapLine[] = []
): { lines: GJ; ends: GJ } {
  const flip = (c: [number, number][]) => c.map(([lat, lon]) => [lon, lat]);
  const lineFeatures: GJ['features'] = extra
    .filter((l) => l.coords.length >= 2)
    .map((l) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: flip(l.coords) },
      properties: { kind: 'extra', color: l.color, width: l.width ?? 2, dashed: l.dashed ? 1 : 0 },
    }));
  const endFeatures: GJ['features'] = [];
  if (direction && corridor.length >= 2) {
    if (direction === 'as_drawn')
      for (const ch of directionChevrons(corridor))
        lineFeatures.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: flip(ch) },
          properties: { kind: 'chevron', color: CHEVRON_COLOR, width: 3, dashed: 0 },
        });
    const [sLat, sLon] = corridor[0];
    endFeatures.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [sLon, sLat] },
      properties: { kind: 'start', color: ROUTE_START_COLOR },
    });
    if (!isLoop(corridor)) {
      const [eLat, eLon] = corridor[corridor.length - 1];
      endFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [eLon, eLat] },
        properties: { kind: 'end', color: ROUTE_END_COLOR },
      });
    }
  }
  return {
    lines: { type: 'FeatureCollection', features: lineFeatures },
    ends: { type: 'FeatureCollection', features: endFeatures },
  };
}
