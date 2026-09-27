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

// A capture is due when the required interval has (almost) elapsed since the last one. 10% slack absorbs cron jitter.
export const captureDue = (lastAt: number | null, now: number, intervalMin: number) =>
  lastAt === null || now - lastAt >= intervalMin * 60_000 * 0.9;
