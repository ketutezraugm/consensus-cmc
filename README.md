# Consensus

**CoinMarketCap publishes one price per asset. Consensus shows how that price is made across perpetual-futures venues, how concentrated it is, and where the venues disagree.**

Live: https://consensus-cmc.vercel.app · Track: **Data and Visualisation** · Built for [Build with CMC: API Hackathon](https://dorahacks.io/hackathon/coinmarketcap-api-202609/detail) · #BuildwithCMC

Every 30 minutes a recorder captures per-venue price, volume, open interest, funding and basis for 15 assets (about 2,000 venue rows per capture), plus liquidations and Uniswap v3 pools. The site scores each asset and shows *who sets the price*.

## What it found

Recorded 2026-09-25 to 2026-09-26. Reproduce every number below with `node --no-warnings --env-file=.env.local scripts/findings.mjs`.

| Finding | Evidence |
|---|---|
| **BCH perp volume is one venue.** Deepcoin reports 93.0-94.1% of BCH's 24h perp volume, about 220x the next venue. CMC excludes only 3% of BCH volume. | Present in every capture |
| **The API returns some markets twice with conflicting prices.** Kraken's BTC perp (`market_id` 47233) appears as $84,012 and $66,959 in the same response; neither row is flagged. Same for Kraken ETH/XRP/LTC and DigiFinex ETH. | Every capture since duplicates were kept |
| **SunX quotes 2-24% below the median on 8+ assets and is never flagged.** | All captures. Its volume is small ($0.3M-$5M), so it barely moves an aggregate |
| **CMC excludes a median 46% of perp volume** from its own aggregation (3%-63% by asset). | Every capture |
| **DEX and exchange prices agree.** Liquidity-weighted Uniswap v3 prices are within 0-5 bps of the exchange reference for BTC, ETH, LINK. | A consistency result, not an anomaly |

What these do **not** show: whether CMC's headline price actually uses the flagged rows, or whether Deepcoin's volume is real. They are observations about what the API returns.

## How it works

```
Supabase pg_cron ──POST──> /api/ingest ──> CMC API ──> Supabase (observations, liquidations)
                                                                              │
                                   browser <── Next.js server components <────┘  scoring in lib/consensus.ts
```

- `lib/consensus.ts` is pure scoring code with no I/O. `test/consensus.test.mjs` covers it, including the degenerate cases (single venue, zero volume, zero open interest, negative funding, dead pools).
- **Confidence (0-100)** blends volume spread across venues (40%), share of volume within 50 bps of the median (30%), freshness (15%) and share of volume CMC excludes (15%). **The weights are a judgement call, not a fitted model**, and the score currently separates outliers like BCH better than it ranks healthy assets (most sit at 86-94).
- Price statistics use only venues CMC itself trusts for price (`exclusions` does not contain `price`).
- The on-chain layer covers BTC (via WBTC), ETH (via WETH) and LINK only. Wrapped tokens are not the underlying, so part of any gap can be wrapper risk.

## CMC endpoints used

| Endpoint | Used for | Credits |
|---|---|---|
| `GET /v5/cryptocurrency/derivatives/market-pairs/list/latest` (`crypto_id`, `category=perpetual`, `limit=250`) | Per-venue price, volume, open interest, index price, basis, funding, `outlier_detected`, `exclusions`. 15 calls per capture. | 1 per 250 pairs |
| `GET /v5/derivatives/liquidations/cryptocurrency/list/latest` | Long/short liquidations, 1h/4h/24h, per asset | 1 |
| `GET /v5/derivatives/liquidations/quotes/latest` | Market-wide liquidations | 1 |
| `GET /v4/dex/spot-pairs/latest` (`dex_slug=uniswap-v3`, `network_slug=ethereum`) | Pool price, liquidity, volume for WBTC/WETH/LINK vs stablecoins | 1 |

About 18 credits per capture, roughly 900 a day. Everything ran on the free Basic tier.

Also probed during development, not used by the product: `/v1/cryptocurrency/quotes/latest`, `/v5/exchange/derivatives/list`, `/v5/real-world-assets/{map,assets/list,issuers/list}` (all 200 on Basic), and `/v2/cryptocurrency/market-pairs/latest` and `/v1/exchange/listings/latest` (403 on Basic). Raw responses are in [`scripts/out/`](scripts/out).

## Evidence of real API calls

Code: [`scripts/probe.mjs`](scripts/probe.mjs) and [`app/api/ingest/route.ts`](app/api/ingest/route.ts). Responses: [`scripts/out/`](scripts/out). A trimmed real response from `derivatives/liquidations/quotes/latest`:

```json
{ "data": { "quotes": [ { "symbol": "USD", "total_liquidations_24h": 271450100.5357326,
    "long_liquidations_24h": 140387785.74551252, "short_liquidations_24h": 131062314.79022013,
    "last_updated": "2026-09-25T16:31:00.000Z" } ] },
  "status": { "timestamp": "2026-09-25T16:33:18.280Z", "error_code": "0", "credit_count": 1 } }
```

And the duplicate-market response (`scripts/out/deriv-pairs.json`, Kraken, same `market_id`, same `last_updated`):

```
market_id 47233  XBT/USD perpetual  price 84012.0   reported 84027   exclusions []
market_id 47233  XBT/USD perpetual  price 66959.0   reported 66922   exclusions []
```

## What the API made possible, and where it got in the way

Full list with 17 items in [`docs/api-feedback.md`](docs/api-feedback.md). The short version:

- **Made possible:** one call returns per-venue price, volume, open interest, index price, basis and funding, plus CMC's own `outlier_detected` and `exclusions`. Exposing the exclusions is what makes an analysis of *how the headline price is made* possible at all.
- **In the way:** the docs do not say which tier each endpoint needs (derivatives and RWA answered on Basic, spot market-pairs did not); `market_id` is not a unique key; the endpoint mixes base-side and quote-side pairs; `/v4/dex/networks/list` returned a 500; `limit=200` silently returns 100; RWA data has no underlying price, so tokenised-vs-underlying comparison is not possible yet.

## Run it

```bash
cp .env.example .env.local        # CMC_API_KEY, INGEST_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY
# run supabase/migrations/0001_observations.sql in your Supabase SQL editor
npm install && npm run dev
node --no-warnings --test         # scoring tests
node --env-file=.env.local scripts/probe.mjs   # call every endpoint family once
curl -X POST -H "Authorization: Bearer $INGEST_SECRET" localhost:3000/api/ingest   # one capture (?dry=1 to skip the write)
```

Scheduling: captures run every 30 minutes from Supabase `pg_cron` calling the ingest endpoint ([`supabase/cron.example.sql`](supabase/cron.example.sql)). `.github/workflows/ingest.yml` is a manual trigger only: GitHub throttled its cron to one run every 3-5 hours, too coarse for the history. Keys live only in environment variables and are never committed.
