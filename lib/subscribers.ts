// CRUD for Telegram subscribers. Read-modify-write on the whole row (matches the read-then-compute-in-JS
// style used everywhere else in this codebase) rather than fighting Postgres array operators over REST.
export type Subscriber = { chat_id: number; symbols: string[] };

const H = () => ({ apikey: process.env.SUPABASE_SERVICE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' });
const url = (q: string) => `${process.env.SUPABASE_URL}/rest/v1/${q}`;

async function req(method: string, q: string, body?: unknown, prefer?: string) {
  const res = await fetch(url(q), { method, headers: { ...H(), ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`subscribers ${method} ${res.status}: ${await res.text()}`);
  return res;
}

export async function getSubscriber(chatId: number | string): Promise<Subscriber | null> {
  const rows = (await (await req('GET', `subscribers?select=chat_id,symbols&chat_id=eq.${chatId}`)).json()) as Subscriber[];
  return rows[0] ?? null;
}

export async function listSubscribers(): Promise<Subscriber[]> {
  return (await req('GET', 'subscribers?select=chat_id,symbols')).json();
}

// Ensures a row exists; never overwrites an existing subscription's symbol filter.
export async function ensureSubscribed(chatId: number | string): Promise<void> {
  await req('POST', 'subscribers', { chat_id: Number(chatId), symbols: [] }, 'resolution=ignore-duplicates,return=minimal');
}

export async function unsubscribe(chatId: number | string): Promise<void> {
  await req('DELETE', `subscribers?chat_id=eq.${chatId}`);
}

async function setSymbols(chatId: number | string, symbols: string[]): Promise<Subscriber> {
  await req('POST', 'subscribers', { chat_id: Number(chatId), symbols, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=minimal');
  return { chat_id: Number(chatId), symbols };
}

export async function watch(chatId: number | string, symbol: string): Promise<Subscriber> {
  const existing = (await getSubscriber(chatId))?.symbols ?? [];
  const sym = symbol.toUpperCase();
  return setSymbols(chatId, existing.includes(sym) ? existing : [...existing, sym]);
}

// Returns null if the chat was never subscribed at all.
export async function unwatch(chatId: number | string, symbol: string): Promise<Subscriber | null> {
  const current = await getSubscriber(chatId);
  if (!current) return null;
  return setSymbols(chatId, current.symbols.filter((s) => s !== symbol.toUpperCase()));
}
