// Turns recorded history into a short list of things a trader should know about right now. Pure, no I/O.
import type { Score, Anom } from './history.ts';

export type Alert = {
  id: string; kind: 'concentration' | 'off-market' | 'confidence-drop' | 'dex-gap';
  severity: 'high' | 'medium'; symbol: string; title: string; detail: string; since: string; href: string;
};

export const THRESHOLDS = {
  concentration: 0.5,   // one venue holds this share of 24h volume
  offMarketBps: 100,    // a CMC-trusted venue quotes this far from the median
  offMarketVolume: 1e6, // and trades at least this much a day, so dust does not page anyone
  confidenceDrop: 15,   // points below the recent median
  dexGapBps: 30,
};

// Start of the unbroken run of captures (ending at the latest) for which `holds` is true.
function runStart<T extends { captured_at: string }>(rows: T[], holds: (r: T) => boolean): string {
  let since = rows.at(-1)!.captured_at;
  for (let i = rows.length - 1; i >= 0 && holds(rows[i]); i--) since = rows[i].captured_at;
  return since;
}
const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];

export function alerts(scores: Score[], anoms: Anom[]): Alert[] {
  const out: Alert[] = [];
  const bySym = Object.groupBy(scores, (s) => s.symbol);

  for (const [symbol, all] of Object.entries(bySym)) {
    const rows = [...all!].sort((a, b) => a.captured_at.localeCompare(b.captured_at));
    const now = rows.at(-1)!;

    if (now.top_share >= THRESHOLDS.concentration) {
      out.push({
        id: `conc:${symbol}`, kind: 'concentration', severity: now.top_share >= 0.8 ? 'high' : 'medium', symbol,
        title: `${symbol}: ${Math.round(now.top_share * 100)}% of perp volume is on ${now.top_venue}`,
        detail: `The price is effectively set by one venue (${now.effective_venues.toFixed(1)} effective venues of ${now.venues}).`,
        since: runStart(rows, (r) => r.top_share >= THRESHOLDS.concentration), href: `/${symbol}`,
      });
    }

    const recent = rows.slice(-7, -1).map((r) => r.confidence);
    if (recent.length >= 3 && med(recent) - now.confidence >= THRESHOLDS.confidenceDrop) {
      out.push({
        id: `drop:${symbol}`, kind: 'confidence-drop', severity: 'medium', symbol,
        title: `${symbol}: confidence fell to ${now.confidence}`, detail: `It was around ${med(recent)} over the previous captures.`,
        since: now.captured_at, href: `/${symbol}`,
      });
    }

    if (now.dex_gap_bps !== null && Math.abs(now.dex_gap_bps) >= THRESHOLDS.dexGapBps) {
      out.push({
        id: `dex:${symbol}`, kind: 'dex-gap', severity: 'medium', symbol,
        title: `${symbol}: on-chain price is ${Math.round(now.dex_gap_bps)} bps from exchanges`,
        detail: 'Liquidity-weighted Uniswap v3 pools against the exchange reference.', since: now.captured_at, href: `/${symbol}`,
      });
    }
  }

  // Off-market venues that matter (real volume) in the latest capture, with how long they have been off.
  if (anoms.length) {
    const latest = anoms.reduce((m, a) => (a.captured_at > m ? a.captured_at : m), '');
    const caps = [...new Set(anoms.map((a) => a.captured_at))].sort();
    const key = (a: Anom) => `${a.symbol}|${a.venue_name}|${a.pair ?? ''}`;
    const material = (a: Anom) => Math.abs(a.bps) >= THRESHOLDS.offMarketBps && +a.volume_24h >= THRESHOLDS.offMarketVolume;
    const seen = new Map<string, Set<string>>();
    for (const a of anoms) if (material(a)) (seen.get(key(a)) ?? seen.set(key(a), new Set()).get(key(a))!).add(a.captured_at);

    for (const a of anoms.filter((x) => x.captured_at === latest && material(x))) {
      const have = seen.get(key(a))!;
      let since = latest;
      for (let i = caps.length - 1; i >= 0 && have.has(caps[i]); i--) since = caps[i];
      out.push({
        id: `off:${key(a)}`, kind: 'off-market', severity: Math.abs(a.bps) >= 300 ? 'high' : 'medium', symbol: a.symbol,
        title: `${a.symbol}: ${a.venue_name} is ${Math.round(a.bps)} bps off the market`,
        detail: `${a.pair ?? 'perp'}, $${(+a.volume_24h / 1e6).toFixed(1)}M 24h volume, and CMC does not exclude it.`, since, href: `/${a.symbol}`,
      });
    }
  }

  return out.sort((a, b) => (a.severity === b.severity ? a.since.localeCompare(b.since) : a.severity === 'high' ? -1 : 1));
}

// Alerts present now that were not present before: what is worth pushing to a person.
export const newAlerts = (before: Alert[], now: Alert[]) => {
  const had = new Set(before.map((a) => a.id));
  return now.filter((a) => !had.has(a.id));
};
