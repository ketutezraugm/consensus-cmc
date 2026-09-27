import { timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { cmc } from '@/lib/cmc';
import { WATCHLIST } from '@/lib/assets';
import { summarize, summarizeRwa, type RwaAsset } from '@/lib/summary';
import type { Obs, PoolObs, RwaObs } from '@/lib/obs';
import { scoreHistory, anomalyRows, captures } from '@/lib/data';
import { alerts, newAlerts } from '@/lib/alerts';
import { pushAlerts } from '@/lib/telegram';
import { ensureSubscribed, listSubscribers } from '@/lib/subscribers';
import { requiredIntervalMin, captureDue } from '@/lib/budget';
import { errMsg } from '@/lib/fmt';

export const maxDuration = 60;

// Token ucid on-chain -> CMC asset id. WBTC/WETH are wrapped, so a gap can be wrapper risk as well as price.
const ONCHAIN: Record<string, number> = { '3717': 1, '2396': 1027, '1975': 1975 };
const STABLE = new Set(['USDT', 'USDC', 'DAI']);

// Minimal shapes for the fields this route actually reads from each CMC response. Not a full SDK:
// just enough to replace `any` with something that breaks if a field we depend on goes missing.
type KeyInfo = { plan: { credit_limit_monthly: number; credit_limit_monthly_reset_timestamp: string }; usage: { current_month: { credits_used: number } } };
type MarketPair = {
  market_id: number; market_pair_symbol: string; outlier_detected?: boolean; exclusions?: string[];
  market_pair_base?: { crypto_id: number }; exchange: { exchange_id: number; exchange_name: string };
  quotes?: { price: number; volume_24h: number; open_interest?: number; last_updated?: string }[];
  exchange_reported_quotes?: { index_price?: number; index_basis?: number; funding_rate?: number; price?: number }[];
};
type LiqQuote = { long_liquidations_1h: number; short_liquidations_1h: number; long_liquidations_4h: number; short_liquidations_4h: number; long_liquidations_24h: number; short_liquidations_24h: number };
type DexPair = {
  base_asset_ucid: string; base_asset_symbol: string; quote_asset_symbol: string; name: string; contract_address: string;
  quote?: { price: number; volume_24h: number; liquidity: number; last_updated?: string }[];
};
type RwaAssetRow = RwaAsset & { average_tokenized_price?: number | null; tokens?: (NonNullable<RwaAsset['tokens']>[number] & { name: string })[] };

// One row per layer, matching the shared Obs/PoolObs/RwaObs types plus the `layer` discriminant the
// DB and the rest of the app key off. summarize() below narrows back out of this union per layer.
type ForwardRow = Obs & { layer: 'forward' };
type OnchainRow = PoolObs & { layer: 'onchain' };
type RwaRow = RwaObs & { layer: 'rwa' };
type ObsRow = ForwardRow | OnchainRow | RwaRow;
const isForward = (o: ObsRow): o is ForwardRow => o.layer === 'forward';
const isOnchain = (o: ObsRow): o is OnchainRow => o.layer === 'onchain';

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

// Measured cost of one full capture (15 assets + liquidations + DEX + RWA). Pad slightly so the
// budget stays conservative rather than running dry a day before the monthly reset.
const COST_PER_CAPTURE = 22;

export async function POST(req: Request) {
  if (!authorized(req)) return new Response('unauthorized', { status: 401 });
  const params = new URL(req.url).searchParams;
  const dry = params.has('dry');
  const force = params.has('force');

  // Stretch the capture interval so the key's monthly credits last until the reset, instead of
  // exhausting a fresh-tier budget mid-month (or mid-judging-window) and going dark. Skips cost nothing.
  if (!dry && !force) {
    try {
      const [info, existing] = await Promise.all([cmc<KeyInfo>('/v1/key/info'), captures()]);
      const plan = info.data.plan, usage = info.data.usage;
      const interval = requiredIntervalMin({
        limit: plan.credit_limit_monthly, used: usage.current_month.credits_used,
        resetAt: plan.credit_limit_monthly_reset_timestamp, now: Date.now(), costPerCapture: COST_PER_CAPTURE,
      });
      const lastAt = existing[0] ? Date.parse(existing[0]) : null;
      if (!captureDue(lastAt, Date.now(), interval)) {
        return Response.json({ ok: true, skipped: true, reason: 'under the credit budget for this interval', intervalMin: interval, creditsLeft: plan.credit_limit_monthly - usage.current_month.credits_used });
      }
    } catch { /* if the budget check itself fails, fall through and capture at the base cadence */ }
  }

  const at = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
  const warnings: string[] = [];
  let credits = 0;
  const obs: ObsRow[] = [];
  const liq: object[] = [];
  let rwa: RwaAssetRow[] = [];

  // Sequential on purpose: the free tier allows 50 req/min and a capture is ~17 calls.
  for (const [id, sym] of Object.entries(WATCHLIST)) {
    try {
      const r = await cmc<{ market_pairs: MarketPair[] }>('/v5/cryptocurrency/derivatives/market-pairs/list/latest', { crypto_id: id, category: 'perpetual', limit: 250 });
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
    } catch (e: unknown) { warnings.push(`${sym}: ${errMsg(e)}`); }
  }

  try {
    const [byCoin, total] = [
      await cmc<{ cryptocurrencies: { crypto_id: number; symbol: string; quotes?: LiqQuote[] }[] }>('/v5/derivatives/liquidations/cryptocurrency/list/latest', { limit: 250 }),
      await cmc<{ quotes: LiqQuote[] }>('/v5/derivatives/liquidations/quotes/latest'),
    ];
    credits += byCoin.credits + total.credits;
    const row = (id: number, symbol: string, q: LiqQuote) => ({
      captured_at: at, crypto_id: id, symbol,
      long_1h: q.long_liquidations_1h, short_1h: q.short_liquidations_1h,
      long_4h: q.long_liquidations_4h, short_4h: q.short_liquidations_4h,
      long_24h: q.long_liquidations_24h, short_24h: q.short_liquidations_24h,
    });
    liq.push(row(0, 'TOTAL', total.data.quotes[0]));
    for (const c of byCoin.data.cryptocurrencies ?? []) if (c.quotes?.[0]) liq.push(row(c.crypto_id, c.symbol, c.quotes[0]));
  } catch (e: unknown) { warnings.push(`liquidations: ${errMsg(e)}`); }

  try {
    const r = await cmc<DexPair[]>('/v4/dex/spot-pairs/latest', { dex_slug: 'uniswap-v3', network_slug: 'ethereum', limit: 100 });
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
  } catch (e: unknown) { warnings.push(`onchain: ${errMsg(e)}`); }

  // Tokenised assets: every issuer's token for the top-ranked underlyings, in two calls.
  try {
    const list = await cmc<{ rwa_assets: { rwa_id: number | null }[] }>('/v5/real-world-assets/assets/list', { limit: 40 });
    const ids = (list.data.rwa_assets ?? []).map((a) => a.rwa_id).filter((id): id is number => id !== null);
    const q = await cmc<{ rwa_assets: RwaAssetRow[] }>('/v5/real-world-assets/quotes/latest', { rwa_id: ids.join(',') });
    credits += list.credits + q.credits;
    rwa = q.data.rwa_assets ?? [];
    for (const a of rwa) for (const t of a.tokens ?? []) {
      obs.push({
        captured_at: at, crypto_id: a.rwa_id, symbol: a.symbol, layer: 'rwa', venue_id: String(t.crypto_id), venue_name: t.issuer_name,
        price: t.price ?? null, volume_24h: t.volume_24h ?? null,
        extra: { token: t.symbol, name: t.name, mcap: t.market_cap ?? null, asset_type: a.asset_type, avg_price: a.average_tokenized_price ?? null },
      });
    }
  } catch (e: unknown) { warnings.push(`rwa: ${errMsg(e)}`); }

  if (!dry) {
    try { await insert('observations', obs); await insert('liquidations', liq); }
    catch (e: unknown) { return Response.json({ ok: false, at, credits, error: errMsg(e), warnings }, { status: 500 }); }
  }

  // History summaries are derived data: a failure here must never lose the raw capture above.
  const { scores, anomalies } = summarize(obs.filter(isForward), obs.filter(isOnchain), at);
  if (!dry) {
    try { await insert('asset_scores', scores); await insert('anomalies', anomalies); await insert('rwa_scores', summarizeRwa(rwa, at)); }
    catch (e: unknown) { warnings.push(`summaries: ${errMsg(e)}`); }
  }
  // Tell subscribers about alerts that just appeared, filtered to each one's watchlist. Comparing
  // alerts computed without and with this capture means no separate "seen" state needs to be stored.
  let pushed = 0;
  if (!dry && process.env.TELEGRAM_BOT_TOKEN) {
    try {
      // A configured TELEGRAM_CHAT_ID is seeded as an all-symbols subscriber once; never overwrites
      // a chat that already customised its own watchlist via /watch.
      if (process.env.TELEGRAM_CHAT_ID) await ensureSubscribed(process.env.TELEGRAM_CHAT_ID);
      const [sc, an, subs] = await Promise.all([scoreHistory(), anomalyRows(), listSubscribers()]);
      const cut = Date.parse(at);
      pushed = await pushAlerts(newAlerts(
        alerts(sc.filter((x) => Date.parse(x.captured_at) < cut), an.filter((x) => Date.parse(x.captured_at) < cut)), alerts(sc, an),
      ), subs);
    } catch (e: unknown) { warnings.push(`telegram: ${errMsg(e)}`); }
  }

  // New data is in the database; make the next page view rebuild instead of serving the pre-capture cache.
  if (!dry) revalidateTag('data', 'max');

  return Response.json({ ok: true, dry, at, credits, pushed, observations: obs.length, liquidations: liq.length, scores: scores.length, anomalies: anomalies.length, rwa: rwa.length, warnings });
}
