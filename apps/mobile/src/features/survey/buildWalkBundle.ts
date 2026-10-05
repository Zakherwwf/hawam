/**
 * Turns a finished walk into the submit_survey_bundle payload. Kept pure and
 * tested because this is where scientific integrity is decided:
 * - distance, bearing and body condition are sent only when the observer gave them
 * - the observer's position and the animal's position are separate (CLAUDE.md 1.4)
 * - every raw fix goes up with its real timestamp and accuracy (CLAUDE.md 1.5)
 * - a complete walk with no animals is a valid non-detection (CLAUDE.md 1.3)
 */

import type { SurveyBundlePayload } from '../../services/supabase.ts';
import type { InSurveyDetection, RawTrackPoint } from './surveyStore.ts';
import { simplifyGpsTrack } from '../../services/georef/geoUtils.ts';
import { linkPayload } from '../animals/knownAnimals.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SERVER_CODE = /^(CAT|DOG|OBS)-\d+$/;

export function buildWalkBundle({
  sessionId,
  protocol,
  routeId,
  startedAt,
  endedAt,
  distanceKm,
  completeChecklist,
  detections,
  activeTrack,
  rawTrackPoints,
  appVersion,
  newId,
  weather,
  observers = 1,
  timeOfDay,
}: {
  sessionId: string;
  protocol: 'transect' | 'stationary_point';
  routeId?: string | null;
  startedAt: string;
  endedAt: string;
  distanceKm: number;
  completeChecklist: boolean;
  detections: InSurveyDetection[];
  activeTrack: [number, number][];
  rawTrackPoints: RawTrackPoint[];
  appVersion: string;
  newId: () => string;
  weather?: 'clear' | 'cloudy' | 'rain' | 'wind' | null;
  observers?: number;
  timeOfDay?: string | null;
}): SurveyBundlePayload {
  const accuracies = rawTrackPoints.map((p) => p.accuracy_m).filter((a): a is number => a != null);
  const simplified = activeTrack.length >= 2 ? simplifyGpsTrack(activeTrack, 2.0) : [];

  const observations = detections.map((d) => {
    const estimated = d.distance_estimate_m != null;
    const tag = d.identifier?.trim();
    return {
      id: UUID.test(d.id) ? d.id : newId(),
      observed_at: d.observed_at,
      species: d.species,
      group_size: d.group_size || 1,
      distance_from_path_m: estimated ? (d.perpendicular_distance_m ?? null) : null,
      body_condition_score: d.body_condition_score ?? null,
      location: {
        latitude: d.animal_lat,
        longitude: d.animal_lon,
        type: 'Point' as const,
        coordinates: [d.animal_lon, d.animal_lat] as [number, number],
      },
      observer_location: {
        latitude: d.observer_lat,
        longitude: d.observer_lon,
        type: 'Point' as const,
        coordinates: [d.observer_lon, d.observer_lat] as [number, number],
      },
      bearing_deg: estimated ? (d.bearing_deg ?? null) : null,
      distance_estimate_m: estimated ? d.distance_estimate_m : null,
      gps_accuracy_m: d.gps_accuracy_m ?? null,
      // The volunteer's own tag travels in the notes; server codes are assigned there
      notes:
        [tag && !SERVER_CODE.test(tag) ? `Tag: ${tag}` : null, d.notes?.trim() || null]
          .filter(Boolean)
          .join(' | ') || null,
      sex: d.sex,
      age_class: d.age_class,
      ear_tip_or_notch: d.ear_tip_or_notch,
      visible_health_issues: d.visible_health_issues?.length ? d.visible_health_issues : undefined,
      coat_pattern: d.coat_pattern,
      individual: linkPayload(d.link),
    };
  });

  const photos = detections.flatMap((d, i) => {
    const uri = d.photoUris?.[0] ?? d.photoUri;
    return uri
      ? [
          {
            id: newId(),
            observation_id: observations[i].id,
            storage_path: uri,
            angle: d.photoAngle ?? ('other' as const),
            taken_at: d.observed_at,
          },
        ]
      : [];
  });

  return {
    session: {
      id: UUID.test(sessionId) ? sessionId : newId(),
      protocol,
      route_id: routeId && UUID.test(routeId) ? routeId : null,
      start_time: startedAt,
      end_time: endedAt,
      distance_km: protocol === 'transect' ? Math.round(distanceKm * 1000) / 1000 : 0,
      complete_session: completeChecklist,
      number_of_observers: Math.min(50, Math.max(1, Math.round(observers))),
      weather: weather ?? null,
      time_of_day: timeOfDay ?? null,
      app_version: appVersion,
      device_gps_accuracy_avg: accuracies.length
        ? Math.round((accuracies.reduce((a, b) => a + b, 0) / accuracies.length) * 10) / 10
        : null,
    },
    track:
      simplified.length >= 2
        ? {
            type: 'LineString',
            coordinates: simplified.map(([lat, lon]) => [lon, lat] as [number, number]),
          }
        : null,
    track_points: rawTrackPoints.map((p) => ({
      recorded_at: p.recorded_at,
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy_m: p.accuracy_m ?? null,
      speed_mps: p.speed_mps ?? null,
      // Sent as recorded; the server flags the session, never the phone
      is_mock: Boolean(p.is_mock),
    })),
    observations,
    photos,
  };
}
