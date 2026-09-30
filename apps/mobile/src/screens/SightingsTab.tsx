/**
 * Sightings tab (v3): the volunteer's own records, newest first, grouped by
 * day, with a clear upload status. A second segment groups records that share
 * a tag into known animals (resightings), which used to be a separate tab.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Press,
  Row,
  Screen,
  Section,
  Segmented,
  Sheet,
  Symbol,
  Tag,
  Text,
  useTheme,
} from '../ui';
import type { SightingItem } from '../app-state/types';
import { useSyncStore } from '../features/sync/syncStore';
import { resolveAnimalPhotoUrl } from '../services/storageService';
import { formatCoordinates, formatDay, formatObservedAt } from '../utils/formatObservation';

type Filter = 'all' | 'cat' | 'dog' | 'photo';

export function SightingsTab({
  sightings,
  onAddNew,
  onUpdateSighting,
  onDeleteSighting,
}: {
  sightings: SightingItem[];
  onAddNew: () => void;
  onUpdateSighting: (s: SightingItem) => void;
  onDeleteSighting: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const pending = useSyncStore((s) => s.pendingCount);
  const syncing = useSyncStore((s) => s.isSyncing);
  const [view, setView] = useState<'all' | 'known'>('all');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<SightingItem | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sightings
      .filter((s) => (filter === 'cat' || filter === 'dog' ? s.species === filter : true))
      .filter((s) => (filter === 'photo' ? (s.photos?.length ?? 0) > 0 : true))
      .filter((s) =>
        q
          ? [s.identifier, s.publicCode, s.notes, s.species].some((v) =>
              v?.toLowerCase().includes(q)
            )
          : true
      )
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at));
  }, [sightings, filter, query]);

  const byDay = useMemo(() => {
    const groups: { label: string; items: SightingItem[] }[] = [];
    for (const s of filtered) {
      const label = formatDay(s.observed_at, {
        today: t('ui_common.today'),
        yesterday: t('ui_common.yesterday'),
      });
      const g = groups[groups.length - 1];
      if (g && g.label === label) g.items.push(s);
      else groups.push({ label, items: [s] });
    }
    return groups;
  }, [filtered, t]);

  const known = useMemo(() => {
    const m = new Map<string, SightingItem[]>();
    for (const s of sightings) {
      const tag = s.identifier?.trim();
      if (!tag) continue;
      m.set(tag, [...(m.get(tag) ?? []), s]);
    }
    return [...m.entries()]
      .map(([tag, items]) => ({
        tag,
        items: items.sort((a, b) => b.observed_at.localeCompare(a.observed_at)),
      }))
      .sort((a, b) => b.items.length - a.items.length || a.tag.localeCompare(b.tag));
  }, [sightings]);

  const cats = sightings.filter((s) => s.species === 'cat').length;
  const dogs = sightings.filter((s) => s.species === 'dog').length;

  return (
    <Screen
      title={t('ui_tabs.sightings')}
      subtitle={
        sightings.length
          ? t('ui_sightings_v3.summary', { total: sightings.length, cats, dogs })
          : undefined
      }
    >
      {pending > 0 ? (
        <Card
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
            backgroundColor: c.warningSoft,
          }}
        >
          <Symbol name="upload" color={c.warning} weight="semibold" />
          <View style={{ flex: 1 }}>
            <Text variant="subhead" weight="600" style={{ color: c.warning }}>
              {t('ui_sightings_v3.waiting', { count: pending })}
            </Text>
            <Text variant="footnote" tone="ink2">
              {t('ui_sightings_v3.waiting_body')}
            </Text>
          </View>
          <Button
            kind="plain"
            size="small"
            title={t('ui_sightings_v3.upload_now')}
            loading={syncing}
            onPress={() => useSyncStore.getState().triggerSync()}
          />
        </Card>
      ) : null}

      {sightings.length === 0 ? (
        <EmptyState
          icon="paw"
          title={t('ui_sightings_v3.empty_title')}
          message={t('ui_sightings_v3.empty_body')}
          action={<Button title={t('ui_record.quick')} icon="camera" onPress={onAddNew} />}
        />
      ) : (
        <>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'all', label: t('ui_sightings_v3.all') },
              { value: 'known', label: t('ui_sightings_v3.known') },
            ]}
            style={{ marginBottom: 16 }}
          />

          {view === 'all' ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <Chip
                  label={t('ui_sightings_v3.f_all')}
                  selected={filter === 'all'}
                  onPress={() => setFilter('all')}
                />
                <Chip
                  label={t('ui_quick.cat')}
                  selected={filter === 'cat'}
                  color={c.cat}
                  onPress={() => setFilter(filter === 'cat' ? 'all' : 'cat')}
                />
                <Chip
                  label={t('ui_quick.dog')}
                  selected={filter === 'dog'}
                  color={c.dog}
                  onPress={() => setFilter(filter === 'dog' ? 'all' : 'dog')}
                />
                <Chip
                  label={t('ui_sightings_v3.f_photo')}
                  icon="camera"
                  selected={filter === 'photo'}
                  onPress={() => setFilter(filter === 'photo' ? 'all' : 'photo')}
                />
              </View>
              {sightings.length > 8 ? <SearchField value={query} onChange={setQuery} /> : null}

              {byDay.length === 0 ? (
                <Text variant="subhead" tone="ink2" align="center" style={{ marginVertical: 32 }}>
                  {t('ui_sightings_v3.no_match')}
                </Text>
              ) : (
                byDay.map((g) => (
                  <Section key={g.label} header={g.label}>
                    {g.items.map((s) => (
                      <SightingRow key={s.id} s={s} onPress={() => setOpen(s)} />
                    ))}
                  </Section>
                ))
              )}
            </>
          ) : known.length === 0 ? (
            <EmptyState
              icon="eye"
              title={t('ui_sightings_v3.known_empty_title')}
              message={t('ui_sightings_v3.known_empty_body')}
            />
          ) : (
            <Section footer={t('ui_sightings_v3.known_footer')}>
              {known.map((k) => (
                <Row
                  key={k.tag}
                  icon="paw"
                  iconColor={k.items[0].species === 'dog' ? c.dog : c.cat}
                  title={k.tag}
                  subtitle={t('ui_sightings_v3.seen_times', {
                    count: k.items.length,
                    when: formatObservedAt(k.items[0].observed_at, {
                      today: t('ui_common.today'),
                      yesterday: t('ui_common.yesterday'),
                    }),
                  })}
                  onPress={() => setOpen(k.items[0])}
                />
              ))}
            </Section>
          )}
        </>
      )}

      <SightingSheet
        s={open}
        onClose={() => setOpen(null)}
        onSave={(u) => {
          onUpdateSighting(u);
          setOpen(null);
        }}
        onDelete={(id) => {
          onDeleteSighting(id);
          setOpen(null);
        }}
      />
    </Screen>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const { c, radius } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: c.fill,
        borderRadius: radius.sm,
        paddingHorizontal: 10,
        marginBottom: 20,
        minHeight: 40,
      }}
    >
      <Symbol name="search" size={16} color={c.ink3} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={t('ui_sightings_v3.search')}
        placeholderTextColor={c.ink3}
        accessibilityLabel={t('ui_sightings_v3.search')}
        autoCorrect={false}
        style={{ flex: 1, fontSize: 17, color: c.ink, paddingVertical: 8 }}
        clearButtonMode="while-editing"
      />
    </View>
  );
}

function usePhotoUrl(path?: string) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let live = true;
    if (path) resolveAnimalPhotoUrl(path).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [path]);
  return url;
}

function Thumb({ s, size = 48 }: { s: SightingItem; size?: number }) {
  const { c } = useTheme();
  const url = usePhotoUrl(s.photos?.[0]);
  const tint = s.species === 'dog' ? c.dog : s.species === 'cat' ? c.cat : c.ink3;
  const soft = s.species === 'dog' ? c.dogSoft : s.species === 'cat' ? c.catSoft : c.fill;
  if (url)
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.fill }}
      />
    );
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: soft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Symbol name="paw" size={size * 0.45} color={tint} weight="semibold" />
    </View>
  );
}

function speciesLabel(t: (k: string) => string, s: SightingItem['species']) {
  return s === 'cat'
    ? t('ui_quick.cat')
    : s === 'dog'
      ? t('ui_quick.dog')
      : t('ui_sightings_v3.animal');
}

function SightingRow({ s, onPress }: { s: SightingItem; onPress: () => void }) {
  const { t } = useTranslation();
  const title = s.identifier?.trim() || speciesLabel(t, s.species);
  const time = new Date(s.observed_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const code = s.publicCode ?? t('ui_common.code_pending');
  const status = s.syncPending ? t('ui_sightings_v3.waiting_tag') : t('ui_sightings_v3.uploaded');
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={`${title}, ${t('ui_quick.count_value', { count: s.group_size || 1 })}, ${time}, ${status}`}
      style={{
        minHeight: 72,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <Thumb s={s} size={48} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="headline" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="footnote" tone="ink2" numberOfLines={1} tabular>
          {s.syncPending ? time : `${code} · ${time}`}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text variant="headline" tabular>
          {t('ui_sightings_v3.times', { count: s.group_size || 1 })}
        </Text>
        <Tag label={status} tone={s.syncPending ? 'warning' : 'accent'} />
      </View>
    </Press>
  );
}

function SightingSheet({
  s,
  onClose,
  onSave,
  onDelete,
}: {
  s: SightingItem | null;
  onClose: () => void;
  onSave: (s: SightingItem) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { c, radius } = useTheme();
  const [tag, setTag] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => {
    setTag(s?.identifier ?? '');
    setNotes(s?.notes ?? '');
  }, [s]);
  const url = usePhotoUrl(s?.photos?.[0]);
  if (!s) return null;
  const changed = tag.trim() !== (s.identifier ?? '') || notes.trim() !== (s.notes ?? '');
  const input = {
    backgroundColor: c.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 17,
    color: c.ink,
  } as const;
  return (
    <Sheet visible={!!s} onClose={onClose} title={s.publicCode ?? speciesLabel(t, s.species)}>
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          {url ? (
            <Image
              source={{ uri: url }}
              style={{ width: 112, height: 112, borderRadius: radius.lg, backgroundColor: c.fill }}
              accessibilityLabel={t('ui_quick.photo_taken')}
            />
          ) : (
            <Thumb s={s} size={112} />
          )}
          <View style={{ flex: 1, gap: 4, justifyContent: 'center' }}>
            <Text variant="headline">
              {speciesLabel(t, s.species)} · {t('ui_quick.count_value', { count: s.group_size })}
            </Text>
            <Text variant="footnote" tone="ink2">
              {formatObservedAt(s.observed_at, {
                today: t('ui_common.today'),
                yesterday: t('ui_common.yesterday'),
              })}
            </Text>
            <Text variant="footnote" tone="ink2" tabular>
              {formatCoordinates(s.latitude, s.longitude)}
            </Text>
            <Text variant="footnote" style={{ color: s.syncPending ? c.warning : c.accent }}>
              {s.syncPending ? t('ui_sightings_v3.not_uploaded') : t('ui_sightings_v3.uploaded')}
            </Text>
          </View>
        </View>
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
          onPress={() =>
            onSave({ ...s, identifier: tag.trim() || undefined, notes: notes.trim() || undefined })
          }
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
                onPress: () => onDelete(s.id),
              },
            ])
          }
        />
      </View>
    </Sheet>
  );
}
