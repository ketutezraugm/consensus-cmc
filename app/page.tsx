import Link from 'next/link';
import { scoreHistory, anomalyRows, liquidations, observations, captures, toVenue } from '@/lib/data';
import { findings, latestPerSymbol } from '@/lib/history';
import { score } from '@/lib/consensus';
import { NAMES } from '@/lib/assets';
import { Dispersion, Bench, band } from '@/components/Charts';
import { pct, stamp, usd } from '@/lib/fmt';
import { Ago } from '@/components/Ago';

// Rendered once per capture: fetches below are tagged 'data' and the recorder revalidates that tag after each capture.
export const revalidate = 1800;

// The findings list is ordered by how defensible the claim is (lib/history.ts), not by severity, so
// colour is picked by what the finding is about rather than by position in the list.
const findingColor = (k: string) =>
  /held by one|quotes off-market|does not exclude/.test(k) ? 'text-bad' : /returned twice/.test(k) ? 'text-warn-ink' : 'text-fg';

export default async function Home() {
  const caps = await captures();
  if (!caps.length) return <main className="mx-auto max-w-6xl px-5 py-10 text-fg-2">No captures recorded yet.</main>;
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

  const pubRows = latest.filter((s) => s.published_gap_bps !== null && s.published_gap_bps !== undefined && Number.isFinite(s.published_gap_bps));
  const widestPub = pubRows.length ? pubRows.reduce((m, s) => (Math.abs(s.published_gap_bps!) > Math.abs(m.published_gap_bps!) ? s : m)) : null;
  const exchangeCount = new Set(obs.map((o) => o.venue_name)).size;

  // Findings are ordered [gap-to-published (if any), then the rest]; the first is promoted into its
  // own "today's finding" hero below, so the ruled list underneath shows only what's left.
  const allFindings = findings(latest, all, anoms, total);
  const heroFinding = widestPub ? allFindings[0] : null;
  const restFindings = widestPub ? allFindings.slice(1) : allFindings;

  const hero = rows[0];
  const heroTop = [...hero.venues].sort((a, b) => b.volume - a.volume)[0];
  const heroDev = (heroTop.price / hero.r.ref - 1) * 100;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:py-14">
      <p className="num text-xs text-fg-2">Updated every 30 minutes &middot; {total} readings since {stamp(all[0].captured_at)}</p>
      <h1 className="mt-4 max-w-4xl text-balance font-serif text-[clamp(2.25rem,6cqw,4.25rem)] leading-[0.98] tracking-tight text-fg">
        One price. {exchangeCount} exchanges. <em className="font-serif italic text-fg-2">This is how far apart they are.</em>
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-fg-2">
        CoinMarketCap publishes one price per asset. Consensus records every exchange&apos;s quote behind it, rebuilds the price independently, and
        shows who sets it, who disagrees, and for how long.
      </p>

      <section className="mt-8 rounded border border-line bg-panel p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-serif text-2xl text-fg sm:text-3xl">{NAMES[hero.symbol] ?? hero.symbol}</span>
            <span className="num text-sm text-fg-2">${hero.r.ref.toLocaleString('en-US', { maximumFractionDigits: 4 })} agreed price</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-2">
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-[2px] bg-good" />within 0.5%</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-[2px] bg-warn" />drifting</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-[2px] bg-bad" />off-market</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-[2px] bg-discard" />CoinMarketCap doesn&apos;t count</span>
          </div>
        </div>
        <div className="mt-3"><Dispersion venues={hero.venues} refPrice={hero.r.ref} h={260} /></div>
        <p className="mt-3 max-w-3xl border-t border-line pt-3.5 text-sm leading-relaxed text-fg-2">
          Each stroke is one exchange; its height is its share of trading.{' '}
          <span className="text-fg">
            {heroTop.name} quotes {NAMES[hero.symbol] ?? hero.symbol} {Math.abs(heroDev).toFixed(1)}% {heroDev < 0 ? 'below' : 'above'} the market on
            {' '}{usd(heroTop.volume)} of daily volume{heroTop.excluded ? ', and CoinMarketCap already excludes it.' : ', and CoinMarketCap still counts it.'}
          </span>
        </p>
      </section>

      {heroFinding && widestPub && (
        <section className="mt-14 grid gap-8 border-t border-fg pt-6 sm:grid-cols-[1fr_1.1fr] sm:items-end">
          <div>
            <div className="num text-xs text-accent-ink">Today&apos;s finding</div>
            <div className="mt-1 flex items-baseline gap-3.5">
              <span className="font-serif text-[clamp(4.5rem,10cqw,7.5rem)] leading-[0.85] tracking-tight text-fg">{heroFinding.v.replace(/\s*bps?$/i, '')}</span>
              <span className="font-serif text-3xl text-fg-2">basis points</span>
            </div>
            <p className="mt-2 max-w-md text-lg leading-snug text-fg">{heroFinding.k}. {heroFinding.note}.</p>
            <p className="mt-2 text-xs text-fg-2">1 basis point = 0.01%. We rebuild the price without seeing CoinMarketCap&apos;s number.</p>
          </div>
          <div>
            <Bench items={pubRows.map((s) => ({ symbol: s.symbol, gapBps: s.published_gap_bps! }))} />
            <div className="mt-1 text-xs text-fg-2">Each dot is one asset. Shaded: within 25 bp of the published price.</div>
          </div>
        </section>
      )}

      <div className="mt-10 flex flex-col border-t border-fg sm:grid sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-4">
        {restFindings.map((f) => (
          <Link key={f.k} href={f.href} className="border-b border-line py-4 transition-opacity hover:opacity-70 sm:pr-5">
            <div className={`num text-[22px] ${findingColor(f.k)}`}>{f.v}</div>
            <div className="mt-1.5 text-sm leading-snug text-fg-2">{f.k}</div>
          </Link>
        ))}
      </div>

      <div className="mt-14 flex flex-wrap items-end justify-between gap-3 border-t border-fg pt-4">
        <h2 className="font-serif text-2xl sm:text-[2.5rem]">{rows.length} assets, least reliable first</h2>
        <span className="num text-xs text-fg-2">Trust score 0&ndash;100 &middot; 80+ reliable &middot; 60&ndash;79 watch &middot; under 60 unreliable</span>
      </div>

      <div className="mt-4 hidden grid-cols-[170px_150px_minmax(0,1fr)_190px_96px] gap-6 border-b border-line pb-2.5 text-xs text-fg-2 sm:grid">
        <span>Asset</span><span>Trust</span><span>Exchanges by distance from the agreed price</span><span>Largest exchange</span><span className="text-right">vs published</span>
      </div>

      <div className="divide-y divide-line border-b border-line sm:border-t-0">
        {rows.map(({ symbol, venues, r }) => {
          const b = band(r.confidence);
          const pub = latest.find((s) => s.symbol === symbol)?.published_gap_bps ?? null;
          return (
            <Link key={symbol} href={`/${symbol}`} className="grid grid-cols-1 gap-3 py-4 transition-colors hover:bg-raised sm:grid-cols-[170px_150px_minmax(0,1fr)_190px_96px] sm:items-center sm:gap-6">
              <div className="flex items-baseline gap-2.5 truncate">
                <span className="num text-[15px] font-medium text-fg">{symbol}</span>
                <span className="truncate text-[13px] text-fg-2">{NAMES[symbol] ?? ''}</span>
              </div>
              <div className="num flex items-baseline gap-2">
                <span className="text-lg text-fg">{r.confidence}</span>
                <span className="text-xs" style={{ color: b.c }}>{b.word}</span>
              </div>
              <Dispersion venues={venues} refPrice={r.ref} h={40} compact />
              <div className="flex items-baseline gap-2 text-[13px] text-fg-2">
                <span className="truncate">{r.top.name}</span>
                <span className="num" style={{ color: r.top.share >= 0.5 ? 'var(--color-bad)' : 'var(--color-fg)' }}>{pct(r.top.share, 0)}</span>
              </div>
              <div className="num text-right text-[13px]" style={{ color: pub !== null && Math.abs(pub) > 25 ? 'var(--color-bad)' : 'var(--color-fg-2)' }}>
                {pub !== null ? `${pub < 0 ? '−' : '+'}${Math.round(Math.abs(pub))} bp` : ''}
              </div>
            </Link>
          );
        })}
      </div>

      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-fg-2">
        Confidence blends how spread out volume is across exchanges (40%), how much volume quotes within 50 bps of the median (30%), how fresh the
        quotes are (15%) and how much volume CoinMarketCap itself discards (15%). The weights are a judgement call, not a fitted model &mdash; see
        <Link href="/methodology" className="mx-1 underline decoration-accent underline-offset-2 hover:text-fg">how this works</Link>
        for what&apos;s been checked against real data.{totalLiq ? ` ${usd(totalLiq.long_24h + totalLiq.short_24h)} was liquidated market-wide in the 24h to the latest reading, ` : ' '}latest reading <Ago iso={at} />.
      </p>
    </main>
  );
}
