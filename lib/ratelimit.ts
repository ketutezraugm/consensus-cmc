// Caps free-text (LLM-backed) Telegram messages per chat, so one chat can't run up Anthropic API
// cost. A sliding-window count against an insert-only table (supabase/migrations/0006_chat_events.sql)
// — approximate under concurrent requests from the same chat, not a distributed lock, which is fine
// for this threat model (bounding spend, not enforcing an exact quota).
const H = () => ({ apikey: process.env.SUPABASE_SERVICE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' });
const url = (q: string) => `${process.env.SUPABASE_URL}/rest/v1/${q}`;

export const CHAT_LIMIT = 8;
export const CHAT_WINDOW_MIN = 5;

// Returns true and records the event if the chat is under its limit; false (records nothing) if not.
export async function allowChatMessage(chatId: number | string, limit = CHAT_LIMIT, windowMin = CHAT_WINDOW_MIN): Promise<boolean> {
  const since = new Date(Date.now() - windowMin * 60_000).toISOString();
  const countRes = await fetch(url(`chat_events?select=id&chat_id=eq.${chatId}&created_at=gte.${since}&limit=${limit}`), { headers: H() });
  if (!countRes.ok) throw new Error(`chat_events select ${countRes.status}: ${await countRes.text()}`);
  const recent = (await countRes.json()) as unknown[];
  if (recent.length >= limit) return false;

  const insertRes = await fetch(url('chat_events'), { method: 'POST', headers: { ...H(), Prefer: 'return=minimal' }, body: JSON.stringify({ chat_id: Number(chatId) }) });
  if (!insertRes.ok) throw new Error(`chat_events insert ${insertRes.status}: ${await insertRes.text()}`);
  return true;
}
