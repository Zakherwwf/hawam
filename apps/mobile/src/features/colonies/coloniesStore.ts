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
import { useGamificationStore } from '../gamification/gamificationStore.ts';

export type ColonySpecies = 'cat' | 'dog' | 'mixed';

export interface CatColony {
  id: string;
  name: string;
  nameAr?: string;
  species: ColonySpecies;
  zone: string;
  latitude: number;
  longitude: number;
  estimatedPopulation: number;
  tnrSterilizedCount: number;
  caretakerName?: string;
  feedingSchedule?: string;
  feedingScheduleAr?: string;
  hasWaterStation: boolean;
  hasShelter: boolean;
  lastInspectedAt: string;
  inspectionsCount: number;
  notes?: string;
}

export const INITIAL_COLONIES: CatColony[] = [];

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
  colonies: [],
  layerVisible: true,

  loadColonies: async () => {
    try {
      if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          set({ colonies: JSON.parse(stored) });
        }
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
    const target = colonies.find((c) => c.id === id);

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
    if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
    }

    // Award +10 XP in gamification store and unlock colony_keeper badge
    const label = target?.species === 'dog' ? 'Dog Pack Welfare Inspection Logged' : 'Cat Colony Welfare Inspection Logged';
    useGamificationStore.getState().awardXp(10, label);
    useGamificationStore.getState().unlockBadge('colony_keeper');
  },

  addColony: (newColonyData) => {
    const { colonies } = get();
    const prefix = newColonyData.species === 'dog' ? 'pack' : 'colony';
    const newColony: CatColony = {
      ...newColonyData,
      id: `${prefix}-${Date.now()}`,
      inspectionsCount: 1,
      lastInspectedAt: new Date().toISOString(),
    };

    const updated = [newColony, ...colonies];
    set({ colonies: updated });
    if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
    }

    const label = newColonyData.species === 'dog' ? 'Registered New Dog Pack' : 'Registered New Cat Colony';
    useGamificationStore.getState().awardXp(20, label);
    useGamificationStore.getState().unlockBadge('colony_keeper');
  },

  getColonyById: (id: string) => {
    return get().colonies.find((c) => c.id === id);
  },
}));
