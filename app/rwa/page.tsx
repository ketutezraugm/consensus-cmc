import Link from 'next/link';
import { captures, rwaObservations } from '@/lib/data';
import { scoreAssets } from '@/lib/rwa';
import { Dispersion, Legend, type V } from '@/components/Charts';
import { pct, usd } from '@/lib/fmt';
import { Ago } from '@/components/Ago';

// Rendered once per capture: fetches below are tagged 'data' and the recorder revalidates that tag after each capture.
export const revalidate = 1800;

export const metadata = { title: 'Tokenised stocks | Consensus' };

const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];

export default async function Rwa() {
  const at = (await captures())[0];
  const obs = at ? await rwaObservations(at) : [];
  if (!obs.length) return <main className="mx-auto max-w-5xl px-5 py-10 text-fg-2">Tokenised-stock data is being recorded; check back after the next reading.</main>;

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
    { v: `${(med(assets.map((a) => a.r.dispersionBps)) / 100).toFixed(2)}%`, k: 'typical disagreement between issuers of the same asset', note: `median across ${assets.length} tokenised assets: they mostly agree`, href: '#assets' },
    { v: `${(hi.price! / lo.price!).toFixed(1)}x`, k: `${widest.symbol}: highest and lowest liquid token differ`, note: `${hi.issuer} vs ${lo.issuer}; the API does not say why`, href: `/rwa/${widest.symbol}` },
    { v: String(thinTotal), k: 'low-volume tokens quoting over 1% off the market', note: thinTop ? `${thinTop[1]} of them are ${thinTop[0]}` : '', href: '#assets' },
    { v: String(untracked), k: 'listed tokens with no price at all', note: 'CMC lists them but returns a null price', href: '#assets' },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <p className="num text-xs text-fg-2">{assets.length} tokenised stocks &middot; latest reading</p>
      <h1 className="mt-3 max-w-3xl font-serif text-4xl tracking-tight text-fg sm:text-5xl">Tokenised stocks and commodities</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-fg-2">
        A tokenised stock is a crypto token meant to track a real share or commodity, like Apple or gold. Several issuers make tokens for the same
        asset. We compare their prices with each other.
      </p>
      <p className="num mt-3 text-sm text-fg-2">{obs.length} tokens &middot; latest <Ago iso={at} /></p>

      <div className="mt-8 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.k} href={c.href} className="bg-panel p-5 transition-colors hover:bg-raised">
            <div className="num text-3xl text-fg">{c.v}</div>
            <div className="mt-1.5 text-sm leading-snug text-fg">{c.k}</div>
            <div className="mt-1.5 text-xs text-fg-2">{c.note}</div>
          </Link>
        ))}
      </div>

      <div id="assets" className="mt-12 flex flex-wrap items-end justify-between gap-3 border-t border-fg pt-4">
        <div>
          <h2 className="font-serif text-2xl">Most disagreement first</h2>
          <p className="mt-1 text-sm text-fg-2">Widest disagreement first. Grey ticks are low-volume or derivative tokens.</p>
        </div>
        <Legend grey="low volume or derivative" />
      </div>
      <div className="mt-4 divide-y divide-line border-y border-line">
        {assets.map(({ symbol, type, r }) => {
          const venues: V[] = r.rows
            .filter((x) => x.price && x.kind !== 'unit')
            .map((x) => ({ name: `${x.issuer} ${x.symbol}`, price: x.price!, volume: x.volume, excluded: x.kind !== 'liquid', priceExcluded: x.kind !== 'liquid' }));
          return (
            <Link key={symbol} href={`/rwa/${symbol}`} className="grid grid-cols-1 gap-3 py-4 transition-colors hover:bg-raised sm:grid-cols-[9rem_1fr_13rem] sm:items-center sm:gap-5 sm:px-2">
              <div>
                <div className="text-base font-medium text-fg">{symbol} <span className="rounded-sm bg-raised px-1.5 text-[11px] text-fg-2">{type}</span></div>
                <div className="num mt-0.5 text-xl text-fg">{(r.dispersionBps / 100).toFixed(2)}%</div>
              </div>
              <Dispersion venues={venues} refPrice={r.ref} h={56} compact />
              <div className="num text-right text-xs text-fg-2 sm:text-left">
                <div className="text-fg">{r.topIssuer} {pct(r.topShare, 0)}</div>
                <div>{r.tokens} tokens &middot; {r.liquid} liquid &middot; {usd(r.mcap)}</div>
                {(r.unitMismatch > 0 || r.untracked > 0) && (
                  <div>{r.unitMismatch > 0 && `${r.unitMismatch} unit mismatch. `}{r.untracked > 0 && `${r.untracked} with no price.`}</div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-fg-2">
        A token counts as liquid with at least $10k of 24h volume. The reference is the market-cap-weighted median of liquid tokens. Tokens priced at
        roughly 1/31.1 (per gram) or a power of ten of the reference are treated as unit differences, not disagreement. The API does not include the
        underlying stock&apos;s own price, so this compares tokens with each other, not with the stock.
      </p>
    </main>
  );
}
