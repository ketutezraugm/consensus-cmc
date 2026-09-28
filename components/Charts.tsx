import type { ReactNode } from 'react';
import { usd, pct, stamp } from '@/lib/fmt';
import { benchDomain } from '@/lib/bench';

export type V = { name: string; price: number; volume: number; excluded: boolean; priceExcluded: boolean; pair?: string };

const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const fmtPct = (d: number, dp = 1) => `${d < 0 ? '−' : d > 0 ? '+' : ''}${Math.abs(d).toFixed(dp)}%`;

export const band = (s: number) => (s >= 80 ? { word: 'Reliable', c: 'var(--color-good)' } : s >= 60 ? { word: 'Watch', c: 'var(--color-warn)' } : { word: 'Unreliable', c: 'var(--color-bad)' });

export const severity = (bps: number, excluded: boolean) =>
  excluded ? 'var(--color-discard)' : Math.abs(bps) <= 50 ? 'var(--color-good)' : Math.abs(bps) <= 200 ? 'var(--color-warn)' : 'var(--color-bad)';

const scaleShare = (share: number, floor: number) => Math.min(1, Math.max(floor, Math.sqrt(share / 0.25)));

/**
 * Every venue's quote as one stroke, placed by its % distance from the reference price. Stroke height
 * scales with volume share (sqrt, so a big venue reads clearly bigger than a dust venue). Deviations
 * beyond the domain don't get clipped: the axis breaks into a log-compressed gutter so outliers still
 * show, at the edge, labelled with their real number.
 */
export function Dispersion({ venues, refPrice, h = 150, compact = false, domain = 1.5, gutter, refLabel = 'agreed price' }: {
  venues: V[]; refPrice: number; h?: number; compact?: boolean; domain?: number; gutter?: number; refLabel?: string;
}) {
  if (!venues.length || !(refPrice > 0)) return null;
  const W = 1000, D = domain;
  const G = gutter ?? (compact ? 14 : 128), top = compact ? 2 : 34, ph = h - top - (compact ? 4 : 44), base = top + ph;
  const x = (d: number) => G + (d + D) / (2 * D) * (W - 2 * G);
  const gx = (d: number) => {
    const k = Math.min(1, Math.log(Math.abs(d) / D) / Math.log(40 / D));
    return d < 0 ? G - 14 - (G - 28) * k : W - G + 14 + (G - 28) * k;
  };

  const total = sum(venues.map((v) => v.volume)) || 1;
  let list = venues.map((v) => ({ v, dev: (v.price / refPrice - 1) * 100, share: v.volume / total }));
  const topVenue = [...list].sort((a, b) => b.share - a.share)[0];
  list = list.sort((a, b) => (a.v.excluded ? 0 : 1) - (b.v.excluded ? 0 : 1) || a.share - b.share);
  // At most one off-scale label per side (the most prominent by share) — the label band has room for
  // one line; more than that overflows the chart's own viewBox and gets silently clipped.
  const offScale = list.filter((e) => Math.abs(e.dev) > D && !e.v.excluded);
  const leftLabel = offScale.filter((e) => e.dev < 0).sort((a, b) => b.share - a.share)[0];
  const rightLabel = offScale.filter((e) => e.dev > 0).sort((a, b) => b.share - a.share)[0];

  const els: ReactNode[] = [];
  els.push(<rect key="tb" x={x(-0.5)} y={top} width={x(0.5) - x(-0.5)} height={ph} fill="var(--color-good)" opacity={compact ? 0.12 : 0.09} />);
  if (!compact) [-0.5, 0.5].forEach((d, i) => els.push(
    <line key={`te${i}`} x1={x(d)} x2={x(d)} y1={top} y2={base} stroke="var(--color-good)" strokeDasharray="2 3" strokeWidth={1} opacity={0.7} />
  ));
  els.push(<line key="ax" x1={compact ? 0 : G - 6} x2={compact ? W : W - G + 6} y1={base + 0.5} y2={base + 0.5} stroke="var(--color-line-strong)" />);

  if (!compact) {
    for (let d = -D; d <= D + 1e-9; d += 0.5) {
      const X = x(d);
      els.push(<line key={`t${d}`} x1={X} x2={X} y1={base} y2={base + 5} stroke="var(--color-line-strong)" />);
      els.push(<text key={`tl${d}`} x={X} y={base + 20} textAnchor="middle" fontSize={11} className="num" fill="var(--color-label)">{Math.abs(d) < 1e-9 ? '0' : fmtPct(d)}</text>);
    }
    [G - 6, W - G + 6].forEach((X, i) => els.push(
      <path key={`br${i}`} d={`M${X - 4} ${base + 5} L${X} ${base - 5} M${X} ${base + 5} L${X + 4} ${base - 5}`} stroke="var(--color-label)" fill="none" />
    ));
    els.push(<text key="gl" x={4} y={base + 20} fontSize={10} className="num" fill="var(--color-label)">off-scale</text>);
    els.push(<text key="gr" x={W - 4} y={base + 20} textAnchor="end" fontSize={10} className="num" fill="var(--color-label)">off-scale</text>);
  }

  list.forEach((e, i) => {
    const off = Math.abs(e.dev) > D;
    if (off && compact) return;
    const X = off ? gx(e.dev) : x(e.dev);
    const hh = ph * scaleShare(e.share, compact ? 0.18 : 0.08);
    const c = severity(e.dev * 100, e.v.excluded);
    const sw = compact ? 1.5 : e.v === topVenue.v ? 3 : 2;
    els.push(
      <line key={`s${i}`} x1={X} x2={X} y1={base} y2={base - hh} stroke={c} strokeWidth={sw} opacity={e.v.excluded ? 0.55 : 1}>
        <title>{`${e.v.name}${e.v.pair ? ` ${e.v.pair}` : ''} · ${fmtPct(e.dev, 2)} · ${pct(e.share)} of volume · ${usd(e.v.volume)}${e.v.excluded ? ' · CoinMarketCap doesn’t count this exchange' : ''}`}</title>
      </line>
    );
    if (!e.v.excluded && Math.abs(e.dev) >= 2) els.push(<circle key={`c${i}`} cx={X} cy={base - hh - (compact ? 0 : 4)} r={compact ? 1.6 : 3} fill={c} />);
    if (!compact && !e.v.excluded && (e.v === topVenue.v || e === leftLabel || e === rightLabel)) {
      const left = e.dev < 0;
      const label = e.v === topVenue.v ? `${e.v.name} · ${Math.round(e.share * 100)}%` : `${e.v.name} ${fmtPct(e.dev)}`;
      if (off) els.push(<text key={`l${i}`} x={left ? 4 : W - 4} y={base + 36} textAnchor={left ? 'start' : 'end'} fontSize={11} className="num" fill={c}>{label}</text>);
      else els.push(<text key={`l${i}`} x={X + (e.dev < 0 ? -6 : 6)} y={base - hh + 4 - (e.v === topVenue.v ? 0 : 6)} textAnchor={e.dev < 0 ? 'end' : 'start'} fontSize={11} className="num" fill={e.v === topVenue.v ? 'var(--color-fg-2)' : c}>{label}</text>);
    }
  });

  els.push(<line key="ref" x1={x(0)} x2={x(0)} y1={compact ? 0 : top - 12} y2={base} stroke="var(--color-accent)" strokeWidth={compact ? 1.25 : 1.5} />);
  if (!compact) els.push(<text key="rl" x={x(0)} y={top - 18} textAnchor="middle" fontSize={11} className="num" fill="var(--color-accent-ink)">{refLabel}</text>);

  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="w-full" style={{ display: 'block' }} role="img"
         aria-label={`${venues.length} exchanges by distance from the reference price`}>
      {els}
    </svg>
  );
}

/** Concentration grid: a 10x10 grid of unit cells, filled = round(largest share x 100). One voice
 *  drowning the others reads as area, not just a number. */
export function ConcGrid({ share, cell = 12, px }: { share: number; cell?: number; px?: number }) {
  const g = 2, n = Math.round(share * 100), W = 10 * (cell + g) - g;
  const c = share >= 0.5 ? 'var(--color-bad)' : share >= 0.25 ? 'var(--color-warn)' : 'var(--color-fg)';
  return (
    <svg viewBox={`0 0 ${W} ${W}`} width={px ?? W} height={px ?? W} style={{ display: 'block', flex: 'none' }} role="img"
         aria-label={`${n}% of volume on the largest exchange`}>
      {Array.from({ length: 100 }, (_, i) => {
        const col = i % 10, row = Math.floor(i / 10), on = i < n;
        return <rect key={i} x={col * (cell + g)} y={row * (cell + g)} width={cell} height={cell} fill={on ? c : 'transparent'} stroke={on ? 'none' : 'var(--color-line-strong)'} strokeWidth={0.75} />;
      })}
    </svg>
  );
}

/** History as readings, not a line: one dot per reading, evenly spaced by index (not wall-clock time)
 *  and plotted at the true 0-100 scale, so "65 steady readings" reads as steady, not as a trend line
 *  implying more precision than a 30-minute snapshot deserves. */
export function History({ points, lo = 0, firstLabel, lastLabel }: { points: { t: number; v: number }[]; lo?: number; firstLabel?: string; lastLabel?: string }) {
  if (!points.length) return null;
  const W = 640, H = 120, n = points.length;
  // Right-aligned axis labels (60/80/100) end at x=W; PR reserves a gutter so the newest points — which
  // cluster right at the plot's right edge — never render on top of, and obscure, a label's digits.
  const PR = 26;
  const y = (v: number) => 14 + (1 - (v - lo) / (100 - lo)) * (H - 34);
  const x = (i: number) => (n === 1 ? (4 + (W - PR)) / 2 : 4 + (i / (n - 1)) * (W - PR - 4));
  const bands: [number, number, string][] = [[80, 100, 'var(--color-good)'], [60, 80, 'var(--color-warn)'], [lo, 60, 'var(--color-bad)']];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: 'block' }} role="img" aria-label={`${n} readings, most recent last`}>
      {bands.map(([a, b, c], i) => b > lo && <rect key={i} x={0} width={W} y={y(b)} height={y(Math.max(a, lo)) - y(b)} fill={c} opacity={0.06} />)}
      {[60, 80, 100].filter((v) => v > lo).map((v) => <text key={v} x={W} y={y(v) - 3} textAnchor="end" fontSize={10} className="num" fill="var(--color-label)">{v}</text>)}
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r={2} fill="var(--color-fg)"><title>{`${stamp(p.t)}: ${Math.round(p.v)}`}</title></circle>)}
      <line x1={0} x2={W} y1={H - 20} y2={H - 20} stroke="var(--color-line-strong)" />
      <text x={0} y={H - 4} fontSize={10} className="num" fill="var(--color-label)">{firstLabel ?? stamp(points[0].t)}</text>
      <text x={W} y={H - 4} textAnchor="end" fontSize={10} className="num" fill="var(--color-label)">{lastLabel ?? `latest · ${n} readings`}</text>
    </svg>
  );
}

/** A row of 65 ticks, filled for the most recent run where a condition held: how long has this been true. */
export function RunStrip({ total, held, w = 130 }: { total: number; held: number; w?: number }) {
  const cell = w / total;
  return (
    <svg viewBox={`0 0 ${w} 14`} width={w} height={14} style={{ display: 'block', flex: 'none' }} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => {
        const on = i >= total - held;
        return <rect key={i} x={i * cell} y={on ? 0 : 6} width={Math.max(1, cell - 1)} height={on ? 14 : 2} fill={on ? 'var(--color-fg-2)' : 'var(--color-line-strong)'} />;
      })}
    </svg>
  );
}

/** Ranked bar strip: one bar per asset, axis 0-domain%, off-scale entries pinned to the right edge. */
export function SpreadBars({ items, domain = 1 }: { items: { symbol: string; pct: number }[]; domain?: number }) {
  const W = 560, rh = 22, H = items.length * rh + 28, lx = 40, gx = W - 60;
  const x = (p: number) => lx + (p / domain) * (gx - 12 - lx);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * domain);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: 'block' }} role="img" aria-label="Issuer disagreement by asset">
      <line x1={lx} x2={gx - 6} y1={H - 22} y2={H - 22} stroke="var(--color-line-strong)" />
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={H - 6} textAnchor="middle" fontSize={11} className="num" fill="var(--color-label)">{t === 0 ? '0' : `${t.toFixed(2)}%`}</text>
      ))}
      <path d={`M${gx - 10} ${H - 17} L${gx - 6} ${H - 27} M${gx - 4} ${H - 17} L${gx} ${H - 27}`} stroke="var(--color-label)" fill="none" />
      {items.map((r, i) => {
        const y = 8 + i * rh, p = r.pct, off = p > domain, X = off ? W - 8 : x(p), c = off ? 'var(--color-bad)' : 'var(--color-fg-2)';
        return (
          <g key={r.symbol}>
            <text x={0} y={y + 9} fontSize={11} className="num" fill="var(--color-fg)">{r.symbol}</text>
            <line x1={lx} x2={X} y1={y + 5} y2={y + 5} stroke={c} strokeWidth={off ? 2 : 1.5} />
            <rect x={X - 1.5} y={y} width={3} height={10} fill={c} />
          </g>
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
          <text x={L - 8} y={Y(v) + 4} textAnchor="end" fontSize="12" fill="var(--color-label)" className="num">{fmt(v)}</text>
        </g>
      ))}
      {points.length > 1 && (
        <>
          <polygon points={`${X(x0)},${Y(lo)} ${line} ${X(x1)},${Y(lo)}`} fill="currentColor" opacity={0.12} />
          <polyline points={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
        </>
      )}
      {points.map((p) => (
        <circle key={p.t} cx={X(p.t)} cy={Y(p.v)} r={3} fill="var(--color-panel)" stroke="currentColor" strokeWidth={1.75}>
          <title>{`${stamp(p.t)}: ${fmt(p.v)}`}</title>
        </circle>
      ))}
      <text x={L} y={H - 6} fontSize="12" fill="var(--color-label)" className="num">{stamp(x0)}</text>
      <text x={W - R} y={H - 6} textAnchor="end" fontSize="12" fill="var(--color-label)" className="num">{stamp(x1)}</text>
    </svg>
  );
}

/** Trust gauge: semicircle at true 0-100 scale, so 88 and 92 look close because they are. */
export function Gauge({ score, w = 200 }: { score: number; w?: number }) {
  const cx = w / 2, r = w * 0.42, cy = r + 10, H = cy + 22;
  const p = (v: number, rr = r): [number, number] => { const t = Math.PI * (1 - v / 100); return [cx + rr * Math.cos(t), cy - rr * Math.sin(t)]; };
  const arc = (a: number, b: number, rr: number) => { const [x0, y0] = p(a, rr), [x1, y1] = p(b, rr); return `M${x0} ${y0} A${rr} ${rr} 0 0 1 ${x1} ${y1}`; };
  const bands: [number, number, string][] = [[0, 60, 'var(--color-bad)'], [60, 80, 'var(--color-warn)'], [80, 100, 'var(--color-good)']];
  const [nx, ny] = p(score, r - 4);
  return (
    <svg viewBox={`0 0 ${w} ${H}`} width="100%" style={{ display: 'block', maxWidth: w }} role="img" aria-label={`Trust score ${score} of 100`}>
      {bands.map(([a, b, c], i) => <path key={i} d={arc(a + 0.4, b - 0.4, r)} stroke={c} strokeWidth={5} fill="none" opacity={0.85} />)}
      {Array.from({ length: 51 }, (_, i) => i * 2).map((v) => {
        const major = v % 10 === 0;
        const [x0, y0] = p(v, r - 8), [x1, y1] = p(v, r - (major ? 18 : 12));
        return <line key={v} x1={x0} y1={y0} x2={x1} y2={y1} stroke={major ? 'var(--color-fg-2)' : 'var(--color-line-strong)'} strokeWidth={major ? 1.2 : 0.8} />;
      })}
      {[0, 60, 80, 100].map((v) => { const [x, y] = p(v, r - 30); return <text key={v} x={x} y={y + 4} textAnchor="middle" fontSize={w * 0.04} className="num" fill="var(--color-label)">{v}</text>; })}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--color-fg)" strokeWidth={2} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={6} fill="var(--color-accent)" />
      <line x1={cx - r - 4} x2={cx + r + 4} y1={cy + 0.5} y2={cy + 0.5} stroke="var(--color-line-strong)" />
    </svg>
  );
}

/** Benchmark vernier: CoinMarketCap's published price fixed at 0; our rebuilt price(s) marked by gap in bp. */
export function Bench({ items, domain = 60, tolerance = 25 }: { items: { symbol: string; gapBps: number }[]; domain?: number; tolerance?: number }) {
  const W = 640, T = tolerance;
  const D = benchDomain(items, domain, T);
  const H = items.length > 1 ? 118 : 104, pad = 18, y0 = H - 44;
  const x = (g: number) => pad + (g + D) / (2 * D) * (W - 2 * pad);
  const n = items.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: 'block' }} role="img" aria-label="Rebuilt price versus CoinMarketCap published price">
      <rect x={x(-T)} y={12} width={x(T) - x(-T)} height={y0 - 12} fill="var(--color-good)" opacity={0.09} />
      <line x1={pad} x2={W - pad} y1={y0 + 0.5} y2={y0 + 0.5} stroke="var(--color-line-strong)" />
      {Array.from({ length: Math.floor((2 * D) / 5) + 1 }, (_, i) => -D + i * 5).map((g) => {
        const X = x(g), maj = g % 20 === 0;
        return (
          <g key={g}>
            <line x1={X} x2={X} y1={y0} y2={y0 + (maj ? 8 : 4)} stroke={maj ? 'var(--color-label)' : 'var(--color-line-strong)'} />
            {maj && <text x={X} y={y0 + 22} textAnchor="middle" fontSize={11} className="num" fill="var(--color-label)">{g === 0 ? '0' : `${g < 0 ? '−' : '+'}${Math.abs(g)} bp`}</text>}
          </g>
        );
      })}
      {[-T, T].map((g, i) => <line key={i} x1={x(g)} x2={x(g)} y1={12} y2={y0} stroke="var(--color-good)" strokeDasharray="2 3" opacity={0.8} />)}
      <path d={`M${x(0)} ${y0 + 1} l-6 10 h12 z`} fill="var(--color-fg)" />
      <line x1={x(0)} x2={x(0)} y1={8} y2={y0} stroke="var(--color-fg)" strokeWidth={1} />
      <text x={x(0)} y={H - 4} textAnchor="middle" fontSize={11} fill="var(--color-fg-2)">CoinMarketCap published</text>
      {items.map((it, i) => {
        const X = x(Math.max(-D, Math.min(D, it.gapBps))), Y = n > 1 ? 20 + (i % 3) * ((y0 - 34) / 2) : y0 - 26, out = Math.abs(it.gapBps) > T;
        if (n === 1) return (
          <g key={i}>
            <path d={`M${X} ${y0 - 1} l-7 -12 h14 z`} fill="var(--color-accent)" />
            <line x1={x(0)} x2={X} y1={y0 - 18} y2={y0 - 18} stroke={out ? 'var(--color-bad)' : 'var(--color-fg-2)'} strokeWidth={1} />
            <text x={(x(0) + X) / 2} y={y0 - 24} textAnchor="middle" fontSize={12} className="num" fill={out ? 'var(--color-bad)' : 'var(--color-fg)'}>
              {`${it.gapBps < 0 ? '−' : '+'}${Math.abs(Math.round(it.gapBps))} bp`}
            </text>
          </g>
        );
        return (
          <g key={i}>
            <line x1={X} x2={X} y1={Y + 4} y2={y0} stroke={out ? 'var(--color-bad)' : 'var(--color-line-strong)'} strokeWidth={1} />
            <circle cx={X} cy={Y} r={4} fill={out ? 'var(--color-bad)' : 'var(--color-accent)'}><title>{`${it.symbol} ${it.gapBps < 0 ? '−' : '+'}${Math.abs(Math.round(it.gapBps))} bp`}</title></circle>
            {out && <text x={X > W - 90 ? X - 8 : X + 8} textAnchor={X > W - 90 ? 'end' : 'start'} y={Y + 4} fontSize={11} className="num" fill="var(--color-bad)">{`${it.symbol} ${it.gapBps < 0 ? '−' : '+'}${Math.abs(Math.round(it.gapBps))} bp`}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// Breaks the single confidence number into its four weighted components, so two similar-looking
// scores (or a surprising ranking, e.g. one asset outscoring a less-concentrated one) are legible
// rather than opaque: each row shows the raw 0-1 value and how many of the possible points it contributed.
export function ScoreBreakdown({ parts }: { parts: { spread: number; agreement: number; freshness: number; cleanliness: number } }) {
  const rows: { label: string; weight: number; value: number }[] = [
    { label: 'Spread', weight: 0.4, value: parts.spread },
    { label: 'Agreement', weight: 0.3, value: parts.agreement },
    { label: 'Freshness', weight: 0.15, value: parts.freshness },
    { label: 'Cleanliness', weight: 0.15, value: parts.cleanliness },
  ];
  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const pts = r.weight * r.value * 100, max = r.weight * 100;
        return (
          <div key={r.label} className="grid grid-cols-[7rem_1fr_6.5rem] items-center gap-3 text-sm">
            <div>{r.label} <span className="text-xs text-fg-2">{Math.round(r.weight * 100)}%</span></div>
            <div className="h-1.5 bg-raised"><div className="h-1.5 bg-accent" style={{ width: `${Math.max(2, r.value * 100)}%` }} /></div>
            <div className="num text-right text-xs text-fg-2">{pts.toFixed(1)} / {max.toFixed(0)} pts</div>
          </div>
        );
      })}
    </div>
  );
}

export function Legend({ grey = 'CMC doesn’t count' }: { grey?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-2">
      {[['var(--color-good)', 'within 0.5%'], ['var(--color-warn)', 'drifting'], ['var(--color-bad)', 'off-market'], ['var(--color-discard)', grey]].map(([c, l]) => (
        <span key={l} className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-[3px]" style={{ background: c }} />{l}
        </span>
      ))}
      <span className="text-fg-2/70">height = share of volume</span>
    </div>
  );
}
