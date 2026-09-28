// Watchlist recorded every capture: the top 40 crypto assets by market cap, excluding stablecoins and
// gold/fiat-pegged tokens (USDT, USDC, USDe, DAI, USD1, USDG, PYUSD, RLUSD, PAXG, XAUt) since they have
// no real disagreement story — the whole point of tracking them would be defeated by design.
// Widened from the original 15 once the CMC key moved to the Startup tier (450k credits/month,
// 2026-09-28); see docs/submission-*.md for the credit-budget math behind this size.
//
// Also excluded: PEPE and SHIB. Their perpetual contracts are quoted in two different denominations
// across exchanges — roughly half report price "per token" (~$0.00416 for PEPE) and half "per 1000
// tokens" (~$0.00000416), a clean 1000x split with real volume on both sides — the same class of
// problem lib/consensus.ts's unitFactor() already detects for tokenised gold (per-gram vs per-troy-
// ounce), just not yet ported to the crypto/perpetuals scoring path. Until that detection exists here,
// these two would score as wildly "disagreeing" for a reason that has nothing to do with real market
// disagreement, so they're left out rather than shown wrong. Re-add once toVenues()/score() in
// lib/consensus.ts can detect and normalise a per-1000 quote the way the RWA layer already does.
export const WATCHLIST: Record<number, string> = {
  1: 'BTC', 1027: 'ETH', 1839: 'BNB', 52: 'XRP', 5426: 'SOL', 1958: 'TRX', 1437: 'ZEC', 32196: 'HYPE',
  74: 'DOGE', 1975: 'LINK', 328: 'XMR', 2010: 'ADA', 3957: 'LEO', 512: 'XLM', 6535: 'NEAR', 1831: 'BCH',
  7083: 'UNI', 37263: 'CC', 2: 'LTC', 20947: 'SUI', 5805: 'AVAX', 11419: 'TON', 4642: 'HBAR', 22974: 'TAO',
  3155: 'QNT', 3635: 'CRO', 21159: 'ONDO', 30171: 'ENA', 35491: 'M', 3897: 'OKB', 7278: 'AAVE',
  36507: 'PUMP', 27075: 'MNT', 6636: 'DOT', 13502: 'WLD', 36341: 'ASTER', 33038: 'SKY', 33251: 'WLFI',
};

// A symbol dropped from WATCHLIST keeps its old rows in the history tables (asset_scores, anomalies),
// so anywhere history is aggregated across "every tracked symbol" needs this filter — otherwise a
// removed symbol's last (possibly stale/wrong) reading keeps surfacing forever, since it never gets
// a fresh row to replace it. Its own /SYMBOL page is intentionally not filtered: that's a direct,
// honest look at what was recorded, not a "right now, across everything we track" view.
export const TRACKED = new Set(Object.values(WATCHLIST));

export const NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', BNB: 'BNB', XRP: 'XRP', SOL: 'Solana', TRX: 'Tron', ZEC: 'Zcash', HYPE: 'Hyperliquid',
  DOGE: 'Dogecoin', LINK: 'Chainlink', XMR: 'Monero', ADA: 'Cardano', LEO: 'UNUS SED LEO', XLM: 'Stellar', NEAR: 'NEAR Protocol',
  BCH: 'Bitcoin Cash', UNI: 'Uniswap', CC: 'Canton', LTC: 'Litecoin', SUI: 'Sui', AVAX: 'Avalanche', TON: 'Toncoin',
  HBAR: 'Hedera', TAO: 'Bittensor', QNT: 'Quant', CRO: 'Cronos', ONDO: 'Ondo', ENA: 'Ethena',
  M: 'MemeCore', OKB: 'OKB', AAVE: 'Aave', PUMP: 'Pump.fun', MNT: 'Mantle', DOT: 'Polkadot', WLD: 'Worldcoin',
  ASTER: 'Aster', SKY: 'Sky', WLFI: 'World Liberty Financial',
};
