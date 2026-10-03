import { useMemo, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { getColonies } from '../data/api';
import { useAnimals, useTracks } from '../data/portal';
import { useData } from '../data/useData';
import { parseTrack } from '../lib/compliance';
import { fmtInt, fmtWeek } from '../lib/format';
import { weekStart } from '../lib/geo';
import { setParams } from '../lib/router';
import { useDark } from '../lib/theme';
import { MapView, type BaseStyle, type MapLine, type MapPoint } from '../components/LazyMap';
import { FilterBar } from '../components/FilterBar';
import { useSlice } from '../components/widgets';
import { Card, cx, ErrorNote, PageHeader, Segmented, Switch } from '../ui';
import type { PageProps } from './types';
import { useEffect } from 'react';

type Layer = 'sightings' | 'heat' | 'tracks' | 'routes' | 'colonies' | 'animals';
const LAYERS: { id: Layer; label: string; swatch: string }[] = [
  { id: 'sightings', label: 'Sightings', swatch: 'var(--chart-cat)' },
  { id: 'heat', label: 'Density heatmap', swatch: 'var(--heat-3)' },
  { id: 'tracks', label: 'Walked tracks', swatch: '#2F7A2B' },
  { id: 'routes', label: 'Fixed routes', swatch: '#F1721D' },
  { id: 'colonies', label: 'Colonies', swatch: '#144513' },
  { id: 'animals', label: 'Known animals', swatch: '#7C3AED' },
];

/**
 * The research map. Every layer follows the filter row; points open their
 * profile page. Exact positions: researchers only (this portal's audience).
 */
export function MapPage({ params }: PageProps) {
  const { core, f, walks, sightings } = useSlice(params, '90d');
  const tracks = useTracks();
  const colonies = useData('colonies', getColonies);
  const { individuals } = useAnimals();
  const dark = useDark();
  const on = new Set<Layer>(
    ((params.get('layers') ?? 'sightings,routes') as string).split(',').filter(Boolean) as Layer[]
  );
  const base = (params.get('base') as BaseStyle) || 'light';
  const toggle = (l: Layer, v: boolean) => {
    const next = new Set(on);
    if (v) next.add(l);
    else next.delete(l);
    if (l === 'heat' && v) next.add('sightings');
    setParams({ layers: [...next].join(',') });
  };

  // Week scrubber: step through the filtered period one week at a time
  const weeks = useMemo(() => {
    const s = new Set<number>();
    for (const w of walks) s.add(weekStart(new Date(w.start_time)).getTime());
    return [...s].sort((a, b) => a - b);
  }, [walks]);
  const [week, setWeek] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing || !weeks.length) return;
    const t = setInterval(() => {
      setWeek((w) => {
        const i = w == null ? 0 : weeks.indexOf(w) + 1;
        if (i >= weeks.length) {
          setPlaying(false);
          return null;
        }
        return weeks[i];
      });
    }, 900);
    return () => clearInterval(t);
  }, [playing, weeks]);

  const walkIds = useMemo(
    () =>
      new Set(
        walks
          .filter((w) => week == null || weekStart(new Date(w.start_time)).getTime() === week)
          .map((w) => w.id)
      ),
    [walks, week]
  );
  const points = useMemo<MapPoint[]>(() => {
    const out: MapPoint[] = [];
    if (on.has('sightings'))
      for (const s of sightings)
        if (walkIds.has(s.session_id))
          out.push({
            id: s.id,
            lon: s.longitude,
            lat: s.latitude,
            kind: s.species,
            label: `${s.public_code}, ${s.group_size} ${s.species}`,
            href: `#/sightings/${s.id}`,
          });
    if (on.has('colonies'))
      for (const c of colonies.data ?? [])
        out.push({
          id: c.id,
          lon: c.longitude,
          lat: c.latitude,
          kind: 'colony',
          label: c.name || 'Colony',
          href: `#/colonies?c=${c.id}`,
        });
    if (on.has('animals'))
      for (const a of individuals.data ?? [])
        if (a.latitude != null && a.longitude != null)
          out.push({
            id: a.id,
            lon: a.longitude,
            lat: a.latitude,
            kind: 'animal',
            label: a.nickname || `Unnamed ${a.species}`,
            href: `#/animals/${a.id}`,
          });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sightings, walkIds, colonies.data, individuals.data, params]);
  const lines = useMemo<MapLine[]>(() => {
    const out: MapLine[] = [];
    if (on.has('routes'))
      for (const r of core.routes.data ?? [])
        if (r.geometry && !r.deleted_at && (!f.route || f.route === r.id))
          out.push({
            id: r.id,
            coords: r.geometry.coordinates,
            kind: r.is_active ? 'route' : 'route-muted',
            arrows: r.direction_rule !== 'either',
            label: r.name,
            href: `#/routes/${r.id}`,
          });
    if (on.has('tracks'))
      for (const t of tracks.data ?? [])
        if (walkIds.has(t.session_id))
          out.push({
            id: t.session_id,
            coords: parseTrack(t.track_geojson),
            kind: 'track',
            href: `#/walks/${t.session_id}`,
          });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core.routes.data, tracks.data, walkIds, params]);

  const shown = sightings.filter((s) => walkIds.has(s.session_id));
  const animals = shown.reduce((a, s) => a + (s.group_size || 1), 0);

  return (
    <>
      <PageHeader
        title="Map"
        description="Where volunteers walked and what they saw. Click any point or line to open it."
      />
      <FilterBar
        f={f}
        summary={
          core.ready ? `${fmtInt(shown.length)} sightings, ${fmtInt(animals)} animals` : null
        }
      />
      {core.error ? <ErrorNote message={core.error} onRetry={core.reload} /> : null}
      <Card className="relative overflow-hidden p-2">
        <MapView
          points={points}
          lines={lines}
          heat={on.has('heat')}
          dark={dark}
          base={base}
          height="calc(100dvh - 300px)"
          fitKey={`${f.route ?? ''}${f.who ?? ''}`}
          label="Research map of sightings, tracks and routes"
        />
        <div className="absolute top-5 start-5 w-[260px] max-w-[calc(100%-40px)] glass rounded-tile shadow-float p-4 flex flex-col gap-3">
          <p className="text-[13px] font-semibold">Layers</p>
          <ul className="flex flex-col gap-2">
            {LAYERS.map((l) => (
              <li key={l.id} className="flex items-center gap-2.5 text-[14px]">
                <span
                  aria-hidden
                  className="w-3 h-3 rounded-full"
                  style={{ background: l.swatch }}
                />
                <span className="flex-1">{l.label}</span>
                <Switch label={l.label} checked={on.has(l.id)} onChange={(v) => toggle(l.id, v)} />
              </li>
            ))}
          </ul>
          <Segmented
            size="sm"
            label="Base map"
            value={base}
            onChange={(v) => setParams({ base: v === 'light' ? null : v })}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'streets', label: 'Streets' },
              { value: 'satellite', label: 'Satellite' },
            ]}
          />
          {on.has('sightings') ? (
            <div className="flex gap-3 text-[12px] text-ink2 pt-1 border-t border-line">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="w-2.5 h-2.5 rounded-full bg-[#3865CC]" /> Cat
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="w-2.5 h-2.5 rounded-full bg-[#C2410C]" /> Dog
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="w-2.5 h-2.5 rounded-full bg-[#6B7078]" /> Unknown
              </span>
            </div>
          ) : null}
        </div>
        {weeks.length > 1 ? (
          <div className="absolute bottom-5 inset-x-5 sm:start-1/2 sm:-translate-x-1/2 rtl:sm:translate-x-1/2 sm:w-[560px] glass rounded-full shadow-float h-14 px-3 flex items-center gap-3">
            <button
              type="button"
              aria-label={playing ? 'Pause' : 'Play week by week'}
              onClick={() => setPlaying((p) => !p)}
              className="w-10 h-10 rounded-full bg-pill text-on-pill grid place-items-center shrink-0"
            >
              {playing ? (
                <Pause aria-hidden className="w-4 h-4" />
              ) : (
                <Play aria-hidden className="w-4 h-4" />
              )}
            </button>
            <label className="flex-1 flex items-center gap-3 min-w-0">
              <span className="sr-only">Week shown</span>
              <input
                type="range"
                min={-1}
                max={weeks.length - 1}
                value={week == null ? -1 : weeks.indexOf(week)}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  setPlaying(false);
                  setWeek(i < 0 ? null : weeks[i]);
                }}
                className="flex-1 accent-[var(--accent)]"
              />
            </label>
            <span
              className={cx(
                'text-[13px] font-semibold whitespace-nowrap w-[118px] text-end tabular'
              )}
              aria-live="polite"
            >
              {week == null ? 'Whole period' : `Week of ${fmtWeek(new Date(week))}`}
            </span>
          </div>
        ) : null}
      </Card>
    </>
  );
}
