import Link from 'next/link';
import { scoreHistory, anomalyRows, liquidations, captures } from '@/lib/data';
import { findings, latestPerSymbol } from '@/lib/history';
import { Spark } from '@/components/Charts';
import { pct, ago, stamp } from '@/lib/fmt';


const tone = (c: number) => (c >= 85 ? 'text-emerald-500' : c >= 65 ? 'text-amber-500' : 'text-red-500');

export default async function Home() {
  const [all, anoms, caps] = await Promise.all([scoreHistory(), anomalyRows(), captures()]);
  if (!all.length) return <main className="p-8">No captures recorded yet.</main>;
  const total = new Set(all.map((s) => s.captured_at)).size;
  const first = all[0].captured_at, lastAt = caps[0];
  const latest = latestPerSymbol(all).sort((a, b) => a.confidence - b.confidence);
  const liq = (await liquidations(lastAt)).find((l) => l.symbol === 'TOTAL');
  const trend = (sym: string) => all.filter((s) => s.symbol === sym).slice(-24).map((s) => s.confidence);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">How CoinMarketCap&apos;s price is made</h1>
      <p className="mt-3 max-w-2xl text-lg text-zinc-500">
        One price per asset hides hundreds of venues. Consensus records every venue&apos;s quote every 30 minutes and shows who sets the price,
        who disagrees, and for how long.
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        {total} captures since {stamp(first)} · latest {ago(lastAt)}
        {liq ? ` · $${((liq.long_24h + liq.short_24h) / 1e6).toFixed(0)}M liquidated market-wide in 24h` : ''}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {findings(latest, all, anoms, total).map((f) => (
          <Link key={f.k} href={f.href} className="rounded-lg border border-zinc-200 p-4 hover:border-sky-500 dark:border-zinc-800">
            <div className="text-3xl font-semibold tabular-nums">{f.v}</div>
            <div className="mt-1 text-sm">{f.k}</div>
            <div className="mt-1 text-xs text-zinc-500">{f.note}</div>
          </Link>
        ))}
      </div>

      <h2 className="mt-12 text-lg font-semibold">All tracked assets</h2>
      <p className="text-sm text-zinc-500">Least trustworthy first. Trend is the last 24 captures.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="py-2 pr-4">Asset</th><th className="pr-4">Confidence</th><th className="pr-4">Trend</th><th className="pr-4 text-right">Venues</th>
              <th className="pr-4 text-right">Top venue</th><th className="pr-4 text-right">Volume in agreement</th><th className="text-right">Volume CMC excludes</th>
            </tr>
          </thead>
          <tbody>
            {latest.map((s) => (
              <tr key={s.symbol} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-4 font-medium"><Link className="underline-offset-4 hover:underline" href={`/${s.symbol}`}>{s.symbol}</Link></td>
                <td className={`pr-4 font-semibold tabular-nums ${tone(s.confidence)}`}>{s.confidence}</td>
                <td className="pr-4"><Spark values={trend(s.symbol)} label={`${s.symbol} confidence trend`} /></td>
                <td className="pr-4 text-right tabular-nums">{s.venues}</td>
                <td className="pr-4 text-right tabular-nums">{s.top_venue} {pct(s.top_share)}</td>
                <td className="pr-4 text-right tabular-nums">{pct(s.agreeing_share, 0)}</td>
                <td className="text-right tabular-nums">{pct(s.excluded_share, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-8 max-w-2xl text-xs text-zinc-500">
        Confidence blends how spread out volume is across venues (40%), how much volume quotes within 50 bps of the median (30%), how fresh the quotes are
        (15%) and how much volume CMC itself excludes (15%). The weights are a judgement call, not a fitted model. Data: CoinMarketCap derivatives
        market-pairs, liquidations and DEX endpoints.
      </p>
    </main>
  );
}
