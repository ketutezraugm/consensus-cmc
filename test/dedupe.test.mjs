import test from 'node:test';
import assert from 'node:assert/strict';
import { firstTimeSeen } from '../lib/dedupe.ts';

const env = () => { process.env.SUPABASE_URL = 'https://x.test'; process.env.SUPABASE_SERVICE_KEY = 'k'; };

test('firstTimeSeen: a new update_id inserts a row and returns true', async (t) => {
  env();
  let body = null;
  t.mock.method(globalThis, 'fetch', async (url, opts) => { body = JSON.parse(opts.body); return { ok: true, json: async () => [{ update_id: 42 }] }; });
  assert.equal(await firstTimeSeen(42), true);
  assert.deepEqual(body, { update_id: 42 });
});

test('firstTimeSeen: a repeat update_id inserts nothing (ignore-duplicates) and returns false', async (t) => {
  env();
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => [] }));
  assert.equal(await firstTimeSeen(42), false);
});

test('firstTimeSeen: a failed insert throws, so the caller can decide to fail open rather than silently treating it as new', async (t) => {
  env();
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 500, text: async () => 'db down' }));
  await assert.rejects(() => firstTimeSeen(42), /telegram_updates insert 500/);
});
