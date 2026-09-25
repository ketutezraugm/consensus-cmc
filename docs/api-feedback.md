# API feedback

Written from real calls (probe output in `scripts/out/`, run 2026-09-25 on the free Basic tier).

## What the API made possible
- `/v5/cryptocurrency/derivatives/market-pairs/list/latest` returns per-venue price, volume, open interest,
  index price, basis and funding in one call, plus `outlier_detected` and `exclusions`. That last pair exposes
  CMC's own venue filtering, which made a "how is the headline price made" analysis possible at all.
- Derivatives, liquidations and RWA endpoints are all reachable on Basic; a free key can prototype the full idea.

## Where it got in the way
1. **Tier docs don't say which endpoints each tier gets.** The endpoint overview states "does not specify minimum
   plan tiers"; the pricing page implies Derivatives/RWA need Growth+. In practice they answer on Basic, while
   `/v2/cryptocurrency/market-pairs/latest` and `/v1/exchange/listings/latest` return 403. The only way to learn
   this was to call every endpoint. A per-endpoint tier column would save every newcomer a probe script.
2. **Startup upgrade is not instant.** Registration gave no key upgrade for ~24h, which is a large fraction of a
   3-week (here: 5-day for late joiners) event.
3. **Derivatives market-pairs mixes base and quote sides.** Querying `crypto_symbol=BTC` returns pairs where BTC
   is the *quote* (e.g. Pionex rows priced at $0.26 and $13.90). Callers must filter on `market_pair_base.crypto_id`.
   A `base_only` parameter would remove a silent-wrong-answer trap.
4. **`exclusions` is an array with different meanings** (`volume`, `price`) that a naive `length > 0` check
   conflates. Worth documenting the enum.
5. **`rwa_id` is a separate namespace from `crypto_id`**, so joining a tokenised asset to its on-chain token
   needs a detour through market-pairs.
6. **RWA list has no underlying/TradFi price**, only `average_tokenized_price`; the endpoint reference implies TradFi
   market details, the academy article says they were deferred. The docs should agree.
7. **Parameter names differ between endpoint families**: `symbol` (spot) vs `crypto_symbol` (derivatives).
8. A per-response `crypto_id: 2781` appears inside every `quotes[]` entry; it is the *currency* (USD) id, easy to misread as the asset.

## Added after building the recorder and the on-chain layer
9. **Same `market_id` returned twice with conflicting prices.** `/v5/cryptocurrency/derivatives/market-pairs/list/latest?crypto_id=1`
   returned Kraken market `47233` (XBT/USD perpetual) twice with identical timestamps, at $84,012 and $66,959. Neither row is
   flagged by `outlier_detected` or `exclusions`. `market_id` is not a safe unique key for this endpoint.
10. **Kraken `index_price` looked wrong**: $104,712 on both rows while BTC traded near $84,000.
11. **`/v4/dex/networks/list` returned HTTP 500** with `credit_count: 0` on the free tier (2026-09-25).
12. **`/v4/dex/spot-pairs/latest` requires `dex_slug`** but the error only says "provide either a dex id or dex slug". A network alone is
    not enough, so there is no way to ask "the biggest pools on Ethereum" without already knowing DEX slugs.
13. **`limit=200` silently returns 100 rows** (pagination via `scroll_id`). No warning that the limit was clamped.
14. **Request `network_slug=ethereum`, response `network_slug: "Ethereum"`**: casing differs between input and output.
15. **`/v4/dex/pairs/quotes/latest` returned an empty `data` array** (still charged 1 credit) for the widely used Uniswap v3 USDC/WETH pool
    `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640`, while `spot-pairs/latest` lists other pools for the same tokens.
16. **On-chain pool prices can be over an hour stale** (`last_updated` up to 64 minutes old on a $25M-liquidity WBTC pool). That is correct
    for AMMs that only update on trades, but nothing in the response tells a consumer whether a quote is stale or just quiet.
17. **DEX pairs carry `base_asset_ucid` for the wrapped token** (WBTC 3717, WETH 2396), not the underlying (BTC 1, ETH 1027). Joining
    on-chain data to exchange data needs a hand-maintained mapping table.
