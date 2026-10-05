/**
 * Colonies and feeding points, shared with every volunteer.
 *
 * Saved on the phone first (works offline), then synced: new colonies are
 * inserted into public.colonies, visits into public.colony_visits, and the
 * shared list comes back from the colonies_app view. XP is not awarded here;
 * it is the server's (CLAUDE.md 2).
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateUUID } from '../../utils/uuid.ts';

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
  createdBy?: string;
  /** False until the server has it */
  synced?: boolean;
}

export interface PendingVisit {
  id: string;
  colonyId: string;
  visitedAt: string;
  tags: string[];
  notes?: string;
}

/** What the store needs from the network; injected so the store stays testable. */
export interface ColonyApi {
  userId: string;
  push: (c: CatColony) => Promise<boolean>;
  pushVisit: (v: PendingVisit) => Promise<boolean>;
  pull: () => Promise<CatColony[] | null>;
}

export const INITIAL_COLONIES: CatColony[] = [];

interface ColoniesState {
  colonies: CatColony[];
  pendingVisits: PendingVisit[];
  layerVisible: boolean;
  loadColonies: () => Promise<void>;
  toggleLayer: () => void;
  setLayerVisible: (visible: boolean) => void;
  recordInspection: (id: string, notes?: string, tags?: string[]) => void;
  addColony: (
    colony: Omit<CatColony, 'id' | 'inspectionsCount' | 'lastInspectedAt' | 'synced'>
  ) => CatColony;
  getColonyById: (id: string) => CatColony | undefined;
  syncWithServer: (api: ColonyApi) => Promise<void>;
}

const STORAGE_KEY = 'hawem_colonies_v2';
const LEGACY_KEY = 'hawem_cat_colonies_v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function persist(colonies: CatColony[], pendingVisits: PendingVisit[]) {
  if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ colonies, pendingVisits })).catch(() => {});
  }
}

export const useColoniesStore = create<ColoniesState>((set, get) => ({
  colonies: INITIAL_COLONIES,
  pendingVisits: [],
  layerVisible: true,

  loadColonies: async () => {
    try {
      if (!AsyncStorage || typeof AsyncStorage.getItem !== 'function') return;
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        set({ colonies: parsed.colonies ?? [], pendingVisits: parsed.pendingVisits ?? [] });
        return;
      }
      // Earlier builds kept colonies here with non-UUID ids ("colony-<time>");
      // they get a UUID once so the server can store them
      const legacy = await AsyncStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const old = JSON.parse(legacy) as CatColony[];
        const colonies = old.map((c) => ({
          ...c,
          id: UUID.test(c.id) ? c.id : generateUUID(),
          synced: false,
        }));
        set({ colonies });
        persist(colonies, []);
      }
    } catch (e) {
      console.warn('Error loading colonies:', e);
    }
  },

  toggleLayer: () => set((state) => ({ layerVisible: !state.layerVisible })),
  setLayerVisible: (layerVisible: boolean) => set({ layerVisible }),

  recordInspection: (id, notes, tags = []) => {
    const now = new Date().toISOString();
    const colonies = get().colonies.map((c) =>
      c.id === id ? { ...c, inspectionsCount: c.inspectionsCount + 1, lastInspectedAt: now } : c
    );
    const visit: PendingVisit = { id: generateUUID(), colonyId: id, visitedAt: now, tags, notes };
    const pendingVisits = [...get().pendingVisits, visit];
    set({ colonies, pendingVisits });
    persist(colonies, pendingVisits);
  },

  addColony: (data) => {
    const colony: CatColony = {
      ...data,
      id: generateUUID(),
      inspectionsCount: 0,
      lastInspectedAt: new Date().toISOString(),
      synced: false,
    };
    const colonies = [colony, ...get().colonies];
    set({ colonies });
    persist(colonies, get().pendingVisits);
    return colony;
  },

  getColonyById: (id) => get().colonies.find((c) => c.id === id),

  syncWithServer: async (api) => {
    // 1. Push colonies the server does not have yet
    for (const c of get().colonies.filter((x) => !x.synced)) {
      if (await api.push(c)) {
        const colonies = get().colonies.map((x) =>
          x.id === c.id ? { ...x, synced: true, createdBy: api.userId } : x
        );
        set({ colonies });
      }
    }
    // 2. Push visits, but only for colonies the server knows
    const known = new Set(
      get()
        .colonies.filter((c) => c.synced)
        .map((c) => c.id)
    );
    const remaining: PendingVisit[] = [];
    for (const v of get().pendingVisits) {
      if (!known.has(v.colonyId) || !(await api.pushVisit(v))) remaining.push(v);
    }
    // 3. Pull the shared list; keep local colonies not yet uploaded
    const server = await api.pull();
    const unsynced = get().colonies.filter((c) => !c.synced);
    const colonies = server
      ? [...unsynced, ...server.filter((s) => !unsynced.some((u) => u.id === s.id))]
      : get().colonies;
    set({ colonies, pendingVisits: remaining });
    persist(colonies, remaining);
  },
}));
