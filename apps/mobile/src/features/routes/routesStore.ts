/**
 * Predefined Fixed Transects & "Adopt a Route" Store
 * Hawem (حايم) Citizen-Science Platform
 *
 * Implements:
 * - Predefined standardized transects in Greater Tunis
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

export const INITIAL_FIXED_ROUTES: FixedRoute[] = [
  {
    id: 'route-medina-01',
    name: 'Tunis Médina - Bab Souika',
    nameAr: 'مدينة تونس - باب سويقة',
    zone: 'Tunis Médina',
    distanceKm: 1.8,
    targetPaceKmH: 3.8,
    densityClassification: 'high',
    description: 'High-density historic medina alleys and vibrant market squares around Bab Souika and Halfaouine.',
    descriptionAr: 'أزقة المدينة العتيقة وأسواق باب سويقة والحلفاوين ذات الكثافة الحيوانية العالية.',
    waypoints: [
      [36.8048, 10.1668],
      [36.8062, 10.1691],
      [36.8075, 10.1712],
      [36.8090, 10.1735],
      [36.8105, 10.1748],
    ],
    isAdopted: true,
    timesSurveyed: 3,
    lastSurveyedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    bonusXp: 15,
  },
  {
    id: 'route-bourguiba-02',
    name: 'Avenue Habib Bourguiba - TGM',
    nameAr: 'شارع الحبيب بورقيبة - التي جي إم',
    zone: 'Tunis Centre',
    distanceKm: 1.5,
    targetPaceKmH: 4.2,
    densityClassification: 'medium',
    description: 'Central pedestrian tree-lined promenade from Place 14 Janvier clock tower to Tunis Marine.',
    descriptionAr: 'الممشى المركزي بشارع بورقيبة من ساحة 14 جانفي حتى محطة تونس البحرية.',
    waypoints: [
      [36.8005, 10.1798],
      [36.8009, 10.1834],
      [36.8012, 10.1876],
      [36.8015, 10.1920],
    ],
    isAdopted: false,
    timesSurveyed: 1,
    lastSurveyedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    bonusXp: 15,
  },
  {
    id: 'route-carthage-03',
    name: 'Carthage Byrsa - Salammbô',
    nameAr: 'قرطاج بيرصا - صلامبو',
    zone: 'Carthage',
    distanceKm: 2.4,
    targetPaceKmH: 4.0,
    densityClassification: 'medium',
    description: 'Suburban archaeological perimeter connecting Byrsa Hill to the Punic Port lagoons.',
    descriptionAr: 'المحيط الأثري الذي يربط هضبة بيرصا بالموانئ البونية بصلامبو.',
    waypoints: [
      [36.8532, 10.3230],
      [36.8505, 10.3242],
      [36.8468, 10.3235],
      [36.8425, 10.3221],
    ],
    isAdopted: false,
    timesSurveyed: 0,
    lastSurveyedAt: null,
    bonusXp: 15,
  },
  {
    id: 'route-marsa-04',
    name: 'La Marsa Corniche - Saf-Saf',
    nameAr: 'كورنيش المرسى - الصفصاف',
    zone: 'La Marsa',
    distanceKm: 2.1,
    targetPaceKmH: 4.0,
    densityClassification: 'high',
    description: 'Coastal pedestrian route starting at Place Saf-Saf, extending along Marsa Plage corniche.',
    descriptionAr: 'المسار الساحلي انطلاقاً من ساحة الصفصاف بمحاذاة شاطئ المرسى.',
    waypoints: [
      [36.8778, 10.3235],
      [36.8815, 10.3255],
      [36.8860, 10.3270],
      [36.8912, 10.3288],
    ],
    isAdopted: false,
    timesSurveyed: 2,
    lastSurveyedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    bonusXp: 15,
  },
  {
    id: 'route-lac2-05',
    name: 'Les Berges du Lac 2 - Promenade',
    nameAr: 'ضفاف البحيرة 2 - الممشى',
    zone: 'Les Berges du Lac',
    distanceKm: 2.8,
    targetPaceKmH: 4.5,
    densityClassification: 'low',
    description: 'Modern lakeside boardwalk with high visibility and standardized transect markers.',
    descriptionAr: 'الممشى المائي العصري على ضفاف بحيرة تونس 2 ذو الرؤية المفتوحة.',
    waypoints: [
      [36.8372, 10.2515],
      [36.8415, 10.2580],
      [36.8450, 10.2645],
      [36.8492, 10.2725],
    ],
    isAdopted: false,
    timesSurveyed: 0,
    lastSurveyedAt: null,
    bonusXp: 15,
  },
];

interface RoutesState {
  routes: FixedRoute[];
  loadRoutes: () => Promise<void>;
  toggleAdoptRoute: (routeId: string) => void;
  recordSurveyCompletion: (routeId: string) => void;
  getRouteById: (routeId: string) => FixedRoute | undefined;
  checkOffRoute: (lat: number, lon: number, routeId: string) => { isOffRoute: boolean; distanceM: number };
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
          set({ routes: parsed });
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

    const updated = routes.map((r) =>
      r.id === routeId ? { ...r, isAdopted: !r.isAdopted } : r
    );
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
