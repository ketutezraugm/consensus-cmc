import { stamp, usd, pct } from '@/lib/fmt';

export type V = { name: string; price: number; volume: number; excluded: boolean; priceExcluded: boolean; pair?: string };

const CLAMP = 500; // bps shown before a venue is pushed to the edge marker
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

export const severity = (bps: number, excluded: boolean) =>
  excluded ? 'var(--color-muted)' : Math.abs(bps) <= 50 ? 'var(--color-good)' : Math.abs(bps) <= 200 ? 'var(--color-warn)' : 'var(--color-bad)';

/**
 * Every venue's quote as one tick, placed by its distance from the reference price.
 * Tick height scales with volume share, so a big venue off-consensus is visibly different
 * from a dust venue off-consensus. Colour is severity; grey means CMC excludes it.
 */
export function Dispersion({ venues, refPrice, h = 92, axis = true }: { venues: V[]; refPrice: number; h?: number; axis?: boolean }) {
  if (!venues.length || !(refPrice > 0)) return null;
  const W = 1000, PAD = 8, inner = W - PAD * 2, mid = PAD + inner / 2;
  const plot = h - (axis ? 20 : 4);
  const total = sum(venues.map((v) => v.volume)) || 1;
  const X = (b: number) => mid + (Math.max(-CLAMP, Math.min(CLAMP, b)) / CLAMP) * (inner / 2);

  const ticks = venues
    .map((v) => ({ v, bps: (v.price / refPrice - 1) * 1e4, share: v.volume / total }))
    .sort((a, b) => a.share - b.share); // biggest drawn last, on top
  const left = ticks.filter((t) => t.bps < -CLAMP).length;
  const right = ticks.filter((t) => t.bps > CLAMP).length;

  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="w-full" role="img"
         aria-label={`${venues.length} venues by distance from the reference price`}>
      {[-CLAMP, -250, 0, 250, CLAMP].map((b) => (
        <line key={b} x1={X(b)} x2={X(b)} y1={2} y2={plot} stroke="var(--color-line)" strokeWidth={b === 0 ? 1.5 : 1} />
      ))}
      {ticks.map((t, i) => {
        const th = plot * (0.32 + 0.68 * Math.sqrt(t.share));
        return (
          <rect key={i} x={X(t.bps) - 2} y={plot - th} width={4} height={th} rx={2}
                fill={severity(t.bps, t.v.excluded)} opacity={t.v.excluded ? 0.5 : 0.95}>
            <title>{`${t.v.name}${t.v.pair ? ` ${t.v.pair}` : ''}\n${t.bps >= 0 ? '+' : ''}${Math.round(t.bps)} bps · ${pct(t.share)} of volume · ${usd(t.v.volume)}${t.v.excluded ? '\nCMC excludes this venue' : ''}`}</title>
          </rect>
        );
      })}
      {left > 0 && (
        <g fill="var(--color-bad)">
          <polygon points={`${PAD},${plot / 2} ${PAD + 11},${plot / 2 - 8} ${PAD + 11},${plot / 2 + 8}`} />
          <text x={PAD + 16} y={plot / 2 + 5} fontSize="13" className="num">{left}</text>
        </g>
      )}
      {right > 0 && (
        <g fill="var(--color-bad)">
          <polygon points={`${W - PAD},${plot / 2} ${W - PAD - 11},${plot / 2 - 8} ${W - PAD - 11},${plot / 2 + 8}`} />
          <text x={W - PAD - 16} y={plot / 2 + 5} fontSize="13" textAnchor="end" className="num">{right}</text>
        </g>
      )}
      {axis && [[-CLAMP, '-5%'], [0, 'consensus'], [CLAMP, '+5%']].map(([b, label]) => (
        <text key={label as string} x={X(b as number)} y={h - 4} fontSize="12" textAnchor={b === -CLAMP ? 'start' : b === CLAMP ? 'end' : 'middle'}
              fill="var(--color-muted)" className="num">{label as string}</text>
      ))}
    </svg>
  );
}

/** One 100%-wide bar split by venue: concentration at a glance. */
export function Concentration({ venues, h = 12 }: { venues: V[]; h?: number }) {
  const total = sum(venues.map((v) => v.volume));
  if (!total) return null;
  const sorted = [...venues].sort((a, b) => b.volume - a.volume);
  let x = 0;
  return (
    <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: h }} role="img"
         aria-label="share of 24h volume by venue">
      {sorted.map((v, i) => {
        const w = (v.volume / total) * 100, at = x;
        x += w;
        return (
          <rect key={i} x={at} y={0} width={Math.max(w, 0.15)} height={h}
                fill={i === 0 ? 'var(--color-accent)' : 'var(--color-accent)'} opacity={i === 0 ? 1 : Math.max(0.16, 0.6 - i * 0.05)}>
            <title>{`${v.name}: ${pct(v.volume / total)} of 24h volume`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

type Pt = { t: number; v: number };

/** Time-scaled line with area fill. Captures are unevenly spaced, so x is real time, not index. */
export function Trend({ points, fmt, domain, label, color = 'var(--color-accent)' }: {
  points: Pt[]; fmt: (v: number) => string; domain?: [number, number]; label: string; color?: string;
}) {
  if (!points.length) return null;
  const W = 720, H = 190, L = 54, R = 14, T = 14, B = 26;
  const ys = points.map((p) => p.v), xs = points.map((p) => p.t);
  const lo = domain?.[0] ?? Math.min(...ys), hi = domain?.[1] ?? Math.max(...ys);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const X = (t: number) => L + ((t - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const line = points.map((p) => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
  const mids = [lo, (lo + hi) / 2, hi];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label} style={{ color }}>
      {mids.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--color-line)" />
          <text x={L - 8} y={Y(v) + 4} textAnchor="end" fontSize="12" fill="var(--color-muted)" className="num">{fmt(v)}</text>
        </g>
      ))}
      {points.length > 1 && (
        <>
          <polygon points={`${X(x0)},${Y(lo)} ${line} ${X(x1)},${Y(lo)}`} fill="currentColor" opacity={0.12} />
          <polyline points={line} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" />
        </>
      )}
      {points.map((p) => (
        <circle key={p.t} cx={X(p.t)} cy={Y(p.v)} r={3.5} fill="var(--color-bg)" stroke="currentColor" strokeWidth={2}>
          <title>{`${stamp(p.t)}: ${fmt(p.v)}`}</title>
        </circle>
      ))}
      <text x={L} y={H - 6} fontSize="12" fill="var(--color-muted)" className="num">{stamp(x0)}</text>
      <text x={W - R} y={H - 6} textAnchor="end" fontSize="12" fill="var(--color-muted)" className="num">{stamp(x1)}</text>
    </svg>
  );
}

export function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {[['var(--color-good)', 'within 0.5%'], ['var(--color-warn)', '0.5–2%'], ['var(--color-bad)', 'over 2%'], ['var(--color-muted)', 'CMC excludes it']].map(([c, l]) => (
        <span key={l} className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-[3px] rounded-sm" style={{ background: c }} />{l}
        </span>
      ))}
      <span className="text-muted/70">tick height = share of 24h volume</span>
    </div>
  );
}
