// Prints the exact findings the home page shows, computed by the same code (lib/history.ts's
// findings()), against live recorded data. The fast, canonical way to reproduce every headline number.
// Run: node --no-warnings --env-file=.env.local scripts/report.mjs
import { scoreHistory, anomalyRows } from '../lib/data.ts';
import { findings, latestPerSymbol } from '../lib/history.ts';
import { TRACKED } from '../lib/assets.ts';

const [allRaw, anomsRaw] = await Promise.all([scoreHistory(), anomalyRows()]);
// Matches app/page.tsx: a symbol dropped from the watchlist keeps its old rows in these tables, so
// without this filter its stale last reading would still show up here.
const all = allRaw.filter((s) => TRACKED.has(s.symbol));
const anoms = anomsRaw.filter((a) => TRACKED.has(a.symbol));
const total = new Set(all.map((s) => s.captured_at)).size;
const latest = latestPerSymbol(all);

console.log(`${total} captures recorded\n`);
for (const [i, f] of findings(latest, all, anoms, total).entries()) {
  console.log(`${i + 1}. ${f.k}`);
  console.log(`   ${f.v} — ${f.note}\n`);
}
