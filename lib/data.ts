
const H = () => ({ apikey: process.env.SUPABASE_SERVICE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` });

// Paginated read (PostgREST caps a response at 1000 rows). Never cached: a stale first load would show old data on a freshness product.
export async function rest<T>(q: string): Promise<T[]> {
  const page = (from: number, count = false) =>
    fetch(`${process.env.SUPABASE_URL}/rest/v1/${q}`, { headers: { ...H(), Range: `${from}-${from + 999}`, ...(count ? { Prefer: 'count=exact' } : {}) }, cache: 'no-store' });
  const read = async (r: Response) => {
    if (!r.ok) throw new Error(`supabase ${r.status}: ${await r.text()}`);
    return (await r.json()) as T[];
  };
  // First page reports the total; the remaining pages are fetched in parallel, so latency does not grow with history.
  const first = await page(0, true);
  const total = Number(first.headers.get('content-range')?.split('/')[1] ?? 0);
  const rows = await read(first);
  if (rows.length < 1000 || !total) return rows;
  const rest = await Promise.all(Array.from({ length: Math.ceil(total / 1000) - 1 }, (_, i) => page((i + 1) * 1000).then(read)));
  return rows.concat(...rest);
}

export type { Obs, PoolObs } from './obs.ts';
export { toVenue } from './obs.ts';
import type { Obs, PoolObs } from './obs.ts';
export type Liq = { symbol: string; long_1h: number; short_1h: number; long_4h: number; short_4h: number; long_24h: number; short_24h: number };

export async function captures(): Promise<string[]> {
  const rows = await rest<{ captured_at: string }>('liquidations?select=captured_at&crypto_id=eq.0&order=captured_at.desc');
  return rows.map((r) => r.captured_at);
}
export const observations = (at: string, symbol?: string, layer = 'forward') =>
  rest<Obs>(`observations?select=*&layer=eq.${layer}&captured_at=eq.${encodeURIComponent(at)}${symbol ? `&symbol=eq.${symbol}` : ''}`);
export const liquidations = (at: string) => rest<Liq>(`liquidations?select=*&captured_at=eq.${encodeURIComponent(at)}`);
export const poolObservations = (at: string, symbol?: string) =>
  rest<PoolObs>(`observations?select=*&layer=eq.onchain&captured_at=eq.${encodeURIComponent(at)}${symbol ? `&symbol=eq.${symbol}` : ''}`);

import type { Score, Anom } from './history.ts';
export const scoreHistory = (symbol?: string) =>
  rest<Score>(`asset_scores?select=*${symbol ? `&symbol=eq.${symbol}` : ''}&order=captured_at`);
export const anomalyRows = (symbol?: string) =>
  rest<Anom>(`anomalies?select=captured_at,symbol,venue_name,pair,bps,volume_24h,dup${symbol ? `&symbol=eq.${symbol}` : ''}&order=captured_at`);
