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
import { generateUUID } from '../../utils/uuid.ts';
import { storage } from '../../services/storageAdapter.ts';
import { localDb } from '../../db/localDb.ts';
import type { SurveyProtocol, Species } from '@tunisia-survey/shared';
import { computeAnimalLocation, simplifyGpsTrack } from '../../services/georef/geoUtils.ts';
import { generateScientificObservationCode } from '../../utils/scientificCodes.ts';

export type SurveyStatus =
  'idle' | 'acquiring_fix' | 'recording' | 'paused' | 'finishing' | 'finished' | 'recovered';

export interface InSurveyDetection {
  id: string;
  identifier?: string;
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
  photoUris?: string[];
  is_welfare_alert?: boolean;
  gps_accuracy_m?: number;
}

export interface RawTrackPoint {
  recorded_at: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number;
  speed_mps?: number;
}

interface SurveyState {
  sessionId: string | null;
  status: SurveyStatus;
  protocol: SurveyProtocol;
  selectedRouteId: string | null;
  startedAt: string | null;
  elapsedSeconds: number;
  movingTimeSeconds: number;
  distanceMeters: number;
  activeTrack: [number, number][];
  rawTrackPoints: RawTrackPoint[];
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
  addTrackPoint: (
    lat: number,
    lon: number,
    accuracy?: number,
    speed?: number,
    mocked?: boolean
  ) => void;
  tickTimer: () => void;
  logDetection: (params: {
    species: Species;
    identifier?: string;
    group_size?: number;
    distance_estimate_m?: number;
    bearing_deg?: number;
    body_condition_score?: number;
    notes?: string;
    photoUri?: string | null;
    photoUris?: string[];
    is_welfare_alert?: boolean;
    observer_lat?: number;
    observer_lon?: number;
    gps_accuracy_m?: number;
  }) => InSurveyDetection;
  updateDetection: (detection: InSurveyDetection) => void;
  deleteDetection: (id: string) => void;
  setCompleteChecklist: (complete: boolean) => void;
  finishSurvey: () => {
    sessionId: string | null;
    startedAt: string;
    endedAt: string;
    durationMinutes: number;
    movingTimeSeconds: number;
    distanceKm: number;
    detectionsCount: number;
    completeChecklist: boolean;
    simplifiedTrack: [number, number][];
    rawTrackPoints: RawTrackPoint[];
  };
  resetSurvey: () => void;
  restoreDraft: () => Promise<boolean>;
}

export const useSurveyStore = create<SurveyState>((set, get) => ({
  sessionId: null,
  status: 'idle',
  protocol: 'transect',
  selectedRouteId: null,
  startedAt: null,
  elapsedSeconds: 0,
  movingTimeSeconds: 0,
  distanceMeters: 0,
  activeTrack: [],
  rawTrackPoints: [],
  currentLocation: null,
  detections: [],
  completeChecklist: true,
  batteryWarningShown: false,

  startSurvey: (protocol, routeId = null) => {
    const startedAt = new Date().toISOString();
    const sessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    set({
      sessionId,
      status: 'acquiring_fix',
      protocol,
      selectedRouteId: routeId,
      startedAt,
      elapsedSeconds: 0,
      movingTimeSeconds: 0,
      distanceMeters: 0,
      activeTrack: [],
      rawTrackPoints: [],
      detections: [],
      completeChecklist: true,
    });
    storage
      .setItem(
        'hawem_survey_draft',
        JSON.stringify({
          sessionId,
          protocol,
          selectedRouteId: routeId,
          startedAt,
        })
      )
      .catch(() => {});

    localDb
      .insertSession({
        id: sessionId,
        protocol,
        routeId,
        startedAt,
        createdAt: startedAt,
        status: 'active',
        completeChecklist: true,
      })
      .catch(() => {});
  },

  setFixAcquired: () => {
    const { status } = get();
    if (status === 'acquiring_fix') {
      set({ status: 'recording' });
    }
  },

  pauseSurvey: () => {
    const { status, sessionId } = get();
    if (status === 'recording') {
      set({ status: 'paused' });
      if (sessionId) {
        localDb.updateSessionStatus(sessionId, 'paused').catch(() => {});
      }
    }
  },

  resumeSurvey: () => {
    const { status, sessionId } = get();
    if (status === 'paused') {
      set({ status: 'recording' });
      if (sessionId) {
        localDb.updateSessionStatus(sessionId, 'active').catch(() => {});
      }
    }
  },

  updateLocation: (lat, lon, accuracy, heading) => {
    set({ currentLocation: { lat, lon, accuracy, heading } });
    const { status } = get();
    if (status === 'acquiring_fix' && accuracy < 30) {
      set({ status: 'recording' });
    }
  },

  addTrackPoint: (lat, lon, accuracy, speed, mocked = false) => {
    const { status, activeTrack, distanceMeters, rawTrackPoints, sessionId } = get();
    if (status !== 'recording') return;

    const newRawPoint: RawTrackPoint = {
      recorded_at: new Date().toISOString(),
      latitude: lat,
      longitude: lon,
      accuracy_m: accuracy,
      speed_mps: speed,
    };

    // CLAUDE.md §2.2: Strict speed limit 15 km/h (4.17 m/s)
    const isSpeedAcceptable = speed !== undefined ? speed <= 4.17 : true;
    const rejectedReason = !isSpeedAcceptable ? 'speed_exceeded_15kmh' : undefined;

    if (sessionId) {
      localDb
        .insertTrackPoint({
          id: `tp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          sessionId,
          latitude: lat,
          longitude: lon,
          accuracyM: accuracy,
          speedMps: speed,
          mocked: Boolean(mocked),
          rejectedReason,
          recordedAt: newRawPoint.recorded_at,
        })
        .catch(() => {});
    }

    if (activeTrack.length === 0) {
      set({
        activeTrack: [[lat, lon]],
        rawTrackPoints: [...rawTrackPoints, newRawPoint],
      });
      return;
    }

    const [lastLat, lastLon] = activeTrack[activeTrack.length - 1];
    // Haversine distance
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
    const deltaM = R * c;

    // Reject micro-jitter (< 2m) and filter impossible speeds (> 15 km/h)
    if (deltaM >= 2 && isSpeedAcceptable) {
      const nextDistanceM = distanceMeters + deltaM;
      set({
        activeTrack: [...activeTrack, [lat, lon]],
        rawTrackPoints: [...rawTrackPoints, newRawPoint],
        distanceMeters: nextDistanceM,
        movingTimeSeconds: get().movingTimeSeconds + 1,
      });

      if (sessionId) {
        const durMin = parseFloat((get().elapsedSeconds / 60).toFixed(2));
        const distKm = parseFloat((nextDistanceM / 1000).toFixed(3));
        localDb.updateSessionMetrics(sessionId, durMin, distKm).catch(() => {});
      }
    } else {
      set({
        rawTrackPoints: [...rawTrackPoints, newRawPoint],
      });
    }
  },

  tickTimer: () => {
    const { status, elapsedSeconds, sessionId } = get();
    if (status === 'recording') {
      const nextElapsed = elapsedSeconds + 1;
      set({ elapsedSeconds: nextElapsed });
      if (sessionId && nextElapsed % 10 === 0) {
        const durMin = parseFloat((nextElapsed / 60).toFixed(2));
        const distKm = parseFloat((get().distanceMeters / 1000).toFixed(3));
        localDb.updateSessionMetrics(sessionId, durMin, distKm).catch(() => {});
      }
    }
  },

  logDetection: ({
    species,
    identifier,
    group_size = 1,
    distance_estimate_m,
    bearing_deg,
    body_condition_score = 3,
    notes = '',
    photoUri = null,
    photoUris = [],
    is_welfare_alert = false,
    observer_lat,
    observer_lon,
    gps_accuracy_m,
  }: {
    species: Species;
    identifier?: string;
    group_size?: number;
    distance_estimate_m?: number;
    bearing_deg?: number;
    body_condition_score?: number;
    notes?: string;
    photoUri?: string | null;
    photoUris?: string[];
    is_welfare_alert?: boolean;
    observer_lat?: number;
    observer_lon?: number;
    gps_accuracy_m?: number;
  }) => {
    const { currentLocation, activeTrack, detections, sessionId } = get();
    const obsLat = observer_lat ?? currentLocation?.lat ?? 0;
    const obsLon = observer_lon ?? currentLocation?.lon ?? 0;
    const bearing = bearing_deg ?? (currentLocation?.heading || 0);

    const distEst = distance_estimate_m ?? 5.0;
    const geoResult = computeAnimalLocation(obsLat, obsLon, distEst, bearing, activeTrack);

    const effectivePhotos = photoUris.length > 0 ? photoUris : photoUri ? [photoUri] : [];
    const effectiveIdentifier =
      identifier || generateScientificObservationCode(species, detections.length + 1);

    const newDetection: InSurveyDetection = {
      id: generateUUID(),
      identifier: effectiveIdentifier,
      species,
      group_size,
      observed_at: new Date().toISOString(),
      observer_lat: obsLat,
      observer_lon: obsLon,
      animal_lat: geoResult.animalLat,
      animal_lon: geoResult.animalLon,
      bearing_deg: bearing,
      distance_estimate_m: distEst,
      perpendicular_distance_m: geoResult.perpendicularDistanceM,
      h3_res9: geoResult.h3Res9,
      body_condition_score,
      notes,
      photoUri: effectivePhotos[0] || null,
      photoUris: effectivePhotos,
      is_welfare_alert,
      gps_accuracy_m,
    };

    const updatedDetections = [newDetection, ...detections];
    set({ detections: updatedDetections });

    if (sessionId) {
      localDb
        .insertObservation({
          id: newDetection.id,
          sessionId,
          observedAt: newDetection.observed_at,
          observerLat: obsLat,
          observerLon: obsLon,
          animalLat: geoResult.animalLat,
          animalLon: geoResult.animalLon,
          gpsAccuracyM: gps_accuracy_m,
          bearingDeg: bearing,
          distanceEstimateM: distance_estimate_m,
          perpendicularDistanceM: geoResult.perpendicularDistanceM,
          h3Res9: geoResult.h3Res9,
          species,
          groupSize: group_size,
          bodyConditionScore: body_condition_score,
          healthIssuesJson: '[]',
          notes,
          synced: false,
        })
        .catch(() => {});
    }

    return newDetection;
  },

  updateDetection: (updated) => {
    const { detections, sessionId } = get();
    set({
      detections: detections.map((d) => (d.id === updated.id ? updated : d)),
    });
    if (sessionId) {
      localDb
        .insertObservation({
          id: updated.id,
          sessionId,
          observedAt: updated.observed_at,
          observerLat: updated.observer_lat,
          observerLon: updated.observer_lon,
          animalLat: updated.animal_lat,
          animalLon: updated.animal_lon,
          gpsAccuracyM: updated.gps_accuracy_m,
          bearingDeg: updated.bearing_deg,
          distanceEstimateM: updated.distance_estimate_m,
          perpendicularDistanceM: updated.perpendicular_distance_m,
          h3Res9: updated.h3_res9,
          species: updated.species,
          groupSize: updated.group_size,
          bodyConditionScore: updated.body_condition_score,
          healthIssuesJson: '[]',
          notes: updated.notes,
          synced: false,
        })
        .catch(() => {});
    }
  },

  deleteDetection: (id) => {
    const { detections, sessionId } = get();
    set({ detections: detections.filter((d) => d.id !== id) });
    if (sessionId) {
      localDb.deleteObservation(id, sessionId).catch(() => {});
    }
  },

  setCompleteChecklist: (completeChecklist) => {
    set({ completeChecklist });
  },

  finishSurvey: () => {
    const {
      sessionId,
      startedAt,
      elapsedSeconds,
      movingTimeSeconds,
      distanceMeters,
      detections,
      completeChecklist,
      activeTrack,
      rawTrackPoints,
    } = get();

    const endedAt = new Date().toISOString();
    const durationMinutes = parseFloat((elapsedSeconds / 60).toFixed(2));
    const distanceKm = parseFloat((distanceMeters / 1000).toFixed(3));
    const simplifiedTrack = simplifyGpsTrack(activeTrack, 4.0);

    set({ status: 'finished' });
    storage.removeItem('hawem_survey_draft').catch(() => {});

    if (sessionId) {
      localDb.updateSessionStatus(sessionId, 'finished', endedAt).catch(() => {});
      localDb.updateSessionMetrics(sessionId, durationMinutes, distanceKm).catch(() => {});
    }

    return {
      sessionId,
      startedAt: startedAt || new Date(Date.now() - elapsedSeconds * 1000).toISOString(),
      endedAt,
      durationMinutes,
      movingTimeSeconds,
      distanceKm,
      detectionsCount: detections.length,
      completeChecklist,
      simplifiedTrack,
      rawTrackPoints,
    };
  },

  resetSurvey: () => {
    set({
      sessionId: null,
      status: 'idle',
      startedAt: null,
      elapsedSeconds: 0,
      movingTimeSeconds: 0,
      distanceMeters: 0,
      activeTrack: [],
      rawTrackPoints: [],
      detections: [],
      completeChecklist: true,
    });
    storage.removeItem('hawem_survey_draft').catch(() => {});
  },

  restoreDraft: async () => {
    // Primary: check local SQLite database for unfinished session
    try {
      const unfinished = await localDb.getUnfinishedSession();
      if (unfinished) {
        const rawPoints = await localDb.getTrackPointsBySession(unfinished.id);
        const obsList = await localDb.getObservationsBySession(unfinished.id);

        const activeTrack: [number, number][] = rawPoints
          .filter((p) => !p.rejectedReason)
          .map((p) => [p.latitude, p.longitude]);

        const detections: InSurveyDetection[] = obsList.map((o) => ({
          id: o.id,
          species: o.species as Species,
          group_size: o.groupSize,
          observed_at: o.observedAt,
          observer_lat: o.observerLat,
          observer_lon: o.observerLon,
          animal_lat: o.animalLat,
          animal_lon: o.animalLon,
          bearing_deg: o.bearingDeg ?? undefined,
          distance_estimate_m: o.distanceEstimateM,
          perpendicular_distance_m: o.perpendicularDistanceM ?? undefined,
          h3_res9: o.h3Res9,
          body_condition_score: o.bodyConditionScore ?? undefined,
          notes: o.notes ?? undefined,
        }));

        const durationSeconds = Math.round((unfinished.durationMin || 0) * 60);
        const distanceMeters = Math.round((unfinished.distanceKm || 0) * 1000);

        set({
          sessionId: unfinished.id,
          status: 'recovered',
          protocol: unfinished.protocol as SurveyProtocol,
          selectedRouteId: unfinished.routeId,
          startedAt: unfinished.startedAt,
          elapsedSeconds: durationSeconds,
          movingTimeSeconds: durationSeconds,
          distanceMeters,
          activeTrack,
          rawTrackPoints: rawPoints.map((p) => ({
            recorded_at: p.recordedAt,
            latitude: p.latitude,
            longitude: p.longitude,
            accuracy_m: p.accuracyM ?? undefined,
            speed_mps: p.speedMps ?? undefined,
          })),
          detections,
          completeChecklist: unfinished.completeChecklist,
        });
        return true;
      }
    } catch (err) {
      console.warn('[surveyStore] Error restoring from SQLite:', err);
    }

    // Fallback: check legacy AsyncStorage draft
    try {
      const raw = await storage.getItem('hawem_survey_draft');
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft && draft.startedAt) {
          set({
            sessionId: draft.sessionId || null,
            status: 'recovered',
            protocol: draft.protocol || 'transect',
            selectedRouteId: draft.selectedRouteId || null,
            startedAt: draft.startedAt,
          });
          return true;
        }
      }
    } catch {}
    return false;
  },
}));
