import Link from 'next/link';
import { captures, observations, toVenue } from '@/lib/data';
import { score } from '@/lib/consensus';
import { cadenceLabel } from '@/lib/budget';
import { THRESHOLDS } from '@/lib/alerts';
import { Dispersion } from '@/components/Charts';

export const metadata = { title: 'How this works | Consensus' };
export const revalidate = 1800;

const sq = (on: boolean, c: string) => ({ width: 12, height: 12, background: on ? c : 'transparent', border: `1px solid ${on ? c : 'var(--color-line-strong)'}`, boxSizing: 'border-box' as const });

const tiers = [
  { n: 3, c: 'var(--color-good)', title: 'Tested in code, independent of the market', body: 'Unit detection, the concentration, agreement and freshness maths, and tokenised scoring all run against recorded API responses in 105 tests: a zero-volume exchange, a single-exchange asset, negative funding, a dead pool.' },
  { n: 2, c: 'var(--color-good)', title: 'Held across every reading so far', body: "BCH's concentration on Deepcoin, SunX quoting off-market on most assets, and the same Kraken and DigiFinex markets returned twice with conflicting prices have held in every reading since recording began." },
  { n: 1, c: 'var(--color-warn)', title: "Checked once, didn't hold up. Kept here on purpose", body: "Early on, Deepcoin's reported total derivatives volume looked smaller than its volume for one BCH market. A later re-check found the opposite. Exchange-reported volume moves too much for a one-off comparison to count as evidence, so it isn't claimed as a finding." },
  { n: 0, c: 'var(--color-fg)', title: 'Not checked, and out of scope', body: "Whether CoinMarketCap's published price actually uses the flagged rows. Whether any exchange's volume is real or wash-traded. Whether the weights hold over a longer history." },
];

export default async function Methodology() {
  let fieldProps: { venues: ReturnType<typeof toVenue>[]; ref: number } | null = null;
  let cadence = 'Recorded on a fixed schedule';
  try {
    const caps = await captures();
    cadence = cadenceLabel(caps);
    const at = caps[0];
    if (at) {
      const obs = await observations(at, 'BTC');
      const venues = obs.map(toVenue);
      const r = score(venues, Date.parse(at));
      if (r) fieldProps = { venues, ref: r.ref };
    }
  } catch { /* the illustration is optional; the page still explains the method without it */ }

  return (
    <main className="mx-auto w-full max-w-[880px] px-5 py-10">
      <p className="text-sm text-fg-2"><Link href="/" className="hover:text-fg">Assets</Link> / How this works</p>
      <h1 className="mt-2 font-serif text-[clamp(2.75rem,5.6cqw,4.5rem)] leading-none tracking-tight text-fg">How this works, and where it can mislead you</h1>
      <p className="mt-4 text-lg leading-relaxed text-fg-2">
        What the numbers compute, what has been checked against real data, what is a judgement call, and one check that didn&apos;t hold up.
      </p>

      <section className="mt-14 flex flex-col gap-4">
        <h2 className="border-b border-fg pb-2.5 font-serif text-3xl">How one price is assembled</h2>
        {fieldProps && <div className="rounded border border-line bg-panel p-4"><Dispersion venues={fieldProps.venues} refPrice={fieldProps.ref} h={260} gutter={110} /></div>}
        <div className="grid grid-cols-1 gap-4 text-sm leading-relaxed text-fg-2 sm:grid-cols-3">
          <p className="border-t border-line-strong pt-2.5"><b className="font-semibold text-fg">Every exchange reports.</b> Each stroke is one exchange&apos;s price for Bitcoin and how much traded there in 24 hours. {cadence}.</p>
          <p className="border-t border-discard pt-2.5"><b className="font-semibold text-fg">Some aren&apos;t counted.</b> CoinMarketCap flags some exchanges as outliers or excludes them. They&apos;re drawn grey. We follow its choice and show it.</p>
          <p className="border-t-2 border-accent pt-2.5"><b className="font-semibold text-fg">The middle becomes the price.</b> Among the rest, the volume-weighted median is the agreed price. Big exchanges pull harder; no single one decides unless it holds most of the volume.</p>
        </div>
      </section>

      <section className="mt-14 flex flex-col gap-4">
        <h2 className="border-b border-fg pb-2.5 font-serif text-3xl">What the trust score weighs</h2>
        <div className="grid h-10 grid-cols-[40fr_30fr_15fr_15fr] gap-[3px]">
          <div className="num flex items-center bg-fg px-2.5 text-[13px] font-medium text-bg">40</div>
          <div className="num flex items-center bg-fg-2 px-2.5 text-[13px] font-medium text-bg">30</div>
          <div className="num flex items-center bg-label px-2 text-[13px] font-medium text-bg">15</div>
          <div className="num flex items-center bg-line-strong px-2 text-[13px] font-medium text-fg">15</div>
        </div>
        <div className="flex flex-col text-sm leading-relaxed text-fg-2">
          <p className="border-b border-line py-2.5"><b className="font-semibold text-fg">40 &middot; How spread across exchanges the trading is.</b> One exchange holding everything scores zero. The biggest weight, because a price one exchange can move alone is the core risk.</p>
          <p className="border-b border-line py-2.5"><b className="font-semibold text-fg">30 &middot; How many exchanges quote the same price.</b> The share of counted volume quoting within 0.5% of the agreed price.</p>
          <p className="border-b border-line py-2.5"><b className="font-semibold text-fg">15 &middot; How recently exchanges updated.</b> Quotes more than 10 minutes old count against it.</p>
          <p className="border-b border-line py-2.5"><b className="font-semibold text-fg">15 &middot; How much volume CoinMarketCap itself keeps.</b> Heavy exclusion lowers the score a little and is always shown next to it.</p>
        </div>
        <p className="font-serif text-[22px] italic leading-snug text-fg">The weights are a stated judgement call, not a fitted or backtested model.</p>
        <p className="text-sm text-fg-2">80 and above reads Reliable, 60&ndash;79 Watch, below 60 Unreliable.</p>
      </section>

      <section className="mt-14 flex flex-col gap-4">
        <h2 className="border-b border-fg pb-2.5 font-serif text-3xl">What puts something on the watchlist</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm leading-relaxed text-fg-2 sm:grid-cols-4">
          <div className="flex flex-col gap-1"><span className="num text-xl font-medium text-fg">{Math.round(THRESHOLDS.concentration * 100)}%+</span>of an asset&apos;s volume on one exchange</div>
          <div className="flex flex-col gap-1"><span className="num text-xl font-medium text-fg">{(THRESHOLDS.offMarketBps / 100).toFixed(0)}%+ off</span>for a counted exchange with at least ${THRESHOLDS.offMarketVolume / 1e6}M traded daily</div>
          <div className="flex flex-col gap-1"><span className="num text-xl font-medium text-fg">&minus;{THRESHOLDS.confidenceDrop} pts</span>fall in trust score</div>
          <div className="flex flex-col gap-1"><span className="num text-xl font-medium text-fg">{(THRESHOLDS.dexGapBps / 100).toFixed(1)}%+</span>between decentralised exchanges and the rest</div>
        </div>
      </section>

      <section className="mt-14 flex flex-col gap-4">
        <h2 className="border-b border-fg pb-2.5 font-serif text-3xl">What we checked, and what we didn&apos;t</h2>
        {tiers.map((t) => (
          <div key={t.title} className="grid grid-cols-[44px_1fr] gap-4 border-b border-line py-3.5">
            <div className="flex gap-[3px] pt-1">
              <span style={sq(t.n >= 1, t.c)} /><span style={sq(t.n >= 2, t.c)} /><span style={sq(t.n >= 3, t.c)} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-fg">{t.title}</span>
              <span className="text-sm leading-relaxed text-fg-2">{t.body}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-14 flex flex-col gap-3">
        <h2 className="border-b border-fg pb-2.5 font-serif text-3xl">Known limits</h2>
        <ul className="mt-1 list-disc space-y-2 pl-5 text-sm leading-relaxed text-fg-2">
          <li>38 crypto assets and around 100 tokenised assets, sized to the CoinMarketCap API tier this project runs on, not the whole market.</li>
          <li>Decentralised-exchange prices cover only BTC, ETH and LINK, on Uniswap v3 on Ethereum.</li>
          <li>{cadence}. Nothing here is real-time.</li>
          <li>Tokenised assets are compared issuer against issuer, not against the real stock price, which the API doesn&apos;t provide.</li>
        </ul>
        <p className="mt-2 text-sm leading-relaxed text-fg">
          Full source, the raw API evidence behind every claim, and the 105 tests:{' '}
          <a className="underline decoration-accent underline-offset-2" href="https://github.com/ketutezraugm/consensus-cmc">github.com/ketutezraugm/consensus-cmc</a>
        </p>
      </section>
    </main>
  );
}
