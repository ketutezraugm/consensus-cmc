import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, colorScheme: 'dark', deviceScaleFactor: 2 });
const p = await ctx.newPage();
for (const [n, u] of [['m2-home', '/'], ['m2-bch', '/BCH'], ['m2-rwa', '/rwa'], ['m2-rwa-aapl', '/rwa/AAPL'], ['m2-anom', '/anomalies'], ['m2-alerts', '/alerts']]) {
  await p.goto('http://localhost:3111' + u, { waitUntil: 'networkidle' });
  const ov = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  console.log(n, ov.sw > ov.cw ? `OVERFLOW ${ov.sw}px in ${ov.cw}px` : 'ok');
  await p.screenshot({ path: `shots/${n}.png` });
}
await b.close();
