import { useMemo } from 'react';
import { getColonies, getRoutes, getSightings, getTracks } from '../data/api';
import { useData } from '../data/useData';
import { fmtDate, fmtInt } from '../lib/format';
import { setParam } from '../lib/router';
import { rangeStart, type Range } from '../lib/stats';
import { MapView, type MapLine, type MapPoint } from '../components/LazyMap';
import { Card, ErrorNote, PageHeader, Segmented } from '../ui';
import type { PageProps } from './types';

const LAYERS = ['cats', 'dogs', 'tracks', 'colonies', 'routes'] as const;
type Layer = (typeof LAYERS)[number];
const LAYER_LABEL: Record<Layer, string> = {
  cats: 'Cats',
  dogs: 'Dogs',
  tracks: 'Walked tracks',
  colonies: 'Colonies',
  routes: 'Routes',
};
const SWATCH: Record<Layer, string> = {
  cats: 'bg-cat',
  dogs: 'bg-dog',
  tracks: 'bg-[#2F7A2B]',
  colonies: 'bg-accent',
  routes: 'bg-warm',
};

export function MapPage({ params }: PageProps) {
  const range = (params.get('range') as Range) || 'all';
  const off = new Set((params.get('hide') ?? '').split(',').filter(Boolean));
  const sightings = useData('sightings', getSightings);
  const tracks = useData('tracks', getTracks);
  const colonies = useData('colonies', getColonies);
  const routes = useData('routes', getRoutes);
  const since = rangeStart(range);
  const dark = document.documentElement.dataset.theme === 'dark';

  const points = useMemo<MapPoint[]>(() => {
    const out: MapPoint[] = [];
    for (const s of sightings.data ?? []) {
      if (since && new Date(s.observed_at) < since) continue;
      if ((s.species === 'cat' && off.has('cats')) || (s.species === 'dog' && off.has('dogs')))
        continue;
      out.push({
        id: s.id,
        lon: s.longitude,
        lat: s.latitude,
        kind: s.species,
        label: `${s.public_code}: ${s.group_size} ${s.species === 'cat' ? 'cat' : s.species === 'dog' ? 'dog' : 'animal'}${s.group_size > 1 ? 's' : ''}, ${fmtDate(s.observed_at)}`,
      });
    }
    if (!off.has('colonies'))
      for (const c of colonies.data ?? [])
        out.push({
          id: c.id,
          lon: c.longitude,
          lat: c.latitude,
          kind: 'colony',
          label: `${c.name || 'Colony'}: about ${c.estimated_population ?? '?'} animals`,
        });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sightings.data, colonies.data, range, params.get('hide')]);

  const lines = useMemo<MapLine[]>(() => {
    const out: MapLine[] = [];
    if (!off.has('tracks'))
      for (const t of tracks.data ?? []) {
        if (!t.track_geojson) continue;
        try {
          const g = JSON.parse(t.track_geojson) as { coordinates: [number, number][] };
          out.push({ id: t.session_id, coords: g.coordinates, kind: 'track' });
        } catch {
          // A malformed track is skipped, not fatal
        }
      }
    if (!off.has('routes'))
      for (const r of routes.data ?? [])
        if (r.geometry && r.is_active)
          out.push({ id: r.id, coords: r.geometry.coordinates, kind: 'route' });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.data, routes.data, params.get('hide')]);

  const toggle = (l: Layer) => {
    const next = new Set(off);
    if (next.has(l)) next.delete(l);
    else next.add(l);
    setParam('hide', [...next].join(',') || undefined);
  };
  const error = sightings.error || tracks.error || colonies.error || routes.error;

  return (
    <>
      <PageHeader
        title="Map"
        description="Exact positions, visible only to signed-in researchers. Public exports use the 1 km grid."
        actions={
          <Segmented
            label="Time range"
            value={range}
            onChange={(v) => setParam('range', v === 'all' ? undefined : v)}
            options={[
              { value: '30d', label: '30 days' },
              { value: '90d', label: '90 days' },
              { value: '12m', label: '12 months' },
              { value: 'all', label: 'All time' },
            ]}
          />
        }
      />
      {error ? <ErrorNote message={error} /> : null}
      <Card className="p-3">
        <fieldset className="flex flex-wrap gap-2 px-1 pb-3">
          <legend className="sr-only">Layers</legend>
          {LAYERS.map((l) => (
            <label
              key={l}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-full bg-canvas text-[13px] font-medium cursor-pointer select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={!off.has(l)}
                onChange={() => toggle(l)}
              />
              <span
                aria-hidden
                className={`w-2.5 h-2.5 rounded-full ${SWATCH[l]} ${off.has(l) ? 'opacity-25' : ''}`}
              />
              <span className={off.has(l) ? 'text-ink3 line-through' : ''}>{LAYER_LABEL[l]}</span>
            </label>
          ))}
          <span className="ml-auto self-center text-[13px] text-ink2 tabular" aria-live="polite">
            {fmtInt(points.length)} points, {fmtInt(lines.length)} lines
          </span>
        </fieldset>
        <MapView
          points={points}
          lines={lines}
          dark={dark}
          height="calc(100vh - 260px)"
          label="Map of sightings, tracks, colonies and routes"
        />
      </Card>
    </>
  );
}
