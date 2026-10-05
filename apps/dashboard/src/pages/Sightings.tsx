import { useMemo, useState } from 'react';
import { Download, PawPrint, Search, ShieldAlert } from 'lucide-react';
import type { Sighting } from '../data/api';
import { useAnimals } from '../data/portal';
import { download, toCsv } from '../lib/csv';
import { preciseRows } from '../lib/exports';
import { fmtDateTime, fmtDec, fmtInt } from '../lib/format';
import { href, setParam } from '../lib/router';
import { histogram } from '../lib/series';
import { AGE_LABEL, BCS_LABEL, SEX_LABEL, TRISTATE_LABEL } from '../lib/labels';
import { Columns, SPECIES_COLOR, SplitBar } from '../components/charts';
import { FilterBar } from '../components/FilterBar';
import { SpeciesBadge, useSlice } from '../components/widgets';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
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

type Key = 'seen' | 'group' | 'bcs' | 'dist' | 'who';

export function Sightings({ params }: PageProps) {
  const { core, f, sightings } = useSlice(params, '90d');
  const { links, individuals } = useAnimals();
  const q = params.get('q') ?? '';
  const welfare = params.get('welfare') === '1';
  const [sort, setSort] = useState<Sort<Key>>({ key: 'seen', dir: 'desc' });
  const [limit, setLimit] = useState(100);
  const linkOf = useMemo(() => {
    const m = new Map<string, { individual: string; status: string }>();
    for (const l of links.data ?? [])
      if (l.status !== 'rejected')
        m.set(l.observation_id, { individual: l.individual_id, status: l.status });
    return m;
  }, [links.data]);
  const animalName = (id: string) => {
    const a = individuals.data?.find((i) => i.id === id);
    return a?.nickname || (a ? `Unnamed ${a.species}` : 'Known animal');
  };

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    const r = sightings.filter(
      (s) =>
        (!welfare || s.is_welfare_alert) &&
        (!n ||
          s.public_code.toLowerCase().includes(n) ||
          (s.observer_name ?? '').toLowerCase().includes(n) ||
          (s.notes ?? '').toLowerCase().includes(n))
    );
    return sortBy(r, sort, (s: Sighting, k) =>
      k === 'seen'
        ? s.observed_at
        : k === 'group'
          ? s.group_size
          : k === 'bcs'
            ? s.body_condition_score
            : k === 'dist'
              ? s.perpendicular_distance_m
              : (s.observer_name ?? '')
    );
  }, [sightings, q, sort, welfare]);

  const transect = rows.filter(
    (s) => s.protocol === 'transect' && s.perpendicular_distance_m != null
  );
  const distBins = useMemo(
    () =>
      histogram(
        transect.map((s) => s.perpendicular_distance_m!),
        2.5,
        Math.max(25, ...transect.map((s) => s.perpendicular_distance_m!))
      ),
    [transect]
  );
  const bcs = [1, 2, 3, 4, 5].map((b) => ({
    label: String(b),
    value: rows.filter((s) => s.body_condition_score === b).length,
  }));
  const sp = (x: string) =>
    rows.filter((s) => s.species === x).reduce((a, s) => a + (s.group_size || 1), 0);
  const alerts = sightings.filter((s) => s.is_welfare_alert).length;

  return (
    <>
      <PageHeader
        title="Sightings"
        description="Every animal or group recorded. Open a record for its photos, attributes and exact geometry."
        actions={
          <Button
            kind="pill"
            size="sm"
            icon={<Download />}
            disabled={!rows.length}
            onClick={() =>
              download(
                `hawem_sightings_filtered_${new Date().toISOString().slice(0, 10)}.csv`,
                toCsv(preciseRows(rows))
              )
            }
          >
            Download These Sightings
          </Button>
        }
      />
      <FilterBar f={f} summary={core.ready ? `${fmtInt(rows.length)} records` : null} />
      {core.error ? <ErrorNote message={core.error} onRetry={core.reload} /> : null}

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card>
          <CardHeader title="Species" description="Animals counted in these records." />
          <div className="px-6 pb-6">
            <SplitBar
              label="Animals by species"
              parts={['cat', 'dog', 'unknown'].map((x) => ({
                label: x,
                value: sp(x),
                color: SPECIES_COLOR[x],
              }))}
            />
            <dl className="grid grid-cols-3 gap-3 mt-4">
              {['cat', 'dog', 'unknown'].map((x) => (
                <div key={x}>
                  <dt className="text-[12px] text-ink3 flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="w-2 h-2 rounded-full"
                      style={{ background: SPECIES_COLOR[x] }}
                    />
                    {x === 'cat' ? 'Cats' : x === 'dog' ? 'Dogs' : 'Unknown'}
                  </dt>
                  <dd className="text-[22px] font-semibold">{fmtInt(sp(x))}</dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              onClick={() => setParam('welfare', welfare ? undefined : '1')}
              aria-pressed={welfare}
              className={`mt-4 w-full flex items-center gap-2 h-10 px-3 rounded-full text-[13px] font-semibold ${welfare ? 'bg-pill text-on-pill' : 'bg-canvas text-ink'}`}
            >
              <ShieldAlert aria-hidden className="w-4 h-4" />
              <span className="flex-1 text-start">
                {welfare ? 'Showing welfare alerts only' : 'Show welfare alerts only'}
              </span>
              <span className="tabular">{fmtInt(alerts)}</span>
            </button>
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Detection distances"
            description="Perpendicular distance from the path, survey walks only. The shape of a detection function."
          />
          <div className="px-6 pb-6">
            {transect.length ? (
              <Columns
                bins={distBins.map((b) => ({ label: `${b.from}`, value: b.count }))}
                label="Histogram of perpendicular distances"
                formatBin={(b) => `${b.label} to ${Number(b.label) + 2.5} m: ${b.value}`}
                height={170}
              />
            ) : (
              <p className="text-[14px] text-ink2">No distances in these records.</p>
            )}
            <p className="text-[12px] text-ink3 mt-2">
              {fmtInt(transect.length)} detections with a distance, metres on the axis.
            </p>
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Body condition"
            description="ICAM score where it was assessed: 1 very thin, 3 ideal, 5 obese."
          />
          <div className="px-6 pb-6">
            <Columns
              bins={bcs}
              label="Body condition score distribution"
              formatBin={(b) => `${b.label}, ${BCS_LABEL[Number(b.label)]}: ${b.value}`}
              height={170}
              color="var(--series-1)"
            />
            <p className="text-[12px] text-ink3 mt-2">
              {fmtInt(bcs.reduce((a, b) => a + b.value, 0))} of {fmtInt(rows.length)} records
              assessed.
            </p>
          </div>
        </Card>
      </div>

      <div className="relative max-w-[420px] mb-4">
        <Search
          aria-hidden
          className="w-4 h-4 text-ink3 absolute start-4 top-1/2 -translate-y-1/2"
        />
        <label className="sr-only" htmlFor="s-q">
          Search sightings
        </label>
        <input
          id="s-q"
          type="search"
          name="sighting-search"
          autoComplete="off"
          spellCheck={false}
          defaultValue={q}
          onChange={(e) => setParam('q', e.target.value || undefined)}
          placeholder="Search a code like CAT-000123, a name or a note…"
          className={`${inputClass} w-full h-11 ps-11 rounded-full bg-surface border-0 shadow-pill`}
        />
      </div>
      <Card>
        {!core.ready ? (
          <Skeleton className="h-[420px] m-6" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<PawPrint />}
            title="No sightings match"
            body="Widen the date range or clear the filters."
          />
        ) : (
          <Table label="Sightings">
            <thead>
              <tr>
                <th className={th}>Record</th>
                <SortTh k="seen" sort={sort} onSort={setSort}>
                  Seen
                </SortTh>
                <SortTh k="group" sort={sort} onSort={setSort} num>
                  Group
                </SortTh>
                <th className={th}>Animal</th>
                <SortTh k="bcs" sort={sort} onSort={setSort} num>
                  Condition
                </SortTh>
                <SortTh k="dist" sort={sort} onSort={setSort} num>
                  From path
                </SortTh>
                <SortTh k="who" sort={sort} onSort={setSort}>
                  Volunteer
                </SortTh>
                <th className={th}>Known animal</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((s) => {
                const l = linkOf.get(s.id);
                return (
                  <tr key={s.id} className="hover:bg-canvas">
                    <td className={td}>
                      <a
                        href={href(`sightings/${s.id}`)}
                        className="flex items-center gap-2 font-semibold tabular hover:underline"
                        translate="no"
                      >
                        <SpeciesBadge s={s.species} />
                        {s.public_code}
                        {s.is_welfare_alert ? (
                          <ShieldAlert aria-label="Welfare alert" className="w-4 h-4 text-danger" />
                        ) : null}
                      </a>
                    </td>
                    <td className={`${td} whitespace-nowrap tabular`}>
                      {fmtDateTime(s.observed_at)}
                    </td>
                    <td className={tdNum}>{s.group_size}</td>
                    <td className={`${td} text-ink2 text-[13px] whitespace-nowrap`}>
                      {[SEX_LABEL[s.sex ?? 'unknown'], AGE_LABEL[s.age_class ?? 'unknown']]
                        .filter((x) => x !== 'Not known')
                        .join(', ') || 'Not known'}
                      {s.ear_tip_or_notch === 'yes'
                        ? `, ear tip ${TRISTATE_LABEL.yes.toLowerCase()}`
                        : ''}
                    </td>
                    <td className={tdNum}>{s.body_condition_score ?? '-'}</td>
                    <td className={tdNum}>
                      {s.perpendicular_distance_m != null
                        ? `${fmtDec(s.perpendicular_distance_m, 1)} m`
                        : '-'}
                    </td>
                    <td className={`${td} max-w-[200px]`}>
                      <a
                        href={href(`people/${s.observer_id}`)}
                        className="flex items-center gap-2 min-w-0 hover:underline"
                      >
                        <Avatar id={s.observer_id} name={s.observer_name} size={26} />
                        <span className="truncate">{s.observer_name || 'Anonymous'}</span>
                      </a>
                    </td>
                    <td className={td}>
                      {l ? (
                        <a
                          href={href(`animals/${l.individual}`)}
                          className="inline-flex items-center gap-2 hover:underline"
                        >
                          {animalName(l.individual)}
                          {l.status === 'proposed' ? <Badge tone="warn">To review</Badge> : null}
                        </a>
                      ) : (
                        <span className="text-ink3">-</span>
                      )}
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
            <Button kind="pill" size="sm" onClick={() => setLimit((x) => x + 200)}>
              Show More
            </Button>
          </div>
        ) : null}
      </Card>
    </>
  );
}
