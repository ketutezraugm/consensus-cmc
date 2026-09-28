# Consensus MCP: give an AI agent the truth about a price

**Track: AI Agents and Automation** · Remote MCP server · #BuildwithCMC

An LLM that quotes a crypto price has no idea whether that price is set by one venue or a hundred, or whether a venue is quoting 20% off the market. This MCP server gives an agent live, structured answers to exactly that, from CoinMarketCap API data recorded every 30 minutes.

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
| `list_assets` | 15 crypto assets ranked by a 0-100 confidence score, lowest first |
| `check_asset` (`symbol`) | Confidence and trend, biggest venue and share, off-market venues, funding, basis, on-chain gap, gap to CMC's own published price, active alerts |
| `list_tokenised_assets` | Tokenised stocks/ETFs/commodities ranked by issuer disagreement |
| `check_tokenised_asset` (`symbol`) | Every issuer token: price, distance from reference, volume, and whether it is liquid, thin, a derivative, a different unit, or unpriced |

Errors are real MCP errors (`isError: true`), not empty successes, so an agent cannot mistake a missing symbol for a result.

## CMC endpoints used

`/v5/cryptocurrency/derivatives/market-pairs/list/latest`, `/v5/derivatives/liquidations/cryptocurrency/list/latest`, `/v5/derivatives/liquidations/quotes/latest`, `/v4/dex/spot-pairs/latest`, `/v5/real-world-assets/assets/list`, `/v5/real-world-assets/quotes/latest`, `/v1/cryptocurrency/quotes/latest` (CMC's own published price, checked against the composite `check_asset` returns). About 21-23 credits per capture, one capture per 30 minutes, on the free Basic tier. The server itself reads recorded data, so an agent's questions cost no CMC credits and cannot exhaust the key.

## Evidence it runs

Verified with the **official MCP SDK client** against production: [`scripts/mcp-check.mjs`](../scripts/mcp-check.mjs) connects, lists tools, calls all five against live data, and checks both error paths.

```
connected to consensus | protocol ok
tools: get_alerts, list_assets, check_asset, list_tokenised_assets, check_tokenised_asset
get_alerts    -> 15 alerts | BCH: 90% of perp volume is on Deepcoin
list_assets   -> 15 assets | lowest: BCH 38
check_asset   -> {"conf":38,"top":"Deepcoin","share":90.2,"vsPublished":96,"offMarket":4,"alerts":2}
list_tokenised_assets -> 38 assets | widest: SPCX 1485 bps
unknown symbol -> isError true | Error: No data for ZZZ.
ALL OK
```

`vsPublished` is the gap in bps between our independently reconstructed venue composite and CMC's own published price for the same asset — computed with no knowledge of that published number, only checked against it afterward.

Protocol logic (initialize negotiation, notifications, error codes, tool failures becoming `isError`) is unit-tested in [`test/mcp.test.mjs`](../test/mcp.test.mjs) with injected tools.

## What the API made possible, and where it got in the way

**Made possible:** per-venue data plus CMC's own `outlier_detected`/`exclusions` in a single call is what lets an agent answer "who sets this price" rather than just "what is the price". The published-price endpoint lets it also answer "how close is that to CMC's own number" — a validation loop, not just an audit.

**In the way:** no unit field on tokenised assets (gold tokens priced per gram look like a 97% disagreement), `market_id` not unique, null prices returned without a reason, no staleness marker. Full list: [`api-feedback.md`](api-feedback.md).

## Honest limits

Snapshots up to 30 minutes old; 15 crypto assets and 38 tokenised assets; reports what the API returns, not how CoinMarketCap computes its published price.

## Relationship to the other entries

Same analysis engine and recorder as **Consensus** (Data and Visualisation) and **Consensus Alerts** (Markets and Trading Tools), in one repository, disclosed here on purpose. This entry is the agent interface: the MCP protocol layer ([`lib/mcp.ts`](../lib/mcp.ts)), tool definitions, and the conformance check.

The Telegram bot is itself a client of these exact tool definitions: free-text messages ("is Bitcoin Cash reliable right now?") go through a model tool-use loop ([`lib/agent.ts`](../lib/agent.ts), Gemini by default) that calls the same `TOOLS` array this server exposes over MCP, rather than a second, separately-maintained set of functions. The loop is provider-neutral by design — the model call is a swappable adapter (Gemini or Claude) behind one function — so it's one concrete example of an AI agent using this interface, running in production, independent of which model happens to be behind it.
