/**
 * "Seen this animal before?" Known animals of the same species within 300 m,
 * nearest first. The volunteer picks one (a proposed resighting a researcher
 * later confirms), registers a new animal to follow, or leaves it. When the
 * chosen animal is missing a side-on photo, the app asks for that side.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { generateUUID } from '../../utils/uuid';
import { resolveAnimalPhotoUrl } from '../../services/storageService';
import {
  missingFlank,
  nearbyAnimals,
  useKnownAnimals,
  type AnimalLink,
  type KnownAnimal,
} from '../../features/animals/knownAnimals';
import { AnimalFace, Button, Chip, Press, Segmented, Symbol, Text, useTheme } from '../../ui';

export type PhotoAngle = 'left_flank' | 'right_flank' | 'other';

export function KnownAnimalPicker({
  species,
  lat,
  lon,
  value,
  onChange,
  hasPhoto,
  photoAngle,
  onPhotoAngle,
  onTakePhoto,
}: {
  species: 'cat' | 'dog' | 'unknown';
  lat: number | null | undefined;
  lon: number | null | undefined;
  value: AnimalLink;
  onChange: (l: AnimalLink) => void;
  hasPhoto: boolean;
  photoAngle: PhotoAngle;
  onPhotoAngle: (a: PhotoAngle) => void;
  onTakePhoto: () => void;
}) {
  const { t } = useTranslation();
  const { c, radius } = useTheme();
  const animals = useKnownAnimals((s) => s.animals);
  const near = useMemo(
    () =>
      lat != null && lon != null && species !== 'unknown'
        ? nearbyAnimals(animals, species, lat, lon)
        : [],
    [animals, species, lat, lon]
  );
  if (species === 'unknown') return null;

  const chosen =
    value.kind === 'same'
      ? (near.find((a) => a.id === value.id) ?? animals.find((a) => a.id === value.id))
      : undefined;
  const missing = chosen ? missingFlank(chosen) : null;

  return (
    <View style={{ gap: 12 }}>
      <View>
        <Text variant="subhead" weight="600">
          {t('ui_reid.title')}
        </Text>
        <Text variant="footnote" tone="ink2">
          {near.length ? t('ui_reid.hint', { count: near.length }) : t('ui_reid.none_near')}
        </Text>
      </View>

      {near.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingRight: 4 }}
        >
          {near.map((a) => (
            <AnimalCard
              key={a.id}
              a={a}
              selected={value.kind === 'same' && value.id === a.id}
              onPress={() =>
                onChange(
                  value.kind === 'same' && value.id === a.id
                    ? { kind: 'none' }
                    : { kind: 'same', id: a.id, decision: 'same' }
                )
              }
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip
          icon="plus"
          label={t('ui_reid.new_animal')}
          selected={value.kind === 'new'}
          onPress={() =>
            onChange(value.kind === 'new' ? { kind: 'none' } : { kind: 'new', id: generateUUID() })
          }
        />
        <Chip
          label={t('ui_reid.skip')}
          selected={value.kind === 'none'}
          onPress={() => onChange({ kind: 'none' })}
        />
      </View>

      {value.kind === 'same' ? (
        <Segmented
          value={value.decision}
          onChange={(d) => onChange({ ...value, decision: d })}
          options={[
            { value: 'same', label: t('ui_reid.sure') },
            { value: 'unsure', label: t('ui_reid.not_sure') },
          ]}
        />
      ) : null}

      {value.kind === 'new' ? (
        <TextInput
          value={value.nickname ?? ''}
          onChangeText={(v) => onChange({ ...value, nickname: v })}
          placeholder={t('ui_reid.name_placeholder')}
          placeholderTextColor={c.ink3}
          maxLength={60}
          accessibilityLabel={t('ui_reid.name')}
          style={{
            backgroundColor: c.surface,
            borderRadius: radius.sm,
            paddingHorizontal: 12,
            minHeight: 44,
            fontSize: 17,
            color: c.ink,
          }}
        />
      ) : null}

      {/* Option A: ask for the side that is still missing */}
      {value.kind === 'same' && missing ? (
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            alignItems: 'center',
            backgroundColor: c.limeSoft,
            borderRadius: radius.lg,
            padding: 12,
          }}
        >
          <Symbol name="camera" size={20} color={c.accent} weight="semibold" />
          <Text variant="footnote" style={{ flex: 1, color: c.accent }}>
            {t(missing === 'left_flank' ? 'ui_reid.need_left' : 'ui_reid.need_right')}
          </Text>
          <Button
            kind="secondary"
            size="small"
            title={hasPhoto ? t('ui_quick.retake') : t('ui_quick.take_photo')}
            onPress={() => {
              onPhotoAngle(missing);
              onTakePhoto();
            }}
          />
        </View>
      ) : null}

      {value.kind !== 'none' && hasPhoto ? (
        <View style={{ gap: 6 }}>
          <Text variant="footnote" tone="ink2">
            {t('ui_reid.photo_shows')}
          </Text>
          <Segmented
            value={photoAngle}
            onChange={onPhotoAngle}
            options={[
              { value: 'left_flank', label: t('ui_reid.left') },
              { value: 'right_flank', label: t('ui_reid.right') },
              { value: 'other', label: t('ui_reid.other') },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

function AnimalCard({
  a,
  selected,
  onPress,
}: {
  a: KnownAnimal & { distanceM: number };
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { c, radius } = useTheme();
  const [url, setUrl] = useState('');
  useEffect(() => {
    let live = true;
    if (a.photoPath) resolveAnimalPhotoUrl(a.photoPath).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [a.photoPath]);
  const name = a.nickname || t(a.species === 'dog' ? 'ui_reid.unnamed_dog' : 'ui_reid.unnamed_cat');
  return (
    <Press
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}, ${t('ui_reid.seen_times', { count: a.sightings })}, ${Math.round(a.distanceM)} m`}
      style={{
        width: 128,
        borderRadius: radius.lg,
        backgroundColor: c.surface,
        borderWidth: 2,
        borderColor: selected ? c.accent : 'transparent',
        overflow: 'hidden',
      }}
    >
      {url ? (
        <Image
          source={{ uri: url }}
          style={{ width: '100%', height: 88, backgroundColor: c.fill }}
        />
      ) : (
        <View
          style={{
            height: 88,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.fill,
          }}
        >
          {a.species === 'cat' || a.species === 'dog' ? (
            <AnimalFace species={a.species} size={52} />
          ) : null}
        </View>
      )}
      <View style={{ padding: 8, gap: 2 }}>
        <Text variant="footnote" weight="600" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" tone="ink2" numberOfLines={1}>
          {t('ui_reid.seen_times', { count: a.sightings })}
        </Text>
        <Text variant="caption" tone="ink3" numberOfLines={1} tabular>
          {t('ui_reid.away', { m: Math.round(a.distanceM) })}
        </Text>
      </View>
      {selected ? (
        <View
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: c.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Symbol name="check" size={14} color={c.onAccent} weight="bold" />
        </View>
      ) : null}
    </Press>
  );
}
