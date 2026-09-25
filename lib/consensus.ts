// Pure scoring over CMC derivatives market-pairs. No I/O.
// Input shape: one element of data.market_pairs from
// /v5/cryptocurrency/derivatives/market-pairs/list/latest

export type Pair = {
  outlier_detected?: boolean;
  exclusions?: string[];
  category?: string;
  market_pair_base?: { crypto_id: number };
  exchange: { exchange_id: number; exchange_name: string };
  exchange_reported_quotes?: { index_basis?: number; funding_rate?: number; index_price?: number; last_updated?: string }[];
  quotes: { price: number; volume_24h: number; open_interest?: number; last_updated?: string }[];
};

export type Venue = {
  id: number; name: string; price: number; volume: number; oi: number;
  basis: number | null; funding: number | null; updated: number;
  excluded: boolean;      // CMC dropped it from price or volume aggregation
  priceExcluded: boolean; // CMC does not trust its price
};

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

// Only perpetuals where `cryptoId` is the BASE: the endpoint also returns pairs
// where the asset is the quote side (priced at $0.26, $13.9, ...), which are not the asset's price.
export function toVenues(pairs: Pair[], cryptoId?: number, category = 'perpetual'): Venue[] {
  return pairs
    .filter((p) => (cryptoId === undefined || p.market_pair_base?.crypto_id === cryptoId) && (!p.category || p.category === category))
    .map((p) => {
      const q = p.quotes?.[0], r = p.exchange_reported_quotes?.[0];
      return {
        id: p.exchange.exchange_id, name: p.exchange.exchange_name,
        price: num(q?.price), volume: num(q?.volume_24h), oi: num(q?.open_interest),
        basis: r?.index_basis ?? null, funding: r?.funding_rate ?? null,
        excluded: !!p.outlier_detected || (p.exclusions?.length ?? 0) > 0,
        priceExcluded: !!p.outlier_detected || !!p.exclusions?.includes('price'),
        updated: q?.last_updated ? Date.parse(q.last_updated) : 0,
      };
    })
    .filter((v) => v.price > 0 && v.volume > 0);
}

const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

// Weighted mean; null when total weight is 0 or no values.
function wmean(vals: (number | null)[], w: number[]) {
  let n = 0, d = 0;
  vals.forEach((v, i) => { if (v !== null && w[i] > 0) { n += v * w[i]; d += w[i]; } });
  return d > 0 ? n / d : null;
}

export function score(venues: Venue[], now = Date.now()) {
  if (venues.length === 0) return null;
  const vol = venues.map((v) => v.volume), totalVol = sum(vol);
  const shares = vol.map((x) => x / totalVol);
  const hhi = sum(shares.map((s) => s * s));                 // 1/n .. 1
  const top = venues.map((v, i) => ({ name: v.name, share: shares[i] })).sort((a, b) => b.share - a.share)[0];

  // Price stats use only venues CMC itself trusts for price; the rest are reported, not averaged in.
  const pv = venues.filter((v) => !v.priceExcluded);
  const pvol = pv.map((v) => v.volume), ptot = sum(pvol);
  const vwap = ptot > 0 ? wmean(pv.map((v) => v.price), pvol)! : wmean(venues.map((v) => v.price), vol)!;
  const base = ptot > 0 ? pv : venues, bw = ptot > 0 ? pvol.map((x) => x / ptot) : shares;
  const dispersionBps = (Math.sqrt(sum(base.map((v, i) => bw[i] * (v.price - vwap) ** 2))) / vwap) * 1e4;

  const oi = venues.map((v) => v.oi);
  const funding = wmean(venues.map((v) => v.funding), oi);   // per funding interval, OI-weighted
  const basis = wmean(venues.map((v) => v.basis), oi);

  const STALE_MS = 600_000;
  const stalest = venues.reduce((m, v) => Math.max(m, v.updated && !v.excluded ? now - v.updated : 0), 0);
  const staleShare = sum(venues.map((v, i) => (!v.excluded && v.updated && now - v.updated > STALE_MS ? shares[i] : 0)));
  // Share of price-trusted volume quoting within 50 bps of the trusted-venue median.
  const ref = [...base].map((v) => v.price).sort((a, b) => a - b)[base.length >> 1];
  const bvol = sum(base.map((v) => v.volume));
  const agreeingShare = bvol > 0 ? sum(base.map((v) => (Math.abs(v.price / ref - 1) <= 0.005 ? v.volume : 0))) / bvol : 0;
  const excludedShare = sum(venues.map((v, i) => (v.excluded ? shares[i] : 0)));

  // Transparent 0-100 blend; each term is 0..1, higher = more trustworthy.
  const parts = {
    spread: 1 - hhi,
    agreement: agreeingShare,
    freshness: 1 - staleShare,
    cleanliness: 1 - excludedShare,
  };
  const confidence = Math.round(100 * (0.4 * parts.spread + 0.3 * parts.agreement + 0.15 * parts.freshness + 0.15 * parts.cleanliness));

  return { venues: venues.length, vwap, hhi, effectiveVenues: 1 / hhi, top, dispersionBps, funding, basis, excludedShare, agreeingShare, staleShare, stalestMs: stalest, parts, confidence };
}
