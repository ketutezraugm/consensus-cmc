import Link from 'next/link';
import { notFound } from 'next/navigation';
import { captures, rwaObservations, rwaScoreHistory, rwaSymbols } from '@/lib/data';
import { scoreAssets } from '@/lib/rwa';
import { unitFactor } from '@/lib/consensus';
import { Dispersion, Trend, Legend, severity, type V } from '@/components/Charts';
import { usd, pct, bps, stamp } from '@/lib/fmt';
import { Ago } from '@/components/Ago';

// Rendered once per capture: fetches below are tagged 'data' and the recorder revalidates that tag after each capture.
export const revalidate = 1800;

// Prebuild the recorded tokenised assets for CDN-edge serving. dynamicParams (default true) still
// renders anything new on demand, so a symbol that appears after this build is never a dead link.
export const generateStaticParams = async () => (await rwaSymbols()).map((symbol) => ({ symbol }));

const card = 'rounded border border-line bg-panel p-4';
const KIND_NOTE: Record<string, string> = { liquid: 'Liquid', thin: 'Low volume', derivative: 'Derivative, not the stock', unit: 'Different unit', untracked: 'No price yet' };
const KIND_TONE: Record<string, string> = { liquid: 'text-fg', thin: 'text-fg-2', derivative: 'text-fg-2', unit: 'text-fg-2', untracked: 'text-label' };

export default async function RwaAsset({ params }: { params: Promise<{ symbol: string }> }) {
  const symbol = (await params).symbol.toUpperCase();
  const at = (await captures())[0];
  const obs = at ? await rwaObservations(at, symbol) : [];
  const scored = scoreAssets(obs)[0];
  if (!scored) notFound();
  const { r, type } = scored;
  const hist = await rwaScoreHistory(symbol);
  const venues: V[] = r.rows.filter((x) => x.price && x.kind !== 'unit')
    .map((x) => ({ name: `${x.issuer} ${x.symbol}`, price: x.price!, volume: x.volume, excluded: x.kind !== 'liquid', priceExcluded: x.kind !== 'liquid' }));
  const pts = (f: (h: (typeof hist)[number]) => number) => hist.map((h) => ({ t: Date.parse(h.captured_at), v: +f(h) }));
  const rows = [...r.rows].sort((a, b) => b.volume - a.volume);
  const stat = (k: string, v: string) => (
    <div key={k} className={card}><div className="text-xs text-fg-2">{k}</div><div className="num mt-1 text-2xl text-fg">{v}</div></div>
  );

  const unitRow = rows.find((x) => x.kind === 'unit' && x.price);
  const unitD = unitRow ? unitFactor(unitRow.price! / r.ref) : null;
  const perGram = unitD !== null && Math.abs(unitD - 31.1034768) < 0.5;
  const unitLabel = unitD === null ? '' : perGram ? 'per gram' : unitD >= 1 ? `at 1/${Math.round(unitD)} of the reference unit` : `at ${Math.round(1 / unitD)}× the reference unit`;
  const naivePct = unitRow ? (unitRow.price! / r.ref - 1) * 100 : 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <p className="text-sm text-fg-2"><Link href="/rwa" className="hover:text-fg">Tokenised stocks</Link> / {symbol}</p>
      <h1 className="mt-2 flex flex-wrap items-baseline gap-x-3 font-serif text-[clamp(2.75rem,6cqw,4.75rem)] leading-[0.95] tracking-tight text-fg">
        {symbol} <span className="text-2xl text-fg-2">{type}, tokenised</span>
      </h1>
      <p className="num mt-1 text-sm text-fg-2"><Ago iso={at} /> &middot; {r.tokens} tokens from {r.issuers} issuers &middot; reference ${r.ref.toLocaleString('en-US', { maximumFractionDigits: 4 })}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat('Weighted disagreement', `${(r.dispersionBps / 100).toFixed(2)}%`)}
        {stat('Highest vs lowest liquid', bps(r.spreadBps).replace('+', ''))}
        {stat('Liquid tokens', `${r.liquid} of ${r.tokens}`)}
        {stat('Largest issuer', `${pct(r.topShare, 0)} ${r.topIssuer.split(' ')[0]}`)}
      </div>

      {unitRow && unitD !== null && (
        <section className="mt-8 rounded border border-line bg-panel p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-2">Read naively</span>
              <span className="font-serif text-[clamp(1.6rem,3.4cqw,2.2rem)] leading-tight text-fg-2 decoration-bad decoration-2 line-through">{Math.abs(naivePct).toFixed(0)}% disagreement</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-2">What&apos;s actually happening</span>
              <span className="font-serif text-[clamp(1.6rem,3.4cqw,2.2rem)] leading-tight text-fg">{unitRow.issuer} prices {symbol} {unitLabel}.</span>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm text-fg-2">
            ${r.ref.toLocaleString('en-US', { maximumFractionDigits: 2 })} {unitD >= 1 ? '÷' : '×'} {(unitD >= 1 ? unitD : 1 / unitD).toFixed(1)} {perGram ? 'grams per troy ounce' : ''} &asymp; ${unitRow.price!.toLocaleString('en-US', { maximumFractionDigits: 2 })}.
            A token priced at close to 1/31.1, 1/1000, 1/100 or 1/10 of the reference is treated as a different unit, labelled, and left out of the
            disagreement figure.
          </p>
        </section>
      )}

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-fg pt-4">
          <h2 className="font-serif text-[clamp(1.75rem,3.4cqw,2.5rem)]">Where each issuer prices {symbol}</h2>
          <Legend grey="low volume or derivative" />
        </div>
        <div className="mt-3 rounded border border-line bg-panel p-4"><Dispersion venues={venues} refPrice={r.ref} h={220} /></div>
      </section>

      <section className="mt-10">
        <h2 className="border-t border-fg pt-4 font-serif text-[clamp(1.75rem,3.4cqw,2.5rem)]">Each issuer&apos;s token</h2>
        <div className="mt-3 overflow-x-auto border-t border-fg">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="text-left text-fg-2">
            <tr className="border-b border-line">
              <th className="pb-2 pt-2.5 font-normal">Token</th>
              <th className="pb-2 pl-4 pt-2.5 text-right font-normal">Price</th><th className="pb-2 pl-4 pt-2.5 text-right font-normal">vs reference</th>
              <th className="pb-2 pl-4 pt-2.5 text-right font-normal">24h traded</th><th className="pb-2 pl-4 pt-2.5 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-b border-line/60">
                <td className="py-2"><span className="font-medium text-fg">{t.issuer}</span> <span className="num text-fg-2">{t.symbol}</span></td>
                <td className="num py-2 pl-4 text-right">{t.price ? `$${t.price.toLocaleString('en-US', { maximumFractionDigits: 3 })}` : 'n/a'}</td>
                <td className="num py-2 pl-4 text-right" style={{ color: t.bps === null ? 'var(--color-fg-2)' : severity(t.bps, t.kind !== 'liquid') }}>{t.bps === null ? (t.kind === 'unit' ? `× ${(unitFactor(t.price! / r.ref) ?? 0).toFixed(1)} = ${r.ref.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : 'n/a') : bps(t.bps)}</td>
                <td className="num py-2 pl-4 text-right text-fg-2">{t.volume ? usd(t.volume) : 'n/a'}</td>
                <td className="py-2 pl-4"><span className={`rounded-sm bg-raised px-1.5 py-0.5 text-xs font-medium ${KIND_TONE[t.kind]}`}>{KIND_NOTE[t.kind]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <p className="mt-3 max-w-3xl text-xs text-fg-2">
          The reference is the market-cap-weighted median of liquid tokens (at least $10k of 24h volume). The API does not include the underlying
          asset&apos;s own price, so this compares tokens with each other.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="border-t border-fg pt-4 font-serif text-[clamp(1.75rem,3.4cqw,2.5rem)]">Over time</h2>
        {hist.length > 1 ? (
          <>
            <p className="mt-1 text-sm text-fg-2">{hist.length} readings since {stamp(hist[0].captured_at)}.</p>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <div className={card}><div className="text-sm font-medium text-fg">Weighted disagreement (bps)</div>
                <Trend points={pts((h) => h.dispersion_bps)} fmt={(v) => `${Math.round(v)}`} label={`${symbol} issuer disagreement over time`} /></div>
              <div className={card}><div className="text-sm font-medium text-fg">Highest vs lowest liquid token (bps)</div>
                <Trend points={pts((h) => h.spread_bps)} fmt={(v) => `${Math.round(v)}`} label={`${symbol} issuer spread over time`} color="var(--color-warn)" /></div>
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-fg-2">History for tokenised stocks is still accumulating.</p>
        )}
      </section>
    </main>
  );
}
