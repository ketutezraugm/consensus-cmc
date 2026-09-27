import Link from 'next/link';
import { notFound } from 'next/navigation';
import { captures, observations, poolObservations, liquidations, scoreHistory, anomalyRows, toVenue } from '@/lib/data';
import { score, onchain } from '@/lib/consensus';
import { venueBoard } from '@/lib/history';
import { Dispersion, Concentration, Trend, Legend, severity, ScoreBreakdown, Gauge, Bench, band } from '@/components/Charts';
import { usd, pct, bps, stamp } from '@/lib/fmt';
import { Ago } from '@/components/Ago';
import { WATCHLIST, NAMES } from '@/lib/assets';

// Rendered once per capture: fetches below are tagged 'data' and the recorder revalidates that tag after each capture.
export const revalidate = 1800;

// Prebuild the tracked symbols so they serve from the CDN edge like the listing pages, instead of
// re-executing on every request. A symbol not in the watchlist still renders on demand (dynamicParams).
export const generateStaticParams = async () => Object.values(WATCHLIST).map((symbol) => ({ symbol }));

const card = 'border border-line bg-panel p-4';

export default async function Asset({ params }: { params: Promise<{ symbol: string }> }) {
  const symbol = (await params).symbol.toUpperCase();
  const caps = await captures();
  if (!caps.length) notFound();
  const at = caps[0];
  const [obs, liq, poolObs, hist, anoms] = await Promise.all([
    observations(at, symbol), liquidations(at), poolObservations(at, symbol), scoreHistory(symbol), anomalyRows(symbol),
  ]);
  if (!obs.length) notFound();

  const venues = obs.map(toVenue);
  const r = score(venues, Date.parse(at))!;
  const total = venues.reduce((s, v) => s + v.volume, 0);
  const top = [...venues].sort((a, b) => b.volume - a.volume).slice(0, 10);
  const off = venues.filter((v) => !v.priceExcluded && Math.abs(v.price / r.ref - 1) > 0.01).sort((a, b) => b.volume - a.volume);
  const l = liq.find((x) => x.symbol === symbol);
  const pools = poolObs.map((o) => ({ name: o.venue_name, price: +o.price, liquidity: o.extra.liquidity, volume: +o.volume_24h, updated: o.extra.updated ? Date.parse(o.extra.updated) : 0 }));
  const dex = onchain(pools, r.ref, Date.parse(at));
  const token = poolObs[0]?.extra.token;
  const pts = (f: (s: (typeof hist)[number]) => number) => hist.map((h) => ({ t: Date.parse(h.captured_at), v: f(h) }));
  const board = venueBoard(anoms, hist.length).slice(0, 6);
  const latestHist = hist.at(-1);
  const b = band(r.confidence);
  const dupBadge = <span className="ml-1.5 rounded-sm bg-bad/15 px-1 text-[10px] uppercase tracking-wide text-bad">dup</span>;
  const stat = (k: string, v: string, cls = '') => (
    <div key={k} className={card}><div className="text-xs text-fg-2">{k}</div><div className={`num mt-1 text-2xl ${cls}`}>{v}</div></div>
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <p className="text-sm text-fg-2"><Link href="/" className="hover:text-fg">Assets</Link> / {symbol}</p>
      <h1 className="mt-2 flex flex-wrap items-baseline gap-x-3 font-serif text-5xl tracking-tight text-fg">
        {NAMES[symbol] ?? symbol} <span className="num text-3xl text-fg-2">${r.ref.toLocaleString('en-US', { maximumFractionDigits: 4 })}</span>
      </h1>
      <p className="num mt-1 text-sm text-fg-2">agreed price from {r.venues} exchanges &middot; latest reading &middot; <Ago iso={at} /></p>

      <div className="mt-6 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-3">
        <div className="bg-panel p-5">
          <div className="text-xs text-fg-2">How reliable is this price</div>
          <div className="mt-2"><Gauge score={r.confidence} /></div>
          <div className="num -mt-2 text-center text-4xl text-fg">{r.confidence} <span className="align-middle text-base" style={{ color: b.c }}>{b.word}</span></div>
        </div>
        <div className="bg-panel p-5">
          <div className="text-xs text-fg-2">Verdict</div>
          <p className="mt-2 text-lg leading-snug text-fg">
            {r.confidence >= 80 ? 'Well supported.' : r.confidence >= 60 ? 'Worth a second look.' : 'Thinly supported.'}{' '}
            {r.top.share < 0.5 ? 'Trading is spread widely and almost every exchange quotes the same price.' : `Trading leans heavily on ${r.top.name}, which alone holds ${pct(r.top.share, 0)}.`}
          </p>
          {r.excludedShare > 0.02 && <p className="mt-2 text-sm text-fg-2">It isn&apos;t higher because CoinMarketCap discards {pct(r.excludedShare, 0)} of {symbol}&apos;s volume, {r.excludedShare > 0.2 ? 'the most of any asset we track' : 'more than most assets we track'}.</p>}
        </div>
        <div className="bg-panel p-5">
          <div className="text-xs text-fg-2">Checked against CoinMarketCap</div>
          {latestHist?.published_gap_bps !== null && latestHist?.published_gap_bps !== undefined ? (
            <>
              <p className="mt-2 text-sm text-fg-2">
                We rebuild the price from raw exchange data without seeing CoinMarketCap&apos;s number. It lands {bps(latestHist.published_gap_bps).replace('+', '')} ({(Math.abs(latestHist.published_gap_bps) / 100).toFixed(2)}%)
                {' '}{latestHist.published_gap_bps < 0 ? 'below' : 'above'} theirs. {Math.abs(latestHist.published_gap_bps) <= 25 ? 'Within tolerance.' : 'Outside our 25 bp tolerance.'}
              </p>
              <div className="mt-2"><Bench items={[{ symbol, gapBps: latestHist.published_gap_bps }]} /></div>
            </>
          ) : <p className="mt-2 text-sm text-fg-2">No published-price reading yet for this capture.</p>}
        </div>
      </div>

      <div className={`mt-3 ${card}`}>
        <div className="text-xs text-fg-2">
          How the {r.confidence} was built &mdash; a two-asset ranking can favour one with lighter concentration risk (spread) but heavier junk-exchange
          exclusion (cleanliness), or vice versa. See <Link className="underline decoration-accent underline-offset-2" href="/methodology">how this works</Link>.
        </div>
        <div className="mt-3"><ScoreBreakdown parts={r.parts} /></div>
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-fg pt-4">
          <h2 className="font-serif text-2xl">Where every exchange sits</h2>
          <Legend />
        </div>
        <div className="mt-3 border border-line bg-panel p-4">
          <Dispersion venues={venues} refPrice={r.ref} h={220} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="border-t border-fg pt-4 font-serif text-2xl">Who sets the price</h2>
        <p className="mt-1 text-sm text-fg-2">Share of 24h volume. Exchanges CoinMarketCap doesn&apos;t count are marked.</p>
        <div className="mt-3 overflow-hidden"><Concentration venues={venues} h={14} /></div>
        <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-fg-2">
            <tr className="border-b border-line"><th className="pb-2 font-normal">Exchange</th><th className="pb-2 text-right font-normal">Share</th><th className="pb-2 text-right font-normal">24h volume</th><th className="pb-2 text-right font-normal">vs agreed price</th></tr>
          </thead>
          <tbody>
            {top.map((v) => {
              const d = (v.price / r.ref - 1) * 1e4;
              return (
                <tr key={String(v.id)} className="border-b border-line/60">
                  <td className="py-1.5">{v.name}{v.dup && dupBadge}{v.excluded && <span className="ml-1.5 text-xs text-fg-2">not counted</span>}</td>
                  <td className="num py-1.5 text-right">{pct(v.volume / total)}</td>
                  <td className="num py-1.5 text-right text-fg-2">{usd(v.volume)}</td>
                  <td className="num py-1.5 text-right" style={{ color: severity(d, v.excluded) }}>{bps(d)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </section>

      {off.length > 0 && (
        <section className="mt-10">
          <h2 className="border-t border-fg pt-4 font-serif text-2xl">Over 1% off, and still counted</h2>
          <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-fg-2">
              <tr className="border-b border-line"><th className="pb-2 font-normal">Exchange</th><th className="pb-2 font-normal">Pair</th><th className="pb-2 text-right font-normal">24h volume</th><th className="pb-2 text-right font-normal">vs agreed price</th></tr>
            </thead>
            <tbody>
              {off.map((v) => (
                <tr key={String(v.id)} className="border-b border-line/60">
                  <td className="py-1.5">{v.name}{v.dup && dupBadge}</td>
                  <td className="num py-1.5 text-fg-2">{v.pair}</td>
                  <td className="num py-1.5 text-right text-fg-2">{usd(v.volume)}</td>
                  <td className="num py-1.5 text-right text-bad">{bps((v.price / r.ref - 1) * 1e4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="border-t border-fg pt-4 font-serif text-2xl">Over time</h2>
        <p className="mt-1 text-sm text-fg-2">{hist.length} readings since {hist.length ? stamp(hist[0].captured_at) : 'n/a'}.</p>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div className={card}>
            <div className="text-sm font-medium text-fg">Confidence</div>
            <Trend points={pts((h) => h.confidence)} domain={[0, 100]} fmt={(v) => String(Math.round(v))} label={`${symbol} confidence over time`} />
          </div>
          <div className={card}>
            <div className="text-sm font-medium text-fg">Share of volume on the biggest exchange</div>
            <Trend points={pts((h) => h.top_share)} domain={[0, 1]} fmt={(v) => pct(v, 0)} label={`${symbol} top exchange share over time`} color="var(--color-warn)" />
          </div>
          {hist.some((h) => h.published_gap_bps !== null) && (
            <div className={card}>
              <div className="text-sm font-medium text-fg">Gap to CoinMarketCap&apos;s published price</div>
              <Trend points={hist.filter((h) => h.published_gap_bps !== null).map((h) => ({ t: Date.parse(h.captured_at), v: h.published_gap_bps! }))}
                     fmt={(v) => bps(v)} label={`${symbol} gap to published price over time`} color="var(--color-accent)" />
            </div>
          )}
        </div>
      </section>

      {board.length > 0 && (
        <section className="mt-10">
          <h2 className="border-t border-fg pt-4 font-serif text-2xl">Off-market exchanges, across readings</h2>
          <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-fg-2">
              <tr className="border-b border-line"><th className="pb-2 font-normal">Exchange</th><th className="pb-2 text-right font-normal">Seen in</th><th className="pb-2 text-right font-normal">Typical gap</th><th className="pb-2 text-right font-normal">Peak volume</th></tr>
            </thead>
            <tbody>
              {board.map((v) => (
                <tr key={v.key} className="border-b border-line/60">
                  <td className="py-1.5">{v.key}</td>
                  <td className="num py-1.5 text-right text-fg-2">{v.captures} of {hist.length}</td>
                  <td className="num py-1.5 text-right text-bad">{bps(v.medianBps)}</td>
                  <td className="num py-1.5 text-right text-fg-2">{usd(v.maxVolume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="border-t border-fg pt-4 font-serif text-2xl">Forward market</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stat('Funding per interval (OI-weighted)', r.funding === null ? 'n/a' : bps(r.funding * 1e4))}
          {stat('Basis vs index (OI-weighted)', r.basis === null ? 'n/a' : bps(r.basis * 1e4))}
          {l ? stat('Liquidated 24h (long / short)', `${usd(l.long_24h)} / ${usd(l.short_24h)}`) : null}
        </div>
      </section>

      {dex && (
        <section className="mt-10">
          <h2 className="border-t border-fg pt-4 font-serif text-2xl">On-chain vs exchanges</h2>
          <p className="mt-1 max-w-3xl text-sm text-fg-2">
            Uniswap v3 pools on Ethereum, liquidity-weighted, against the agreed price above. The on-chain asset is {token}
            {token !== symbol && ', a different token from the one exchanges track, so part of any gap can be wrapper risk'}. Pools only update when someone trades.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stat('DEX vs exchanges', bps(dex.gapBps))}
            {stat('Pools disagree by', `${Math.round(dex.spreadBps)} bps`)}
            {stat('Pool liquidity', usd(dex.liquidity))}
            {stat('Not traded in 30 min', pct(dex.staleShare, 0))}
          </div>
        </section>
      )}
    </main>
  );
}
