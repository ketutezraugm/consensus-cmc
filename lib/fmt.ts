export const usd = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n).toLocaleString('en-US')}`;
export const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
export const bps = (x: number) => `${x > 0 ? '+' : ''}${Math.round(x)} bps`;
export const ago = (iso: string) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 90 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };
export const stamp = (iso: string | number) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }) + ' UTC';
