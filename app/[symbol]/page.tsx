import Link from 'next/link';
import { notFound } from 'next/navigation';
import { captures, observations, poolObservations, liquidations, scoreHistory, anomalyRows, toVenue } from '@/lib/data';
import { score, onchain } from '@/lib/consensus';
import { venueBoard } from '@/lib/history';
import { Dispersion, ConcGrid, History, Legend, severity, ScoreBreakdown, Gauge, Bench, band } from '@/components/Charts';
import { usd, pct, bps } from '@/lib/fmt';
import { Ago } from '@/components/Ago';
import { WATCHLIST, NAMES } from '@/lib/assets';

// Rendered once per capture: fetches below are tagged 'data' and the recorder revalidates that tag after each capture.
export const revalidate = 1800;

// Prebuild the tracked symbols so they serve from the CDN edge like the listing pages, instead of
// re-executing on every request. A symbol not in the watchlist still renders on demand (dynamicParams).
export const generateStaticParams = async () => Object.values(WATCHLIST).map((symbol) => ({ symbol }));

const card = 'rounded border border-line bg-panel p-4';
const summary = 'cursor-pointer border-t border-line py-4 font-medium text-fg marker:text-fg-2 [&::-webkit-details-marker]:text-fg-2';

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
  const board = venueBoard(anoms, hist.length).slice(0, 8);
  const latestHist = hist.at(-1);
  const b = band(r.confidence);
  const dupBadge = <span className="ml-1.5 rounded-sm bg-bad/15 px-1 text-[10px] uppercase tracking-wide text-bad">dup</span>;
  const stat = (k: string, v: string, cls = '') => (
    <div key={k} className={card}><div className="text-xs text-fg-2">{k}</div><div className={`num mt-1 text-2xl ${cls}`}>{v}</div></div>
  );

  const confHist = hist.map((h) => ({ t: Date.parse(h.captured_at), v: h.confidence }));
  const confVals = confHist.map((h) => h.v);
  const confLo = confVals.length ? Math.min(...confVals) : r.confidence, confHi = confVals.length ? Math.max(...confVals) : r.confidence;
  const stillLargest = hist.length > 1 && hist[0].top_venue === latestHist?.top_venue;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <p className="text-sm text-fg-2"><Link href="/" className="hover:text-fg">Assets</Link> / {symbol}</p>
      <h1 className="mt-2 flex flex-wrap items-baseline gap-x-3 font-serif text-[clamp(2.75rem,6cqw,4.75rem)] leading-[0.95] tracking-tight text-fg">
        {NAMES[symbol] ?? symbol} <span className="num text-2xl text-fg">${r.ref.toLocaleString('en-US', { maximumFractionDigits: 4 })}</span>
      </h1>
      <p className="num mt-1 text-sm text-fg-2">agreed price from {r.venues} exchanges &middot; latest reading &middot; <Ago iso={at} /></p>

      <div className="mt-6 grid gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-3">
        <div className="flex flex-col items-center gap-1 bg-panel p-5">
          <div className="self-start text-xs text-fg-2">How reliable is this price</div>
          <div className="w-full max-w-[260px]"><Gauge score={r.confidence} /></div>
          <div className="-mt-1 flex items-baseline gap-2.5">
            <span className="font-serif text-5xl text-fg">{r.confidence}</span>
            <span className="text-sm font-medium" style={{ color: b.c }}>{b.word}</span>
          </div>
        </div>
        <div className="flex flex-col justify-center gap-2.5 bg-panel p-5">
          <div className="text-xs text-fg-2">Verdict</div>
          <p className="font-serif text-[clamp(1.35rem,2.3cqw,1.7rem)] leading-tight text-fg text-balance">
            {r.confidence >= 80 ? 'Well supported.' : r.confidence >= 60 ? 'Worth a second look.' : 'Thinly supported.'}{' '}
            {r.top.share < 0.5 ? 'Trading is spread widely and almost every exchange quotes the same price.' : `Trading leans heavily on ${r.top.name}, which alone holds ${pct(r.top.share, 0)}.`}
          </p>
          {r.excludedShare > 0.02 && <p className="text-sm text-fg-2">It isn&apos;t higher because CoinMarketCap discards {pct(r.excludedShare, 0)} of {symbol}&apos;s volume, {r.excludedShare > 0.2 ? 'the most of any asset we track' : 'more than most assets we track'}.</p>}
        </div>
        <div className="flex flex-col gap-2.5 bg-panel p-5">
          <div className="text-xs text-fg-2">Checked against CoinMarketCap</div>
          {latestHist?.published_gap_bps !== null && latestHist?.published_gap_bps !== undefined ? (
            <>
              <p className="text-sm text-fg">
                We rebuilt the price from raw exchange data without seeing CoinMarketCap&apos;s number. It lands <b className="font-semibold">{bps(latestHist.published_gap_bps).replace('+', '')}</b> ({(Math.abs(latestHist.published_gap_bps) / 100).toFixed(2)}%)
                {' '}{latestHist.published_gap_bps < 0 ? 'below' : 'above'} theirs. <span style={{ color: Math.abs(latestHist.published_gap_bps) <= 25 ? 'var(--color-good)' : 'var(--color-bad)' }}>{Math.abs(latestHist.published_gap_bps) <= 25 ? 'Within tolerance.' : 'Outside tolerance.'}</span>
              </p>
              <Bench items={[{ symbol, gapBps: latestHist.published_gap_bps }]} />
            </>
          ) : <p className="text-sm text-fg-2">No published-price reading yet for this capture.</p>}
        </div>
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-fg pt-4">
          <h2 className="font-serif text-[clamp(1.75rem,3.4cqw,2.5rem)]">Where every exchange sits</h2>
          <Legend />
        </div>
        <div className="mt-3 rounded border border-line bg-panel p-4">
          <Dispersion venues={venues} refPrice={r.ref} h={280} />
        </div>
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-2 lg:items-start">
        <div>
          <h2 className="border-t border-fg pt-4 font-serif text-[clamp(1.75rem,3.4cqw,2.5rem)]">Who sets the price</h2>
          <div className="mt-4 flex items-center gap-6">
            <ConcGrid share={r.top.share} />
            <div className="flex flex-col gap-1.5">
              <span className="font-serif text-5xl text-fg">{pct(r.top.share, 0)}</span>
              <span className="text-sm text-fg">of trading is on {r.top.name}, the largest exchange.</span>
              <span className="text-sm text-fg-2">
                {r.top.share >= 0.5 ? `One exchange can move this price alone.` : `No single exchange can move this price alone.`}
                {r.venues > 1 ? ` The rest is spread across ${r.venues - 1} others.` : ''}
              </span>
            </div>
          </div>
        </div>
        <div>
          <h2 className="border-t border-fg pt-4 font-serif text-[clamp(1.75rem,3.4cqw,2.5rem)]">Off the market, still counted</h2>
          {off.length > 0 ? (
            <div className="mt-3.5 flex flex-col border-t border-fg">
              {off.slice(0, 2).map((v) => {
                const d = (v.price / r.ref - 1) * 1e4;
                const seen = board.find((x) => x.key === v.name);
                return (
                  <div key={String(v.id)} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-line py-3.5">
                    <span className="font-semibold text-fg">{v.name}</span>
                    <span className="num text-right font-medium text-bad">{bps(d)}</span>
                    <span className="text-[13px] text-fg-2">{v.pair} &middot; {usd(v.volume)} traded in 24h.{v.dup ? ' Returned twice by the API with different prices.' : ''}</span>
                    <span className="num text-right text-xs text-fg-2 whitespace-nowrap">{seen ? `${seen.captures} of ${hist.length} readings` : 'latest reading'}</span>
                  </div>
                );
              })}
            </div>
          ) : <p className="mt-3.5 text-sm text-fg-2">Nothing is more than 1% off the market in this reading.</p>}
          {(top.length > 0 || off.length > 2) && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-fg underline decoration-accent underline-offset-2">Show all {r.venues} exchanges</summary>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-fg-2">
                    <tr className="border-b border-line"><th className="pb-2 font-normal">Exchange</th><th className="pb-2 pl-4 text-right font-normal">Share</th><th className="pb-2 pl-4 text-right font-normal">24h volume</th><th className="pb-2 pl-4 text-right font-normal">vs agreed price</th></tr>
                  </thead>
                  <tbody>
                    {top.map((v) => {
                      const d = (v.price / r.ref - 1) * 1e4;
                      return (
                        <tr key={String(v.id)} className="border-b border-line/60">
                          <td className="py-1.5">{v.name}{v.dup && dupBadge}{v.excluded && <span className="ml-1.5 text-xs text-fg-2">not counted</span>}</td>
                          <td className="num py-1.5 pl-4 text-right">{pct(v.volume / total)}</td>
                          <td className="num py-1.5 pl-4 text-right text-fg-2">{usd(v.volume)}</td>
                          <td className="num py-1.5 pl-4 text-right" style={{ color: severity(d, v.excluded) }}>{bps(d)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-fg pt-4">
          <h2 className="font-serif text-[clamp(1.75rem,3.4cqw,2.5rem)]">Since we started recording</h2>
          <span className="num text-xs text-fg-2">trust score &middot; one dot per reading</span>
        </div>
        <div className="mt-3 rounded border border-line bg-panel p-4">
          <History points={confHist} />
        </div>
        <p className="mt-2 text-sm text-fg-2">
          {confLo === confHi ? `Steady at ${confLo} across all ${hist.length} readings.` : `Between ${confLo} and ${confHi} across all ${hist.length} readings.`}
          {latestHist?.top_venue ? ` ${latestHist.top_venue} has ${stillLargest ? 'stayed' : 'become'} the largest exchange throughout.` : ''}
        </p>
      </section>

      <section className="mt-10 flex flex-col border-b border-line">
        <details>
          <summary className={summary}>What goes into the score</summary>
          <div className={`mb-4 ${card}`}>
            <ScoreBreakdown parts={r.parts} />
            <p className="mt-3 text-xs text-fg-2">
              A two-asset ranking can favour one with lighter concentration risk (spread) but heavier junk-exchange exclusion (cleanliness), or vice
              versa. See <Link className="underline decoration-accent underline-offset-2" href="/methodology">how this works</Link>.
            </p>
          </div>
        </details>

        {board.length > 0 && (
          <details>
            <summary className={summary}>Off-market exchanges, across readings</summary>
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-fg-2">
                  <tr className="border-b border-line"><th className="pb-2 font-normal">Exchange</th><th className="pb-2 pl-4 text-right font-normal">Seen in</th><th className="pb-2 pl-4 text-right font-normal">Typical gap</th><th className="pb-2 pl-4 text-right font-normal">Peak volume</th></tr>
                </thead>
                <tbody>
                  {board.map((v) => (
                    <tr key={v.key} className="border-b border-line/60">
                      <td className="py-1.5">{v.key}</td>
                      <td className="num py-1.5 pl-4 text-right text-fg-2">{v.captures} of {hist.length}</td>
                      <td className="num py-1.5 pl-4 text-right text-bad">{bps(v.medianBps)}</td>
                      <td className="num py-1.5 pl-4 text-right text-fg-2">{usd(v.maxVolume)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        <details>
          <summary className={summary}>Where {NAMES[symbol] ?? symbol} actually trades: futures funding and basis</summary>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stat('Funding per interval (OI-weighted)', r.funding === null ? 'n/a' : bps(r.funding * 1e4))}
            {stat('Basis vs index (OI-weighted)', r.basis === null ? 'n/a' : bps(r.basis * 1e4))}
            {l ? stat('Liquidated 24h (long / short)', `${usd(l.long_24h)} / ${usd(l.short_24h)}`) : null}
          </div>
        </details>

        {dex && (
          <details>
            <summary className={summary}>Price on decentralised exchanges</summary>
            <div className="mb-4">
              <p className="max-w-3xl text-sm text-fg-2">
                Uniswap v3 pools on Ethereum, liquidity-weighted, against the agreed price above. The on-chain asset is {token}
                {token !== symbol && ', a different token from the one exchanges track, so part of any gap can be wrapper risk'}. Pools only update when someone trades.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {stat('DEX vs exchanges', bps(dex.gapBps))}
                {stat('Pools disagree by', `${Math.round(dex.spreadBps)} bps`)}
                {stat('Pool liquidity', usd(dex.liquidity))}
                {stat('Not traded in 30 min', pct(dex.staleShare, 0))}
              </div>
            </div>
          </details>
        )}
      </section>
    </main>
  );
}
