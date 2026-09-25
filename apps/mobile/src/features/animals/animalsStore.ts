/**
 * Known Animals & Resighting (Zustand Store)
 * Hawem (حايم) Citizen-Science Platform
 *
 * Implements:
 * - Known individual animal profiles with photo timeline
 * - Spatial candidate matching (find known animals within 300m of detection)
 * - Photographic Capture-Recapture / Mark-Resight linkage
 */

import { create } from 'zustand';
import { Species } from '@tunisia-survey/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AnimalProfile {
  id: string;
  species: Species;
  nickname: string;
  coat_pattern: string;
  primary_colour?: string;
  identifiability: 'high' | 'low';
  first_seen_at: string;
  last_seen_at: string;
  sightings_count: number;
  latitude: number;
  longitude: number;
  photos: {
    uri: string;
    angle: 'left_flank' | 'right_flank' | 'face' | 'other';
    taken_at: string;
  }[];
  ear_tipped: boolean;
  colony_name?: string;
}

export const SAMPLE_ANIMALS: AnimalProfile[] = [];

interface AnimalsState {
  animals: AnimalProfile[];

  // Actions
  loadAnimals: () => Promise<void>;
  findNearbyCandidates: (species: Species, lat: number, lon: number, radiusM?: number) => AnimalProfile[];
  addAnimal: (animal: AnimalProfile) => void;
  recordResighting: (animalId: string, sightingLat: number, sightingLon: number, photoUri?: string) => void;
}

export const useAnimalsStore = create<AnimalsState>((set, get) => ({
  animals: [],

  loadAnimals: async () => {
    try {
      const stored = await AsyncStorage.getItem('hawem_animals_v2');
      if (stored) {
        set({ animals: JSON.parse(stored) });
      }
    } catch (e) {}
  },

  findNearbyCandidates: (species, lat, lon, radiusM = 400) => {
    const { animals } = get();
    return animals.filter((a) => {
      if (a.species !== species) return false;
      // Approximate distance calculation
      const dLat = (a.latitude - lat) * 111320;
      const dLon = (a.longitude - lon) * (111320 * Math.cos((lat * Math.PI) / 180));
      const dist = Math.sqrt(dLat * dLat + dLon * dLon);
      return dist <= radiusM;
    });
  },

  addAnimal: (newAnimal) => {
    const { animals } = get();
    const updated = [newAnimal, ...animals];
    set({ animals: updated });
    AsyncStorage.setItem('hawem_animals_v2', JSON.stringify(updated)).catch(() => {});
  },

  recordResighting: (animalId, sightingLat, sightingLon, photoUri) => {
    const { animals } = get();
    const updated = animals.map((a) => {
      if (a.id === animalId) {
        const photos = photoUri
          ? [{ uri: photoUri, angle: 'other' as const, taken_at: new Date().toISOString() }, ...a.photos]
          : a.photos;
        return {
          ...a,
          last_seen_at: new Date().toISOString(),
          sightings_count: a.sightings_count + 1,
          latitude: sightingLat,
          longitude: sightingLon,
          photos,
        };
      }
      return a;
    });
    set({ animals: updated });
    AsyncStorage.setItem('hawem_animals_v2', JSON.stringify(updated)).catch(() => {});
  },
}));
