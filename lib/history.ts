// Pure aggregation over recorded history (asset_scores + anomalies). No I/O.
import { pct } from './fmt.ts';

export type Score = {
  captured_at: string; crypto_id: number; symbol: string; venues: number; confidence: number; effective_venues: number;
  top_venue: string; top_share: number; agreeing_share: number; excluded_share: number; stale_share: number;
  dispersion_bps: number; dup_markets: number; dex_gap_bps: number | null; funding: number | null; basis: number | null;
};
export type Anom = { captured_at: string; symbol: string; venue_name: string; pair: string | null; bps: number; volume_24h: number; dup: boolean };

const med = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : 0);

function stats(rows: Anom[], key: (a: Anom) => string, total: number) {
  const g = new Map<string, Anom[]>();
  for (const r of rows) (g.get(key(r)) ?? g.set(key(r), []).get(key(r))!).push(r);
  return [...g].map(([k, rs]) => {
    const caps = new Set(rs.map((r) => r.captured_at));
    return {
      key: k, captures: caps.size, presence: total > 0 ? caps.size / total : 0,
      assets: [...new Set(rs.map((r) => r.symbol))].sort(), medianBps: med(rs.map((r) => +r.bps)),
      maxVolume: Math.max(...rs.map((r) => +r.volume_24h)), first: rs.reduce((m, r) => (r.captured_at < m ? r.captured_at : m), rs[0].captured_at),
      last: rs.reduce((m, r) => (r.captured_at > m ? r.captured_at : m), rs[0].captured_at),
    };
  });
}

// Venues that quote >1% off the trusted median while CMC still trusts them, ranked by breadth x persistence.
export const venueBoard = (rows: Anom[], total: number) =>
  stats(rows, (a) => a.venue_name, total).sort((a, b) => b.assets.length * b.presence - a.assets.length * a.presence || b.captures - a.captures);

export const marketBoard = (rows: Anom[], total: number) =>
  stats(rows, (a) => `${a.symbol} ${a.venue_name} ${a.pair ?? ''}`.trim(), total).sort((a, b) => b.captures - a.captures || Math.abs(b.medianBps) - Math.abs(a.medianBps));

export type Finding = { k: string; v: string; note: string; href: string };

// Headline findings, all computed from recorded data (nothing hard-coded).
export function findings(latest: Score[], all: Score[], anoms: Anom[], total: number): Finding[] {
  const out: Finding[] = [];
  if (latest.length === 0) return out;

  const top = latest.reduce((m, s) => (s.top_share > m.top_share ? s : m));
  const runs = all.filter((s) => s.symbol === top.symbol && s.top_share >= 0.9).length;
  const seen = all.filter((s) => s.symbol === top.symbol).length;
  out.push({
    k: `${top.symbol} perp volume held by one venue (${top.top_venue})`, v: pct(top.top_share, 0),
    note: runs > 0 ? `at 90% or more in ${runs} of ${seen} captures` : 'the most concentrated asset right now', href: `/${top.symbol}`,
  });

  const v = venueBoard(anoms, total)[0];
  if (v) out.push({
    k: `${v.key} quotes off-market, and CMC does not exclude it`, v: `${v.assets.length} assets`,
    note: `${v.captures} of ${total} captures, typically ${Math.abs(Math.round(v.medianBps / 100))}% ${v.medianBps < 0 ? 'below' : 'above'} the median`, href: '/anomalies',
  });

  const dups = latest.reduce((s, x) => s + (x.dup_markets ?? 0), 0);
  out.push({ k: 'markets returned twice by the API with conflicting prices', v: String(dups), note: 'in the latest capture, none flagged by CMC', href: '/anomalies' });

  const ex = latest.map((s) => s.excluded_share).sort((a, b) => a - b);
  out.push({ k: 'of perp volume CMC excludes from its own aggregation', v: pct(ex[ex.length >> 1], 0), note: `median across assets, ${pct(ex[0], 0)} to ${pct(ex.at(-1)!, 0)}`, href: '/' });
  return out;
}

// Latest row per symbol.
export function latestPerSymbol(all: Score[]) {
  const m = new Map<string, Score>();
  for (const s of all) if (!m.has(s.symbol) || s.captured_at > m.get(s.symbol)!.captured_at) m.set(s.symbol, s);
  return [...m.values()];
}
