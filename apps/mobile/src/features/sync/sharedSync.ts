/**
 * Shared reference data: routes researchers publish, and everyone's colonies.
 * Runs at sign-in, after each upload and after a colony is saved or visited.
 */

import {
  supabase,
  pullKnownAnimals,
  pullRoutes,
  pullSharedColonies,
  pushColony,
  pushColonyVisit,
} from '../../services/supabase';
import { animalFromServer, useKnownAnimals } from '../animals/knownAnimals';
import { useRoutesStore, type FixedRoute } from '../routes/routesStore';
import { useColoniesStore } from '../colonies/coloniesStore';
import { colonyFromServer, colonyToServer, routeFromServer } from './serverMapping';

let running: Promise<void> | null = null;

export function syncSharedData(): Promise<void> {
  if (running) return running;
  running = (async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;

    const rows = await pullRoutes();
    if (rows) {
      const local = useRoutesStore.getState().routes;
      const merged = rows
        .map((r) =>
          routeFromServer(
            r,
            local.find((l) => l.id === r.id)
          )
        )
        .filter((r): r is FixedRoute => r != null);
      useRoutesStore.getState().mergeServerRoutes(merged);
    }

    const animals = await pullKnownAnimals();
    if (animals) useKnownAnimals.getState().replace(animals.map(animalFromServer));

    await useColoniesStore.getState().syncWithServer({
      userId,
      push: (c) => pushColony(colonyToServer(c, userId)),
      pushVisit: pushColonyVisit,
      pull: async () => {
        const shared = await pullSharedColonies();
        return shared ? shared.map(colonyFromServer) : null;
      },
    });
  })()
    .catch((e) => console.warn('Shared data sync failed:', e))
    .finally(() => {
      running = null;
    });
  return running;
}
