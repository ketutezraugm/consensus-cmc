import test from 'node:test';
import assert from 'node:assert/strict';
import { cmpAsset, cmpRwa } from '../lib/sort.ts';

test('cmpAsset: sorts by each key correctly', () => {
  const a = { symbol: 'BCH', confidence: 25, share: 0.9, pub: -531 };
  const b = { symbol: 'BTC', confidence: 80, share: 0.1, pub: 12 };
  assert.ok(cmpAsset(a, b, 'symbol') < 0);
  assert.ok(cmpAsset(a, b, 'confidence') < 0);
  assert.ok(cmpAsset(a, b, 'share') > 0);
  assert.ok(cmpAsset(a, b, 'pub') > 0); // |-531| > |12|
});

test('cmpAsset: a null published gap sorts before any real value, on both sides', () => {
  const withPub = { symbol: 'X', confidence: 50, share: 0.5, pub: 5 };
  const noPub = { symbol: 'Y', confidence: 50, share: 0.5, pub: null };
  assert.ok(cmpAsset(noPub, withPub, 'pub') < 0);
});

test('cmpRwa: sorts by each key correctly', () => {
  const a = { symbol: 'AAPL', dispersionBps: 5, tokens: 3, mcap: 1e6 };
  const b = { symbol: 'SPCX', dispersionBps: 1491, tokens: 11, mcap: 5e7 };
  assert.ok(cmpRwa(a, b, 'symbol') < 0);
  assert.ok(cmpRwa(a, b, 'disagreement') < 0);
  assert.ok(cmpRwa(a, b, 'tokens') < 0);
  assert.ok(cmpRwa(a, b, 'mcap') < 0);
});
