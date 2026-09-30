/**
 * Progress tab (v3): level, weekly streak, weekly quests, badges and the
 * effort leaderboard. Every number comes from the server (useProgressData);
 * nothing here ranks or rewards by animals counted (CLAUDE.md section 2).
 */

import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  ProgressBar,
  ProgressRing,
  Row,
  Screen,
  Section,
  Segmented,
  Stat,
  Symbol,
  Text,
  useTheme,
} from '../ui';
import {
  XP_WEIGHTS,
  badges,
  completeChecklists,
  daysUntilReset,
  levelProgress,
  rankBoard,
  recentWeeks,
  weeklyQuests,
  weeklyStreak,
  type BadgeProgress,
  type BoardMetric,
  type Quest,
} from '../features/gamification/progress';
import {
  useEffortBoard,
  useMySessions,
  useMyStats,
  useRefreshProgressOnSync,
} from '../features/gamification/useProgressData';

const fmtKm = (n: number) => (n >= 100 ? Math.round(n).toString() : n.toFixed(1));

export function ProgressTab({ onStartSurvey }: { onStartSurvey: () => void }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  useRefreshProgressOnSync();
  const stats = useMyStats();
  const sessions = useMySessions();
  const board = useEffortBoard();
  const [metric, setMetric] = useState<BoardMetric>('km');

  const s = stats.data;
  const lv = levelProgress(s?.xp ?? 0);
  const list = sessions.data ?? [];
  const streak = weeklyStreak(list);
  const weeks = recentWeeks(list, 8);
  const quests = weeklyQuests(list);
  const earned = s ? badges(s) : [];
  const ranked = useMemo(
    () => (board.data ? rankBoard(board.data.rows, metric, board.data.meId) : []),
    [board.data, metric]
  );
  const me = ranked.find((r) => r.isMe);
  const top = ranked.slice(0, 10);
  const refreshing = stats.isRefetching || sessions.isRefetching || board.isRefetching;
  const failed = stats.isError && !s;

  return (
    <Screen
      title={t('ui_progress_v3.title')}
      onRefresh={() => {
        stats.refetch();
        sessions.refetch();
        board.refetch();
      }}
      refreshing={refreshing}
    >
      {failed ? (
        <Card style={{ marginBottom: 20, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Symbol name="info" color={c.warning} />
          <Text variant="subhead" tone="ink2" style={{ flex: 1 }}>
            {t('ui_progress_v3.offline')}
          </Text>
        </Card>
      ) : null}

      {/* Level */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 12 }}>
        <ProgressRing
          value={lv.fraction}
          size={112}
          stroke={11}
          label={t('ui_progress_v3.level_n', { n: lv.level })}
        >
          <Text variant="caption" tone="ink2">
            {t('ui_progress_v3.level')}
          </Text>
          <Text variant="title1" tabular style={{ fontSize: 34, lineHeight: 40 }}>
            {lv.level}
          </Text>
        </ProgressRing>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="title3">{t(lv.rankKey)}</Text>
          <Text variant="subhead" tone="ink2" tabular>
            {t('ui_progress_v3.xp_total', { xp: (s?.xp ?? 0).toLocaleString() })}
          </Text>
          <Text variant="footnote" tone="ink3">
            {lv.toNext == null
              ? t('ui_progress_v3.top_level')
              : t('ui_progress_v3.xp_to_next', { xp: lv.toNext, level: lv.level + 1 })}
          </Text>
        </View>
      </Card>

      {/* Weekly streak */}
      <Card style={{ marginBottom: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: streak.weeks > 0 ? c.warningSoft : c.fill,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Symbol
              name="flame"
              size={20}
              color={streak.weeks > 0 ? c.warning : c.ink3}
              weight="semibold"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="headline">
              {streak.weeks > 0
                ? t('ui_progress_v3.streak_weeks', { count: streak.weeks })
                : t('ui_progress_v3.no_streak')}
            </Text>
            <Text variant="footnote" tone="ink2">
              {streak.thisWeekDone
                ? t('ui_progress_v3.streak_safe')
                : streak.weeks > 0
                  ? t('ui_progress_v3.streak_keep', { count: daysUntilReset() })
                  : t('ui_progress_v3.streak_start')}
            </Text>
          </View>
        </View>
        <View
          style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}
          accessible
          accessibilityLabel={t('ui_progress_v3.streak_strip', {
            count: weeks.filter(Boolean).length,
          })}
        >
          {weeks.map((on, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                backgroundColor: on ? c.warning : c.fill,
                opacity: i === weeks.length - 1 && !on ? 0.5 : 1,
              }}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text variant="caption" tone="ink3">
            {t('ui_progress_v3.eight_weeks_ago')}
          </Text>
          <Text variant="caption" tone="ink3">
            {t('ui_progress_v3.this_week')}
          </Text>
        </View>
      </Card>

      {/* Weekly quests */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          marginBottom: 8,
          marginHorizontal: 4,
        }}
      >
        <Text variant="title3" style={{ flex: 1 }} accessibilityRole="header">
          {t('ui_progress_v3.this_week_goals')}
        </Text>
        <Text variant="footnote" tone="ink2">
          {t('ui_progress_v3.resets_in', { count: daysUntilReset() })}
        </Text>
      </View>
      <Section>
        {quests.map((q) => (
          <QuestRow key={q.id} q={q} />
        ))}
      </Section>
      {quests.every((q) => !q.done) && list.length === 0 ? (
        <Button
          title={t('ui_progress_v3.start_walk')}
          icon="walk"
          onPress={onStartSurvey}
          style={{ marginTop: -12, marginBottom: 28 }}
        />
      ) : null}

      {/* Totals */}
      <Card style={{ flexDirection: 'row', marginBottom: 28 }}>
        <Stat value={fmtKm(s?.distance_km ?? 0)} label={t('ui_progress_v3.km_walked')} />
        <Stat
          value={String(s ? completeChecklists(s) : 0)}
          label={t('ui_progress_v3.checklists')}
        />
        <Stat
          value={String(Math.round((s?.minutes_surveyed ?? 0) / 60))}
          label={t('ui_progress_v3.hours')}
        />
        <Stat value={String(s?.cell_count ?? 0)} label={t('ui_progress_v3.cells')} />
      </Card>

      {/* Badges */}
      <Text
        variant="title3"
        accessibilityRole="header"
        style={{ marginBottom: 8, marginHorizontal: 4 }}
      >
        {t('ui_progress_v3.badges')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        {earned.map((b) => (
          <BadgeTile key={b.id} b={b} />
        ))}
      </View>

      {/* Leaderboard */}
      <Text
        variant="title3"
        accessibilityRole="header"
        style={{ marginBottom: 4, marginHorizontal: 4 }}
      >
        {t('ui_progress_v3.leaderboard')}
      </Text>
      <Text variant="footnote" tone="ink2" style={{ marginBottom: 12, marginHorizontal: 4 }}>
        {t('ui_progress_v3.leaderboard_note')}
      </Text>
      <Segmented
        options={[
          { value: 'km', label: t('ui_progress_v3.by_km') },
          { value: 'checklists', label: t('ui_progress_v3.by_checklists') },
        ]}
        value={metric}
        onChange={setMetric}
        style={{ marginBottom: 12 }}
      />
      <Section>
        {top.length === 0 ? (
          <Row
            title={board.isLoading ? t('ui_progress_v3.loading') : t('ui_progress_v3.board_empty')}
          />
        ) : (
          top.map((r) => (
            <LeaderRowView
              key={r.user_id}
              rank={r.rank}
              name={r.isMe ? t('ui_common.you') : r.display_name}
              value={r.value}
              metric={metric}
              isMe={r.isMe}
            />
          ))
        )}
        {me && me.rank > 10 ? (
          <LeaderRowView
            rank={me.rank}
            name={t('ui_common.you')}
            value={me.value}
            metric={metric}
            isMe
          />
        ) : null}
      </Section>

      {/* How XP works */}
      <Section header={t('ui_progress_v3.how_xp')} footer={t('ui_progress_v3.how_xp_note')}>
        <Row icon="walk" title={t('ui_progress_v3.xp_km')} detail={`+${XP_WEIGHTS.kilometre}`} />
        <Row
          icon="checkCircle"
          title={t('ui_progress_v3.xp_session')}
          detail={`+${XP_WEIGHTS.completedSession}`}
        />
        <Row icon="pin" title={t('ui_progress_v3.xp_cell')} detail={`+${XP_WEIGHTS.newCell}`} />
        <Row icon="camera" title={t('ui_progress_v3.xp_photo')} detail={`+${XP_WEIGHTS.photo}`} />
        <Row
          icon="paw"
          title={t('ui_progress_v3.xp_sighting')}
          detail={`+${XP_WEIGHTS.observation}`}
        />
      </Section>
    </Screen>
  );
}

function QuestRow({ q }: { q: Quest }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const unit =
    q.unit === 'km'
      ? t('ui_progress_v3.unit_km', { a: q.progress, b: q.target })
      : q.unit === 'min'
        ? t('ui_progress_v3.unit_min', { a: q.progress, b: q.target })
        : t('ui_progress_v3.unit_count', { a: q.progress, b: q.target });
  return (
    <View
      style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}
      accessible
      accessibilityLabel={`${t(q.titleKey)}, ${unit}`}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: q.done ? c.accent : c.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Symbol
          name={q.done ? 'check' : q.icon}
          size={17}
          color={q.done ? c.onAccent : c.accent}
          weight="semibold"
        />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row' }}>
          <Text variant="subhead" weight="600" style={{ flex: 1 }}>
            {t(q.titleKey)}
          </Text>
          <Text variant="footnote" tone="ink2" tabular>
            {unit}
          </Text>
        </View>
        <ProgressBar value={q.progress / q.target} height={6} />
      </View>
    </View>
  );
}

function BadgeTile({ b }: { b: BadgeProgress }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const tierColor = [c.ink3, c.bronze, c.silver, c.gold][b.tier];
  const tierName = [
    t('ui_progress_v3.tier_0'),
    t('ui_progress_v3.tier_1'),
    t('ui_progress_v3.tier_2'),
    t('ui_progress_v3.tier_3'),
  ][b.tier];
  const value =
    b.id === 'distance' || b.id === 'hours' ? Math.floor(b.value * 10) / 10 : Math.floor(b.value);
  return (
    <View
      style={{
        width: '31%',
        flexGrow: 1,
        backgroundColor: c.surface,
        borderRadius: 18,
        padding: 12,
        alignItems: 'center',
        gap: 6,
      }}
      accessible
      accessibilityLabel={`${t(b.titleKey)}, ${tierName}. ${t(b.descKey)}. ${b.next != null ? t('ui_progress_v3.badge_next', { value, next: b.next }) : ''}`}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          borderWidth: 3,
          borderColor: b.tier ? tierColor : c.fill,
          backgroundColor: b.tier ? c.surface : c.canvas,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Symbol
          name={b.tier ? b.icon : 'lock'}
          size={22}
          color={b.tier ? tierColor : c.ink3}
          weight="semibold"
        />
      </View>
      <Text variant="footnote" weight="600" align="center" numberOfLines={2}>
        {t(b.titleKey)}
      </Text>
      <Text variant="caption" tone={b.tier ? 'ink2' : 'ink3'} align="center">
        {tierName}
      </Text>
      {b.next != null ? (
        <View style={{ alignSelf: 'stretch', gap: 4 }}>
          <ProgressBar value={b.fraction} height={4} color={b.tier ? tierColor : c.accent} />
          <Text variant="caption" tone="ink3" align="center" tabular>
            {value} / {b.next}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function LeaderRowView({
  rank,
  name,
  value,
  metric,
  isMe,
}: {
  rank: number;
  name: string;
  value: number;
  metric: BoardMetric;
  isMe: boolean;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const v =
    metric === 'km'
      ? t('ui_progress_v3.km_value', { km: fmtKm(value) })
      : t('ui_progress_v3.checklist_value', { count: value });
  return (
    <View
      style={{
        minHeight: 52,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: isMe ? c.accentSoft : undefined,
      }}
      accessible
      accessibilityLabel={t('ui_progress_v3.rank_row', { rank, name, value: v })}
    >
      <Text variant="headline" tabular tone={rank <= 3 ? 'accent' : 'ink2'} style={{ width: 32 }}>
        {rank}
      </Text>
      <Text variant="body" weight={isMe ? '600' : '400'} style={{ flex: 1 }} numberOfLines={1}>
        {name}
      </Text>
      <Text variant="subhead" tone="ink2" tabular>
        {v}
      </Text>
    </View>
  );
}
