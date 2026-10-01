import { lazy, Suspense, type ComponentProps } from 'react';
import { Skeleton } from '../ui';
import type { MapView as MapViewType } from './MapView';

// Mapbox GL is most of the bundle; pages without a map never download it
const Inner = lazy(() => import('./MapView'));

export function MapView(props: ComponentProps<typeof MapViewType>) {
  return (
    <Suspense fallback={<Skeleton className="w-full" />}>
      <Inner {...props} />
    </Suspense>
  );
}
export type { MapLine, MapPoint } from './MapView';
