import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toVenues, score, onchain } from '../lib/consensus.ts';

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

test('one stale venue among many does not zero freshness', () => {
  const now = 10_000_000, fresh = mk({ updated: now - 1000 });
  const r = score([fresh, mk({ id: 2, updated: now - 1000 }), mk({ id: 3, updated: now - 1000 }), mk({ id: 4, updated: now - 2_000_000, volume: 1 })], now);
  assert.ok(r.parts.freshness > 0.9 && r.staleShare > 0);
});
test('a dominant venue off-consensus lowers agreement', () => {
  const r = score([mk({ volume: 1000, price: 100.9 }), mk({ id: 2 }), mk({ id: 3 }), mk({ id: 4 })]);
  assert.ok(r.agreeingShare < 0.1);
});

const pool = (over = {}) => ({ name: 'P', price: 100, liquidity: 1000, volume: 1, updated: 0, ...over });
test('onchain: gap vs CEX reference in bps', () => {
  assert.ok(Math.abs(onchain([pool({ price: 101 })], 100).gapBps - 100) < 1e-6);
});
test('onchain: deep pool outweighs shallow outlier', () => {
  const r = onchain([pool({ liquidity: 1_000_000 }), pool({ price: 150, liquidity: 10 })], 100);
  assert.ok(Math.abs(r.gapBps) < 5);
});
test('onchain: empty / zero-liquidity / zero ref -> null, never NaN', () => {
  assert.equal(onchain([], 100), null);
  assert.equal(onchain([pool({ liquidity: 0 })], 100), null);
  assert.equal(onchain([pool()], 0), null);
});
test('onchain: stale liquidity share', () => {
  const r = onchain([pool({ updated: 1 }), pool({ updated: 9_000_000 })], 100, 10_000_000);
  assert.equal(r.staleShare, 0.5);
});

import { offConsensus } from '../lib/consensus.ts';
import { summarize } from '../lib/summary.ts';
test('offConsensus: flags trusted venues >1% off, ignores price-excluded and empty', () => {
  const r = offConsensus([mk(), mk({ id: 2 }), mk({ id: 3, price: 90 }), mk({ id: 4, price: 500, priceExcluded: true })]);
  assert.equal(r.length, 1); assert.equal(Math.round(r[0].bps), -1000);
  assert.deepEqual(offConsensus([]), []);
});
test('summarize: one row per asset, anomalies derived, no NaN', () => {
  const j = JSON.parse(readFileSync(new URL('../scripts/out/deriv-pairs.json', import.meta.url)));
  const obs = toVenues(j.data.market_pairs, j.data.crypto_id).map((v, i) => ({
    captured_at: 'x', crypto_id: 1, symbol: 'BTC', venue_id: `v${i}`, venue_name: v.name, price: v.price, volume_24h: v.volume,
    extra: { pair: 'BTC/USD', oi: v.oi, index_price: null, basis: v.basis, funding: v.funding, outlier: false, exclusions: v.priceExcluded ? ['price'] : [], updated: undefined },
  }));
  const { scores, anomalies } = summarize(obs, [], new Date().toISOString());
  assert.equal(scores.length, 1);
  assert.ok(Number.isFinite(scores[0].confidence) && scores[0].venues > 10);
  assert.ok(anomalies.every((a) => a.symbol === 'BTC' && Number.isFinite(a.bps)));
});
