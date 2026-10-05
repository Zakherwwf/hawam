/**
 * End of a walk: the effort in numbers, the eBird complete-checklist question
 * (CLAUDE.md 1.3), and what the server will award. A walk with no animals is
 * presented as the result it is, not as a failure.
 */

import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { surveyXpPreview } from '../../features/survey/walkMath';
import {
  Button,
  Chip,
  Gradient,
  IconButton,
  Press,
  Sheet,
  Stat,
  Symbol,
  Text,
  useTheme,
} from '../../ui';

export type Weather = 'clear' | 'cloudy' | 'rain' | 'wind';
export interface WalkConditions {
  weather: Weather | null;
  observers: number;
}

export function FinishWalkSheet({
  visible,
  seconds,
  km,
  stationary,
  observations,
  onSave,
  onKeepWalking,
}: {
  visible: boolean;
  seconds: number;
  km: number;
  stationary: boolean;
  observations: { species: string; group_size: number; hasPhoto: boolean }[];
  onSave: (completeChecklist: boolean, conditions: WalkConditions) => void;
  onKeepWalking: () => void;
}) {
  const { t } = useTranslation();
  const { c, g, radius } = useTheme();
  const [complete, setComplete] = useState<boolean | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [observers, setObservers] = useState(1);
  useEffect(() => {
    if (visible) {
      setComplete(null);
      setWeather(null);
      setObservers(1);
    }
  }, [visible]);

  const animals = observations.reduce((a, o) => a + o.group_size, 0);
  const cats = observations
    .filter((o) => o.species === 'cat')
    .reduce((a, o) => a + o.group_size, 0);
  const dogs = observations
    .filter((o) => o.species === 'dog')
    .reduce((a, o) => a + o.group_size, 0);
  const xp = surveyXpPreview({ km, observations });
  const mins = Math.floor(seconds / 60);
  const time = `${mins}:${String(seconds % 60).padStart(2, '0')}`;

  const option = (value: boolean, title: string, body: string) => {
    const on = complete === value;
    return (
      <Press
        onPress={() => setComplete(value)}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${title}. ${body}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 16,
          borderRadius: radius.lg,
          backgroundColor: on ? c.limeSoft : c.surface,
          borderWidth: 2,
          borderColor: on ? c.accent : 'transparent',
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            borderWidth: 2,
            borderColor: on ? c.accent : c.ink3,
            backgroundColor: on ? c.accent : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {on ? <Symbol name="check" size={15} color={c.onAccent} weight="bold" /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="headline">{title}</Text>
          <Text variant="footnote" tone="ink2">
            {body}
          </Text>
        </View>
      </Press>
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={onKeepWalking}
      title={stationary ? t('ui_walk.finish_count') : t('ui_walk.finish_walk')}
    >
      <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.62 }}>
        <Gradient
          colors={g.hero.slice(0, 2)}
          diagonal
          style={{ borderRadius: radius.lg, padding: 16, flexDirection: 'row', marginBottom: 16 }}
        >
          {[
            { v: time, l: t('ui_walk.time') },
            ...(stationary ? [] : [{ v: km.toFixed(2), l: t('ui_progress_v3.km') }]),
            { v: String(animals), l: t('ui_walk.animals') },
          ].map((s) => (
            <View key={s.l} style={{ flex: 1 }} accessible accessibilityLabel={`${s.v} ${s.l}`}>
              <Text variant="title2" tabular style={{ color: '#FFFFFF' }}>
                {s.v}
              </Text>
              <Text variant="footnote" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {s.l}
              </Text>
            </View>
          ))}
        </Gradient>
        {animals > 0 ? (
          <View style={{ flexDirection: 'row', marginBottom: 16, paddingHorizontal: 4 }}>
            <Stat value={String(cats)} label={t('ui_map_v3.cats')} />
            <Stat value={String(dogs)} label={t('ui_map_v3.dogs')} />
            <Stat
              value={String(observations.filter((o) => o.hasPhoto).length)}
              label={t('ui_walk.photos')}
            />
          </View>
        ) : null}

        {/* Effort conditions (CLAUDE.md 1.2): weather and team size */}
        <Text variant="headline" style={{ marginBottom: 8 }}>
          {t('ui_walk.weather_q')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {(['clear', 'cloudy', 'rain', 'wind'] as const).map((w) => (
            <Chip
              key={w}
              label={t(`ui_walk.weather_${w}`)}
              selected={weather === w}
              onPress={() => setWeather(weather === w ? null : w)}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ flex: 1 }}>
            <Text variant="headline">{t('ui_walk.observers_q')}</Text>
            <Text variant="footnote" tone="ink2">
              {t('ui_walk.observers_hint')}
            </Text>
          </View>
          <IconButton
            icon="minus"
            tone="soft"
            label={t('ui_walk.fewer_people')}
            onPress={() => setObservers(Math.max(1, observers - 1))}
          />
          <Text
            variant="title3"
            tabular
            align="center"
            style={{ minWidth: 40 }}
            accessibilityLabel={t('ui_walk.observers_value', { count: observers })}
          >
            {observers}
          </Text>
          <IconButton
            icon="plus"
            tone="soft"
            label={t('ui_walk.more_people')}
            onPress={() => setObservers(Math.min(50, observers + 1))}
          />
        </View>

        <Text variant="headline" style={{ marginBottom: 10 }}>
          {t('ui_walk.checklist_q')}
        </Text>
        <View style={{ gap: 10, marginBottom: 16 }}>
          {option(
            true,
            t('ui_walk.checklist_yes'),
            animals === 0 ? t('ui_walk.checklist_yes_zero') : t('ui_walk.checklist_yes_body')
          )}
          {option(false, t('ui_walk.checklist_no'), t('ui_walk.checklist_no_body'))}
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
            paddingHorizontal: 4,
          }}
        >
          <Symbol name="bolt" size={16} color={c.warmInk} weight="semibold" />
          <Text variant="footnote" tone="ink2" style={{ flex: 1 }}>
            {t('ui_walk.xp_preview', { xp: xp.total })}
          </Text>
        </View>
      </ScrollView>
      <Button
        title={t('ui_walk.save')}
        icon="upload"
        disabled={complete === null}
        onPress={() => complete !== null && onSave(complete, { weather, observers })}
      />
      <Button
        kind="plain"
        title={stationary ? t('ui_walk.keep_counting') : t('ui_walk.keep_walking')}
        onPress={onKeepWalking}
        style={{ marginTop: 4 }}
      />
    </Sheet>
  );
}
