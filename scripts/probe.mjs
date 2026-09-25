// Calls one endpoint per family, prints status, saves raw JSON to scripts/out/.
// Run: node --env-file=.env.local scripts/probe.mjs
import { writeFileSync, mkdirSync } from 'node:fs';

const key = process.env.CMC_API_KEY;
if (!key) { console.error('CMC_API_KEY missing in .env.local'); process.exit(1); }

const BASE = 'https://pro-api.coinmarketcap.com';
const probes = {
  'spot-quotes':        '/v1/cryptocurrency/quotes/latest?symbol=BTC,ETH',
  'spot-market-pairs':  '/v2/cryptocurrency/market-pairs/latest?symbol=BTC&limit=50',
  'exchange-listings':  '/v1/exchange/listings/latest?limit=20',
  'deriv-pairs':        '/v5/cryptocurrency/derivatives/market-pairs/list/latest?crypto_symbol=BTC&limit=100',
  'deriv-liq-crypto':   '/v5/derivatives/liquidations/cryptocurrency/list/latest?limit=20',
  'deriv-liq-total':    '/v5/derivatives/liquidations/quotes/latest',
  'deriv-exchanges':    '/v5/exchange/derivatives/list?limit=20',
  'rwa-map':            '/v5/real-world-assets/map',
  'rwa-list':           '/v5/real-world-assets/assets/list?limit=10',
  'rwa-issuers':        '/v5/real-world-assets/issuers/list',
};

mkdirSync('scripts/out', { recursive: true });
for (const [name, path] of Object.entries(probes)) {
  try {
    const res = await fetch(BASE + path, { headers: { 'X-CMC_PRO_API_KEY': key, Accept: 'application/json' } });
    const body = await res.json().catch(() => null);
    const err = body?.status?.error_message;
    console.log(`${res.status} ${name.padEnd(18)} ${err ?? 'ok'}  credits=${body?.status?.credit_count ?? '-'}`);
    writeFileSync(`scripts/out/${name}.json`, JSON.stringify(body, null, 2));
  } catch (e) {
    console.log(`ERR ${name.padEnd(18)} ${e.message}`);
  }
}
