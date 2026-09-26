import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRpc, TOOLS } from '../lib/mcp.ts';

const fake = [
  { name: 'echo', description: 'd', inputSchema: { type: 'object' }, run: async (a) => ({ got: a }) },
  { name: 'boom', description: 'd', inputSchema: { type: 'object' }, run: async () => { throw new Error('db down'); } },
];
const rpc = (method, params, id = 1) => handleRpc({ jsonrpc: '2.0', id, method, params }, fake);

test('initialize echoes a supported protocol version and advertises tools', async () => {
  const r = await rpc('initialize', { protocolVersion: '2025-03-26' });
  assert.equal(r.result.protocolVersion, '2025-03-26'); assert.ok(r.result.capabilities.tools); assert.equal(r.result.serverInfo.name, 'consensus');
});
test('initialize falls back to a known version for an unknown one', async () => {
  assert.equal((await rpc('initialize', { protocolVersion: '1999-01-01' })).result.protocolVersion, '2025-06-18');
});
test('tools/list hides the run function', async () => {
  const r = await rpc('tools/list');
  assert.deepEqual(r.result.tools.map((t) => t.name), ['echo', 'boom']); assert.ok(r.result.tools.every((t) => !('run' in t)));
});
test('tools/call returns JSON text content', async () => {
  const r = await rpc('tools/call', { name: 'echo', arguments: { x: 1 } });
  assert.equal(r.result.isError, false); assert.deepEqual(JSON.parse(r.result.content[0].text), { got: { x: 1 } });
});
test('a throwing tool becomes an isError result, not a protocol error', async () => {
  const r = await rpc('tools/call', { name: 'boom' });
  assert.equal(r.result.isError, true); assert.match(r.result.content[0].text, /db down/); assert.equal(r.error, undefined);
});
test('unknown tool -> -32602, unknown method -> -32601, bad envelope -> -32600', async () => {
  assert.equal((await rpc('tools/call', { name: 'nope' })).error.code, -32602);
  assert.equal((await rpc('nope')).error.code, -32601);
  assert.equal((await handleRpc({ method: 'x' }, fake)).error.code, -32600);
  assert.equal((await handleRpc(null, fake)).error.code, -32600);
});
test('notifications get no response', async () => {
  assert.equal(await handleRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, fake), null);
  assert.equal(await handleRpc({ jsonrpc: '2.0', method: 'made/up' }, fake), null);
});
test('ping answers, and every real tool has a name, description and object schema', async () => {
  assert.deepEqual((await rpc('ping')).result, {});
  for (const t of TOOLS) { assert.ok(t.name && t.description.length > 40); assert.equal(t.inputSchema.type, 'object'); }
  assert.equal(new Set(TOOLS.map((t) => t.name)).size, TOOLS.length);
});
test('symbol tools reject a missing symbol with isError', async () => {
  const check = TOOLS.find((t) => t.name === 'check_asset');
  const r = await handleRpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'check_asset', arguments: {} } });
  assert.equal(r.result.isError, true); assert.match(r.result.content[0].text, /symbol is required/); assert.ok(check);
});
