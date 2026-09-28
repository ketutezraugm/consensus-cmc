import test from 'node:test';
import assert from 'node:assert/strict';
import { requiredIntervalMin, captureDue, cadenceLabel } from '../lib/budget.ts';

const DAY = 86_400_000;
const at = (o) => requiredIntervalMin({ costPerCapture: 20, ...o });

test('plenty of credits keeps the 30-minute cadence (a higher tier never slows down)', () => {
  assert.equal(at({ limit: 450_000, used: 0, resetAt: new Date(31 * DAY).toISOString(), now: 0 }), 30);
});
test('the free tier at a fresh month cannot sustain 30 minutes, so it backs off to hourly', () => {
  assert.equal(at({ limit: 15_000, used: 0, resetAt: new Date(31 * DAY).toISOString(), now: 0 }), 60);
});
test('the current situation: 4 days to reset with 14.5k left is fine at 30 minutes', () => {
  assert.equal(at({ limit: 15_000, used: 506, resetAt: new Date(4 * DAY).toISOString(), now: 0 }), 30);
});
test('running low late in the month slows further, and an empty budget never divides by zero', () => {
  assert.ok(at({ limit: 15_000, used: 14_000, resetAt: new Date(10 * DAY).toISOString(), now: 0 }) >= 240);
  assert.equal(at({ limit: 15_000, used: 15_000, resetAt: new Date(10 * DAY).toISOString(), now: 0 }), 24 * 60);
  assert.ok(Number.isFinite(at({ limit: 15_000, used: 0, resetAt: new Date(0).toISOString(), now: 0 })));
});
test('interval is always a whole multiple of the cron cadence', () => {
  for (const used of [0, 3000, 9000]) assert.equal(at({ limit: 15_000, used, resetAt: new Date(12 * DAY).toISOString(), now: 0 }) % 30, 0);
});
test('captureDue: first capture always runs; slack absorbs jitter; too-soon skips', () => {
  assert.equal(captureDue(null, 1000, 60), true);
  assert.equal(captureDue(0, 60 * 60_000, 60), true);
  assert.equal(captureDue(0, 56 * 60_000, 60), true);   // 56 of 60 minutes: within the 10% slack
  assert.equal(captureDue(0, 30 * 60_000, 60), false);  // the :30 slot on an hourly schedule is skipped
});

// The label the home page, methodology page and Telegram help text show for how fresh the data is —
// derived from real recent gaps, not a hardcoded claim, so it stays true when the Basic-tier budget
// (or any other reason) stretches the cadence past the 30-minute cron schedule.
const isoBack = (offsetsMin) => offsetsMin.map((m) => new Date(Date.now() - m * 60_000).toISOString());

test('cadenceLabel: steady 30-minute captures', () => {
  assert.equal(cadenceLabel(isoBack([0, 30, 60, 90, 120, 150, 180])), 'Updated every 30 minutes');
});
test('cadenceLabel: a Basic-tier-throttled ~3-hour cadence', () => {
  assert.equal(cadenceLabel(isoBack([0, 180, 360, 540, 720, 900, 1080])), 'Updated about every 3 hours');
});
test('cadenceLabel: jitter around 30 minutes still reads as 30', () => {
  assert.equal(cadenceLabel(isoBack([0, 28, 59, 88, 121, 148])), 'Updated every 30 minutes');
});
test('cadenceLabel: no captures, or only one, cannot compute a gap', () => {
  assert.equal(cadenceLabel([]), 'Recorded on a schedule');
  assert.equal(cadenceLabel(isoBack([0])), 'Recorded on a schedule');
});
