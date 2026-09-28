import { captures, rwaObservations } from '@/lib/data';
import { scoreAssets } from '@/lib/rwa';
import { SpreadBars } from '@/components/Charts';
import { RwaList } from '@/components/RwaList';
import { usd } from '@/lib/fmt';
import { Ago } from '@/components/Ago';

// Rendered once per capture: fetches below are tagged 'data' and the recorder revalidates that tag after each capture.
export const revalidate = 1800;

export const metadata = { title: 'Tokenised stocks | Consensus' };

const SHOWN = 7;

export default async function Rwa() {
  const at = (await captures())[0];
  const obs = at ? await rwaObservations(at) : [];
  if (!obs.length) return <main className="mx-auto max-w-6xl px-5 py-10 text-fg-2">Tokenised-stock data is being recorded; check back after the next reading.</main>;

  const assets = scoreAssets(obs).sort((a, b) => b.r.dispersionBps - a.r.dispersionBps);
  const widest = assets[0];
  const widestLiquid = widest.r.rows.filter((x) => x.kind === 'liquid' && x.price).length;
  const restCeiling = assets.slice(SHOWN).reduce((m, a) => Math.max(m, a.r.dispersionBps), 0);
  const shown = assets.slice(0, SHOWN), rest = assets.slice(SHOWN);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <p className="num text-xs text-fg-2">{assets.length} tokenised stocks &middot; latest reading &middot; <Ago iso={at} /></p>
      <h1 className="mt-3 max-w-3xl font-serif text-[clamp(2.75rem,5.6cqw,4.5rem)] leading-none tracking-tight text-fg">Tokenised stocks and commodities</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-fg-2">
        A tokenised stock is a crypto token meant to track a real share or commodity, like Apple or gold. Several issuers make tokens for the same
        asset. We compare their prices with each other.
      </p>

      <section className="mt-8 grid gap-6 rounded border border-line bg-panel p-5 sm:grid-cols-2 sm:items-center sm:p-8">
        <div className="flex flex-col gap-2">
          <span className="num text-xs text-accent-ink">Widest disagreement</span>
          <span className="font-serif text-[clamp(3.5rem,10cqw,8rem)] leading-[0.85] tracking-tight text-bad">{(widest.r.dispersionBps / 100).toFixed(1)}%</span>
          <p className="mt-1 text-base text-fg">
            Between the {widest.r.tokens} {widest.symbol} tokens, {widestLiquid} of them liquid. Every other asset&apos;s issuers agree within {(restCeiling / 100 || assets[1]?.r.dispersionBps / 100 || 0).toFixed(2)}%.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <SpreadBars items={assets.map((a) => ({ symbol: a.symbol, pct: a.r.dispersionBps / 100 }))} />
          <span className="text-xs text-fg-2">Issuer disagreement per asset. Axis 0&ndash;1%, {widest.symbol} off-scale.</span>
        </div>
      </section>

      <div className="mt-12 flex items-baseline justify-between gap-3 border-b border-fg pb-2.5">
        <h2 className="font-serif text-3xl">Most disagreement first</h2>
        <span className="num text-xs text-fg-2">{shown.length} of {assets.length}</span>
      </div>
      <RwaList shown={shown} rest={rest} restCeiling={restCeiling} />

      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-fg-2">
        A token counts as liquid with at least $10k of 24h volume. The reference is the market-cap-weighted median of liquid tokens. Tokens priced at
        roughly 1/31.1 (per gram) or a power of ten of the reference are treated as unit differences, not disagreement. The API does not include the
        underlying stock&apos;s own price, so this compares tokens with each other, not with the stock.
      </p>
    </main>
  );
}
