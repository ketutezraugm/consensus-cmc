import test from 'node:test';
import assert from 'node:assert/strict';
import { venueBoard, marketBoard, findings, latestPerSymbol } from '../lib/history.ts';

const a = (over = {}) => ({ captured_at: 't1', symbol: 'BTC', venue_name: 'X', pair: 'BTC/USD', bps: -500, volume_24h: 10, dup: false, ...over });
const s = (over = {}) => ({ captured_at: 't1', crypto_id: 1, symbol: 'BTC', venues: 10, confidence: 80, effective_venues: 5, top_venue: 'V', top_share: 0.2,
  agreeing_share: 0.9, excluded_share: 0.4, stale_share: 0, dispersion_bps: 5, dup_markets: 0, dex_gap_bps: null, funding: null, basis: null,
  published_price: null, published_gap_bps: null, ...over });

test('venueBoard ranks by breadth x persistence and counts distinct captures', () => {
  const rows = [a({ venue_name: 'Wide', symbol: 'BTC' }), a({ venue_name: 'Wide', symbol: 'ETH' }), a({ venue_name: 'Wide', symbol: 'BTC', captured_at: 't2' }),
    a({ venue_name: 'Narrow', symbol: 'BTC' })];
  const b = venueBoard(rows, 2);
  assert.equal(b[0].key, 'Wide'); assert.equal(b[0].captures, 2); assert.deepEqual(b[0].assets, ['BTC', 'ETH']); assert.equal(b[0].presence, 1);
  assert.equal(b[1].presence, 0.5);
});
test('marketBoard groups per asset+venue+pair', () => {
  assert.equal(marketBoard([a(), a({ symbol: 'ETH' })], 1).length, 2);
});
test('boards tolerate empty input and zero captures', () => {
  assert.deepEqual(venueBoard([], 0), []);
  assert.equal(venueBoard([a()], 0)[0].presence, 0);
});
test('findings: concentration persistence is counted from history', () => {
  const all = [s({ symbol: 'BCH', top_share: 0.95 }), s({ symbol: 'BCH', captured_at: 't2', top_share: 0.93 }), s({ symbol: 'BCH', captured_at: 't3', top_share: 0.5 })];
  const f = findings([all[2]], all, [], 3);
  assert.match(f[0].note, /2 of 3 captures/); assert.equal(f[0].v, '50%');
});
test('findings: empty latest -> no findings, no throw', () => assert.deepEqual(findings([], [], [], 0), []));

test('findings: published-price gap leads when present, points at the worst outlier', () => {
  const rows = [
    s({ symbol: 'BTC', published_price: 100, published_gap_bps: -5 }),
    s({ symbol: 'ETH', published_price: 100, published_gap_bps: 40 }),
    s({ symbol: 'SOL', published_price: 100, published_gap_bps: null }), // no published price this capture -> excluded
  ];
  const f = findings(rows, rows, [], 1);
  assert.match(f[0].k, /gap between our independent/);
  assert.equal(f[0].v, '40 bps', 'med() picks the upper-middle of [5, 40], matching its use elsewhere in this file');
  assert.match(f[0].note, /across 2 assets/);
  assert.match(f[0].note, /ETH at 40 bps/);
  assert.equal(f[0].href, '/ETH');
});

test('findings: a row missing the field entirely (undefined, not null) is not mistaken for real data', () => {
  const row = s({ symbol: 'BTC' });
  delete row.published_gap_bps; // simulates an untyped caller that forgot the field
  const f = findings([row], [row], [], 1);
  assert.ok(!f[0].k.includes('gap between our independent'), 'must not treat undefined as a real published gap');
});

test('findings: duplicate markets outrank concentration and link to the worst offender', () => {
  const rows = [s({ symbol: 'BTC', top_share: 0.95, dup_markets: 0 }), s({ symbol: 'ETH', top_share: 0.1, dup_markets: 3 })];
  const f = findings(rows, rows, [], 1);
  assert.match(f[0].k, /returned twice/);
  assert.equal(f[0].v, '3');
  assert.equal(f[0].href, '/ETH');
  assert.match(f[1].k, /BTC perp volume/);
});

test('findings: zero duplicate markets omits that card entirely rather than showing "0"', () => {
  const f = findings([s({ dup_markets: 0 })], [s({ dup_markets: 0 })], [], 1);
  assert.ok(!f.some((x) => x.k.includes('returned twice')));
});
test('latestPerSymbol keeps the newest row per symbol', () => {
  const r = latestPerSymbol([s({ captured_at: 't1', confidence: 1 }), s({ captured_at: 't2', confidence: 2 }), s({ symbol: 'ETH', captured_at: 't1' })]);
  assert.equal(r.length, 2); assert.equal(r.find((x) => x.symbol === 'BTC').confidence, 2);
});
