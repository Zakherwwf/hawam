import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { supabase } from './data/client';
import { getMe, type Me } from './data/api';
import { useRoute } from './lib/router';
import { Skeleton } from './ui';
import { NAV, Shell } from './app/Shell';
import { SignIn } from './pages/SignIn';
import { NoAccess } from './pages/NoAccess';
import { SetPassword } from './pages/SetPassword';
const Overview = lazy(() => import('./pages/Overview').then((m) => ({ default: m.Overview })));
const Explore = lazy(() => import('./pages/Explore').then((m) => ({ default: m.Explore })));
const Timeline = lazy(() => import('./pages/Timeline').then((m) => ({ default: m.Timeline })));
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })));
const Walks = lazy(() => import('./pages/Walks').then((m) => ({ default: m.Walks })));
const WalkProfile = lazy(() =>
  import('./pages/WalkProfile').then((m) => ({ default: m.WalkProfile }))
);
const Sightings = lazy(() => import('./pages/Sightings').then((m) => ({ default: m.Sightings })));
const ObservationProfile = lazy(() =>
  import('./pages/ObservationProfile').then((m) => ({ default: m.ObservationProfile }))
);
const Animals = lazy(() => import('./pages/Animals').then((m) => ({ default: m.Animals })));
const AnimalProfile = lazy(() =>
  import('./pages/AnimalProfile').then((m) => ({ default: m.AnimalProfile }))
);
const Routes = lazy(() => import('./pages/Routes').then((m) => ({ default: m.Routes })));
const RouteProfile = lazy(() =>
  import('./pages/RouteProfile').then((m) => ({ default: m.RouteProfile }))
);
const RouteEditor = lazy(() =>
  import('./pages/RouteEditor').then((m) => ({ default: m.RouteEditor }))
);
const People = lazy(() => import('./pages/People').then((m) => ({ default: m.People })));
const PersonProfile = lazy(() =>
  import('./pages/PersonProfile').then((m) => ({ default: m.PersonProfile }))
);
const Colonies = lazy(() => import('./pages/Colonies').then((m) => ({ default: m.Colonies })));
const Exports = lazy(() => import('./pages/Exports').then((m) => ({ default: m.Exports })));
import type { PageProps } from './pages/types';

/** List pages, and the profile page each opens when the URL names a record. */
const PAGES: Record<
  string,
  { list: ComponentType<PageProps>; profile?: ComponentType<PageProps> }
> = {
  overview: { list: Overview },
  explore: { list: Explore },
  timeline: { list: Timeline },
  map: { list: MapPage },
  walks: { list: Walks, profile: WalkProfile },
  sightings: { list: Sightings, profile: ObservationProfile },
  animals: { list: Animals, profile: AnimalProfile },
  routes: { list: Routes, profile: RouteProfile },
  people: { list: People, profile: PersonProfile },
  colonies: { list: Colonies },
  exports: { list: Exports },
};

export default function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [recovering, setRecovering] = useState(false);
  const route = useRoute();

  useEffect(() => {
    getMe().then(setMe);
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      getMe().then(setMe);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // The old Volunteers page lives on as People
  const pageId = route.page === 'volunteers' ? 'people' : route.page;
  const page = NAV.some((n) => n.page === pageId) ? pageId : 'overview';

  useEffect(() => {
    const label = NAV.find((n) => n.page === page)?.label ?? 'Overview';
    document.title = `${label} · Strayo Research`;
    window.scrollTo({ top: 0 });
  }, [page, route.id]);

  if (me === undefined) {
    return (
      <div className="min-h-[100dvh] grid place-items-center" aria-busy="true">
        <Skeleton className="w-48 h-6" />
      </div>
    );
  }
  if (recovering) return <SetPassword onDone={() => setRecovering(false)} />;
  if (!me) return <SignIn />;
  if (me.role !== 'researcher' && me.role !== 'admin') return <NoAccess me={me} />;

  const entry = PAGES[page];
  let Page = entry.list;
  if (page === 'routes' && (route.id === 'new' || route.sub === 'edit')) Page = RouteEditor;
  else if (route.id && entry.profile) Page = entry.profile;

  return (
    <Shell me={me} page={page}>
      {/* Each page is its own chunk; the shell stays while one loads */}
      <Suspense fallback={<Skeleton className="h-[480px]" />}>
        <Page
          me={me}
          params={route.params}
          id={route.id}
          sub={route.sub}
          key={`${page}/${route.id ?? ''}/${route.sub ?? ''}`}
        />
      </Suspense>
    </Shell>
  );
}
