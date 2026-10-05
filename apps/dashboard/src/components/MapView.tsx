import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_TOKEN } from '../data/client';
import { bounds } from '../lib/geo';

mapboxgl.accessToken = MAPBOX_TOKEN;
// Arabic street names need the RTL shaping plugin, loaded lazily on first use
if (mapboxgl.getRTLTextPluginStatus() === 'unavailable')
  mapboxgl.setRTLTextPlugin(
    'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js',
    null,
    true
  );

export type PointKind =
  'cat' | 'dog' | 'unknown' | 'colony' | 'animal' | 'observer' | 'start' | 'end' | 'rejected';
export interface MapPoint {
  id: string;
  lon: number;
  lat: number;
  kind: PointKind;
  label: string;
  /** Link opened on click (profile page); otherwise a popup shows the label */
  href?: string;
}
export type LineKind =
  'track' | 'route' | 'route-muted' | 'draft' | 'bearing' | 'path' | 'track-muted';
export interface MapLine {
  id: string;
  coords: [number, number][];
  kind: LineKind;
  label?: string;
  href?: string;
  /** Draw arrows along the line in its drawing order */
  arrows?: boolean;
}

const COLORS: Record<PointKind | LineKind, string> = {
  cat: '#3865CC',
  dog: '#C2410C',
  unknown: '#6B7078',
  colony: '#144513',
  animal: '#7C3AED',
  observer: '#16181D',
  start: '#2F7A2B',
  end: '#16181D',
  rejected: '#C62828',
  track: '#2F7A2B',
  'track-muted': '#2F7A2B',
  route: '#F1721D',
  'route-muted': '#9AA0A8',
  draft: '#F1721D',
  bearing: '#16181D',
  path: '#7C3AED',
};

export type BaseStyle = 'light' | 'streets' | 'satellite';

/**
 * One Mapbox map for the portal. Points and lines are GeoJSON sources so
 * thousands of sightings render as single layers. Lines can carry direction
 * arrows (routes and tracks are ordered: the first vertex is the start).
 * In edit mode the route vertices are draggable and clickable; map clicks
 * are handed to the page (route editor). A heatmap layer shows density.
 */
export function MapView({
  points = [],
  lines = [],
  vertices,
  onMapClick,
  onVertexMove,
  onVertexClick,
  height = 520,
  dark,
  fit = true,
  fitKey,
  heat = false,
  base = 'light',
  label,
  rounded = true,
}: {
  points?: MapPoint[];
  lines?: MapLine[];
  /** Editable vertices of the route being drawn */
  vertices?: [number, number][];
  onMapClick?: (lonLat: [number, number]) => void;
  onVertexMove?: (index: number, lonLat: [number, number]) => void;
  onVertexClick?: (index: number) => void;
  height?: number | string;
  dark?: boolean;
  fit?: boolean;
  /** Change to refit the view to the data */
  fitKey?: string;
  heat?: boolean;
  base?: BaseStyle;
  label: string;
  rounded?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const ready = useRef(false);
  const cb = useRef({ onMapClick, onVertexMove, onVertexClick });
  cb.current = { onMapClick, onVertexMove, onVertexClick };
  const fitted = useRef<string | null>(null);
  const data = useRef({ points, lines, vertices, heat });
  data.current = { points, lines, vertices, heat };
  const dragging = useRef<number | null>(null);

  const push = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    const { points: pts, lines: lns, vertices: vx, heat: ht } = data.current;
    (m.getSource('points') as mapboxgl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: pts.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
        properties: {
          id: p.id,
          label: p.label,
          kind: p.kind,
          color: COLORS[p.kind],
          href: p.href ?? '',
        },
      })),
    });
    (m.getSource('lines') as mapboxgl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: lns
        .filter((l) => l.coords.length >= 2)
        .map((l) => ({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: l.coords },
          properties: {
            id: l.id,
            kind: l.kind,
            color: COLORS[l.kind],
            arrows: l.arrows ? 1 : 0,
            label: l.label ?? '',
            href: l.href ?? '',
          },
        })),
    });
    (m.getSource('vertices') as mapboxgl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: (vx ?? []).map((c, i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: c },
        properties: { i, first: i === 0 ? 1 : 0, last: i === (vx?.length ?? 0) - 1 ? 1 : 0 },
      })),
    });
    if (m.getLayer('heat')) {
      m.setLayoutProperty('heat', 'visibility', ht ? 'visible' : 'none');
      m.setLayoutProperty('points', 'visibility', ht ? 'none' : 'visible');
    }
    m.getCanvas().style.cursor = cb.current.onMapClick ? 'crosshair' : '';
    const key = fitKey ?? 'once';
    if (fit && fitted.current !== key) {
      const b = bounds([
        ...pts.map((p) => [p.lon, p.lat] as [number, number]),
        ...lns.flatMap((l) => l.coords),
        ...(vx ?? []),
      ]);
      if (b) {
        fitted.current = key;
        const single = b[0][0] === b[1][0] && b[0][1] === b[1][1];
        if (single) m.jumpTo({ center: b[0], zoom: 16 });
        else m.fitBounds(b, { padding: 56, maxZoom: 16.5, duration: 0 });
      }
    }
  };

  useEffect(() => {
    if (!el.current) return;
    fitted.current = null;
    const style =
      base === 'satellite'
        ? 'mapbox://styles/mapbox/satellite-streets-v12'
        : base === 'streets'
          ? dark
            ? 'mapbox://styles/mapbox/navigation-night-v1'
            : 'mapbox://styles/mapbox/streets-v12'
          : dark
            ? 'mapbox://styles/mapbox/dark-v11'
            : 'mapbox://styles/mapbox/light-v11';
    const m = new mapboxgl.Map({
      container: el.current,
      style,
      center: [10.18, 36.81],
      zoom: 11,
      attributionControl: true,
      cooperativeGestures: false,
    });
    m.addControl(
      new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: false }),
      'top-right'
    );
    m.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    m.on('load', () => {
      // Arrow glyph for direction, drawn once on a canvas
      const size = 32;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d')!;
      g.fillStyle = '#FFFFFF';
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(9, 7);
      g.lineTo(24, 16);
      g.lineTo(9, 25);
      g.lineTo(13, 16);
      g.closePath();
      g.stroke();
      g.fill();
      m.addImage('arrow', g.getImageData(0, 0, size, size), { pixelRatio: 2 });

      m.addSource('lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addSource('points', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addSource('vertices', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      m.addLayer({
        id: 'lines-casing',
        type: 'line',
        source: 'lines',
        filter: ['in', ['get', 'kind'], ['literal', ['route', 'draft', 'path']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#FFFFFF', 'line-width': 9, 'line-opacity': 0.9 },
      });
      m.addLayer({
        id: 'lines',
        type: 'line',
        source: 'lines',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'match',
            ['get', 'kind'],
            'route',
            5,
            'draft',
            5,
            'route-muted',
            4,
            'bearing',
            1.5,
            'path',
            3,
            'track-muted',
            2,
            3,
          ],
          'line-opacity': [
            'match',
            ['get', 'kind'],
            'track',
            0.85,
            'track-muted',
            0.35,
            'route-muted',
            0.85,
            0.95,
          ],
          'line-dasharray': [
            'match',
            ['get', 'kind'],
            'bearing',
            ['literal', [2, 2]],
            'route-muted',
            ['literal', [2, 1.5]],
            ['literal', [1, 0]],
          ],
        },
      });
      m.addLayer({
        id: 'arrows',
        type: 'symbol',
        source: 'lines',
        filter: ['==', ['get', 'arrows'], 1],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 70,
          'icon-image': 'arrow',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.7, 17, 1.1],
          'icon-allow-overlap': true,
          'icon-rotation-alignment': 'map',
        },
      });
      m.addLayer({
        id: 'heat',
        type: 'heatmap',
        source: 'points',
        filter: ['in', ['get', 'kind'], ['literal', ['cat', 'dog', 'unknown']]],
        layout: { visibility: 'none' },
        paint: {
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 16, 28],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 16, 1.6],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(47,122,43,0)',
            0.25,
            '#CFEAB3',
            0.5,
            '#9FD477',
            0.75,
            '#5EA83C',
            1,
            '#144513',
          ],
          'heatmap-opacity': 0.85,
        },
      });
      m.addLayer({
        id: 'points',
        type: 'circle',
        source: 'points',
        paint: {
          'circle-color': ['get', 'color'],
          // zoom may only drive a top-level interpolate, so the kind match sits inside each stop
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            [
              'match',
              ['get', 'kind'],
              'start',
              7,
              'end',
              6,
              'colony',
              6,
              'animal',
              6,
              'observer',
              4,
              'rejected',
              2.5,
              3.5,
            ],
            14,
            [
              'match',
              ['get', 'kind'],
              'start',
              9,
              'end',
              8,
              'colony',
              8,
              'animal',
              7,
              'observer',
              5,
              'rejected',
              3.5,
              6,
            ],
            17,
            [
              'match',
              ['get', 'kind'],
              'start',
              10,
              'end',
              9,
              'colony',
              10,
              'animal',
              9,
              'observer',
              6,
              'rejected',
              4.5,
              8,
            ],
          ],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': ['match', ['get', 'kind'], 'start', 3, 'end', 3, 'rejected', 1, 2],
        },
      });
      m.addLayer({
        id: 'point-labels',
        type: 'symbol',
        source: 'points',
        filter: ['in', ['get', 'kind'], ['literal', ['start', 'end']]],
        layout: {
          'text-field': ['match', ['get', 'kind'], 'start', 'Start', 'End'],
          'text-size': 12,
          'text-offset': [0, 1.5],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        },
        paint: { 'text-color': '#16181D', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 },
      });
      m.addLayer({
        id: 'vertices',
        type: 'circle',
        source: 'vertices',
        paint: {
          'circle-radius': ['case', ['==', ['get', 'first'], 1], 9, 6],
          'circle-color': [
            'case',
            ['==', ['get', 'first'], 1],
            '#2F7A2B',
            ['==', ['get', 'last'], 1],
            '#16181D',
            '#FFFFFF',
          ],
          'circle-stroke-color': ['case', ['==', ['get', 'first'], 1], '#FFFFFF', '#F1721D'],
          'circle-stroke-width': 2.5,
        },
      });

      const openHref = (f?: unknown) =>
        ((f as { properties?: { href?: string; label?: string } } | undefined)?.properties ??
          {}) as {
          href?: string;
          label?: string;
        };
      for (const layer of ['points', 'lines']) {
        m.on('click', layer, (e) => {
          if (cb.current.onMapClick) return;
          const p = openHref(e.features?.[0]);
          if (p.href) {
            window.location.hash = p.href.replace(/^#/, '');
            return;
          }
          if (p.label)
            new mapboxgl.Popup({ closeButton: false, offset: 10 })
              .setLngLat(e.lngLat)
              .setText(p.label)
              .addTo(m);
        });
        m.on('mouseenter', layer, (e) => {
          const p = openHref(e.features?.[0]);
          if (!cb.current.onMapClick && (p.href || p.label)) m.getCanvas().style.cursor = 'pointer';
        });
        m.on('mouseleave', layer, () => {
          m.getCanvas().style.cursor = cb.current.onMapClick ? 'crosshair' : '';
        });
      }

      // Vertex editing: drag to move, click to select
      m.on('mouseenter', 'vertices', () => {
        m.getCanvas().style.cursor = 'grab';
      });
      m.on('mouseleave', 'vertices', () => {
        if (dragging.current == null)
          m.getCanvas().style.cursor = cb.current.onMapClick ? 'crosshair' : '';
      });
      let moved = false;
      m.on('mousedown', 'vertices', (e) => {
        const i = Number(
          (e.features?.[0] as { properties?: { i?: number } } | undefined)?.properties?.i
        );
        if (!Number.isFinite(i) || !cb.current.onVertexMove) return;
        e.preventDefault();
        dragging.current = i;
        moved = false;
        m.getCanvas().style.cursor = 'grabbing';
        m.dragPan.disable();
      });
      m.on('mousemove', (e) => {
        if (dragging.current == null) return;
        moved = true;
        cb.current.onVertexMove?.(dragging.current, [e.lngLat.lng, e.lngLat.lat]);
      });
      m.on('mouseup', () => {
        if (dragging.current == null) return;
        const i = dragging.current;
        dragging.current = null;
        m.dragPan.enable();
        m.getCanvas().style.cursor = cb.current.onMapClick ? 'crosshair' : '';
        if (!moved) cb.current.onVertexClick?.(i);
        suppressClick = true;
      });
      let suppressClick = false;
      m.on('click', (e) => {
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        const hit = m.queryRenderedFeatures(e.point, { layers: ['vertices'] });
        if (hit.length) return;
        cb.current.onMapClick?.([e.lngLat.lng, e.lngLat.lat]);
      });
      ready.current = true;
      push();
    });
    map.current = m;
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      ready.current = false;
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark, base]);

  useEffect(push, [points, lines, vertices, fit, fitKey, heat]);

  return (
    <div
      ref={el}
      role="region"
      aria-label={label}
      className={`w-full overflow-hidden bg-fill ${rounded ? 'rounded-tile' : ''}`}
      style={{ height }}
    />
  );
}
export default MapView;
