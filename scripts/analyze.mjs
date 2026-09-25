// Run: node --no-warnings --env-file=.env.local scripts/analyze.mjs
import { score } from '../lib/consensus.ts';
const { SUPABASE_URL: U, SUPABASE_SERVICE_KEY: K } = process.env;
const get = async (q) => {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${U}/rest/v1/${q}`, { headers: { apikey: K, Authorization: `Bearer ${K}`, Range: `${from}-${from + 999}` } });
    const rows = await r.json(); out.push(...rows); if (rows.length < 1000) return out;
  }
};
const toVenue = (o) => ({
  id: o.venue_id, name: o.venue_name, price: +o.price, volume: +o.volume_24h, oi: +(o.extra.oi ?? 0),
  basis: o.extra.basis, funding: o.extra.funding, updated: o.extra.updated ? Date.parse(o.extra.updated) : 0,
  excluded: o.extra.outlier || o.extra.exclusions.length > 0, priceExcluded: o.extra.outlier || o.extra.exclusions.includes('price'),
});

const caps = [...new Set((await get('observations?select=captured_at&crypto_id=eq.1&order=captured_at')).map((r) => r.captured_at))];
console.log('captures:', caps.length); caps.forEach((c, i) => console.log(' ', c, i ? `+${Math.round((Date.parse(c) - Date.parse(caps[i - 1])) / 60000)}m` : ''));

const kr = await get('observations?select=captured_at,price,venue_id,extra&crypto_id=eq.1&venue_name=eq.Kraken&order=captured_at');
const all = await get('observations?select=captured_at,price,venue_name&crypto_id=eq.1&order=captured_at');
console.log('\nKraken BTC rows per capture:');
for (const c of caps) {
  const px = all.filter((r) => r.captured_at === c).map((r) => +r.price).sort((a, b) => a - b), med = px[px.length >> 1];
  for (const k of kr.filter((r) => r.captured_at === c)) console.log(' ', c.slice(11, 16), k.venue_id, k.extra.pair, 'px', Math.round(k.price), 'vs median', Math.round((k.price / med - 1) * 1e4), 'bps', 'excl', JSON.stringify(k.extra.exclusions), 'outlier', k.extra.outlier);
}

const last = caps.at(-1), rows = await get(`observations?select=*&captured_at=eq.${encodeURIComponent(last)}`);
const by = Object.groupBy(rows, (r) => r.symbol);
console.log('\nlatest capture', last);
console.table(Object.entries(by).map(([s, rs]) => {
  const r = score(rs.map(toVenue), Date.parse(last));
  return { s, venues: r.venues, conf: r.confidence, effV: +r.effectiveVenues.toFixed(1), top: r.top.name, topPct: +(r.top.share * 100).toFixed(1), dispBps: +r.dispersionBps.toFixed(1), exclVolPct: +(r.excludedShare * 100).toFixed(0), fresh: +r.parts.freshness.toFixed(2) };
}));
