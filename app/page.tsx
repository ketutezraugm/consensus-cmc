import Link from 'next/link';
import { captures, observations, liquidations, toVenue } from '@/lib/data';
import { score } from '@/lib/consensus';
import { pct, ago } from '@/lib/fmt';

export const revalidate = 60;

const tone = (c: number) => (c >= 85 ? 'text-emerald-500' : c >= 65 ? 'text-amber-500' : 'text-red-500');

export default async function Home() {
  const caps = await captures();
  if (!caps.length) return <main className="p-8">No captures recorded yet.</main>;
  const at = caps[0];
  const [obs, liq] = await Promise.all([observations(at), liquidations(at)]);
  const total = liq.find((l) => l.symbol === 'TOTAL');
  const rows = Object.entries(Object.groupBy(obs, (o) => o.symbol))
    .map(([symbol, rs]) => ({ symbol, r: score(rs!.map(toVenue), Date.parse(at))! }))
    .sort((a, b) => a.r.confidence - b.r.confidence);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Consensus</h1>
      <p className="mt-2 max-w-2xl text-zinc-500">
        CoinMarketCap publishes one price per asset. This shows how that price is made across perpetual-futures venues, and where the venues disagree.
        Least-trustworthy first.
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        Capture {ago(at)} · {caps.length} captures recorded{total ? ` · $${((total.long_24h + total.short_24h) / 1e6).toFixed(0)}M liquidated market-wide in 24h` : ''}
      </p>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="py-2 pr-4">Asset</th><th className="pr-4">Confidence</th><th className="pr-4 text-right">Venues</th>
              <th className="pr-4 text-right">Top venue</th><th className="pr-4 text-right">Volume in agreement</th><th className="text-right">Volume CMC excludes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ symbol, r }) => (
              <tr key={symbol} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-4 font-medium"><Link className="underline-offset-4 hover:underline" href={`/${symbol}`}>{symbol}</Link></td>
                <td className={`pr-4 font-semibold tabular-nums ${tone(r.confidence)}`}>{r.confidence}</td>
                <td className="pr-4 text-right tabular-nums">{r.venues}</td>
                <td className="pr-4 text-right tabular-nums">{r.top.name} {pct(r.top.share)}</td>
                <td className="pr-4 text-right tabular-nums">{pct(r.agreeingShare, 0)}</td>
                <td className="text-right tabular-nums">{pct(r.excludedShare, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-8 max-w-2xl text-xs text-zinc-500">
        Confidence blends four things: how spread out volume is across venues (40%), how much volume quotes within 50 bps of the median (30%),
        how fresh the quotes are (15%), and how much volume CMC itself excludes (15%). The weights are a judgement call, not a fitted model.
        Data: CoinMarketCap derivatives market-pairs, one capture every 30 minutes.
      </p>
    </main>
  );
}
