import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '../ui';

/**
 * SVG charts for the portal, built to the dataviz method:
 * - one axis, never two; thin marks (2 px lines, <= 24 px bars, 4 px rounded
 *   data ends square at the baseline); 10% area wash; hairline solid grid;
 * - colour follows the entity (callers pass a stable colour per series);
 * - a legend for two or more series, none for one; text never wears the
 *   series colour;
 * - hover: crosshair snapping to the nearest X with one tooltip listing every
 *   series on line/area; per-mark tooltip on bars and cells; the same on
 *   keyboard focus (arrow keys move the crosshair);
 * - every chart has a table twin (ChartFrame toggles it).
 */

export interface Series {
  key: string;
  label: string;
  color: string;
  points: { t: Date; v: number | null }[];
  /** Drawn as a thin reference line (trend, rolling mean), no area, no markers */
  reference?: boolean;
}

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Clean axis ticks: 0, 1, 2, 5 x 10^n steps. */
export function niceTicks(max: number, count = 4) {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

const compact = (n: number) =>
  new Intl.NumberFormat(undefined, {
    notation: n >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: n < 10 ? 2 : 1,
  }).format(n);

export function Legend({
  items,
  kind = 'line',
}: {
  items: { label: string; color: string; dashed?: boolean }[];
  kind?: 'line' | 'rect';
}) {
  if (items.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-ink2" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          {kind === 'rect' ? (
            <span
              aria-hidden
              className="w-2.5 h-2.5 rounded-[3px]"
              style={{ background: i.color }}
            />
          ) : (
            <span
              aria-hidden
              className="w-3.5 h-0 border-t-2"
              style={{ borderColor: i.color, borderStyle: i.dashed ? 'dashed' : 'solid' }}
            />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

interface TimeChartProps {
  series: Series[];
  height?: number;
  kind?: 'line' | 'area' | 'bar' | 'stacked';
  format?: (v: number) => string;
  formatX?: (d: Date) => string;
  formatTip?: (d: Date) => string;
  label: string;
  /** Highlight the last bucket (current period) */
  markLast?: boolean;
  dim?: boolean;
}

/** Line, area, grouped bar or stacked bar over time, one y-axis. */
export function TimeChart({
  series,
  height = 240,
  kind = 'line',
  format = compact,
  formatX = (d) => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(d),
  formatTip,
  label,
  markLast,
  dim,
}: TimeChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const data = series.filter((s) => !s.reference);
  const n = series[0]?.points.length ?? 0;
  const pad = { l: 44, r: 12, t: 12, b: 28 };
  const w = Math.max(0, width - pad.l - pad.r);
  const h = height - pad.t - pad.b;

  const max = useMemo(() => {
    let m = 0;
    if (kind === 'stacked') {
      for (let i = 0; i < n; i++)
        m = Math.max(
          m,
          data.reduce((a, s) => a + (s.points[i]?.v ?? 0), 0)
        );
    } else for (const s of series) for (const p of s.points) if (p.v != null) m = Math.max(m, p.v);
    return m;
  }, [series, kind, n, data]);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const y = (v: number) => pad.t + h - (v / top) * h;
  const band = n ? w / n : 0;
  const x = (i: number) =>
    kind === 'bar' || kind === 'stacked'
      ? pad.l + band * (i + 0.5)
      : pad.l + (n > 1 ? (w * i) / (n - 1) : w / 2);

  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(w / 72))));
  const tipDate = formatTip ?? formatX;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i =
      kind === 'bar' || kind === 'stacked'
        ? Math.floor(px / (band || 1))
        : Math.round((px / (w || 1)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') setHover((h0) => Math.min(n - 1, (h0 ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setHover((h0) => Math.max(0, (h0 ?? n) - 1));
    else if (e.key === 'Escape') setHover(null);
    else return;
    e.preventDefault();
  };

  const path = (s: Series) => {
    let d = '';
    let pen = false;
    s.points.forEach((p, i) => {
      if (p.v == null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const area = (s: Series) => {
    const segs: string[] = [];
    let cur: [number, number][] = [];
    const flush = () => {
      if (cur.length > 1)
        segs.push(
          `M${cur[0][0]},${y(0)}L${cur.map((c) => c.join(',')).join('L')}L${cur[cur.length - 1][0]},${y(0)}Z`
        );
      cur = [];
    };
    s.points.forEach((p, i) =>
      p.v == null ? flush() : cur.push([+x(i).toFixed(1), +y(p.v).toFixed(1)])
    );
    flush();
    return segs.join('');
  };

  const barW = Math.min(
    24,
    Math.max(2, (band - 4) / (kind === 'bar' ? Math.max(1, data.length) : 1))
  );
  const roundTop = (bx: number, by: number, bw: number, bh: number, r = 4) => {
    const rr = Math.min(r, bw / 2, bh);
    return `M${bx},${by + bh}V${by + rr}Q${bx},${by} ${bx + rr},${by}H${bx + bw - rr}Q${bx + bw},${by} ${bx + bw},${by + rr}V${by + bh}Z`;
  };

  return (
    <div
      ref={ref}
      className={cx('relative w-full select-none transition-opacity', dim && 'opacity-50')}
      style={{ height }}
    >
      {width > 0 && n > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          className="block overflow-visible"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={pad.l}
                x2={pad.l + w}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--grid)"
                strokeWidth={1}
              />
              <text
                x={pad.l - 8}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-ink3 text-[11px] tabular"
              >
                {format(t)}
              </text>
            </g>
          ))}
          {series[0].points.map((p, i) =>
            i % labelEvery === 0 ? (
              <text
                key={i}
                x={x(i)}
                y={height - 8}
                textAnchor="middle"
                className="fill-ink3 text-[11px]"
              >
                {formatX(p.t)}
              </text>
            ) : null
          )}

          {kind === 'area'
            ? data.map((s) => <path key={`a${s.key}`} d={area(s)} fill={s.color} opacity={0.1} />)
            : null}

          {kind === 'bar'
            ? data.map((s, si) =>
                s.points.map((p, i) => {
                  if (!p.v) return null;
                  const bx =
                    x(i) - (barW * data.length + 2 * (data.length - 1)) / 2 + si * (barW + 2);
                  const by = y(p.v);
                  const last = markLast && i === n - 1;
                  return (
                    <path
                      key={`${s.key}${i}`}
                      d={roundTop(bx, by, barW, y(0) - by)}
                      fill={s.color}
                      opacity={
                        hover == null || hover === i
                          ? data.length === 1 && markLast && !last
                            ? 0.55
                            : 1
                          : 0.35
                      }
                    />
                  );
                })
              )
            : null}

          {kind === 'stacked'
            ? series[0].points.map((_, i) => {
                let acc = 0;
                const segs = data.filter((s) => (s.points[i]?.v ?? 0) > 0);
                return segs.map((s, si) => {
                  const v = s.points[i].v as number;
                  const y1 = y(acc + v);
                  const y0 = y(acc);
                  acc += v;
                  const hgt = Math.max(0, y0 - y1 - (si < segs.length - 1 ? 2 : 0));
                  const bx = x(i) - barW / 2;
                  const isTop = si === segs.length - 1;
                  return (
                    <path
                      key={`${s.key}${i}`}
                      d={
                        isTop
                          ? roundTop(bx, y1, barW, hgt)
                          : `M${bx},${y1 + (y0 - y1 - hgt)}h${barW}v${hgt}h${-barW}Z`
                      }
                      fill={s.color}
                      opacity={hover == null || hover === i ? 1 : 0.35}
                    />
                  );
                });
              })
            : null}

          {kind === 'line' || kind === 'area'
            ? data.map((s) => (
                <path
                  key={s.key}
                  d={path(s)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))
            : null}
          {series
            .filter((s) => s.reference)
            .map((s) => (
              <path
                key={s.key}
                d={path(s)}
                fill="none"
                stroke={s.color}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                opacity={0.9}
              />
            ))}

          {(kind === 'line' || kind === 'area') && n > 0
            ? data.map((s) => {
                const i = hover ?? n - 1;
                const p = s.points[i];
                if (!p || p.v == null) return null;
                return (
                  <circle
                    key={`m${s.key}`}
                    cx={x(i)}
                    cy={y(p.v)}
                    r={4}
                    fill={s.color}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                );
              })
            : null}

          {hover != null && (kind === 'line' || kind === 'area') ? (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={pad.t}
              y2={pad.t + h}
              stroke="var(--ink3)"
              strokeWidth={1}
            />
          ) : null}

          <rect
            x={pad.l}
            y={pad.t}
            width={w}
            height={h}
            fill="transparent"
            tabIndex={0}
            role="presentation"
            aria-label={`${label}: use the arrow keys to read values`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            onKeyDown={onKey}
            onBlur={() => setHover(null)}
            className="outline-none focus-visible:stroke-[var(--accent)] focus-visible:[stroke-width:2]"
          />
        </svg>
      ) : null}
      {hover != null && width > 0 ? (
        <ChartTip
          x={x(hover)}
          width={width}
          title={tipDate(series[0].points[hover].t)}
          rows={series.map((s) => ({
            label: s.label,
            color: s.color,
            value: s.points[hover]?.v,
            dashed: s.reference,
          }))}
          format={format}
        />
      ) : null}
    </div>
  );
}

function ChartTip({
  x,
  width,
  title,
  rows,
  format,
}: {
  x: number;
  width: number;
  title: string;
  rows: { label: string; color: string; value: number | null | undefined; dashed?: boolean }[];
  format: (v: number) => string;
}) {
  const left = x > width / 2;
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute top-1 pointer-events-none bg-pill text-on-pill rounded-[12px] px-3 py-2 shadow-float text-[12px] min-w-[140px] z-10"
      style={left ? { right: width - x + 12 } : { left: x + 12 }}
    >
      <p className="opacity-70 mb-1">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 whitespace-nowrap">
          <span
            aria-hidden
            className="w-3 border-t-2"
            style={{ borderColor: r.color, borderStyle: r.dashed ? 'dashed' : 'solid' }}
          />
          <span className="font-semibold tabular">
            {r.value == null ? 'No data' : format(r.value)}
          </span>
          <span className="opacity-70">{r.label}</span>
        </p>
      ))}
    </div>
  );
}

/** 12-point sparkline in the de-emphasis hue, current period in the accent. */
export function Sparkline({
  values,
  height = 36,
  label,
}: {
  values: (number | null)[];
  height?: number;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const vs = values.map((v) => v ?? 0);
  const max = Math.max(1e-9, ...vs);
  const n = vs.length;
  const pts = vs.map((v, i) => [
    n > 1 ? (i / (n - 1)) * (width - 6) + 3 : width / 2,
    height - 4 - (v / max) * (height - 8),
  ]);
  return (
    <div ref={ref} style={{ height }} className="w-full">
      {width > 0 && n > 1 ? (
        <svg width={width} height={height} role="img" aria-label={label}>
          <path
            d={`M${pts[0][0]},${height}L${pts.map((p) => p.join(',')).join('L')}L${pts[n - 1][0]},${height}Z`}
            fill="var(--chart-1)"
            opacity={0.1}
          />
          <path
            d={`M${pts.map((p) => p.join(',')).join('L')}`}
            fill="none"
            stroke="var(--ink3)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <circle
            cx={pts[n - 1][0]}
            cy={pts[n - 1][1]}
            r={3.5}
            fill="var(--chart-1)"
            stroke="var(--surface)"
            strokeWidth={2}
          />
        </svg>
      ) : null}
    </div>
  );
}

/** Horizontal bars for categories, value at the tip. One series = one colour. */
export function BarList({
  items,
  format = compact,
  color = 'var(--chart-1)',
  label,
  max,
}: {
  items: {
    key: string;
    label: React.ReactNode;
    value: number;
    href?: string;
    color?: string;
    detail?: string;
  }[];
  format?: (v: number) => string;
  color?: string;
  label: string;
  max?: number;
}) {
  const top = max ?? Math.max(1e-9, ...items.map((i) => i.value));
  return (
    <ul aria-label={label} className="flex flex-col gap-2.5">
      {items.map((it) => {
        const inner = (
          <>
            <div className="flex items-baseline gap-2 text-[13px] mb-1">
              <span className="flex-1 min-w-0 truncate">{it.label}</span>
              {it.detail ? <span className="text-ink3 text-[12px]">{it.detail}</span> : null}
              <span className="font-semibold tabular">{format(it.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-canvas overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(it.value / top) * 100}%`, background: it.color ?? color }}
              />
            </div>
          </>
        );
        return (
          <li key={it.key}>
            {it.href ? (
              <a href={it.href} className="block rounded-[8px] hover:bg-canvas -mx-2 px-2 py-1">
                {inner}
              </a>
            ) : (
              <div className="py-1">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Part-to-whole in one bar with a 2 px surface gap between segments. */
export function SplitBar({
  parts,
  label,
}: {
  parts: { label: string; value: number; color: string }[];
  label: string;
}) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total)
    return <div className="h-3 rounded-full bg-canvas" aria-label={`${label}: no data`} />;
  return (
    <div
      className="flex h-3 gap-[2px]"
      role="img"
      aria-label={`${label}: ${parts.map((p) => `${p.label} ${p.value}`).join(', ')}`}
    >
      {parts
        .filter((p) => p.value > 0)
        .map((p, i, arr) => (
          <div
            key={p.label}
            title={`${p.label}: ${p.value}`}
            className={cx(i === 0 && 'rounded-s-full', i === arr.length - 1 && 'rounded-e-full')}
            style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
          />
        ))}
    </div>
  );
}

const heatVar = (level: number) => `var(--heat-${level})`;

/** GitHub-style calendar: weeks as columns, Monday first; one sequential hue. */
export function CalendarHeatmap({
  days,
  weeks = 26,
  value,
  format,
  label,
  end = new Date(),
}: {
  days: Map<string, number>;
  weeks?: number;
  value?: (k: string) => number;
  format: (v: number, d: Date) => string;
  label: string;
  end?: Date;
}) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const startMonday = new Date(last);
  startMonday.setDate(startMonday.getDate() - ((startMonday.getDay() + 6) % 7) - (weeks - 1) * 7);
  const cells: { d: Date; v: number }[] = [];
  let max = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(startMonday);
    d.setDate(d.getDate() + i);
    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const v = value ? value(k) : (days.get(k) ?? 0);
    max = Math.max(max, v);
    cells.push({ d, v });
  }
  const level = (v: number) => (v <= 0 ? 0 : Math.min(4, Math.ceil((v / (max || 1)) * 4)));
  const cs = 13;
  const gap = 3;
  const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short' });
  const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  return (
    <div className="relative">
      <div className="overflow-x-auto scrollbar-none">
        <svg
          width={30 + weeks * (cs + gap)}
          height={18 + 7 * (cs + gap)}
          role="img"
          aria-label={label}
          onPointerLeave={() => setTip(null)}
        >
          {[0, 2, 4].map((r) => (
            <text key={r} x={0} y={18 + r * (cs + gap) + cs - 2} className="fill-ink3 text-[10px]">
              {dayFmt.format(new Date(2024, 0, 1 + r))}
            </text>
          ))}
          {cells.map(({ d, v }, i) => {
            const col = Math.floor(i / 7);
            const row = i % 7;
            const future = d > last;
            const showMonth = row === 0 && d.getDate() <= 7;
            return (
              <g key={i}>
                {showMonth ? (
                  <text x={30 + col * (cs + gap)} y={10} className="fill-ink3 text-[10px]">
                    {monthFmt.format(d)}
                  </text>
                ) : null}
                <rect
                  x={30 + col * (cs + gap)}
                  y={18 + row * (cs + gap)}
                  width={cs}
                  height={cs}
                  rx={3.5}
                  fill={future ? 'transparent' : heatVar(level(v))}
                  onPointerEnter={(e) => {
                    const r = (
                      e.currentTarget.ownerSVGElement as SVGSVGElement
                    ).getBoundingClientRect();
                    const b = e.currentTarget.getBoundingClientRect();
                    setTip({ x: b.left - r.left + cs / 2, y: b.top - r.top, text: format(v, d) });
                  }}
                />
              </g>
            );
          })}
        </svg>
      </div>
      {tip ? (
        <div
          className="absolute pointer-events-none bg-pill text-on-pill rounded-[10px] px-2.5 py-1.5 text-[12px] whitespace-nowrap -translate-x-1/2 -translate-y-full z-10"
          style={{ left: tip.x, top: tip.y - 6 }}
        >
          {tip.text}
        </div>
      ) : null}
      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-ink3 justify-end">
        Less
        {[0, 1, 2, 3, 4].map((l) => (
          <span
            key={l}
            aria-hidden
            className="w-3 h-3 rounded-[3px]"
            style={{ background: heatVar(l) }}
          />
        ))}
        More
      </div>
    </div>
  );
}

/** Weekday x hour matrix of sessions started. */
export function HourHeatmap({ grid, label }: { grid: number[][]; label: string }) {
  const [tip, setTip] = useState<string | null>(null);
  const max = Math.max(1, ...grid.flat());
  const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  return (
    <div>
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: '34px repeat(24, minmax(0, 1fr))' }}
        role="img"
        aria-label={label}
      >
        {grid.map((row, r) => (
          <React.Fragment key={r}>
            <span className="text-[10px] text-ink3 self-center">
              {dayFmt.format(new Date(2024, 0, 1 + r))}
            </span>
            {row.map((v, h) => (
              <span
                key={h}
                className="aspect-square rounded-[3px]"
                style={{ background: heatVar(v ? Math.min(4, Math.ceil((v / max) * 4)) : 0) }}
                onPointerEnter={() =>
                  setTip(
                    `${dayFmt.format(new Date(2024, 0, 1 + r))} ${String(h).padStart(2, '0')}:00, ${v} ${v === 1 ? 'session' : 'sessions'}`
                  )
                }
                onPointerLeave={() => setTip(null)}
              />
            ))}
          </React.Fragment>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-[10px] text-ink3 text-center">
            {h % 6 === 0 ? h : ''}
          </span>
        ))}
      </div>
      <p className="text-[12px] text-ink2 mt-2 h-4" aria-live="polite">
        {tip ?? ''}
      </p>
    </div>
  );
}

/** Columns for a binned distribution (histogram), value on hover. */
export function Columns({
  bins,
  label,
  formatBin,
  height = 160,
  color = 'var(--chart-1)',
}: {
  bins: { label: string; value: number }[];
  label: string;
  formatBin?: (b: { label: string; value: number }) => string;
  height?: number;
  color?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bins.map((b) => b.value));
  const ticks = niceTicks(max, 3);
  const top = ticks[ticks.length - 1];
  const pad = { l: 32, b: 22, t: 8 };
  const w = Math.max(0, width - pad.l);
  const h = height - pad.b - pad.t;
  const band = bins.length ? w / bins.length : 0;
  const bw = Math.min(24, band - 2);
  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={label}>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={pad.l}
                x2={width}
                y1={pad.t + h - (t / top) * h}
                y2={pad.t + h - (t / top) * h}
                stroke="var(--grid)"
              />
              <text
                x={pad.l - 6}
                y={pad.t + h - (t / top) * h}
                dy="0.32em"
                textAnchor="end"
                className="fill-ink3 text-[10px] tabular"
              >
                {t}
              </text>
            </g>
          ))}
          {bins.map((b, i) => {
            const bh = (b.value / top) * h;
            const bx = pad.l + band * i + (band - bw) / 2;
            const by = pad.t + h - bh;
            const r = Math.min(4, bw / 2, bh);
            return (
              <g key={i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                <rect x={pad.l + band * i} y={pad.t} width={band} height={h} fill="transparent" />
                {b.value > 0 ? (
                  <path
                    d={`M${bx},${by + bh}V${by + r}Q${bx},${by} ${bx + r},${by}H${bx + bw - r}Q${bx + bw},${by} ${bx + bw},${by + r}V${by + bh}Z`}
                    fill={color}
                    opacity={hover == null || hover === i ? 1 : 0.4}
                  />
                ) : null}
                {i % Math.max(1, Math.ceil(bins.length / 8)) === 0 ? (
                  <text
                    x={pad.l + band * (i + 0.5)}
                    y={height - 6}
                    textAnchor="middle"
                    className="fill-ink3 text-[10px]"
                  >
                    {b.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : null}
      {hover != null ? (
        <div
          className="absolute top-0 end-0 bg-pill text-on-pill rounded-[10px] px-2.5 py-1 text-[12px] pointer-events-none"
          role="status"
        >
          {formatBin ? formatBin(bins[hover]) : `${bins[hover].label}: ${bins[hover].value}`}
        </div>
      ) : null}
    </div>
  );
}

/** Card body that toggles between a chart and its table twin. */
export function ChartFrame({
  chart,
  table,
  legend,
  toolbar,
  label,
}: {
  chart: React.ReactNode;
  table: { columns: string[]; rows: (string | number)[][] };
  legend?: React.ReactNode;
  toolbar?: React.ReactNode;
  label: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <div className="px-6 pb-5">
      <div className="flex flex-wrap items-center gap-3 mb-3 min-h-8">
        <div className="flex-1 min-w-0">{legend}</div>
        {toolbar}
        <button
          type="button"
          onClick={() => setAsTable((t) => !t)}
          aria-pressed={asTable}
          className="h-8 px-3 rounded-full text-[12px] font-semibold text-ink2 bg-canvas hover:text-ink"
        >
          {asTable ? 'Show Chart' : 'Show Table'}
        </button>
      </div>
      {asTable ? (
        <div className="max-h-[320px] overflow-auto rounded-tile bg-canvas">
          <table className="w-full text-[13px]" aria-label={label}>
            <thead className="sticky top-0 bg-canvas">
              <tr>
                {table.columns.map((c, i) => (
                  <th
                    key={c}
                    className={cx(
                      'px-4 py-2 font-semibold text-ink3 text-[12px] whitespace-nowrap',
                      i ? 'text-end' : 'text-start'
                    )}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, i) => (
                    <td
                      key={i}
                      className={cx(
                        'px-4 py-1.5 border-t border-line whitespace-nowrap',
                        i ? 'text-end tabular' : ''
                      )}
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        chart
      )}
    </div>
  );
}

export const SPECIES_COLOR: Record<string, string> = {
  cat: 'var(--chart-cat)',
  dog: 'var(--chart-dog)',
  unknown: 'var(--chart-unknown)',
};
/** Categorical slots in fixed order; a 7th+ group folds into Other upstream. */
export const SERIES_COLORS = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);
