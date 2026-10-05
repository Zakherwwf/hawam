import { useMemo, useState } from 'react';
import { Download, Footprints, Search } from 'lucide-react';
import type { Walk } from '../data/api';
import { useTracks } from '../data/portal';
import { compliance, parseTrack, previousVisitOf } from '../lib/compliance';
import { download, toCsv } from '../lib/csv';
import { effortRows } from '../lib/exports';
import { fmtDateTime, fmtDuration, fmtInt, fmtKm } from '../lib/format';
import { href, setParam } from '../lib/router';
import { perWalk, PROTOCOL_LABEL } from '../lib/stats';
import { FilterBar } from '../components/FilterBar';
import { reasons, StatusBadge, useSlice } from '../components/widgets';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  inputClass,
  PageHeader,
  Skeleton,
  sortBy,
  SortTh,
  Table,
  td,
  tdNum,
  th,
  type Sort,
} from '../ui';
import type { PageProps } from './types';

type Key = 'start' | 'who' | 'time' | 'km' | 'animals' | 'score';

export function Walks({ params }: PageProps) {
  const { core, f, walks, sightings } = useSlice(params, 'all');
  const tracks = useTracks();
  const q = params.get('q') ?? '';
  const [sort, setSort] = useState<Sort<Key>>({ key: 'start', dir: 'desc' });
  const [limit, setLimit] = useState(100);
  const counts = useMemo(() => perWalk(sightings), [sightings]);
  const routes = useMemo(
    () => new Map((core.routes.data ?? []).map((r) => [r.id, r])),
    [core.routes.data]
  );
  const trackBy = useMemo(
    () => new Map((tracks.data ?? []).map((t) => [t.session_id, t.track_geojson])),
    [tracks.data]
  );

  // Protocol compliance for walks on a fixed route (computed once per data load)
  const scores = useMemo(() => {
    const m = new Map<string, number>();
    if (!tracks.data || !core.walks.data) return m;
    for (const w of walks) {
      const r = w.route_id ? routes.get(w.route_id) : undefined;
      if (!r) continue;
      const c = compliance(
        w,
        parseTrack(trackBy.get(w.id)),
        r,
        previousVisitOf(w, core.walks.data)
      );
      if (c) m.set(w.id, c.score);
    }
    return m;
  }, [walks, routes, trackBy, tracks.data, core.walks.data]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const r = walks.filter(
      (w) =>
        !needle ||
        core.nameOf(w.observer_id).toLowerCase().includes(needle) ||
        core.routeName(w.route_id).toLowerCase().includes(needle) ||
        (w.notes ?? '').toLowerCase().includes(needle)
    );
    return sortBy(r, sort, (w: Walk, k) =>
      k === 'start'
        ? w.start_time
        : k === 'who'
          ? core.nameOf(w.observer_id)
          : k === 'time'
            ? w.duration_min
            : k === 'km'
              ? w.distance_km
              : k === 'animals'
                ? (counts.get(w.id)?.animals ?? 0)
                : (scores.get(w.id) ?? null)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walks, q, sort, counts, scores]);

  const km = walks
    .filter((w) => w.validation_status !== 'flagged')
    .reduce((a, w) => a + (w.distance_km ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Walks"
        description="Every survey session with its effort, completeness, route protocol and validation result."
        actions={
          <Button
            kind="pill"
            size="sm"
            icon={<Download />}
            disabled={!core.ready}
            onClick={() =>
              download(
                `hawem_walks_filtered_${new Date().toISOString().slice(0, 10)}.csv`,
                toCsv(effortRows(rows, sightings))
              )
            }
          >
            Download These Walks
          </Button>
        }
      />
      <FilterBar
        f={f}
        summary={core.ready ? `${fmtInt(rows.length)} sessions, ${fmtKm(km)} km` : null}
      />
      <div className="relative max-w-[420px] mb-4">
        <Search
          aria-hidden
          className="w-4 h-4 text-ink3 absolute start-4 top-1/2 -translate-y-1/2"
        />
        <label className="sr-only" htmlFor="walk-q">
          Search walks
        </label>
        <input
          id="walk-q"
          type="search"
          name="walk-search"
          autoComplete="off"
          defaultValue={q}
          onChange={(e) => setParam('q', e.target.value || undefined)}
          placeholder="Search by volunteer, route or note…"
          className={`${inputClass} w-full h-11 ps-11 rounded-full bg-surface border-0 shadow-pill`}
        />
      </div>
      {core.error ? <ErrorNote message={core.error} onRetry={core.reload} /> : null}
      <Card>
        {!core.ready ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Footprints />}
            title="No walks match"
            body="Widen the date range or clear the filters above."
          />
        ) : (
          <Table label="Walks">
            <thead>
              <tr>
                <SortTh k="start" sort={sort} onSort={setSort}>
                  Started
                </SortTh>
                <SortTh k="who" sort={sort} onSort={setSort}>
                  Volunteer
                </SortTh>
                <th className={th}>Type and route</th>
                <SortTh k="time" sort={sort} onSort={setSort} num>
                  Time
                </SortTh>
                <SortTh k="km" sort={sort} onSort={setSort} num>
                  km
                </SortTh>
                <SortTh k="animals" sort={sort} onSort={setSort} num>
                  Animals
                </SortTh>
                <SortTh k="score" sort={sort} onSort={setSort} num>
                  Protocol
                </SortTh>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((w) => {
                const s = scores.get(w.id);
                return (
                  <tr key={w.id} className="hover:bg-canvas">
                    <td className={`${td} whitespace-nowrap`}>
                      <a href={href(`walks/${w.id}`)} className="font-semibold hover:underline">
                        {fmtDateTime(w.start_time)}
                      </a>
                    </td>
                    <td className={`${td} max-w-[220px]`}>
                      <a
                        href={href(`people/${w.observer_id}`)}
                        className="flex items-center gap-2.5 min-w-0 hover:underline"
                      >
                        <Avatar id={w.observer_id} name={core.nameOf(w.observer_id)} size={28} />
                        <span className="truncate">{core.nameOf(w.observer_id)}</span>
                      </a>
                    </td>
                    <td className={`${td} max-w-[240px]`}>
                      <span className="block text-ink2 truncate">{PROTOCOL_LABEL[w.protocol]}</span>
                      {w.route_id ? (
                        <a
                          href={href(`routes/${w.route_id}`)}
                          className="block text-[12px] text-ink3 truncate hover:underline"
                        >
                          {core.routeName(w.route_id)}
                          {w.route_version ? `, v${w.route_version}` : ''}
                        </a>
                      ) : null}
                    </td>
                    <td className={tdNum}>
                      {w.protocol === 'incidental' ? '-' : fmtDuration(w.duration_min)}
                    </td>
                    <td className={tdNum}>
                      {w.protocol === 'transect' ? fmtKm(w.distance_km ?? 0) : '-'}
                    </td>
                    <td className={tdNum}>{fmtInt(counts.get(w.id)?.animals ?? 0)}</td>
                    <td className={tdNum}>
                      {s == null ? (
                        <span className="text-ink3">{w.route_id ? '…' : '-'}</span>
                      ) : (
                        <Badge tone={s >= 0.85 ? 'accent' : s >= 0.6 ? 'warn' : 'danger'}>
                          {Math.round(s * 100)}%
                        </Badge>
                      )}
                    </td>
                    <td className={td}>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge w={w} />
                        {w.validation_status === 'flagged' ? (
                          <span className="text-[12px] text-ink3">{reasons(w)}</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {rows.length > limit ? (
          <div className="flex items-center justify-between px-6 py-4 border-t border-line">
            <p className="text-[13px] text-ink2">
              Showing {fmtInt(limit)} of {fmtInt(rows.length)}
            </p>
            <Button kind="pill" size="sm" onClick={() => setLimit((l) => l + 200)}>
              Show More
            </Button>
          </div>
        ) : null}
      </Card>
    </>
  );
}
