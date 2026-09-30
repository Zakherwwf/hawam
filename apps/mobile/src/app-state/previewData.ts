/**
 * Sample data for design review in a browser (Expo web + Playwright).
 * Active only when __DEV__ and EXPO_PUBLIC_PREVIEW_MODE=1; release builds
 * (__DEV__ false) can never enter preview mode.
 */
import type { SightingItem } from './types';
import type { UserAccount } from './types';

export const PREVIEW_MODE =
  typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_PREVIEW_MODE === '1';

export const PREVIEW_ACCOUNT: UserAccount = {
  name: 'Yasmine Ben Salah',
  email: 'yasmine.bensalah@example.org',
  organization: 'Carthage Street Animal Watch',
  role: 'surveyor',
  governorate: 'Tunis',
  surveyorId: 'OBS-4F2A91',
  createdAt: '2026-08-14T09:12:00Z',
};

export const PREVIEW_STATS = { sessionsCompleted: 14, kmWalked: 23.7, animalsRecorded: 41 };

const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600_000).toISOString();

export const PREVIEW_SIGHTINGS: SightingItem[] = [
  {
    id: '6b1f2c7e-1d2a-4f11-9c1e-000000000001',
    species: 'cat',
    group_size: 3,
    latitude: 36.8021,
    longitude: 10.1797,
    observed_at: at(2),
    body_condition_score: 3,
    protocol: 'transect',
    distance_from_path_m: 4.2,
    notes: 'Colony by the fish market bins, two ear-tipped.',
    publicCode: 'CAT-000012',
    observer_name: 'Yasmine Ben Salah',
  },
  {
    id: '6b1f2c7e-1d2a-4f11-9c1e-000000000002',
    species: 'dog',
    group_size: 1,
    latitude: 36.8055,
    longitude: 10.1862,
    observed_at: at(5),
    body_condition_score: 2,
    protocol: 'incidental',
    notes: 'Limping on left foreleg.',
    publicCode: 'DOG-000011',
    observer_name: 'Yasmine Ben Salah',
  },
  {
    id: '6b1f2c7e-1d2a-4f11-9c1e-000000000003',
    species: 'cat',
    group_size: 1,
    latitude: 36.7989,
    longitude: 10.1744,
    observed_at: at(26),
    body_condition_score: 4,
    protocol: 'transect',
    distance_from_path_m: 11.5,
    publicCode: 'CAT-000009',
    observer_name: 'Mehdi Trabelsi',
  },
  {
    id: '6b1f2c7e-1d2a-4f11-9c1e-000000000004',
    species: 'dog',
    group_size: 2,
    latitude: 36.8102,
    longitude: 10.1693,
    observed_at: at(49),
    body_condition_score: 3,
    protocol: 'stationary_point',
    publicCode: 'DOG-000007',
    observer_name: 'Ines Gharbi',
  },
  {
    id: '6b1f2c7e-1d2a-4f11-9c1e-000000000005',
    species: 'cat',
    group_size: 2,
    latitude: 36.8067,
    longitude: 10.1911,
    observed_at: at(0.3),
    body_condition_score: 3,
    protocol: 'incidental',
    syncPending: true,
    observer_name: 'Yasmine Ben Salah',
  },
];
