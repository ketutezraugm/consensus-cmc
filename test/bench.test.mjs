import test from 'node:test';
import assert from 'node:assert/strict';
import { benchDomain } from '../lib/bench.ts';

test('benchDomain: normal gaps stay small, well under the cap', () => {
  assert.equal(benchDomain([{ gapBps: 9 }, { gapBps: -54 }], 60, 25), 60);
});

test('benchDomain: a real-world extreme value (unit-mismatched meme coin, ~6.7M bps) is capped, not passed through', () => {
  // Regression: this exact shape (one asset's gap in the millions of bps, from a per-token vs
  // per-1000-token quoting split across exchanges) previously sized an Array.from({length}) in the
  // millions, freezing the whole Node process — not just that one request, every route, site-wide.
  const d = benchDomain([{ gapBps: 6_746_097.8 }], 60, 25);
  assert.equal(d, 2000);
  // The actual regression check: the tick array this feeds (Math.floor((2*D)/5)+1) must stay small.
  assert.ok(Math.floor((2 * d) / 5) + 1 < 1000);
});

test('benchDomain: negative extreme values are capped the same way via Math.abs', () => {
  assert.equal(benchDomain([{ gapBps: -9_999_999 }], 60, 25), 2000);
});

test('benchDomain: never returns less than tolerance + 5, so the tolerance band always fits on the axis', () => {
  assert.equal(benchDomain([], 10, 25), 30);
});
