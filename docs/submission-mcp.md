# Consensus MCP: give an AI agent the truth about a price

**Not a separate hackathon entry** — a feature of [Consensus](../README.md), the Data and Visualisation submission. Remote MCP server · #BuildwithCMC

An LLM that quotes a crypto price has no idea whether that price is set by one venue or a hundred, or whether a venue is quoting 20% off the market. This MCP server gives an agent live, structured answers to exactly that, from CoinMarketCap API data recorded on a fixed schedule — `check_asset` and `check_tokenised_asset` include exactly when their reading was captured.

## At a glance

| | |
|---|---|
| **Connect** | `claude mcp add --transport http consensus https://consensus-cmc.vercel.app/api/mcp` — no install, no key |
| **For judges** | https://consensus-cmc.vercel.app/judge — the same live evidence this server exposes as tools, browsable in 90 seconds |
| **Repo** | https://github.com/ketutezraugm/consensus-cmc (MIT) |
| **Verify it yourself** | `node --env-file=.env.local scripts/mcp-check.mjs` — the **official MCP SDK client**, not curl: connects, lists tools, calls all five against live data, checks both error paths |
| **Tests** | 105 total; protocol logic (initialize, notifications, error codes, `isError`) in [`test/mcp.test.mjs`](../test/mcp.test.mjs) with injected tools |
| **Raw API evidence** | [`scripts/out/`](../scripts/out) |
| **API feedback** | 24 items from real calls: [`docs/api-feedback.md`](api-feedback.md). Strongest for an agent: `market_id` isn't a unique key, so an agent can't safely join on it; `exclusions` mixes `volume` and `price` meanings in one array; tokens with `price: null` are still returned with no status field explaining why |

**The headline finding:** an agent asking `check_asset` for BCH gets more than a price — it gets `vsPublished`, the gap in basis points between an independently reconstructed venue composite and CMC's own published number for that asset, computed with no knowledge of that published number and only checked against it afterward. Across the 37 assets with a published price to check against, that reconstruction lands within a median of **5 bps**. This is the same tool an agent calling `get_alerts` or `list_assets` already used to find that Deepcoin holds 90% of BCH's volume — so the agent isn't just told a fact, it's given the receipt.

## Connect

Remote server, no install, no key:

```bash
# Claude Code
claude mcp add --transport http consensus https://consensus-cmc.vercel.app/api/mcp
```

Any MCP client that supports Streamable HTTP can use `https://consensus-cmc.vercel.app/api/mcp`. Stateless, read-only, JSON responses.

Then ask things like:
- *"Which of the tracked assets has the least trustworthy price right now, and why?"*
- *"Is it safe to size a big BCH perp order? Who is setting the price?"*
- *"Do the issuers of tokenised Nvidia agree on its price?"*

## Tools

| Tool | Returns |
|---|---|
| `get_alerts` (optional `symbol`) | Active conditions: concentration, off-market venues CMC still trusts, confidence drops, DEX gaps, each with how long it has lasted |
| `list_assets` | 38 crypto assets ranked by a 0-100 confidence score, lowest first |
| `check_asset` (`symbol`) | Confidence and trend, biggest venue and share, off-market venues, funding, basis, on-chain gap, gap to CMC's own published price, active alerts |
| `list_tokenised_assets` | Tokenised stocks/ETFs/commodities ranked by issuer disagreement |
| `check_tokenised_asset` (`symbol`) | Every issuer token: price, distance from reference, volume, and whether it is liquid, thin, a derivative, a different unit, or unpriced |

Errors are real MCP errors (`isError: true`), not empty successes, so an agent cannot mistake a missing symbol for a result.

## CMC endpoints used

`/v5/cryptocurrency/derivatives/market-pairs/list/latest`, `/v5/derivatives/liquidations/cryptocurrency/list/latest`, `/v5/derivatives/liquidations/quotes/latest`, `/v4/dex/spot-pairs/latest`, `/v5/real-world-assets/assets/list`, `/v5/real-world-assets/quotes/latest`, `/v1/cryptocurrency/quotes/latest` (CMC's own published price, checked against the composite `check_asset` returns). About 44-46 credits per capture at the current 38 tracked assets, one capture every 30 minutes on the Startup tier (granted for the event window; reverts to the free Basic tier at submission close, which widens the cadence, not the credit cost per capture). The server itself reads recorded data, so an agent's questions cost no CMC credits and cannot exhaust the key.

## Evidence it runs

Verified with the **official MCP SDK client** against production: [`scripts/mcp-check.mjs`](../scripts/mcp-check.mjs) connects, lists tools, calls all five against live data, and checks both error paths.

```
connected to consensus | protocol ok
tools: get_alerts, list_assets, check_asset, list_tokenised_assets, check_tokenised_asset
get_alerts    -> 30 alerts | BCH: 94% of perp volume is on Deepcoin
list_assets   -> 37 assets | lowest: BCH 21
check_asset   -> {"conf":21,"top":"Deepcoin","share":93.9,"vsPublished":-161,"offMarket":5,"alerts":2}
list_tokenised_assets -> 82 assets | widest: SPCX 4029 bps
unknown symbol -> isError true | Error: No data for ZZZ.
ALL OK
```

`vsPublished` is the gap in bps between our independently reconstructed venue composite and CMC's own published price for the same asset — computed with no knowledge of that published number, only checked against it afterward.

Protocol logic (initialize negotiation, notifications, error codes, tool failures becoming `isError`) is unit-tested in [`test/mcp.test.mjs`](../test/mcp.test.mjs) with injected tools.

## What the API made possible, and where it got in the way

**Made possible:** per-venue data plus CMC's own `outlier_detected`/`exclusions` in a single call is what lets an agent answer "who sets this price" rather than just "what is the price". The published-price endpoint lets it also answer "how close is that to CMC's own number" — a validation loop, not just an audit.

**In the way:** no unit field on tokenised assets (gold tokens priced per gram look like a 97% disagreement), `market_id` not unique, null prices returned without a reason, no staleness marker. Full list: [`api-feedback.md`](api-feedback.md).

## Honest limits

Recorded snapshots, not live — `check_asset`/`check_tokenised_asset` state exactly how old; 38 crypto assets and around 100 tokenised assets; reports what the API returns, not how CoinMarketCap computes its published price.

## Relationship to the rest of the repo

Same analysis engine and recorder as the main [Consensus](../README.md) submission. This is the agent interface built on top of it: the MCP protocol layer ([`lib/mcp.ts`](../lib/mcp.ts)), tool definitions, and the conformance check.

The Telegram bot is itself a client of these exact tool definitions: free-text messages ("is Bitcoin Cash reliable right now?") go through a model tool-use loop ([`lib/agent.ts`](../lib/agent.ts), Gemini by default) that calls the same `TOOLS` array this server exposes over MCP, rather than a second, separately-maintained set of functions. The loop is provider-neutral by design — the model call is a swappable adapter (Gemini or Claude) behind one function — so it's one concrete example of an AI agent using this interface, running in production, independent of which model happens to be behind it.
