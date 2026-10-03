import { useMemo, useState } from 'react';
import {
  ChartArea,
  ChartColumnBig,
  ChartColumnStacked,
  ChartLine,
  Download,
  Link2,
  Table2,
} from 'lucide-react';
import { download, toCsv } from '../lib/csv';
import { fmtDec, fmtInt, bucketLabel, fmtMetric } from '../lib/format';
import { setParams } from '../lib/router';
import { PROTOCOL_LABEL, TIME_OF_DAY_LABEL, WEATHER_LABEL } from '../lib/stats';
import { SPECIES_PLURAL } from '../lib/labels';
import {
  autoGrain,
  BREAKDOWNS,
  linearTrend,
  metricDef,
  METRICS,
  rolling,
  splitSeries,
  type Breakdown,
  type Grain,
  type MetricId,
} from '../lib/series';
import { RANGE_LABEL } from '../lib/filters';
import { slotOf } from '../data/portal';
import {
  ChartFrame,
  Legend,
  SERIES_COLORS,
  SPECIES_COLOR,
  TimeChart,
  type Series,
} from '../components/charts';
import { FilterBar } from '../components/FilterBar';
import { useSlice } from '../components/widgets';
import {
  Button,
  Card,
  cx,
  ErrorNote,
  Notice,
  PageHeader,
  Segmented,
  selectChevron,
  Skeleton,
  Switch,
} from '../ui';
import type { PageProps } from './types';

type ChartKind = 'line' | 'area' | 'bar' | 'stacked' | 'table';
const SIGHTING_METRICS: MetricId[] = ['sightings', 'animals', 'welfare', 'bcs'];

/**
 * Explore: a question builder in the spirit of Metabase. Pick a metric, a
 * time grain and a breakdown; the answer is a chart, its summary, a table
 * and a CSV, and the whole question is a link (every choice is in the URL).
 */
export function Explore({ params }: PageProps) {
  const { core, f, walks, sightings, window: win } = useSlice(params);
  const m = (params.get('m') as MetricId) || 'km';
  const def = metricDef(METRICS.some((x) => x.id === m) ? m : 'km');
  const by = (params.get('by') as Breakdown) || 'none';
  const auto = autoGrain(win.from, win.to);
  const grain = (params.get('g') as Grain) || auto;
  const chart =
    (params.get('chart') as ChartKind) ||
    (def.kind === 'ratio' || def.kind === 'mean' ? 'line' : by === 'none' ? 'area' : 'line');
  const showTrend = params.get('trend') === '1';
  const roll = Number(params.get('roll') ?? 0);
  const [copied, setCopied] = useState(false);

  const routeIds = useMemo(
    () => (core.routes.data ?? []).map((r) => r.id).sort(),
    [core.routes.data]
  );
  const userIds = useMemo(() => (core.users.data ?? []).map((u) => u.id).sort(), [core.users.data]);
  const labelOf = (key: string) => {
    switch (by) {
      case 'species':
        return SPECIES_PLURAL[key] ?? key;
      case 'protocol':
        return PROTOCOL_LABEL[key] ?? key;
      case 'route':
        return key === 'none' ? 'Free walks' : core.routeName(key);
      case 'volunteer':
        return core.nameOf(key);
      case 'time_of_day':
        return TIME_OF_DAY_LABEL[key] ?? 'Not recorded';
      case 'weather':
        return WEATHER_LABEL[key] ?? 'Not recorded';
      default:
        return def.label;
    }
  };
  const colorOf = (key: string, i: number) => {
    if (by === 'none') return 'var(--chart-1)';
    if (by === 'species') return SPECIES_COLOR[key] ?? SERIES_COLORS[7];
    if (by === 'route')
      return key === 'none' ? 'var(--chart-unknown)' : SERIES_COLORS[slotOf(key, routeIds)];
    if (by === 'volunteer') return SERIES_COLORS[slotOf(key, userIds)];
    const fixed: Record<string, string[]> = {
      protocol: ['transect', 'stationary_point', 'incidental'],
      time_of_day: ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night', 'unrecorded'],
      weather: ['clear', 'cloudy', 'rain', 'wind', 'unrecorded'],
    };
    const order = fixed[by] ?? [];
    const idx = order.indexOf(key);
    return SERIES_COLORS[idx < 0 ? i % 8 : idx % 8];
  };

  const speciesOnWalkMetric = by === 'species' && !SIGHTING_METRICS.includes(def.id);
  const groups = useMemo(
    () =>
      core.ready
        ? splitSeries(
            walks,
            sightings,
            def.id,
            win.from,
            win.to,
            grain,
            speciesOnWalkMetric ? 'none' : by,
            labelOf,
            6
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      core.ready,
      walks,
      sightings,
      def.id,
      win.from.getTime(),
      win.to.getTime(),
      grain,
      by,
      speciesOnWalkMetric,
      core.routes.data,
      core.users.data,
    ]
  );

  const chartSeries: Series[] = useMemo(() => {
    const out: Series[] = groups.map((g, i) => ({
      key: g.key,
      label: g.label,
      color: colorOf(g.key, i),
      points: g.points,
    }));
    if (groups.length === 1) {
      if (roll > 1)
        out.push({
          key: 'roll',
          label: `${roll}-${grain} mean`,
          color: 'var(--ink3)',
          points: rolling(groups[0].points, roll),
          reference: true,
        });
      const t = showTrend ? linearTrend(groups[0].points) : null;
      if (t)
        out.push({
          key: 'trend',
          label: 'Trend',
          color: 'var(--ink)',
          points: groups[0].points.map((p, i) => ({ t: p.t, v: Math.max(0, t.at(i)) })),
          reference: true,
        });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, roll, showTrend, grain]);

  const main = groups.length === 1 ? groups[0] : null;
  const summary = useMemo(() => {
    if (!main) return null;
    const vals = main.points.map((p) => p.v).filter((v): v is number => v != null);
    const t = linearTrend(main.points);
    const peakIdx = main.points.reduce(
      (bi, p, i, a) => ((p.v ?? -Infinity) > (a[bi].v ?? -Infinity) ? i : bi),
      0
    );
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    return {
      total: main.total,
      mean,
      peak: main.points[peakIdx],
      slope: t?.slope ?? null,
      slopeRel: t && mean ? t.slope / mean : null,
      r2: t?.r2 ?? null,
      n: vals.length,
    };
  }, [main]);

  const fmtX = bucketLabel(grain);
  const fmtTip = bucketLabel(grain, true);
  const fmtV = (v: number) => (def.decimals ? fmtDec(v, def.decimals) : fmtInt(v));
  const rangeText =
    f.range === 'custom' ? 'in the chosen dates' : RANGE_LABEL[f.range].toLowerCase();
  const title = `${def.label} per ${grain}${by !== 'none' && !speciesOnWalkMetric ? `, by ${BREAKDOWNS.find((b) => b.value === by)!.label.toLowerCase()}` : ''}, ${rangeText}`;

  const tableRows = groups.length
    ? groups[0].points.map((p, i) => [
        fmtTip(p.t),
        ...groups.map((g) => (g.points[i].v == null ? '' : fmtV(g.points[i].v!))),
      ])
    : [];

  const exportCsv = () => {
    const rows = groups.length
      ? groups[0].points.map((p, i) => {
          const r: Record<string, unknown> = { period_start: p.t.toISOString().slice(0, 10) };
          for (const g of groups) r[g.label] = g.points[i].v ?? '';
          return r;
        })
      : [];
    download(`hawem_${def.id}_${grain}_${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Explore"
        description="Ask a question of the data: choose a measure, how to group time and what to compare. Every choice is in the link."
        actions={
          <>
            <Button kind="pill" size="sm" icon={<Link2 />} onClick={copyLink}>
              {copied ? 'Link Copied' : 'Copy Link'}
            </Button>
            <Button
              kind="dark"
              size="sm"
              icon={<Download />}
              onClick={exportCsv}
              disabled={!groups.length}
            >
              Download CSV
            </Button>
          </>
        }
      />
      <FilterBar
        f={f}
        summary={
          core.ready
            ? `${fmtInt(walks.length)} sessions, ${fmtInt(sightings.length)} sightings`
            : null
        }
      />
      {core.error ? <ErrorNote message={core.error} onRetry={core.reload} /> : null}

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card
          as="aside"
          className="p-5 self-start xl:sticky xl:top-[104px]"
          aria-label="Question builder"
        >
          <BuilderSection title="Measure">
            <div className="flex flex-col gap-1" role="radiogroup" aria-label="Measure">
              {METRICS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="radio"
                  aria-checked={x.id === def.id}
                  onClick={() => setParams({ m: x.id === 'km' ? null : x.id, chart: null })}
                  className={cx(
                    'text-start px-3 py-2 rounded-[12px] text-[14px] transition-colors',
                    x.id === def.id ? 'bg-pill text-on-pill font-semibold' : 'hover:bg-canvas'
                  )}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </BuilderSection>
          <BuilderSection title="Group time by">
            <Segmented
              label="Time grain"
              value={grain}
              onChange={(v) => setParams({ g: v === auto ? null : v })}
              options={[
                { value: 'day', label: 'Day' },
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ]}
            />
          </BuilderSection>
          <BuilderSection title="Compare by">
            <label className="sr-only" htmlFor="ex-by">
              Compare by
            </label>
            <select
              id="ex-by"
              value={by}
              onChange={(e) => setParams({ by: e.target.value === 'none' ? null : e.target.value })}
              className="w-full h-10 rounded-full bg-canvas ps-4 pe-9 text-[14px] appearance-none bg-no-repeat border border-line"
              style={selectChevron}
            >
              {BREAKDOWNS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
            {by !== 'none' ? (
              <p className="text-[12px] text-ink3 mt-2">
                The six largest groups are shown. Colours stay with each group when filters change.
              </p>
            ) : null}
          </BuilderSection>
          <BuilderSection title="Show as">
            <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Chart type">
              {(
                [
                  ['line', ChartLine, 'Line'],
                  ['area', ChartArea, 'Area'],
                  ['bar', ChartColumnBig, 'Bars'],
                  ['stacked', ChartColumnStacked, 'Stacked'],
                  ['table', Table2, 'Table'],
                ] as const
              ).map(([v, Icon, l]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={chart === v}
                  aria-label={l}
                  title={l}
                  disabled={
                    v === 'stacked' &&
                    (def.kind === 'ratio' || def.kind === 'mean' || def.kind === 'distinct')
                  }
                  onClick={() => setParams({ chart: v })}
                  className={cx(
                    'h-11 rounded-[12px] grid place-items-center disabled:opacity-30',
                    chart === v ? 'bg-pill text-on-pill' : 'bg-canvas text-ink2 hover:text-ink'
                  )}
                >
                  <Icon aria-hidden className="w-5 h-5" />
                </button>
              ))}
            </div>
          </BuilderSection>
          <BuilderSection title="Overlays" last>
            <label className="flex items-center justify-between gap-3 text-[14px] py-1">
              Linear trend
              <Switch
                label="Show linear trend"
                checked={showTrend}
                disabled={by !== 'none'}
                onChange={(v) => setParams({ trend: v ? '1' : null })}
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-[14px] py-1">
              Rolling mean
              <select
                value={String(roll)}
                disabled={by !== 'none'}
                onChange={(e) =>
                  setParams({ roll: e.target.value === '0' ? null : e.target.value })
                }
                aria-label="Rolling mean window"
                className="h-9 rounded-full bg-canvas ps-3 pe-8 text-[13px] appearance-none bg-no-repeat border border-line disabled:opacity-40"
                style={selectChevron}
              >
                <option value="0">Off</option>
                <option value="3">3 {grain}s</option>
                <option value="4">4 {grain}s</option>
                <option value="8">8 {grain}s</option>
              </select>
            </label>
            {by !== 'none' ? (
              <p className="text-[12px] text-ink3">Overlays apply when comparing nothing.</p>
            ) : null}
          </BuilderSection>
        </Card>

        <div className="flex flex-col gap-4 min-w-0">
          {speciesOnWalkMetric ? (
            <Notice tone="warn">
              {def.label} is a property of a walk, and a walk is effort for every species at once,
              so it is not split by species. Choose Sightings, Animals counted, Welfare alerts or
              Mean body condition to compare species.
            </Notice>
          ) : null}
          <Card>
            <div className="px-6 pt-5">
              <h2 className="text-[22px] font-semibold tracking-[-0.01em]">{title}</h2>
              <p className="text-[13px] text-ink2 mt-1 max-w-[80ch]">{def.help}</p>
            </div>
            {summary ? (
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 pt-5">
                <SummaryItem
                  k={
                    def.kind === 'sum'
                      ? 'Total'
                      : def.kind === 'distinct'
                        ? 'Distinct people'
                        : 'Whole period'
                  }
                  v={fmtMetric(summary.total, def.decimals)}
                  unit={def.unit}
                />
                <SummaryItem
                  k={`Mean per ${grain}`}
                  v={fmtMetric(summary.mean, def.decimals || 1)}
                  unit={def.unit}
                />
                <SummaryItem
                  k={`Busiest ${grain}`}
                  v={summary.peak?.v != null ? fmtV(summary.peak.v) : 'No data'}
                  sub={summary.peak?.v != null ? fmtTip(summary.peak.t) : undefined}
                />
                <SummaryItem
                  k="Trend"
                  v={
                    summary.slopeRel == null
                      ? 'Too few points'
                      : `${summary.slopeRel >= 0 ? '+' : ''}${fmtDec(summary.slopeRel * 100, 1)}%`
                  }
                  sub={
                    summary.slopeRel == null
                      ? undefined
                      : `of the mean per ${grain}, R² ${fmtDec(summary.r2 ?? 0, 2)}`
                  }
                />
              </dl>
            ) : null}
            <div className="pt-4">
              {!core.ready ? (
                <Skeleton className="h-[360px] mx-6 mb-6" />
              ) : chart === 'table' ? (
                <div className="px-6 pb-6">
                  <ResultTable
                    columns={['Period', ...groups.map((g) => g.label)]}
                    rows={tableRows}
                  />
                </div>
              ) : (
                <ChartFrame
                  label={title}
                  legend={
                    <Legend
                      kind={chart === 'bar' || chart === 'stacked' ? 'rect' : 'line'}
                      items={chartSeries.map((s) => ({
                        label: s.label,
                        color: s.color,
                        dashed: s.reference,
                      }))}
                    />
                  }
                  chart={
                    <TimeChart
                      label={title}
                      kind={chart}
                      height={360}
                      series={chartSeries}
                      formatX={fmtX}
                      formatTip={fmtTip}
                      format={fmtV}
                      markLast={chart === 'bar' && by === 'none'}
                    />
                  }
                  table={{ columns: ['Period', ...groups.map((g) => g.label)], rows: tableRows }}
                />
              )}
            </div>
          </Card>

          {groups.length > 1 ? (
            <Card>
              <div className="px-6 pt-5 pb-2">
                <h2 className="text-[17px] font-semibold">Groups compared</h2>
              </div>
              <div className="px-6 pb-6">
                <ResultTable
                  columns={[
                    'Group',
                    def.kind === 'sum' ? 'Total' : 'Whole period',
                    `Mean per ${grain}`,
                    'Trend per period',
                  ]}
                  rows={groups.map((g) => {
                    const vals = g.points.map((p) => p.v).filter((v): v is number => v != null);
                    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                    const t = linearTrend(g.points);
                    return [
                      g.label,
                      fmtMetric(g.total, def.decimals),
                      fmtMetric(mean, def.decimals || 1),
                      t && mean
                        ? `${t.slope >= 0 ? '+' : ''}${fmtDec((t.slope / mean) * 100, 1)}%`
                        : 'Too few points',
                    ];
                  })}
                  swatches={groups.map((g, i) => colorOf(g.key, i))}
                />
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function BuilderSection({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section className={cx('pb-4 mb-4', !last && 'border-b border-line')}>
      <h3 className="text-[12px] font-semibold text-ink3 mb-2">{title}</h3>
      {children}
    </section>
  );
}

function SummaryItem({ k, v, unit, sub }: { k: string; v: string; unit?: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-tile bg-canvas px-4 py-3">
      <dt className="text-[12px] text-ink3">{k}</dt>
      <dd className="text-[22px] font-semibold leading-tight mt-1 truncate">
        {v}
        {unit && v !== 'No data' && !v.startsWith('Too') ? (
          <span className="text-[13px] font-medium text-ink2 ms-1">{unit}</span>
        ) : null}
      </dd>
      {sub ? <dd className="text-[12px] text-ink2 truncate mt-0.5">{sub}</dd> : null}
    </div>
  );
}

function ResultTable({
  columns,
  rows,
  swatches,
}: {
  columns: string[];
  rows: (string | number)[][];
  swatches?: string[];
}) {
  return (
    <div className="max-h-[480px] overflow-auto rounded-tile border border-line">
      <table className="w-full text-[13px]">
        <thead className="sticky top-0 bg-surface">
          <tr>
            {columns.map((c, i) => (
              <th
                key={c}
                className={cx(
                  'px-4 py-2.5 font-semibold text-ink3 text-[12px] whitespace-nowrap',
                  i ? 'text-end' : 'text-start'
                )}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="hover:bg-canvas">
              {r.map((c, i) => (
                <td
                  key={i}
                  className={cx(
                    'px-4 py-2 border-t border-line whitespace-nowrap',
                    i ? 'text-end tabular' : ''
                  )}
                >
                  {i === 0 && swatches ? (
                    <span
                      aria-hidden
                      className="inline-block w-2.5 h-2.5 rounded-[3px] me-2 align-middle"
                      style={{ background: swatches[ri] }}
                    />
                  ) : null}
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
