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
