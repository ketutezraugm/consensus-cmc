# Consensus Alerts: a pre-trade venue-risk bot

**Track: Markets and Trading Tools** · Telegram bot + public alerts API + web page · #BuildwithCMC

**The question it answers:** *before I trade this, is the price I see actually set by anything?*

A perpetual-futures price on CoinMarketCap is built from hundreds of venues. Often one venue holds most of the volume, or a venue that CoinMarketCap still trusts quotes 10-25% away from everyone else. Nothing tells a trader that. This bot does, in one line, and says how long it has been true.

## What it does

| Command | What you get |
|---|---|
| `/alerts [SYMBOL]` | What to know right now, worst first, each with how long it has lasted |
| `/check BCH` | Pre-trade check: confidence, who sets the price, off-market venues, funding, on-chain gap, active alerts |
| `/assets` | All tracked assets, least trustworthy first |
| `/rwa [SYMBOL]` | Tokenised stocks and commodities: do the issuers agree? |
| automatic | A push message when a *new* alert appears, and never again for one already running |

Alerts (thresholds are judgement calls, stated on the [alerts page](https://consensus-cmc.vercel.app/alerts) and tunable in [`lib/alerts.ts`](../lib/alerts.ts)):
1. **Concentrated:** one venue holds 50%+ of an asset's 24h perp volume.
2. **Off-market venue:** a venue CMC trusts for price quotes 100+ bps from the median with at least $1M daily volume (so dust never pages anyone).
3. **Confidence drop:** score falls 15+ points below its recent median.
4. **DEX gap:** liquidity-weighted Uniswap v3 pools sit 30+ bps from exchanges.

Real examples from the live data: *"BCH: 95% of perp volume is on Deepcoin"*, *"SOL: Zoomex is -587 bps off the market, $283.9M volume, and CMC does not exclude it"*, *"BTC: Kraken is -2037 bps off the market"* (a duplicated market the API returns with a conflicting price).

## CMC endpoints used

| Endpoint | Used for |
|---|---|
| `/v5/cryptocurrency/derivatives/market-pairs/list/latest` | Per-venue price, volume, open interest, funding, basis, `outlier_detected`, `exclusions` |
| `/v5/derivatives/liquidations/cryptocurrency/list/latest`, `/v5/derivatives/liquidations/quotes/latest` | Liquidations |
| `/v4/dex/spot-pairs/latest` | On-chain pool prices for the DEX-gap alert |
| `/v5/real-world-assets/assets/list`, `/v5/real-world-assets/quotes/latest` | Tokenised-asset issuer comparison for `/rwa` |

A capture (about 20 credits) runs every 30 minutes; the free Basic tier was enough.

## Evidence it runs

- Live alerts, same data the bot serves: <https://consensus-cmc.vercel.app/alerts> and JSON at <https://consensus-cmc.vercel.app/api/alerts>.
- Command handling is covered by [`test/telegram.test.mjs`](../test/telegram.test.mjs) (parsing, HTML escaping, every command, no `null`/`NaN` in replies, push de-duplication).
- The production command handler was run against the live database; its replies (for `/alerts`, `/check BCH`, `/rwa GOLD`, `/assets`) contain real venues, real basis-point gaps and durations, with no null or NaN values.
- Raw API responses: [`scripts/out/`](../scripts/out).

## What the API made possible, and where it got in the way

**Made possible:** `outlier_detected` and `exclusions` on each derivatives market pair are what make "CMC still trusts a venue that quotes 20% off" detectable at all.

**In the way:** `market_id` is not unique (the same Kraken market comes back twice with prices 25% apart), the endpoint mixes base-side and quote-side pairs, and there is no field saying whether a price is stale or merely quiet. Full list: [`api-feedback.md`](api-feedback.md).

## Honest limits

- Alerts describe what the API returns. They do not show that CoinMarketCap's published price uses the flagged rows.
- 15 assets are tracked, sized to the free tier's credits.
- Data is up to 30 minutes old. This is a risk check, not an execution signal.

## Relationship to the other entries

This shares its analysis engine (`lib/consensus.ts`, `lib/alerts.ts`, the recorder) with **Consensus**, the Data and Visualisation entry, and with **Consensus MCP**, the AI Agents entry, all in this repository. That is disclosed here on purpose: the three differ in purpose and interface. This entry is the alerting product (Telegram bot, alert rules, push de-duplication, `/api/alerts`).
