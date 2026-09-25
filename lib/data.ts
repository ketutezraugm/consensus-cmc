import type { Venue } from './consensus';

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

export type Obs = {
  captured_at: string; crypto_id: number; symbol: string; venue_id: string; venue_name: string; price: string; volume_24h: string;
  extra: { pair: string; oi: number | null; index_price: number | null; basis: number | null; funding: number | null; outlier: boolean; exclusions: string[]; updated?: string; dup?: boolean };
};
export type Liq = { symbol: string; long_1h: number; short_1h: number; long_4h: number; short_4h: number; long_24h: number; short_24h: number };

export const toVenue = (o: Obs): Venue & { pair: string; dup: boolean; exclusions: string[]; index: number | null } => ({
  id: o.venue_id as unknown as number, name: o.venue_name, price: +o.price, volume: +o.volume_24h, oi: o.extra.oi ?? 0,
  basis: o.extra.basis, funding: o.extra.funding, updated: o.extra.updated ? Date.parse(o.extra.updated) : 0,
  excluded: o.extra.outlier || o.extra.exclusions.length > 0,
  priceExcluded: o.extra.outlier || o.extra.exclusions.includes('price'),
  pair: o.extra.pair, dup: !!o.extra.dup, exclusions: o.extra.exclusions, index: o.extra.index_price,
});

export async function captures(): Promise<string[]> {
  const rows = await rest<{ captured_at: string }>('liquidations?select=captured_at&crypto_id=eq.0&order=captured_at.desc');
  return rows.map((r) => r.captured_at);
}
export const observations = (at: string, symbol?: string) =>
  rest<Obs>(`observations?select=*&captured_at=eq.${encodeURIComponent(at)}${symbol ? `&symbol=eq.${symbol}` : ''}`);
export const liquidations = (at: string) => rest<Liq>(`liquidations?select=*&captured_at=eq.${encodeURIComponent(at)}`);
