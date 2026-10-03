import { lazy, Suspense, type ComponentProps } from 'react';
import { Skeleton } from '../ui';
import type { MapView as MapViewType } from './MapView';

// Mapbox GL is most of the bundle; pages without a map never download it
const Inner = lazy(() => import('./MapView'));

export function MapView(props: ComponentProps<typeof MapViewType>) {
  return (
    <Suspense
      fallback={
        <div style={{ height: props.height ?? 520 }}>
          <Skeleton className="w-full h-full" />
        </div>
      }
    >
      <Inner {...props} />
    </Suspense>
  );
}
export type { MapLine, MapPoint, PointKind, LineKind, BaseStyle } from './MapView';
