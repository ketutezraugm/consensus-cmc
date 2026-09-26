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
  pair?: string; dup?: boolean;
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

  return { venues: venues.length, vwap, ref, hhi, effectiveVenues: 1 / hhi, top, dispersionBps, funding, basis, excludedShare, agreeingShare, staleShare, stalestMs: stalest, parts, confidence };
}

export type Pool = { name: string; price: number; liquidity: number; volume: number; updated: number };

// DEX pools vs the CEX reference price. Liquidity-weighted so shallow pools cannot set the price.
export function onchain(pools: Pool[], ref: number, now = Date.now()) {
  const live = pools.filter((p) => p.price > 0 && p.liquidity > 0);
  if (live.length === 0 || !(ref > 0)) return null;
  const liq = sum(live.map((p) => p.liquidity));
  const price = sum(live.map((p) => p.price * p.liquidity)) / liq;
  const spreadBps = (Math.sqrt(sum(live.map((p) => (p.liquidity / liq) * (p.price - price) ** 2))) / price) * 1e4;
  const staleShare = sum(live.map((p) => (p.updated && now - p.updated > 1_800_000 ? p.liquidity / liq : 0)));
  return { pools: live.length, liquidity: liq, price, gapBps: (price / ref - 1) * 1e4, spreadBps, staleShare };
}

// Venues CMC trusts for price that quote more than `threshold` away from the trusted median.
export function offConsensus(venues: Venue[], threshold = 0.01) {
  const t = venues.filter((v) => !v.priceExcluded);
  if (t.length === 0) return [];
  const ref = t.map((v) => v.price).sort((a, b) => a - b)[t.length >> 1];
  return t
    .filter((v) => Math.abs(v.price / ref - 1) > threshold)
    .map((v) => ({ id: String(v.id), name: v.name, pair: v.pair ?? '', dup: !!v.dup, volume: v.volume, bps: (v.price / ref - 1) * 1e4 }));
}

// ---- Real-world assets: several issuers' tokens for one underlying ----

export type Tok = { id: number; symbol: string; issuer: string; price: number | null; mcap: number; volume: number };
export type TokKind = 'liquid' | 'thin' | 'derivative' | 'unit' | 'untracked';

// Some tokens are priced per gram (gold) or per fraction of a share. Comparing them raw would publish a
// unit difference as a "97% disagreement". Returns the divisor when price/ref is ~ 1/d or d, else null.
const UNITS = [31.1034768, 1000, 100, 10]; // grams per troy ounce, then powers of ten
export function unitFactor(ratio: number): number | null {
  if (!(ratio > 0)) return null;
  for (const d of UNITS) {
    if (Math.abs(ratio * d - 1) < 0.03) return d;       // priced per 1/d of the reference unit
    if (Math.abs(ratio / d - 1) < 0.03) return 1 / d;   // priced per d units
  }
  return null;
}

function wmedian(vals: number[], w: number[]) {
  const pairs = vals.map((v, i) => [v, w[i] > 0 ? w[i] : 0] as const).sort((a, b) => a[0] - b[0]);
  const tot = sum(pairs.map((p) => p[1]));
  if (tot <= 0) return pairs[pairs.length >> 1][0];
  let acc = 0;
  for (const [v, x] of pairs) { acc += x; if (acc >= tot / 2) return v; }
  return pairs.at(-1)![0];
}

const MIN_VOL = 10_000; // a token trading under $10k/day is not evidence of where the asset prices
const weight = (t: Tok) => (t.mcap > 0 ? t.mcap : t.volume); // ponytail: mixes units when mcap is missing; fine for a median/stdev weight

export function rwaScore(toks: Tok[]) {
  const priced = toks.filter((t) => t.price !== null && t.price > 0);
  const isDeriv = (t: Tok) => /derivative/i.test(t.issuer);
  const liquidish = priced.filter((t) => !isDeriv(t) && t.volume >= MIN_VOL);
  const base = liquidish.length ? liquidish : priced.filter((t) => !isDeriv(t));
  if (base.length === 0) return null;
  const ref = wmedian(base.map((t) => t.price!), base.map(weight));

  const rows = toks.map((t) => {
    const price = t.price !== null && t.price > 0 ? t.price : null;
    const ratio = price ? price / ref : 0;
    const unit = price ? unitFactor(ratio) : null;
    const kind: TokKind = price === null ? 'untracked' : unit ? 'unit' : isDeriv(t) ? 'derivative'
      : t.volume >= MIN_VOL ? 'liquid' : 'thin';
    return { ...t, price, kind, bps: price && !unit ? (price / ref - 1) * 1e4 : null };
  });

  const liq = rows.filter((r) => r.kind === 'liquid');
  const lp = liq.map((r) => r.price!);
  const lw = liq.map(weight);
  const lmc = sum(lw);
  const wmean = lmc > 0 ? sum(liq.map((r) => r.price! * weight(r))) / lmc : ref;
  const spreadBps = liq.length > 1 ? ((Math.max(...lp) - Math.min(...lp)) / ref) * 1e4 : 0;
  const dispersionBps = liq.length > 1 && lmc > 0 ? (Math.sqrt(sum(liq.map((r) => (weight(r) / lmc) * (r.price! - wmean) ** 2))) / ref) * 1e4 : 0;

  const byIssuer = new Map<string, number>();
  for (const t of toks) byIssuer.set(t.issuer, (byIssuer.get(t.issuer) ?? 0) + t.mcap);
  const totalMcap = sum([...byIssuer.values()]);
  const top = [...byIssuer].sort((a, b) => b[1] - a[1])[0];

  return {
    ref, rows, tokens: toks.length, liquid: liq.length, issuers: byIssuer.size, spreadBps, dispersionBps,
    untracked: rows.filter((r) => r.kind === 'untracked').length,
    unitMismatch: rows.filter((r) => r.kind === 'unit').length,
    thinOff: rows.filter((r) => r.kind === 'thin' && r.bps !== null && Math.abs(r.bps) > 100).length,
    topIssuer: top?.[0] ?? '', topShare: totalMcap > 0 ? top[1] / totalMcap : 0, mcap: totalMcap,
  };
}
