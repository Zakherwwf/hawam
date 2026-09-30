/**
 * Details for an animal logged during a walk. The animal is already saved the
 * moment Cat or Dog is tapped; this sheet only refines it. Nothing is filled
 * in on the observer's behalf: distance, direction and condition stay empty
 * until they are given (CLAUDE.md 1.4).
 */

import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, Image, ScrollView, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import type { InSurveyDetection } from '../../features/survey/surveyStore';
import { DISTANCE_CHIPS, bearingFromSide, type Side } from '../../features/survey/walkMath';
import { promptPhotoCaptureChoice } from '../../services/cameraService';
import {
  AnimalFace,
  Button,
  Chip,
  IconButton,
  Press,
  Segmented,
  Sheet,
  Symbol,
  Text,
  useTheme,
} from '../../ui';

const HEALTH = ['skin_lesions_mange', 'wound', 'limp', 'eye_nose_discharge', 'tumour'] as const;

export function LogAnimalSheet({
  detection,
  heading,
  tagSuggestions,
  onSave,
  onDelete,
  onClose,
}: {
  detection: InSurveyDetection | null;
  /** Walking direction from GPS, used for the left/ahead/right shortcut */
  heading?: number;
  tagSuggestions: string[];
  onSave: (d: InSurveyDetection) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { c, radius } = useTheme();
  const [d, setD] = useState<InSurveyDetection | null>(detection);
  const [side, setSide] = useState<Side | null>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    setD(detection);
    setSide(null);
    setMore(false);
  }, [detection]);

  if (!d) return null;
  const set = (patch: Partial<InSurveyDetection>) => setD({ ...d, ...patch });

  const measureCompass = async () => {
    try {
      const h = await Location.getHeadingAsync();
      const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
      if (deg >= 0) {
        set({ bearing_deg: Math.round(deg) });
        setSide(null);
      }
    } catch {
      Alert.alert(t('ui_walk.compass_failed_title'), t('ui_walk.compass_failed_body'));
    }
  };

  const pickSide = (s: Side) => {
    setSide(s);
    if (heading != null) set({ bearing_deg: bearingFromSide(heading, s) });
  };

  const photo = d.photoUris?.[0] ?? d.photoUri ?? null;
  const takePhoto = async () => {
    const p = await promptPhotoCaptureChoice(t('ui_quick.take_photo'), t('ui_quick.photo_hint'));
    if (p?.uri) set({ photoUri: p.uri, photoUris: [p.uri] });
  };

  const input = {
    backgroundColor: c.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    minHeight: 44,
    fontSize: 17,
    color: c.ink,
  } as const;
  const label = (text: string, hint?: string) => (
    <View style={{ marginBottom: 8 }}>
      <Text variant="subhead" weight="600">
        {text}
      </Text>
      {hint ? (
        <Text variant="footnote" tone="ink2">
          {hint}
        </Text>
      ) : null}
    </View>
  );
  const speciesName =
    d.species === 'cat'
      ? t('ui_quick.cat')
      : d.species === 'dog'
        ? t('ui_quick.dog')
        : t('ui_sightings_v3.animal');

  return (
    <Sheet visible={!!detection} onClose={onClose}>
      <ScrollView
        style={{ maxHeight: Dimensions.get('window').height * 0.72 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header: what was logged */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          {d.species === 'cat' || d.species === 'dog' ? (
            <AnimalFace species={d.species} size={52} />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text variant="title3">{t('ui_walk.logged', { species: speciesName })}</Text>
            <Text variant="footnote" tone="ink2">
              {t('ui_walk.logged_sub')}
            </Text>
          </View>
        </View>

        {/* Count */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <Text variant="subhead" weight="600" style={{ flex: 1 }}>
            {t('ui_quick.how_many')}
          </Text>
          <IconButton
            icon="minus"
            label={t('ui_quick.fewer')}
            tone="soft"
            onPress={() => set({ group_size: Math.max(1, d.group_size - 1) })}
          />
          <Text variant="title2" tabular align="center" style={{ minWidth: 44 }}>
            {d.group_size}
          </Text>
          <IconButton
            icon="plus"
            label={t('ui_quick.more_animals')}
            tone="soft"
            onPress={() => set({ group_size: Math.min(50, d.group_size + 1) })}
          />
        </View>

        {/* Distance */}
        {label(t('ui_walk.distance'), t('ui_walk.distance_hint'))}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {DISTANCE_CHIPS.map((m) => (
            <Chip
              key={m}
              label={t('ui_walk.metres', { m })}
              selected={d.distance_estimate_m === m}
              onPress={() => set({ distance_estimate_m: m })}
            />
          ))}
          <Chip
            label={t('ui_walk.not_estimated')}
            selected={d.distance_estimate_m == null}
            onPress={() => set({ distance_estimate_m: undefined })}
          />
        </View>

        {/* Direction */}
        {d.distance_estimate_m != null ? (
          <View style={{ marginBottom: 20 }}>
            {label(
              t('ui_walk.direction'),
              d.bearing_deg != null
                ? t('ui_walk.bearing_value', { deg: d.bearing_deg })
                : t('ui_walk.direction_hint')
            )}
            {heading != null ? (
              <Segmented
                value={side ?? ('' as Side)}
                onChange={pickSide}
                options={[
                  { value: 'left', label: t('ui_walk.left') },
                  { value: 'ahead', label: t('ui_walk.ahead') },
                  { value: 'right', label: t('ui_walk.right') },
                  { value: 'behind', label: t('ui_walk.behind') },
                ]}
                style={{ marginBottom: 8 }}
              />
            ) : null}
            <Button
              kind="secondary"
              size="small"
              icon="target"
              title={t('ui_walk.use_compass')}
              onPress={measureCompass}
            />
          </View>
        ) : null}

        {/* Photo */}
        {label(t('ui_walk.photo'))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          {photo ? (
            <Image
              source={{ uri: photo }}
              style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: c.fill }}
            />
          ) : null}
          <Button
            kind="secondary"
            size="small"
            icon="camera"
            title={photo ? t('ui_quick.retake') : t('ui_quick.take_photo')}
            onPress={takePhoto}
            style={{ flex: 1 }}
          />
          {photo ? (
            <IconButton
              icon="trash"
              label={t('ui_quick.remove_photo')}
              tone="soft"
              onPress={() => set({ photoUri: null, photoUris: [] })}
            />
          ) : null}
        </View>

        {/* Tag */}
        {label(t('ui_sightings_v3.tag'), t('ui_sightings_v3.tag_hint'))}
        <TextInput
          value={
            d.identifier && /^(CAT|DOG|OBS)-\d+$/.test(d.identifier) ? '' : (d.identifier ?? '')
          }
          onChangeText={(v) => set({ identifier: v })}
          placeholder={t('ui_sightings_v3.tag_placeholder')}
          placeholderTextColor={c.ink3}
          style={input}
          maxLength={40}
          accessibilityLabel={t('ui_sightings_v3.tag')}
        />
        {tagSuggestions.length ? (
          <View style={{ marginTop: 8, marginBottom: 4 }}>
            <Text variant="footnote" tone="ink2" style={{ marginBottom: 6 }}>
              {t('ui_walk.seen_before')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {tagSuggestions.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  icon="eye"
                  selected={d.identifier === tag}
                  onPress={() => set({ identifier: tag })}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* More details */}
        <Press
          onPress={() => setMore(!more)}
          accessibilityState={{ expanded: more }}
          accessibilityLabel={t('ui_quick.more_details')}
          style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, marginTop: 12 }}
        >
          <Text variant="body" style={{ flex: 1 }}>
            {t('ui_quick.more_details')}
          </Text>
          <View style={{ transform: [{ rotate: more ? '90deg' : '0deg' }] }}>
            <Symbol name="chevronRight" size={14} color={c.ink3} weight="semibold" />
          </View>
        </Press>
        {more ? (
          <View style={{ gap: 16, marginBottom: 12 }}>
            <View>
              {label(t('ui_quick.sex'))}
              <Segmented
                value={d.sex ?? 'unknown'}
                onChange={(v) => set({ sex: v })}
                options={[
                  { value: 'unknown', label: t('ui_quick.unknown') },
                  { value: 'female', label: t('ui_quick.female') },
                  { value: 'male', label: t('ui_quick.male') },
                ]}
              />
            </View>
            <View>
              {label(t('ui_quick.age'))}
              <Segmented
                value={d.age_class ?? 'unknown'}
                onChange={(v) => set({ age_class: v })}
                options={[
                  { value: 'unknown', label: t('ui_quick.unknown') },
                  { value: 'adult', label: t('ui_quick.adult') },
                  { value: 'juvenile', label: t('ui_quick.young') },
                ]}
              />
            </View>
            <View>
              {label(t('ui_quick.ear_tip'), t('ui_quick.ear_tip_hint'))}
              <Segmented
                value={d.ear_tip_or_notch ?? 'unknown'}
                onChange={(v) => set({ ear_tip_or_notch: v })}
                options={[
                  { value: 'unknown', label: t('ui_quick.unknown') },
                  { value: 'yes', label: t('common.yes') },
                  { value: 'no', label: t('common.no') },
                ]}
              />
            </View>
            <View>
              {label(
                t('ui_quick.body'),
                d.body_condition_score
                  ? t(`ui_quick.bcs_${d.body_condition_score}`)
                  : t('ui_quick.bcs_hint')
              )}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Press
                    key={n}
                    onPress={() =>
                      set({ body_condition_score: d.body_condition_score === n ? undefined : n })
                    }
                    accessibilityRole="radio"
                    accessibilityState={{ selected: d.body_condition_score === n }}
                    accessibilityLabel={`${n}, ${t(`ui_quick.bcs_${n}`)}`}
                    style={{
                      flex: 1,
                      height: 44,
                      borderRadius: radius.sm,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: d.body_condition_score === n ? c.accent : c.fill,
                    }}
                  >
                    <Text
                      variant="headline"
                      style={{ color: d.body_condition_score === n ? c.onAccent : c.ink }}
                    >
                      {n}
                    </Text>
                  </Press>
                ))}
              </View>
            </View>
            <View>
              {label(t('ui_quick.health'), t('ui_quick.health_hint'))}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {HEALTH.map((h) => {
                  const on = d.visible_health_issues?.includes(h) ?? false;
                  return (
                    <Chip
                      key={h}
                      label={t(`ui_quick.health_${h}`)}
                      selected={on}
                      onPress={() =>
                        set({
                          visible_health_issues: on
                            ? (d.visible_health_issues ?? []).filter((x) => x !== h)
                            : [...(d.visible_health_issues ?? []), h],
                        })
                      }
                    />
                  );
                })}
              </View>
            </View>
            <View>
              {label(t('ui_quick.notes'))}
              <TextInput
                value={d.notes ?? ''}
                onChangeText={(v) => set({ notes: v })}
                multiline
                maxLength={500}
                placeholder={t('ui_quick.notes_placeholder')}
                placeholderTextColor={c.ink3}
                style={[input, { minHeight: 72, paddingTop: 10, textAlignVertical: 'top' }]}
                accessibilityLabel={t('ui_quick.notes')}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <Button
          kind="destructive"
          title={t('common.delete')}
          onPress={() =>
            Alert.alert(t('survey.delete_detection'), t('survey.confirm_delete_msg'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('common.delete'), style: 'destructive', onPress: () => onDelete(d.id) },
            ])
          }
          style={{ flex: 1 }}
        />
        <Button
          title={t('common.done')}
          icon="check"
          onPress={() => onSave(d)}
          style={{ flex: 2 }}
        />
      </View>
    </Sheet>
  );
}
