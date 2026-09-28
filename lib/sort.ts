// Comparators for the clickable column headers on the asset list and tokenised-asset list
// (components/AssetList.tsx, components/RwaList.tsx). Pulled out plain so they're testable without a DOM.

export type SortDir = 1 | -1;

export type AssetSortKey = 'symbol' | 'confidence' | 'share' | 'pub';
export const ASSET_DEFAULT_DIR: Record<AssetSortKey, SortDir> = { symbol: 1, confidence: 1, share: -1, pub: -1 };
export type AssetSortable = { symbol: string; confidence: number; share: number; pub: number | null };

// A null published-price gap (no CMC quote to compare against) sorts as if its magnitude were -1 — always
// last on "biggest gap first" (desc) and always first on "smallest gap first" (asc), never mixed into the
// middle of real values, which start at 0.
export const cmpAsset = (a: AssetSortable, b: AssetSortable, key: AssetSortKey): number => {
  if (key === 'symbol') return a.symbol.localeCompare(b.symbol);
  if (key === 'confidence') return a.confidence - b.confidence;
  if (key === 'share') return a.share - b.share;
  const av = a.pub === null ? -1 : Math.abs(a.pub), bv = b.pub === null ? -1 : Math.abs(b.pub);
  return av - bv;
};

export type RwaSortKey = 'disagreement' | 'symbol' | 'tokens' | 'mcap';
export const RWA_DEFAULT_DIR: Record<RwaSortKey, SortDir> = { disagreement: -1, symbol: 1, tokens: -1, mcap: -1 };
export type RwaSortable = { symbol: string; dispersionBps: number; tokens: number; mcap: number };

export const cmpRwa = (a: RwaSortable, b: RwaSortable, key: RwaSortKey): number => {
  if (key === 'symbol') return a.symbol.localeCompare(b.symbol);
  if (key === 'tokens') return a.tokens - b.tokens;
  if (key === 'mcap') return a.mcap - b.mcap;
  return a.dispersionBps - b.dispersionBps;
};
