import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, answer, esc, fmtAlert, fmtAlerts, fmtAsset, fmtRwa } from '../lib/telegram.ts';
import { newAlerts } from '../lib/alerts.ts';

const al = (id, over = {}) => ({ id, kind: 'concentration', severity: 'high', symbol: 'BCH', title: `BCH <95%> & ${id}`, detail: 'd', since: '2026-01-01T00:00:00Z', href: '/BCH', ...over });
const deps = {
  alerts: async (s) => (s === 'BTC' ? [] : [al('a')]),
  assets: async () => [{ symbol: 'BCH', confidence: 20, top_venue: 'Deepcoin', top_share_pct: 95 }],
  asset: async (s) => (s === 'BCH' ? {
    symbol: 'BCH', confidence: 20, top_venue: 'Deepcoin', top_share_pct: 95, effective_venues: 1.1, venues: 122, volume_in_agreement_pct: 3, volume_cmc_excludes_pct: 3,
    funding_per_interval_bps: 1, dex_gap_bps: null, off_market_venues: [{ venue: 'SunX', typical_gap_bps: -2368, seen_in_captures: 12 }],
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
    funding_per_interval_bps: null, dex_gap_bps: null, off_market_venues: [], active_alerts: [], as_of: '2026-01-01T00:00:00Z',
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
