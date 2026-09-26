import test from 'node:test';
import assert from 'node:assert/strict';
import { alerts } from '../lib/alerts.ts';

const s = (over = {}) => ({ captured_at: 't1', crypto_id: 1, symbol: 'BTC', venues: 100, confidence: 90, effective_venues: 30, top_venue: 'V', top_share: 0.1,
  agreeing_share: 0.9, excluded_share: 0.4, stale_share: 0, dispersion_bps: 5, dup_markets: 0, dex_gap_bps: null, funding: null, basis: null, ...over });
const a = (over = {}) => ({ captured_at: 't3', symbol: 'BTC', venue_name: 'X', pair: 'BTC/USD', bps: -500, volume_24h: 5e6, dup: false, ...over });

test('quiet market -> no alerts', () => assert.deepEqual(alerts([s()], []), []));
test('concentration alert reports when the run began, not just now', () => {
  const rows = ['t1', 't2', 't3', 't4'].map((t, i) => s({ captured_at: t, top_share: i === 0 ? 0.1 : 0.9 }));
  const r = alerts(rows, []);
  assert.equal(r.length, 1); assert.equal(r[0].kind, 'concentration'); assert.equal(r[0].since, 't2'); assert.equal(r[0].severity, 'high');
});
test('a broken run resets since', () => {
  const rows = ['t1', 't2', 't3'].map((t, i) => s({ captured_at: t, top_share: i === 1 ? 0.1 : 0.9 }));
  assert.equal(alerts(rows, [])[0].since, 't3');
});
test('confidence drop needs history and a real fall', () => {
  const steady = ['t1', 't2', 't3', 't4'].map((t) => s({ captured_at: t }));
  assert.equal(alerts(steady, []).length, 0);
  const dropped = [...steady.slice(0, 3), s({ captured_at: 't4', confidence: 60 })];
  assert.equal(alerts(dropped, [])[0].kind, 'confidence-drop');
  assert.equal(alerts([s({ confidence: 10 })], []).length, 0, 'one row is not a trend');
});
test('off-market: dust and small gaps are ignored, real ones report their duration', () => {
  const rows = [s({ captured_at: 't3' })];
  const anoms = [a({ captured_at: 't1' }), a({ captured_at: 't2' }), a({ captured_at: 't3' }),
    a({ venue_name: 'Dust', volume_24h: 1000 }), a({ venue_name: 'Small', bps: -50 })];
  const r = alerts(rows, anoms);
  assert.equal(r.length, 1); assert.equal(r[0].since, 't1'); assert.equal(r[0].kind, 'off-market');
});
test('dex gap alert, and high severity sorts first', () => {
  const rows = [s({ captured_at: 't1', dex_gap_bps: 50 }), s({ captured_at: 't1', symbol: 'BCH', crypto_id: 2, top_share: 0.95 })];
  const r = alerts(rows, []);
  assert.equal(r[0].severity, 'high'); assert.ok(r.some((x) => x.kind === 'dex-gap'));
});
