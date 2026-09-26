// Rebuild asset_scores + anomalies for every capture already in `observations`.
// Idempotent (ignore-duplicates). Run: node --no-warnings --env-file=.env.local scripts/backfill.mjs
import { summarize } from '../lib/summary.ts';
const { SUPABASE_URL: U, SUPABASE_SERVICE_KEY: K } = process.env;
const H = { apikey: K, Authorization: `Bearer ${K}` };
const get = async (q) => {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${U}/rest/v1/${q}`, { headers: { ...H, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    const rows = await r.json(); out.push(...rows); if (rows.length < 1000) return out;
  }
};
const post = async (t, rows) => {
  for (let i = 0; i < rows.length; i += 500) {
    const r = await fetch(`${U}/rest/v1/${t}`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 500)) });
    if (!r.ok) throw new Error(`${t}: ${r.status} ${await r.text()}`);
  }
};
const caps = (await get('liquidations?select=captured_at&crypto_id=eq.0&order=captured_at')).map((r) => r.captured_at);
let s = 0, a = 0;
for (const c of caps) {
  const rows = await get(`observations?select=*&captured_at=eq.${encodeURIComponent(c)}`);
  const { scores, anomalies } = summarize(rows.filter((r) => r.layer === 'forward'), rows.filter((r) => r.layer === 'onchain'), c);
  await post('asset_scores', scores); await post('anomalies', anomalies); s += scores.length; a += anomalies.length;
  console.log(c, `scores ${scores.length} anomalies ${anomalies.length}`);
}
console.log(`done: ${caps.length} captures, ${s} score rows, ${a} anomaly rows`);
