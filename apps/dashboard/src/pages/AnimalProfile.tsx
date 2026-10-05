import { useMemo, useState } from 'react';
import { Cat } from 'lucide-react';
import { getPhotos, reviewLink, type Sighting } from '../data/api';
import { useAnimals, useCore } from '../data/portal';
import { invalidate, useData } from '../data/useData';
import { fmtAgo, fmtDate, fmtDateTime, fmtDec, fmtInt, fmtWeek } from '../lib/format';
import { weekStart } from '../lib/geo';
import { href } from '../lib/router';
import { BCS_LABEL, COAT_LABEL, SIDE_LABEL, SPECIES_LABEL } from '../lib/labels';
import { useDark } from '../lib/theme';
import { MapView, type MapLine, type MapPoint } from '../components/LazyMap';
import { PersonChip, PhotoTile, SpeciesBadge } from '../components/widgets';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  cx,
  EmptyState,
  LinkButton,
  PageHeader,
  Segmented,
  Skeleton,
} from '../ui';
import { animalName, metres } from './Animals';
import type { PageProps } from './types';

/** Area of the minimum convex polygon around the points, in square metres. */
function mcpArea(pts: [number, number][]) {
  if (pts.length < 3) return 0;
  const o = pts[0];
  const k = Math.cos((o[1] * Math.PI) / 180);
  const xy = pts
    .map(([x, y]) => [(x - o[0]) * 111320 * k, (y - o[1]) * 110540] as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a: number[], b: number[], c: number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const lower: [number, number][] = [];
  for (const p of xy) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (const p of [...xy].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  let a = 0;
  for (let i = 0; i < hull.length; i++) {
    const [x1, y1] = hull[i];
    const [x2, y2] = hull[(i + 1) % hull.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

export function AnimalProfile({ id }: PageProps) {
  const core = useCore();
  const dark = useDark();
  const { individuals, links } = useAnimals();
  const a = individuals.data?.find((i) => i.id === id);
  const mine = useMemo(
    () =>
      (links.data ?? [])
        .filter((l) => l.individual_id === id)
        .sort((x, y) => x.created_at.localeCompare(y.created_at)),
    [links.data, id]
  );
  const obsById = useMemo(
    () => new Map((core.sightings.data ?? []).map((s) => [s.id, s])),
    [core.sightings.data]
  );
  const photos = useData(`photos:animal:${id}:${mine.length}`, () =>
    getPhotos(mine.map((l) => l.observation_id))
  );
  const [angle, setAngle] = useState<'all' | 'left_flank' | 'right_flank' | 'face'>('all');
  const [busy, setBusy] = useState<string | null>(null);

  const confirmed = mine
    .filter((l) => l.status === 'confirmed')
    .map((l) => obsById.get(l.observation_id))
    .filter((s): s is Sighting => !!s);
  const pending = mine.filter((l) => l.status === 'proposed');
  const rejected = mine.filter((l) => l.status === 'rejected');
  const stats = useMemo(() => {
    const pts = confirmed.map((s) => [s.longitude, s.latitude] as [number, number]);
    let maxD = 0;
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++)
        maxD = Math.max(maxD, metres([pts[i][1], pts[i][0]], [pts[j][1], pts[j][0]]));
    const bcs = confirmed.filter((s) => s.body_condition_score != null);
    return {
      maxD,
      area: mcpArea(pts),
      bcs: bcs.length ? bcs.reduce((x, s) => x + s.body_condition_score!, 0) / bcs.length : null,
      observers: [...new Set(confirmed.map((s) => s.observer_id))],
    };
  }, [confirmed]);

  // Capture history: one cell per week from first sighting to now; filled when confirmed that week,
  // hollow when someone surveyed but did not see it (an unflagged walk within 300 m of its range).
  const history = useMemo(() => {
    if (!a?.first_seen) return [];
    const start = weekStart(new Date(a.first_seen));
    const end = weekStart(new Date());
    const seen = new Set(confirmed.map((s) => weekStart(new Date(s.observed_at)).getTime()));
    const centre = confirmed.length
      ? [
          confirmed.reduce((x, s) => x + s.longitude, 0) / confirmed.length,
          confirmed.reduce((x, s) => x + s.latitude, 0) / confirmed.length,
        ]
      : null;
    const surveyed = new Set<number>();
    if (centre)
      for (const s of core.sightings.data ?? [])
        if (metres([s.latitude, s.longitude], [centre[1], centre[0]]) < 300)
          surveyed.add(weekStart(new Date(s.observed_at)).getTime());
    const out: { t: Date; state: 'seen' | 'surveyed' | 'none' }[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
      const k = d.getTime();
      out.push({
        t: new Date(d),
        state: seen.has(k) ? 'seen' : surveyed.has(k) ? 'surveyed' : 'none',
      });
    }
    return out;
  }, [a?.first_seen, confirmed, core.sightings.data]);

  if (!individuals.data || !core.ready) return <Skeleton className="h-[640px]" />;
  if (!a)
    return (
      <Card>
        <EmptyState
          icon={<Cat />}
          title="Animal not found"
          body="It may have been merged or deleted."
          action={
            <LinkButton href={href('animals', { view: 'all' })}>Back to Known Animals</LinkButton>
          }
        />
      </Card>
    );

  const shownPhotos = (photos.data ?? []).filter((p) => angle === 'all' || p.angle === angle);
  const days = a.first_seen
    ? Math.max(1, Math.round((Date.now() - new Date(a.first_seen).getTime()) / 86400000))
    : 0;
  const path = [...confirmed].sort((x, y) => x.observed_at.localeCompare(y.observed_at));
  const points: MapPoint[] = [
    ...path.map((s, i) => ({
      id: s.id,
      lon: s.longitude,
      lat: s.latitude,
      kind: i === path.length - 1 ? ('animal' as const) : s.species,
      label: `${s.public_code}, ${fmtDate(s.observed_at)}`,
      href: `#/sightings/${s.id}`,
    })),
    ...pending
      .map((l) => obsById.get(l.observation_id))
      .filter((s): s is Sighting => !!s)
      .map((s) => ({
        id: s.id,
        lon: s.longitude,
        lat: s.latitude,
        kind: 'unknown' as const,
        label: `${s.public_code} (to review)`,
        href: `#/sightings/${s.id}`,
      })),
  ];
  const lines: MapLine[] =
    path.length > 1
      ? [
          {
            id: 'path',
            coords: path.map((s) => [s.longitude, s.latitude]),
            kind: 'path',
            arrows: true,
            label: 'Movement between confirmed sightings',
          },
        ]
      : [];
  const decide = async (linkId: string, status: 'confirmed' | 'rejected') => {
    setBusy(linkId);
    try {
      await reviewLink(linkId, status);
      invalidate('links');
      invalidate('individuals');
      await Promise.all([links.reload(), individuals.reload()]);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        back={{ href: href('animals', { view: 'all' }), label: 'Known Animals' }}
        eyebrow={
          <div className="flex flex-wrap gap-2">
            <SpeciesBadge s={a.species} />
            {a.coat_pattern ? <Badge>{COAT_LABEL[a.coat_pattern] ?? a.coat_pattern}</Badge> : null}
            {pending.length ? <Badge tone="warn" dot>{`${pending.length} to review`}</Badge> : null}
          </div>
        }
        title={animalName(a)}
        description={`Followed for ${fmtInt(days)} days: ${fmtInt(confirmed.length)} confirmed ${confirmed.length === 1 ? 'sighting' : 'sightings'} by ${fmtInt(stats.observers.length)} ${stats.observers.length === 1 ? 'volunteer' : 'volunteers'}. Last seen ${fmtAgo(a.last_seen)}.`}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3 px-1">
            <h2 className="text-[17px] font-semibold flex-1">
              Photos ({fmtInt(photos.data?.length ?? 0)})
            </h2>
            <Segmented
              size="sm"
              label="Photo angle"
              value={angle}
              onChange={setAngle}
              options={[
                { value: 'all', label: 'All' },
                { value: 'left_flank', label: 'Left' },
                { value: 'right_flank', label: 'Right' },
                { value: 'face', label: 'Face' },
              ]}
            />
          </div>
          {photos.loading && !photos.data ? (
            <Skeleton className="h-[360px]" />
          ) : shownPhotos.length ? (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
              {shownPhotos.slice(0, 9).map((p, i) => (
                <div key={p.id} className={i === 0 ? 'col-span-2 row-span-2' : ''}>
                  <PhotoTile
                    photo={p}
                    label={`${animalName(a)}, ${SIDE_LABEL[p.angle]}`}
                    className={i === 0 ? 'h-[300px]' : 'h-[144px]'}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState compact icon={<Cat />} title="No photos for this angle" />
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Tile k="First seen" v={a.first_seen ? fmtDate(a.first_seen) : '-'} />
            <Tile
              k="Last seen"
              v={a.last_seen ? fmtDate(a.last_seen) : '-'}
              sub={fmtAgo(a.last_seen)}
            />
            <Tile
              k="Farthest apart"
              v={`${fmtInt(stats.maxD)} m`}
              sub="Between two confirmed sightings"
            />
            <Tile
              k="Range (MCP)"
              v={
                stats.area >= 10000
                  ? `${fmtDec(stats.area / 10000, 2)} ha`
                  : `${fmtInt(stats.area)} m²`
              }
              sub={confirmed.length < 3 ? 'Needs 3 or more sightings' : 'Minimum convex polygon'}
            />
            <Tile
              k="Mean body condition"
              v={stats.bcs == null ? 'Not assessed' : fmtDec(stats.bcs, 1)}
              sub={stats.bcs == null ? undefined : BCS_LABEL[Math.round(stats.bcs)]}
            />
            <Tile
              k="Links"
              v={`${fmtInt(confirmed.length)} confirmed`}
              sub={`${fmtInt(pending.length)} to review, ${fmtInt(rejected.length)} rejected`}
            />
          </div>
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold mb-3">Seen by</h2>
            <ul className="flex flex-col gap-3">
              {stats.observers.map((o) => (
                <li key={o} className="flex items-center gap-3">
                  <PersonChip id={o} name={core.nameOf(o)} size={32} />
                  <span className="ms-auto text-[13px] text-ink2 tabular">
                    {fmtInt(confirmed.filter((s) => s.observer_id === o).length)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Capture history"
          description="One cell per week since first seen. Filled: confirmed sighting. Ring: someone recorded animals within 300 m but not this one. Empty: no records nearby."
        />
        <div className="px-6 pb-6 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {history.map((h) => (
              <span
                key={h.t.getTime()}
                title={`Week of ${fmtWeek(h.t)}: ${h.state === 'seen' ? 'seen' : h.state === 'surveyed' ? 'surveyed, not seen' : 'no records nearby'}`}
                className={cx(
                  'w-4 h-8 rounded-[5px]',
                  h.state === 'seen'
                    ? 'bg-pill'
                    : h.state === 'surveyed'
                      ? 'ring-2 ring-inset ring-ink3 bg-surface'
                      : 'bg-canvas'
                )}
              />
            ))}
          </div>
          {history.length ? (
            <div className="flex justify-between text-[11px] text-ink3 mt-1.5 min-w-max">
              <span>{fmtWeek(history[0].t)}</span>
              <span>{fmtWeek(history[history.length - 1].t)}</span>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 mt-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card className="p-2">
          <MapView
            points={points}
            lines={lines}
            dark={dark}
            height={440}
            label={`Where ${animalName(a)} was seen, in order`}
          />
          <p className="px-4 py-3 text-[12px] text-ink2">
            Purple line: movement between confirmed sightings in date order, last position in
            purple. Grey: sightings waiting for review.
          </p>
        </Card>
        <Card>
          <CardHeader
            title="Encounters"
            description="Every link proposed for this animal, newest first."
          />
          <ol className="px-6 pb-5 flex flex-col">
            {[...mine].reverse().map((l) => {
              const s = obsById.get(l.observation_id);
              return (
                <li
                  key={l.id}
                  className="flex items-start gap-3 py-3 border-t border-line first:border-t-0"
                >
                  {s ? <Avatar id={s.observer_id} name={s.observer_name} size={32} /> : null}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cx(
                        'text-[14px] font-medium',
                        l.status === 'rejected' && 'line-through text-ink3'
                      )}
                    >
                      {s ? (
                        <a
                          href={href(`sightings/${s.id}`)}
                          className="hover:underline"
                          translate="no"
                        >
                          {s.public_code}
                        </a>
                      ) : (
                        'Sighting'
                      )}
                      {l.is_founder ? (
                        <span className="text-ink2 font-normal">, first registration</span>
                      ) : null}
                    </p>
                    <p className="text-[12px] text-ink2">
                      {s ? `${fmtDateTime(s.observed_at)}, ${s.observer_name ?? 'Anonymous'}` : ''}
                      {l.decision === 'unsure' ? ', volunteer unsure' : ''}
                    </p>
                    {l.status === 'proposed' ? (
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          kind="dark"
                          disabled={busy === l.id}
                          onClick={() => decide(l.id, 'confirmed')}
                        >
                          Same Animal
                        </Button>
                        <Button
                          size="sm"
                          kind="danger"
                          disabled={busy === l.id}
                          onClick={() => decide(l.id, 'rejected')}
                        >
                          Different
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <Badge
                    tone={
                      l.status === 'confirmed'
                        ? 'accent'
                        : l.status === 'proposed'
                          ? 'warn'
                          : 'neutral'
                    }
                    dot
                  >
                    {l.status === 'confirmed'
                      ? 'Confirmed'
                      : l.status === 'proposed'
                        ? 'To review'
                        : 'Rejected'}
                  </Badge>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>
      <p className="text-[12px] text-ink3 mt-6">
        {SPECIES_LABEL[a.species]} registered {fmtDate(a.created_at)}. Range and distances describe
        where volunteers saw it, which depends on where they walked; they are not a home-range
        estimate.
      </p>
    </>
  );
}

function Tile({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="bg-surface rounded-card shadow-card p-5 min-w-0">
      <p className="text-[12px] text-ink3">{k}</p>
      <p className="text-[22px] font-semibold leading-tight mt-1 truncate">{v}</p>
      {sub ? <p className="text-[12px] text-ink2 mt-1 truncate">{sub}</p> : null}
    </div>
  );
}
