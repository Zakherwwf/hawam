import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Footprints,
  MapPin,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { useAnimals } from '../data/portal';
import type { Walk } from '../data/api';
import { applyFilters, isoDay, parseDay, readFilters } from '../lib/filters';
import { fmtDay, fmtDec, fmtInt, fmtKm, fmtTime } from '../lib/format';
import { weekStart } from '../lib/geo';
import { href, setParams } from '../lib/router';
import { FilterBar } from '../components/FilterBar';
import { ActivityList, buildActivity } from '../components/widgets';
import { useCore } from '../data/portal';
import {
  Avatar,
  Button,
  Card,
  cx,
  EmptyState,
  ErrorNote,
  IconButton,
  PageHeader,
  Segmented,
  Skeleton,
  Tabs,
} from '../ui';
import type { PageProps } from './types';
import { ROLE_LABEL } from '../lib/labels';

const DAY = 86400000;

/**
 * Timeline. Schedule: who surveyed on which day (reference board 2), with
 * weekends hatched and today marked; each block opens the walk. Feed: every
 * event in order, grouped by day.
 */
export function Timeline({ params }: PageProps) {
  const view = params.get('view') === 'feed' ? 'feed' : 'schedule';
  return (
    <>
      <PageHeader
        title="Timeline"
        description="Who surveyed when, and everything that happened, in order."
      />
      <div className="mb-4">
        <Tabs
          label="Timeline views"
          items={[
            { href: href('timeline'), label: 'Schedule', active: view === 'schedule' },
            {
              href: href('timeline', { view: 'feed' }),
              label: 'Activity Feed',
              active: view === 'feed',
            },
          ]}
        />
      </div>
      {view === 'schedule' ? <Schedule params={params} /> : <Feed params={params} />}
    </>
  );
}

function Schedule({ params }: { params: URLSearchParams }) {
  const core = useCore();
  const span = Number(params.get('span') ?? 14) as 7 | 14 | 28;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const defaultStart = weekStart(new Date(todayStart.getTime() - (span > 7 ? 7 : 0) * DAY));
  const start = parseDay(params.get('start')) ?? defaultStart;
  const end = new Date(start.getTime() + span * DAY);
  const startMs = start.getTime();
  const f = useMemo(
    () => ({
      ...readFilters(params, 'all'),
      from: new Date(startMs),
      to: new Date(startMs + span * DAY),
    }),
    [params, startMs, span]
  );
  const slice = useMemo(
    () =>
      core.ready
        ? applyFilters(core.walks.data!, core.sightings.data!, f)
        : { walks: [], sightings: [] },
    [core.ready, core.walks.data, core.sightings.data, f]
  );
  const days = Array.from({ length: span }, (_, i) => new Date(start.getTime() + i * DAY));
  const perWalk = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of slice.sightings)
      m.set(s.session_id, (m.get(s.session_id) ?? 0) + (s.group_size || 1));
    return m;
  }, [slice.sightings]);
  const rows = useMemo(() => {
    const m = new Map<string, Walk[]>();
    for (const w of slice.walks) {
      const l = m.get(w.observer_id);
      if (l) l.push(w);
      else m.set(w.observer_id, [w]);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [slice.walks]);
  const role = new Map((core.users.data ?? []).map((u) => [u.id, u.role]));
  const shift = (d: number) => setParams({ start: isoDay(new Date(start.getTime() + d * DAY)) });
  const colW = span === 28 ? 56 : span === 14 ? 76 : 120;
  const totalKm = slice.walks
    .filter((w) => w.validation_status !== 'flagged')
    .reduce((a, w) => a + (w.distance_km ?? 0), 0);
  const fmtRange = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <FilterBar
        f={f}
        dates={false}
        show={['protocol', 'status', 'route']}
        summary={core.ready ? `${fmtInt(slice.walks.length)} sessions, ${fmtKm(totalKm)} km` : null}
      />
      {core.error ? <ErrorNote message={core.error} onRetry={core.reload} /> : null}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-6 pt-5 pb-4">
          <h2 className="text-[22px] font-semibold tracking-[-0.01em] flex-1 min-w-[220px]">
            {fmtRange.format(start)} to {fmtRange.format(new Date(end.getTime() - DAY))}
          </h2>
          <Segmented
            label="Days shown"
            value={String(span) as '7' | '14' | '28'}
            onChange={(v) => setParams({ span: v === '14' ? null : v })}
            options={[
              { value: '7', label: '1 week' },
              { value: '14', label: '2 weeks' },
              { value: '28', label: '4 weeks' },
            ]}
          />
          <div className="flex items-center gap-2">
            <IconButton label="Earlier" onClick={() => shift(-Math.min(7, span))}>
              <ChevronLeft className="rtl:rotate-180" />
            </IconButton>
            <Button kind="pill" size="sm" onClick={() => setParams({ start: null })}>
              Today
            </Button>
            <IconButton label="Later" onClick={() => shift(Math.min(7, span))}>
              <ChevronRight className="rtl:rotate-180" />
            </IconButton>
          </div>
        </div>
        {!core.ready ? (
          <Skeleton className="h-[360px] mx-6 mb-6" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Footprints />}
            title="No sessions in these days"
            body="Move to earlier weeks or clear the filters."
          />
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="min-w-max xl:min-w-0 px-6">
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `220px repeat(${span}, minmax(${colW}px, 1fr))` }}
              >
                <div className="sticky start-0 z-10 bg-surface text-[13px] font-semibold text-ink2 self-end pb-1">
                  Volunteers ({rows.length})
                </div>
                {days.map((d) => {
                  const isToday = d.getTime() === todayStart.getTime();
                  const weekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div
                      key={d.getTime()}
                      className={cx(
                        'h-12 rounded-[12px] grid place-items-center text-center leading-tight',
                        isToday
                          ? 'bg-pill text-on-pill'
                          : weekend
                            ? 'bg-canvas text-ink2'
                            : 'bg-canvas text-ink'
                      )}
                    >
                      <span className="text-[11px] opacity-80">
                        {new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d)}
                      </span>
                      <span className="text-[14px] font-semibold tabular">{d.getDate()}</span>
                    </div>
                  );
                })}
                {rows.map(([uid, ws]) => (
                  <ScheduleRow
                    key={uid}
                    uid={uid}
                    name={core.nameOf(uid)}
                    role={ROLE_LABEL[role.get(uid) ?? 'volunteer']}
                    walks={ws}
                    days={days}
                    todayStart={todayStart}
                    perWalk={perWalk}
                    routeName={core.routeName}
                    compact={span === 28}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-4 px-6 pb-5 text-[12px] text-ink2">
          <LegendSwatch cls="bg-lime text-on-lime" label="Complete checklist" />
          <LegendSwatch cls="bg-cat-soft text-cat" label="Partial checklist" />
          <LegendSwatch cls="bg-fill text-ink2" label="Quick sighting" />
          <LegendSwatch cls="bg-warm-soft text-warm-ink" label="Flagged" />
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="w-4 h-4 rounded-[4px] hatch bg-canvas" /> Weekend
          </span>
        </div>
      </Card>
    </>
  );
}

function LegendSwatch({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className={cx('w-4 h-4 rounded-[5px]', cls)} />
      {label}
    </span>
  );
}

function ScheduleRow({
  uid,
  name,
  role,
  walks,
  days,
  todayStart,
  perWalk,
  routeName,
  compact,
}: {
  uid: string;
  name: string;
  role: string;
  walks: Walk[];
  days: Date[];
  todayStart: Date;
  perWalk: Map<string, number>;
  routeName: (id: string | null) => string;
  compact: boolean;
}) {
  const byDay = new Map<number, Walk[]>();
  for (const w of walks) {
    const d = new Date(w.start_time);
    const k = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const l = byDay.get(k);
    if (l) l.push(w);
    else byDay.set(k, [w]);
  }
  return (
    <>
      <a
        href={href(`people/${uid}`)}
        className="sticky start-0 z-10 flex items-center gap-3 h-[68px] px-3 rounded-tile bg-surface shadow-card hover:bg-raised min-w-0"
      >
        <Avatar id={uid} name={name} size={40} />
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold truncate">{name}</span>
          <span className="block text-[12px] text-ink2 truncate">
            {role}, {walks.length} {walks.length === 1 ? 'session' : 'sessions'}
          </span>
        </span>
      </a>
      {days.map((d) => {
        const ws = (byDay.get(d.getTime()) ?? []).sort((a, b) =>
          a.start_time.localeCompare(b.start_time)
        );
        const weekend = d.getDay() === 0 || d.getDay() === 6;
        const isToday = d.getTime() === todayStart.getTime();
        return (
          <div
            key={d.getTime()}
            className={cx(
              'relative h-[68px] rounded-tile p-1 flex flex-col gap-1 overflow-hidden',
              weekend ? 'hatch bg-canvas' : 'bg-canvas/60 ring-1 ring-inset ring-line'
            )}
          >
            {isToday ? (
              <span
                aria-hidden
                className="absolute inset-y-0 start-1/2 w-0.5 bg-accent/60 dark:bg-lime/60"
              />
            ) : null}
            {ws.slice(0, compact ? 2 : 2).map((w) => (
              <WalkBlock
                key={w.id}
                w={w}
                animals={perWalk.get(w.id) ?? 0}
                routeName={routeName}
                compact={compact}
                tall={ws.length === 1}
              />
            ))}
            {ws.length > 2 ? (
              <span className="text-[11px] text-ink2 px-1 tabular">+{ws.length - 2} more</span>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function WalkBlock({
  w,
  animals,
  routeName,
  compact,
  tall,
}: {
  w: Walk;
  animals: number;
  routeName: (id: string | null) => string;
  compact: boolean;
  tall: boolean;
}) {
  const flagged = w.validation_status === 'flagged';
  const quick = w.protocol === 'incidental';
  const cls = flagged
    ? 'bg-warm-soft text-warm-ink'
    : quick
      ? 'bg-fill text-ink2'
      : w.complete_session
        ? 'bg-lime text-on-lime'
        : 'bg-cat-soft text-cat';
  const Icon = flagged
    ? ShieldAlert
    : quick
      ? Zap
      : w.protocol === 'stationary_point'
        ? MapPin
        : w.complete_session
          ? CircleCheck
          : Footprints;
  const label = `${fmtTime(w.start_time)}, ${quick ? 'quick sighting' : w.protocol === 'stationary_point' ? 'point count' : `${fmtKm(w.distance_km ?? 0)} km`}, ${animals} animals${w.route_id ? `, ${routeName(w.route_id)}` : ''}${flagged ? ', flagged' : ''}`;
  return (
    <a
      href={href(`walks/${w.id}`)}
      title={label}
      aria-label={label}
      className={cx(
        'flex items-center gap-1.5 rounded-[10px] px-2 min-w-0 hover:brightness-95 transition-[filter]',
        cls,
        tall ? 'flex-1' : 'h-7'
      )}
    >
      <Icon aria-hidden className="w-3.5 h-3.5 shrink-0" />
      {!compact ? (
        <span className="min-w-0 leading-tight">
          <span className="block text-[12px] font-semibold truncate tabular">
            {quick
              ? fmtTime(w.start_time)
              : w.protocol === 'stationary_point'
                ? 'Point'
                : `${fmtDec(w.distance_km ?? 0, 1)} km`}
          </span>
          {tall ? (
            <span className="block text-[11px] opacity-80 truncate">
              {animals} {animals === 1 ? 'animal' : 'animals'}
            </span>
          ) : null}
        </span>
      ) : null}
    </a>
  );
}

function Feed({ params }: { params: URLSearchParams }) {
  const core = useCore();
  const { individuals, links } = useAnimals();
  const f = useMemo(() => readFilters(params, '30d'), [params]);
  const slice = useMemo(
    () =>
      core.ready
        ? applyFilters(core.walks.data!, core.sightings.data!, f)
        : { walks: [], sightings: [] },
    [core.ready, core.walks.data, core.sightings.data, f]
  );
  const [limit, setLimit] = useState(60);
  const inWin = (iso: string) =>
    (!f.from || new Date(iso) >= f.from) && (!f.to || new Date(iso) < f.to);
  const items = useMemo(
    () =>
      buildActivity({
        walks: slice.walks,
        sightings: slice.sightings,
        individuals: (individuals.data ?? []).filter((i) => inWin(i.created_at)),
        links: (links.data ?? []).filter((l) => l.reviewed_at && inWin(l.reviewed_at)),
        routes: (core.routes.data ?? []).filter((r) =>
          inWin(r.deleted_at ?? r.updated_at ?? r.created_at)
        ),
        nameOf: core.nameOf,
        limit: 2000,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slice, individuals.data, links.data, core.routes.data]
  );
  const groups = useMemo(() => {
    const out: { day: string; items: typeof items }[] = [];
    for (const a of items.slice(0, limit)) {
      const d = new Date(a.at);
      const k = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
      if (out[out.length - 1]?.day !== k) out.push({ day: k, items: [] });
      out[out.length - 1].items.push(a);
    }
    return out;
  }, [items, limit]);
  return (
    <>
      <FilterBar f={f} summary={core.ready ? `${fmtInt(items.length)} events` : null} />
      {core.error ? <ErrorNote message={core.error} onRetry={core.reload} /> : null}
      {!core.ready ? (
        <Skeleton className="h-[480px]" />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Footprints />}
            title="Nothing happened in this period"
            body="Widen the date range or clear the filters."
          />
        </Card>
      ) : (
        <div className="grid gap-4 max-w-[880px]">
          {groups.map((g) => (
            <Card key={g.day} className="px-6 py-4">
              <h2 className="text-[15px] font-semibold mb-1 sticky top-[96px]">{fmtDay(g.day)}</h2>
              <ActivityList items={g.items} nameOf={core.nameOf} />
            </Card>
          ))}
          {items.length > limit ? (
            <div className="flex justify-center">
              <Button kind="pill" onClick={() => setLimit((l) => l + 80)}>
                Show More Events
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
