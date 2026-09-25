/**
 * Persistent Cat Colonies & Feeding Stations Store
 * Hawem (حايم) Citizen-Science Platform
 *
 * Implements:
 * - Persistent urban feline colonies & managed feeding points
 * - TNR (Trap-Neuter-Return) sterilization rate tracking
 * - Caretaker inspection logging with gamified XP & colony_keeper badge
 * - PostGIS spatial coordinates for municipal welfare mapping
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGamificationStore } from '../gamification/gamificationStore';

export interface CatColony {
  id: string;
  name: string;
  nameAr: string;
  zone: string;
  latitude: number;
  longitude: number;
  estimatedPopulation: number;
  tnrSterilizedCount: number;
  caretakerName: string;
  feedingSchedule: string;
  feedingScheduleAr: string;
  hasWaterStation: boolean;
  hasShelter: boolean;
  lastInspectedAt: string;
  inspectionsCount: number;
  notes?: string;
}

export const INITIAL_COLONIES: CatColony[] = [
  {
    id: 'colony-bab-bhar',
    name: 'Colonie Bab Bhar - Porte de France',
    nameAr: 'مستعمرة باب بحر - باب فرنسا',
    zone: 'Tunis Centre',
    latitude: 36.7992,
    longitude: 10.1760,
    estimatedPopulation: 18,
    tnrSterilizedCount: 15,
    caretakerName: 'Si Moncef (Collectif Protection Animale)',
    feedingSchedule: 'Daily at 07:00 & 18:30',
    feedingScheduleAr: 'يومياً الساعة 07:00 و 18:30',
    hasWaterStation: true,
    hasShelter: true,
    lastInspectedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    inspectionsCount: 8,
    notes: 'Established colony around the arcades. High ear-tipping rate (83% sterilized).',
  },
  {
    id: 'colony-byrsa',
    name: 'Station Byrsa Amphithéâtre',
    nameAr: 'محطة مسرح بيرصا الأثري',
    zone: 'Carthage',
    latitude: 36.8528,
    longitude: 10.3235,
    estimatedPopulation: 12,
    tnrSterilizedCount: 11,
    caretakerName: 'Leila B.',
    feedingSchedule: 'Daily at 08:00 & 17:00',
    feedingScheduleAr: 'يومياً الساعة 08:00 و 17:00',
    hasWaterStation: true,
    hasShelter: true,
    lastInspectedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    inspectionsCount: 14,
    notes: 'Protected pine shelter. 92% TNR rate. Stable population.',
  },
  {
    id: 'colony-sidibou',
    name: 'Colonie Corniche Sidi Bou Said',
    nameAr: 'مستعمرة كورنيش سيدي بوسعيد',
    zone: 'Sidi Bou Said',
    latitude: 36.8712,
    longitude: 10.3421,
    estimatedPopulation: 22,
    tnrSterilizedCount: 16,
    caretakerName: 'Khaled & Club Marina',
    feedingSchedule: 'Daily at 19:00',
    feedingScheduleAr: 'يومياً الساعة 19:00',
    hasWaterStation: true,
    hasShelter: false,
    lastInspectedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    inspectionsCount: 6,
    notes: 'Marina promenade cats. TNR campaign in progress with local vet clinics.',
  },
  {
    id: 'colony-belvedere',
    name: 'Station Parc Belvédère',
    nameAr: 'محطة حديقة البلفيدير',
    zone: 'Tunis Belvédère',
    latitude: 36.8214,
    longitude: 10.1712,
    estimatedPopulation: 14,
    tnrSterilizedCount: 11,
    caretakerName: 'Amine M.',
    feedingSchedule: 'Daily at 07:30',
    feedingScheduleAr: 'يومياً الساعة 07:30',
    hasWaterStation: true,
    hasShelter: true,
    lastInspectedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    inspectionsCount: 11,
    notes: 'North pavilion trees. Dedicated wooden feeding box installed.',
  },
  {
    id: 'colony-bab-el-khadra',
    name: 'Colonie Bab El Khadra',
    nameAr: 'مستعمرة باب الخضراء',
    zone: 'Tunis Médina',
    latitude: 36.8091,
    longitude: 10.1738,
    estimatedPopulation: 10,
    tnrSterilizedCount: 6,
    caretakerName: 'Khadija T.',
    feedingSchedule: 'Daily at 18:00',
    feedingScheduleAr: 'يومياً الساعة 18:00',
    hasWaterStation: false,
    hasShelter: false,
    lastInspectedAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    inspectionsCount: 4,
    notes: 'Needs water station installation and welfare sterilization drive.',
  },
];

interface ColoniesState {
  colonies: CatColony[];
  layerVisible: boolean;
  loadColonies: () => Promise<void>;
  toggleLayer: () => void;
  setLayerVisible: (visible: boolean) => void;
  recordInspection: (id: string, notes?: string) => void;
  addColony: (colony: Omit<CatColony, 'id' | 'inspectionsCount' | 'lastInspectedAt'>) => void;
  getColonyById: (id: string) => CatColony | undefined;
}

const STORAGE_KEY = 'hawem_cat_colonies_v1';

export const useColoniesStore = create<ColoniesState>((set, get) => ({
  colonies: INITIAL_COLONIES,
  layerVisible: true,

  loadColonies: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        set({ colonies: JSON.parse(stored) });
      }
    } catch (e) {
      console.warn('Error loading colonies:', e);
    }
  },

  toggleLayer: () => {
    set((state) => ({ layerVisible: !state.layerVisible }));
  },

  setLayerVisible: (layerVisible: boolean) => {
    set({ layerVisible });
  },

  recordInspection: (id: string, notes?: string) => {
    const { colonies } = get();
    const now = new Date().toISOString();

    const updated = colonies.map((c) => {
      if (c.id === id) {
        return {
          ...c,
          inspectionsCount: c.inspectionsCount + 1,
          lastInspectedAt: now,
          notes: notes ? `${c.notes || ''}\n[${now.slice(0, 10)}] ${notes}` : c.notes,
        };
      }
      return c;
    });

    set({ colonies: updated });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});

    // Award +10 XP in gamification store and unlock colony_keeper badge
    useGamificationStore.getState().awardXp(10, 'Colony Welfare Inspection Completed');
    useGamificationStore.getState().unlockBadge('colony_keeper');
  },

  addColony: (newColonyData) => {
    const { colonies } = get();
    const newColony: CatColony = {
      ...newColonyData,
      id: `colony-${Date.now()}`,
      inspectionsCount: 1,
      lastInspectedAt: new Date().toISOString(),
    };

    const updated = [newColony, ...colonies];
    set({ colonies: updated });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});

    useGamificationStore.getState().awardXp(20, 'Registered New Cat Colony');
    useGamificationStore.getState().unlockBadge('colony_keeper');
  },

  getColonyById: (id: string) => {
    return get().colonies.find((c) => c.id === id);
  },
}));
