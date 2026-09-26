import { timingSafeEqual } from 'node:crypto';
import { cmc } from '@/lib/cmc';
import { WATCHLIST } from '@/lib/assets';
import { summarize } from '@/lib/summary';

export const maxDuration = 60;

// Token ucid on-chain -> CMC asset id. WBTC/WETH are wrapped, so a gap can be wrapper risk as well as price.
const ONCHAIN: Record<string, number> = { '3717': 1, '2396': 1027, '1975': 1975 };
const STABLE = new Set(['USDT', 'USDC', 'DAI']);

const authorized = (req: Request) => {
  const want = Buffer.from(`Bearer ${process.env.INGEST_SECRET ?? ''}`);
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  return want.length > 8 && want.length === got.length && timingSafeEqual(want, got);
};

async function insert(table: string, rows: object[]) {
  const { SUPABASE_URL: url, SUPABASE_SERVICE_KEY: key } = process.env;
  for (let i = 0; i < rows.length; i += 500) {
    const res = await fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (!res.ok) throw new Error(`${table} insert ${res.status}: ${await res.text()}`);
  }
}

export async function POST(req: Request) {
  if (!authorized(req)) return new Response('unauthorized', { status: 401 });
  const dry = new URL(req.url).searchParams.has('dry');
  const at = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
  const warnings: string[] = [];
  let credits = 0;
  const obs: any[] = [];
  const liq: object[] = [];

  // Sequential on purpose: the free tier allows 50 req/min and a capture is ~17 calls.
  for (const [id, sym] of Object.entries(WATCHLIST)) {
    try {
      const r = await cmc('/v5/cryptocurrency/derivatives/market-pairs/list/latest', { crypto_id: id, category: 'perpetual', limit: 250 });
      credits += r.credits;
      const seen = new Map<string, number>();
      for (const p of r.data.market_pairs ?? []) {
        if (p.market_pair_base?.crypto_id !== Number(id)) continue; // drop quote-side pairs
        const q = p.quotes?.[0], x = p.exchange_reported_quotes?.[0];
        if (!q?.price || !q?.volume_24h) continue;
        // CMC sometimes returns one market_id twice with conflicting prices; keep both, suffix the repeat.
        const key = `${p.exchange.exchange_id}:${p.market_id}`, n = (seen.get(key) ?? 0) + 1;
        seen.set(key, n);
        obs.push({
          captured_at: at, crypto_id: Number(id), symbol: sym, layer: 'forward',
          venue_id: n > 1 ? `${key}#${n}` : key, venue_name: p.exchange.exchange_name,
          price: q.price, volume_24h: q.volume_24h,
          extra: {
            pair: p.market_pair_symbol, oi: q.open_interest ?? null, index_price: x?.index_price ?? null,
            basis: x?.index_basis ?? null, funding: x?.funding_rate ?? null, reported_price: x?.price ?? null,
            dup: n > 1, outlier: !!p.outlier_detected, exclusions: p.exclusions ?? [], updated: q.last_updated,
          },
        });
      }
    } catch (e: any) { warnings.push(`${sym}: ${e.message}`); }
  }

  try {
    const [byCoin, total] = [
      await cmc('/v5/derivatives/liquidations/cryptocurrency/list/latest', { limit: 250 }),
      await cmc('/v5/derivatives/liquidations/quotes/latest'),
    ];
    credits += byCoin.credits + total.credits;
    const row = (id: number, symbol: string, q: any) => ({
      captured_at: at, crypto_id: id, symbol,
      long_1h: q.long_liquidations_1h, short_1h: q.short_liquidations_1h,
      long_4h: q.long_liquidations_4h, short_4h: q.short_liquidations_4h,
      long_24h: q.long_liquidations_24h, short_24h: q.short_liquidations_24h,
    });
    liq.push(row(0, 'TOTAL', total.data.quotes[0]));
    for (const c of byCoin.data.cryptocurrencies ?? []) if (c.quotes?.[0]) liq.push(row(c.crypto_id, c.symbol, c.quotes[0]));
  } catch (e: any) { warnings.push(`liquidations: ${e.message}`); }

  try {
    const r = await cmc('/v4/dex/spot-pairs/latest', { dex_slug: 'uniswap-v3', network_slug: 'ethereum', limit: 100 });
    credits += r.credits;
    for (const p of r.data ?? []) {
      const id = ONCHAIN[p.base_asset_ucid], q = p.quote?.[0];
      if (!id || !STABLE.has(p.quote_asset_symbol) || !q?.price) continue;
      obs.push({
        captured_at: at, crypto_id: id, symbol: WATCHLIST[id], layer: 'onchain',
        venue_id: p.contract_address, venue_name: `Uniswap v3 ${p.name}`, price: q.price, volume_24h: q.volume_24h,
        extra: { pair: p.name, token: p.base_asset_symbol, liquidity: q.liquidity, updated: q.last_updated },
      });
    }
  } catch (e: any) { warnings.push(`onchain: ${e.message}`); }

  if (!dry) {
    try { await insert('observations', obs); await insert('liquidations', liq); }
    catch (e: any) { return Response.json({ ok: false, at, credits, error: e.message, warnings }, { status: 500 }); }
  }

  // History summaries are derived data: a failure here must never lose the raw capture above.
  const { scores, anomalies } = summarize(obs.filter((o) => o.layer === 'forward'), obs.filter((o) => o.layer === 'onchain'), at);
  if (!dry) {
    try { await insert('asset_scores', scores); await insert('anomalies', anomalies); }
    catch (e: any) { warnings.push(`summaries: ${e.message}`); }
  }
  return Response.json({ ok: true, dry, at, credits, observations: obs.length, liquidations: liq.length, scores: scores.length, anomalies: anomalies.length, warnings });
}
