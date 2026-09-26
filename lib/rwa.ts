import { rwaScore, type Tok } from './consensus.ts';
import type { RwaObs } from './obs.ts';

export const toTok = (o: RwaObs): Tok => ({
  id: +o.venue_id, symbol: o.extra.token, issuer: o.venue_name, price: o.price === null ? null : +o.price,
  mcap: o.extra.mcap ?? 0, volume: o.volume_24h === null ? 0 : +o.volume_24h,
});

// Group one capture's token rows into scored assets.
export function scoreAssets(obs: RwaObs[]) {
  return Object.entries(Object.groupBy(obs, (o) => o.symbol))
    .map(([symbol, rs]) => ({ symbol, type: rs![0].extra.asset_type, r: rwaScore(rs!.map(toTok)) }))
    .flatMap((x) => (x.r ? [{ ...x, r: x.r }] : []));
}
