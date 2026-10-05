import { useMemo } from 'react';
import { Search, Users } from 'lucide-react';
import { personName, type Role } from '../data/api';
import { useCore } from '../data/portal';
import { fmtAgo, fmtDate, fmtInt, fmtKm } from '../lib/format';
import { href, setParam } from '../lib/router';
import { ROLE_LABEL } from '../lib/labels';
import {
  Avatar,
  Badge,
  Card,
  cx,
  EmptyState,
  ErrorNote,
  inputClass,
  PageHeader,
  Segmented,
  Skeleton,
  Table,
  td,
  tdNum,
  th,
} from '../ui';
import type { PageProps } from './types';

export interface PersonStats {
  walks: number;
  km: number;
  minutes: number;
  complete: number;
  zero: number;
  sightings: number;
  animals: number;
  flagged: number;
  last: string | null;
  first: string | null;
  weeks: number;
  recentKm: number[];
}

/** Effort per person from the loaded walks and sightings (flagged walks left out of effort). */
export function usePeopleStats() {
  const core = useCore();
  return useMemo(() => {
    const m = new Map<string, PersonStats>();
    const get = (id: string) => {
      let v = m.get(id);
      if (!v)
        m.set(
          id,
          (v = {
            walks: 0,
            km: 0,
            minutes: 0,
            complete: 0,
            zero: 0,
            sightings: 0,
            animals: 0,
            flagged: 0,
            last: null,
            first: null,
            weeks: 0,
            recentKm: Array(8).fill(0),
          })
        );
      return v;
    };
    const withAnimals = new Set((core.sightings.data ?? []).map((s) => s.session_id));
    const weeks = new Map<string, Set<number>>();
    const now = Date.now();
    for (const w of core.walks.data ?? []) {
      const v = get(w.observer_id);
      if (!v.last || w.start_time > v.last) v.last = w.start_time;
      if (!v.first || w.start_time < v.first) v.first = w.start_time;
      if (w.validation_status === 'flagged') {
        v.flagged += 1;
        continue;
      }
      const wk = Math.floor(new Date(w.start_time).getTime() / (7 * 86400000));
      if (!weeks.has(w.observer_id)) weeks.set(w.observer_id, new Set());
      weeks.get(w.observer_id)!.add(wk);
      if (w.protocol === 'incidental') continue;
      v.walks += 1;
      v.km += w.distance_km ?? 0;
      v.minutes += w.duration_min ?? 0;
      if (w.complete_session) {
        v.complete += 1;
        if (!withAnimals.has(w.id)) v.zero += 1;
      }
      const ago = Math.floor((now - new Date(w.start_time).getTime()) / (7 * 86400000));
      if (ago >= 0 && ago < 8) v.recentKm[7 - ago] += w.distance_km ?? 0;
    }
    for (const s of core.sightings.data ?? []) {
      const v = get(s.observer_id);
      v.sightings += 1;
      v.animals += s.group_size || 1;
    }
    for (const [id, set] of weeks) get(id).weeks = set.size;
    return m;
  }, [core.walks.data, core.sightings.data]);
}

type SortKey = 'km' | 'walks' | 'recent' | 'name';

export function People({ params }: PageProps) {
  const core = useCore();
  const stats = usePeopleStats();
  const q = params.get('q') ?? '';
  const role = (params.get('role') as Role | 'all') || 'all';
  const sort = (params.get('sort') as SortKey) || 'km';
  const layout = params.get('layout') === 'table' ? 'table' : 'cards';

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = (core.users.data ?? []).filter(
      (u) =>
        (role === 'all' || u.role === role) &&
        (!n || personName(u).toLowerCase().includes(n) || (u.email ?? '').toLowerCase().includes(n))
    );
    const s = (id: string) => stats.get(id);
    return list.sort((a, b) =>
      sort === 'name'
        ? personName(a).localeCompare(personName(b))
        : sort === 'walks'
          ? (s(b.id)?.walks ?? 0) - (s(a.id)?.walks ?? 0)
          : sort === 'recent'
            ? (s(b.id)?.last ?? '').localeCompare(s(a.id)?.last ?? '')
            : (s(b.id)?.km ?? 0) - (s(a.id)?.km ?? 0)
    );
  }, [core.users.data, stats, q, role, sort]);

  const active30 = (core.users.data ?? []).filter((u) => {
    const l = stats.get(u.id)?.last;
    return l && Date.now() - new Date(l).getTime() < 30 * 86400000;
  }).length;
  const roles: (Role | 'all')[] = ['all', 'volunteer', 'trained_surveyor', 'researcher', 'admin'];

  return (
    <>
      <PageHeader
        title="People"
        description={
          core.users.data
            ? `${fmtInt(core.users.data.length)} accounts, ${fmtInt(active30)} active in the last 30 days. Ranked by effort, never by animal counts.`
            : 'Everyone using the app and the portal.'
        }
      />
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative w-full max-w-[320px]">
          <Search
            aria-hidden
            className="w-4 h-4 text-ink3 absolute start-4 top-1/2 -translate-y-1/2"
          />
          <label className="sr-only" htmlFor="p-q">
            Search people
          </label>
          <input
            id="p-q"
            type="search"
            name="people-search"
            autoComplete="off"
            defaultValue={q}
            onChange={(e) => setParam('q', e.target.value || undefined)}
            placeholder="Search by name or email…"
            className={`${inputClass} w-full h-10 ps-11 rounded-full bg-surface border-0 shadow-pill`}
          />
        </div>
        <Segmented
          label="Role"
          value={role}
          onChange={(v) => setParam('role', v === 'all' ? undefined : v)}
          options={roles.map((r) => ({
            value: r,
            label: r === 'all' ? 'Everyone' : ROLE_LABEL[r],
          }))}
        />
        <Segmented
          label="Sort"
          value={sort}
          onChange={(v) => setParam('sort', v === 'km' ? undefined : v)}
          options={[
            { value: 'km', label: 'Most km' },
            { value: 'walks', label: 'Most walks' },
            { value: 'recent', label: 'Recent' },
            { value: 'name', label: 'Name' },
          ]}
        />
        <div className="ms-auto">
          <Segmented
            label="Layout"
            value={layout}
            onChange={(v) => setParam('layout', v === 'cards' ? undefined : v)}
            options={[
              { value: 'cards', label: 'Cards' },
              { value: 'table', label: 'Table' },
            ]}
          />
        </div>
      </div>
      {core.users.error ? (
        <ErrorNote message={core.users.error} onRetry={core.users.reload} />
      ) : null}
      {!core.users.data ? (
        <Skeleton className="h-[420px]" />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Users />} title="Nobody matches" body="Try another name or role." />
        </Card>
      ) : layout === 'cards' ? (
        <ul className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {rows.map((u) => {
            const s = stats.get(u.id);
            const max = Math.max(0.01, ...(s?.recentKm ?? [0]));
            return (
              <li key={u.id}>
                <a
                  href={href(`people/${u.id}`)}
                  className="group flex flex-col items-center text-center bg-surface rounded-card shadow-card px-5 pt-6 pb-5 hover:-translate-y-0.5 transition-transform duration-200 h-full"
                >
                  <Avatar id={u.id} name={personName(u)} size={64} />
                  <h2 className="text-[17px] font-semibold mt-3 truncate max-w-full">
                    {personName(u)}
                  </h2>
                  <p className="text-[13px] text-ink2">{ROLE_LABEL[u.role]}</p>
                  {u.email ? (
                    <p className="text-[12px] text-ink3 truncate max-w-full" translate="no">
                      {u.email}
                    </p>
                  ) : null}
                  <div className="flex items-end gap-1 h-8 mt-4" aria-hidden>
                    {(s?.recentKm ?? Array(8).fill(0)).map((v, i) => (
                      <span
                        key={i}
                        className={cx(
                          'w-2.5 rounded-t-[3px]',
                          i === 7 ? 'bg-accent dark:bg-lime' : 'bg-[var(--heat-1)]'
                        )}
                        style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-ink3 mt-1">km per week, last 8 weeks</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    <span className="inline-flex items-center h-8 px-3 rounded-full bg-canvas text-[12px] font-semibold tabular">
                      {fmtKm(s?.km ?? 0)} km
                    </span>
                    <span className="inline-flex items-center h-8 px-3 rounded-full bg-canvas text-[12px] font-semibold tabular">
                      {fmtInt(s?.walks ?? 0)} walks
                    </span>
                    <span className="inline-flex items-center h-8 px-3 rounded-full bg-canvas text-[12px] text-ink2 tabular">
                      {fmtInt(s?.complete ?? 0)} complete
                    </span>
                  </div>
                  <p className="text-[12px] text-ink3 mt-3">
                    {s?.last
                      ? `Last surveyed ${fmtAgo(s.last)}`
                      : `Joined ${fmtDate(u.created_at)}, no surveys yet`}
                  </p>
                  {s?.flagged ? (
                    <span className="mt-2">
                      <Badge tone="warn">{fmtInt(s.flagged)} flagged</Badge>
                    </span>
                  ) : null}
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <Table label="People">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Email</th>
                <th className={th}>Role</th>
                <th className={`${th} text-end`}>km</th>
                <th className={`${th} text-end`}>Walks</th>
                <th className={`${th} text-end`}>Complete</th>
                <th className={`${th} text-end`}>Zero-animal</th>
                <th className={`${th} text-end`}>Sightings</th>
                <th className={`${th} text-end`}>Flagged</th>
                <th className={th}>Last surveyed</th>
                <th className={th}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const s = stats.get(u.id);
                return (
                  <tr key={u.id} className="hover:bg-canvas">
                    <td className={td}>
                      <a
                        href={href(`people/${u.id}`)}
                        className="flex items-center gap-2.5 font-medium hover:underline"
                      >
                        <Avatar id={u.id} name={personName(u)} size={30} />
                        {personName(u)}
                      </a>
                    </td>
                    <td className={`${td} text-ink2 max-w-[240px] truncate`} translate="no">
                      {u.email ?? '-'}
                    </td>
                    <td className={`${td} text-ink2`}>{ROLE_LABEL[u.role]}</td>
                    <td className={tdNum}>{fmtKm(s?.km ?? 0)}</td>
                    <td className={tdNum}>{fmtInt(s?.walks ?? 0)}</td>
                    <td className={tdNum}>{fmtInt(s?.complete ?? 0)}</td>
                    <td className={tdNum}>{fmtInt(s?.zero ?? 0)}</td>
                    <td className={tdNum}>{fmtInt(s?.sightings ?? 0)}</td>
                    <td className={tdNum}>
                      {s?.flagged ? <Badge tone="warn">{fmtInt(s.flagged)}</Badge> : '0'}
                    </td>
                    <td className={`${td} text-ink2 whitespace-nowrap`}>{fmtAgo(s?.last)}</td>
                    <td className={`${td} text-ink2 whitespace-nowrap`}>{fmtDate(u.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
