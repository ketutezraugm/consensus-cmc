import Link from 'next/link';
import { scoreHistory, anomalyRows } from '@/lib/data';
import { alerts, THRESHOLDS } from '@/lib/alerts';
import { dur } from '@/lib/fmt';

export const metadata = { title: 'Alerts | Consensus' };

const KIND: Record<string, string> = { concentration: 'Concentrated', 'off-market': 'Off-market venue', 'confidence-drop': 'Confidence drop', 'dex-gap': 'DEX gap' };

export default async function Alerts() {
  const [scores, anoms] = await Promise.all([scoreHistory(), anomalyRows()]);
  const list = alerts(scores, anoms);
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">What to know before you trade</h1>
      <p className="mt-3 max-w-3xl text-muted">
        Conditions in the latest capture that mean the price you see may be set by very little, or may not be the price everyone else gets. Each one
        shows how long it has been true.
      </p>
      <p className="mt-2 max-w-3xl text-xs text-muted">
        Fires when one venue holds {Math.round(THRESHOLDS.concentration * 100)}%+ of an asset&apos;s volume, when a venue CMC trusts quotes {THRESHOLDS.offMarketBps}+ bps
        off the median with at least ${THRESHOLDS.offMarketVolume / 1e6}M of daily volume, when confidence falls {THRESHOLDS.confidenceDrop}+ points, or when on-chain pools
        sit {THRESHOLDS.dexGapBps}+ bps from exchanges. Machine-readable: <Link className="underline underline-offset-2" href="/api/alerts">/api/alerts</Link>
      </p>

      <div className="mt-8 space-y-2.5">
        {list.length === 0 && <div className="rounded-lg border border-line bg-panel p-5 text-muted">Nothing unusual in the latest capture.</div>}
        {list.map((a) => (
          <Link key={a.id} href={a.href} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-line bg-panel p-4 transition-colors hover:border-accent"
                style={{ borderLeft: `3px solid ${a.severity === 'high' ? 'var(--color-bad)' : 'var(--color-warn)'}` }}>
            <span className="w-36 shrink-0 text-xs uppercase tracking-wide text-muted">{KIND[a.kind]}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{a.title}</span>
              <span className="block text-sm text-muted">{a.detail}</span>
            </span>
            <span className="num text-sm text-muted">for {dur(a.since)}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
