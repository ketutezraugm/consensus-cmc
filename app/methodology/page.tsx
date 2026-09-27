import Link from 'next/link';

export const metadata = { title: 'Methodology | Consensus' };

const card = 'rounded-lg border border-line bg-panel p-5';
const Formula = ({ children }: { children: string }) => (
  <code className="num block overflow-x-auto rounded bg-raised px-4 py-3 text-sm text-fg">{children}</code>
);

export default function Methodology() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <Link href="/" className="text-sm text-muted hover:text-fg">← back</Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Methodology</h1>
      <p className="mt-3 text-muted">
        What the confidence score actually computes, what&apos;s been checked against real data versus is a stated judgement call, and where this
        can mislead you if read too literally. Every number below is pulled from the live source, not summarized from memory —
        <a className="ml-1 underline underline-offset-2" href="https://github.com/ketutezraugm/consensus-cmc/blob/main/lib/consensus.ts">lib/consensus.ts</a>.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">The confidence score</h2>
        <p className="mt-2 text-sm text-muted">
          Computed fresh from that capture&apos;s venue-level data, one score per asset, 0–100. Four components, each already 0–1:
        </p>
        <Formula>{'confidence = round(100 × (0.40·spread + 0.30·agreement + 0.15·freshness + 0.15·cleanliness))'}</Formula>
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <div className="font-medium">spread — 40%</div>
            <p className="mt-1 text-muted"><code className="num">1 − HHI</code>, the Herfindahl index over each venue&apos;s share of 24h volume. One venue holding
            everything scores 0; volume spread evenly across many venues scores close to 1. This is the single biggest input, because a price
            one venue can move alone is the core risk this project is built to surface.</p>
          </div>
          <div>
            <div className="font-medium">agreement — 30%</div>
            <p className="mt-1 text-muted">Share of volume, among venues CMC itself trusts for price, quoting within <b>50 bps</b> of that
            group&apos;s reference (their volume-weighted median). Chosen because 50 bps is inside typical cross-venue funding-driven basis for
            liquid perps and outside a rounding artifact — not fitted to any target.</p>
          </div>
          <div>
            <div className="font-medium">freshness — 15%</div>
            <p className="mt-1 text-muted">1 minus the volume share of non-excluded venues whose quote is more than <b>10 minutes</b> old at
            capture time. A stale quote from a dead venue shouldn&apos;t count as agreement or disagreement.</p>
          </div>
          <div>
            <div className="font-medium">cleanliness — 15%</div>
            <p className="mt-1 text-muted"><code className="num">1 − excludedShare</code>: the volume share CoinMarketCap itself flags via
            <code className="num mx-1">outlier_detected</code> or a non-empty <code className="num">exclusions</code> array. High exclusion
            doesn&apos;t directly punish the score much (15%), but it&apos;s reported everywhere alongside the number so it&apos;s never hidden.</p>
          </div>
        </div>
        <p className="mt-4 rounded-lg border border-warn/30 bg-warn/5 p-4 text-sm">
          <b>The weights (40/30/15/15) are a stated judgement call, not a fitted or backtested model.</b> Nothing in this project&apos;s three
          weeks of history is enough to validate that 40% is the &ldquo;right&rdquo; weight for concentration versus 30% for agreement. They encode
          a reasonable prior — concentration risk matters most, then whether other venues agree — and every page that shows a confidence number
          says so.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Tokenised-asset disagreement (the /rwa layer)</h2>
        <p className="mt-2 text-sm text-muted">Same idea, adapted for issuer tokens rather than exchange venues:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted">
          <li>A token counts as <b>liquid</b> only above <code className="num">$10k</code> of 24h volume; below that it&apos;s <b>thin</b> and excluded
            from the reference price (dust shouldn&apos;t define &ldquo;the&rdquo; price of NVDA).</li>
          <li>The reference price is a weighted median of liquid tokens, weighted by market cap where available and by volume otherwise — a
            <b> known simplification</b>: mixing those two units in one weight is fine for a median/stdev calculation, not for anything requiring
            a true blended average.</li>
          <li>Tokens priced at roughly 1/31.1, 1/1000, 1/100 or 1/10 of the reference are flagged as a likely <b>unit</b> mismatch (grams vs
            troy ounces, for example) rather than genuine disagreement, and excluded from the spread figures. This exists because gold tokens
            priced per gram were originally misread as a fabricated 97% price disagreement — see the finding below.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">What&apos;s been checked, and what wasn&apos;t</h2>
        <p className="mt-2 text-sm text-muted">In order of how much confidence to place in each:</p>

        <div className="mt-4 space-y-3">
          <div className={card} style={{ borderLeftColor: 'var(--color-good)', borderLeftWidth: 3 }}>
            <div className="font-medium">Code-tested, not data-dependent</div>
            <p className="mt-1 text-sm text-muted">
              The unit-detection rule, the HHI/dispersion/freshness math, and the RWA scoring all run against real recorded API fixtures in
              <code className="num mx-1">test/</code> (57 tests). These don&apos;t depend on the market being any particular way today — a zero-volume
              venue, a single-venue asset, negative funding, a dead pool, and an RWA asset with no tracked market are all exercised directly.
            </p>
          </div>
          <div className={card} style={{ borderLeftColor: 'var(--color-good)', borderLeftWidth: 3 }}>
            <div className="font-medium">Persistent across dozens of live captures</div>
            <p className="mt-1 text-sm text-muted">
              BCH&apos;s volume concentration on Deepcoin, SunX quoting materially off-market on most tracked assets, and the same handful of
              Kraken/DigiFinex markets being returned twice with conflicting prices have all held up across every capture since recording began
              — not a one-off snapshot artifact. See <Link className="underline underline-offset-2" href="/anomalies">off-market venues</Link> for
              the live, running tally.
            </p>
          </div>
          <div className={card} style={{ borderLeftColor: 'var(--color-warn)', borderLeftWidth: 3 }}>
            <div className="font-medium">Checked once, did not hold up on a second check — kept here on purpose</div>
            <p className="mt-1 text-sm text-muted">
              Early on, Deepcoin&apos;s reported <i>total</i> derivatives volume across all its markets (from
              <code className="num mx-1">/v5/exchange/derivatives/list</code>) was smaller than the volume it alone reported for one BCH
              market — a striking inconsistency. Re-running the same two calls later found the opposite: BCH volume was a small fraction of a
              much larger total. Venue-reported volume is evidently volatile enough that a single-snapshot cross-check like this isn&apos;t
              reliable evidence on its own, and this project doesn&apos;t claim it as a finding. It&apos;s kept here as the honest record of a
              check that failed to reproduce, and as a real example of the kind of noise this whole project exists to make visible.
            </p>
          </div>
          <div className={card} style={{ borderLeftColor: 'var(--color-muted)', borderLeftWidth: 3 }}>
            <div className="font-medium">Not checked, and out of scope</div>
            <p className="mt-1 text-sm text-muted">
              Whether CoinMarketCap&apos;s own published headline price actually uses the flagged rows. Whether any specific venue&apos;s volume is
              real versus wash-traded. Whether the confidence weights would hold up against a longer history or a larger asset universe than the
              15 crypto assets and 38 tokenised assets this project&apos;s CMC Basic-tier credit budget currently covers.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Known limits</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>15 crypto assets and 38 tokenised assets — sized to what fits inside the free CMC Basic tier&apos;s monthly credits, not the full
            market.</li>
          <li>The on-chain layer covers only BTC, ETH and LINK, via Uniswap v3 on Ethereum — one chain, one DEX, three assets.</li>
          <li>Data is a snapshot recorded every 30 minutes (throttled further if the API key&apos;s monthly credits run low); nothing here is
            real-time.</li>
          <li>RWA quotes carry no underlying TradFi price from the API, so the tokenised-asset layer compares issuers with each other, not
            with the real-world stock or commodity price.</li>
        </ul>
      </section>

      <p className="mt-10 max-w-2xl text-xs text-muted">
        Full source, the raw API evidence behind every claim on this page, and the test suite are all in the public repo:
        <a className="ml-1 underline underline-offset-2" href="https://github.com/ketutezraugm/consensus-cmc">github.com/ketutezraugm/consensus-cmc</a>.
      </p>
    </main>
  );
}
