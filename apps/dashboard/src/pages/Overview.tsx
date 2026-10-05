import { useMemo } from 'react';
import {
  Activity as ActivityIcon,
  Cat,
  CheckCircle2,
  Footprints,
  Gauge,
  Route as RouteIcon,
} from 'lucide-react';
import { useAnimals } from '../data/portal';
import { fmtAgo, fmtDay, fmtDec, fmtInt, fmtKm, fmtMetric, bucketLabel } from '../lib/format';
import { hrefKeep, href } from '../lib/router';
import { REASON_LABEL } from '../lib/stats';
import {
  autoGrain,
  dailyCounts,
  delta,
  hourWeekday,
  linearTrend,
  rolling,
  series,
  total,
  type MetricId,
} from '../lib/series';
import {
  BarList,
  CalendarHeatmap,
  ChartFrame,
  HourHeatmap,
  Legend,
  Sparkline,
  SPECIES_COLOR,
  SplitBar,
  TimeChart,
} from '../components/charts';
import { FilterBar } from '../components/FilterBar';
import { ActivityList, buildActivity, useSlice } from '../components/widgets';
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  ErrorNote,
  KpiTile,
  Meter,
  PageHeader,
  Skeleton,
  ViewAll,
} from '../ui';
import type { PageProps } from './types';

export function Overview({ me, params }: PageProps) {
  const { core, f, walks, sightings, prev, window: win } = useSlice(params);
  const { individuals, links } = useAnimals();
  const grain = autoGrain(win.from, win.to);
  const fmtX = bucketLabel(grain);
  const fmtTip = bucketLabel(grain, true);

  const metric = (m: MetricId) => ({
    cur: total(walks, sightings, m),
    prev: prev ? total(prev.walks, prev.sightings, m) : null,
    pts: series(walks, sightings, m, win.from, win.to, grain),
  });
  const k = useMemo(
    () => ({
      km: metric('km'),
      complete: metric('complete'),
      zero: metric('zero'),
      animals: metric('animals'),
      sightings: metric('sightings'),
      rate: metric('rate'),
      volunteers: metric('volunteers'),
      flagged: metric('flagged'),
      minutes: metric('minutes'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walks, sightings, prev, win.from.getTime(), win.to.getTime(), grain]
  );
  const spark = (pts: { v: number | null }[]) => pts.slice(-12).map((p) => p.v);

  const species = useMemo(
    () =>
      (['cat', 'dog', 'unknown'] as const).map((sp) => ({
        sp,
        pts: series(
          walks,
          sightings.filter((s) => s.species === sp),
          'animals',
          win.from,
          win.to,
          grain
        ),
        total: sightings
          .filter((s) => s.species === sp)
          .reduce((a, s) => a + (s.group_size || 1), 0),
      })),
    [walks, sightings, win.from, win.to, grain]
  );

  const rateTrend = useMemo(() => {
    const t = linearTrend(k.rate.pts);
    return t ? k.rate.pts.map((p, i) => ({ t: p.t, v: Math.max(0, t.at(i)) })) : null;
  }, [k.rate.pts]);

  const flaggedWalks = walks.filter((w) => w.validation_status === 'flagged');
  const reasonCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of flaggedWalks)
      for (const r of w.validation_reasons) m.set(r, (m.get(r) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [flaggedWalks]);
  const transectSightings = sightings.filter((s) => s.protocol === 'transect');
  const withDistance = transectSightings.filter((s) => s.perpendicular_distance_m != null).length;
  const pending = (links.data ?? []).filter((l) => l.status === 'proposed').length;

  const routeHealth = useMemo(() => {
    const all = core.walks.data ?? [];
    return (core.routes.data ?? [])
      .filter((r) => r.is_active && !r.deleted_at)
      .map((r) => {
        const visits = all.filter((w) => w.route_id === r.id && w.validation_status !== 'flagged');
        const last = visits[0]?.start_time ?? null;
        const days = last ? (Date.now() - new Date(last).getTime()) / 86400000 : Infinity;
        const due = r.revisit_days ?? 7;
        return {
          r,
          visits: visits.length,
          inRange: walks.filter((w) => w.route_id === r.id).length,
          last,
          overdue: days > due * 2,
          due,
        };
      })
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.inRange - a.inRange);
  }, [core.routes.data, core.walks.data, walks]);

  const leaders = useMemo(() => {
    const m = new Map<string, { km: number; walks: number; complete: number }>();
    for (const w of walks) {
      if (w.validation_status === 'flagged' || w.protocol === 'incidental') continue;
      const v = m.get(w.observer_id) ?? { km: 0, walks: 0, complete: 0 };
      v.km += w.distance_km ?? 0;
      v.walks += 1;
      if (w.complete_session) v.complete += 1;
      m.set(w.observer_id, v);
    }
    return [...m.entries()].sort((a, b) => b[1].km - a[1].km).slice(0, 6);
  }, [walks]);

  const activity = useMemo(
    () =>
      buildActivity({
        walks: walks.slice(0, 30),
        sightings,
        individuals: individuals.data ?? [],
        links: links.data ?? [],
        routes: core.routes.data ?? [],
        nameOf: core.nameOf,
        limit: 7,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walks, sightings, individuals.data, links.data, core.routes.data]
  );
  const days = useMemo(() => dailyCounts(core.walks.data ?? []), [core.walks.data]);
  const hours = useMemo(() => hourWeekday(walks), [walks]);

  const hour = new Date().getHours();
  const loading = !core.ready;
  const periodLabel = f.range === 'all' ? 'all time' : 'vs previous period';

  return (
    <>
      <PageHeader
        title={`Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}${me.display_name ? `, ${me.display_name.split(' ')[0]}` : ''}`}
        description={`${fmtDay(new Date())}. Survey effort, detections and data quality across every volunteer.`}
      />
      <FilterBar
        f={f}
        show={['species', 'protocol', 'route', 'who']}
        summary={
          core.ready
            ? `${fmtInt(walks.length)} sessions, ${fmtInt(sightings.length)} sightings`
            : null
        }
      />
      {core.error ? <ErrorNote message={core.error} onRetry={core.reload} /> : null}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Kilometres surveyed"
          value={fmtKm(k.km.cur ?? 0)}
          unit="km"
          icon={<Footprints />}
          delta={f.range === 'all' ? null : delta(k.km.cur, k.km.prev)}
          deltaLabel={periodLabel}
          spark={<Sparkline values={spark(k.km.pts)} label="Kilometres per period, recent trend" />}
          href={hrefKeep('explore', { m: 'km' })}
          loading={loading}
        />
        <KpiTile
          label="Complete checklists"
          value={fmtInt(k.complete.cur ?? 0)}
          icon={<CheckCircle2 />}
          delta={f.range === 'all' ? null : delta(k.complete.cur, k.complete.prev)}
          deltaLabel={
            f.range === 'all' ? `${fmtInt(k.zero.cur ?? 0)} with zero animals` : periodLabel
          }
          spark={
            <Sparkline values={spark(k.complete.pts)} label="Complete checklists per period" />
          }
          href={hrefKeep('explore', { m: 'complete' })}
          loading={loading}
        />
        <KpiTile
          label="Animals counted"
          value={fmtInt(k.animals.cur ?? 0)}
          icon={<Cat />}
          delta={f.range === 'all' ? null : delta(k.animals.cur, k.animals.prev)}
          deltaLabel={periodLabel}
          upIsGood
          spark={<Sparkline values={spark(k.animals.pts)} label="Animals counted per period" />}
          href={hrefKeep('explore', { m: 'animals', by: 'species' })}
          loading={loading}
        />
        <KpiTile
          label="Encounter rate"
          value={k.rate.cur == null ? 'No data' : fmtDec(k.rate.cur, 2)}
          unit={k.rate.cur == null ? undefined : 'per km'}
          icon={<Gauge />}
          delta={f.range === 'all' ? null : delta(k.rate.cur, k.rate.prev)}
          deltaLabel={periodLabel}
          spark={<Sparkline values={spark(k.rate.pts)} label="Encounter rate per period" />}
          href={hrefKeep('explore', { m: 'rate', trend: '1' })}
          loading={loading}
        />
      </div>

      <div className="grid gap-4 mt-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Survey effort"
            description={`Kilometres walked per ${grain}, flagged walks excluded. Dashed: 4-${grain} rolling mean.`}
            action={<ViewAll href={hrefKeep('explore', { m: 'km', roll: '4' })} label="Explore" />}
          />
          {loading ? (
            <Skeleton className="h-[260px] mx-6 mb-6" />
          ) : (
            <ChartFrame
              label="Kilometres per period"
              legend={
                <Legend
                  items={[
                    { label: 'Kilometres', color: 'var(--chart-1)' },
                    { label: 'Rolling mean', color: 'var(--ink3)', dashed: true },
                  ]}
                />
              }
              chart={
                <TimeChart
                  label="Kilometres surveyed per period"
                  kind="area"
                  height={260}
                  formatX={fmtX}
                  formatTip={fmtTip}
                  format={(v) => fmtDec(v, 1)}
                  series={[
                    { key: 'km', label: 'km', color: 'var(--chart-1)', points: k.km.pts },
                    {
                      key: 'roll',
                      label: 'rolling mean',
                      color: 'var(--ink3)',
                      points: rolling(k.km.pts, 4),
                      reference: true,
                    },
                  ]}
                />
              }
              table={{
                columns: ['Period', 'Kilometres', 'Sessions', 'Minutes'],
                rows: k.km.pts.map((p, i) => [
                  fmtTip(p.t),
                  fmtDec(p.v ?? 0, 2),
                  fmtInt(series(walks, sightings, 'walks', win.from, win.to, grain)[i]?.v ?? 0),
                  fmtInt(k.minutes.pts[i]?.v ?? 0),
                ]),
              }}
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Animals by species"
            description={`Summed group sizes per ${grain}. Counts, not population estimates.`}
            action={
              <ViewAll
                href={hrefKeep('explore', { m: 'animals', by: 'species', chart: 'stacked' })}
                label="Explore"
              />
            }
          />
          {loading ? (
            <Skeleton className="h-[260px] mx-6 mb-6" />
          ) : (
            <ChartFrame
              label="Animals by species per period"
              legend={
                <Legend
                  kind="rect"
                  items={species.map((s) => ({
                    label: s.sp === 'cat' ? 'Cats' : s.sp === 'dog' ? 'Dogs' : 'Unknown',
                    color: SPECIES_COLOR[s.sp],
                  }))}
                />
              }
              chart={
                <>
                  <TimeChart
                    label="Animals by species per period"
                    kind="stacked"
                    height={196}
                    formatX={fmtX}
                    formatTip={fmtTip}
                    series={species.map((s) => ({
                      key: s.sp,
                      label: s.sp === 'cat' ? 'Cats' : s.sp === 'dog' ? 'Dogs' : 'Unknown',
                      color: SPECIES_COLOR[s.sp],
                      points: s.pts,
                    }))}
                  />
                  <div className="mt-4">
                    <SplitBar
                      label="Share of animals by species"
                      parts={species.map((s) => ({
                        label: s.sp,
                        value: s.total,
                        color: SPECIES_COLOR[s.sp],
                      }))}
                    />
                    <div className="flex gap-5 mt-2 text-[13px]">
                      {species.map((s) => (
                        <span key={s.sp} className="text-ink2">
                          <span className="font-semibold text-ink tabular">{fmtInt(s.total)}</span>{' '}
                          {s.sp === 'cat' ? 'cats' : s.sp === 'dog' ? 'dogs' : 'unknown'}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              }
              table={{
                columns: ['Period', 'Cats', 'Dogs', 'Unknown'],
                rows: species[0].pts.map((p, i) => [
                  fmtTip(p.t),
                  ...species.map((s) => fmtInt(s.pts[i].v ?? 0)),
                ]),
              }}
            />
          )}
        </Card>
      </div>

      <div className="grid gap-4 mt-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Encounter rate trend"
            description="Animals per km on complete survey walks. Dashed: least-squares trend. An index of effort, not a density."
            action={
              <ViewAll href={hrefKeep('explore', { m: 'rate', trend: '1' })} label="Explore" />
            }
          />
          {loading ? (
            <Skeleton className="h-[220px] mx-6 mb-6" />
          ) : (
            <ChartFrame
              label="Encounter rate per period"
              legend={
                rateTrend ? (
                  <Legend
                    items={[
                      { label: 'Encounter rate', color: 'var(--chart-1)' },
                      { label: 'Trend', color: 'var(--ink3)', dashed: true },
                    ]}
                  />
                ) : null
              }
              chart={
                <TimeChart
                  label="Encounter rate per period"
                  height={220}
                  formatX={fmtX}
                  formatTip={fmtTip}
                  format={(v) => fmtDec(v, 2)}
                  series={[
                    { key: 'rate', label: 'per km', color: 'var(--chart-1)', points: k.rate.pts },
                    ...(rateTrend
                      ? [
                          {
                            key: 'trend',
                            label: 'trend',
                            color: 'var(--ink3)',
                            points: rateTrend,
                            reference: true,
                          },
                        ]
                      : []),
                  ]}
                />
              }
              table={{
                columns: ['Period', 'Animals per km'],
                rows: k.rate.pts.map((p) => [
                  fmtTip(p.t),
                  p.v == null ? 'No complete walks' : fmtDec(p.v, 2),
                ]),
              }}
            />
          )}
        </Card>
        <Card>
          <CardHeader
            title="Survey calendar"
            description="Sessions per day over the last 26 weeks, all filters except dates ignored."
          />
          <div className="px-6 pb-6">
            {loading ? (
              <Skeleton className="h-[150px]" />
            ) : (
              <CalendarHeatmap
                label="Sessions per day, last 26 weeks"
                days={new Map([...days.entries()].map(([d, v]) => [d, v.walks]))}
                format={(v, d) =>
                  `${fmtInt(v)} ${v === 1 ? 'session' : 'sessions'}, ${new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(d)}`
                }
              />
            )}
            <div className="mt-5">
              <p className="text-[13px] font-semibold mb-2">When people survey</p>
              <HourHeatmap grid={hours} label="Sessions by weekday and hour started" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 mt-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Latest activity"
            action={<ViewAll href={hrefKeep('timeline', { view: 'feed' })} />}
          />
          <div className="px-6 pb-4">
            {loading ? (
              <Skeleton className="h-[320px]" />
            ) : (
              <ActivityList items={activity} nameOf={core.nameOf} />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Data quality"
            description="What needs a researcher's eye in this period."
          />
          <div className="px-6 pb-6 flex flex-col gap-5">
            <a
              href={href('animals')}
              className="flex items-center gap-3 p-3 rounded-tile bg-canvas hover:brightness-[0.98]"
            >
              <span className="w-10 h-10 rounded-full bg-surface grid place-items-center text-ink2">
                <ActivityIcon aria-hidden className="w-5 h-5" />
              </span>
              <span className="flex-1">
                <span className="block text-[14px] font-semibold">Resightings to review</span>
                <span className="block text-[12px] text-ink2">
                  Only confirmed links enter capture histories
                </span>
              </span>
              <Badge tone={pending ? 'warn' : 'accent'}>{fmtInt(pending)}</Badge>
            </a>
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[13px] font-semibold">Flagged sessions</p>
                <a
                  href={hrefKeep('walks', { status: 'flagged' })}
                  className="text-[13px] font-semibold text-accent dark:text-lime hover:underline"
                >
                  {fmtInt(flaggedWalks.length)} flagged
                </a>
              </div>
              {reasonCounts.length ? (
                <BarList
                  label="Flag reasons"
                  color="var(--warm)"
                  items={reasonCounts.map(([r, n]) => ({
                    key: r,
                    label: REASON_LABEL[r] ?? r,
                    value: n,
                  }))}
                  format={fmtInt}
                />
              ) : (
                <p className="text-[13px] text-ink2">No flagged sessions in this period.</p>
              )}
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[13px] font-semibold">Distance from path recorded</p>
                <span className="text-[13px] tabular text-ink2">
                  {fmtInt(withDistance)} of {fmtInt(transectSightings.length)}
                </span>
              </div>
              <Meter
                label="Share of survey-walk sightings with a distance"
                value={transectSightings.length ? withDistance / transectSightings.length : 0}
                tone={
                  transectSightings.length && withDistance / transectSightings.length < 0.8
                    ? 'warn'
                    : 'accent'
                }
              />
              <p className="text-[12px] text-ink3 mt-1.5">
                Needed for distance sampling. Missing distances are left out of exports, never
                guessed.
              </p>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2 2xl:col-span-1">
          <CardHeader
            title="Routes"
            description="Repeat visits make counts comparable over time."
            action={<ViewAll href={href('routes')} />}
          />
          <ul className="px-6 pb-4">
            {loading ? (
              <Skeleton className="h-[200px]" />
            ) : routeHealth.length === 0 ? (
              <p className="text-[14px] text-ink2 pb-4">No live routes. Draw one with New Route.</p>
            ) : (
              routeHealth.slice(0, 5).map(({ r, inRange, last, overdue, due }) => (
                <li key={r.id}>
                  <a
                    href={href(`routes/${r.id}`)}
                    className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-[14px] hover:bg-canvas"
                  >
                    <span className="w-9 h-9 rounded-full bg-warm-soft text-warm-ink grid place-items-center shrink-0">
                      <RouteIcon aria-hidden className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-medium truncate">{r.name}</span>
                      <span className="block text-[12px] text-ink2">
                        {fmtInt(inRange)} {inRange === 1 ? 'visit' : 'visits'} in period, last{' '}
                        {fmtAgo(last)}
                      </span>
                    </span>
                    {overdue ? (
                      <Badge tone="warn" dot>
                        Overdue
                      </Badge>
                    ) : (
                      <span className="text-[12px] text-ink3 whitespace-nowrap">every {due} d</span>
                    )}
                  </a>
                </li>
              ))
            )}
          </ul>
          <div className="px-6 pb-6">
            <p className="text-[13px] font-semibold mb-2">Most effort in period</p>
            <ol className="flex flex-col">
              {leaders.map(([id, v], i) => (
                <li key={id}>
                  <a
                    href={href(`people/${id}`)}
                    className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-[12px] hover:bg-canvas"
                  >
                    <span className="w-4 text-[12px] font-semibold text-ink3 tabular">{i + 1}</span>
                    <Avatar id={id} name={core.nameOf(id)} size={28} />
                    <span className="flex-1 min-w-0 truncate text-[14px]">{core.nameOf(id)}</span>
                    <span className="text-[13px] tabular text-ink2">{fmtKm(v.km)} km</span>
                  </a>
                </li>
              ))}
              {!leaders.length && !loading ? (
                <li className="text-[13px] text-ink2">No survey walks in this period.</li>
              ) : null}
            </ol>
          </div>
        </Card>
      </div>
      <p className="text-[12px] text-ink3 mt-6">
        Effort figures leave out flagged sessions. Survey time {fmtMetric(k.minutes.cur, 0)} min
        across {fmtInt(k.volunteers.cur ?? 0)} volunteers. Rankings use kilometres, never animal
        counts.
      </p>
    </>
  );
}
