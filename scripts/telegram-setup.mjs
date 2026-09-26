// One-time setup: points Telegram at the webhook and registers the command menu.
// Needs TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in .env.local.
// Run: node --env-file=.env.local scripts/telegram-setup.mjs [https://your-site]
const token = process.env.TELEGRAM_BOT_TOKEN, secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const site = process.argv[2] ?? 'https://consensus-cmc.vercel.app';
if (!token || !secret || secret.length < 16) {
  console.error('Set TELEGRAM_BOT_TOKEN and a TELEGRAM_WEBHOOK_SECRET of at least 16 characters.');
  process.exit(1);
}
const api = async (method, body) =>
  (await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) })).json();

const me = await api('getMe');
if (!me.ok) { console.error('Bad token:', me.description); process.exit(1); }
console.log('bot:', '@' + me.result.username);
console.log('setWebhook:', (await api('setWebhook', { url: `${site}/api/telegram`, secret_token: secret, allowed_updates: ['message', 'channel_post'], drop_pending_updates: true })).description);
console.log('setMyCommands:', (await api('setMyCommands', { commands: [
  { command: 'alerts', description: 'What to know before you trade, right now' },
  { command: 'check', description: 'Pre-trade check, e.g. /check BCH' },
  { command: 'assets', description: 'Tracked assets, least trustworthy first' },
  { command: 'rwa', description: 'Tokenised stocks and commodities' },
  { command: 'id', description: 'Show this chat id for automatic alerts' },
] })).ok);
console.log('webhook info:', JSON.stringify((await api('getWebhookInfo')).result));
