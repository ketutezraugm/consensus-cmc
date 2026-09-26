// Do the single-snapshot anomalies persist across captures?
// Run: node --no-warnings --env-file=.env.local scripts/findings.mjs
const { SUPABASE_URL: U, SUPABASE_SERVICE_KEY: K } = process.env;
const get = async (q) => {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${U}/rest/v1/${q}`, { headers: { apikey: K, Authorization: `Bearer ${K}`, Range: `${from}-${from + 999}` } });
    const rows = await r.json(); out.push(...rows); if (rows.length < 1000) return out;
  }
};
const rows = await get('observations?select=captured_at,symbol,venue_id,venue_name,price,volume_24h,extra&layer=eq.forward&order=captured_at');
const caps = [...new Set(rows.map((r) => r.captured_at))];
const byCap = Object.groupBy(rows, (r) => r.captured_at);
const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
console.log(`${caps.length} captures, ${rows.length} venue observations, ${caps[0]} -> ${caps.at(-1)}\n`);

// 1. Volume concentration: largest single-venue share per asset, across captures
const conc = {};
for (const c of caps) for (const [sym, rs] of Object.entries(Object.groupBy(byCap[c], (r) => r.symbol))) {
  const tot = rs.reduce((s, r) => s + +r.volume_24h, 0), top = rs.reduce((m, r) => (+r.volume_24h > +m.volume_24h ? r : m));
  (conc[sym] ??= []).push({ share: +top.volume_24h / tot, name: top.venue_name });
}
console.log('1. Top-venue share of 24h perp volume, per asset (min / median / max over captures)');
console.table(Object.entries(conc).map(([s, a]) => {
  const sh = a.map((x) => x.share);
  return { asset: s, min: +(Math.min(...sh) * 100).toFixed(1), median: +(med(sh) * 100).toFixed(1), max: +(Math.max(...sh) * 100).toFixed(1), topVenue: med(a.map((x) => x.name)) };
}).sort((a, b) => b.median - a.median).slice(0, 6));

// 2. Duplicate market rows
const dups = {};
for (const r of rows) if (r.extra.dup) { const k = `${r.symbol} ${r.venue_name}`; (dups[k] ??= new Set()).add(r.captured_at); }
console.log('2. Duplicate market_id rows (captures observed in)');
console.table(Object.entries(dups).map(([k, s]) => ({ market: k, captures: s.size })));

// 3. Venues CMC does not exclude that quote >1% off the median of trusted venues
const off = {};
for (const c of caps) for (const [sym, rs] of Object.entries(Object.groupBy(byCap[c], (r) => r.symbol))) {
  const trusted = rs.filter((r) => !r.extra.outlier && !r.extra.exclusions.includes('price'));
  const m = med(trusted.map((r) => +r.price));
  for (const r of trusted) if (Math.abs(r.price / m - 1) > 0.01) {
    const k = `${sym} ${r.venue_name} ${r.extra.pair}`; (off[k] ??= { n: 0, bps: [], vol: 0 }); off[k].n++; off[k].bps.push((r.price / m - 1) * 1e4); off[k].vol = Math.max(off[k].vol, +r.volume_24h);
  }
}
console.log(`3. Unflagged venues >1% off the trusted median (of ${caps.length} captures)`);
console.table(Object.entries(off).map(([k, v]) => ({ venue: k, captures: v.n, medianBps: Math.round(med(v.bps)), maxVolM: +(v.vol / 1e6).toFixed(1) })).sort((a, b) => b.captures - a.captures).slice(0, 10));

// 4. Share of volume CMC itself excludes
const ex = {};
for (const c of caps) for (const [sym, rs] of Object.entries(Object.groupBy(byCap[c], (r) => r.symbol))) {
  const tot = rs.reduce((s, r) => s + +r.volume_24h, 0), e = rs.filter((r) => r.extra.outlier || r.extra.exclusions.length).reduce((s, r) => s + +r.volume_24h, 0);
  (ex[sym] ??= []).push(e / tot);
}
const all = Object.values(ex).map((a) => med(a));
console.log(`4. Median share of perp volume CMC excludes: ${(med(all) * 100).toFixed(0)}% (range ${(Math.min(...all) * 100).toFixed(0)}%-${(Math.max(...all) * 100).toFixed(0)}% across assets)`);
