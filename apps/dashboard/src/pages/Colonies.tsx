import { useMemo } from 'react';
import { Droplets, House, Warehouse } from 'lucide-react';
import { getColonies, getColonyVisits, type ColonyRow } from '../data/api';
import { useCore } from '../data/portal';
import { useData } from '../data/useData';
import { fmtAgo, fmtDate, fmtInt } from '../lib/format';
import { href, setParam } from '../lib/router';
import { pretty, SPECIES_LABEL } from '../lib/labels';
import { useDark } from '../lib/theme';
import { MapView, type MapPoint } from '../components/LazyMap';
import {
  Avatar,
  Badge,
  Card,
  Drawer,
  EmptyState,
  ErrorNote,
  Facts,
  Meter,
  PageHeader,
  Segmented,
  Skeleton,
  Table,
  td,
  tdNum,
  th,
} from '../ui';
import type { PageProps } from './types';

export function Colonies({ params }: PageProps) {
  const colonies = useData('colonies', getColonies);
  const dark = useDark();
  const open = params.get('c');
  const kind = params.get('kind') ?? 'all';
  const data = useMemo(
    () => (colonies.data ?? []).filter((c) => kind === 'all' || c.species === kind),
    [colonies.data, kind]
  );
  const known = data.filter((c) => c.estimated_population != null && c.sterilised_count != null);
  const pop = known.reduce((a, c) => a + (c.estimated_population ?? 0), 0);
  const ster = known.reduce((a, c) => a + (c.sterilised_count ?? 0), 0);
  const stale = data.filter(
    (c) => !c.last_visit_at || Date.now() - new Date(c.last_visit_at).getTime() > 30 * 86400000
  ).length;
  const selected = colonies.data?.find((c) => c.id === open) ?? null;
  const points: MapPoint[] = data.map((c) => ({
    id: c.id,
    lon: c.longitude,
    lat: c.latitude,
    kind: 'colony',
    label: c.name || 'Colony',
    href: `#/colonies?c=${c.id}`,
  }));

  return (
    <>
      <PageHeader
        title="Colonies"
        description="Places where groups of animals live or are fed, registered and visited by volunteers. Estimates come from caretakers and volunteers, not from surveys."
      />
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Segmented
          label="Kind"
          value={kind}
          onChange={(v) => setParam('kind', v === 'all' ? undefined : v)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'cat', label: 'Cat colonies' },
            { value: 'dog', label: 'Dog packs' },
            { value: 'mixed', label: 'Mixed' },
          ]}
        />
      </div>
      {colonies.error ? <ErrorNote message={colonies.error} onRetry={colonies.reload} /> : null}
      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <Tile k="Colonies and packs" v={fmtInt(data.length)} />
        <Tile
          k="Sterilised, where counted"
          v={pop ? `${Math.round((ster / pop) * 100)}%` : '-'}
          sub={pop ? `${fmtInt(ster)} of about ${fmtInt(pop)} animals` : 'No counts yet'}
        />
        <Tile k="Not visited in 30 days" v={fmtInt(stale)} sub="Worth a check" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card className="p-2 self-start">
          <MapView points={points} dark={dark} height={460} label="Map of colonies" />
        </Card>
        <Card>
          {!colonies.data ? (
            <Skeleton className="h-[420px] m-6" />
          ) : data.length === 0 ? (
            <EmptyState
              icon={<Warehouse />}
              title="No colonies yet"
              body="Volunteers register colonies from the Map tab in the app. They appear here once uploaded."
            />
          ) : (
            <Table label="Colonies">
              <thead>
                <tr>
                  <th className={th}>Name</th>
                  <th className={`${th} text-end`}>Animals</th>
                  <th className={th}>Sterilised</th>
                  <th className={th}>Last visit</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className="hover:bg-canvas">
                    <td className={`${td} max-w-[240px]`}>
                      <button
                        type="button"
                        onClick={() => setParam('c', c.id)}
                        className="text-start"
                      >
                        <span className="block font-semibold truncate hover:underline">
                          {c.name || 'Unnamed'}
                        </span>
                        <span className="flex items-center gap-2 mt-0.5">
                          <Badge
                            tone={
                              c.species === 'dog' ? 'dog' : c.species === 'cat' ? 'cat' : 'neutral'
                            }
                          >
                            {SPECIES_LABEL[c.species]}
                          </Badge>
                          <span className="text-[12px] text-ink3 truncate">
                            {c.area || 'No area'}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className={tdNum}>{c.estimated_population ?? '-'}</td>
                    <td className={`${td} min-w-[140px]`}>
                      {c.sterilised_count != null && c.estimated_population ? (
                        <div>
                          <p className="text-[12px] tabular mb-1">
                            {c.sterilised_count} of {c.estimated_population}
                          </p>
                          <Meter
                            label={`Sterilised share at ${c.name}`}
                            value={c.sterilised_count / c.estimated_population}
                            tone={
                              c.sterilised_count / c.estimated_population >= 0.7 ? 'accent' : 'warn'
                            }
                          />
                        </div>
                      ) : (
                        <span className="text-ink3">Not counted</span>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap text-ink2`}>
                      {fmtAgo(c.last_visit_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
      <Drawer
        open={!!selected}
        onClose={() => setParam('c', undefined)}
        title={selected?.name || 'Colony'}
      >
        {selected ? <ColonyDetail c={selected} /> : null}
      </Drawer>
    </>
  );
}

function ColonyDetail({ c }: { c: ColonyRow }) {
  const visits = useData(`colony:${c.id}`, () => getColonyVisits(c.id));
  const core = useCore();
  const dark = useDark();
  const share =
    c.sterilised_count != null && c.estimated_population
      ? c.sterilised_count / c.estimated_population
      : null;
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-2">
        <MapView
          points={[
            {
              id: c.id,
              lon: c.longitude,
              lat: c.latitude,
              kind: 'colony',
              label: c.name || 'Colony',
            },
          ]}
          dark={dark}
          height={220}
          label="Colony location"
        />
      </Card>
      <Card className="p-5">
        <Facts
          items={[
            ['Kind', SPECIES_LABEL[c.species]],
            ['Area', c.area || 'Not set'],
            [
              'Animals (estimate)',
              c.estimated_population != null ? fmtInt(c.estimated_population) : 'Not counted',
            ],
            ['Sterilised', c.sterilised_count != null ? fmtInt(c.sterilised_count) : 'Not counted'],
            [
              'Facilities',
              <span className="inline-flex gap-3">
                <span
                  className={`inline-flex items-center gap-1 ${c.has_water ? '' : 'text-ink3 line-through'}`}
                >
                  <Droplets aria-hidden className="w-4 h-4" /> Water
                </span>
                <span
                  className={`inline-flex items-center gap-1 ${c.has_shelter ? '' : 'text-ink3 line-through'}`}
                >
                  <House aria-hidden className="w-4 h-4" /> Shelter
                </span>
              </span>,
            ],
            ['Registered', fmtDate(c.created_at)],
            ['Caretaker', c.caretaker_name || 'Not recorded'],
            ['Feeding', c.feeding_schedule || 'Not recorded'],
          ]}
        />
        {share != null ? (
          <div className="mt-5">
            <div className="flex justify-between text-[13px] mb-1.5">
              <span className="font-semibold">Sterilised share</span>
              <span className="tabular">{Math.round(share * 100)}%</span>
            </div>
            <Meter label="Sterilised share" value={share} tone={share >= 0.7 ? 'accent' : 'warn'} />
            <p className="text-[12px] text-ink3 mt-1.5">
              About 70% sterilised is the usual threshold for a colony to stop growing.
            </p>
          </div>
        ) : null}
        {c.notes ? <p className="text-[14px] mt-4 rounded-tile bg-canvas p-3">{c.notes}</p> : null}
      </Card>
      <Card className="p-5">
        <h3 className="text-[15px] font-semibold mb-2">
          Visits ({fmtInt(visits.data?.length ?? c.visit_count)})
        </h3>
        {!visits.data ? (
          <Skeleton className="h-24" />
        ) : visits.data.length === 0 ? (
          <p className="text-[14px] text-ink2">No visits logged yet.</p>
        ) : (
          <ol className="flex flex-col">
            {visits.data.slice(0, 30).map((v) => (
              <li
                key={v.id}
                className="flex items-start gap-3 py-2.5 border-t border-line first:border-t-0"
              >
                {v.user_id ? (
                  <a href={href(`people/${v.user_id}`)} aria-label={core.nameOf(v.user_id)}>
                    <Avatar id={v.user_id} name={core.nameOf(v.user_id)} size={30} />
                  </a>
                ) : null}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px]">
                    <span className="font-medium">
                      {v.user_id ? core.nameOf(v.user_id) : 'Someone'}
                    </span>
                    <span className="text-ink2"> visited {fmtAgo(v.visited_at)}</span>
                  </p>
                  {v.tags.length ? (
                    <p className="text-[12px] text-ink2">
                      {v.tags.map((t) => pretty(t)).join(', ')}
                    </p>
                  ) : null}
                  {v.notes ? <p className="text-[13px] mt-0.5">{v.notes}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

function Tile({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="bg-surface rounded-card shadow-card p-5">
      <p className="text-[13px] text-ink2">{k}</p>
      <p className="text-[28px] font-semibold leading-tight mt-1">{v}</p>
      {sub ? <p className="text-[12px] text-ink3 mt-1">{sub}</p> : null}
    </div>
  );
}
