import test from 'node:test';
import assert from 'node:assert/strict';
import { allowChatMessage } from '../lib/ratelimit.ts';

const env = () => { process.env.SUPABASE_URL = 'https://x.test'; process.env.SUPABASE_SERVICE_KEY = 'k'; };

test('allowChatMessage: under the limit records the event and returns true', async (t) => {
  env();
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    calls.push({ url: String(url), method: opts?.method ?? 'GET' });
    if (!opts?.method || opts.method === 'GET') return { ok: true, json: async () => [{ id: 1 }, { id: 2 }] }; // 2 recent, under limit 8
    return { ok: true, json: async () => [] };
  });
  assert.equal(await allowChatMessage(42), true);
  assert.equal(calls.length, 2, 'one count read, one insert');
  assert.equal(calls[1].method, 'POST');
  assert.match(calls[0].url, /chat_id=eq\.42/);
});

test('allowChatMessage: at the limit returns false and never inserts (no cost recorded twice)', async (t) => {
  env();
  let inserted = false;
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    if (opts?.method === 'POST') { inserted = true; return { ok: true, json: async () => [] }; }
    return { ok: true, json: async () => Array.from({ length: 3 }, (_, i) => ({ id: i })) }; // 3 recent, limit 3
  });
  assert.equal(await allowChatMessage(42, 3, 5), false);
  assert.equal(inserted, false);
});

test('allowChatMessage: a failed count read throws rather than silently allowing through', async (t) => {
  env();
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 500, text: async () => 'db down' }));
  await assert.rejects(() => allowChatMessage(42), /chat_events select 500/);
});

test('allowChatMessage: respects custom limit/window arguments', async (t) => {
  env();
  const seen = [];
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    seen.push(String(url));
    if (opts?.method === 'POST') return { ok: true, json: async () => [] };
    return { ok: true, json: async () => [] };
  });
  await allowChatMessage(7, 1, 2);
  assert.match(seen[0], /limit=1/);
});
