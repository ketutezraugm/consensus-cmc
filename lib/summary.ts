// Turns one capture's raw observations into the small per-asset rows the site charts over time.
import { score, offConsensus, onchain } from './consensus.ts';
import { toVenue, type Obs, type PoolObs } from './obs.ts';

export function summarize(fwd: Obs[], pools: PoolObs[], at: string) {
  const now = Date.parse(at);
  const scores: object[] = [], anomalies: object[] = [];
  const poolsBy = Object.groupBy(pools, (p) => p.crypto_id);
  for (const rs of Object.values(Object.groupBy(fwd, (o) => o.crypto_id))) {
    const venues = rs!.map(toVenue), r = score(venues, now);
    if (!r) continue;
    const dex = onchain((poolsBy[rs![0].crypto_id] ?? []).map((p) => ({
      name: p.venue_name, price: +p.price, liquidity: p.extra.liquidity, volume: +p.volume_24h, updated: p.extra.updated ? Date.parse(p.extra.updated) : 0,
    })), r.ref, now);
    scores.push({
      captured_at: at, crypto_id: rs![0].crypto_id, symbol: rs![0].symbol, venues: r.venues, confidence: r.confidence,
      effective_venues: r.effectiveVenues, top_venue: r.top.name, top_share: r.top.share, agreeing_share: r.agreeingShare,
      excluded_share: r.excludedShare, stale_share: r.staleShare, dispersion_bps: r.dispersionBps,
      dup_markets: venues.filter((v) => v.dup).length, dex_gap_bps: dex?.gapBps ?? null, funding: r.funding, basis: r.basis,
    });
    for (const a of offConsensus(venues)) {
      anomalies.push({ captured_at: at, symbol: rs![0].symbol, venue_id: a.id, venue_name: a.name, pair: a.pair, bps: a.bps, volume_24h: a.volume, dup: a.dup });
    }
  }
  return { scores, anomalies };
}
