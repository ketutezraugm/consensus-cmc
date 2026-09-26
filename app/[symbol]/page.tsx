import Link from 'next/link';
import { notFound } from 'next/navigation';
import { captures, observations, poolObservations, liquidations, scoreHistory, anomalyRows, toVenue } from '@/lib/data';
import { score, onchain } from '@/lib/consensus';
import { venueBoard } from '@/lib/history';
import { Dispersion, Concentration, Trend, Legend, severity } from '@/components/Charts';
import { usd, pct, bps, ago, stamp } from '@/lib/fmt';

const card = 'rounded-lg border border-line bg-panel p-4';

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
  const dupBadge = <span className="ml-1.5 rounded bg-bad/15 px-1 text-[10px] uppercase tracking-wide text-bad">dup</span>;
  const stat = (k: string, v: string, cls = '') => (
    <div key={k} className={card}><div className="text-xs text-muted">{k}</div><div className={`num mt-1 text-2xl font-semibold ${cls}`}>{v}</div></div>
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <Link href="/" className="text-sm text-muted hover:text-fg">← all assets</Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{symbol} <span className="text-muted">perpetuals</span></h1>
      <p className="num mt-1 text-sm text-muted">
        {ago(at)} · {r.venues} venue listings · reference ${r.ref.toLocaleString('en-US', { maximumFractionDigits: 4 })} (median of venues CMC trusts)
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat('Confidence', String(r.confidence), r.confidence >= 85 ? 'text-good' : r.confidence >= 65 ? 'text-warn' : 'text-bad')}
        {stat('Effective venues', r.effectiveVenues.toFixed(1))}
        {stat('Volume in agreement', pct(r.agreeingShare, 0))}
        {stat('Volume CMC excludes', pct(r.excludedShare, 0))}
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Where each venue prices {symbol}</h2>
          <Legend />
        </div>
        <div className="mt-3 rounded-lg border border-line bg-panel p-4">
          <Dispersion venues={venues} refPrice={r.ref} h={150} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Who sets the price</h2>
        <p className="mt-1 text-sm text-muted">Share of 24h volume. Venues CMC excludes are marked.</p>
        <div className="mt-3 overflow-hidden rounded"><Concentration venues={venues} h={14} /></div>
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-muted">
            <tr className="border-b border-line"><th className="pb-2 font-normal">Venue</th><th className="pb-2 text-right font-normal">Share</th><th className="pb-2 text-right font-normal">24h volume</th><th className="pb-2 text-right font-normal">vs consensus</th></tr>
          </thead>
          <tbody>
            {top.map((v) => {
              const d = (v.price / r.ref - 1) * 1e4;
              return (
                <tr key={String(v.id)} className="border-b border-line/60">
                  <td className="py-1.5">{v.name}{v.dup && dupBadge}{v.excluded && <span className="ml-1.5 text-xs text-muted">excluded</span>}</td>
                  <td className="num py-1.5 text-right">{pct(v.volume / total)}</td>
                  <td className="num py-1.5 text-right text-muted">{usd(v.volume)}</td>
                  <td className="num py-1.5 text-right" style={{ color: severity(d, v.excluded) }}>{bps(d)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {off.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Over 1% off, and CMC does not exclude them</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-muted">
              <tr className="border-b border-line"><th className="pb-2 font-normal">Venue</th><th className="pb-2 font-normal">Pair</th><th className="pb-2 text-right font-normal">24h volume</th><th className="pb-2 text-right font-normal">vs consensus</th></tr>
            </thead>
            <tbody>
              {off.map((v) => (
                <tr key={String(v.id)} className="border-b border-line/60">
                  <td className="py-1.5">{v.name}{v.dup && dupBadge}</td>
                  <td className="num py-1.5 text-muted">{v.pair}</td>
                  <td className="num py-1.5 text-right text-muted">{usd(v.volume)}</td>
                  <td className="num py-1.5 text-right text-bad">{bps((v.price / r.ref - 1) * 1e4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Over time</h2>
        <p className="mt-1 text-sm text-muted">{hist.length} captures since {hist.length ? stamp(hist[0].captured_at) : 'n/a'}.</p>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div className={card}>
            <div className="text-sm font-medium">Confidence</div>
            <Trend points={pts((h) => h.confidence)} domain={[0, 100]} fmt={(v) => String(Math.round(v))} label={`${symbol} confidence over time`} />
          </div>
          <div className={card}>
            <div className="text-sm font-medium">Share of volume on the biggest venue</div>
            <Trend points={pts((h) => h.top_share)} domain={[0, 1]} fmt={(v) => pct(v, 0)} label={`${symbol} top venue share over time`} color="var(--color-warn)" />
          </div>
        </div>
      </section>

      {board.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Off-market venues, across captures</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-muted">
              <tr className="border-b border-line"><th className="pb-2 font-normal">Venue</th><th className="pb-2 text-right font-normal">Seen in</th><th className="pb-2 text-right font-normal">Typical gap</th><th className="pb-2 text-right font-normal">Peak volume</th></tr>
            </thead>
            <tbody>
              {board.map((v) => (
                <tr key={v.key} className="border-b border-line/60">
                  <td className="py-1.5">{v.key}</td>
                  <td className="num py-1.5 text-right text-muted">{v.captures} of {hist.length}</td>
                  <td className="num py-1.5 text-right text-bad">{bps(v.medianBps)}</td>
                  <td className="num py-1.5 text-right text-muted">{usd(v.maxVolume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Forward market</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stat('Funding per interval (OI-weighted)', r.funding === null ? 'n/a' : bps(r.funding * 1e4))}
          {stat('Basis vs index (OI-weighted)', r.basis === null ? 'n/a' : bps(r.basis * 1e4))}
          {l ? stat('Liquidated 24h (long / short)', `${usd(l.long_24h)} / ${usd(l.short_24h)}`) : null}
        </div>
      </section>

      {dex && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">On-chain vs exchanges</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Uniswap v3 pools on Ethereum, liquidity-weighted, against the reference above. The on-chain asset is {token}
            {token !== symbol && ', a different token from the one perps track, so part of any gap can be wrapper risk'}. Pools only update when someone trades.
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
