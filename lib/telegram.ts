// Telegram bot: command parsing, message formatting, sending. Formatting and command handling are pure so they are testable.
import type { Alert } from './alerts.ts';
import { dur } from './fmt.ts';

const SITE = () => process.env.SITE_URL ?? 'https://consensus-cmc.vercel.app';
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sign = (n: number | null) => (n === null ? 'n/a' : `${n > 0 ? '+' : ''}${n}`);

export const HELP = [
  '<b>Consensus</b>: who really sets the price of what you trade.',
  '',
  '/alerts [SYMBOL]: what to know before you trade, right now',
  '/check SYMBOL: pre-trade check, e.g. /check BCH',
  '/assets: all tracked assets, least trustworthy first',
  '/rwa [SYMBOL]: tokenised stocks and commodities, e.g. /rwa NVDA',
  '/id: show this chat\'s id (used to receive automatic alerts)',
  '',
  'Data comes from the CoinMarketCap API and is recorded every 30 minutes.',
].join('\n');

export function fmtAlert(a: Alert) {
  return `${a.severity === 'high' ? '🔴' : '🟡'} <b>${esc(a.title)}</b>\n${esc(a.detail)}\nfor ${dur(a.since)} · <a href="${SITE()}${a.href}">details</a>`;
}

export function fmtAlerts(list: Alert[], limit = 8) {
  if (!list.length) return 'Nothing unusual in the latest capture.';
  const shown = list.slice(0, limit).map(fmtAlert).join('\n\n');
  return list.length > limit ? `${shown}\n\n…and ${list.length - limit} more: ${SITE()}/alerts` : shown;
}

export function fmtAssets(rows: { symbol: string; confidence: number; top_venue: string; top_share_pct: number | null }[]) {
  const line = (r: (typeof rows)[number]) => `${r.confidence < 65 ? '🔴' : r.confidence < 85 ? '🟡' : '🟢'} <b>${esc(r.symbol)}</b> ${r.confidence}  <i>${esc(r.top_venue)} ${r.top_share_pct}%</i>`;
  return `<b>Least trustworthy first</b>\n${rows.map(line).join('\n')}\n\n${SITE()}`;
}

export function fmtAsset(r: any) {
  const off = (r.off_market_venues ?? []).slice(0, 3).map((v: any) => `  • ${esc(v.venue)} ${sign(v.typical_gap_bps)} bps, seen in ${v.seen_in_captures} captures`).join('\n');
  return [
    `<b>${esc(r.symbol)}</b> · confidence <b>${r.confidence}</b>/100`,
    `${esc(r.top_venue)} holds ${r.top_share_pct}% of perp volume (${r.effective_venues} effective venues of ${r.venues})`,
    `Volume in agreement: ${r.volume_in_agreement_pct}% · CMC excludes: ${r.volume_cmc_excludes_pct}%`,
    `Funding: ${r.funding_per_interval_bps === null ? 'n/a' : `${sign(r.funding_per_interval_bps)} bps/interval`} · On-chain gap: ${r.dex_gap_bps === null ? 'n/a' : `${sign(r.dex_gap_bps)} bps`}`,
    off ? `Off-market venues:\n${off}` : 'No off-market venues recorded.',
    r.active_alerts?.length ? `Alerts:\n${r.active_alerts.map((a: any) => `  ${a.severity === 'high' ? '🔴' : '🟡'} ${esc(a.title)}`).join('\n')}` : '',
    `Updated ${dur(r.as_of)} ago · <a href="${SITE()}/${r.symbol}">details</a>`,
  ].filter(Boolean).join('\n');
}

export function fmtRwaList(rows: { symbol: string; weighted_disagreement_bps: number | null; liquid_tokens: number }[]) {
  const top = rows.slice(0, 10).map((r) => `<b>${esc(r.symbol)}</b> ${r.weighted_disagreement_bps} bps (${r.liquid_tokens} liquid tokens)`).join('\n');
  return `<b>Issuers disagree most on</b>\n${top}\n\n${SITE()}/rwa`;
}

export function fmtRwa(r: any) {
  const toks = (r.tokens_detail as any[]).filter((t) => t.price_usd !== null).slice(0, 6)
    .map((t) => `  • ${esc(t.issuer)} ${esc(t.token)}: $${t.price_usd} ${t.vs_reference_bps === null ? '(other unit)' : `(${sign(t.vs_reference_bps)} bps)`} <i>${t.kind}</i>`).join('\n');
  return [
    `<b>${esc(r.symbol)}</b> ${esc(r.type)}, tokenised · reference $${r.reference_price_usd}`,
    `${r.tokens} tokens from ${r.issuers} issuers · weighted disagreement ${r.weighted_disagreement_bps} bps`,
    toks,
    `<a href="${SITE()}/rwa/${r.symbol}">details</a>`,
  ].join('\n');
}

export function parseCommand(text: string): { cmd: string; arg: string } | null {
  const m = /^\/([a-z_]+)(?:@\w+)?(?:\s+(.*))?$/i.exec(text.trim());
  return m ? { cmd: m[1].toLowerCase(), arg: (m[2] ?? '').trim().split(/\s+/)[0]?.toUpperCase() ?? '' } : null;
}

export type Deps = {
  alerts: (symbol?: string) => Promise<Alert[]>; assets: () => Promise<any[]>; asset: (s: string) => Promise<any | null>;
  rwaAssets: () => Promise<any[]>; rwa: (s: string) => Promise<any | null>;
};

// Returns the HTML reply for one incoming message, or null when the message is not for the bot.
export async function answer(text: string, chatId: number | string, deps: Deps): Promise<string | null> {
  const c = parseCommand(text);
  if (!c) return null;
  switch (c.cmd) {
    case 'start': case 'help': return HELP;
    case 'id': return `This chat's id is <code>${chatId}</code>`;
    case 'alerts': return fmtAlerts(await deps.alerts(c.arg || undefined));
    case 'assets': return fmtAssets(await deps.assets());
    case 'check': {
      if (!c.arg) return 'Which asset? For example: /check BTC';
      const r = await deps.asset(c.arg);
      return r ? fmtAsset(r) : `No data for ${esc(c.arg)}. Try /assets for the tracked symbols.`;
    }
    case 'rwa': {
      if (!c.arg) return fmtRwaList(await deps.rwaAssets());
      const r = await deps.rwa(c.arg);
      return r ? fmtRwa(r) : `No tokenised asset ${esc(c.arg)}. Try /rwa for the list.`;
    }
    default: return `Unknown command. ${HELP}`;
  }
}

export async function send(text: string, chatId: number | string, token = process.env.TELEGRAM_BOT_TOKEN) {
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
  });
  if (!res.ok) throw new Error(`telegram ${res.status}: ${await res.text()}`);
}

// Push alerts that were not present in the previous capture to the configured chat.
export async function pushAlerts(fresh: Alert[]) {
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!chat || !fresh.length) return 0;
  const head = fresh.length === 1 ? 'New alert' : `${fresh.length} new alerts`;
  await send(`<b>${head}</b>\n\n${fmtAlerts(fresh, 5)}`, chat);
  return fresh.length;
}
