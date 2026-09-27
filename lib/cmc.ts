const BASE = 'https://pro-api.coinmarketcap.com';

export class CmcError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// Returns { data, credits }. Throws CmcError on non-2xx so callers can collect per-asset warnings.
// Callers should pass an explicit <T> for the fields of `data` they read; it defaults to `unknown`
// rather than `any` so an un-annotated call fails to compile instead of silently trusting the shape.
export async function cmc<T = unknown>(path: string, params: Record<string, string | number> = {}) {
  const key = process.env.CMC_API_KEY;
  if (!key) throw new Error('CMC_API_KEY not set');
  const url = `${BASE}${path}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;
  const res = await fetch(url, { headers: { 'X-CMC_PRO_API_KEY': key, Accept: 'application/json' }, cache: 'no-store' });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new CmcError(res.status, body?.status?.error_message ?? res.statusText);
  return { data: body.data as T, credits: (body.status?.credit_count ?? 0) as number };
}
