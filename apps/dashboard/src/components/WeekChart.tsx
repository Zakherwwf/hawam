import { fmtKm, fmtWeek } from '../lib/format';

/**
 * Kilometres surveyed per week. Plain SVG: one series, labelled axis, the
 * current week in the accent, and a data table for screen readers.
 */
export function WeekChart({
  weeks,
  label,
}: {
  weeks: { start: Date; km: number; walks: number }[];
  label: string;
}) {
  const max = Math.max(0.1, ...weeks.map((w) => w.km));
  const W = 720;
  const H = 200;
  const pad = { l: 40, r: 8, t: 12, b: 32 };
  const bw = (W - pad.l - pad.r) / Math.max(1, weeks.length);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const every = Math.ceil(weeks.length / 8);
  // In dark mode lime and the accent are the same colour; dim the other weeks
  const dim =
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark' ? 0.4 : 1;
  return (
    <figure className="px-5 pb-5 m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={label}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--hairline)" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink3)">
              {fmtKm(t)}
            </text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const x = pad.l + i * bw + bw * 0.18;
          const h = w.km > 0 ? Math.max(2, H - pad.b - y(w.km)) : 0;
          const last = i === weeks.length - 1;
          return (
            <g key={w.start.toISOString()}>
              <rect
                x={x}
                y={H - pad.b - h}
                width={bw * 0.64}
                height={h}
                rx={4}
                fill={last ? 'var(--accent)' : 'var(--lime)'}
                fillOpacity={last ? 1 : dim}
              >
                <title>{`${fmtWeek(w.start)}: ${fmtKm(w.km)} km, ${w.walks} walks`}</title>
              </rect>
              {i % every === 0 || last ? (
                <text
                  x={x + bw * 0.32}
                  y={H - pad.b + 18}
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--ink3)"
                >
                  {fmtWeek(w.start)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">
        <table>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.start.toISOString()}>
                <td>{fmtWeek(w.start)}</td>
                <td>{fmtKm(w.km)} km</td>
                <td>{w.walks} walks</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
