// Minimal MCP server over stateless HTTP JSON-RPC (Streamable HTTP transport, JSON responses only).
// Kept dependency-free and separate from the HTTP route so the protocol logic is unit-testable.
import { assetReport, assetsRanked, currentAlerts, rwaAssets, rwaReport } from './tools.ts';
import { errMsg } from './fmt.ts';

type ToolArgs = Record<string, unknown>;
export type Tool = { name: string; description: string; inputSchema: object; run: (args: ToolArgs) => Promise<unknown> };
type RpcRequest = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: { name?: string; arguments?: ToolArgs; protocolVersion?: string } };

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const ok = (id: unknown, result: unknown) => ({ jsonrpc: '2.0', id, result });
const err = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const symbolArg = (example: string) => ({
  type: 'object', properties: { symbol: { type: 'string', description: `Ticker, for example ${example}` } }, required: ['symbol'], additionalProperties: false,
});
const missing = (m: string): never => { throw new Error(m); };
const need = (a: ToolArgs) => {
  if (typeof a.symbol !== 'string' || !a.symbol.trim()) throw new Error('symbol is required');
  return a.symbol;
};

export const TOOLS: Tool[] = [
  {
    name: 'get_alerts',
    description:
      'Conditions right now that mean a crypto perpetual-futures price may be set by very little or may not match what other venues quote: one venue holding most of the volume, a venue quoting far off the market that CoinMarketCap does not exclude, a confidence drop, or a large on-chain gap. Each alert says how long it has lasted. Optionally filter by symbol.',
    inputSchema: { type: 'object', properties: { symbol: { type: 'string', description: 'Optional ticker filter, for example BCH' } }, additionalProperties: false },
    run: (a) => currentAlerts(typeof a.symbol === 'string' ? a.symbol : undefined),
  },
  {
    name: 'list_assets',
    description:
      'Rank the tracked crypto assets (38 large caps) by a 0-100 confidence score for how trustworthy their perpetual-futures price is, lowest first. Includes the biggest venue and its share of volume, the share of volume quoting within 50 bps of the median, the share CoinMarketCap itself excludes, and the gap between an independently reconstructed venue composite and CoinMarketCap\'s own published price for that asset.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: () => assetsRanked(),
  },
  {
    name: 'check_asset',
    description:
      'Pre-trade check for one crypto asset: confidence score and its recent trend, how concentrated the volume is, which venues quote off-market and for how many captures, funding, basis, on-chain gap, CoinMarketCap\'s own published price and the gap to it from an independently reconstructed venue composite, and any active alerts. Data is recorded on a fixed schedule from the CoinMarketCap API; check_asset\'s as_of field has the exact time.',
    inputSchema: symbolArg('BTC, ETH, SOL, BCH'),
    run: async (a) => { const symbol = need(a); return (await assetReport(symbol)) ?? missing(`No data for ${symbol}. Use list_assets to see tracked symbols.`); },
  },
  {
    name: 'list_tokenised_assets',
    description:
      'Tokenised real-world assets (stocks, ETFs, commodities) ranked by how much the issuers of the same asset disagree on price, widest first. Compares issuers with each other; the underlying market price is not available from the API.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: () => rwaAssets(),
  },
  {
    name: 'check_tokenised_asset',
    description:
      'Every issuer token for one tokenised real-world asset (for example NVDA, TSLA, GOLD, SPCX) with its price, distance from the reference, volume, and whether it is liquid, thin, a derivative, priced in a different unit, or unpriced.',
    inputSchema: symbolArg('NVDA, TSLA, GOLD'),
    run: async (a) => { const symbol = need(a); return (await rwaReport(symbol)) ?? missing(`No tokenised asset ${symbol}. Use list_tokenised_assets.`); },
  },
];

export async function handleRpc(input: unknown, tools: Tool[] = TOOLS): Promise<object | null> {
  const looksValid = !!input && typeof input === 'object' && (input as { jsonrpc?: unknown }).jsonrpc === '2.0' && typeof (input as { method?: unknown }).method === 'string';
  // Per the JSON-RPC spec, id is null when it cannot reliably be read back from a malformed request.
  if (!looksValid) return err(null, -32600, 'Invalid Request');
  const { id, method, params } = input as RpcRequest;
  const isNotification = id === undefined;

  if (method.startsWith('notifications/')) return null;
  switch (method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: params?.protocolVersion && VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'consensus', version: '1.0.0' },
        instructions:
          'Read-only analysis of how CoinMarketCap-listed prices are made across venues. Start with get_alerts or list_assets, then check_asset for detail. Data is a recorded snapshot, not live; check_asset\'s as_of field has the exact time it was captured.',
      });
    case 'ping':
      return ok(id, {});
    case 'tools/list':
      return ok(id, { tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) });
    case 'tools/call': {
      const tool = tools.find((t) => t.name === params?.name);
      if (!tool) return err(id, -32602, `Unknown tool: ${params?.name}`);
      try {
        const result = await tool.run(params?.arguments ?? {});
        return ok(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], isError: false });
      } catch (e: unknown) {
        return ok(id, { content: [{ type: 'text', text: `Error: ${errMsg(e)}` }], isError: true });
      }
    }
    default:
      return isNotification ? null : err(id, -32601, `Method not found: ${method}`);
  }
}
