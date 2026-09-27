import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, answer, esc, fmtAlert, fmtAlerts, fmtAsset, fmtRwa, fmtWatchlist, relevantAlerts, pushAlerts } from '../lib/telegram.ts';
import { newAlerts } from '../lib/alerts.ts';

const al = (id, over = {}) => ({ id, kind: 'concentration', severity: 'high', symbol: 'BCH', title: `BCH <95%> & ${id}`, detail: 'd', since: '2026-01-01T00:00:00Z', href: '/BCH', ...over });

// A tiny in-memory stand-in for the subscribers table, so /subscribe /watch /unwatch can be exercised
// end to end without a network call. Keyed by chatId, mirroring lib/subscribers.ts's real semantics.
function fakeSubscriberStore() {
  const rows = new Map();
  return {
    rows,
    subscribe: async (chatId) => { if (!rows.has(chatId)) rows.set(chatId, { chat_id: chatId, symbols: [] }); },
    unsubscribe: async (chatId) => { rows.delete(chatId); },
    watch: async (chatId, symbol) => {
      const cur = rows.get(chatId) ?? { chat_id: chatId, symbols: [] };
      if (!cur.symbols.includes(symbol)) cur.symbols = [...cur.symbols, symbol];
      rows.set(chatId, cur);
      return cur;
    },
    unwatch: async (chatId, symbol) => {
      const cur = rows.get(chatId);
      if (!cur) return null;
      cur.symbols = cur.symbols.filter((s) => s !== symbol);
      return cur;
    },
    myWatchlist: async (chatId) => rows.get(chatId) ?? null,
  };
}

const deps = {
  alerts: async (s) => (s === 'BTC' ? [] : [al('a')]),
  assets: async () => [{ symbol: 'BCH', confidence: 20, top_venue: 'Deepcoin', top_share_pct: 95 }],
  asset: async (s) => (s === 'BCH' ? {
    symbol: 'BCH', confidence: 20, top_venue: 'Deepcoin', top_share_pct: 95, effective_venues: 1.1, venues: 122, volume_in_agreement_pct: 3, volume_cmc_excludes_pct: 3,
    funding_per_interval_bps: 1, dex_gap_bps: null, published_gap_bps: -18, off_market_venues: [{ venue: 'SunX', typical_gap_bps: -2368, seen_in_captures: 12 }],
    active_alerts: [{ severity: 'high', title: 'x' }], as_of: '2026-01-01T00:00:00Z',
  } : null),
  rwaAssets: async () => [{ symbol: 'SPCX', weighted_disagreement_bps: 1476, liquid_tokens: 9 }],
  rwa: async (s) => (s === 'GOLD' ? {
    symbol: 'GOLD', type: 'commodity', reference_price_usd: 4279, tokens: 7, issuers: 6, weighted_disagreement_bps: 5,
    tokens_detail: [
      { issuer: 'Paxos', token: 'PAXG', price_usd: 4278, vs_reference_bps: -1, kind: 'liquid' },
      { issuer: 'VNX', token: 'VNXAU', price_usd: 138, vs_reference_bps: null, kind: 'unit' },
    ],
  } : null),
  ...fakeSubscriberStore(),
};

test('parseCommand: plain, with argument, with @botname, uppercase, and non-commands', () => {
  assert.deepEqual(parseCommand('/check bch'), { cmd: 'check', arg: 'BCH' });
  assert.deepEqual(parseCommand('/check@ConsensusBot btc extra words'), { cmd: 'check', arg: 'BTC' });
  assert.deepEqual(parseCommand('/alerts'), { cmd: 'alerts', arg: '' });
  assert.equal(parseCommand('hello'), null);
  assert.equal(parseCommand('/'), null);
});

test('esc neutralises HTML so a title can never break the message', () => {
  assert.equal(esc('<b>&'), '&lt;b&gt;&amp;');
});

test('fmtAlert escapes and links; fmtAlerts truncates with a count', () => {
  assert.match(fmtAlert(al('a')), /&lt;95%&gt; &amp; a/);
  const many = fmtAlerts(Array.from({ length: 12 }, (_, i) => al(String(i))), 5);
  assert.match(many, /and 7 more/);
  assert.equal(fmtAlerts([]), 'Nothing unusual in the latest capture.');
});

test('answer: every command produces a reply and unknown chatter produces none', async () => {
  assert.match(await answer('/start', 1, deps), /Consensus/);
  assert.match(await answer('/id', 42, deps), /<code>42<\/code>/);
  assert.match(await answer('/alerts', 1, deps), /BCH/);
  assert.equal(await answer('/alerts BTC', 1, deps), 'Nothing unusual in the latest capture.');
  assert.match(await answer('/assets', 1, deps), /Deepcoin/);
  assert.match(await answer('/check BCH', 1, deps), /confidence <b>20<\/b>/);
  assert.match(await answer('/check BCH', 1, deps), /vs CMC published price: -18 bps/);
  assert.match(await answer('/check ZZZ', 1, deps), /No data for ZZZ/);
  assert.match(await answer('/check', 1, deps), /Which asset/);
  assert.match(await answer('/rwa', 1, deps), /SPCX/);
  assert.match(await answer('/rwa GOLD', 1, deps), /other unit/);
  assert.match(await answer('/rwa NOPE', 1, deps), /No tokenised asset/);
  assert.match(await answer('/wat', 1, deps), /Unknown command/);
  assert.equal(await answer('good morning', 1, deps), null);
});

test('fmtAsset handles missing funding, gap and venues without printing null or NaN', () => {
  const t = fmtAsset({
    symbol: 'X', confidence: 90, top_venue: 'V', top_share_pct: 5, effective_venues: 30, venues: 100, volume_in_agreement_pct: 90, volume_cmc_excludes_pct: 10,
    funding_per_interval_bps: null, dex_gap_bps: null, published_gap_bps: null, off_market_venues: [], active_alerts: [], as_of: '2026-01-01T00:00:00Z',
  });
  assert.ok(!/null|NaN|undefined/.test(t));
  assert.match(t, /No off-market venues/);
});

test('fmtRwa marks other-unit tokens instead of printing a fake gap', () => {
  const t = fmtRwa({
    symbol: 'G', type: 'c', reference_price_usd: 1, tokens: 1, issuers: 1, weighted_disagreement_bps: 0,
    tokens_detail: [{ issuer: 'I', token: 'T', price_usd: 1, vs_reference_bps: null, kind: 'unit' }],
  });
  assert.ok(!/null|NaN/.test(t));
});

test('newAlerts: only ids absent before, so a running alert never re-fires', () => {
  assert.deepEqual(newAlerts([al('a')], [al('a'), al('b')]).map((x) => x.id), ['b']);
  assert.deepEqual(newAlerts([al('a')], [al('a')]), []);
  assert.equal(newAlerts([], [al('a')]).length, 1);
});

test('fmtWatchlist: not subscribed, subscribed with no filter (all), subscribed with symbols', () => {
  assert.match(fmtWatchlist(null), /not subscribed/);
  assert.match(fmtWatchlist({ chat_id: 1, symbols: [] }), /all tracked assets/);
  assert.match(fmtWatchlist({ chat_id: 1, symbols: ['BCH', 'BTC'] }), /BCH, BTC/);
});

test('relevantAlerts: empty watchlist means all, non-empty filters, no match means none', () => {
  const eth = al('e', { symbol: 'ETH' });
  assert.deepEqual(relevantAlerts([al('a'), eth], []), [al('a'), eth]);
  assert.deepEqual(relevantAlerts([al('a'), eth], ['BCH']), [al('a')]);
  assert.deepEqual(relevantAlerts([al('a'), eth], ['SOL']), []);
});

test('answer: subscribe, watch, unwatch, mywatchlist and unsubscribe round-trip', async () => {
  const chat = 501; // distinct chat id so this test cannot collide with any other test's state
  assert.match(await answer('/mywatchlist', chat, deps), /not subscribed/);
  assert.match(await answer('/watch', chat, deps), /Which symbol/);

  assert.match(await answer('/watch bch', chat, deps), /Watching: <b>BCH<\/b>/);
  assert.match(await answer('/watch btc', chat, deps), /Watching: <b>BCH, BTC<\/b>/);
  assert.match(await answer('/mywatchlist', chat, deps), /BCH, BTC/);

  assert.match(await answer('/unwatch', chat, deps), /Which symbol/);
  assert.match(await answer('/unwatch bch', chat, deps), /Watching: <b>BTC<\/b>/);

  assert.match(await answer('/unsubscribe', chat, deps), /Unsubscribed/);
  assert.match(await answer('/mywatchlist', chat, deps), /not subscribed/);
  assert.match(await answer('/unwatch btc', chat, deps), /not subscribed yet/);

  assert.match(await answer('/subscribe', chat, deps), /all tracked assets/);
});

test('pushAlerts: filters per subscriber, one failing send does not stop the rest, empty match sends nothing', async (t) => {
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.chat_id === 'broken') throw new Error('blocked by user');
    sent.push(body.chat_id);
    return { ok: true, json: async () => ({}) };
  });
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';

  const eth = al('e', { symbol: 'ETH' });
  const subs = [
    { chat_id: 'all', symbols: [] },       // gets both
    { chat_id: 'bch-only', symbols: ['BCH'] }, // gets one
    { chat_id: 'sol-only', symbols: ['SOL'] }, // gets none, so no send call
    { chat_id: 'broken', symbols: [] },    // send throws; must not abort the loop
  ];
  const n = await pushAlerts([al('a'), eth], subs);
  assert.deepEqual(sent.sort(), ['all', 'bch-only']);
  assert.equal(n, 2);
  assert.equal(await pushAlerts([], subs), 0, 'nothing new to push -> no sends at all');
});
