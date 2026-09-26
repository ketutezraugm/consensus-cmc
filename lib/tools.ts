// Read-only reports shared by the MCP server and the Telegram bot. Each returns plain data, never formatted text.
import { scoreHistory, anomalyRows, captures, rwaObservations } from './data.ts';
import { latestPerSymbol, venueBoard } from './history.ts';
import { alerts, type Alert } from './alerts.ts';
import { scoreAssets } from './rwa.ts';

const round = (x: number | null, d = 1) => (x === null || !Number.isFinite(x) ? null : +x.toFixed(d));

export async function currentAlerts(symbol?: string): Promise<Alert[]> {
  const [scores, anoms] = await Promise.all([scoreHistory(), anomalyRows()]);
  const all = alerts(scores, anoms);
  return symbol ? all.filter((a) => a.symbol === symbol.toUpperCase()) : all;
}

export async function assetsRanked() {
  const scores = await scoreHistory();
  return latestPerSymbol(scores)
    .sort((a, b) => a.confidence - b.confidence)
    .map((s) => ({
      symbol: s.symbol, confidence: s.confidence, venues: s.venues, top_venue: s.top_venue, top_share_pct: round(s.top_share * 100, 1),
      volume_in_agreement_pct: round(s.agreeing_share * 100, 0), volume_cmc_excludes_pct: round(s.excluded_share * 100, 0), dex_gap_bps: round(s.dex_gap_bps, 0),
    }));
}

export async function assetReport(symbol: string) {
  const sym = symbol.toUpperCase().trim();
  const [hist, anoms, all] = await Promise.all([scoreHistory(sym), anomalyRows(sym), currentAlerts(sym)]);
  if (hist.length === 0) return null;
  const now = hist.at(-1)!;
  return {
    symbol: sym, as_of: now.captured_at, confidence: now.confidence, confidence_recent: hist.slice(-12).map((h) => h.confidence),
    venues: now.venues, effective_venues: round(now.effective_venues, 1), top_venue: now.top_venue, top_share_pct: round(now.top_share * 100, 1),
    volume_in_agreement_pct: round(now.agreeing_share * 100, 0), volume_cmc_excludes_pct: round(now.excluded_share * 100, 0),
    dex_gap_bps: round(now.dex_gap_bps, 0), funding_per_interval_bps: round(now.funding === null ? null : now.funding * 1e4, 2), basis_bps: round(now.basis === null ? null : now.basis * 1e4, 1),
    captures_recorded: hist.length,
    off_market_venues: venueBoard(anoms, hist.length).slice(0, 5).map((v) => ({
      venue: v.key, seen_in_captures: v.captures, typical_gap_bps: round(v.medianBps, 0), peak_volume_usd: round(v.maxVolume, 0),
    })),
    active_alerts: all.map((a) => ({ severity: a.severity, title: a.title, since: a.since })),
  };
}

export async function rwaAssets() {
  const at = (await captures())[0];
  if (!at) return [];
  const obs = await rwaObservations(at);
  return scoreAssets(obs)
    .sort((a, b) => b.r.dispersionBps - a.r.dispersionBps)
    .map(({ symbol, type, r }) => ({
      symbol, type, tokens: r.tokens, liquid_tokens: r.liquid, weighted_disagreement_bps: round(r.dispersionBps, 0),
      highest_vs_lowest_liquid_bps: round(r.spreadBps, 0), tokens_without_price: r.untracked,
    }));
}

export async function rwaReport(symbol: string) {
  const sym = symbol.toUpperCase().trim();
  const at = (await captures())[0];
  if (!at) return null;
  const s = scoreAssets(await rwaObservations(at, sym))[0];
  if (!s) return null;
  return {
    symbol: sym, type: s.type, as_of: at, reference_price_usd: round(s.r.ref, 4), tokens: s.r.tokens, issuers: s.r.issuers, liquid_tokens: s.r.liquid,
    weighted_disagreement_bps: round(s.r.dispersionBps, 0), highest_vs_lowest_liquid_bps: round(s.r.spreadBps, 0),
    largest_issuer: s.r.topIssuer, largest_issuer_share_pct: round(s.r.topShare * 100, 0),
    note: 'Compares issuers with each other. The API has no underlying-asset price. Tokens under $10k daily volume, per-unit-different tokens and unpriced tokens are excluded from the disagreement figures.',
    tokens_detail: [...s.r.rows].sort((a, b) => b.volume - a.volume).map((t) => ({
      issuer: t.issuer, token: t.symbol, kind: t.kind, price_usd: round(t.price, 3), vs_reference_bps: round(t.bps, 0), volume_24h_usd: round(t.volume, 0),
    })),
  };
}
