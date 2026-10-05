/**
 * Sighting profile. For the volunteer's own record: photos, what was seen,
 * where they stood and where the animal was (bearing and distance), the
 * known animal it is linked to, its upload status, and the tag, notes and
 * delete controls that used to live in a small sheet. A sighting by someone
 * else (opened from a known animal) shows the same details read-only.
 */
import React, { useEffect, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { InteractiveMap } from '../components/map/InteractiveMap';
import type { MapLine } from '../components/map/mapTypes';
import { PhotoStrip, StatGrid } from '../components/profile/ProfileBits';
import type { SightingItem } from '../app-state/types';
import { useKnownAnimals } from '../features/animals/knownAnimals';
import { fetchSightingDetail, type ServerSighting } from '../services/profiles';
import { formatCoordinates, formatObservedAt } from '../utils/formatObservation';
import { Button, Card, EmptyState, Row, Screen, Section, Tag, Text, useTheme } from '../ui';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function SightingProfileScreen({
  id,
  local,
  onBack,
  onSave,
  onDelete,
}: {
  id: string;
  /** The phone's own record, when this sighting is the volunteer's */
  local: SightingItem | null;
  onBack: () => void;
  onSave: (s: SightingItem) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { c, radius } = useTheme();
  const [server, setServer] = useState<ServerSighting | null>(null);
  const [linkedId, setLinkedId] = useState<string | null>(null);
  const [linkStatus, setLinkStatus] = useState<'proposed' | 'confirmed' | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tag, setTag] = useState(local?.identifier ?? '');
  const [notes, setNotes] = useState(local?.notes ?? '');
  const animal = useKnownAnimals((s) =>
    linkedId ? s.animals.find((a) => a.id === linkedId) : undefined
  );

  useEffect(() => {
    let live = true;
    if (local?.syncPending) {
      setLoaded(true);
      return;
    }
    fetchSightingDetail(id).then((res) => {
      if (!live) return;
      setServer(res?.sighting ?? null);
      setLinkedId(res?.link?.individual_id ?? null);
      setLinkStatus(res?.link && res.link.status !== 'rejected' ? res.link.status : null);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [id, local?.syncPending]);

  const species = local?.species ?? server?.species ?? 'unknown';
  const speciesLabel =
    species === 'cat'
      ? t('ui_quick.cat')
      : species === 'dog'
        ? t('ui_quick.dog')
        : t('ui_sightings_v3.animal');
  const observedAt = local?.observed_at ?? server?.observed_at;
  const lat = server?.latitude ?? local?.latitude;
  const lon = server?.longitude ?? local?.longitude;
  const group = local?.group_size ?? server?.group_size ?? 1;
  const code = server?.public_code ?? local?.publicCode;
  const bcs = local?.body_condition_score ?? server?.body_condition_score ?? null;
  const fromPath = server?.perpendicular_distance_m ?? local?.distance_from_path_m ?? null;
  const when = (iso: string) =>
    formatObservedAt(iso, { today: t('ui_common.today'), yesterday: t('ui_common.yesterday') });

  if (!local && loaded && !server)
    return (
      <Screen title={t('ui_profiles.sighting')} onBack={onBack} inTabs={false}>
        <EmptyState
          icon="paw"
          title={t('ui_profiles.sighting_missing')}
          message={t('ui_profiles.sighting_missing_body')}
        />
      </Screen>
    );

  const hasObserver = server?.observer_latitude != null && server?.observer_longitude != null;
  const lines: MapLine[] =
    hasObserver && lat != null && lon != null
      ? [
          {
            id: 'bearing',
            coords: [
              [server!.observer_latitude!, server!.observer_longitude!],
              [lat, lon],
            ],
            color: '#16181D',
            width: 2,
            dashed: true,
          },
        ]
      : [];
  const changed =
    !!local && (tag.trim() !== (local.identifier ?? '') || notes.trim() !== (local.notes ?? ''));
  const input = {
    backgroundColor: c.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 17,
    color: c.ink,
  } as const;

  return (
    <Screen
      title={code ?? speciesLabel}
      subtitle={observedAt ? when(observedAt) : undefined}
      onBack={onBack}
      inTabs={false}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <Tag
          label={speciesLabel}
          tone={species === 'dog' ? 'dog' : species === 'cat' ? 'cat' : 'neutral'}
        />
        {local ? (
          <Tag
            label={
              local.syncPending ? t('ui_sightings_v3.not_uploaded') : t('ui_sightings_v3.uploaded')
            }
            tone={local.syncPending ? 'warning' : 'accent'}
          />
        ) : server?.observer_name ? (
          <Tag label={t('ui_profiles.seen_by', { name: server.observer_name })} tone="neutral" />
        ) : null}
      </View>

      {local?.photos?.length ? (
        <View style={{ marginBottom: 20 }}>
          <PhotoStrip paths={local.photos} label={(i) => t('ui_profiles.photo_n', { n: i + 1 })} />
        </View>
      ) : null}

      <StatGrid
        items={[
          { value: t('ui_quick.count_value', { count: group }), label: speciesLabel },
          {
            value: bcs ? `${bcs}/5` : '-',
            label: bcs ? t(`ui_quick.bcs_${bcs}`) : t('ui_profiles.condition'),
          },
          {
            value: fromPath != null ? `${Math.round(fromPath)} m` : '-',
            label: t('ui_profiles.from_path'),
          },
          {
            value:
              server?.distance_estimate_m != null
                ? `${Math.round(server.distance_estimate_m)} m`
                : '-',
            label:
              server?.bearing_deg != null
                ? t('ui_profiles.away_bearing', {
                    deg: Math.round(server.bearing_deg),
                    dir: COMPASS[Math.round(server.bearing_deg / 45) % 8],
                  })
                : t('ui_profiles.away'),
          },
        ]}
      />

      {lat != null && lon != null ? (
        <>
          <Card padded={false} style={{ overflow: 'hidden', marginTop: 20 }}>
            <InteractiveMap
              height={240}
              markers={[{ id, latitude: lat, longitude: lon, species, title: code }]}
              initialLat={lat}
              initialLon={lon}
              initialZoom={17}
              extraLines={lines}
              showUserLocation={false}
              hideControls
            />
          </Card>
          <Text variant="footnote" tone="ink2" style={{ marginTop: 8, marginHorizontal: 4 }}>
            {hasObserver
              ? t('ui_profiles.bearing_note')
              : server && !server.exact
                ? t('ui_profiles.rounded_note')
                : formatCoordinates(lat, lon)}
          </Text>
        </>
      ) : null}

      {linkedId ? (
        <Section header={t('ui_profiles.known_animal')}>
          <Row
            icon="paw"
            iconColor={species === 'dog' ? c.dog : c.cat}
            title={
              animal?.nickname ||
              t(species === 'dog' ? 'ui_reid.unnamed_dog' : 'ui_reid.unnamed_cat')
            }
            subtitle={animal ? t('ui_reid.seen_times', { count: animal.sightings }) : undefined}
            trailing={
              linkStatus ? (
                <Tag
                  label={
                    linkStatus === 'confirmed'
                      ? t('ui_profiles.confirmed')
                      : t('ui_profiles.under_review')
                  }
                  tone={linkStatus === 'confirmed' ? 'accent' : 'warning'}
                />
              ) : undefined
            }
            onPress={() => router.push(`/animal/${linkedId}`)}
          />
        </Section>
      ) : null}

      {server && !local ? (
        <Section header={t('ui_profiles.recorded_by')}>
          <Row
            icon="profile"
            title={server.observer_name || t('ui_profiles.volunteer')}
            onPress={() => router.push(`/person/${server.observer_id}`)}
          />
        </Section>
      ) : null}

      {(local?.notes || server?.notes) && !local ? (
        <Card style={{ marginTop: 8 }}>
          <Text variant="footnote" tone="ink2">
            {t('ui_quick.notes')}
          </Text>
          <Text variant="body">{server?.notes}</Text>
        </Card>
      ) : null}

      {local ? (
        <View style={{ gap: 16, marginTop: 24 }}>
          <View style={{ gap: 6 }}>
            <Text variant="subhead" weight="600">
              {t('ui_sightings_v3.tag')}
            </Text>
            <TextInput
              value={tag}
              onChangeText={setTag}
              placeholder={t('ui_sightings_v3.tag_placeholder')}
              placeholderTextColor={c.ink3}
              style={input}
              accessibilityLabel={t('ui_sightings_v3.tag')}
              maxLength={40}
            />
            <Text variant="footnote" tone="ink2">
              {t('ui_sightings_v3.tag_hint')}
            </Text>
          </View>
          <View style={{ gap: 6 }}>
            <Text variant="subhead" weight="600">
              {t('ui_quick.notes')}
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder={t('ui_quick.notes_placeholder')}
              placeholderTextColor={c.ink3}
              style={[input, { minHeight: 72, textAlignVertical: 'top' }]}
              accessibilityLabel={t('ui_quick.notes')}
              maxLength={500}
            />
          </View>
          <Button
            title={t('common.save')}
            disabled={!changed}
            onPress={() => {
              onSave({
                ...local,
                identifier: tag.trim() || undefined,
                notes: notes.trim() || undefined,
              });
              onBack();
            }}
          />
          <Button
            kind="destructive"
            title={t('ui_sightings_v3.remove')}
            onPress={() =>
              Alert.alert(t('ui_sightings_v3.remove_title'), t('ui_sightings_v3.remove_body'), [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('ui_sightings_v3.remove'),
                  style: 'destructive',
                  onPress: () => {
                    onDelete(local.id);
                    onBack();
                  },
                },
              ])
            }
          />
        </View>
      ) : null}
    </Screen>
  );
}
