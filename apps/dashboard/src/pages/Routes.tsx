import { useMemo, useState } from 'react';
import { ArrowLeftRight, Clock, Eye, Plus, Route as RouteIcon, Ruler, Undo2 } from 'lucide-react';
import { restoreRoute, setRouteActive, type RouteRow } from '../data/api';
import { useCore, useTracks } from '../data/portal';
import { invalidate } from '../data/useData';
import { compliance, parseTrack, previousVisitOf } from '../lib/compliance';
import { fmtAgo, fmtInt, fmtKm } from '../lib/format';
import { href } from '../lib/router';
import { DIRECTION_LABEL, SIDE_RULE_LABEL } from '../lib/labels';
import { useDark } from '../lib/theme';
import { MapView, type MapLine } from '../components/LazyMap';
import { RouteThumb } from '../components/RouteThumb';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  LinkButton,
  Notice,
  PageHeader,
  Skeleton,
  Switch,
  Tabs,
} from '../ui';
import type { PageProps } from './types';

type View = 'live' | 'off' | 'archived';

export const routeState = (r: RouteRow): View =>
  r.deleted_at ? 'archived' : r.is_active ? 'live' : 'off';

/** Visits, walkers and protocol compliance per route, from loaded walks and tracks. */
export function useRouteStats() {
  const core = useCore();
  const tracks = useTracks();
  return useMemo(() => {
    const m = new Map<
      string,
      {
        visits: number;
        walkers: number;
        last: string | null;
        score: number | null;
        reversed: number;
      }
    >();
    const trackBy = new Map((tracks.data ?? []).map((t) => [t.session_id, t.track_geojson]));
    for (const r of core.routes.data ?? []) {
      const visits = (core.walks.data ?? []).filter(
        (w) => w.route_id === r.id && w.validation_status !== 'flagged'
      );
      let sum = 0;
      let n = 0;
      let reversed = 0;
      if (tracks.data)
        for (const w of visits) {
          const c = compliance(
            w,
            parseTrack(trackBy.get(w.id)),
            r,
            previousVisitOf(w, core.walks.data!)
          );
          if (c) {
            sum += c.score;
            n++;
            if (c.direction === 'reverse') reversed++;
          }
        }
      m.set(r.id, {
        visits: visits.length,
        walkers: new Set(visits.map((w) => w.observer_id)).size,
        last: visits[0]?.start_time ?? null,
        score: n ? sum / n : null,
        reversed,
      });
    }
    return m;
  }, [core.routes.data, core.walks.data, tracks.data]);
}

export function Routes({ params }: PageProps) {
  const core = useCore();
  const dark = useDark();
  const stats = useRouteStats();
  const view = (params.get('view') as View) || 'live';
  const [message, setMessage] = useState<string | null>(null);
  const all = useMemo(() => core.routes.data ?? [], [core.routes.data]);
  const shown = all.filter((r) => routeState(r) === view);
  const count = (v: View) => all.filter((r) => routeState(r) === v).length;

  const lines = useMemo<MapLine[]>(
    () =>
      all
        .filter((r) => r.geometry && routeState(r) !== 'archived')
        .map((r) => ({
          id: r.id,
          coords: r.geometry!.coordinates,
          kind: r.is_active ? 'route' : 'route-muted',
          arrows: r.is_active && r.direction_rule !== 'either',
          label: r.name,
          href: `#/routes/${r.id}`,
        })),
    [all]
  );

  const act = async (fn: () => Promise<void>, msg: string) => {
    try {
      await fn();
      invalidate('routes');
      await core.routes.reload();
      setMessage(msg);
    } catch (e) {
      setMessage(`That did not work: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <>
      <PageHeader
        title="Routes"
        description="Fixed transects with one shared protocol: where to start, which way to walk, which side to watch and when. Repeat visits make counts comparable over time."
        actions={
          <LinkButton href={href('routes/new')} kind="dark" size="md" icon={<Plus />}>
            New Route
          </LinkButton>
        }
      />
      {message ? (
        <Notice
          onClose={() => setMessage(null)}
          tone={message.startsWith('That did not') ? 'danger' : 'accent'}
        >
          {message}
        </Notice>
      ) : null}
      {core.routes.error ? (
        <ErrorNote message={core.routes.error} onRetry={core.routes.reload} />
      ) : null}

      <Card className="p-2 mb-5">
        <MapView
          lines={lines}
          dark={dark}
          height={360}
          label="Map of live and paused routes; arrows show the walking direction"
        />
        <div className="flex flex-wrap gap-4 px-4 py-3 text-[12px] text-ink2">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="w-4 border-t-[3px] border-[#F1721D]" /> Live, arrows show
            the walking direction
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="w-4 border-t-[3px] border-dashed border-[#9AA0A8]" />{' '}
            Paused
          </span>
        </div>
      </Card>

      <div className="mb-4">
        <Tabs
          label="Route status"
          items={[
            { href: href('routes'), label: 'Live', active: view === 'live', count: count('live') },
            {
              href: href('routes', { view: 'off' }),
              label: 'Paused',
              active: view === 'off',
              count: count('off'),
            },
            {
              href: href('routes', { view: 'archived' }),
              label: 'Archived',
              active: view === 'archived',
              count: count('archived'),
            },
          ]}
        />
      </div>

      {!core.routes.data ? (
        <Skeleton className="h-[320px]" />
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={<RouteIcon />}
            title={
              view === 'live'
                ? 'No live routes'
                : view === 'off'
                  ? 'No paused routes'
                  : 'Nothing archived'
            }
            body={
              view === 'live'
                ? 'Draw one with New Route. Volunteers see it in the app after their next sync.'
                : 'Routes you pause or archive appear here.'
            }
            action={
              view === 'live' ? (
                <LinkButton href={href('routes/new')} kind="dark">
                  New Route
                </LinkButton>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 grid-cols-1 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((r) => {
            const s = stats.get(r.id);
            const state = routeState(r);
            return (
              <li key={r.id} className="bg-surface rounded-card shadow-card p-3 flex flex-col">
                <a href={href(`routes/${r.id}`)} className="block rounded-tile hover:opacity-95">
                  <RouteThumb
                    coords={r.geometry?.coordinates ?? []}
                    either={r.direction_rule === 'either'}
                    muted={state !== 'live'}
                    label={`Shape of ${r.name}`}
                  />
                </a>
                <div className="px-2 pt-3 flex-1 flex flex-col">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <a
                        href={href(`routes/${r.id}`)}
                        className="block text-[17px] font-semibold truncate hover:underline"
                      >
                        {r.name}
                      </a>
                      <p className="text-[13px] text-ink2 truncate">
                        {[r.delegation, r.governorate].filter(Boolean).join(', ') || 'No area set'}
                      </p>
                    </div>
                    {r.version && r.version > 1 ? <Badge>v{r.version}</Badge> : null}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3 text-[12px]">
                    <Chip icon={<Ruler aria-hidden className="w-3.5 h-3.5" />}>
                      {r.length_km != null ? `${fmtKm(r.length_km)} km` : 'Length unknown'}
                    </Chip>
                    <Chip icon={<ArrowLeftRight aria-hidden className="w-3.5 h-3.5" />}>
                      {DIRECTION_LABEL[r.direction_rule ?? 'as_drawn']}
                    </Chip>
                    <Chip icon={<Eye aria-hidden className="w-3.5 h-3.5" />}>
                      {SIDE_RULE_LABEL[r.side_rule ?? 'both']}
                      {r.strip_width_m ? `, ${r.strip_width_m} m` : ''}
                    </Chip>
                    {r.window_start && r.window_end ? (
                      <Chip icon={<Clock aria-hidden className="w-3.5 h-3.5" />}>
                        {r.window_start.slice(0, 5)} to {r.window_end.slice(0, 5)}
                      </Chip>
                    ) : null}
                  </div>
                  <dl className="grid grid-cols-3 gap-2 mt-4">
                    <Mini k="Visits" v={fmtInt(s?.visits ?? 0)} />
                    <Mini k="Walkers" v={fmtInt(s?.walkers ?? 0)} />
                    <Mini
                      k="Protocol"
                      v={s?.score == null ? '-' : `${Math.round(s.score * 100)}%`}
                    />
                  </dl>
                  <div className="flex items-center gap-3 mt-4 pt-3 border-t border-line">
                    <span className="text-[12px] text-ink2 flex-1">
                      Last walked {fmtAgo(s?.last)}
                    </span>
                    {state === 'archived' ? (
                      <Button
                        size="sm"
                        kind="pill"
                        icon={<Undo2 />}
                        onClick={() => act(() => restoreRoute(r.id), `${r.name} is live again.`)}
                      >
                        Restore
                      </Button>
                    ) : (
                      <label className="inline-flex items-center gap-2 text-[13px] font-medium">
                        {r.is_active ? 'Live' : 'Paused'}
                        <Switch
                          label={`${r.name} available to volunteers`}
                          checked={r.is_active}
                          onChange={(v) =>
                            act(
                              () => setRouteActive(r.id, v),
                              v
                                ? `${r.name} is live. Volunteers get it at their next sync.`
                                : `${r.name} is paused and hidden from the app.`
                            )
                          }
                        />
                      </label>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-canvas text-ink2 whitespace-nowrap">
      {icon}
      {children}
    </span>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-[12px] bg-canvas px-3 py-2">
      <dt className="text-[11px] text-ink3">{k}</dt>
      <dd className="text-[16px] font-semibold tabular">{v}</dd>
    </div>
  );
}
