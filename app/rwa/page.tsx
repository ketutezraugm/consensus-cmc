import Link from 'next/link';
import { captures, rwaObservations } from '@/lib/data';
import { scoreAssets } from '@/lib/rwa';
import { Dispersion, Legend, type V } from '@/components/Charts';
import { ago, pct, usd } from '@/lib/fmt';

export const metadata = { title: 'Tokenised assets | Consensus' };

const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];

export default async function Rwa() {
  const at = (await captures())[0];
  const obs = at ? await rwaObservations(at) : [];
  if (!obs.length) return <main className="mx-auto max-w-6xl px-5 py-10 text-muted">Tokenised-asset data is being recorded; check back after the next capture.</main>;

  const assets = scoreAssets(obs).sort((a, b) => b.r.dispersionBps - a.r.dispersionBps);
  const widest = [...assets].sort((a, b) => b.r.spreadBps - a.r.spreadBps)[0];
  const liq = widest.r.rows.filter((x) => x.kind === 'liquid' && x.price);
  const hi = liq.reduce((m, x) => (x.price! > m.price! ? x : m)), lo = liq.reduce((m, x) => (x.price! < m.price! ? x : m));
  const untracked = assets.reduce((s, a) => s + a.r.untracked, 0);
  const thinByIssuer = new Map<string, number>();
  for (const a of assets) for (const t of a.r.rows) if (t.kind === 'thin' && t.bps !== null && Math.abs(t.bps) > 100) thinByIssuer.set(t.issuer, (thinByIssuer.get(t.issuer) ?? 0) + 1);
  const thinTotal = [...thinByIssuer.values()].reduce((s, x) => s + x, 0);
  const thinTop = [...thinByIssuer].sort((a, b) => b[1] - a[1])[0];
  const cards = [
    { v: `${Math.round(med(assets.map((a) => a.r.dispersionBps)))} bps`, k: 'typical disagreement between issuers of the same asset', note: `median across ${assets.length} tokenised assets: they mostly agree`, c: 'var(--color-good)', href: '#assets' },
    { v: `${(hi.price! / lo.price!).toFixed(1)}x`, k: `${widest.symbol}: highest and lowest liquid token differ`, note: `${hi.issuer} vs ${lo.issuer}; the API does not say why`, c: 'var(--color-bad)', href: `/rwa/${widest.symbol}` },
    { v: String(thinTotal), k: 'low-volume tokens quoting over 1% off the market', note: thinTop ? `${thinTop[1]} of them are ${thinTop[0]}` : '', c: 'var(--color-warn)', href: '#assets' },
    { v: String(untracked), k: 'listed tokens with no price at all', note: 'CMC lists them but returns a null price', c: 'var(--color-muted)', href: '#assets' },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <h1 className="max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl">Tokenised assets: do the issuers agree?</h1>
      <p className="mt-3 max-w-3xl text-base text-muted">
        One stock or commodity, tokenised by several issuers on several chains. CoinMarketCap publishes one average price for each. This shows every
        issuer&apos;s token against the price the liquid ones agree on.
      </p>
      <p className="num mt-3 text-sm text-muted">{assets.length} assets · {obs.length} tokens · latest {ago(at)}</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.k} href={c.href} className="rounded-lg border border-line bg-panel p-4 transition-colors hover:border-accent" style={{ borderLeft: `3px solid ${c.c}` }}>
            <div className="num text-3xl font-semibold">{c.v}</div>
            <div className="mt-1.5 text-sm leading-snug">{c.k}</div>
            <div className="mt-1.5 text-xs text-muted">{c.note}</div>
          </Link>
        ))}
      </div>

      <div id="assets" className="mt-12 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Every issuer&apos;s token, per asset</h2>
          <p className="mt-1 text-sm text-muted">Widest disagreement first. Grey ticks are low-volume or derivative tokens.</p>
        </div>
        <Legend grey="low volume or derivative" />
      </div>
      <div className="mt-5 space-y-2.5">
        {assets.map(({ symbol, type, r }) => {
          const venues: V[] = r.rows
            .filter((x) => x.price && x.kind !== 'unit')
            .map((x) => ({ name: `${x.issuer} ${x.symbol}`, price: x.price!, volume: x.volume, excluded: x.kind !== 'liquid', priceExcluded: x.kind !== 'liquid' }));
          return (
            <Link key={symbol} href={`/rwa/${symbol}`} className="block rounded-lg border border-line bg-panel p-4 transition-colors hover:border-accent">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="w-16 text-base font-semibold">{symbol}</span>
                <span className="rounded bg-raised px-1.5 text-[11px] text-muted">{type}</span>
                <span className="num text-sm">{Math.round(r.dispersionBps)} bps</span>
                <span className="text-xs text-muted">weighted disagreement</span>
                <span className="num ml-auto text-xs text-muted">
                  {r.tokens} tokens · {r.liquid} liquid · {pct(r.topShare, 0)} {r.topIssuer} · {usd(r.mcap)} tokenised
                </span>
              </div>
              <div className="mt-2.5"><Dispersion venues={venues} refPrice={r.ref} h={64} axis={false} /></div>
              {(r.unitMismatch > 0 || r.untracked > 0) && (
                <div className="mt-1 text-[11px] text-muted">
                  {r.unitMismatch > 0 && `${r.unitMismatch} token${r.unitMismatch > 1 ? 's' : ''} priced in a different unit (not shown). `}
                  {r.untracked > 0 && `${r.untracked} with no price.`}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      <p className="mt-10 max-w-3xl text-xs leading-relaxed text-muted">
        A token counts as liquid with at least $10k of 24h volume. The reference is the market-cap-weighted median of liquid tokens. Tokens priced at
        roughly 1/31.1 (per gram) or a power of ten of the reference are treated as unit differences, not disagreement. The API does not include the
        underlying stock&apos;s own price, so this compares tokens with each other, not with the stock.
      </p>
    </main>
  );
}
