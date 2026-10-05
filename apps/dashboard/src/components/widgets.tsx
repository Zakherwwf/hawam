import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Cat,
  Footprints,
  PawPrint,
  Route as RouteIcon,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import {
  photoUrl,
  type Individual,
  type Link,
  type Photo,
  type RouteRow,
  type Sighting,
  type Walk,
} from '../data/api';
import { useCore } from '../data/portal';
import {
  applyFilters,
  previousWindow,
  readFilters,
  type Filters,
  type RangePreset,
} from '../lib/filters';
import { fmtDateTime, fmtInt, fmtKm } from '../lib/format';
import { href } from '../lib/router';
import { SIDE_LABEL, speciesTone, SPECIES_LABEL } from '../lib/labels';
import { REASON_LABEL } from '../lib/stats';
import { Avatar, Badge, cx } from '../ui';

export function StatusBadge({
  w,
}: {
  w: Pick<Walk, 'validation_status' | 'complete_session' | 'protocol'>;
}) {
  if (w.validation_status === 'flagged')
    return (
      <Badge tone="warn" dot>
        Flagged
      </Badge>
    );
  if (w.protocol === 'incidental') return <Badge>Quick</Badge>;
  return w.complete_session ? (
    <Badge tone="accent" dot>
      Complete
    </Badge>
  ) : (
    <Badge>Partial</Badge>
  );
}

export function SpeciesBadge({ s }: { s: string }) {
  return <Badge tone={speciesTone(s)}>{SPECIES_LABEL[s] ?? s}</Badge>;
}

export function PersonChip({
  id,
  name,
  sub,
  size = 32,
}: {
  id: string;
  name: string;
  sub?: string;
  size?: number;
}) {
  return (
    <a href={href(`people/${id}`)} className="inline-flex items-center gap-2.5 min-w-0 group">
      <Avatar id={id} name={name} size={size} />
      <span className="min-w-0">
        <span className="block truncate font-medium group-hover:underline">{name}</span>
        {sub ? <span className="block text-[12px] text-ink3 truncate">{sub}</span> : null}
      </span>
    </a>
  );
}

export const reasons = (w: Walk) =>
  w.validation_reasons.map((r) => REASON_LABEL[r] ?? r).join(', ');

/**
 * The filtered slice for a page, plus the same-length window before it for
 * deltas. Walks with no route or volunteer match are dropped; species only
 * filters sightings (a walk is effort for every species).
 */
export function useSlice(params: URLSearchParams, fallback: RangePreset = '90d') {
  const core = useCore();
  const f = useMemo(() => readFilters(params, fallback), [params, fallback]);
  const cur = useMemo(
    () =>
      core.ready
        ? applyFilters(core.walks.data!, core.sightings.data!, f)
        : { walks: [], sightings: [] },
    [core.ready, core.walks.data, core.sightings.data, f]
  );
  const prev = useMemo(() => {
    const pw = previousWindow(f);
    if (!core.ready || !pw) return null;
    return applyFilters(core.walks.data!, core.sightings.data!, { ...f, ...pw });
  }, [core.ready, core.walks.data, core.sightings.data, f]);
  const window = useMemo(() => {
    const now = new Date();
    const to = f.to ?? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    let from = f.from;
    if (!from) {
      const first = core.walks.data?.reduce<number>(
        (m, w) => Math.min(m, new Date(w.start_time).getTime()),
        Date.now()
      );
      from = new Date(first ?? Date.now() - 90 * 86400000);
    }
    return { from, to };
  }, [f, core.walks.data]);
  return { core, f, ...cur, prev, window };
}

export type Activity = {
  id: string;
  at: string;
  kind: 'walk' | 'flagged' | 'zero' | 'sighting' | 'animal' | 'confirmed' | 'route' | 'welfare';
  title: string;
  detail?: string;
  who?: string | null;
  href: string;
};

/** A readable stream of what happened, newest first. */
export function buildActivity({
  walks,
  sightings,
  individuals = [],
  links = [],
  routes = [],
  nameOf,
  limit = 40,
}: {
  walks: Walk[];
  sightings: Sighting[];
  individuals?: Individual[];
  links?: Link[];
  routes?: RouteRow[];
  nameOf: (id: string | null | undefined) => string;
  limit?: number;
}): Activity[] {
  const per = new Map<string, number>();
  for (const s of sightings)
    per.set(s.session_id, (per.get(s.session_id) ?? 0) + (s.group_size || 1));
  const out: Activity[] = [];
  for (const w of walks) {
    const n = per.get(w.id) ?? 0;
    const flagged = w.validation_status === 'flagged';
    const zero = !flagged && w.complete_session && w.protocol !== 'incidental' && n === 0;
    out.push({
      id: `w${w.id}`,
      at: w.start_time,
      kind: flagged ? 'flagged' : zero ? 'zero' : 'walk',
      title:
        w.protocol === 'incidental'
          ? `${nameOf(w.observer_id)} logged a quick sighting`
          : `${nameOf(w.observer_id)} ${w.protocol === 'stationary_point' ? 'did a point count' : `walked ${fmtKm(w.distance_km ?? 0)} km`}`,
      detail: flagged
        ? `Flagged: ${reasons(w)}`
        : zero
          ? 'Complete checklist with no animals: a recorded absence'
          : `${fmtInt(n)} ${n === 1 ? 'animal' : 'animals'}${w.complete_session ? ', complete checklist' : ''}`,
      who: w.observer_id,
      href: href(`walks/${w.id}`),
    });
  }
  for (const s of sightings)
    if (s.is_welfare_alert)
      out.push({
        id: `s${s.id}`,
        at: s.observed_at,
        kind: 'welfare',
        title: `Welfare alert on ${s.public_code}`,
        detail: s.notes ?? `${SPECIES_LABEL[s.species]} needs attention`,
        who: s.observer_id,
        href: href(`sightings/${s.id}`),
      });
  for (const i of individuals)
    out.push({
      id: `i${i.id}`,
      at: i.created_at,
      kind: 'animal',
      title: `New known animal: ${i.nickname || `unnamed ${i.species}`}`,
      who: i.created_by,
      href: href(`animals/${i.id}`),
    });
  for (const l of links)
    if (l.status === 'confirmed' && !l.is_founder && l.reviewed_at)
      out.push({
        id: `l${l.id}`,
        at: l.reviewed_at,
        kind: 'confirmed',
        title: `Resighting confirmed for ${individuals.find((i) => i.id === l.individual_id)?.nickname || 'a known animal'}`,
        href: href(`animals/${l.individual_id}`),
      });
  for (const r of routes)
    out.push({
      id: `r${r.id}`,
      at: r.deleted_at ?? r.updated_at ?? r.created_at,
      kind: 'route',
      title: r.deleted_at
        ? `Route archived: ${r.name}`
        : r.updated_at
          ? `Route updated to version ${r.version ?? 1}: ${r.name}`
          : `New route: ${r.name}`,
      href: href(`routes/${r.id}`),
    });
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

const ACT_ICON = {
  walk: Footprints,
  flagged: ShieldAlert,
  zero: CheckCircle2,
  sighting: PawPrint,
  animal: Cat,
  confirmed: Sparkles,
  route: RouteIcon,
  welfare: ShieldAlert,
};

export function ActivityList({
  items,
  nameOf,
}: {
  items: Activity[];
  nameOf: (id: string) => string;
}) {
  return (
    <ol className="flex flex-col">
      {items.map((a) => {
        const Icon = ACT_ICON[a.kind];
        return (
          <li key={a.id}>
            <a
              href={a.href}
              className="flex items-start gap-3 py-3 px-2 -mx-2 rounded-[14px] hover:bg-canvas"
            >
              {a.who ? (
                <span className="relative shrink-0">
                  <Avatar id={a.who} name={nameOf(a.who)} size={36} />
                  <span
                    className={cx(
                      'absolute -bottom-1 -end-1 w-5 h-5 rounded-full grid place-items-center ring-2 ring-surface',
                      a.kind === 'flagged' || a.kind === 'welfare'
                        ? 'bg-warm-soft text-warm-ink'
                        : 'bg-canvas text-ink2'
                    )}
                  >
                    <Icon aria-hidden className="w-3 h-3" />
                  </span>
                </span>
              ) : (
                <span className="w-9 h-9 rounded-full bg-canvas text-ink2 grid place-items-center shrink-0">
                  <Icon aria-hidden className="w-4 h-4" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium leading-snug">{a.title}</span>
                {a.detail ? (
                  <span className="block text-[13px] text-ink2 truncate">{a.detail}</span>
                ) : null}
              </span>
              <time
                dateTime={a.at}
                className="text-[12px] text-ink3 whitespace-nowrap shrink-0 tabular"
              >
                {fmtDateTime(a.at)}
              </time>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

export function PhotoTile({
  photo,
  label,
  className,
  caption = true,
}: {
  photo?: Photo;
  label: string;
  className?: string;
  caption?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (photo) photoUrl(photo.storage_path).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
    // The signed URL depends only on the storage path
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.storage_path]);
  return (
    <figure className="m-0 min-w-0">
      <div
        className={cx(
          'w-full rounded-tile bg-canvas overflow-hidden grid place-items-center',
          className ?? 'h-[160px]'
        )}
      >
        {url ? (
          <img
            src={url}
            alt={label}
            width={480}
            height={360}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-[13px] text-ink3">{photo ? 'Loading photo…' : 'No photo'}</span>
        )}
      </div>
      {photo && caption ? (
        <figcaption className="text-[12px] text-ink2 mt-1.5">{SIDE_LABEL[photo.angle]}</figcaption>
      ) : null}
    </figure>
  );
}

/** Filters out of a Filters object, for a link that carries them along. */
export function filterParams(f: Filters): Record<string, string | null> {
  return {
    sp: f.species.join(',') || null,
    proto: f.protocol,
    status: f.status,
    who: f.who,
    route: f.route,
  };
}
