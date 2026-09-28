// Keeps the recorder alive to the end of the API key's monthly credit window instead of running dry early.
// Pure: given the plan numbers, how many minutes must pass between captures?

export const BASE_INTERVAL_MIN = 30;

export function requiredIntervalMin(o: { limit: number; used: number; resetAt: string; now: number; costPerCapture: number }): number {
  const daysLeft = Math.max((Date.parse(o.resetAt) - o.now) / 86_400_000, 0.25); // never divide by ~0 right before a reset
  const perDay = Math.max(o.limit - o.used, 0) / daysLeft;
  const capturesPerDay = perDay / o.costPerCapture;
  if (!(capturesPerDay > 0)) return 24 * 60;
  const interval = 1440 / capturesPerDay;
  return Math.max(BASE_INTERVAL_MIN, Math.ceil(interval / BASE_INTERVAL_MIN) * BASE_INTERVAL_MIN); // whole multiples of the cron cadence
}

// Describes the cadence the recorder is actually running at (median of recent gaps), since the budget
// above can stretch it well past the 30-minute base — e.g. to ~3 hours on a Basic-tier key.
export function cadenceLabel(capturesDesc: string[]): string {
  const t = capturesDesc.slice(0, 7).map(Date.parse);
  const gaps = t.slice(1).map((x, i) => (t[i] - x) / 60_000).sort((a, b) => a - b);
  if (!gaps.length) return 'Recorded on a schedule';
  const m = gaps[Math.floor(gaps.length / 2)];
  if (m < 105) return `Updated every ${Math.max(1, Math.round(m / 30)) * 30} minutes`;
  return `Updated about every ${Math.round(m / 60)} hours`;
}

// A capture is due when the required interval has (almost) elapsed since the last one. 10% slack absorbs cron jitter.
export const captureDue = (lastAt: number | null, now: number, intervalMin: number) =>
  lastAt === null || now - lastAt >= intervalMin * 60_000 * 0.9;
