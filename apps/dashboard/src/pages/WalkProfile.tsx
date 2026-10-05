import { useMemo } from 'react';
import { CircleAlert, CircleCheck, CircleMinus, CircleX, Footprints, PawPrint } from 'lucide-react';
import { getTrack, getTrackPoints } from '../data/api';
import { useCore } from '../data/portal';
import { useData } from '../data/useData';
import {
  compliance,
  compassName,
  parseTrack,
  previousVisitOf,
  type CheckState,
} from '../lib/compliance';
import { fmtDateTime, fmtDay, fmtDec, fmtDuration, fmtInt, fmtKm, fmtTime } from '../lib/format';
import { href } from '../lib/router';
import { PROTOCOL_LABEL, REASON_LABEL, TIME_OF_DAY_LABEL, WEATHER_LABEL } from '../lib/stats';
import { BCS_LABEL, DIRECTION_LABEL, pretty } from '../lib/labels';
import { useDark } from '../lib/theme';
import { MapView, type MapLine, type MapPoint } from '../components/LazyMap';
import { ChartFrame, Legend, TimeChart } from '../components/charts';
import { PersonChip, SpeciesBadge, StatusBadge } from '../components/widgets';
import {
  Badge,
  Card,
  CardHeader,
  cx,
  EmptyState,
  Facts,
  LinkButton,
  Notice,
  PageHeader,
  Skeleton,
  Table,
  td,
  tdNum,
  th,
} from '../ui';
import type { PageProps } from './types';

const REASON_HELP: Record<string, string> = {
  mock_location: 'The phone reported a simulated (mock) location for some fixes.',
  vehicle_speed: 'Some stretches were faster than 15 km/h, the walking limit.',
  teleport: 'The GPS jumped an implausible distance between two fixes.',
  average_speed: 'The average speed over the transect was too fast for a walking survey.',
  implausible_density: 'More animals per km than is plausible for one observer.',
  duplicate_upload: 'The same walk was uploaded twice; this copy is left out.',
};

export const CHECK_ICON: Record<CheckState, typeof CircleCheck> = {
  pass: CircleCheck,
  warn: CircleAlert,
  fail: CircleX,
  na: CircleMinus,
};
export const CHECK_CLS: Record<CheckState, string> = {
  pass: 'text-accent dark:text-lime',
  warn: 'text-warm-ink',
  fail: 'text-danger',
  na: 'text-ink3',
};

export function WalkProfile({ id }: PageProps) {
  const core = useCore();
  const dark = useDark();
  const walk = core.walks.data?.find((w) => w.id === id) ?? null;
  const track = useData(`track:${id}`, () => getTrack(id!));
  const points = useData(`points:${id}`, () => getTrackPoints(id!));
  const coords = useMemo(() => parseTrack(track.data?.[0]?.track_geojson), [track.data]);
  const mine = useMemo(
    () =>
      (core.sightings.data ?? [])
        .filter((s) => s.session_id === id)
        .sort((a, b) => a.observed_at.localeCompare(b.observed_at)),
    [core.sightings.data, id]
  );
  const route = walk?.route_id
    ? (core.routes.data ?? []).find((r) => r.id === walk.route_id)
    : undefined;
  const comp = useMemo(
    () =>
      walk && route && core.walks.data
        ? compliance(walk, coords, route, previousVisitOf(walk, core.walks.data))
        : null,
    [walk, route, coords, core.walks.data]
  );
  const sameVolunteer = useMemo(
    () =>
      walk
        ? (core.walks.data ?? [])
            .filter((w) => w.observer_id === walk.observer_id)
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
        : [],
    [core.walks.data, walk]
  );

  const pts = points.data ?? null;
  const accepted = pts?.filter((p) => !p.rejected_reason) ?? [];
  const rejected = pts?.filter((p) => p.rejected_reason) ?? [];
  const speedSeries = useMemo(() => {
    if (!pts?.length) return null;
    const step = Math.max(1, Math.ceil(pts.length / 180));
    const s = pts.filter((_, i) => i % step === 0);
    return {
      speed: s.map((p) => ({
        t: new Date(p.recorded_at),
        v: p.speed_mps == null ? null : p.speed_mps * 3.6,
      })),
      acc: s.map((p) => ({ t: new Date(p.recorded_at), v: p.accuracy_m })),
    };
  }, [pts]);

  if (!core.ready) return <Skeleton className="h-[640px]" />;
  if (!walk)
    return (
      <Card>
        <EmptyState
          icon={<Footprints />}
          title="Walk not found"
          body="It may have been deleted, or the link is wrong."
          action={<LinkButton href={href('walks')}>Back to Walks</LinkButton>}
        />
      </Card>
    );

  const animals = mine.reduce((a, s) => a + (s.group_size || 1), 0);
  const lines: MapLine[] = [];
  if (route?.geometry)
    lines.push({
      id: 'route',
      coords: route.geometry.coordinates,
      kind: 'route-muted',
      label: `Route: ${route.name}`,
    });
  if (coords.length)
    lines.push({ id: walk.id, coords, kind: 'track', arrows: true, label: 'Walked track' });
  for (const s of mine)
    if (s.observer_latitude != null && s.observer_longitude != null)
      lines.push({
        id: `b${s.id}`,
        coords: [
          [s.observer_longitude, s.observer_latitude],
          [s.longitude, s.latitude],
        ],
        kind: 'bearing',
      });
  const mapPoints: MapPoint[] = [
    ...rejected.map((p, i) => ({
      id: `rej${i}`,
      lon: p.longitude,
      lat: p.latitude,
      kind: 'rejected' as const,
      label: `Rejected fix: ${p.rejected_reason}, ${fmtDec(p.accuracy_m ?? 0, 0)} m accuracy`,
    })),
    ...(coords.length
      ? [
          {
            id: 'start',
            lon: coords[0][0],
            lat: coords[0][1],
            kind: 'start' as const,
            label: `Start ${fmtTime(walk.start_time)}`,
          },
        ]
      : []),
    ...(coords.length > 1
      ? [
          {
            id: 'end',
            lon: coords[coords.length - 1][0],
            lat: coords[coords.length - 1][1],
            kind: 'end' as const,
            label: walk.end_time ? `End ${fmtTime(walk.end_time)}` : 'End',
          },
        ]
      : []),
    ...mine.map((s) => ({
      id: s.id,
      lon: s.longitude,
      lat: s.latitude,
      kind: s.species,
      label: `${s.public_code}: ${s.group_size}`,
      href: `#/sightings/${s.id}`,
    })),
  ];
  const idx = sameVolunteer.findIndex((w) => w.id === walk.id);
  const prevW = sameVolunteer[idx - 1];
  const nextW = sameVolunteer[idx + 1];
  const pace =
    walk.protocol === 'transect' && walk.duration_min && walk.distance_km
      ? walk.distance_km / (walk.duration_min / 60)
      : null;

  return (
    <>
      <PageHeader
        back={{ href: href('walks'), label: 'Walks' }}
        eyebrow={
          <div className="flex flex-wrap gap-2">
            <StatusBadge w={walk} />
            <Badge>{PROTOCOL_LABEL[walk.protocol]}</Badge>
            {route ? (
              <Badge tone="warn">
                {route.name}
                {walk.route_version ? `, v${walk.route_version}` : ''}
              </Badge>
            ) : null}
          </div>
        }
        title={`${fmtDay(walk.start_time)}, ${fmtTime(walk.start_time)}`}
        description={`${core.nameOf(walk.observer_id)} ${walk.protocol === 'transect' ? `walked ${fmtKm(walk.distance_km ?? 0)} km in ${fmtDuration(walk.duration_min)}` : walk.protocol === 'stationary_point' ? `counted from one point for ${fmtDuration(walk.duration_min)}` : 'logged a quick sighting'} and recorded ${fmtInt(animals)} ${animals === 1 ? 'animal' : 'animals'}.`}
        actions={
          <>
            {prevW ? (
              <LinkButton href={href(`walks/${prevW.id}`)} kind="pill">
                Previous Walk
              </LinkButton>
            ) : null}
            {nextW ? (
              <LinkButton href={href(`walks/${nextW.id}`)} kind="pill">
                Next Walk
              </LinkButton>
            ) : null}
          </>
        }
      />

      {walk.validation_status === 'flagged' ? (
        <Notice tone="warn">
          <p className="font-semibold">
            Flagged by the server checks and left out of effort totals and leaderboards
          </p>
          <ul className="mt-1 list-disc ps-5">
            {walk.validation_reasons.map((r) => (
              <li key={r}>
                <span className="font-medium">{REASON_LABEL[r] ?? r}:</span>{' '}
                {REASON_HELP[r] ?? 'See the validation rules.'}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px] items-start">
        <Card className="p-2">
          {track.data && !coords.length && !mine.length ? (
            <EmptyState
              icon={<Footprints />}
              title="No track for this session"
              body={
                walk.protocol === 'incidental'
                  ? 'Quick sightings record a point, not a walk.'
                  : 'The phone did not upload a GPS track.'
              }
            />
          ) : (
            <MapView
              points={mapPoints}
              lines={lines}
              dark={dark}
              height={520}
              label="This walk's track, direction, sightings and bearing lines"
            />
          )}
          <div className="flex flex-wrap gap-4 px-4 py-3 text-[12px] text-ink2">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="w-4 border-t-[3px] border-[#2F7A2B]" /> Walked track,
              arrows show direction
            </span>
            {route ? (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="w-4 border-t-[3px] border-dashed border-[#9AA0A8]" />{' '}
                Route as drawn
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="w-4 border-t border-dashed border-ink" /> Observer to
              animal (bearing and distance)
            </span>
            {rejected.length ? (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="w-2 h-2 rounded-full bg-danger" /> Rejected GPS fix,
                kept for review
              </span>
            ) : null}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <PersonChip
              id={walk.observer_id}
              name={core.nameOf(walk.observer_id)}
              sub="Open profile"
              size={44}
            />
            <div className="mt-5">
              <Facts
                items={[
                  ['Started', fmtDateTime(walk.start_time)],
                  ['Ended', walk.end_time ? fmtDateTime(walk.end_time) : 'Not ended'],
                  [
                    'Survey time',
                    walk.protocol === 'incidental' ? '-' : fmtDuration(walk.duration_min),
                  ],
                  [
                    'Distance',
                    walk.protocol === 'transect' ? `${fmtKm(walk.distance_km ?? 0)} km` : '-',
                  ],
                  ['Average pace', pace ? `${fmtDec(pace, 1)} km/h` : '-'],
                  [
                    'Complete checklist',
                    walk.protocol === 'incidental'
                      ? 'Not a survey'
                      : walk.complete_session
                        ? 'Yes, every animal recorded'
                        : 'No',
                  ],
                  ['People counting', fmtInt(walk.number_of_observers)],
                  [
                    'Weather',
                    walk.weather ? (WEATHER_LABEL[walk.weather] ?? walk.weather) : 'Not recorded',
                  ],
                  [
                    'Time of day',
                    walk.time_of_day
                      ? (TIME_OF_DAY_LABEL[walk.time_of_day] ?? walk.time_of_day)
                      : 'Not recorded',
                  ],
                  [
                    'GPS accuracy (mean)',
                    walk.device_gps_accuracy_avg != null
                      ? `${fmtDec(walk.device_gps_accuracy_avg, 1)} m`
                      : 'Not recorded',
                  ],
                  ['App version', walk.app_version ?? 'Not recorded'],
                  ['Country', walk.country_code ?? '-'],
                ]}
              />
            </div>
            {walk.notes ? (
              <div className="mt-5 rounded-tile bg-canvas p-4">
                <p className="text-[12px] text-ink3">Volunteer's note</p>
                <p className="text-[14px] mt-1">{walk.notes}</p>
              </div>
            ) : null}
          </Card>

          {route ? (
            <Card>
              <CardHeader
                title="Route protocol"
                description={`${route.name}: ${DIRECTION_LABEL[route.direction_rule ?? 'as_drawn']}.`}
                action={
                  comp ? (
                    <Badge
                      tone={comp.score >= 0.85 ? 'accent' : comp.score >= 0.6 ? 'warn' : 'danger'}
                    >
                      {Math.round(comp.score * 100)}% followed
                    </Badge>
                  ) : null
                }
              />
              {comp ? (
                <ul className="px-6 pb-5 flex flex-col gap-3">
                  {comp.checks.map((c) => {
                    const Icon = CHECK_ICON[c.state];
                    return (
                      <li key={c.id} className="flex items-start gap-3">
                        <Icon
                          aria-hidden
                          className={cx('w-5 h-5 shrink-0 mt-0.5', CHECK_CLS[c.state])}
                        />
                        <span className="min-w-0">
                          <span className="block text-[14px] font-medium">{c.label}</span>
                          <span className="block text-[12px] text-ink2">{c.detail}</span>
                        </span>
                        <span className="sr-only">{c.state}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-6 pb-5 text-[14px] text-ink2">
                  {track.loading ? 'Checking the track…' : 'No track to check against the route.'}
                </p>
              )}
            </Card>
          ) : null}
        </div>
      </div>

      {walk.protocol !== 'incidental' ? (
        <div className="grid gap-4 mt-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Speed along the walk"
              description="From raw GPS fixes. Dashed: the 15 km/h walking limit used by the server checks."
            />
            {pts === null && !points.loading ? (
              <p className="px-6 pb-6 text-[14px] text-ink2">
                Raw GPS fixes are available once the route protocols migration is applied.
              </p>
            ) : !speedSeries ? (
              <Skeleton className="h-[200px] mx-6 mb-6" />
            ) : (
              <ChartFrame
                label="Speed over time"
                legend={
                  <Legend
                    items={[
                      { label: 'Speed', color: 'var(--chart-1)' },
                      { label: 'Walking limit', color: 'var(--danger)', dashed: true },
                    ]}
                  />
                }
                chart={
                  <TimeChart
                    label="Speed in km/h over the walk"
                    height={200}
                    formatX={(d) => fmtTime(d.toISOString())}
                    format={(v) => `${fmtDec(v, 1)}`}
                    series={[
                      {
                        key: 'speed',
                        label: 'km/h',
                        color: 'var(--chart-1)',
                        points: speedSeries.speed,
                      },
                      {
                        key: 'limit',
                        label: 'limit',
                        color: 'var(--danger)',
                        points: speedSeries.speed.map((p) => ({ t: p.t, v: 15 })),
                        reference: true,
                      },
                    ]}
                  />
                }
                table={{
                  columns: ['Time', 'km/h'],
                  rows: speedSeries.speed.map((p) => [
                    fmtTime(p.t.toISOString()),
                    p.v == null ? '' : fmtDec(p.v, 1),
                  ]),
                }}
              />
            )}
          </Card>
          <Card>
            <CardHeader
              title="GPS accuracy"
              description="Horizontal accuracy of each fix. Fixes above 30 m are stored with a reason, never deleted."
            />
            {pts === null && !points.loading ? (
              <p className="px-6 pb-6 text-[14px] text-ink2">
                Raw GPS fixes are available once the route protocols migration is applied.
              </p>
            ) : !speedSeries ? (
              <Skeleton className="h-[200px] mx-6 mb-6" />
            ) : (
              <>
                <ChartFrame
                  label="GPS accuracy over time"
                  legend={
                    <Legend
                      items={[
                        { label: 'Accuracy', color: 'var(--series-1)' },
                        { label: '30 m cut-off', color: 'var(--danger)', dashed: true },
                      ]}
                    />
                  }
                  chart={
                    <TimeChart
                      label="GPS accuracy in metres over the walk"
                      height={160}
                      formatX={(d) => fmtTime(d.toISOString())}
                      format={(v) => `${fmtDec(v, 0)}`}
                      series={[
                        {
                          key: 'acc',
                          label: 'm',
                          color: 'var(--series-1)',
                          points: speedSeries.acc,
                        },
                        {
                          key: 'cut',
                          label: 'cut-off',
                          color: 'var(--danger)',
                          points: speedSeries.acc.map((p) => ({ t: p.t, v: 30 })),
                          reference: true,
                        },
                      ]}
                    />
                  }
                  table={{
                    columns: ['Time', 'Accuracy (m)'],
                    rows: speedSeries.acc.map((p) => [
                      fmtTime(p.t.toISOString()),
                      p.v == null ? '' : fmtDec(p.v, 1),
                    ]),
                  }}
                />
                <dl className="grid grid-cols-3 gap-3 px-6 pb-6">
                  <MiniStat k="Fixes" v={fmtInt(pts?.length ?? 0)} />
                  <MiniStat k="Rejected" v={fmtInt(rejected.length)} />
                  <MiniStat
                    k="Mock flagged"
                    v={fmtInt(pts?.filter((p) => p.is_mock).length ?? 0)}
                  />
                </dl>
                <p className="px-6 -mt-3 pb-5 text-[12px] text-ink3">
                  {fmtInt(accepted.length)} accepted fixes build the line on the map.
                </p>
              </>
            )}
          </Card>
        </div>
      ) : null}

      <Card className="mt-4">
        <CardHeader
          title={`Sightings on this walk (${fmtInt(mine.length)})`}
          description={
            mine.length === 0 && walk.complete_session
              ? 'None seen on a complete checklist: a recorded absence, as valuable as a sighting.'
              : 'Animal positions come from the observer position, compass bearing and estimated distance.'
          }
        />
        {mine.length ? (
          <Table label="Sightings on this walk">
            <thead>
              <tr>
                <th className={th}>Record</th>
                <th className={th}>Species</th>
                <th className={th}>Seen</th>
                <th className={`${th} text-end`}>Group</th>
                <th className={`${th} text-end`}>Bearing</th>
                <th className={`${th} text-end`}>Estimated distance</th>
                <th className={`${th} text-end`}>From path</th>
                <th className={th}>Body condition</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((s) => (
                <tr key={s.id} className="hover:bg-canvas">
                  <td className={td}>
                    <a
                      href={href(`sightings/${s.id}`)}
                      className="font-semibold tabular hover:underline"
                      translate="no"
                    >
                      {s.public_code}
                    </a>
                  </td>
                  <td className={td}>
                    <SpeciesBadge s={s.species} />
                  </td>
                  <td className={`${td} tabular whitespace-nowrap`}>{fmtTime(s.observed_at)}</td>
                  <td className={tdNum}>{s.group_size}</td>
                  <td className={tdNum}>
                    {s.bearing_deg != null
                      ? `${Math.round(s.bearing_deg)}° ${compassName(s.bearing_deg)}`
                      : '-'}
                  </td>
                  <td className={tdNum}>
                    {s.distance_estimate_m != null ? `${fmtInt(s.distance_estimate_m)} m` : '-'}
                  </td>
                  <td className={tdNum}>
                    {s.perpendicular_distance_m != null
                      ? `${fmtDec(s.perpendicular_distance_m, 1)} m`
                      : 'Not recorded'}
                  </td>
                  <td className={`${td} text-ink2`}>
                    {s.body_condition_score
                      ? `${s.body_condition_score}, ${BCS_LABEL[s.body_condition_score]}`
                      : pretty(null)}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState compact icon={<PawPrint />} title="No animals recorded" />
        )}
      </Card>
    </>
  );
}

function MiniStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-tile bg-canvas px-3 py-2.5">
      <dt className="text-[12px] text-ink3">{k}</dt>
      <dd className="text-[18px] font-semibold tabular">{v}</dd>
    </div>
  );
}
