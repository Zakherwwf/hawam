import { useId } from 'react';
import { bearing } from '../lib/compliance';

/**
 * A route drawn as a small SVG: the line in walking order, a green start
 * dot, a dark end dot and an arrow at the midpoint. Cheap enough for every
 * card in a list (no map tiles).
 */
export function RouteThumb({
  coords,
  either,
  muted,
  height = 120,
  label,
}: {
  coords: [number, number][];
  either?: boolean;
  muted?: boolean;
  height?: number;
  label: string;
}) {
  const gid = `grid${useId().replace(/:/g, '')}`;
  const w = 240;
  const h = height;
  if (coords.length < 2)
    return (
      <div className="rounded-tile bg-canvas" style={{ height }} aria-label={`${label}: no line`} />
    );
  const k = Math.cos((coords[0][1] * Math.PI) / 180);
  const xy = coords.map(([x, y]) => [x * k, y]);
  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 16;
  const s = Math.min((w - pad * 2) / (maxX - minX || 1e-9), (h - pad * 2) / (maxY - minY || 1e-9));
  const ox = (w - (maxX - minX) * s) / 2;
  const oy = (h - (maxY - minY) * s) / 2;
  const P = xy.map(
    ([x, y]) => [ox + (x - minX) * s, h - (oy + (y - minY) * s)] as [number, number]
  );
  const mid = Math.floor((P.length - 1) / 2);
  const ang = bearing(coords[mid], coords[mid + 1]) - 90;
  const [mx, my] = [(P[mid][0] + P[mid + 1][0]) / 2, (P[mid][1] + P[mid + 1][1]) / 2];
  const color = muted ? 'var(--ink3)' : '#F1721D';
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      role="img"
      aria-label={label}
      className="block rounded-tile bg-canvas"
    >
      <defs>
        <pattern id={gid} width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M16 0H0V16" fill="none" stroke="var(--grid)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={w} height={h} fill={`url(#${gid})`} />
      <polyline
        points={P.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke="var(--surface)"
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={P.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={muted ? '6 5' : undefined}
      />
      {!either ? (
        <g transform={`translate(${mx} ${my}) rotate(${ang})`}>
          <path
            d="M-5,-6 L6,0 L-5,6 L-2,0 Z"
            fill="#FFFFFF"
            stroke={color}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </g>
      ) : null}
      <circle
        cx={P[P.length - 1][0]}
        cy={P[P.length - 1][1]}
        r={5}
        fill="#16181D"
        stroke="#FFFFFF"
        strokeWidth={2}
      />
      <circle cx={P[0][0]} cy={P[0][1]} r={6.5} fill="#2F7A2B" stroke="#FFFFFF" strokeWidth={2.5} />
    </svg>
  );
}
