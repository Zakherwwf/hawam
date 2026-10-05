import { useMemo } from 'react';
import {
  getIndividuals,
  getLinks,
  getRoutes,
  getSightings,
  getTracks,
  getUsers,
  getUserStats,
  getWalks,
  personName,
} from './api';
import { useData } from './useData';

/**
 * The tables most pages share, fetched once per visit and cached by key.
 * Pages read what they need; nothing here is refetched on navigation.
 */
export function useCore() {
  const walks = useData('walks', getWalks);
  const sightings = useData('sightings', getSightings);
  const users = useData('users', getUsers);
  const routes = useData('routes', getRoutes);
  const names = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users.data ?? []) m.set(u.id, personName(u));
    for (const w of walks.data ?? [])
      if (!m.has(w.observer_id))
        m.set(w.observer_id, w.observer?.display_name || 'Unnamed volunteer');
    return m;
  }, [users.data, walks.data]);
  // The map view's observer_name is the stored display name, empty for most
  // accounts; give every sighting the same name the rest of the portal uses.
  const named = useMemo(
    () =>
      sightings.data?.map((x) => ({
        ...x,
        observer_name: names.get(x.observer_id) ?? x.observer_name,
      })),
    [sightings.data, names]
  );
  const routeNames = useMemo(
    () => new Map((routes.data ?? []).map((r) => [r.id, r.name])),
    [routes.data]
  );
  return {
    walks,
    sightings: { ...sightings, data: named },
    users,
    routes,
    nameOf: (id: string | null | undefined) =>
      id ? (names.get(id) ?? 'Unnamed volunteer') : 'Unknown',
    routeName: (id: string | null | undefined) =>
      id ? (routeNames.get(id) ?? 'Deleted route') : 'Free walk',
    ready: !!walks.data && !!sightings.data,
    error: walks.error || sightings.error || users.error || routes.error,
    reload: () => {
      walks.reload();
      sightings.reload();
      users.reload();
      routes.reload();
    },
  };
}

export const useAnimals = () => ({
  individuals: useData('individuals', getIndividuals),
  links: useData('links', getLinks),
});
export const useStats = () => useData('userstats', getUserStats);
export const useTracks = () => useData('tracks', getTracks);

/** Stable colour slot per entity: position in a fixed ordering, never rank. */
export function slotOf(key: string, ordered: string[]) {
  const i = ordered.indexOf(key);
  return i < 0 ? 7 : i % 8;
}
