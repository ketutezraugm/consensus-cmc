// De-duplicates Telegram webhook deliveries by update_id (supabase/migrations/0007_telegram_updates.sql).
// Telegram retries an update it didn't get a timely 200 for — without this, a slow reply (most likely
// the LLM chat path) would be reprocessed from scratch, doubling latency and, worse, doubling API cost.
const H = () => ({ apikey: process.env.SUPABASE_SERVICE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' });
const url = (q: string) => `${process.env.SUPABASE_URL}/rest/v1/${q}`;

// Records the update_id and returns true the first time it's seen; false (recording nothing new) on
// a repeat delivery. resolution=ignore-duplicates means a repeat insert succeeds but inserts no row,
// so return=representation comes back empty — that emptiness is the "already seen" signal.
export async function firstTimeSeen(updateId: number): Promise<boolean> {
  const res = await fetch(url('telegram_updates'), {
    method: 'POST', headers: { ...H(), Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ update_id: updateId }),
  });
  if (!res.ok) throw new Error(`telegram_updates insert ${res.status}: ${await res.text()}`);
  const rows = (await res.json()) as unknown[];
  return rows.length > 0;
}
