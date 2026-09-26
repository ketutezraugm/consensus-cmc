// Connects with the official MCP SDK client and exercises every tool. Run: node scripts/mcp-check.mjs [url]
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = process.argv[2] ?? 'https://consensus-cmc.vercel.app/api/mcp';
const client = new Client({ name: 'mcp-check', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));
console.log('connected to', client.getServerVersion()?.name, '| protocol ok');

const { tools } = await client.listTools();
console.log('tools:', tools.map((t) => t.name).join(', '));
const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const data = JSON.parse(r.content[0].text);
  console.log(`\n${name}(${JSON.stringify(args)}) isError=${!!r.isError}`);
  return data;
};
const a = await call('get_alerts'); console.log(' alerts:', a.length, '|', a[0]?.title);
const l = await call('list_assets'); console.log(' assets:', l.length, '| lowest:', l[0].symbol, l[0].confidence);
const c = await call('check_asset', { symbol: 'bch' }); console.log(' bch:', JSON.stringify({ conf: c.confidence, top: c.top_venue, share: c.top_share_pct, offMarket: c.off_market_venues.length, alerts: c.active_alerts.length }));
const miss = await client.callTool({ name: 'check_asset', arguments: { symbol: 'ZZZ' } }); console.log('
unknown symbol -> isError', miss.isError, '|', miss.content[0].text);
const r = await call('list_tokenised_assets'); console.log(' rwa assets:', r.length, '| widest:', r[0].symbol, r[0].weighted_disagreement_bps, 'bps');
const s = await call('check_tokenised_asset', { symbol: 'GOLD' }); console.log(' gold:', s.tokens, 'tokens, ref', s.reference_price_usd, '| kinds:', [...new Set(s.tokens_detail.map((t) => t.kind))].join(','));
const bad = await client.callTool({ name: 'check_asset', arguments: {} }); console.log('\nmissing arg -> isError', bad.isError, '|', bad.content[0].text);
await client.close(); console.log('\nALL OK');
