/**
 * Sightings tab (v3): the volunteer's own records, newest first, grouped by
 * day, with a clear upload status. A second segment groups records that share
 * a tag into known animals (resightings), which used to be a separate tab.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  AnimalFace,
  Button,
  Card,
  Chip,
  EmptyState,
  Press,
  Row,
  Screen,
  Section,
  Segmented,
  StreetScene,
  Symbol,
  Tag,
  Text,
  useTheme,
} from '../ui';
import type { SightingItem } from '../app-state/types';
import { useSyncStore } from '../features/sync/syncStore';
import { useToast } from '../ui/Toast';
import { useKnownAnimals } from '../features/animals/knownAnimals';
import { supabase } from '../services/supabase';
import { resolveAnimalPhotoUrl } from '../services/storageService';
import { formatDay, formatObservedAt, formatTime } from '../utils/formatObservation';

type Filter = 'all' | 'cat' | 'dog' | 'photo';

export function SightingsTab({
  sightings,
  onAddNew,
}: {
  sightings: SightingItem[];
  onAddNew: () => void;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const pending = useSyncStore((s) => s.pendingCount);
  const syncing = useSyncStore((s) => s.isSyncing);
  const lastError = useSyncStore((s) => s.outbox.find((o) => o.lastError)?.lastError);
  const [view, setView] = useState<'all' | 'known'>('all');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

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

  // Animals this volunteer registered, as the server knows them
  const animals = useKnownAnimals((st) => st.animals);
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setMe(data.session?.user.id ?? null));
  }, []);
  const mine = useMemo(
    () =>
      animals
        .filter((a) => a.createdBy && a.createdBy === me)
        .sort((x, y) => y.sightings - x.sightings),
    [animals, me]
  );

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
              {lastError
                ? t('ui_sightings_v3.waiting_error', { error: lastError })
                : t('ui_sightings_v3.waiting_body')}
            </Text>
          </View>
          <Button
            kind="plain"
            size="small"
            title={t('ui_sightings_v3.upload_now')}
            loading={syncing}
            onPress={async () => {
              const res = await useSyncStore.getState().triggerSync();
              const left = useSyncStore.getState().pendingCount;
              if (res.alreadyUploaded > 0)
                useToast.getState().show({
                  title: t('ui_sightings_v3.already_uploaded', { count: res.alreadyUploaded }),
                  icon: 'checkCircle',
                });
              if (res.syncedCount > 0)
                useToast.getState().show({
                  title: t('ui_sightings_v3.uploaded_n', { count: res.syncedCount }),
                  icon: 'upload',
                });
              if (left > 0) {
                const err = useSyncStore.getState().outbox.find((o) => o.lastError)?.lastError;
                Alert.alert(
                  t('ui_sightings_v3.still_waiting', { count: left }),
                  err
                    ? t('ui_sightings_v3.reason', { error: err })
                    : t('ui_sightings_v3.offline_reason'),
                  [
                    { text: t('common.done'), style: 'cancel' },
                    {
                      text: t('ui_sightings_v3.remove_stuck'),
                      style: 'destructive',
                      onPress: () =>
                        Alert.alert(
                          t('ui_sightings_v3.remove_stuck_title'),
                          t('ui_sightings_v3.remove_stuck_body'),
                          [
                            { text: t('common.cancel'), style: 'cancel' },
                            {
                              text: t('ui_sightings_v3.remove_stuck'),
                              style: 'destructive',
                              onPress: () => useSyncStore.getState().discardFailed(),
                            },
                          ]
                        ),
                    },
                  ]
                );
              }
            }}
          />
        </Card>
      ) : null}

      {sightings.length === 0 ? (
        <EmptyState
          art={<StreetScene style={{ marginBottom: 8 }} />}
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
                      <SightingRow
                        key={s.id}
                        s={s}
                        onPress={() => router.push(`/sighting/${s.id}`)}
                      />
                    ))}
                  </Section>
                ))
              )}
            </>
          ) : mine.length === 0 ? (
            <EmptyState
              icon="eye"
              title={t('ui_reid.mine_empty_title')}
              message={t('ui_reid.mine_empty_body')}
            />
          ) : (
            <Section footer={t('ui_reid.mine_footer')}>
              {mine.map((a) => (
                <Row
                  key={a.id}
                  icon="paw"
                  iconColor={a.species === 'dog' ? c.dog : c.cat}
                  title={
                    a.nickname ||
                    t(a.species === 'dog' ? 'ui_reid.unnamed_dog' : 'ui_reid.unnamed_cat')
                  }
                  subtitle={[
                    t('ui_reid.seen_times', { count: a.sightings }),
                    a.lastSeen
                      ? formatObservedAt(a.lastSeen, {
                          today: t('ui_common.today'),
                          yesterday: t('ui_common.yesterday'),
                        })
                      : null,
                    a.coatPattern ? t(`ui_reid.coat_${a.coatPattern}`) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  onPress={() => router.push(`/animal/${a.id}`)}
                />
              ))}
            </Section>
          )}
        </>
      )}
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
  if (url)
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.fill }}
      />
    );
  if (s.species === 'cat' || s.species === 'dog')
    return <AnimalFace species={s.species} size={size} />;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.fill,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Symbol name="paw" size={size * 0.45} color={c.ink3} weight="semibold" />
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
  const time = formatTime(s.observed_at);
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
