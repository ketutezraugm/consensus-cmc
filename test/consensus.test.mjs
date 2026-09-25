import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toVenues, score } from '../lib/consensus.ts';

const mk = (over = {}) => ({ id: 1, name: 'A', price: 100, volume: 10, oi: 5, basis: 0, funding: 0, excluded: false, priceExcluded: false, updated: 0, ...over });
const finite = (r) => Object.values(r).flat().every((x) => typeof x !== 'number' || Number.isFinite(x));

test('real BTC fixture scores sanely', () => {
  const j = JSON.parse(readFileSync(new URL('../scripts/out/deriv-pairs.json', import.meta.url)));
  const r = score(toVenues(j.data.market_pairs, j.data.crypto_id), Date.parse(j.status.timestamp));
  assert.ok(r.venues > 10 && r.confidence >= 0 && r.confidence <= 100 && finite(r));
});
test('empty -> null', () => assert.equal(score([]), null));
test('single venue: hhi 1, no NaN', () => {
  const r = score([mk()]);
  assert.equal(r.hhi, 1); assert.equal(r.dispersionBps, 0); assert.ok(finite(r));
});
test('zero-volume and zero-price venues are dropped', () => {
  assert.equal(toVenues([{ exchange: { exchange_id: 1, exchange_name: 'x' }, quotes: [{ price: 0, volume_24h: 5 }] }]).length, 0);
});
test('zero open interest -> funding null, not NaN', () => {
  const r = score([mk({ oi: 0, funding: 0.01 }), mk({ id: 2, oi: 0, funding: 0.02 })]);
  assert.equal(r.funding, null);
});
test('negative funding preserved (shorts pay longs)', () => {
  assert.ok(score([mk({ funding: -0.0001 })]).funding < 0);
});
test('dominant venue lowers confidence', () => {
  const even = score([mk(), mk({ id: 2 }), mk({ id: 3 })]);
  const skew = score([mk({ volume: 1000 }), mk({ id: 2 }), mk({ id: 3 })]);
  assert.ok(skew.confidence < even.confidence);
  assert.equal(skew.top.name, 'A');
});
test('price disagreement lowers confidence', () => {
  const tight = score([mk(), mk({ id: 2 })]);
  const wide = score([mk(), mk({ id: 2, price: 103 })]);
  assert.ok(wide.confidence < tight.confidence && wide.dispersionBps > 100);
});

test('quote-side and non-perp pairs are dropped', () => {
  const p = (base, category) => ({ category, market_pair_base: { crypto_id: base }, exchange: { exchange_id: 1, exchange_name: 'x' }, quotes: [{ price: 5, volume_24h: 5 }] });
  assert.equal(toVenues([p(1, 'perpetual'), p(2, 'perpetual'), p(1, 'futures')], 1).length, 1);
});
test('price-excluded venues do not move dispersion', () => {
  const r = score([mk(), mk({ id: 2, price: 500, priceExcluded: true, excluded: true })]);
  assert.equal(r.dispersionBps, 0);
});
