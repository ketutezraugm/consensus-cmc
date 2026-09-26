import Link from 'next/link';
import { scoreHistory, anomalyRows, liquidations, observations, captures, toVenue } from '@/lib/data';
import { findings, latestPerSymbol } from '@/lib/history';
import { score } from '@/lib/consensus';
import { Dispersion, Concentration, Legend } from '@/components/Charts';
import { pct, ago, stamp, usd } from '@/lib/fmt';

const tone = (c: number) => (c >= 85 ? 'text-good' : c >= 65 ? 'text-warn' : 'text-bad');

export default async function Home() {
  const caps = await captures();
  if (!caps.length) return <main className="p-8">No captures recorded yet.</main>;
  const at = caps[0];
  const [all, anoms, obs, liq] = await Promise.all([scoreHistory(), anomalyRows(), observations(at), liquidations(at)]);
  const total = new Set(all.map((s) => s.captured_at)).size;
  const latest = latestPerSymbol(all);
  const totalLiq = liq.find((l) => l.symbol === 'TOTAL');

  const rows = Object.values(Object.groupBy(obs, (o) => o.symbol))
    .map((rs) => {
      const venues = rs!.map(toVenue);
      return { symbol: rs![0].symbol, venues, r: score(venues, Date.parse(at))! };
    })
    .filter((x) => x.r)
    .sort((a, b) => a.r.confidence - b.r.confidence);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <h1 className="max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl">How CoinMarketCap&apos;s price is made</h1>
      <p className="mt-3 max-w-3xl text-base text-muted">
        One number per asset hides hundreds of venues that do not agree. Consensus records every venue&apos;s perpetual-futures quote every
        30 minutes and shows who sets the price, who disagrees, and for how long.
      </p>
      <p className="num mt-3 text-sm text-muted">
        {total} captures since {stamp(all[0].captured_at)} · latest {ago(at)}
        {totalLiq ? ` · ${usd(totalLiq.long_24h + totalLiq.short_24h)} liquidated market-wide in 24h` : ''}
      </p>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {findings(latest, all, anoms, total).map((f, i) => (
          <Link key={f.k} href={f.href}
                className="rounded-lg border border-line bg-panel p-4 transition-colors hover:border-accent"
                style={{ borderLeft: `3px solid ${['var(--color-bad)', 'var(--color-warn)', 'var(--color-accent)', 'var(--color-muted)'][i] ?? 'var(--color-line)'}` }}>
            <div className="num text-3xl font-semibold">{f.v}</div>
            <div className="mt-1.5 text-sm leading-snug">{f.k}</div>
            <div className="mt-1.5 text-xs text-muted">{f.note}</div>
          </Link>
        ))}
      </div>

      <div className="mt-14 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Where every venue prices each asset</h2>
          <p className="mt-1 text-sm text-muted">
            One tick per venue, placed by distance from the price the trusted venues agree on. Least trustworthy asset first.
          </p>
        </div>
        <Legend />
      </div>

      <div className="mt-5 space-y-2.5">
        {rows.map(({ symbol, venues, r }) => (
          <Link key={symbol} href={`/${symbol}`}
                className="block rounded-lg border border-line bg-panel p-4 transition-colors hover:border-accent">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="w-14 text-base font-semibold">{symbol}</span>
              <span className={`num text-base font-semibold ${tone(r.confidence)}`}>{r.confidence}</span>
              <span className="text-xs text-muted">confidence</span>
              <span className="num ml-auto text-xs text-muted">
                {r.venues} venues · top {r.top.name} {pct(r.top.share, 0)} · {pct(r.excludedShare, 0)} excluded by CMC
              </span>
            </div>
            <div className="mt-2.5"><Dispersion venues={venues} refPrice={r.ref} h={74} /></div>
            <div className="mt-2 flex items-center gap-3">
              <span className="w-28 shrink-0 text-[11px] text-muted">volume by venue</span>
              <span className="flex-1 overflow-hidden rounded-sm"><Concentration venues={venues} h={7} /></span>
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-10 max-w-3xl text-xs leading-relaxed text-muted">
        Confidence blends how spread out volume is across venues (40%), how much volume quotes within 50 bps of the median (30%), how fresh the
        quotes are (15%) and how much volume CMC itself excludes (15%). The weights are a judgement call, not a fitted model. The thin bar under
        each strip is share of 24h volume by venue.
      </p>
    </main>
  );
}
