/**
 * Survey walk (v3): the structured survey, for transects and point counts.
 *
 * The survey store is the single source of truth, so pausing (which closes
 * this screen) and resuming lose nothing. This screen owns the foreground GPS
 * watcher: it moves the store from "acquiring_fix" to "recording" once a fix
 * is better than 30 m, and records every fix as a raw point (weak ones kept
 * and flagged, CLAUDE.md 1.5). The background task only fills in while the
 * app is not on screen.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { InteractiveMap } from '../components/map/InteractiveMap';
import type { FocusCoordinate, MapMarker } from '../components/map/mapTypes';
import { LogAnimalSheet } from '../components/survey/LogAnimalSheet';
import { FinishWalkSheet } from '../components/survey/FinishWalkSheet';
import { RoutePickerModal } from '../components/routes/RoutePickerModal';
import { useSurveyStore, type InSurveyDetection } from '../features/survey/surveyStore';
import { useRoutesStore } from '../features/routes/routesStore';
import { useSyncStore } from '../features/sync/syncStore';
import { buildWalkBundle } from '../features/survey/buildWalkBundle';
import { nearbyTags, surveyXpPreview } from '../features/survey/walkMath';
import { computeAnimalLocation } from '../services/georef/geoUtils';
import { generateUUID } from '../utils/uuid';
import { PREVIEW_MODE } from '../app-state/previewData';
import type { SightingItem } from '../app-state/types';
import {
  AnimalFace,
  Button,
  Glass,
  Gradient,
  IconButton,
  Press,
  Sheet,
  StreetScene,
  Symbol,
  Text,
  useTheme,
  useToast,
} from '../ui';

function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

export function SurveyWalkScreen({
  sightings,
  onPause,
  onSaved,
  logSightings,
}: {
  sightings: SightingItem[];
  onPause: () => void;
  onSaved: (summary: { distance_km: number; complete_session: boolean }) => void;
  logSightings: (items: SightingItem[]) => void;
}) {
  const { t } = useTranslation();
  const { c, g, radius } = useTheme();
  const insets = useSafeAreaInsets();

  const status = useSurveyStore((s) => s.status);
  const protocol = useSurveyStore((s) => s.protocol);
  const elapsed = useSurveyStore((s) => s.elapsedSeconds);
  const distanceM = useSurveyStore((s) => s.distanceMeters);
  const track = useSurveyStore((s) => s.activeTrack);
  const detections = useSurveyStore((s) => s.detections);
  const here = useSurveyStore((s) => s.currentLocation);
  const routeId = useSurveyStore((s) => s.selectedRouteId);
  const { routes, checkOffRoute, recordSurveyCompletion } = useRoutesStore();
  const route = routes.find((r) => r.id === routeId) ?? null;
  const stationary = protocol === 'stationary_point';

  const [gpsDenied, setGpsDenied] = useState(false);
  const [editing, setEditing] = useState<InSurveyDetection | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [routePicker, setRoutePicker] = useState(false);
  const [offRouteM, setOffRouteM] = useState<number | null>(null);
  const [focus, setFocus] = useState<FocusCoordinate | null>(null);
  const focused = useRef(false);

  // ---- Foreground GPS: status transition + raw track points -------------
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    let last: { lat: number; lon: number; t: number } | null = null;

    const onFix = (
      lat: number,
      lon: number,
      acc: number,
      heading?: number,
      speed?: number | null,
      mocked = false
    ) => {
      const st = useSurveyStore.getState();
      st.updateLocation(lat, lon, acc, heading);
      if (useSurveyStore.getState().status !== 'recording') return;
      const now = Date.now();
      const computed = last
        ? Math.hypot(
            (lat - last.lat) * 111320,
            (lon - last.lon) * 111320 * Math.cos((lat * Math.PI) / 180)
          ) / Math.max(1, (now - last.t) / 1000)
        : 0;
      last = { lat, lon, t: now };
      useSurveyStore
        .getState()
        .addTrackPoint(lat, lon, acc, speed != null && speed >= 0 ? speed : computed, mocked);
      const rid = useSurveyStore.getState().selectedRouteId;
      if (rid) {
        const chk = checkOffRoute(lat, lon, rid);
        setOffRouteM(chk.isOffRoute ? Math.round(chk.distanceM) : null);
      }
    };

    if (PREVIEW_MODE) {
      // Design preview: a steady walk north from a sample point
      let lat = 36.8021;
      const lon = 10.1797;
      let ticks = 0;
      timer = setInterval(() => {
        lat += 0.00002;
        ticks += 1;
        // A weak fix first, as outdoors, then a good one
        onFix(lat, lon, ticks < 5 ? 48 : 6, 0, 1.2);
      }, 1000);
      return () => {
        if (timer) clearInterval(timer);
      };
    }

    (async () => {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (perm !== 'granted') {
        setGpsDenied(true);
        return;
      }
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        (loc) => {
          if (cancelled) return;
          const h = loc.coords.heading;
          onFix(
            loc.coords.latitude,
            loc.coords.longitude,
            loc.coords.accuracy ?? 99,
            h != null && h >= 0 ? h : undefined,
            loc.coords.speed,
            Boolean((loc as { mocked?: boolean }).mocked)
          );
        }
      );
    })().catch(() => setGpsDenied(true));
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [checkOffRoute]);

  // ---- Timer -------------------------------------------------------------
  useEffect(() => {
    if (status !== 'recording') return;
    const id = setInterval(() => useSurveyStore.getState().tickTimer(), 1000);
    return () => clearInterval(id);
  }, [status]);

  // Centre the map on the first fix
  useEffect(() => {
    if (here && !focused.current) {
      focused.current = true;
      setFocus({ latitude: here.lat, longitude: here.lon, zoom: 17 });
    }
  }, [here]);

  const markers: MapMarker[] = useMemo(
    () =>
      detections.map((d) => ({
        id: d.id,
        latitude: d.animal_lat,
        longitude: d.animal_lon,
        species: d.species,
        label: String(d.group_size),
        title: d.identifier,
      })),
    [detections]
  );

  // ---- Logging -----------------------------------------------------------
  const log = (species: 'cat' | 'dog' | 'unknown') => {
    const loc = useSurveyStore.getState().currentLocation;
    const d = useSurveyStore.getState().logDetection({
      species,
      observer_lat: loc?.lat,
      observer_lon: loc?.lon,
      gps_accuracy_m: loc?.accuracy,
    });
    setEditing(d);
  };

  const saveDetection = (d: InSurveyDetection) => {
    const estimated = d.distance_estimate_m != null && d.bearing_deg != null;
    const geo = computeAnimalLocation(
      d.observer_lat,
      d.observer_lon,
      estimated ? (d.distance_estimate_m as number) : 0,
      d.bearing_deg ?? 0,
      route?.waypoints ?? useSurveyStore.getState().activeTrack
    );
    useSurveyStore.getState().updateDetection({
      ...d,
      identifier: d.identifier?.trim() || undefined,
      animal_lat: geo.animalLat,
      animal_lon: geo.animalLon,
      h3_res9: geo.h3Res9,
      perpendicular_distance_m: estimated ? geo.perpendicularDistanceM : undefined,
    });
    setEditing(null);
  };

  const saveWalk = (complete: boolean) => {
    const st = useSurveyStore.getState();
    st.setCompleteChecklist(complete);
    const dets = st.detections;
    const bundle = buildWalkBundle({
      sessionId: st.sessionId ?? generateUUID(),
      protocol: stationary ? 'stationary_point' : 'transect',
      routeId: st.selectedRouteId,
      startedAt: st.startedAt ?? new Date(Date.now() - st.elapsedSeconds * 1000).toISOString(),
      endedAt: new Date().toISOString(),
      distanceKm: st.distanceMeters / 1000,
      completeChecklist: complete,
      detections: dets,
      activeTrack: st.activeTrack,
      rawTrackPoints: st.rawTrackPoints,
      appVersion: Constants.expoConfig?.version ?? '3.0.0',
      newId: generateUUID,
    });
    useSyncStore.getState().enqueueSurvey(bundle);
    if (st.selectedRouteId) recordSurveyCompletion(st.selectedRouteId);
    st.finishSurvey();

    logSightings(
      bundle.observations.map((o, i) => ({
        id: o.id,
        species: o.species,
        group_size: o.group_size ?? 1,
        latitude: o.location.latitude as number,
        longitude: o.location.longitude as number,
        observed_at: o.observed_at,
        distance_from_path_m: o.distance_from_path_m ?? undefined,
        body_condition_score: o.body_condition_score ?? undefined,
        protocol: stationary ? 'stationary_point' : 'transect',
        identifier: dets[i].identifier,
        notes: dets[i].notes,
        photos: dets[i].photoUris?.length
          ? dets[i].photoUris
          : dets[i].photoUri
            ? [dets[i].photoUri as string]
            : [],
      }))
    );

    const xp = surveyXpPreview({
      km: st.distanceMeters / 1000,
      observations: dets.map((d) => ({
        group_size: d.group_size,
        hasPhoto: !!(d.photoUris?.length || d.photoUri),
      })),
    });
    useToast.getState().show({
      title: dets.length === 0 && complete ? t('ui_walk.saved_zero') : t('ui_walk.saved'),
      detail: t('ui_quick.saved_detail'),
      xp: xp.total,
      icon: 'walk',
    });
    setFinishOpen(false);
    onSaved({ distance_km: st.distanceMeters / 1000, complete_session: complete });
  };

  const cancelWalk = () =>
    Alert.alert(t('ui_walk.cancel_title'), t('ui_walk.cancel_body'), [
      { text: t('ui_walk.cancel_keep'), style: 'cancel' },
      {
        text: t('ui_walk.cancel_confirm'),
        style: 'destructive',
        onPress: () => useSurveyStore.getState().resetSurvey(),
      },
    ]);

  const acc = here?.accuracy;
  const gpsTone = acc == null ? c.ink3 : acc <= 10 ? c.accent : acc <= 30 ? c.warning : c.danger;
  const gpsText =
    acc == null
      ? t('ui_walk.gps_none')
      : acc <= 30
        ? t('ui_walk.gps_ok', { m: Math.round(acc) })
        : t('ui_walk.gps_weak', { m: Math.round(acc) });
  const animals = detections.reduce((a, d) => a + d.group_size, 0);
  const latest = detections[0];

  // ---- Waiting for a usable fix -----------------------------------------
  if (status === 'acquiring_fix') {
    return (
      <View style={{ flex: 1, backgroundColor: c.canvas }}>
        <Gradient
          colors={g.hero}
          style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: 20,
            paddingBottom: 28,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
          }}
        >
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Glass tone="onColor" style={{ borderRadius: 22 }}>
              <Press
                onPress={cancelWalk}
                accessibilityLabel={t('ui_walk.cancel_title')}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Symbol name="close" size={20} color="#FFFFFF" weight="semibold" />
              </Press>
            </Glass>
            <Text variant="headline" style={{ color: '#FFFFFF' }}>
              {stationary ? t('ui_record.stationary') : t('ui_record.walk')}
            </Text>
            <View style={{ width: 44 }} />
          </View>
          <StreetScene style={{ marginTop: 12 }} />
        </Gradient>
        <View style={{ padding: 20, gap: 16, flex: 1 }}>
          <Text variant="title2" accessibilityRole="header">
            {gpsDenied ? t('ui_walk.gps_denied_title') : t('ui_walk.waiting_title')}
          </Text>
          <Text variant="body" tone="ink2" accessibilityLiveRegion="polite">
            {gpsDenied
              ? t('ui_walk.gps_denied_body')
              : acc != null
                ? t('ui_walk.waiting_acc', { m: Math.round(acc) })
                : t('ui_walk.waiting_body')}
          </Text>
          {gpsDenied ? (
            <Button title={t('ui_quick.open_settings')} onPress={() => Linking.openSettings()} />
          ) : null}
          <View style={{ gap: 12, marginTop: 8 }}>
            {[
              { icon: 'checkCircle' as const, text: t('ui_walk.tip_every') },
              { icon: 'eye' as const, text: t('ui_walk.tip_zero') },
              { icon: 'paw' as const, text: t('ui_walk.tip_care') },
            ].map((tip) => (
              <View key={tip.text} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: c.limeSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Symbol name={tip.icon} size={18} color={c.accent} weight="semibold" />
                </View>
                <Text variant="subhead" style={{ flex: 1 }}>
                  {tip.text}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // ---- Recording ---------------------------------------------------------
  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <InteractiveMap
        focusCoordinate={focus}
        markers={markers}
        trackCoordinates={track}
        routeCorridorCoordinates={route?.waypoints ?? []}
        showUserLocation
        hideControls
        onMarkerPress={(id) => {
          const d = detections.find((x) => x.id === id);
          if (d) setEditing(d);
        }}
        height="100%"
      />

      {/* Top HUD */}
      <View style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, gap: 8 }}>
        <Glass intensity={60} style={{ borderRadius: radius.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 }}>
            <IconButton icon="pause" tone="soft" label={t('ui_walk.pause')} onPress={onPause} />
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
              {[
                { v: fmtTime(elapsed), l: t('ui_walk.time') },
                ...(stationary
                  ? []
                  : [{ v: (distanceM / 1000).toFixed(2), l: t('ui_progress_v3.km') }]),
                { v: String(animals), l: t('ui_walk.animals') },
              ].map((s) => (
                <View
                  key={s.l}
                  style={{ alignItems: 'center' }}
                  accessible
                  accessibilityLabel={`${s.v} ${s.l}`}
                >
                  <Text variant="title3" tabular>
                    {s.v}
                  </Text>
                  <Text variant="caption" tone="ink2">
                    {s.l}
                  </Text>
                </View>
              ))}
            </View>
            <Button size="small" title={t('ui_walk.finish')} onPress={() => setFinishOpen(true)} />
          </View>
        </Glass>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Glass style={{ borderRadius: 999 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                minHeight: 32,
              }}
              accessibilityLiveRegion="polite"
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: gpsTone }} />
              <Text variant="footnote" weight="600">
                {gpsText}
              </Text>
            </View>
          </Glass>
          {!stationary ? (
            <Glass style={{ borderRadius: 999 }}>
              <Press
                onPress={() => setRoutePicker(true)}
                haptic={false}
                accessibilityLabel={t('ui_walk.route')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  minHeight: 32,
                }}
              >
                <Symbol name="route" size={13} color={c.ink2} />
                <Text variant="footnote" weight="600" numberOfLines={1}>
                  {route?.name ?? t('ui_walk.free_walk')}
                </Text>
              </Press>
            </Glass>
          ) : null}
        </View>
        {offRouteM != null ? (
          <View
            style={{
              backgroundColor: c.warmSoft,
              borderRadius: 14,
              padding: 10,
              flexDirection: 'row',
              gap: 8,
              alignItems: 'center',
            }}
            accessibilityLiveRegion="assertive"
          >
            <Symbol name="info" size={16} color={c.warmInk} />
            <Text variant="footnote" style={{ color: c.warmInk, flex: 1 }}>
              {t('ui_walk.off_route', { m: offRouteM })}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Bottom: log buttons */}
      <View
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: Math.max(insets.bottom, 12) + 4,
        }}
      >
        <Glass intensity={60} style={{ borderRadius: radius.xl }}>
          <View style={{ padding: 12, gap: 10 }}>
            {latest ? (
              <Press
                onPress={() => setListOpen(true)}
                haptic={false}
                accessibilityLabel={t('ui_walk.logged_list', { count: detections.length })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 36,
                  paddingHorizontal: 4,
                }}
              >
                <Text variant="footnote" tone="ink2" style={{ flex: 1 }} numberOfLines={1}>
                  {t('ui_walk.last_logged', {
                    what: `${latest.species === 'cat' ? t('ui_quick.cat') : latest.species === 'dog' ? t('ui_quick.dog') : t('ui_sightings_v3.animal')} ×${latest.group_size}`,
                  })}
                  {latest.distance_estimate_m == null
                    ? ` · ${t('ui_walk.add_distance')}`
                    : ` · ${t('ui_walk.metres', { m: latest.distance_estimate_m })}`}
                </Text>
                <Text variant="footnote" tone="accent" weight="600">
                  {t('ui_walk.all_logged', { count: detections.length })}
                </Text>
                <Symbol name="chevronRight" size={12} color={c.accent} weight="semibold" />
              </Press>
            ) : (
              <Text variant="footnote" tone="ink2" align="center">
                {t('ui_walk.tap_to_log')}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(['cat', 'dog'] as const).map((sp) => (
                <Press
                  key={sp}
                  onPress={() => log(sp)}
                  accessibilityLabel={t('ui_walk.log_species', {
                    species: sp === 'cat' ? t('ui_quick.cat') : t('ui_quick.dog'),
                  })}
                  style={{
                    flex: 1,
                    minHeight: 64,
                    borderRadius: radius.lg,
                    backgroundColor: sp === 'cat' ? c.catSoft : c.dogSoft,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                >
                  <AnimalFace species={sp} size={40} />
                  <Text variant="title3" style={{ color: sp === 'cat' ? c.cat : c.dog }}>
                    {sp === 'cat' ? t('ui_quick.cat') : t('ui_quick.dog')}
                  </Text>
                </Press>
              ))}
            </View>
            <Button
              kind="plain"
              size="small"
              title={t('ui_quick.not_sure')}
              onPress={() => log('unknown')}
            />
          </View>
        </Glass>
      </View>

      <LogAnimalSheet
        detection={editing}
        heading={here?.heading}
        tagSuggestions={
          editing && here ? nearbyTags(sightings, editing.species, here.lat, here.lon) : []
        }
        onSave={saveDetection}
        onDelete={(id) => {
          useSurveyStore.getState().deleteDetection(id);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />

      <Sheet
        visible={listOpen}
        onClose={() => setListOpen(false)}
        title={t('ui_walk.logged_list', { count: detections.length })}
      >
        <View style={{ gap: 8 }}>
          {detections.map((d) => (
            <Press
              key={d.id}
              onPress={() => {
                setListOpen(false);
                setEditing(d);
              }}
              accessibilityLabel={`${d.species}, ${d.group_size}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 10,
                borderRadius: radius.lg,
                backgroundColor: c.surface,
              }}
            >
              {d.species === 'cat' || d.species === 'dog' ? (
                <AnimalFace species={d.species} size={40} />
              ) : (
                <Symbol name="paw" color={c.ink3} />
              )}
              <View style={{ flex: 1 }}>
                <Text variant="headline">
                  {(d.species === 'cat'
                    ? t('ui_quick.cat')
                    : d.species === 'dog'
                      ? t('ui_quick.dog')
                      : t('ui_sightings_v3.animal')) + ` ×${d.group_size}`}
                </Text>
                <Text variant="footnote" tone="ink2">
                  {[
                    new Date(d.observed_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                    d.distance_estimate_m != null
                      ? t('ui_walk.metres', { m: d.distance_estimate_m })
                      : t('ui_walk.add_distance'),
                  ].join(' · ')}
                </Text>
              </View>
              <Symbol name="chevronRight" size={13} color={c.ink3} weight="semibold" />
            </Press>
          ))}
        </View>
      </Sheet>

      <FinishWalkSheet
        visible={finishOpen}
        seconds={elapsed}
        km={distanceM / 1000}
        stationary={stationary}
        observations={detections.map((d) => ({
          species: d.species,
          group_size: d.group_size,
          hasPhoto: !!(d.photoUris?.length || d.photoUri),
        }))}
        onSave={saveWalk}
        onKeepWalking={() => setFinishOpen(false)}
      />

      <RoutePickerModal
        visible={routePicker}
        selectedRouteId={routeId}
        onSelectRoute={(r) => useSurveyStore.setState({ selectedRouteId: r?.id ?? null })}
        onClose={() => setRoutePicker(false)}
      />
    </View>
  );
}
