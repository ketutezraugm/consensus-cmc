// Minimal MCP server over stateless HTTP JSON-RPC (Streamable HTTP transport, JSON responses only).
// Kept dependency-free and separate from the HTTP route so the protocol logic is unit-testable.
import { assetReport, assetsRanked, currentAlerts, rwaAssets, rwaReport } from './tools.ts';

export type Tool = { name: string; description: string; inputSchema: object; run: (args: any) => Promise<unknown> };

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const ok = (id: unknown, result: unknown) => ({ jsonrpc: '2.0', id, result });
const err = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const symbolArg = (example: string) => ({
  type: 'object', properties: { symbol: { type: 'string', description: `Ticker, for example ${example}` } }, required: ['symbol'], additionalProperties: false,
});
const missing = (m: string): never => { throw new Error(m); };
const need = (a: any) => {
  if (!a || typeof a.symbol !== 'string' || !a.symbol.trim()) throw new Error('symbol is required');
  return a.symbol as string;
};

export const TOOLS: Tool[] = [
  {
    name: 'get_alerts',
    description:
      'Conditions right now that mean a crypto perpetual-futures price may be set by very little or may not match what other venues quote: one venue holding most of the volume, a venue quoting far off the market that CoinMarketCap does not exclude, a confidence drop, or a large on-chain gap. Each alert says how long it has lasted. Optionally filter by symbol.',
    inputSchema: { type: 'object', properties: { symbol: { type: 'string', description: 'Optional ticker filter, for example BCH' } }, additionalProperties: false },
    run: (a) => currentAlerts(a?.symbol),
  },
  {
    name: 'list_assets',
    description:
      'Rank the tracked crypto assets (15 large caps) by a 0-100 confidence score for how trustworthy their perpetual-futures price is, lowest first. Includes the biggest venue and its share of volume, the share of volume quoting within 50 bps of the median, and the share CoinMarketCap itself excludes.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: () => assetsRanked(),
  },
  {
    name: 'check_asset',
    description:
      'Pre-trade check for one crypto asset: confidence score and its recent trend, how concentrated the volume is, which venues quote off-market and for how many captures, funding, basis, on-chain gap, and any active alerts. Data is recorded every 30 minutes from the CoinMarketCap API.',
    inputSchema: symbolArg('BTC, ETH, SOL, BCH'),
    run: async (a) => (await assetReport(need(a))) ?? missing(`No data for ${a.symbol}. Use list_assets to see tracked symbols.`),
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
    run: async (a) => (await rwaReport(need(a))) ?? missing(`No tokenised asset ${a.symbol}. Use list_tokenised_assets.`),
  },
];

export async function handleRpc(msg: any, tools: Tool[] = TOOLS): Promise<object | null> {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(msg?.id, -32600, 'Invalid Request');
  const { id, method, params } = msg;
  const isNotification = id === undefined;

  if (method.startsWith('notifications/')) return null;
  switch (method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: VERSIONS.includes(params?.protocolVersion) ? params.protocolVersion : VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'consensus', version: '1.0.0' },
        instructions:
          'Read-only analysis of how CoinMarketCap-listed prices are made across venues. Start with get_alerts or list_assets, then check_asset for detail. Data is a snapshot recorded every 30 minutes and can be up to 30 minutes old.',
      });
    case 'ping':
      return ok(id, {});
    case 'tools/list':
      return ok(id, { tools: tools.map(({ run, ...t }) => t) });
    case 'tools/call': {
      const tool = tools.find((t) => t.name === params?.name);
      if (!tool) return err(id, -32602, `Unknown tool: ${params?.name}`);
      try {
        const result = await tool.run(params?.arguments ?? {});
        return ok(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], isError: false });
      } catch (e: any) {
        return ok(id, { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
      }
    }
    default:
      return isNotification ? null : err(id, -32601, `Method not found: ${method}`);
  }
}
