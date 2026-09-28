# Consensus Alerts: a pre-trade venue-risk bot

**Track: Markets and Trading Tools** · Telegram bot + public alerts API + web page · #BuildwithCMC

**The question it answers:** *before I trade this, is the price I see actually set by anything?*

A perpetual-futures price on CoinMarketCap is built from hundreds of venues. Often one venue holds most of the volume, or a venue that CoinMarketCap still trusts quotes 10-25% away from everyone else. Nothing tells a trader that. This bot does, in one line, and says how long it has been true.

## At a glance

| | |
|---|---|
| **Try it** | Telegram bot — link added at submission (`/help` for commands) |
| **For judges** | https://consensus-cmc.vercel.app/judge — the same data the bot's replies come from, browsable in 90 seconds, no bot needed |
| **Repo** | https://github.com/ketutezraugm/consensus-cmc (MIT) |
| **Demo video** | _link added at submission_ |
| **Verify it yourself** | [`https://consensus-cmc.vercel.app/api/alerts`](https://consensus-cmc.vercel.app/api/alerts) — the exact JSON the bot's `/alerts` command sends, no bot needed |
| **Tests** | 105 total; command handling in [`test/telegram.test.mjs`](../test/telegram.test.mjs) |
| **Raw API evidence** | [`scripts/out/`](../scripts/out) |

**The headline finding:** ask this bot to check BTC before you trade it, and `/check BTC` will tell you Kraken — a top-tier exchange, not a thin or exotic venue — is quoting roughly 2,000 bps off the market on $289M of daily volume, and CoinMarketCap still counts it. Part of why: the underlying API actually returns Kraken's BTC perpetual market twice, under the same `market_id` (47233), with two conflicting prices in the same response, and flags neither row (see the README for that raw evidence). A trader watching only CoinMarketCap's headline number would see none of this.

## What it does

| Command | What you get |
|---|---|
| `/alerts [SYMBOL]` | What to know right now, worst first, each with how long it has lasted |
| `/check BCH` | Pre-trade check: confidence, who sets the price, off-market venues, funding, on-chain gap, gap vs CMC's own published price, active alerts |
| `/assets` | All tracked assets, least trustworthy first |
| `/rwa [SYMBOL]` | Tokenised stocks and commodities: do the issuers agree? |
| `/subscribe`, `/watch SYMBOL`, `/unwatch SYMBOL`, `/mywatchlist`, `/unsubscribe` | Per-chat alert filtering: watch nothing and get everything, or watch specific symbols and get only those |
| plain English, no `/` | Any free-text message ("is Bitcoin Cash reliable right now?") is answered by a model tool-use loop ([`lib/agent.ts`](../lib/agent.ts), Gemini by default), grounded in the same tool calls the [MCP entry](../lib/mcp.ts) exposes — it always calls a tool before stating a number, never gives trading advice, and says so when a question is outside the ~15 tracked crypto assets or ~38 tokenised assets. Rate-limited per chat, and replies that it isn't set up yet if no model key is configured — either way, the deterministic commands above are never affected. |
| automatic | A push message when a *new* alert appears, filtered to each subscriber's watchlist, and never again for one already running |

Alerts (thresholds are judgement calls, stated on the [alerts page](https://consensus-cmc.vercel.app/alerts) and tunable in [`lib/alerts.ts`](../lib/alerts.ts)):
1. **Concentrated:** one venue holds 50%+ of an asset's 24h perp volume.
2. **Off-market venue:** a venue CMC trusts for price quotes 100+ bps from the median with at least $1M daily volume (so dust never pages anyone).
3. **Confidence drop:** score falls 15+ points below its recent median.
4. **DEX gap:** liquidity-weighted Uniswap v3 pools sit 30+ bps from exchanges.

Real examples from the live data: *"BTC: Kraken is -1903 bps off the market"* (a duplicated market the API returns twice with a conflicting price, on a reputable venue — not flagged), *"BCH: 90% of perp volume is on Deepcoin"*, *"SOL: Zoomex is -285 bps off the market, $285.1M volume, and CMC does not exclude it"*. Every `/check` also shows the tracked asset's independently reconstructed composite against CMC's own published price — a median of 19 bps across 37 assets, so it isn't just an alarm system: it's checked against ground truth.

## CMC endpoints used

| Endpoint | Used for |
|---|---|
| `/v5/cryptocurrency/derivatives/market-pairs/list/latest` | Per-venue price, volume, open interest, funding, basis, `outlier_detected`, `exclusions` |
| `/v5/derivatives/liquidations/cryptocurrency/list/latest`, `/v5/derivatives/liquidations/quotes/latest` | Liquidations |
| `/v4/dex/spot-pairs/latest` | On-chain pool prices for the DEX-gap alert |
| `/v5/real-world-assets/assets/list`, `/v5/real-world-assets/quotes/latest` | Tokenised-asset issuer comparison for `/rwa` |
| `/v1/cryptocurrency/quotes/latest` | CMC's own published price, checked against the composite in `/check` |

A capture (about 44-46 credits at 38 tracked assets) runs every 30 minutes on the Startup tier (450k credits/month), granted for the event window after starting on the free Basic tier. Access reverts to Basic at submission close, before judging — the cadence then widens automatically to a few hours rather than exhausting the key (`lib/budget.ts`); every reply states the real time of the reading it used, not a fixed claim.

## Evidence it runs

- Live alerts, same data the bot serves: <https://consensus-cmc.vercel.app/alerts> and JSON at <https://consensus-cmc.vercel.app/api/alerts>.
- Command handling is covered by [`test/telegram.test.mjs`](../test/telegram.test.mjs) (parsing, HTML escaping, every command including the watchlist flow, no `null`/`NaN` in replies, push de-duplication, and per-subscriber filtering with a mocked send — one failing chat doesn't stop the rest).
- The production command handler was run against the live database; its replies (for `/alerts`, `/check BCH`, `/rwa GOLD`, `/assets`) contain real venues, real basis-point gaps and durations, with no null or NaN values.
- `/subscribe` → `/watch BCH` → `/mywatchlist` → `/unwatch BCH` → `/unsubscribe` was run end to end against the live bot and confirmed working.
- Raw API responses: [`scripts/out/`](../scripts/out).

## What the API made possible, and where it got in the way

**Made possible:** `outlier_detected` and `exclusions` on each derivatives market pair are what make "CMC still trusts a venue that quotes 20% off" detectable at all. The single published-price endpoint, called against the same asset, closes the loop: it lets the bot say not just "here's a risk" but "here's how close our own number lands to CMC's."

**In the way:** `market_id` is not unique (the same Kraken market comes back twice with prices 25% apart), the endpoint mixes base-side and quote-side pairs, and there is no field saying whether a price is stale or merely quiet. Full list: [`api-feedback.md`](api-feedback.md).

## Honest limits

- Alerts describe what the API returns. They do not show that CoinMarketCap's published price uses the flagged rows.
- 38 assets are tracked, sized to this project's CoinMarketCap API tier, not the whole market.
- Data is a recorded snapshot, not live — `/check` states exactly how old the reading is. This is a risk check, not an execution signal.

## Relationship to the other entries

This shares its analysis engine (`lib/consensus.ts`, `lib/alerts.ts`, the recorder) with **Consensus**, the Data and Visualisation entry, and with **Consensus MCP**, the AI Agents entry, all in this repository. That is disclosed here on purpose: the three differ in purpose and interface. This entry is the alerting product (Telegram bot, alert rules, push de-duplication, `/api/alerts`).
