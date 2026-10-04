/**
 * A volunteer's public profile, opened from the leaderboard: the effort
 * figures leaderboards already show (kilometres, complete checklists,
 * sightings) and the known animals they registered. Nothing private: no
 * email, no tracks, no locations.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Avatar, StatGrid } from '../components/profile/ProfileBits';
import { useKnownAnimals } from '../features/animals/knownAnimals';
import { fetchPersonProfile, type PersonProfile } from '../services/profiles';
import { supabase } from '../services/supabase';
import { formatObservedAt } from '../utils/formatObservation';
import { EmptyState, Row, Screen, Section, Tag, Text, useTheme } from '../ui';

export function PersonProfileScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const { c } = useTheme();
  const [p, setP] = useState<PersonProfile | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'offline'>('loading');
  const [me, setMe] = useState<string | null>(null);
  const animals = useKnownAnimals((s) => s.animals);
  const registered = useMemo(
    () => animals.filter((a) => a.createdBy === id).sort((a, b) => b.sightings - a.sightings),
    [animals, id]
  );

  const load = async () => {
    setState('loading');
    const res = await fetchPersonProfile(id);
    setP(res);
    setState(res ? 'ready' : 'offline');
  };
  useEffect(() => {
    load();
    supabase.auth.getSession().then(({ data }) => setMe(data.session?.user.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const name =
    id === me ? t('ui_common.you') : p?.displayName?.trim() || t('ui_profiles.volunteer');
  const km = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(
    p?.distanceKm ?? 0
  );
  const since = p?.memberSince
    ? new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(
        new Date(p.memberSince)
      )
    : null;

  if (state === 'loading' && !p)
    return (
      <Screen title={t('ui_profiles.volunteer')} onBack={onBack} inTabs={false}>
        <ActivityIndicator color={c.accent} style={{ marginTop: 48 }} />
      </Screen>
    );
  if (!p)
    return (
      <Screen
        title={t('ui_profiles.volunteer')}
        onBack={onBack}
        inTabs={false}
        onRefresh={load}
        refreshing={false}
      >
        <EmptyState
          icon="profile"
          title={t('ui_profiles.person_missing')}
          message={t('ui_profiles.offline')}
        />
      </Screen>
    );

  return (
    <Screen
      title=""
      onBack={onBack}
      inTabs={false}
      onRefresh={load}
      refreshing={false}
      header={
        <View style={{ alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Avatar id={id} name={p.displayName} size={88} />
          <Text variant="title1" align="center">
            {name}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Tag label={t(`ui_profiles.role_${p.role}`)} tone="neutral" />
          </View>
          {since ? (
            <Text variant="footnote" tone="ink2">
              {t('ui_profiles.member_since', { date: since })}
            </Text>
          ) : null}
        </View>
      }
    >
      <StatGrid
        items={[
          { value: String(p.cats), label: t('ui_profiles.cats_counted') },
          { value: String(p.dogs), label: t('ui_profiles.dogs_counted') },
          { value: String(p.surveys), label: t('ui_profiles.surveys') },
          { value: t('ui_progress_v3.km_value', { km }), label: t('ui_profiles.km_surveyed') },
          { value: String(p.completeChecklists), label: t('ui_profiles.complete_checklists') },
          { value: String(p.sightings), label: t('ui_profiles.sightings') },
        ]}
      />
      <Text variant="headline" style={{ marginTop: 24, marginBottom: 10 }}>
        {t('ui_profiles.colonies_packs')}
      </Text>
      <StatGrid
        items={[
          { value: String(p.coloniesRegistered), label: t('ui_profiles.colonies_registered') },
          { value: String(p.packsRegistered), label: t('ui_profiles.packs_registered') },
          { value: String(p.coloniesVisited), label: t('ui_profiles.colonies_visited') },
          { value: String(p.packsVisited), label: t('ui_profiles.packs_visited') },
        ]}
      />
      <Text
        variant="footnote"
        tone="ink2"
        style={{ marginTop: 10, marginHorizontal: 4, marginBottom: 20 }}
      >
        {p.lastSurveyAt
          ? t('ui_profiles.last_survey', {
              when: formatObservedAt(p.lastSurveyAt, {
                today: t('ui_common.today'),
                yesterday: t('ui_common.yesterday'),
              }),
            })
          : t('ui_profiles.no_survey_yet')}
      </Text>

      <Section header={t('ui_profiles.animals_registered')} footer={t('ui_profiles.privacy_note')}>
        {registered.length === 0 ? (
          <Row title={t('ui_profiles.no_animals_registered')} />
        ) : (
          registered
            .slice(0, 20)
            .map((a) => (
              <Row
                key={a.id}
                icon="paw"
                iconColor={a.species === 'dog' ? c.dog : c.cat}
                title={
                  a.nickname ||
                  t(a.species === 'dog' ? 'ui_reid.unnamed_dog' : 'ui_reid.unnamed_cat')
                }
                subtitle={t('ui_reid.seen_times', { count: a.sightings })}
                onPress={() => router.push(`/animal/${a.id}`)}
              />
            ))
        )}
      </Section>
    </Screen>
  );
}
