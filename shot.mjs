import { chromium } from 'playwright';
const b = await chromium.launch();
for (const scheme of ['light', 'dark']) {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme })).newPage();
  for (const [name, url] of [['home', '/'], ['bch', '/BCH'], ['anom', '/anomalies']]) {
    await p.goto((process.argv[2] ?? 'http://localhost:3111') + url, { waitUntil: 'networkidle' });
    await p.screenshot({ path: `./shots/${scheme}-${name}.png`, fullPage: false });
  }
}
await b.close(); console.log('done');
