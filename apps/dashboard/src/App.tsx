import { useEffect, useState } from 'react';
import {
  ChartColumn,
  Download,
  Footprints,
  LogOut,
  Map as MapIcon,
  Moon,
  PawPrint,
  Route as RouteIcon,
  Sun,
  Users,
  Warehouse,
} from 'lucide-react';
import { supabase } from './data/client';
import { getMe, type Me } from './data/api';
import { href, useRoute } from './lib/router';
import { readTheme, saveTheme } from './lib/theme';
import { cx, Skeleton } from './ui';
import { SignIn } from './pages/SignIn';
import { NoAccess } from './pages/NoAccess';
import { Overview } from './pages/Overview';
import { MapPage } from './pages/MapPage';
import { Walks } from './pages/Walks';
import { Sightings } from './pages/Sightings';
import { Routes } from './pages/Routes';
import { Colonies } from './pages/Colonies';
import { Volunteers } from './pages/Volunteers';
import { Exports } from './pages/Exports';

const NAV = [
  { page: 'overview', label: 'Overview', icon: ChartColumn },
  { page: 'map', label: 'Map', icon: MapIcon },
  { page: 'walks', label: 'Walks', icon: Footprints },
  { page: 'sightings', label: 'Sightings', icon: PawPrint },
  { page: 'routes', label: 'Routes', icon: RouteIcon },
  { page: 'colonies', label: 'Colonies', icon: Warehouse },
  { page: 'volunteers', label: 'Volunteers', icon: Users },
  { page: 'exports', label: 'Exports', icon: Download },
] as const;

export default function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const route = useRoute();

  useEffect(() => {
    getMe().then(setMe);
    const { data } = supabase.auth.onAuthStateChange(() => getMe().then(setMe));
    return () => data.subscription.unsubscribe();
  }, []);

  if (me === undefined) {
    return (
      <div className="min-h-screen grid place-items-center" aria-busy="true">
        <Skeleton className="w-48 h-6" />
      </div>
    );
  }
  if (!me) return <SignIn />;
  if (me.role !== 'researcher' && me.role !== 'admin') return <NoAccess me={me} />;

  const page = NAV.some((n) => n.page === route.page) ? route.page : 'overview';
  const Page = {
    overview: Overview,
    map: MapPage,
    walks: Walks,
    sightings: Sightings,
    routes: Routes,
    colonies: Colonies,
    volunteers: Volunteers,
    exports: Exports,
  }[page]!;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 bg-surface px-4 py-2 rounded-full shadow-card"
      >
        Skip to content
      </a>
      <aside className="lg:sticky lg:top-0 lg:h-screen bg-surface lg:border-r border-b lg:border-b-0 border-line flex lg:flex-col">
        <div className="hidden lg:flex items-center gap-2.5 px-5 h-16">
          <span
            aria-hidden
            className="w-8 h-8 rounded-[10px] bg-accent text-on-accent grid place-items-center"
          >
            <PawPrint className="w-4.5 h-4.5" />
          </span>
          <div className="leading-tight">
            <p className="font-bold text-[15px]" translate="no">
              Hawem
            </p>
            <p className="text-[12px] text-ink2">Research portal</p>
          </div>
        </div>
        <nav
          aria-label="Sections"
          className="flex-1 flex lg:flex-col gap-1 px-3 py-2 overflow-x-auto"
        >
          {NAV.map(({ page: p, label, icon: Icon }) => {
            const on = p === page;
            return (
              <a
                key={p}
                href={href(p)}
                aria-current={on ? 'page' : undefined}
                className={cx(
                  'flex items-center gap-3 h-10 px-3 rounded-control text-[14px] font-medium whitespace-nowrap transition-colors',
                  on
                    ? 'bg-lime-soft text-accent font-semibold'
                    : 'text-ink2 hover:bg-fill hover:text-ink'
                )}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" aria-hidden />
                {label}
              </a>
            );
          })}
        </nav>
        <UserBlock me={me} />
      </aside>
      <main
        id="main"
        tabIndex={-1}
        className="min-w-0 px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-[1400px] w-full outline-none"
      >
        <Page me={me} params={route.params} />
      </main>
    </div>
  );
}

function UserBlock({ me }: { me: Me }) {
  const [theme, setTheme] = useState(readTheme());
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <div className="flex lg:flex-col items-center lg:items-stretch gap-2 px-3 py-2 lg:p-4 lg:border-t border-line">
      <div className="hidden lg:block min-w-0">
        <p className="text-[14px] font-semibold truncate">{me.display_name || me.email}</p>
        <p className="text-[12px] text-ink2 capitalize">{me.role}</p>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          aria-label={dark ? 'Use light theme' : 'Use dark theme'}
          onClick={() => {
            const next = dark ? 'light' : 'dark';
            saveTheme(next);
            setTheme(next);
          }}
          className="w-9 h-9 rounded-full hover:bg-fill grid place-items-center text-ink2"
        >
          {dark ? (
            <Sun className="w-[18px] h-[18px]" aria-hidden />
          ) : (
            <Moon className="w-[18px] h-[18px]" aria-hidden />
          )}
        </button>
        <button
          type="button"
          aria-label="Sign out"
          onClick={() => supabase.auth.signOut()}
          className="w-9 h-9 rounded-full hover:bg-fill grid place-items-center text-ink2"
        >
          <LogOut className="w-[18px] h-[18px]" aria-hidden />
        </button>
      </div>
    </div>
  );
}
