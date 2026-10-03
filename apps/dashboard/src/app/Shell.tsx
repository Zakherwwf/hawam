import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarRange,
  Cat,
  ChartColumn,
  ChartSpline,
  Download,
  Footprints,
  LogOut,
  Map as MapIcon,
  Moon,
  PawPrint,
  Plus,
  Route as RouteIcon,
  Search,
  Sun,
  Users,
  Warehouse,
} from 'lucide-react';
import { supabase } from '../data/client';
import type { Me } from '../data/api';
import { useAnimals, useCore } from '../data/portal';
import { href } from '../lib/router';
import { readTheme, saveTheme, useDark } from '../lib/theme';
import { ROLE_LABEL } from '../lib/labels';
import { Avatar, AvatarStack, cx, Popover } from '../ui';
import { CommandPalette } from './CommandPalette';

export const NAV = [
  { page: 'overview', label: 'Overview', icon: ChartColumn, group: 'analyse' },
  { page: 'explore', label: 'Explore', icon: ChartSpline, group: 'analyse' },
  { page: 'timeline', label: 'Timeline', icon: CalendarRange, group: 'analyse' },
  { page: 'map', label: 'Map', icon: MapIcon, group: 'analyse' },
  { page: 'walks', label: 'Walks', icon: Footprints, group: 'records' },
  { page: 'sightings', label: 'Sightings', icon: PawPrint, group: 'records' },
  { page: 'animals', label: 'Animals', icon: Cat, group: 'records' },
  { page: 'routes', label: 'Routes', icon: RouteIcon, group: 'manage' },
  { page: 'people', label: 'People', icon: Users, group: 'manage' },
  { page: 'colonies', label: 'Colonies', icon: Warehouse, group: 'manage' },
  { page: 'exports', label: 'Exports', icon: Download, group: 'manage' },
] as const;
export type PageId = (typeof NAV)[number]['page'];

/**
 * Porcelain shell (reference board 2): a labelled icon rail on the start
 * side, a glass top bar with search, the active volunteers and the review
 * inbox, and the page on the cool grey shell. Mirrors fully in RTL.
 */
export function Shell({ me, page, children }: { me: Me; page: string; children: React.ReactNode }) {
  const [palette, setPalette] = useState(false);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      } else if (
        e.key === '/' &&
        !/input|textarea|select/i.test((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  return (
    <div className="min-h-[100dvh] lg:flex lg:gap-4 lg:p-4">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50 bg-surface px-4 py-2 rounded-full shadow-pill"
      >
        Skip to Content
      </a>
      <Rail page={page} />
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <TopBar me={me} onSearch={() => setPalette(true)} />
        <main
          id="main"
          tabIndex={-1}
          className="min-w-0 px-4 pb-24 lg:px-2 lg:pb-6 outline-none max-w-[1600px] w-full mx-auto"
        >
          {children}
        </main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}

function Rail({ page }: { page: string }) {
  const dark = useDark();
  return (
    <aside
      aria-label="Sections"
      className={cx(
        'z-30 lg:sticky lg:top-4 lg:h-[calc(100dvh-32px)] lg:w-[92px] lg:shrink-0',
        'fixed bottom-0 inset-x-0 lg:inset-auto glass lg:bg-surface lg:backdrop-blur-none rounded-t-card lg:rounded-card shadow-float lg:shadow-card',
        'flex lg:flex-col items-center'
      )}
    >
      <a
        href={href('overview')}
        className="hidden lg:grid place-items-center w-11 h-11 mt-3 mb-2 rounded-[14px] shrink-0 bg-accent text-on-accent"
        aria-label="Hawem research portal, overview"
      >
        <PawPrint aria-hidden className="w-6 h-6" />
      </a>
      <nav className="flex lg:flex-col gap-1 lg:gap-0.5 overflow-x-auto lg:overflow-y-auto scrollbar-none px-2 py-2 lg:py-0 w-full lg:items-center flex-1">
        {NAV.map(({ page: p, label, icon: Icon, group }, i) => {
          const on = p === page;
          const sep = i > 0 && NAV[i - 1].group !== group;
          return (
            <React.Fragment key={p}>
              {sep ? (
                <span aria-hidden className="hidden lg:block w-8 h-px bg-line my-1 shrink-0" />
              ) : null}
              <a
                href={href(p)}
                aria-current={on ? 'page' : undefined}
                className="group flex flex-col items-center gap-0.5 shrink-0 w-[68px] py-1 rounded-[14px]"
              >
                <span
                  className={cx(
                    'grid place-items-center w-11 h-10 lg:h-9 lg:w-11 rounded-full transition-[background-color,color,box-shadow] duration-150',
                    on
                      ? 'bg-pill text-on-pill'
                      : 'text-ink2 group-hover:bg-canvas group-hover:text-ink'
                  )}
                >
                  <Icon aria-hidden className="w-5 h-5" />
                </span>
                <span
                  className={cx(
                    'text-[11px] leading-none',
                    on ? 'font-semibold text-ink' : 'text-ink2'
                  )}
                >
                  {label}
                </span>
              </a>
            </React.Fragment>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={() => saveTheme(dark ? 'light' : 'dark')}
        aria-label={dark ? 'Use Light Appearance' : 'Use Dark Appearance'}
        title={readTheme() === 'system' ? 'Following the system appearance' : undefined}
        className="hidden lg:grid place-items-center w-11 h-11 rounded-full bg-canvas text-ink2 hover:text-ink mb-3 mt-1 shrink-0"
      >
        {dark ? <Sun aria-hidden className="w-5 h-5" /> : <Moon aria-hidden className="w-5 h-5" />}
      </button>
    </aside>
  );
}

function TopBar({ me, onSearch }: { me: Me; onSearch: () => void }) {
  const { walks, nameOf } = useCore();
  const { links } = useAnimals();
  const pending = (links.data ?? []).filter((l) => l.status === 'proposed').length;
  const recent = useMemo(() => {
    const since = Date.now() - 7 * 86400000;
    const seen = new Map<string, number>();
    for (const w of walks.data ?? []) {
      const t = new Date(w.start_time).getTime();
      if (t >= since) seen.set(w.observer_id, (seen.get(w.observer_id) ?? 0) + 1);
    }
    return [...seen.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => ({ id, name: nameOf(id) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walks.data]);
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="sticky top-0 lg:top-4 z-20 mx-0 lg:mx-0 glass lg:rounded-card shadow-card px-3 sm:px-4 h-[72px] flex items-center gap-3">
      <a
        href={href('overview')}
        className="lg:hidden grid place-items-center w-10 h-10 rounded-[14px] bg-accent text-on-accent shrink-0"
        aria-label="Overview"
      >
        <PawPrint aria-hidden className="w-5 h-5" />
      </a>
      <button
        type="button"
        onClick={onSearch}
        className="flex items-center gap-2.5 h-11 ps-4 pe-2 rounded-full bg-surface shadow-pill text-ink3 text-[14px] min-w-0 flex-1 max-w-[420px] hover:text-ink2"
      >
        <Search aria-hidden className="w-[18px] h-[18px] shrink-0" />
        <span className="truncate flex-1 text-start">Search walks, animals, people, routes…</span>
        <kbd
          className="hidden sm:inline-flex items-center h-7 px-2 rounded-full bg-canvas text-[12px] font-semibold text-ink2 font-sans"
          translate="no"
        >
          {mac ? '⌘' : 'Ctrl'}&nbsp;K
        </kbd>
      </button>
      <div className="flex-1 hidden md:block" />
      {recent.length ? (
        <div
          className="hidden xl:flex items-center gap-3"
          title="Volunteers who walked in the last 7 days"
        >
          <span className="text-[12px] text-ink2 text-end leading-tight">
            Active this
            <br />
            week
          </span>
          <AvatarStack people={recent} max={5} href={(id) => href(`people/${id}`)} />
        </div>
      ) : null}
      {me.role === 'admin' || me.role === 'researcher' ? (
        <a
          href={href('routes/new')}
          className="hidden md:inline-flex items-center gap-2 h-11 px-4 rounded-full bg-surface shadow-pill text-[14px] font-semibold hover:bg-raised whitespace-nowrap"
        >
          <Plus aria-hidden className="w-[18px] h-[18px]" />
          New Route
        </a>
      ) : null}
      <a
        href={href('animals')}
        aria-label={pending ? `${pending} resightings to review` : 'Review inbox, empty'}
        title="Resightings to review"
        className="relative grid place-items-center w-11 h-11 rounded-full bg-surface shadow-pill text-ink2 hover:text-ink shrink-0"
      >
        <Bell aria-hidden className="w-[18px] h-[18px]" />
        {pending ? (
          <span className="absolute -top-0.5 -end-0.5 min-w-5 h-5 px-1 rounded-full bg-danger text-white text-[11px] font-bold grid place-items-center tabular">
            {pending > 99 ? '99+' : pending}
          </span>
        ) : null}
      </a>
      <Popover
        label="Account"
        align="end"
        width={260}
        trigger={({ open, toggle, id }) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={id}
            aria-label="Account"
            className="rounded-full shrink-0 ring-2 ring-surface shadow-pill"
          >
            <Avatar id={me.id} name={me.display_name || me.email} size={44} />
          </button>
        )}
      >
        {() => (
          <div className="p-2">
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar id={me.id} name={me.display_name || me.email} size={40} />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold truncate">
                  {me.display_name || 'Researcher'}
                </p>
                <p className="text-[12px] text-ink2 truncate">{me.email}</p>
                <p className="text-[12px] text-ink3">{ROLE_LABEL[me.role]}</p>
              </div>
            </div>
            <a
              href={href(`people/${me.id}`)}
              className="flex items-center gap-2 h-10 px-2 rounded-[10px] text-[14px] hover:bg-canvas"
            >
              <Users aria-hidden className="w-4 h-4 text-ink2" />
              My Profile
            </a>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="w-full flex items-center gap-2 h-10 px-2 rounded-[10px] text-[14px] text-danger hover:bg-danger-soft"
            >
              <LogOut aria-hidden className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}
      </Popover>
    </header>
  );
}
