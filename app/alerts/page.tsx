import Link from 'next/link';
import { scoreHistory, anomalyRows } from '@/lib/data';
import { alerts, THRESHOLDS } from '@/lib/alerts';
import { Ago } from '@/components/Ago';

// Rendered once per capture: fetches below are tagged 'data' and the recorder revalidates that tag after each capture.
export const revalidate = 1800;

export const metadata = { title: 'Watchlist | Consensus' };

const KIND: Record<string, string> = { concentration: 'Concentrated', 'off-market': 'Off-market', 'confidence-drop': 'Confidence drop', 'dex-gap': 'DEX gap' };

export default async function Alerts() {
  const [scores, anoms] = await Promise.all([scoreHistory(), anomalyRows()]);
  const list = alerts(scores, anoms);
  const high = list.filter((a) => a.severity === 'high');
  const medium = list.filter((a) => a.severity === 'medium');

  const Row = ({ a }: { a: (typeof list)[number] }) => (
    <Link href={a.href} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 transition-colors hover:bg-raised sm:px-2">
      <span className="num w-16 shrink-0 rounded-sm border border-line px-1.5 py-0.5 text-center text-[11px] text-fg-2">{a.symbol}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-fg">{a.title}</span>
        <span className="block text-sm text-fg-2">{a.detail} <span className="text-[11px] uppercase tracking-wide">{KIND[a.kind]}</span></span>
      </span>
      <span className="num text-sm text-fg-2">for <Ago iso={a.since} mode="for" /></span>
    </Link>
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <p className="num text-xs text-fg-2">Latest reading &middot; {new Set(scores.map((s) => s.captured_at)).size} readings recorded</p>
      <h1 className="mt-3 max-w-2xl font-serif text-4xl tracking-tight text-fg sm:text-5xl">What to know before you trade</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-fg-2">
        Conditions in the latest reading where the price you see may be set by very little, or may not be the price you&apos;d get. Each shows how
        long it has been true.
      </p>
      <p className="mt-2 max-w-2xl text-xs text-fg-2">
        Fires when one exchange holds {Math.round(THRESHOLDS.concentration * 100)}%+ of an asset&apos;s volume, when an exchange CMC trusts quotes {THRESHOLDS.offMarketBps}+ bps
        off the median with at least ${THRESHOLDS.offMarketVolume / 1e6}M of daily volume, when confidence falls {THRESHOLDS.confidenceDrop}+ points, or when on-chain pools
        sit {THRESHOLDS.dexGapBps}+ bps from exchanges. Machine-readable: <Link className="underline decoration-accent underline-offset-2" href="/api/alerts">/api/alerts</Link>
      </p>

      {list.length === 0 && <div className="mt-8 border border-line bg-panel p-5 text-fg-2">Nothing unusual in the latest reading.</div>}

      {high.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between border-b border-bad/40 pb-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-bad">Needs attention</h2>
            <span className="num text-xs text-fg-2">{high.length} items</span>
          </div>
          <div className="divide-y divide-line">{high.map((a) => <Row key={a.id} a={a} />)}</div>
        </section>
      )}

      {medium.length > 0 && (
        <section className="mt-10">
          <div className="flex items-baseline justify-between border-b border-warn/40 pb-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-warn-ink">Worth a look</h2>
            <span className="num text-xs text-fg-2">{medium.length} items</span>
          </div>
          <div className="divide-y divide-line">{medium.map((a) => <Row key={a.id} a={a} />)}</div>
        </section>
      )}
    </main>
  );
}
