import Link from 'next/link';
import { notFound } from 'next/navigation';
import { captures, observations, liquidations, toVenue } from '@/lib/data';
import { score } from '@/lib/consensus';
import { usd, pct, bps, ago } from '@/lib/fmt';

export const revalidate = 60;

const card = 'rounded-lg border border-zinc-200 p-4 dark:border-zinc-800';
const hatch = 'bg-zinc-400/50 [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,.25)_4px,rgba(0,0,0,.25)_6px)]';

export default async function Asset({ params }: { params: Promise<{ symbol: string }> }) {
  const symbol = (await params).symbol.toUpperCase();
  const caps = await captures();
  if (!caps.length) notFound();
  const at = caps[0];
  const [obs, liq] = await Promise.all([observations(at, symbol), liquidations(at)]);
  if (!obs.length) notFound();

  const venues = obs.map(toVenue);
  const r = score(venues, Date.parse(at))!;
  const total = venues.reduce((s, v) => s + v.volume, 0);
  const trusted = venues.filter((v) => !v.priceExcluded).map((v) => v.price).sort((a, b) => a - b);
  const ref = trusted[trusted.length >> 1] ?? r.vwap;
  const top = [...venues].sort((a, b) => b.volume - a.volume).slice(0, 12);
  const off = venues.filter((v) => !v.priceExcluded && Math.abs(v.price / ref - 1) > 0.01).sort((a, b) => b.volume - a.volume);
  const l = liq.find((x) => x.symbol === symbol);
  const dupBadge = <span className="ml-1 rounded bg-red-500/15 px-1 text-xs text-red-500">dup</span>;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">← all assets</Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{symbol} <span className="text-zinc-500">perpetuals</span></h1>
      <p className="mt-1 text-sm text-zinc-500">
        Capture {ago(at)} · {r.venues} venue listings · reference price ${ref.toLocaleString('en-US', { maximumFractionDigits: 4 })} (median of venues CMC trusts)
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ['Confidence', String(r.confidence)],
          ['Effective venues', r.effectiveVenues.toFixed(1)],
          ['Volume in agreement', pct(r.agreeingShare, 0)],
          ['Volume CMC excludes', pct(r.excludedShare, 0)],
        ].map(([k, v]) => (
          <div key={k} className={card}>
            <div className="text-xs text-zinc-500">{k}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-semibold">Who sets the price</h2>
      <p className="text-sm text-zinc-500">Largest venues by 24h volume. Hatched = CMC excludes it from its own aggregation.</p>
      <div className="mt-3 space-y-1.5">
        {top.map((v) => (
          <div key={String(v.id)} className="grid grid-cols-[9rem_1fr_11rem] items-center gap-3 text-sm">
            <div className="truncate">{v.name}{v.dup && dupBadge}</div>
            <div className="h-4 rounded bg-zinc-100 dark:bg-zinc-900">
              <div className={`h-4 rounded ${v.excluded ? hatch : 'bg-sky-500'}`} style={{ width: `${Math.max(1, (v.volume / total) * 100)}%` }} />
            </div>
            <div className="text-right tabular-nums text-zinc-500">{pct(v.volume / total)} · {bps((v.price / ref - 1) * 1e4)}</div>
          </div>
        ))}
      </div>

      {off.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-semibold">Quoting more than 1% off, not excluded by CMC</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr><th className="py-1">Venue</th><th>Pair</th><th className="text-right">24h volume</th><th className="text-right">vs reference</th></tr>
            </thead>
            <tbody>
              {off.map((v) => (
                <tr key={String(v.id)} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="py-1">{v.name}{v.dup && dupBadge}</td>
                  <td>{v.pair}</td>
                  <td className="text-right tabular-nums">{usd(v.volume)}</td>
                  <td className="text-right tabular-nums text-red-500">{bps((v.price / ref - 1) * 1e4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2 className="mt-10 text-lg font-semibold">Forward market</h2>
      <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div className={card}>
          <div className="text-xs text-zinc-500">Funding per interval (OI-weighted)</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{r.funding === null ? 'n/a' : bps(r.funding * 1e4)}</div>
        </div>
        <div className={card}>
          <div className="text-xs text-zinc-500">Basis vs index (OI-weighted)</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{r.basis === null ? 'n/a' : bps(r.basis * 1e4)}</div>
        </div>
        {l && (
          <div className={card}>
            <div className="text-xs text-zinc-500">Liquidated 24h (long / short)</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{usd(l.long_24h)} / {usd(l.short_24h)}</div>
          </div>
        )}
      </div>
    </main>
  );
}
