import { useMemo } from 'react';
import { Footprints } from 'lucide-react';
import { getLeaders, getSightings, getWalks } from '../data/api';
import { useData } from '../data/useData';
import { fmtDateTime, fmtDuration, fmtInt, fmtKm } from '../lib/format';
import { href, setParam } from '../lib/router';
import { overview, perWalk, rangeStart, weekly, type Range } from '../lib/stats';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorNote,
  PageHeader,
  Segmented,
  Skeleton,
  Stat,
  Table,
  td,
  th,
  tdNum,
} from '../ui';
import { WeekChart } from '../components/WeekChart';
import type { PageProps } from './types';

const RANGES: { value: Range; label: string }[] = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '12m', label: '12 months' },
  { value: 'all', label: 'All time' },
];

export function Overview({ me, params }: PageProps) {
  const range = (params.get('range') as Range) || '90d';
  const walks = useData('walks', getWalks);
  const sightings = useData('sightings', getSightings);
  const leaders = useData('leaders', getLeaders);
  const since = rangeStart(range);

  const o = useMemo(
    () => (walks.data && sightings.data ? overview(walks.data, sightings.data, since) : null),
    [walks.data, sightings.data, since?.getTime()]
  );
  const weeks = useMemo(
    () => (walks.data ? weekly(walks.data, range === '30d' ? 6 : range === '90d' ? 13 : 26) : []),
    [walks.data, range]
  );
  const counts = useMemo(
    () => (sightings.data ? perWalk(sightings.data) : new Map()),
    [sightings.data]
  );
  const error = walks.error || sightings.error;

  return (
    <>
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}${me.display_name ? `, ${me.display_name.split(' ')[0]}` : ''}`}
        description="Survey effort and data quality across every volunteer."
        actions={
          <Segmented
            label="Time range"
            value={range}
            onChange={(v) => setParam('range', v)}
            options={RANGES}
          />
        }
      />
      {error ? (
        <ErrorNote message={error} onRetry={() => (walks.reload(), sightings.reload())} />
      ) : null}

      {/* Effort band: the headline figures on the brand gradient */}
      <section
        aria-label="Survey effort"
        className="rounded-card p-6 text-white grid grid-cols-2 md:grid-cols-4 gap-6 mb-5"
        style={{ background: 'linear-gradient(135deg, #144513 0%, #2F7A2B 100%)' }}
      >
        {[
          {
            label: 'Kilometres surveyed',
            value: o ? fmtKm(o.km) : null,
            detail: o ? `${fmtDuration(o.minutes)} of effort` : '',
          },
          {
            label: 'Survey walks',
            value: o ? fmtInt(o.walks) : null,
            detail: o ? `${fmtInt(o.quick)} quick sightings besides` : '',
          },
          {
            label: 'Complete checklists',
            value: o ? fmtInt(o.complete) : null,
            detail: o ? `${fmtInt(o.zero)} with zero animals` : '',
          },
          {
            label: 'Active volunteers',
            value: o ? fmtInt(o.volunteers) : null,
            detail: 'Recorded at least once',
          },
        ].map((k) => (
          <div key={k.label} className="min-w-0">
            <p className="text-[13px] text-white/80">{k.label}</p>
            {k.value == null ? (
              <Skeleton className="h-9 w-24 mt-1 opacity-40" />
            ) : (
              <p className="text-[32px] font-semibold tabular leading-tight mt-1">{k.value}</p>
            )}
            <p className="text-[12px] text-white/70 mt-0.5">{k.detail}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader
            title="Kilometres per week"
            description="Survey walks and point counts, flagged walks excluded. This week in dark green."
          />
          {walks.data ? (
            <WeekChart weeks={weeks} label="Kilometres surveyed per week" />
          ) : (
            <Skeleton className="h-[200px] mx-5 mb-5" />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Animals recorded"
            description="Summed group sizes, all record types."
          />
          <div className="px-5 pb-5 grid grid-cols-2 gap-5">
            <Stat label="Cats" value={o ? fmtInt(o.cats) : '-'} />
            <Stat label="Dogs" value={o ? fmtInt(o.dogs) : '-'} />
            <Stat
              label="Sightings"
              value={o ? fmtInt(o.sightings) : '-'}
              detail="Records, one per group"
            />
            <Stat
              label="Flagged walks"
              value={o ? fmtInt(o.flagged) : '-'}
              detail="Left out of effort"
              tone={o && o.flagged > 0 ? 'warn' : undefined}
            />
          </div>
          {o && o.animals > 0 ? (
            <div className="px-5 pb-5" aria-hidden>
              <div className="flex h-2.5 rounded-full overflow-hidden">
                <div className="bg-cat" style={{ width: `${(o.cats / o.animals) * 100}%` }} />
                <div className="bg-dog" style={{ width: `${(o.dogs / o.animals) * 100}%` }} />
                <div className="bg-fill flex-1" />
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px] mt-5">
        <Card>
          <CardHeader
            title="Latest walks"
            action={
              <a
                href={href('walks')}
                className="text-[14px] font-semibold text-accent hover:underline whitespace-nowrap"
              >
                See All Walks
              </a>
            }
          />
          {!walks.data ? (
            <div className="px-5 pb-5 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : walks.data.length === 0 ? (
            <EmptyState
              icon={<Footprints />}
              title="No walks yet"
              body="Walks appear here as soon as volunteers upload them from the app."
            />
          ) : (
            <Table label="Latest walks">
              <thead>
                <tr>
                  <th className={th}>Started</th>
                  <th className={th}>Volunteer</th>
                  <th className={`${th} text-right`}>Time</th>
                  <th className={`${th} text-right`}>km</th>
                  <th className={`${th} text-right`}>Animals</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {walks.data.slice(0, 7).map((w) => (
                  <tr key={w.id} className="hover:bg-canvas">
                    <td className={`${td} whitespace-nowrap`}>
                      <a
                        href={href('walks', { walk: w.id })}
                        className="font-medium hover:underline"
                      >
                        {fmtDateTime(w.start_time)}
                      </a>
                    </td>
                    <td className={`${td} max-w-[160px] truncate`}>
                      {w.observer?.display_name || 'Anonymous'}
                    </td>
                    <td className={tdNum}>
                      {w.protocol === 'incidental' ? '-' : fmtDuration(w.duration_min)}
                    </td>
                    <td className={tdNum}>
                      {w.protocol === 'incidental' ? '-' : fmtKm(w.distance_km ?? 0)}
                    </td>
                    <td className={tdNum}>{fmtInt(counts.get(w.id)?.animals ?? 0)}</td>
                    <td className={td}>
                      <StatusBadge w={w} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Most effort"
            description="Kilometres surveyed, all time."
            action={
              <a
                href={href('volunteers')}
                className="text-[14px] font-semibold text-accent hover:underline whitespace-nowrap"
              >
                All Volunteers
              </a>
            }
          />
          {!leaders.data ? (
            <div className="px-5 pb-5 space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : (
            <ol className="px-5 pb-4">
              {[...leaders.data]
                .sort((a, b) => b.distance_km - a.distance_km)
                .slice(0, 6)
                .map((l, i) => (
                  <li
                    key={l.user_id}
                    className="flex items-center gap-3 py-2.5 border-t border-line first:border-t-0"
                  >
                    <span className="w-5 text-[13px] font-semibold text-ink3 tabular">{i + 1}</span>
                    <span className="flex-1 min-w-0 truncate text-[14px]">{l.display_name}</span>
                    <span className="text-[14px] tabular text-ink2">{fmtKm(l.distance_km)} km</span>
                  </li>
                ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}

export function StatusBadge({
  w,
}: {
  w: { validation_status: string; complete_session: boolean; protocol: string };
}) {
  if (w.validation_status === 'flagged') return <Badge tone="warn">Flagged</Badge>;
  if (w.protocol === 'incidental') return <Badge>Quick</Badge>;
  return w.complete_session ? <Badge tone="accent">Complete</Badge> : <Badge>Partial</Badge>;
}
