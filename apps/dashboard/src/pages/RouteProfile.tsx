import { useMemo, useState } from 'react';
import { Archive, ArrowLeftRight, Pencil, Route as RouteIcon, Trash2, Undo2 } from 'lucide-react';
import {
  archiveRoute,
  deleteRouteForever,
  getRouteRevisions,
  restoreRoute,
  setRouteActive,
  updateRoute,
} from '../data/api';
import { useCore, useTracks } from '../data/portal';
import { invalidate, useData } from '../data/useData';
import { compliance, parseTrack, previousVisitOf, routeIsLoop } from '../lib/compliance';
import { fmtDate, fmtDateTime, fmtDec, fmtDuration, fmtInt, fmtKm } from '../lib/format';
import { lineLengthKm, lineToEwkt } from '../lib/geo';
import { href, navigate } from '../lib/router';
import { DIRECTION_LABEL, SIDE_RULE_LABEL } from '../lib/labels';
import { linearTrend } from '../lib/series';
import { useDark } from '../lib/theme';
import { MapView, type MapLine, type MapPoint } from '../components/LazyMap';
import { ChartFrame, Legend, TimeChart } from '../components/charts';
import { StatusBadge } from '../components/widgets';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  EmptyState,
  Facts,
  LinkButton,
  Notice,
  PageHeader,
  Skeleton,
  Switch,
  Table,
  td,
  tdNum,
  th,
} from '../ui';
import { routeState } from './Routes';
import type { PageProps } from './types';

export function RouteProfile({ id, me }: PageProps) {
  const core = useCore();
  const tracks = useTracks();
  const dark = useDark();
  const revisions = useData(`revisions:${id}`, () => getRouteRevisions(id!));
  const [dialog, setDialog] = useState<'reverse' | 'archive' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'accent' | 'danger'; text: string } | null>(null);
  const [showTracks, setShowTracks] = useState(true);
  const r = core.routes.data?.find((x) => x.id === id);

  const visits = useMemo(() => {
    if (!r || !core.walks.data) return [];
    const trackBy = new Map((tracks.data ?? []).map((t) => [t.session_id, t.track_geojson]));
    const per = new Map<string, number>();
    for (const s of core.sightings.data ?? [])
      per.set(s.session_id, (per.get(s.session_id) ?? 0) + (s.group_size || 1));
    return core.walks.data
      .filter((w) => w.route_id === r.id)
      .map((w) => {
        const track = parseTrack(trackBy.get(w.id));
        return {
          w,
          track,
          animals: per.get(w.id) ?? 0,
          comp: tracks.data ? compliance(w, track, r, previousVisitOf(w, core.walks.data!)) : null,
        };
      });
  }, [r, core.walks.data, core.sightings.data, tracks.data]);

  if (!core.routes.data) return <Skeleton className="h-[640px]" />;
  if (!r)
    return (
      <Card>
        <EmptyState
          icon={<RouteIcon />}
          title="Route not found"
          body="It may have been deleted permanently."
          action={<LinkButton href={href('routes')}>Back to Routes</LinkButton>}
        />
      </Card>
    );

  const state = routeState(r);
  const coords = r.geometry?.coordinates ?? [];
  const loop = routeIsLoop(r);
  const counted = visits.filter((v) => v.w.validation_status !== 'flagged');
  const scored = counted.filter((v) => v.comp);
  const meanScore = scored.length
    ? scored.reduce((a, v) => a + v.comp!.score, 0) / scored.length
    : null;
  const forward = scored.filter((v) => v.comp!.direction === 'forward').length;
  const reverse = scored.filter((v) => v.comp!.direction === 'reverse').length;
  const meanCoverage = scored.length
    ? scored.reduce((a, v) => a + v.comp!.coverage, 0) / scored.length
    : null;
  const walkers = new Set(counted.map((v) => v.w.observer_id));
  const canEdit = me.role === 'admin' || me.role === 'researcher';

  // Encounter rate per complete visit, in date order: the comparison fixed routes exist for
  const rateVisits = [...counted]
    .filter((v) => v.w.complete_session && (v.w.distance_km ?? 0) > 0)
    .sort((a, b) => a.w.start_time.localeCompare(b.w.start_time));
  const ratePts = rateVisits.map((v) => ({
    t: new Date(v.w.start_time),
    v: v.animals / (v.w.distance_km as number),
  }));
  const trend = linearTrend(ratePts);

  const lines: MapLine[] = [
    ...(showTracks
      ? counted
          .slice(0, 40)
          .filter((v) => v.track.length > 1)
          .map((v) => ({
            id: v.w.id,
            coords: v.track,
            kind: 'track-muted' as const,
            href: `#/walks/${v.w.id}`,
          }))
      : []),
    ...(coords.length > 1
      ? [
          {
            id: r.id,
            coords,
            kind: 'route' as const,
            arrows: r.direction_rule !== 'either',
            label: r.name,
          },
        ]
      : []),
  ];
  const points: MapPoint[] = coords.length
    ? [
        { id: 'start', lon: coords[0][0], lat: coords[0][1], kind: 'start', label: 'Start point' },
        ...(!loop
          ? [
              {
                id: 'end',
                lon: coords[coords.length - 1][0],
                lat: coords[coords.length - 1][1],
                kind: 'end' as const,
                label: 'End point',
              },
            ]
          : []),
      ]
    : [];

  const run = async (fn: () => Promise<void>, ok: string, after?: () => void) => {
    setBusy(true);
    try {
      await fn();
      invalidate('routes');
      invalidate(`revisions:${id}`);
      await core.routes.reload();
      revisions.reload();
      setMessage({ tone: 'accent', text: ok });
      after?.();
    } catch (e) {
      setMessage({
        tone: 'danger',
        text: `That did not work: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setBusy(false);
      setDialog(null);
    }
  };
  const reverseNow = () =>
    run(
      () =>
        updateRoute(r.id, {
          ...r,
          name: r.name,
          area: r.delegation ?? '',
          notes: r.habitat_notes ?? '',
          ewkt: lineToEwkt([...coords].reverse()),
          lengthKm: lineLengthKm(coords),
        }),
      `Direction reversed. ${r.name} now starts at the old end point; walks from now on use version ${(r.version ?? 1) + 1}.`
    );

  return (
    <>
      <PageHeader
        back={{ href: href('routes'), label: 'Routes' }}
        eyebrow={
          <div className="flex flex-wrap gap-2">
            <Badge tone={state === 'live' ? 'accent' : state === 'off' ? 'neutral' : 'warn'} dot>
              {state === 'live' ? 'Live in the app' : state === 'off' ? 'Paused' : 'Archived'}
            </Badge>
            <Badge>Protocol version {r.version ?? 1}</Badge>
            {loop ? <Badge>Loop</Badge> : null}
          </div>
        }
        title={r.name}
        description={`${[r.delegation, r.governorate].filter(Boolean).join(', ') || 'No area set'}. ${r.length_km != null ? `${fmtKm(r.length_km)} km, ` : ''}created ${fmtDate(r.created_at)}${r.updated_at ? `, last changed ${fmtDate(r.updated_at)}` : ''}.`}
        actions={
          canEdit ? (
            state === 'archived' ? (
              <>
                <Button
                  kind="dark"
                  size="sm"
                  icon={<Undo2 />}
                  disabled={busy}
                  onClick={() => run(() => restoreRoute(r.id), `${r.name} is live again.`)}
                >
                  Restore Route
                </Button>
                {visits.length === 0 ? (
                  <Button
                    kind="danger"
                    size="sm"
                    icon={<Trash2 />}
                    onClick={() => setDialog('delete')}
                  >
                    Delete Forever
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <LinkButton href={href(`routes/${r.id}/edit`)} kind="dark" icon={<Pencil />}>
                  Edit Route
                </LinkButton>
                <Button
                  kind="pill"
                  size="sm"
                  icon={<ArrowLeftRight />}
                  disabled={busy || coords.length < 2}
                  onClick={() => setDialog('reverse')}
                >
                  Reverse Direction
                </Button>
                <Button
                  kind="pill"
                  size="sm"
                  icon={<Archive />}
                  onClick={() => setDialog('archive')}
                >
                  Archive
                </Button>
                {visits.length === 0 ? (
                  <Button
                    kind="danger"
                    size="sm"
                    icon={<Trash2 />}
                    onClick={() => setDialog('delete')}
                  >
                    Delete
                  </Button>
                ) : null}
              </>
            )
          ) : null
        }
      />
      {message ? (
        <Notice tone={message.tone} onClose={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
        <Card className="p-2">
          <MapView
            points={points}
            lines={lines}
            dark={dark}
            height={500}
            fitKey={`${r.id}${r.version}`}
            label={`${r.name}: route with start point and walking direction, plus walked tracks`}
          />
          <div className="flex flex-wrap items-center gap-4 px-4 py-3 text-[12px] text-ink2">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="w-3 h-3 rounded-full bg-[#2F7A2B] ring-2 ring-white" />{' '}
              Start
            </span>
            {!loop ? (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="w-3 h-3 rounded-full bg-[#16181D] ring-2 ring-white" />{' '}
                End
              </span>
            ) : null}
            <span>
              {r.direction_rule === 'either'
                ? 'Either direction allowed'
                : 'Arrows show the required direction'}
            </span>
            <label className="ms-auto inline-flex items-center gap-2 text-[13px] text-ink">
              Walked tracks
              <Switch label="Show walked tracks" checked={showTracks} onChange={setShowTracks} />
            </label>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="Walking protocol"
              description="Every volunteer sees these rules in the app before starting."
            />
            <div className="px-6 pb-6">
              <Facts
                items={[
                  ['Direction', DIRECTION_LABEL[r.direction_rule ?? 'as_drawn']],
                  ['Start', loop ? 'Loop, start at the green point' : 'The green point'],
                  ['Side to record', SIDE_RULE_LABEL[r.side_rule ?? 'both']],
                  [
                    'Strip width',
                    r.strip_width_m ? `${r.strip_width_m} m from the path` : 'Not set',
                  ],
                  [
                    'Time window',
                    r.window_start && r.window_end
                      ? `${r.window_start.slice(0, 5)} to ${r.window_end.slice(0, 5)}`
                      : 'Any time',
                  ],
                  [
                    'Target duration',
                    r.target_duration_min ? fmtDuration(r.target_duration_min) : 'Not set',
                  ],
                  [
                    'Revisit interval',
                    r.revisit_days ? `At least ${r.revisit_days} days apart` : 'Not set',
                  ],
                  [
                    'Checklist',
                    r.require_complete === false ? 'Partial allowed' : 'Must be complete',
                  ],
                ]}
              />
              {r.instructions ? (
                <div className="mt-5 rounded-tile bg-canvas p-4">
                  <p className="text-[12px] text-ink3">Instructions for walkers</p>
                  <p className="text-[14px] mt-1 whitespace-pre-line">{r.instructions}</p>
                </div>
              ) : null}
              {r.habitat_notes ? (
                <p className="text-[13px] text-ink2 mt-4">Habitat: {r.habitat_notes}</p>
              ) : null}
            </div>
          </Card>
          {state !== 'archived' && canEdit ? (
            <Card className="p-5 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-[15px] font-semibold">Available to volunteers</p>
                <p className="text-[13px] text-ink2">
                  Paused routes are hidden from the app but keep their history.
                </p>
              </div>
              <Switch
                label="Available to volunteers"
                checked={r.is_active}
                disabled={busy}
                onChange={(v) => run(() => setRouteActive(r.id, v), v ? 'Live again.' : 'Paused.')}
              />
            </Card>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 mt-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          k="Visits"
          v={fmtInt(counted.length)}
          sub={`${fmtInt(visits.length - counted.length)} flagged, left out`}
        />
        <Kpi k="Walkers" v={fmtInt(walkers.size)} sub="Different volunteers" />
        <Kpi
          k="Protocol followed"
          v={meanScore == null ? '-' : `${Math.round(meanScore * 100)}%`}
          sub={
            meanCoverage == null
              ? 'Needs tracks'
              : `Mean coverage ${Math.round(meanCoverage * 100)}%`
          }
        />
        <Kpi
          k="Direction"
          v={scored.length ? `${fmtInt(forward)} as drawn` : '-'}
          sub={
            scored.length
              ? `${fmtInt(reverse)} reversed, ${fmtInt(scored.length - forward - reverse)} unclear`
              : 'Needs tracks'
          }
        />
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Encounter rate per visit"
          description="Animals per km on each complete, unflagged visit, in date order. Dashed: least-squares trend. Same route, same rules: this is where change over time shows."
        />
        {ratePts.length < 2 ? (
          <p className="px-6 pb-6 text-[14px] text-ink2">Needs at least two complete visits.</p>
        ) : (
          <ChartFrame
            label="Encounter rate per visit"
            legend={
              trend ? (
                <Legend
                  items={[
                    { label: 'Animals per km', color: 'var(--chart-1)' },
                    { label: 'Trend', color: 'var(--ink3)', dashed: true },
                  ]}
                />
              ) : null
            }
            chart={
              <TimeChart
                label="Animals per km on each visit"
                height={220}
                format={(v) => fmtDec(v, 1)}
                formatTip={(d) => fmtDateTime(d.toISOString())}
                series={[
                  { key: 'rate', label: 'per km', color: 'var(--chart-1)', points: ratePts },
                  ...(trend
                    ? [
                        {
                          key: 't',
                          label: 'trend',
                          color: 'var(--ink3)',
                          points: ratePts.map((p, i) => ({ t: p.t, v: Math.max(0, trend.at(i)) })),
                          reference: true,
                        },
                      ]
                    : []),
                ]}
              />
            }
            table={{
              columns: ['Visit', 'Animals', 'km', 'Animals per km'],
              rows: rateVisits.map((v) => [
                fmtDateTime(v.w.start_time),
                fmtInt(v.animals),
                fmtKm(v.w.distance_km ?? 0),
                fmtDec(v.animals / (v.w.distance_km as number), 2),
              ]),
            }}
          />
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader
          title={`Visits (${fmtInt(visits.length)})`}
          description="Each walk on this route with how closely it followed the protocol."
        />
        {visits.length === 0 ? (
          <EmptyState
            compact
            icon={<RouteIcon />}
            title="Not walked yet"
            body="Visits appear once volunteers walk this route in the app."
          />
        ) : (
          <Table label="Visits to this route">
            <thead>
              <tr>
                <th className={th}>Walked</th>
                <th className={th}>Volunteer</th>
                <th className={`${th} text-end`}>Version</th>
                <th className={`${th} text-end`}>km</th>
                <th className={`${th} text-end`}>Animals</th>
                <th className={th}>Direction</th>
                <th className={`${th} text-end`}>Coverage</th>
                <th className={`${th} text-end`}>Protocol</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {visits.slice(0, 200).map(({ w, animals, comp }) => (
                <tr key={w.id} className="hover:bg-canvas">
                  <td className={`${td} whitespace-nowrap`}>
                    <a href={href(`walks/${w.id}`)} className="font-semibold hover:underline">
                      {fmtDateTime(w.start_time)}
                    </a>
                  </td>
                  <td className={td}>
                    <a
                      href={href(`people/${w.observer_id}`)}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Avatar id={w.observer_id} name={core.nameOf(w.observer_id)} size={26} />
                      <span className="truncate max-w-[160px]">{core.nameOf(w.observer_id)}</span>
                    </a>
                  </td>
                  <td className={tdNum}>{w.route_version ? `v${w.route_version}` : '-'}</td>
                  <td className={tdNum}>{fmtKm(w.distance_km ?? 0)}</td>
                  <td className={tdNum}>{fmtInt(animals)}</td>
                  <td className={td}>
                    {comp ? (
                      comp.direction === 'forward' ? (
                        'As drawn'
                      ) : comp.direction === 'reverse' ? (
                        <Badge tone={r.direction_rule === 'either' ? 'neutral' : 'danger'}>
                          Reversed
                        </Badge>
                      ) : (
                        <span className="text-ink3">Unclear</span>
                      )
                    ) : (
                      <span className="text-ink3">-</span>
                    )}
                  </td>
                  <td className={tdNum}>{comp ? `${Math.round(comp.coverage * 100)}%` : '-'}</td>
                  <td className={tdNum}>
                    {comp ? (
                      <Badge
                        tone={comp.score >= 0.85 ? 'accent' : comp.score >= 0.6 ? 'warn' : 'danger'}
                      >
                        {Math.round(comp.score * 100)}%
                      </Badge>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className={td}>
                    <StatusBadge w={w} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Version history"
          description="Every change to the line or the rules starts a new version. Earlier versions are kept, never overwritten."
        />
        <ol className="px-6 pb-6 flex flex-col">
          <li className="flex items-center gap-3 py-2.5">
            <Badge tone="dark">v{r.version ?? 1}</Badge>
            <span className="text-[14px] flex-1">Current version</span>
            <span className="text-[12px] text-ink3">{fmtDate(r.updated_at ?? r.created_at)}</span>
          </li>
          {(revisions.data ?? []).map((rev) => (
            <li key={rev.version} className="flex items-start gap-3 py-2.5 border-t border-line">
              <Badge>v{rev.version}</Badge>
              <span className="text-[13px] text-ink2 flex-1">
                {Object.entries(rev.rules)
                  .filter(([k, v]) => v != null && k !== 'name' && k !== 'length_km')
                  .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`)
                  .join(' · ') || 'Line changed'}
              </span>
              <span className="text-[12px] text-ink3 whitespace-nowrap">
                replaced {fmtDate(rev.changed_at)}
                {rev.changed_by ? ` by ${core.nameOf(rev.changed_by)}` : ''}
              </span>
            </li>
          ))}
          {revisions.data && !revisions.data.length && (r.version ?? 1) > 1 ? (
            <li className="text-[13px] text-ink2 py-2 border-t border-line">
              Earlier versions were changed before history was recorded.
            </li>
          ) : null}
        </ol>
      </Card>

      <Dialog
        open={dialog === 'reverse'}
        onClose={() => setDialog(null)}
        title="Reverse the walking direction?"
        actions={
          <>
            <Button kind="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button kind="dark" disabled={busy} onClick={reverseNow}>
              {busy ? 'Reversing…' : 'Reverse Direction'}
            </Button>
          </>
        }
      >
        The end point becomes the start and every volunteer walks the other way from their next
        sync. This starts protocol version {(r.version ?? 1) + 1}; the {fmtInt(visits.length)}{' '}
        earlier {visits.length === 1 ? 'walk keeps' : 'walks keep'} their version so analyses can
        tell them apart.
      </Dialog>
      <Dialog
        open={dialog === 'archive'}
        onClose={() => setDialog(null)}
        title={`Archive ${r.name}?`}
        actions={
          <>
            <Button kind="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              kind="danger"
              disabled={busy}
              onClick={() =>
                run(
                  () => archiveRoute(r.id),
                  `${r.name} is archived. Restore it any time from the Archived tab.`
                )
              }
            >
              Archive Route
            </Button>
          </>
        }
      >
        It disappears from the app and the route lists. Its line, rules and the{' '}
        {fmtInt(visits.length)} walks on it are kept, and you can restore it later.
      </Dialog>
      <Dialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title={`Delete ${r.name} forever?`}
        actions={
          <>
            <Button kind="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              kind="danger"
              disabled={busy}
              onClick={() =>
                run(
                  () => deleteRouteForever(r.id),
                  `${r.name} was deleted.`,
                  () => navigate('routes')
                )
              }
            >
              Delete Forever
            </Button>
          </>
        }
      >
        Nobody has walked this route, so nothing depends on it. This cannot be undone. Routes that
        were walked can only be archived, so their data stays valid.
      </Dialog>
    </>
  );
}

function Kpi({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="bg-surface rounded-card shadow-card p-5">
      <p className="text-[13px] text-ink2">{k}</p>
      <p className="text-[28px] font-semibold leading-tight mt-1">{v}</p>
      <p className="text-[12px] text-ink3 mt-1">{sub}</p>
    </div>
  );
}
