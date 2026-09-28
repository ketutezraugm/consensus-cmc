// Telegram bot: command parsing, message formatting, sending. Formatting and command handling are pure so they are testable.
import type { Alert } from './alerts.ts';
import type { Subscriber } from './subscribers.ts';
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
  '',
  '/subscribe: get pushed a message whenever a new alert appears',
  '/watch SYMBOL: only push alerts for this symbol, e.g. /watch BCH (repeatable)',
  '/unwatch SYMBOL: stop watching a symbol',
  '/mywatchlist: show your subscription and watched symbols',
  '/unsubscribe: stop all automatic pushes',
  '/id: show this chat\'s id',
  '',
  'Or just ask in plain English, e.g. "is Bitcoin Cash reliable right now?" — answered from the same',
  'live data, grounded in tool calls, never guessed.',
  '',
  'Data comes from the CoinMarketCap API, recorded on a fixed schedule (not live).',
].join('\n');

export function fmtAlert(a: Alert) {
  return `${a.severity === 'high' ? '🔴' : '🟡'} <b>${esc(a.title)}</b>\n${esc(a.detail)}\nfor ${dur(a.since)} · <a href="${SITE()}${a.href}">details</a>`;
}

export function fmtAlerts(list: Alert[], limit = 8) {
  if (!list.length) return 'Nothing unusual in the latest capture.';
  const shown = list.slice(0, limit).map(fmtAlert).join('\n\n');
  return list.length > limit ? `${shown}\n\n…and ${list.length - limit} more: ${SITE()}/alerts` : shown;
}

export function fmtAssets(rows: AssetSummary[]) {
  const line = (r: (typeof rows)[number]) => `${r.confidence < 65 ? '🔴' : r.confidence < 85 ? '🟡' : '🟢'} <b>${esc(r.symbol)}</b> ${r.confidence}  <i>${esc(r.top_venue)} ${r.top_share_pct}%</i>`;
  return `<b>Least trustworthy first</b>\n${rows.map(line).join('\n')}\n\n${SITE()}`;
}

// What this module needs from each report, not the producer's full shape (lib/tools.ts's real
// return types are a superset of these and satisfy them structurally).
export type AssetReport = {
  symbol: string; confidence: number; top_venue: string; top_share_pct: number | null; effective_venues: number | null; venues: number;
  volume_in_agreement_pct: number | null; volume_cmc_excludes_pct: number | null; funding_per_interval_bps: number | null; dex_gap_bps: number | null;
  published_gap_bps: number | null;
  off_market_venues: { venue: string; typical_gap_bps: number | null; seen_in_captures: number }[];
  active_alerts: { severity: 'high' | 'medium'; title: string }[]; as_of: string;
};
export type RwaAssetSummary = { symbol: string; weighted_disagreement_bps: number | null; liquid_tokens: number };
export type RwaReport = {
  symbol: string; type: string; reference_price_usd: number | null; tokens: number; issuers: number; weighted_disagreement_bps: number | null;
  tokens_detail: { issuer: string; token: string; price_usd: number | null; vs_reference_bps: number | null; kind: string }[];
};

export function fmtAsset(r: AssetReport) {
  const off = r.off_market_venues.slice(0, 3).map((v) => `  • ${esc(v.venue)} ${sign(v.typical_gap_bps)} bps, seen in ${v.seen_in_captures} captures`).join('\n');
  return [
    `<b>${esc(r.symbol)}</b> · confidence <b>${r.confidence}</b>/100`,
    `${esc(r.top_venue)} holds ${r.top_share_pct}% of perp volume (${r.effective_venues} effective venues of ${r.venues})`,
    `Volume in agreement: ${r.volume_in_agreement_pct}% · CMC excludes: ${r.volume_cmc_excludes_pct}%`,
    `Funding: ${r.funding_per_interval_bps === null ? 'n/a' : `${sign(r.funding_per_interval_bps)} bps/interval`} · On-chain gap: ${r.dex_gap_bps === null ? 'n/a' : `${sign(r.dex_gap_bps)} bps`}`,
    `vs CMC published price: ${r.published_gap_bps === null ? 'n/a' : `${sign(r.published_gap_bps)} bps`}`,
    off ? `Off-market venues:\n${off}` : 'No off-market venues recorded.',
    r.active_alerts.length ? `Alerts:\n${r.active_alerts.map((a) => `  ${a.severity === 'high' ? '🔴' : '🟡'} ${esc(a.title)}`).join('\n')}` : '',
    `Updated ${dur(r.as_of)} ago · <a href="${SITE()}/${r.symbol}">details</a>`,
  ].filter(Boolean).join('\n');
}

export function fmtRwaList(rows: RwaAssetSummary[]) {
  const top = rows.slice(0, 10).map((r) => `<b>${esc(r.symbol)}</b> ${r.weighted_disagreement_bps} bps (${r.liquid_tokens} liquid tokens)`).join('\n');
  return `<b>Issuers disagree most on</b>\n${top}\n\n${SITE()}/rwa`;
}

export function fmtRwa(r: RwaReport) {
  const toks = r.tokens_detail.filter((t) => t.price_usd !== null).slice(0, 6)
    .map((t) => `  • ${esc(t.issuer)} ${esc(t.token)}: $${t.price_usd} ${t.vs_reference_bps === null ? '(other unit)' : `(${sign(t.vs_reference_bps)} bps)`} <i>${t.kind}</i>`).join('\n');
  return [
    `<b>${esc(r.symbol)}</b> ${esc(r.type)}, tokenised · reference $${r.reference_price_usd}`,
    `${r.tokens} tokens from ${r.issuers} issuers · weighted disagreement ${r.weighted_disagreement_bps} bps`,
    toks,
    `<a href="${SITE()}/rwa/${r.symbol}">details</a>`,
  ].join('\n');
}

export function fmtWatchlist(sub: Subscriber | null) {
  if (!sub) return "You're not subscribed. Send /subscribe to get pushed new alerts, or /watch SYMBOL to subscribe and filter at once.";
  const scope = sub.symbols.length ? sub.symbols.join(', ') : 'all tracked assets';
  return `Subscribed. Watching: <b>${esc(scope)}</b>.\nUse /watch or /unwatch SYMBOL to change this, /unsubscribe to stop.`;
}

export function parseCommand(text: string): { cmd: string; arg: string } | null {
  const m = /^\/([a-z_]+)(?:@\w+)?(?:\s+(.*))?$/i.exec(text.trim());
  return m ? { cmd: m[1].toLowerCase(), arg: (m[2] ?? '').trim().split(/\s+/)[0]?.toUpperCase() ?? '' } : null;
}

export type AssetSummary = { symbol: string; confidence: number; top_venue: string; top_share_pct: number | null };
export type Deps = {
  alerts: (symbol?: string) => Promise<Alert[]>; assets: () => Promise<AssetSummary[]>;
  asset: (s: string) => Promise<AssetReport | null>; rwaAssets: () => Promise<RwaAssetSummary[]>; rwa: (s: string) => Promise<RwaReport | null>;
  subscribe: (chatId: number | string) => Promise<void>; unsubscribe: (chatId: number | string) => Promise<void>;
  watch: (chatId: number | string, symbol: string) => Promise<Subscriber>; unwatch: (chatId: number | string, symbol: string) => Promise<Subscriber | null>;
  myWatchlist: (chatId: number | string) => Promise<Subscriber | null>;
  // Free-text (non-slash) messages, e.g. "is BTC's price trustworthy right now?". Plain text in, plain
  // text out — the reply is HTML-escaped below, since an LLM's output isn't guaranteed valid Telegram HTML.
  chat: (text: string) => Promise<string>;
  // Per-chat frequency cap on the LLM-backed `chat` path (lib/ratelimit.ts), checked before `chat` is
  // ever called so a spammy chat never reaches the model at all.
  chatAllowed: (chatId: number | string) => Promise<boolean>;
  // Telegram's "typing…" indicator. chat() can take a real multi-second, multi-step model round trip
  // (see lib/agent.ts), during which the chat would otherwise show nothing at all.
  typing: (chatId: number | string) => Promise<void>;
};

const RATE_LIMITED = "You've asked a lot in a short time — give it a few minutes, or use a direct command like /check BTC.";

// Returns the HTML reply for one incoming message, or null when the message is not for the bot.
export async function answer(text: string, chatId: number | string, deps: Deps): Promise<string | null> {
  const c = parseCommand(text);
  if (!c) {
    if (!text.trim()) return null;
    if (!(await deps.chatAllowed(chatId))) return RATE_LIMITED;
    // Telegram's typing indicator fades after ~5s on its own, so it's re-sent every 4s for as long as
    // the (potentially multi-step, multi-second) model call runs, instead of a single ping that would
    // vanish long before the reply arrives.
    void deps.typing(chatId);
    const keepTyping = setInterval(() => void deps.typing(chatId), 4000);
    try {
      return esc(await deps.chat(text.trim()));
    } finally {
      clearInterval(keepTyping);
    }
  }
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
    case 'subscribe': await deps.subscribe(chatId); return fmtWatchlist(await deps.myWatchlist(chatId));
    case 'unsubscribe': await deps.unsubscribe(chatId); return "Unsubscribed. You won't get automatic pushes. Send /subscribe to start again.";
    case 'watch': {
      if (!c.arg) return 'Which symbol? For example: /watch BCH';
      return fmtWatchlist(await deps.watch(chatId, c.arg));
    }
    case 'unwatch': {
      if (!c.arg) return 'Which symbol? For example: /unwatch BCH';
      const r = await deps.unwatch(chatId, c.arg);
      return r ? fmtWatchlist(r) : "You're not subscribed yet — nothing to unwatch. Send /subscribe first.";
    }
    case 'mywatchlist': return fmtWatchlist(await deps.myWatchlist(chatId));
    default: return `Unknown command. ${HELP}`;
  }
}

// A UX ping, not a load-bearing reply: never throws, so a Telegram hiccup here never breaks the chat.
export async function sendTyping(chatId: number | string, token = process.env.TELEGRAM_BOT_TOKEN) {
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  }).catch(() => {});
}

export async function send(text: string, chatId: number | string, token = process.env.TELEGRAM_BOT_TOKEN) {
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
  });
  if (!res.ok) throw new Error(`telegram ${res.status}: ${await res.text()}`);
}

// Empty symbols means "all". Exported so the filtering rule is unit-tested without a network call.
export const relevantAlerts = (fresh: Alert[], symbols: string[]) =>
  symbols.length ? fresh.filter((a) => symbols.includes(a.symbol)) : fresh;

// Push alerts that were not present in the previous capture, filtered per subscriber's watchlist.
// One bad chat (blocked the bot, deleted) must not stop the rest from getting theirs.
export async function pushAlerts(fresh: Alert[], subscribers: Subscriber[]) {
  if (!fresh.length) return 0;
  let sent = 0;
  for (const sub of subscribers) {
    const relevant = relevantAlerts(fresh, sub.symbols);
    if (!relevant.length) continue;
    const head = relevant.length === 1 ? 'New alert' : `${relevant.length} new alerts`;
    try { await send(`<b>${head}</b>\n\n${fmtAlerts(relevant, 5)}`, sub.chat_id); sent++; } catch { /* keep going */ }
  }
  return sent;
}
