import { useMemo, useState } from 'react';
import { ChevronLeft, Users } from 'lucide-react';
import { setRole, type Role } from '../data/api';
import { useAnimals, useCore, useTracks } from '../data/portal';
import { invalidate } from '../data/useData';
import { compliance, parseTrack, previousVisitOf } from '../lib/compliance';
import {
  fmtAgo,
  fmtDate,
  fmtDateTime,
  fmtDec,
  fmtDuration,
  fmtInt,
  fmtKm,
  bucketLabel,
} from '../lib/format';
import { href } from '../lib/router';
import { LANG_LABEL, ROLE_LABEL } from '../lib/labels';
import { PROTOCOL_LABEL, REASON_LABEL } from '../lib/stats';
import { dailyCounts, hourWeekday, series } from '../lib/series';
import {
  BarList,
  CalendarHeatmap,
  ChartFrame,
  HourHeatmap,
  SPECIES_COLOR,
  SplitBar,
  TimeChart,
} from '../components/charts';
import { StatusBadge } from '../components/widgets';
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  Dialog,
  Button,
  EmptyState,
  Facts,
  LinkButton,
  Meter,
  Notice,
  Skeleton,
  Table,
  td,
  tdNum,
  th,
  selectChevron,
} from '../ui';
import { usePeopleStats } from './People';
import type { PageProps } from './types';

export function PersonProfile({ id, me }: PageProps) {
  const core = useCore();
  const tracks = useTracks();
  const { individuals } = useAnimals();
  const stats = usePeopleStats();
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [message, setMessage] = useState<{ tone: 'accent' | 'danger'; text: string } | null>(null);
  const user = core.users.data?.find((u) => u.id === id);
  const s = stats.get(id ?? '');
  const walks = useMemo(
    () => (core.walks.data ?? []).filter((w) => w.observer_id === id),
    [core.walks.data, id]
  );
  const sightings = useMemo(
    () => (core.sightings.data ?? []).filter((x) => x.observer_id === id),
    [core.sightings.data, id]
  );

  const weekly = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 26 * 7 * 86400000);
    return series(walks, sightings, 'km', from, to, 'week');
  }, [walks, sightings]);
  const days = useMemo(() => {
    const d = dailyCounts(walks);
    return new Map([...d.entries()].map(([k, v]) => [k, v.walks]));
  }, [walks]);
  const hours = useMemo(() => hourWeekday(walks), [walks]);

  const routesWalked = useMemo(() => {
    const m = new Map<string, { n: number; score: number; scored: number }>();
    const trackBy = new Map((tracks.data ?? []).map((t) => [t.session_id, t.track_geojson]));
    for (const w of walks) {
      if (!w.route_id || w.validation_status === 'flagged') continue;
      const v = m.get(w.route_id) ?? { n: 0, score: 0, scored: 0 };
      v.n += 1;
      const r = core.routes.data?.find((x) => x.id === w.route_id);
      if (r && tracks.data) {
        const c = compliance(
          w,
          parseTrack(trackBy.get(w.id)),
          r,
          previousVisitOf(w, core.walks.data ?? [])
        );
        if (c) {
          v.score += c.score;
          v.scored += 1;
        }
      }
      m.set(w.route_id, v);
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [walks, core.routes.data, core.walks.data, tracks.data]);
  const reasonCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of walks) for (const r of w.validation_reasons) m.set(r, (m.get(r) ?? 0) + 1);
    return [...m.entries()];
  }, [walks]);

  if (!core.ready || !core.users.data) return <Skeleton className="h-[640px]" />;
  if (!user)
    return (
      <Card>
        <EmptyState
          icon={<Users />}
          title="Person not found"
          body="The account may have been deleted."
          action={<LinkButton href={href('people')}>Back to People</LinkButton>}
        />
      </Card>
    );

  const transectSightings = sightings.filter((x) => x.protocol === 'transect');
  const withDist = transectSightings.filter((x) => x.perpendicular_distance_m != null).length;
  const structured = walks.filter(
    (w) => w.protocol !== 'incidental' && w.validation_status !== 'flagged'
  );
  const completeShare = structured.length
    ? structured.filter((w) => w.complete_session).length / structured.length
    : 0;
  const flagRate = walks.length ? (s?.flagged ?? 0) / walks.length : 0;
  const sp = (x: string) =>
    sightings.filter((o) => o.species === x).reduce((a, o) => a + (o.group_size || 1), 0);
  const registered = (individuals.data ?? []).filter((i) => i.created_by === id);
  const isAdmin = me.role === 'admin';
  const fmtW = bucketLabel('week');

  const changeRole = async () => {
    if (!pendingRole) return;
    try {
      await setRole(user.id, pendingRole);
      invalidate('users');
      await core.users.reload();
      setMessage({
        tone: 'accent',
        text: `${user.display_name || 'This person'} is now ${ROLE_LABEL[pendingRole].toLowerCase()}.`,
      });
    } catch (e) {
      setMessage({
        tone: 'danger',
        text: `The role was not changed: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setPendingRole(null);
    }
  };

  return (
    <>
      <a
        href={href('people')}
        className="inline-flex items-center gap-1 text-[14px] font-medium text-ink2 hover:text-ink mb-3"
      >
        <ChevronLeft aria-hidden className="w-4 h-4 rtl:rotate-180" />
        People
      </a>
      {message ? (
        <Notice tone={message.tone} onClose={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <Card className="p-6 mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          <Avatar id={user.id} name={user.display_name} size={88} />
          <div className="flex-1 min-w-0">
            <h1 className="text-[34px] leading-[1.1] font-bold tracking-[-0.02em] truncate">
              {user.display_name || 'Unnamed volunteer'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge
                tone={user.role === 'admin' || user.role === 'researcher' ? 'dark' : 'neutral'}
              >
                {ROLE_LABEL[user.role]}
              </Badge>
              <span className="text-[14px] text-ink2">
                Joined {fmtDate(user.created_at)}
                {user.preferred_language
                  ? `, app in ${LANG_LABEL[user.preferred_language] ?? user.preferred_language}`
                  : ''}
                {s?.last ? `, last surveyed ${fmtAgo(s.last)}` : ', no surveys yet'}
              </span>
            </div>
          </div>
          {isAdmin && user.id !== me.id ? (
            <label className="flex flex-col gap-1 text-[12px] text-ink2">
              Role
              <select
                value={user.role}
                onChange={(e) => setPendingRole(e.target.value as Role)}
                className="h-11 rounded-full bg-canvas ps-4 pe-10 text-[14px] font-semibold text-ink appearance-none bg-no-repeat border border-line"
                style={selectChevron}
              >
                {(['volunteer', 'trained_surveyor', 'researcher', 'admin'] as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <Tile
          k="Kilometres surveyed"
          v={`${fmtKm(s?.km ?? 0)} km`}
          sub={`${fmtDuration(s?.minutes ?? 0)} of survey time`}
        />
        <Tile
          k="Survey sessions"
          v={fmtInt(s?.walks ?? 0)}
          sub={`${fmtInt(s?.weeks ?? 0)} active weeks`}
        />
        <Tile
          k="Complete checklists"
          v={fmtInt(s?.complete ?? 0)}
          sub={`${fmtInt(s?.zero ?? 0)} with zero animals`}
        />
        <Tile
          k="Sightings"
          v={fmtInt(s?.sightings ?? 0)}
          sub={`${fmtInt(s?.animals ?? 0)} animals counted`}
        />
      </div>

      <div className="grid gap-4 mt-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Kilometres per week"
            description="Last 26 weeks, flagged walks excluded."
          />
          <ChartFrame
            label="Kilometres per week"
            chart={
              <TimeChart
                label="Kilometres per week"
                kind="bar"
                markLast
                height={220}
                formatX={fmtW}
                formatTip={bucketLabel('week', true)}
                format={(v) => fmtDec(v, 1)}
                series={[{ key: 'km', label: 'km', color: 'var(--chart-1)', points: weekly }]}
              />
            }
            table={{
              columns: ['Week', 'km'],
              rows: weekly.map((p) => [bucketLabel('week', true)(p.t), fmtDec(p.v ?? 0, 2)]),
            }}
          />
        </Card>
        <Card>
          <CardHeader title="Data quality" description="Habits that make records analysable." />
          <div className="px-6 pb-6 flex flex-col gap-5">
            <QualityRow
              label="Complete checklists"
              value={completeShare}
              detail={`${Math.round(completeShare * 100)}% of survey sessions`}
            />
            <QualityRow
              label="Distance from path recorded"
              value={transectSightings.length ? withDist / transectSightings.length : 0}
              detail={`${fmtInt(withDist)} of ${fmtInt(transectSightings.length)} survey-walk sightings`}
            />
            <QualityRow
              label="Sessions not flagged"
              value={1 - flagRate}
              detail={`${fmtInt(s?.flagged ?? 0)} flagged of ${fmtInt(walks.length)}`}
            />
            {reasonCounts.length ? (
              <div>
                <p className="text-[13px] font-semibold mb-2">Flag reasons</p>
                <BarList
                  label="Flag reasons"
                  color="var(--warm)"
                  items={reasonCounts.map(([r, n]) => ({
                    key: r,
                    label: REASON_LABEL[r] ?? r,
                    value: n,
                  }))}
                  format={fmtInt}
                />
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 mt-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Survey calendar" description="Sessions per day, last 26 weeks." />
          <div className="px-6 pb-6">
            <CalendarHeatmap
              label="Sessions per day"
              days={days}
              format={(v, d) =>
                `${fmtInt(v)} ${v === 1 ? 'session' : 'sessions'}, ${new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(d)}`
              }
            />
            <p className="text-[13px] font-semibold mt-5 mb-2">Usual survey times</p>
            <HourHeatmap grid={hours} label="Sessions by weekday and hour" />
          </div>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="Routes walked"
              description="Visits and how closely they followed each route's protocol."
            />
            <ul className="px-6 pb-5">
              {routesWalked.length === 0 ? (
                <li className="text-[14px] text-ink2 pb-1">Only free walks so far.</li>
              ) : (
                routesWalked.map(([rid, v]) => (
                  <li key={rid}>
                    <a
                      href={href(`routes/${rid}`)}
                      className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-[12px] hover:bg-canvas"
                    >
                      <span className="flex-1 min-w-0 truncate text-[14px] font-medium">
                        {core.routeName(rid)}
                      </span>
                      <span className="text-[13px] text-ink2 tabular">{fmtInt(v.n)} visits</span>
                      {v.scored ? (
                        <Badge tone={v.score / v.scored >= 0.85 ? 'accent' : 'warn'}>
                          {Math.round((v.score / v.scored) * 100)}%
                        </Badge>
                      ) : null}
                    </a>
                  </li>
                ))
              )}
            </ul>
          </Card>
          <Card>
            <CardHeader title="What they recorded" />
            <div className="px-6 pb-6">
              <SplitBar
                label="Animals by species"
                parts={['cat', 'dog', 'unknown'].map((x) => ({
                  label: x,
                  value: sp(x),
                  color: SPECIES_COLOR[x],
                }))}
              />
              <Facts
                cols={3}
                items={[
                  ['Cats', fmtInt(sp('cat'))],
                  ['Dogs', fmtInt(sp('dog'))],
                  ['Known animals registered', fmtInt(registered.length)],
                ]}
              />
              {registered.length ? (
                <div className="flex flex-wrap gap-2 mt-4">
                  {registered.slice(0, 8).map((a) => (
                    <a
                      key={a.id}
                      href={href(`animals/${a.id}`)}
                      className="inline-flex items-center h-8 px-3 rounded-full bg-canvas text-[13px] font-medium hover:brightness-95"
                    >
                      {a.nickname || `Unnamed ${a.species}`}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader title={`Sessions (${fmtInt(walks.length)})`} />
        {walks.length === 0 ? (
          <EmptyState compact icon={<Users />} title="No sessions yet" />
        ) : (
          <Table label="Sessions">
            <thead>
              <tr>
                <th className={th}>Started</th>
                <th className={th}>Type</th>
                <th className={th}>Route</th>
                <th className={`${th} text-end`}>Time</th>
                <th className={`${th} text-end`}>km</th>
                <th className={`${th} text-end`}>Animals</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {walks.slice(0, 60).map((w) => (
                <tr key={w.id} className="hover:bg-canvas">
                  <td className={`${td} whitespace-nowrap`}>
                    <a href={href(`walks/${w.id}`)} className="font-semibold hover:underline">
                      {fmtDateTime(w.start_time)}
                    </a>
                  </td>
                  <td className={`${td} text-ink2`}>{PROTOCOL_LABEL[w.protocol]}</td>
                  <td className={`${td} text-ink2 max-w-[200px] truncate`}>
                    {w.route_id ? core.routeName(w.route_id) : 'Free walk'}
                  </td>
                  <td className={tdNum}>
                    {w.protocol === 'incidental' ? '-' : fmtDuration(w.duration_min)}
                  </td>
                  <td className={tdNum}>
                    {w.protocol === 'transect' ? fmtKm(w.distance_km ?? 0) : '-'}
                  </td>
                  <td className={tdNum}>
                    {fmtInt(
                      sightings
                        .filter((x) => x.session_id === w.id)
                        .reduce((a, x) => a + (x.group_size || 1), 0)
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

      <Dialog
        open={!!pendingRole}
        onClose={() => setPendingRole(null)}
        title={`Make ${user.display_name || 'this person'} ${pendingRole ? ROLE_LABEL[pendingRole].toLowerCase() : ''}?`}
        actions={
          <>
            <Button kind="ghost" onClick={() => setPendingRole(null)}>
              Cancel
            </Button>
            <Button kind="dark" onClick={changeRole}>
              Change Role
            </Button>
          </>
        }
      >
        {pendingRole === 'researcher' || pendingRole === 'admin'
          ? 'Researchers can open this portal, see every exact location and export data. Admins can also change roles.'
          : 'They lose access to this portal if they had it; their records stay.'}
      </Dialog>
    </>
  );
}

function Tile({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="bg-surface rounded-card shadow-card p-5 min-w-0">
      <p className="text-[13px] text-ink2">{k}</p>
      <p className="text-[28px] font-semibold leading-tight mt-1 truncate">{v}</p>
      <p className="text-[12px] text-ink3 mt-1 truncate">{sub}</p>
    </div>
  );
}

function QualityRow({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 gap-3">
        <p className="text-[13px] font-semibold">{label}</p>
        <p className="text-[12px] text-ink2 tabular text-end">{detail}</p>
      </div>
      <Meter
        label={label}
        value={value}
        tone={value >= 0.8 ? 'accent' : value >= 0.5 ? 'warn' : 'danger'}
      />
    </div>
  );
}
