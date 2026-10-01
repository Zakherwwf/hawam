import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_TOKEN } from '../data/client';
import { bounds } from '../lib/geo';

mapboxgl.accessToken = MAPBOX_TOKEN;

export interface MapPoint {
  id: string;
  lon: number;
  lat: number;
  kind: 'cat' | 'dog' | 'unknown' | 'colony';
  label: string;
}
export interface MapLine {
  id: string;
  coords: [number, number][];
  kind: 'track' | 'route' | 'draft';
  label?: string;
}

const COLORS = {
  cat: '#3865CC',
  dog: '#C2410C',
  unknown: '#6B7078',
  colony: '#144513',
  track: '#2F7A2B',
  route: '#F1721D',
  draft: '#F1721D',
};

/**
 * One Mapbox map for the portal. Points and lines are GeoJSON sources, so
 * thousands of sightings render as a single layer; clicks show a popup, and
 * in draw mode clicks are handed to the page (route editor).
 */
export function MapView({
  points = [],
  lines = [],
  onMapClick,
  height = 520,
  dark,
  fit = true,
  label,
}: {
  points?: MapPoint[];
  lines?: MapLine[];
  onMapClick?: (lonLat: [number, number]) => void;
  height?: number | string;
  dark?: boolean;
  fit?: boolean;
  label: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const ready = useRef(false);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const fitted = useRef(false);
  const data = useRef({ points, lines });
  data.current = { points, lines };

  const push = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    const { points: pts, lines: lns } = data.current;
    (m.getSource('points') as mapboxgl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: pts.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
        properties: { id: p.id, label: p.label, color: COLORS[p.kind] },
      })),
    });
    (m.getSource('lines') as mapboxgl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: lns
        .filter((l) => l.coords.length >= 2)
        .map((l) => ({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: l.coords },
          properties: { id: l.id, kind: l.kind, color: COLORS[l.kind] },
        })),
    });
    m.getCanvas().style.cursor = clickRef.current ? 'crosshair' : '';
    if (fit && !fitted.current) {
      const b = bounds([
        ...pts.map((p) => [p.lon, p.lat] as [number, number]),
        ...lns.flatMap((l) => l.coords),
      ]);
      if (b) {
        fitted.current = true;
        m.fitBounds(b, { padding: 48, maxZoom: 15, duration: 0 });
      }
    }
  };

  useEffect(() => {
    if (!el.current) return;
    fitted.current = false;
    const m = new mapboxgl.Map({
      container: el.current,
      style: dark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
      center: [0, 20],
      zoom: 1.4,
    });
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    m.on('load', () => {
      m.addSource('lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addSource('points', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({
        id: 'lines',
        type: 'line',
        source: 'lines',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['match', ['get', 'kind'], 'route', 5, 'draft', 4, 3],
          'line-opacity': ['match', ['get', 'kind'], 'track', 0.75, 0.95],
        },
      });
      m.addLayer({
        id: 'points',
        type: 'circle',
        source: 'points',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 3, 12, 6, 16, 9],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 1.5,
        },
      });
      m.on('click', 'points', (e) => {
        const f = e.features?.[0];
        if (!f || clickRef.current) return;
        new mapboxgl.Popup({ closeButton: false })
          .setLngLat(e.lngLat)
          .setText(
            String((f as unknown as { properties?: { label?: string } }).properties?.label ?? '')
          )
          .addTo(m);
      });
      m.on('mouseenter', 'points', () => {
        m.getCanvas().style.cursor = 'pointer';
      });
      m.on('mouseleave', 'points', () => {
        m.getCanvas().style.cursor = clickRef.current ? 'crosshair' : '';
      });
      m.on('click', (e) => clickRef.current?.([e.lngLat.lng, e.lngLat.lat]));
      ready.current = true;
      push();
    });
    map.current = m;
    // Keep the canvas matched to its box (panels open, windows resize)
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      ready.current = false;
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(push, [points, lines, fit]);

  return (
    <div
      ref={el}
      role="region"
      aria-label={label}
      className="w-full rounded-card overflow-hidden bg-fill"
      style={{ height }}
    />
  );
}
export default MapView;
