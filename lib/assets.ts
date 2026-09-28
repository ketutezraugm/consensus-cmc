// Watchlist recorded every capture: the top 40 crypto assets by market cap, excluding stablecoins and
// gold/fiat-pegged tokens (USDT, USDC, USDe, DAI, USD1, USDG, PYUSD, RLUSD, PAXG, XAUt) since they have
// no real disagreement story — the whole point of tracking them would be defeated by design.
// Widened from the original 15 once the CMC key moved to the Startup tier (450k credits/month,
// 2026-09-28); see docs/submission-*.md for the credit-budget math behind this size.
export const WATCHLIST: Record<number, string> = {
  1: 'BTC', 1027: 'ETH', 1839: 'BNB', 52: 'XRP', 5426: 'SOL', 1958: 'TRX', 1437: 'ZEC', 32196: 'HYPE',
  74: 'DOGE', 1975: 'LINK', 328: 'XMR', 2010: 'ADA', 3957: 'LEO', 512: 'XLM', 6535: 'NEAR', 1831: 'BCH',
  7083: 'UNI', 37263: 'CC', 2: 'LTC', 20947: 'SUI', 5805: 'AVAX', 11419: 'TON', 4642: 'HBAR', 22974: 'TAO',
  3155: 'QNT', 5994: 'SHIB', 3635: 'CRO', 21159: 'ONDO', 30171: 'ENA', 35491: 'M', 3897: 'OKB', 7278: 'AAVE',
  36507: 'PUMP', 27075: 'MNT', 6636: 'DOT', 13502: 'WLD', 36341: 'ASTER', 33038: 'SKY', 33251: 'WLFI', 24478: 'PEPE',
};

export const NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', BNB: 'BNB', XRP: 'XRP', SOL: 'Solana', TRX: 'Tron', ZEC: 'Zcash', HYPE: 'Hyperliquid',
  DOGE: 'Dogecoin', LINK: 'Chainlink', XMR: 'Monero', ADA: 'Cardano', LEO: 'UNUS SED LEO', XLM: 'Stellar', NEAR: 'NEAR Protocol',
  BCH: 'Bitcoin Cash', UNI: 'Uniswap', CC: 'Canton', LTC: 'Litecoin', SUI: 'Sui', AVAX: 'Avalanche', TON: 'Toncoin',
  HBAR: 'Hedera', TAO: 'Bittensor', QNT: 'Quant', SHIB: 'Shiba Inu', CRO: 'Cronos', ONDO: 'Ondo', ENA: 'Ethena',
  M: 'MemeCore', OKB: 'OKB', AAVE: 'Aave', PUMP: 'Pump.fun', MNT: 'Mantle', DOT: 'Polkadot', WLD: 'Worldcoin',
  ASTER: 'Aster', SKY: 'Sky', WLFI: 'World Liberty Financial', PEPE: 'Pepe',
};
