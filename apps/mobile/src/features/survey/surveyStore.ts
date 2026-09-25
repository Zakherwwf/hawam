/**
 * Survey & TrackRecorder State Machine (Zustand Store)
 * Hawem (حايم) Citizen-Science Platform
 *
 * Implements:
 * - State machine: idle -> acquiring_fix -> recording <-> paused -> finishing -> finished
 * - High-precision telemetry: elapsed time, distance in km, search pace (KM/H), detections count
 * - In-survey observations CRUD
 * - eBird Complete Checklist non-detection confirmation
 */

import { create } from 'zustand';
import { SurveyProtocol, Species } from '@tunisia-survey/shared';
import { computeAnimalLocation, simplifyGpsTrack } from '../../services/georef/geoUtils';

export type SurveyStatus =
  | 'idle'
  | 'acquiring_fix'
  | 'recording'
  | 'paused'
  | 'finishing'
  | 'finished'
  | 'recovered';

export interface InSurveyDetection {
  id: string;
  species: Species;
  group_size: number;
  observed_at: string;
  observer_lat: number;
  observer_lon: number;
  animal_lat: number;
  animal_lon: number;
  bearing_deg?: number;
  distance_estimate_m: number;
  perpendicular_distance_m?: number;
  h3_res9: string;
  body_condition_score?: number;
  notes?: string;
  photoUri?: string | null;
  is_welfare_alert?: boolean;
}

interface SurveyState {
  status: SurveyStatus;
  protocol: SurveyProtocol;
  selectedRouteId: string | null;
  elapsedSeconds: number;
  distanceMeters: number;
  activeTrack: [number, number][];
  currentLocation: {
    lat: number;
    lon: number;
    accuracy: number;
    heading?: number;
  } | null;
  detections: InSurveyDetection[];
  completeChecklist: boolean;
  batteryWarningShown: boolean;

  // Actions
  startSurvey: (protocol: SurveyProtocol, routeId?: string | null) => void;
  setFixAcquired: () => void;
  pauseSurvey: () => void;
  resumeSurvey: () => void;
  updateLocation: (lat: number, lon: number, accuracy: number, heading?: number) => void;
  addTrackPoint: (lat: number, lon: number) => void;
  tickTimer: () => void;
  logDetection: (params: {
    species: Species;
    group_size: number;
    distance_estimate_m: number;
    bearing_deg?: number;
    body_condition_score?: number;
    notes?: string;
    photoUri?: string | null;
    is_welfare_alert?: boolean;
  }) => InSurveyDetection;
  updateDetection: (detection: InSurveyDetection) => void;
  deleteDetection: (id: string) => void;
  setCompleteChecklist: (complete: boolean) => void;
  finishSurvey: () => {
    durationMinutes: number;
    distanceKm: number;
    detectionsCount: number;
    completeChecklist: boolean;
    simplifiedTrack: [number, number][];
  };
  resetSurvey: () => void;
}

export const useSurveyStore = create<SurveyState>((set, get) => ({
  status: 'idle',
  protocol: 'transect',
  selectedRouteId: null,
  elapsedSeconds: 0,
  distanceMeters: 0,
  activeTrack: [],
  currentLocation: null,
  detections: [],
  completeChecklist: true,
  batteryWarningShown: false,

  startSurvey: (protocol, routeId = null) => {
    set({
      status: 'acquiring_fix',
      protocol,
      selectedRouteId: routeId,
      elapsedSeconds: 0,
      distanceMeters: 0,
      activeTrack: [],
      detections: [],
      completeChecklist: true,
    });
  },

  setFixAcquired: () => {
    const { status } = get();
    if (status === 'acquiring_fix') {
      set({ status: 'recording' });
    }
  },

  pauseSurvey: () => {
    const { status } = get();
    if (status === 'recording') {
      set({ status: 'paused' });
    }
  },

  resumeSurvey: () => {
    const { status } = get();
    if (status === 'paused') {
      set({ status: 'recording' });
    }
  },

  updateLocation: (lat, lon, accuracy, heading) => {
    set({ currentLocation: { lat, lon, accuracy, heading } });
    const { status } = get();
    if (status === 'acquiring_fix' && accuracy < 30) {
      set({ status: 'recording' });
    }
  },

  addTrackPoint: (lat, lon) => {
    const { status, activeTrack, distanceMeters } = get();
    if (status !== 'recording') return;

    let deltaM = 0;
    if (activeTrack.length > 0) {
      const [lastLat, lastLon] = activeTrack[activeTrack.length - 1];
      // Haversine approximate distance
      const R = 6371000;
      const dLat = ((lat - lastLat) * Math.PI) / 180;
      const dLon = ((lon - lastLon) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lastLat * Math.PI) / 180) *
          Math.cos((lat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      deltaM = R * c;
    }

    set({
      activeTrack: [...activeTrack, [lat, lon]],
      distanceMeters: distanceMeters + deltaM,
    });
  },

  tickTimer: () => {
    const { status, elapsedSeconds } = get();
    if (status === 'recording') {
      set({ elapsedSeconds: elapsedSeconds + 1 });
    }
  },

  logDetection: ({
    species,
    group_size,
    distance_estimate_m,
    bearing_deg,
    body_condition_score = 3,
    notes = '',
    photoUri = null,
    is_welfare_alert = false,
  }) => {
    const { currentLocation, activeTrack, detections } = get();
    const obsLat = currentLocation?.lat || 36.8065;
    const obsLon = currentLocation?.lon || 10.1815;
    const bearing = bearing_deg ?? (currentLocation?.heading || 0);

    const geoResult = computeAnimalLocation(
      obsLat,
      obsLon,
      distance_estimate_m,
      bearing,
      activeTrack
    );

    const newDetection: InSurveyDetection = {
      id: `det-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      species,
      group_size,
      observed_at: new Date().toISOString(),
      observer_lat: obsLat,
      observer_lon: obsLon,
      animal_lat: geoResult.animalLat,
      animal_lon: geoResult.animalLon,
      bearing_deg: bearing,
      distance_estimate_m,
      perpendicular_distance_m: geoResult.perpendicularDistanceM,
      h3_res9: geoResult.h3Res9,
      body_condition_score,
      notes,
      photoUri,
      is_welfare_alert,
    };

    set({ detections: [newDetection, ...detections] });
    return newDetection;
  },

  updateDetection: (updated) => {
    const { detections } = get();
    set({
      detections: detections.map((d) => (d.id === updated.id ? updated : d)),
    });
  },

  deleteDetection: (id) => {
    const { detections } = get();
    set({ detections: detections.filter((d) => d.id !== id) });
  },

  setCompleteChecklist: (completeChecklist) => {
    set({ completeChecklist });
  },

  finishSurvey: () => {
    const { elapsedSeconds, distanceMeters, detections, completeChecklist, activeTrack } = get();
    const durationMinutes = parseFloat((elapsedSeconds / 60).toFixed(2));
    const distanceKm = parseFloat((distanceMeters / 1000).toFixed(3));
    const simplifiedTrack = simplifyGpsTrack(activeTrack, 4.0);

    set({ status: 'finished' });

    return {
      durationMinutes,
      distanceKm,
      detectionsCount: detections.length,
      completeChecklist,
      simplifiedTrack,
    };
  },

  resetSurvey: () => {
    set({
      status: 'idle',
      elapsedSeconds: 0,
      distanceMeters: 0,
      activeTrack: [],
      detections: [],
      completeChecklist: true,
    });
  },
}));
