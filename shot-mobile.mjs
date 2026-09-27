import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2 });
const p = await ctx.newPage();
const site = 'https://consensus-cmc.vercel.app';
for (const [n, u] of [['m-home', '/'], ['m-bch', '/BCH'], ['m-rwa', '/rwa']]) {
  await p.goto(site + u, { waitUntil: 'networkidle' });
  const overflow = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  console.log(n, 'horizontal overflow:', overflow.sw > overflow.cw ? `YES (${overflow.sw}px in ${overflow.cw}px)` : 'no');
  await p.screenshot({ path: `shots/${n}.png` });
}
await b.close();
