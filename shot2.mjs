import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 }, colorScheme: 'dark' })).newPage();
for (const [n, u] of [['rwa', '/rwa'], ['rwa-spcx', '/rwa/SPCX'], ['rwa-gold', '/rwa/GOLD']]) {
  await p.goto('http://localhost:3111' + u, { waitUntil: 'networkidle' }); await p.screenshot({ path: `shots/${n}.png` });
}
await b.close(); console.log('shots done');
