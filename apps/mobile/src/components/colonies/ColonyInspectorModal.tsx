/**
 * Colony details (v3): what is known about a colony or pack, and a quick way
 * to log a visit. Sterilisation share is shown only when it was recorded.
 */

import React, { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useColoniesStore, type CatColony } from '../../features/colonies/coloniesStore';
import { formatCoordinates, formatObservedAt } from '../../utils/formatObservation';
import {
  AnimalFace,
  Button,
  Card,
  Chip,
  PageSheet,
  ProgressBar,
  Stat,
  Symbol,
  Tag,
  Text,
  useTheme,
  useToast,
} from '../../ui';

const CHECK_TAGS = [
  'food_ok',
  'water_refilled',
  'shelter_ok',
  'new_unsterilised',
  'injured',
  'all_healthy',
] as const;

export function ColonyInspectorModal({
  visible,
  colony,
  onClose,
}: {
  visible: boolean;
  colony: CatColony | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { c, radius } = useTheme();
  const { recordInspection } = useColoniesStore();
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setTags([]);
    setNotes('');
  }, [colony?.id]);

  if (!colony) return null;
  const pct =
    colony.estimatedPopulation > 0
      ? Math.round((colony.tnrSterilizedCount / colony.estimatedPopulation) * 100)
      : 0;
  const kind =
    colony.species === 'dog'
      ? t('ui_colonies_v3.pack')
      : colony.species === 'mixed'
        ? t('ui_colonies_v3.mixed_group')
        : t('ui_colonies_v3.colony');

  const saveCheck = () => {
    const summary = tags.map((k) => t(`ui_colonies_v3.check_${k}`)).join(', ');
    const full = [summary, notes.trim()].filter(Boolean).join(' | ');
    recordInspection(colony.id, full || undefined);
    useToast
      .getState()
      .show({ title: t('ui_colonies_v3.check_saved'), detail: colony.name, icon: 'checkCircle' });
    setTags([]);
    setNotes('');
    onClose();
  };

  return (
    <PageSheet
      visible={visible}
      title={kind}
      onClose={onClose}
      footer={
        <Button
          title={t('ui_colonies_v3.log_check')}
          icon="check"
          disabled={tags.length === 0 && !notes.trim()}
          onPress={saveCheck}
        />
      }
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        {colony.species === 'mixed' ? (
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: c.limeSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Symbol name="paw" size={28} color={c.accent} weight="semibold" />
          </View>
        ) : (
          <AnimalFace species={colony.species} size={60} />
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="title2">{colony.name}</Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Tag
              label={kind}
              tone={colony.species === 'dog' ? 'dog' : colony.species === 'cat' ? 'cat' : 'neutral'}
            />
            {colony.zone ? <Tag label={colony.zone} tone="neutral" /> : null}
          </View>
        </View>
      </View>

      {/* Numbers */}
      <Card style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', marginBottom: 14 }}>
          <Stat
            value={String(colony.estimatedPopulation)}
            label={t('ui_colonies_v3.animals_est')}
          />
          <Stat
            value={String(colony.tnrSterilizedCount)}
            label={t('ui_colonies_v3.sterilised_short')}
          />
          <Stat value={String(colony.inspectionsCount)} label={t('ui_colonies_v3.checks')} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text variant="footnote" tone="ink2">
            {t('ui_colonies_v3.sterilised_share')}
          </Text>
          <Text variant="footnote" weight="600" tabular>
            {pct}%
          </Text>
        </View>
        <ProgressBar value={pct / 100} label={t('ui_colonies_v3.sterilised_share')} />
      </Card>

      {/* Facts */}
      <Card padded={false} style={{ marginBottom: 24 }}>
        {[
          {
            icon: 'pin' as const,
            label: t('ui_colonies_v3.location'),
            value: formatCoordinates(colony.latitude, colony.longitude),
          },
          {
            icon: 'shield' as const,
            label: t('ui_colonies_v3.facilities'),
            value:
              [
                colony.hasWaterStation ? t('ui_colonies_v3.water') : null,
                colony.hasShelter ? t('ui_colonies_v3.shelter') : null,
              ]
                .filter(Boolean)
                .join(', ') || t('ui_colonies_v3.none'),
          },
          {
            icon: 'profile' as const,
            label: t('ui_colonies_v3.caretaker'),
            value: colony.caretakerName,
          },
          {
            icon: 'clock' as const,
            label: t('ui_colonies_v3.feeding'),
            value: colony.feedingSchedule,
          },
          {
            icon: 'checkCircle' as const,
            label: t('ui_colonies_v3.last_check'),
            value: formatObservedAt(colony.lastInspectedAt, {
              today: t('ui_common.today'),
              yesterday: t('ui_common.yesterday'),
            }),
          },
        ]
          .filter((r) => r.value)
          .map((r, i) => (
            <View
              key={r.label}
              style={{
                flexDirection: 'row',
                gap: 12,
                padding: 14,
                borderTopWidth: i ? 0.5 : 0,
                borderTopColor: c.hairline,
              }}
            >
              <Symbol name={r.icon} size={18} color={c.ink3} />
              <View style={{ flex: 1 }}>
                <Text variant="caption" tone="ink3">
                  {r.label}
                </Text>
                <Text variant="body" tabular>
                  {r.value}
                </Text>
              </View>
            </View>
          ))}
      </Card>
      {colony.notes ? (
        <Text variant="subhead" tone="ink2" style={{ marginTop: -12, marginBottom: 24 }}>
          {colony.notes}
        </Text>
      ) : null}

      {/* Log a visit */}
      <Text variant="title3" accessibilityRole="header" style={{ marginBottom: 4 }}>
        {t('ui_colonies_v3.today_visit')}
      </Text>
      <Text variant="footnote" tone="ink2" style={{ marginBottom: 12 }}>
        {t('ui_colonies_v3.today_visit_hint')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {CHECK_TAGS.map((k) => (
          <Chip
            key={k}
            label={t(`ui_colonies_v3.check_${k}`)}
            selected={tags.includes(k)}
            onPress={() =>
              setTags((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))
            }
          />
        ))}
      </View>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder={t('ui_colonies_v3.visit_notes')}
        placeholderTextColor={c.ink3}
        maxLength={500}
        accessibilityLabel={t('ui_colonies_v3.visit_notes')}
        style={{
          backgroundColor: c.surface,
          borderRadius: radius.sm,
          padding: 12,
          minHeight: 80,
          fontSize: 17,
          color: c.ink,
          textAlignVertical: 'top',
        }}
      />
    </PageSheet>
  );
}
