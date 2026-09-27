import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 900, height: 900 }, colorScheme: 'dark' })).newPage();
for (const sym of ['BTC', 'XRP']) {
  await p.goto(`http://localhost:3111/${sym}`, { waitUntil: 'networkidle' });
  await p.locator('main').screenshot({ path: `shots/score-${sym}.png` });
}
await b.close();
