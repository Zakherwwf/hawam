import { useMemo } from 'react';
import { PawPrint, Search } from 'lucide-react';
import { getSightings } from '../data/api';
import { useData } from '../data/useData';
import { fmtDateTime, fmtInt } from '../lib/format';
import { href, setParam } from '../lib/router';
import { PROTOCOL_LABEL } from '../lib/stats';
import {
  Badge,
  Card,
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
import type { PageProps } from './types';

const BCS: Record<number, string> = {
  1: 'Very thin',
  2: 'Thin',
  3: 'Ideal',
  4: 'Heavy',
  5: 'Overweight',
};

export function Sightings({ params }: PageProps) {
  const species = params.get('species') ?? 'all';
  const q = params.get('q') ?? '';
  const sightings = useData('sightings', getSightings);
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (sightings.data ?? []).filter(
      (s) =>
        (species === 'all' || s.species === species) &&
        (!n ||
          s.public_code.toLowerCase().includes(n) ||
          (s.observer_name ?? '').toLowerCase().includes(n))
    );
  }, [sightings.data, species, q]);

  return (
    <>
      <PageHeader
        title="Sightings"
        description="One row per group of animals, with its permanent code."
      />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Segmented
          label="Species"
          value={species}
          onChange={(v) => setParam('species', v === 'all' ? undefined : v)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'cat', label: 'Cats' },
            { value: 'dog', label: 'Dogs' },
            { value: 'unknown', label: 'Unsure' },
          ]}
        />
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search
            aria-hidden
            className="w-4 h-4 text-ink3 absolute left-3.5 top-1/2 -translate-y-1/2"
          />
          <label className="sr-only" htmlFor="s-q">
            Search codes or volunteers
          </label>
          <input
            id="s-q"
            type="search"
            autoComplete="off"
            spellCheck={false}
            defaultValue={q}
            onChange={(e) => setParam('q', e.target.value || undefined)}
            placeholder="CAT-000123 or a name…"
            className={`${inputClass} w-full h-10 pl-10 bg-surface`}
          />
        </div>
        <span className="ml-auto text-[13px] text-ink2 tabular" aria-live="polite">
          {sightings.data ? `${fmtInt(rows.length)} of ${fmtInt(sightings.data.length)}` : ''}
        </span>
      </div>
      {sightings.error ? <ErrorNote message={sightings.error} onRetry={sightings.reload} /> : null}
      <Card>
        {!sightings.data ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<PawPrint />}
            title="No sightings match"
            body="Change the filters above to see more."
          />
        ) : (
          <Table label="Sightings">
            <thead>
              <tr>
                <th className={th}>Code</th>
                <th className={th}>Species</th>
                <th className={`${th} text-right`}>Count</th>
                <th className={th}>Seen</th>
                <th className={th}>Volunteer</th>
                <th className={th}>Record</th>
                <th className={th}>Condition</th>
                <th className={th}>Ear tip</th>
                <th className={`${th} text-right`}>From path</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 500).map((s) => (
                <tr key={s.id} className="hover:bg-canvas">
                  <td className={`${td} font-medium tabular whitespace-nowrap`} translate="no">
                    <a
                      href={href('walks', { walk: s.session_id })}
                      className="text-accent hover:underline"
                    >
                      {s.public_code}
                    </a>
                  </td>
                  <td className={td}>
                    <Badge
                      tone={s.species === 'cat' ? 'cat' : s.species === 'dog' ? 'dog' : 'neutral'}
                    >
                      {s.species === 'unknown' ? 'unsure' : s.species}
                    </Badge>
                  </td>
                  <td className={tdNum}>{s.group_size}</td>
                  <td className={`${td} whitespace-nowrap`}>{fmtDateTime(s.observed_at)}</td>
                  <td className={`${td} max-w-[160px] truncate`}>
                    {s.observer_name || 'Anonymous'}
                  </td>
                  <td className={`${td} text-ink2 whitespace-nowrap`}>
                    {PROTOCOL_LABEL[s.protocol] ?? s.protocol}
                  </td>
                  <td className={`${td} text-ink2`}>
                    {s.body_condition_score
                      ? `${s.body_condition_score} ${BCS[s.body_condition_score]}`
                      : '-'}
                  </td>
                  <td className={`${td} text-ink2`}>
                    {s.ear_tip_or_notch && s.ear_tip_or_notch !== 'unknown'
                      ? s.ear_tip_or_notch
                      : '-'}
                  </td>
                  <td className={`${tdNum} text-ink2`}>
                    {s.perpendicular_distance_m != null
                      ? `${Math.round(s.perpendicular_distance_m)} m`
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {rows.length > 500 ? (
          <p className="px-5 py-3 text-[13px] text-ink2 border-t border-line">
            Showing the latest 500. Search or filter to find older ones.
          </p>
        ) : null}
      </Card>
    </>
  );
}
