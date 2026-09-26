import { stamp } from '@/lib/fmt';

type Pt = { t: number; v: number };

// Dependency-free SVG line chart, time-scaled (captures are unevenly spaced, so index-scaling would lie).
export function Trend({ points, fmt, domain, label }: { points: Pt[]; fmt: (v: number) => string; domain?: [number, number]; label: string }) {
  if (points.length === 0) return null;
  const W = 640, H = 150, L = 46, R = 12, T = 10, B = 24;
  const ys = points.map((p) => p.v), xs = points.map((p) => p.t);
  const lo = domain?.[0] ?? Math.min(...ys), hi = domain?.[1] ?? Math.max(...ys);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const X = (t: number) => L + ((t - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const line = points.map((p) => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full text-sky-500">
      {[lo, hi].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="currentColor" strokeOpacity={0.15} />
          <text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="currentColor" fillOpacity={0.6} style={{ fill: 'var(--foreground)' }}>{fmt(v)}</text>
        </g>
      ))}
      {points.length > 1 && <polyline points={line} fill="none" stroke="currentColor" strokeWidth={2} />}
      {points.map((p) => (
        <circle key={p.t} cx={X(p.t)} cy={Y(p.v)} r={3} fill="currentColor"><title>{`${stamp(p.t)}: ${fmt(p.v)}`}</title></circle>
      ))}
      <text x={L} y={H - 6} fontSize="11" style={{ fill: 'var(--foreground)' }} fillOpacity={0.6}>{stamp(x0)}</text>
      <text x={W - R} y={H - 6} textAnchor="end" fontSize="11" style={{ fill: 'var(--foreground)' }} fillOpacity={0.6}>{stamp(x1)}</text>
    </svg>
  );
}

export function Spark({ values, domain = [0, 100], label }: { values: number[]; domain?: [number, number]; label: string }) {
  if (values.length < 2) return <span className="text-zinc-400">–</span>;
  const W = 96, H = 22, [lo, hi] = domain;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (W - 2) + 1).toFixed(1)},${(H - 2 - ((v - lo) / (hi - lo || 1)) * (H - 4)).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-[22px] w-24 text-sky-500">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}
