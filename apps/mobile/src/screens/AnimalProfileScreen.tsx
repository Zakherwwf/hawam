/**
 * Known animal profile: photos, how often and where it was seen, and every
 * sighting linked to it, the same story the research portal tells. Links a
 * researcher has not confirmed yet are marked, so volunteers know which
 * resightings are still under review.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { InteractiveMap } from '../components/map/InteractiveMap';
import type { MapMarker } from '../components/map/mapTypes';
import { PhotoStrip, StatGrid } from '../components/profile/ProfileBits';
import { useKnownAnimals } from '../features/animals/knownAnimals';
import {
  fetchAnimalEncounters,
  type AnimalLinkRow,
  type PhotoRow,
  type ServerSighting,
} from '../services/profiles';
import { formatObservedAt } from '../utils/formatObservation';
import { Card, EmptyState, Row, Screen, Section, Tag, Text, useTheme } from '../ui';

const PATH_COLOR = '#7C3AED';

export function AnimalProfileScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const animal = useKnownAnimals((s) => s.animals.find((a) => a.id === id));
  const [data, setData] = useState<{
    links: AnimalLinkRow[];
    sightings: ServerSighting[];
    photos: PhotoRow[];
  } | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'offline'>('loading');

  const load = async () => {
    setState('loading');
    const res = await fetchAnimalEncounters(id);
    setData(res);
    setState(res ? 'ready' : 'offline');
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const when = (iso: string) =>
    formatObservedAt(iso, { today: t('ui_common.today'), yesterday: t('ui_common.yesterday') });
  const name =
    animal?.nickname ||
    t(animal?.species === 'dog' ? 'ui_reid.unnamed_dog' : 'ui_reid.unnamed_cat');

  const rows = useMemo(() => {
    if (!data) return [];
    const byId = new Map(data.sightings.map((s) => [s.id, s]));
    return data.links
      .map((l) => ({ link: l, s: byId.get(l.observation_id) }))
      .filter((r): r is { link: AnimalLinkRow; s: ServerSighting } => !!r.s)
      .sort((a, b) => b.s.observed_at.localeCompare(a.s.observed_at));
  }, [data]);
  const confirmed = rows.filter((r) => r.link.status === 'confirmed');
  const path = [...confirmed].sort((a, b) => a.s.observed_at.localeCompare(b.s.observed_at));
  const observers = new Set(confirmed.map((r) => r.s.observer_id)).size;
  const first = path[0]?.s.observed_at ?? null;
  const last = path[path.length - 1]?.s.observed_at ?? animal?.lastSeen ?? null;

  const markers: MapMarker[] = rows.map((r) => ({
    id: r.s.id,
    latitude: r.s.latitude,
    longitude: r.s.longitude,
    species: r.s.species,
    title: r.s.public_code,
    subtitle: when(r.s.observed_at),
  }));
  const photos = [
    ...(animal?.photoPath ? [animal.photoPath] : []),
    ...(data?.photos ?? []).map((p) => p.storage_path).filter((p) => p !== animal?.photoPath),
  ].slice(0, 10);

  if (!animal && state === 'ready' && !rows.length)
    return (
      <Screen title={t('ui_profiles.animal')} onBack={onBack} inTabs={false}>
        <EmptyState
          icon="paw"
          title={t('ui_profiles.animal_missing')}
          message={t('ui_profiles.animal_missing_body')}
        />
      </Screen>
    );

  return (
    <Screen
      title={name}
      subtitle={animal?.coatPattern ? t(`ui_reid.coat_${animal.coatPattern}`) : undefined}
      onBack={onBack}
      inTabs={false}
      onRefresh={load}
      refreshing={false}
    >
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <Tag
          label={animal?.species === 'dog' ? t('ui_quick.dog') : t('ui_quick.cat')}
          tone={animal?.species === 'dog' ? 'dog' : 'cat'}
        />
        {rows.some((r) => r.link.status === 'proposed') ? (
          <Tag label={t('ui_profiles.under_review')} tone="warning" />
        ) : null}
      </View>

      {photos.length ? (
        <View style={{ marginBottom: 20 }}>
          <PhotoStrip paths={photos} label={(i) => t('ui_profiles.photo_of', { name, n: i + 1 })} />
        </View>
      ) : null}

      <StatGrid
        items={[
          {
            value: String(confirmed.length || animal?.sightings || 0),
            label: t('ui_profiles.confirmed_sightings'),
          },
          { value: String(observers), label: t('ui_profiles.observers') },
          { value: first ? when(first) : '-', label: t('ui_profiles.first_seen') },
          { value: last ? when(last) : '-', label: t('ui_profiles.last_seen') },
        ]}
      />

      <Text variant="headline" style={{ marginTop: 28, marginBottom: 10 }}>
        {t('ui_profiles.where_seen')}
      </Text>
      <Card padded={false} style={{ overflow: 'hidden', marginBottom: 8 }}>
        {state === 'loading' && !data ? (
          <View style={{ height: 240, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : markers.length ? (
          <InteractiveMap
            height={260}
            markers={markers}
            initialLat={markers[0].latitude}
            initialLon={markers[0].longitude}
            initialZoom={16}
            extraLines={
              path.length > 1
                ? [
                    {
                      id: 'path',
                      coords: path.map((r) => [r.s.latitude, r.s.longitude]),
                      color: PATH_COLOR,
                      width: 3,
                    },
                  ]
                : []
            }
            showUserLocation={false}
            hideControls
          />
        ) : (
          <View
            style={{ height: 120, alignItems: 'center', justifyContent: 'center', padding: 16 }}
          >
            <Text variant="footnote" tone="ink2" align="center">
              {state === 'offline' ? t('ui_profiles.offline') : t('ui_profiles.no_positions')}
            </Text>
          </View>
        )}
      </Card>
      <Text variant="footnote" tone="ink2" style={{ marginBottom: 24, marginHorizontal: 4 }}>
        {t('ui_profiles.path_note')}
      </Text>

      <Section header={t('ui_profiles.encounters')} footer={t('ui_profiles.encounters_note')}>
        {rows.length === 0 ? (
          <Row
            title={
              state === 'loading'
                ? t('ui_progress_v3.loading')
                : state === 'offline'
                  ? t('ui_profiles.offline')
                  : t('ui_profiles.no_encounters')
            }
          />
        ) : (
          rows.map((r) => (
            <Row
              key={r.link.id}
              icon="paw"
              iconColor={r.s.species === 'dog' ? c.dog : c.cat}
              title={r.s.public_code}
              subtitle={[
                when(r.s.observed_at),
                r.s.observer_name,
                r.link.is_founder ? t('ui_profiles.first_registration') : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              trailing={
                <Tag
                  label={
                    r.link.status === 'confirmed'
                      ? t('ui_profiles.confirmed')
                      : t('ui_profiles.under_review')
                  }
                  tone={r.link.status === 'confirmed' ? 'accent' : 'warning'}
                />
              }
              onPress={() => router.push(`/sighting/${r.s.id}`)}
            />
          ))
        )}
      </Section>
    </Screen>
  );
}
