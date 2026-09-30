import { useMemo } from 'react';
import { Footprints, Search } from 'lucide-react';
import { getSightings, getTrack, getWalks, type Walk } from '../data/api';
import { useData } from '../data/useData';
import { fmtDateTime, fmtDuration, fmtInt, fmtKm } from '../lib/format';
import { setParam } from '../lib/router';
import {
  perWalk,
  PROTOCOL_LABEL,
  REASON_LABEL,
  TIME_OF_DAY_LABEL,
  WEATHER_LABEL,
} from '../lib/stats';
import { MapView, type MapLine, type MapPoint } from '../components/LazyMap';
import {
  Badge,
  Card,
  Drawer,
  EmptyState,
  ErrorNote,
  inputClass,
  PageHeader,
  Segmented,
  Skeleton,
  Table,
  td,
  th,
  tdNum,
} from '../ui';
import { StatusBadge } from './Overview';
import type { PageProps } from './types';

type Status = 'all' | 'flagged' | 'complete';
type Kind = 'all' | 'transect' | 'stationary_point' | 'incidental';

export function Walks({ params }: PageProps) {
  const status = (params.get('status') as Status) || 'all';
  const kind = (params.get('type') as Kind) || 'all';
  const q = params.get('q') ?? '';
  const open = params.get('walk');
  const walks = useData('walks', getWalks);
  const sightings = useData('sightings', getSightings);
  const counts = useMemo(
    () => (sightings.data ? perWalk(sightings.data) : new Map()),
    [sightings.data]
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (walks.data ?? []).filter(
      (w) =>
        (status === 'all' ||
          (status === 'flagged'
            ? w.validation_status === 'flagged'
            : w.complete_session && w.protocol !== 'incidental')) &&
        (kind === 'all' || w.protocol === kind) &&
        (!needle || (w.observer?.display_name ?? '').toLowerCase().includes(needle))
    );
  }, [walks.data, status, kind, q]);

  const selected = walks.data?.find((w) => w.id === open) ?? null;

  return (
    <>
      <PageHeader
        title="Walks"
        description="Every survey session with its effort, completeness and validation result."
      />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Segmented
          label="Validation"
          value={status}
          onChange={(v) => setParam('status', v === 'all' ? undefined : v)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'complete', label: 'Complete' },
            { value: 'flagged', label: 'Flagged' },
          ]}
        />
        <label className="sr-only" htmlFor="walk-type">
          Record type
        </label>
        <select
          id="walk-type"
          value={kind}
          onChange={(e) => setParam('type', e.target.value === 'all' ? undefined : e.target.value)}
          className={`${inputClass} w-auto h-10 bg-surface`}
        >
          <option value="all">All types</option>
          <option value="transect">Survey walks</option>
          <option value="stationary_point">Point counts</option>
          <option value="incidental">Quick sightings</option>
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search
            aria-hidden
            className="w-4 h-4 text-ink3 absolute left-3.5 top-1/2 -translate-y-1/2"
          />
          <label className="sr-only" htmlFor="walk-q">
            Search volunteers
          </label>
          <input
            id="walk-q"
            type="search"
            autoComplete="off"
            defaultValue={q}
            onChange={(e) => setParam('q', e.target.value || undefined)}
            placeholder="Search volunteers…"
            className={`${inputClass} w-full h-10 pl-10 bg-surface`}
          />
        </div>
        <span className="ml-auto text-[13px] text-ink2 tabular" aria-live="polite">
          {walks.data ? `${fmtInt(rows.length)} of ${fmtInt(walks.data.length)}` : ''}
        </span>
      </div>
      {walks.error ? <ErrorNote message={walks.error} onRetry={walks.reload} /> : null}
      <Card>
        {!walks.data ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Footprints />}
            title="No walks match"
            body="Change the filters above to see more."
          />
        ) : (
          <Table label="Walks">
            <thead>
              <tr>
                <th className={th}>Started</th>
                <th className={th}>Volunteer</th>
                <th className={th}>Type</th>
                <th className={`${th} text-right`}>Time</th>
                <th className={`${th} text-right`}>km</th>
                <th className={`${th} text-right`}>Animals</th>
                <th className={th}>Status</th>
                <th className={th}>Why flagged</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 500).map((w) => (
                <tr key={w.id} className="hover:bg-canvas">
                  <td className={`${td} whitespace-nowrap`}>
                    <button
                      type="button"
                      onClick={() => setParam('walk', w.id)}
                      className="font-medium text-accent hover:underline"
                    >
                      {fmtDateTime(w.start_time)}
                    </button>
                  </td>
                  <td className={`${td} max-w-[180px] truncate`}>
                    {w.observer?.display_name || 'Anonymous'}
                  </td>
                  <td className={`${td} whitespace-nowrap text-ink2`}>
                    {PROTOCOL_LABEL[w.protocol]}
                  </td>
                  <td className={tdNum}>
                    {w.protocol === 'incidental' ? '-' : fmtDuration(w.duration_min)}
                  </td>
                  <td className={tdNum}>
                    {w.protocol === 'transect' ? fmtKm(w.distance_km ?? 0) : '-'}
                  </td>
                  <td className={tdNum}>{fmtInt(counts.get(w.id)?.animals ?? 0)}</td>
                  <td className={td}>
                    <StatusBadge w={w} />
                  </td>
                  <td className={`${td} text-ink2 text-[13px]`}>
                    {w.validation_reasons.map((r) => REASON_LABEL[r] ?? r).join(', ') || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {rows.length > 500 ? (
          <p className="px-5 py-3 text-[13px] text-ink2 border-t border-line">
            Showing the latest 500. Narrow the filters to see older walks.
          </p>
        ) : null}
      </Card>

      <Drawer
        open={!!selected}
        onClose={() => setParam('walk', undefined)}
        title={selected ? `Walk on ${fmtDateTime(selected.start_time)}` : 'Walk'}
      >
        {selected ? <WalkDetail w={selected} /> : null}
      </Drawer>
    </>
  );
}

function WalkDetail({ w }: { w: Walk }) {
  const track = useData(`track:${w.id}`, () => getTrack(w.id));
  const sightings = useData('sightings', getSightings);
  const mine = (sightings.data ?? []).filter((s) => s.session_id === w.id);
  const coords = useMemo(() => {
    const t = track.data?.[0]?.track_geojson;
    if (!t) return [] as [number, number][];
    try {
      return (JSON.parse(t) as { coordinates: [number, number][] }).coordinates;
    } catch {
      return [];
    }
  }, [track.data]);
  const lines: MapLine[] = coords.length ? [{ id: w.id, coords, kind: 'track' }] : [];
  const points: MapPoint[] = mine.map((s) => ({
    id: s.id,
    lon: s.longitude,
    lat: s.latitude,
    kind: s.species,
    label: `${s.public_code}: ${s.group_size}`,
  }));
  const facts: [string, string][] = [
    ['Volunteer', w.observer?.display_name || 'Anonymous'],
    ['Type', PROTOCOL_LABEL[w.protocol]],
    ['Time', fmtDuration(w.duration_min)],
    ['Distance', w.protocol === 'transect' ? `${fmtKm(w.distance_km ?? 0)} km` : '-'],
    [
      'Complete checklist',
      w.protocol === 'incidental' ? 'Not a survey' : w.complete_session ? 'Yes' : 'No',
    ],
    ['People counting', String(w.number_of_observers)],
    ['Weather', w.weather ? (WEATHER_LABEL[w.weather] ?? w.weather) : 'Not recorded'],
    [
      'Time of day',
      w.time_of_day ? (TIME_OF_DAY_LABEL[w.time_of_day] ?? w.time_of_day) : 'Not recorded',
    ],
    ['Country', w.country_code ?? '-'],
  ];
  return (
    <div className="flex flex-col gap-5">
      {w.validation_status === 'flagged' ? (
        <div
          role="note"
          className="rounded-control bg-warm-soft text-warm-ink px-4 py-3 text-[14px]"
        >
          <p className="font-semibold">Flagged and left out of effort totals</p>
          <p>{w.validation_reasons.map((r) => REASON_LABEL[r] ?? r).join(', ')}</p>
        </div>
      ) : null}
      {lines.length || points.length ? (
        <MapView
          points={points}
          lines={lines}
          height={280}
          dark={document.documentElement.dataset.theme === 'dark'}
          label="This walk's track and sightings"
        />
      ) : (
        <p className="text-[14px] text-ink2">No track was recorded for this session.</p>
      )}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[12px] text-ink3">{k}</dt>
            <dd className="text-[15px] truncate">{v}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h3 className="text-[15px] font-semibold mb-2">Animals ({mine.length})</h3>
        {mine.length === 0 ? (
          <p className="text-[14px] text-ink2">
            {w.complete_session
              ? 'None seen on a complete checklist: a recorded absence.'
              : 'No animals recorded.'}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {mine.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2 text-[14px]">
                <Badge tone={s.species === 'cat' ? 'cat' : s.species === 'dog' ? 'dog' : 'neutral'}>
                  {s.species}
                </Badge>
                <span className="font-medium tabular" translate="no">
                  {s.public_code}
                </span>
                <span className="text-ink2">x{s.group_size}</span>
                <span className="ml-auto text-ink3 tabular">
                  {s.perpendicular_distance_m != null
                    ? `${fmtKm(s.perpendicular_distance_m)} m from path`
                    : 'no distance'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
