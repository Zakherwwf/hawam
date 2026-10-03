import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Cat,
  CornerDownLeft,
  Footprints,
  PawPrint,
  Route as RouteIcon,
  Search,
  Users,
  Warehouse,
} from 'lucide-react';
import { getColonies } from '../data/api';
import { useAnimals, useCore } from '../data/portal';
import { useData } from '../data/useData';
import { fmtDateTime } from '../lib/format';
import { href } from '../lib/router';
import { ROLE_LABEL } from '../lib/labels';
import { NAV } from './Shell';
import { Avatar, cx } from '../ui';

interface Hit {
  id: string;
  group: string;
  title: string;
  detail?: string;
  href: string;
  icon: React.ReactNode;
}

/**
 * Command palette (cmd/ctrl K or "/"): jump to any page or record. Searches
 * people, known animals, routes, colonies, sighting codes and walks by
 * volunteer or date, all from data already loaded for the visit.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const { walks, sightings, users, routes, nameOf } = useCore();
  const { individuals } = useAnimals();
  const colonies = useData('colonies', getColonies);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const n = q.trim().toLowerCase();
    const has = (s: string | null | undefined) => !!s && s.toLowerCase().includes(n);
    const out: Hit[] = [];
    for (const p of NAV)
      if (!n || has(p.label))
        out.push({
          id: `p-${p.page}`,
          group: 'Pages',
          title: p.label,
          href: href(p.page),
          icon: <p.icon aria-hidden className="w-4 h-4" />,
        });
    if (!n) return out;
    for (const u of users.data ?? [])
      if (has(u.display_name))
        out.push({
          id: `u-${u.id}`,
          group: 'People',
          title: u.display_name || 'Unnamed volunteer',
          detail: ROLE_LABEL[u.role],
          href: href(`people/${u.id}`),
          icon: <Avatar id={u.id} name={u.display_name} size={22} />,
        });
    for (const a of individuals.data ?? [])
      if (has(a.nickname) || has(`unnamed ${a.species}`) || has(a.coat_pattern))
        out.push({
          id: `a-${a.id}`,
          group: 'Known animals',
          title: a.nickname || `Unnamed ${a.species}`,
          detail: `${a.sightings_count} confirmed sightings`,
          href: href(`animals/${a.id}`),
          icon: <Cat aria-hidden className="w-4 h-4" />,
        });
    for (const r of routes.data ?? [])
      if (has(r.name) || has(r.delegation))
        out.push({
          id: `r-${r.id}`,
          group: 'Routes',
          title: r.name,
          detail: [r.delegation, r.deleted_at ? 'archived' : r.is_active ? 'live' : 'off']
            .filter(Boolean)
            .join(', '),
          href: href(`routes/${r.id}`),
          icon: <RouteIcon aria-hidden className="w-4 h-4" />,
        });
    for (const c of colonies.data ?? [])
      if (has(c.name) || has(c.area))
        out.push({
          id: `c-${c.id}`,
          group: 'Colonies',
          title: c.name || 'Unnamed colony',
          detail: c.area ?? undefined,
          href: href('colonies', { c: c.id }),
          icon: <Warehouse aria-hidden className="w-4 h-4" />,
        });
    let s = 0;
    for (const x of sightings.data ?? []) {
      if (s > 8) break;
      if (has(x.public_code)) {
        s++;
        out.push({
          id: `s-${x.id}`,
          group: 'Sightings',
          title: x.public_code,
          detail: `${x.species}, ${fmtDateTime(x.observed_at)}, ${x.observer_name ?? 'Anonymous'}`,
          href: href(`sightings/${x.id}`),
          icon: <PawPrint aria-hidden className="w-4 h-4" />,
        });
      }
    }
    let w = 0;
    for (const x of walks.data ?? []) {
      if (w > 8) break;
      const when = fmtDateTime(x.start_time);
      if (has(nameOf(x.observer_id)) || has(when)) {
        w++;
        out.push({
          id: `w-${x.id}`,
          group: 'Walks',
          title: `${nameOf(x.observer_id)}, ${when}`,
          detail: `${x.distance_km?.toFixed(2) ?? 0} km`,
          href: href(`walks/${x.id}`),
          icon: <Footprints aria-hidden className="w-4 h-4" />,
        });
      }
    }
    return out.slice(0, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, users.data, individuals.data, routes.data, colonies.data, sightings.data, walks.data]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>(`[data-i="${sel}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!open) return null;
  const go = (h: Hit) => {
    window.location.hash = h.href.replace(/^#/, '');
    onClose();
  };
  let last = '';
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
      <button
        aria-label="Close search"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative w-full max-w-[620px] bg-surface rounded-card shadow-float overflow-hidden rise"
      >
        <div className="flex items-center gap-3 px-5 h-16 border-b border-line">
          <Search aria-hidden className="w-5 h-5 text-ink3" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel((i) => Math.min(hits.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter' && hits[sel]) go(hits[sel]);
              else if (e.key === 'Escape') onClose();
            }}
            type="search"
            name="portal-search"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search the portal"
            aria-controls="palette-results"
            aria-activedescendant={hits[sel] ? `hit-${hits[sel].id}` : undefined}
            placeholder="Type a name, a code like CAT-000123, a route…"
            className="flex-1 bg-transparent text-[17px] outline-none placeholder:text-ink3"
          />
          <kbd className="text-[12px] text-ink3 font-sans">Esc</kbd>
        </div>
        <ul
          ref={list}
          id="palette-results"
          role="listbox"
          aria-label="Results"
          className="max-h-[56vh] overflow-y-auto p-2"
        >
          {hits.length === 0 ? (
            <li className="px-4 py-10 text-center text-[14px] text-ink2">
              Nothing matches “{q}”. Try a shorter word.
            </li>
          ) : (
            hits.map((h, i) => {
              const header = h.group !== last;
              last = h.group;
              return (
                <li key={h.id} role="presentation">
                  {header ? (
                    <p className="px-3 pt-3 pb-1 text-[12px] font-semibold text-ink3">{h.group}</p>
                  ) : null}
                  <a
                    id={`hit-${h.id}`}
                    role="option"
                    aria-selected={i === sel}
                    data-i={i}
                    href={h.href}
                    onClick={onClose}
                    onMouseMove={() => setSel(i)}
                    className={cx(
                      'flex items-center gap-3 h-11 px-3 rounded-[12px] text-[14px]',
                      i === sel ? 'bg-canvas' : ''
                    )}
                  >
                    <span className="w-6 grid place-items-center text-ink2 shrink-0">{h.icon}</span>
                    <span className="font-medium truncate">{h.title}</span>
                    {h.detail ? (
                      <span className="text-ink3 truncate text-[13px]">{h.detail}</span>
                    ) : null}
                    {i === sel ? (
                      <CornerDownLeft aria-hidden className="w-4 h-4 text-ink3 ms-auto shrink-0" />
                    ) : null}
                  </a>
                </li>
              );
            })
          )}
        </ul>
        <div className="flex items-center gap-2 px-5 py-2.5 border-t border-line text-[12px] text-ink3">
          <Users aria-hidden className="w-3.5 h-3.5" /> Use the arrow keys to move, Enter to open.
        </div>
      </div>
    </div>
  );
}
