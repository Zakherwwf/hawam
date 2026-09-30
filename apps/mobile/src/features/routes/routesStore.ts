/**
 * Predefined Fixed Transects & "Adopt a Route" Store
 * Hawem (حايم) Citizen-Science Platform
 *
 * Implements:
 * - Fixed transects defined by surveyors
 * - "Adopt a Route" guardian stewardship for repeated monitoring
 * - Off-corridor deviation detection (> 50m) for survey protocol validity
 * - Repeat survey telemetry & XP multiplier
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateDistanceToRouteM } from '../../services/georef/geoUtils.ts';
import { useGamificationStore } from '../gamification/gamificationStore.ts';

export interface FixedRoute {
  id: string;
  name: string;
  nameAr: string;
  zone: string;
  distanceKm: number;
  targetPaceKmH: number;
  description: string;
  descriptionAr: string;
  waypoints: [number, number][]; // [lat, lon]
  densityClassification: 'high' | 'medium' | 'low';
  isAdopted: boolean;
  timesSurveyed: number;
  lastSurveyedAt: string | null;
  bonusXp: number;
}

// No routes ship with the app: routes are real places surveyors define.
// Earlier builds seeded five sample transects in one city and saved them to
// the phone; those ids are dropped when stored routes load.
export const INITIAL_FIXED_ROUTES: FixedRoute[] = [];
const RETIRED_SAMPLE_ROUTE_IDS = new Set([
  'route-medina-01',
  'route-bourguiba-02',
  'route-carthage-03',
  'route-marsa-04',
  'route-lac2-05',
]);

interface RoutesState {
  routes: FixedRoute[];
  loadRoutes: () => Promise<void>;
  toggleAdoptRoute: (routeId: string) => void;
  recordSurveyCompletion: (routeId: string) => void;
  getRouteById: (routeId: string) => FixedRoute | undefined;
  checkOffRoute: (
    lat: number,
    lon: number,
    routeId: string
  ) => { isOffRoute: boolean; distanceM: number };
}

const STORAGE_KEY = 'hawem_fixed_routes_v1';

export const useRoutesStore = create<RoutesState>((set, get) => ({
  routes: INITIAL_FIXED_ROUTES,

  loadRoutes: async () => {
    try {
      if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            set({ routes: parsed.filter((r: FixedRoute) => !RETIRED_SAMPLE_ROUTE_IDS.has(r.id)) });
          }
        }
      }
    } catch (e) {
      console.warn('Error loading fixed routes:', e);
    }
  },

  toggleAdoptRoute: (routeId: string) => {
    const { routes } = get();
    const route = routes.find((r) => r.id === routeId);
    const becomingAdopted = route ? !route.isAdopted : false;

    const updated = routes.map((r) => (r.id === routeId ? { ...r, isAdopted: !r.isAdopted } : r));
    set({ routes: updated });
    if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
    }

    if (becomingAdopted) {
      useGamificationStore.getState().awardXp(30, 'Adopted a fixed transect');
    }
  },

  recordSurveyCompletion: (routeId: string) => {
    const { routes } = get();
    const now = new Date().toISOString();
    let updatedTimes = 0;

    const updated = routes.map((r) => {
      if (r.id === routeId) {
        updatedTimes = r.timesSurveyed + 1;
        return {
          ...r,
          timesSurveyed: updatedTimes,
          lastSurveyedAt: now,
        };
      }
      return r;
    });

    set({ routes: updated });
    if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
    }

    // Check if Surveyor unlocked the Route Guardian badge (5 surveys on fixed transect)
    if (updatedTimes >= 5) {
      useGamificationStore.getState().unlockBadge('route_guardian');
    }
  },

  getRouteById: (routeId: string) => {
    return get().routes.find((r) => r.id === routeId);
  },

  checkOffRoute: (lat: number, lon: number, routeId: string) => {
    const route = get().routes.find((r) => r.id === routeId);
    if (!route || !route.waypoints || route.waypoints.length < 2) {
      return { isOffRoute: false, distanceM: 0 };
    }

    const distM = calculateDistanceToRouteM(lat, lon, route.waypoints);
    const isOff = distM > 50.0; // 50m corridor threshold
    return { isOffRoute: isOff, distanceM: distM };
  },
}));
