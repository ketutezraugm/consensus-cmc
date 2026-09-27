import Link from 'next/link';
import { scoreHistory, anomalyRows, liquidations, observations, captures, toVenue } from '@/lib/data';
import { findings, latestPerSymbol } from '@/lib/history';
import { score } from '@/lib/consensus';
import { NAMES } from '@/lib/assets';
import { Dispersion, Bench, Legend, band } from '@/components/Charts';
import { pct, stamp, usd } from '@/lib/fmt';
import { Ago } from '@/components/Ago';

// Rendered once per capture: fetches below are tagged 'data' and the recorder revalidates that tag after each capture.
export const revalidate = 1800;

export default async function Home() {
  const caps = await captures();
  if (!caps.length) return <main className="mx-auto max-w-6xl px-5 py-10 text-fg-2">No captures recorded yet.</main>;
  const at = caps[0];
  const [all, anoms, obs, liq] = await Promise.all([scoreHistory(), anomalyRows(), observations(at), liquidations(at)]);
  const total = new Set(all.map((s) => s.captured_at)).size;
  const latest = latestPerSymbol(all);
  const totalLiq = liq.find((l) => l.symbol === 'TOTAL');
  const cards = findings(latest, all, anoms, total);

  const rows = Object.values(Object.groupBy(obs, (o) => o.symbol))
    .map((rs) => {
      const venues = rs!.map(toVenue);
      return { symbol: rs![0].symbol, venues, r: score(venues, Date.parse(at))! };
    })
    .filter((x) => x.r)
    .sort((a, b) => a.r.confidence - b.r.confidence);

  const pubRows = latest.filter((s) => s.published_gap_bps !== null && s.published_gap_bps !== undefined && Number.isFinite(s.published_gap_bps));
  const widestPub = pubRows.length ? pubRows.reduce((m, s) => (Math.abs(s.published_gap_bps!) > Math.abs(m.published_gap_bps!) ? s : m)) : null;
  const exchangeCount = new Set(obs.map((o) => o.venue_name)).size;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:py-14">
      <p className="num text-xs text-fg-2">Updated every 30 minutes &middot; {total} readings since {stamp(all[0].captured_at)}</p>
      <h1 className="mt-4 max-w-4xl font-serif text-[clamp(2.25rem,6cqw,4.25rem)] leading-[0.98] tracking-tight text-fg">
        One price. {exchangeCount} exchanges.<br />
        <em className="font-serif italic text-fg-2">This is how far apart they are.</em>
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-fg-2">
        CoinMarketCap publishes one price per asset. Consensus records every exchange&apos;s quote behind it, rebuilds the price independently, and
        shows who sets it, who disagrees, and for how long.
      </p>
      <p className="num mt-3 text-sm text-fg-2">
        latest <Ago iso={at} />{totalLiq ? ` · ${usd(totalLiq.long_24h + totalLiq.short_24h)} liquidated market-wide in 24h` : ''}
      </p>

      {widestPub && (
        <section className="mt-12 border-t border-fg pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-2xl">Checked against CoinMarketCap&apos;s own published price</h2>
            <span className="num text-xs text-label">basis points</span>
          </div>
          <p className="mt-1.5 max-w-2xl text-sm text-fg-2">
            Median gap between the price we rebuild from raw exchange data and CoinMarketCap&apos;s own published price, across {pubRows.length} assets.
            Widest: {widestPub.symbol} at {Math.round(Math.abs(widestPub.published_gap_bps!))}. We rebuild the price without ever seeing CoinMarketCap&apos;s number.
          </p>
          <div className="mt-4 border border-line bg-panel p-4">
            <Bench items={pubRows.map((s) => ({ symbol: s.symbol, gapBps: s.published_gap_bps! }))} />
          </div>
        </section>
      )}

      <div className="mt-10 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((f) => (
          <Link key={f.k} href={f.href} className="bg-panel p-5 transition-colors hover:bg-raised">
            <div className="num text-3xl text-fg">{f.v}</div>
            <div className="mt-1.5 text-sm leading-snug text-fg">{f.k}</div>
            <div className="mt-1.5 text-xs text-fg-2">{f.note}</div>
          </Link>
        ))}
      </div>

      <div className="mt-14 flex flex-wrap items-end justify-between gap-3 border-t border-fg pt-4">
        <div>
          <h2 className="font-serif text-2xl">Fifteen assets, least reliable first</h2>
          <p className="mt-1 text-sm text-fg-2">Height = share of trading &middot; shaded = within 0.2% &middot; grey = CoinMarketCap doesn&apos;t count it</p>
        </div>
        <Legend />
      </div>

      <div className="mt-4 divide-y divide-line border-y border-line">
        {rows.map(({ symbol, venues, r }) => {
          const b = band(r.confidence);
          const pub = latest.find((s) => s.symbol === symbol)?.published_gap_bps ?? null;
          return (
            <Link key={symbol} href={`/${symbol}`} className="grid grid-cols-1 gap-3 py-4 transition-colors hover:bg-raised sm:grid-cols-[9rem_1fr_11rem] sm:items-center sm:gap-5 sm:px-2">
              <div>
                <div className="text-base font-medium text-fg">{symbol} <span className="text-sm font-normal text-fg-2">{NAMES[symbol] ?? ''}</span></div>
                <div className="num mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-xl text-fg">{r.confidence}</span>
                  <span className="text-xs" style={{ color: b.c }}>{b.word}</span>
                </div>
              </div>
              <Dispersion venues={venues} refPrice={r.ref} h={56} compact />
              <div className="num text-right text-xs text-fg-2 sm:text-left">
                <div className="text-fg">{r.top.name} <span className="text-fg-2">{pct(r.top.share, 0)}</span></div>
                {pub !== null && <div className={Math.abs(pub) > 25 ? 'text-bad' : ''}>{pub < 0 ? '−' : '+'}{Math.round(Math.abs(pub))} bp vs published</div>}
              </div>
            </Link>
          );
        })}
      </div>

      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-fg-2">
        Confidence blends how spread out volume is across exchanges (40%), how much volume quotes within 50 bps of the median (30%), how fresh the
        quotes are (15%) and how much volume CoinMarketCap itself discards (15%). The weights are a judgement call, not a fitted model &mdash; see
        <Link href="/methodology" className="mx-1 underline decoration-accent underline-offset-2 hover:text-fg">how this works</Link>
        for what&apos;s been checked against real data. The bar under each strip on an asset page is share of 24h volume by exchange.
      </p>
    </main>
  );
}
