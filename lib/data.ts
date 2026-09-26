
const H = () => ({ apikey: process.env.SUPABASE_SERVICE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` });

// Paginated read (PostgREST caps a response at 1000 rows). Cached 60s: captures land every 30 min.
async function rest<T>(q: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${q}`, { headers: { ...H(), Range: `${from}-${from + 999}` }, next: { revalidate: 60 } });
    if (!r.ok) throw new Error(`supabase ${r.status}: ${await r.text()}`);
    const rows = (await r.json()) as T[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
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
