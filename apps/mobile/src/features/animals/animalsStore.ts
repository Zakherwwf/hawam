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

export const SAMPLE_ANIMALS: AnimalProfile[] = [
  {
    id: 'ind-001',
    species: 'cat',
    nickname: 'Boussa Bab Souika',
    coat_pattern: 'tabby',
    primary_colour: 'Grey / Black striped',
    identifiability: 'high',
    first_seen_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    last_seen_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    sightings_count: 4,
    latitude: 36.8028,
    longitude: 10.1695,
    photos: [
      {
        uri: 'file:///photos/cat_flank_01.jpg',
        angle: 'left_flank',
        taken_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
    ],
    ear_tipped: true,
    colony_name: 'Bab Souika Bakery Colony',
  },
  {
    id: 'ind-002',
    species: 'dog',
    nickname: 'Rex Sidi Bou Said',
    coat_pattern: 'bicolour_piebald',
    primary_colour: 'Tan & White',
    identifiability: 'high',
    first_seen_at: new Date(Date.now() - 86400000 * 45).toISOString(),
    last_seen_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    sightings_count: 6,
    latitude: 36.8588,
    longitude: 10.1956,
    photos: [
      {
        uri: 'file:///photos/dog_flank_02.jpg',
        angle: 'left_flank',
        taken_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
    ],
    ear_tipped: false,
    colony_name: 'North Market Pack',
  },
  {
    id: 'ind-003',
    species: 'cat',
    nickname: 'Jasmin Carthage',
    coat_pattern: 'tortoiseshell_calico',
    primary_colour: 'Tricolor Calico',
    identifiability: 'high',
    first_seen_at: new Date(Date.now() - 86400000 * 15).toISOString(),
    last_seen_at: new Date(Date.now() - 86400000).toISOString(),
    sightings_count: 2,
    latitude: 36.8529,
    longitude: 10.3245,
    photos: [
      {
        uri: 'file:///photos/cat_calico_03.jpg',
        angle: 'face',
        taken_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    ear_tipped: true,
    colony_name: 'Byrsa Ruins Colony',
  },
];

interface AnimalsState {
  animals: AnimalProfile[];

  // Actions
  loadAnimals: () => Promise<void>;
  findNearbyCandidates: (species: Species, lat: number, lon: number, radiusM?: number) => AnimalProfile[];
  addAnimal: (animal: AnimalProfile) => void;
  recordResighting: (animalId: string, sightingLat: number, sightingLon: number, photoUri?: string) => void;
}

export const useAnimalsStore = create<AnimalsState>((set, get) => ({
  animals: SAMPLE_ANIMALS,

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
