import { timingSafeEqual } from 'node:crypto';
import { answer, send, type Deps } from '@/lib/telegram';
import { currentAlerts, assetsRanked, assetReport, rwaAssets, rwaReport } from '@/lib/tools';
import { ensureSubscribed, unsubscribe, watch, unwatch, getSubscriber } from '@/lib/subscribers';
import { errMsg } from '@/lib/fmt';

export const maxDuration = 30;

const deps: Deps = {
  alerts: currentAlerts, assets: assetsRanked, asset: assetReport, rwaAssets, rwa: rwaReport,
  subscribe: ensureSubscribed, unsubscribe, watch, unwatch, myWatchlist: getSubscriber,
};

type TelegramMessage = { text?: string; chat: { id: number } };
type TelegramUpdate = { message?: TelegramMessage; channel_post?: TelegramMessage };

const authorized = (req: Request) => {
  const want = Buffer.from(process.env.TELEGRAM_WEBHOOK_SECRET ?? '');
  const got = Buffer.from(req.headers.get('x-telegram-bot-api-secret-token') ?? '');
  return want.length >= 16 && want.length === got.length && timingSafeEqual(want, got);
};

// Telegram calls this for every message. Always answer 200 once authorised, or Telegram retries the same update.
export async function POST(req: Request) {
  if (!authorized(req)) return new Response('unauthorized', { status: 401 });
  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
  const m = update?.message ?? update?.channel_post;
  if (m?.text && m.chat?.id !== undefined) {
    try {
      const text = await answer(m.text, m.chat.id, deps);
      if (text) await send(text, m.chat.id);
    } catch (e: unknown) {
      await send(`Something went wrong: ${errMsg(e).slice(0, 200)}`, m.chat.id).catch(() => {});
    }
  }
  return Response.json({ ok: true });
}
