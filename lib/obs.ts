import type { Venue } from './consensus.ts';

export type Obs = {
  captured_at: string; crypto_id: number; symbol: string; venue_id: string; venue_name: string; price: string | number; volume_24h: string | number;
  extra: { pair: string; oi: number | null; index_price: number | null; basis: number | null; funding: number | null; outlier: boolean; exclusions: string[]; updated?: string; dup?: boolean };
};
export type PoolObs = Omit<Obs, 'extra'> & { extra: { pair: string; liquidity: number; updated?: string; token: string } };

export const toVenue = (o: Obs): Venue & { pair: string; dup: boolean; exclusions: string[]; index: number | null } => ({
  id: o.venue_id as unknown as number, name: o.venue_name, price: +o.price, volume: +o.volume_24h, oi: o.extra.oi ?? 0,
  basis: o.extra.basis, funding: o.extra.funding, updated: o.extra.updated ? Date.parse(o.extra.updated) : 0,
  excluded: o.extra.outlier || o.extra.exclusions.length > 0,
  priceExcluded: o.extra.outlier || o.extra.exclusions.includes('price'),
  pair: o.extra.pair, dup: !!o.extra.dup, exclusions: o.extra.exclusions, index: o.extra.index_price,
});

export type RwaObs = {
  captured_at: string; crypto_id: number; symbol: string; venue_id: string; venue_name: string;
  price: string | number | null; volume_24h: string | number | null;
  extra: { token: string; name: string; mcap: number | null; asset_type: string; avg_price: number | null };
};
