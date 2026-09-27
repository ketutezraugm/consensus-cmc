// Prints the exact findings the home page shows, computed by the same code (lib/history.ts's
// findings()), against live recorded data. The fast, canonical way to reproduce every headline number.
// Run: node --no-warnings --env-file=.env.local scripts/report.mjs
import { scoreHistory, anomalyRows } from '../lib/data.ts';
import { findings, latestPerSymbol } from '../lib/history.ts';

const [all, anoms] = await Promise.all([scoreHistory(), anomalyRows()]);
const total = new Set(all.map((s) => s.captured_at)).size;
const latest = latestPerSymbol(all);

console.log(`${total} captures recorded\n`);
for (const [i, f] of findings(latest, all, anoms, total).entries()) {
  console.log(`${i + 1}. ${f.k}`);
  console.log(`   ${f.v} — ${f.note}\n`);
}
