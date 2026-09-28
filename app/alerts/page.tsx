import Link from 'next/link';
import { scoreHistory, anomalyRows } from '@/lib/data';
import { alerts, THRESHOLDS } from '@/lib/alerts';
import { RunStrip } from '@/components/Charts';
import { Ago } from '@/components/Ago';
import { TRACKED } from '@/lib/assets';

// Rendered once per capture: fetches below are tagged 'data' and the recorder revalidates that tag after each capture.
export const revalidate = 1800;

export const metadata = { title: 'Watchlist | Consensus' };

const KIND: Record<string, string> = { concentration: 'Concentrated', 'off-market': 'Off-market', 'confidence-drop': 'Confidence drop', 'dex-gap': 'DEX gap' };

export default async function Alerts() {
  const [scoresRaw, anomsRaw] = await Promise.all([scoreHistory(), anomalyRows()]);
  // A symbol dropped from the watchlist (lib/assets.ts) keeps its old rows here; without this filter
  // its last, now-stale reading would show as a permanently "active" condition that never resolves.
  const scores = scoresRaw.filter((s) => TRACKED.has(s.symbol));
  const anoms = anomsRaw.filter((a) => TRACKED.has(a.symbol));
  const list = alerts(scores, anoms);
  const high = list.filter((a) => a.severity === 'high');
  const medium = list.filter((a) => a.severity === 'medium');
  const allCaptures = [...new Set(scores.map((s) => s.captured_at))].sort();
  const total = allCaptures.length || 1;
  const heldFor = (since: string) => { const i = allCaptures.indexOf(since); return i < 0 ? 1 : total - i; };

  const Row = ({ a }: { a: (typeof list)[number] }) => {
    const held = heldFor(a.since);
    return (
      <Link href={a.href} className="grid grid-cols-[20px_minmax(0,1fr)] items-start gap-x-5 gap-y-1.5 border-b border-line py-4 transition-colors hover:bg-raised sm:grid-cols-[20px_minmax(0,1fr)_230px]">
        <span className={`mt-1.5 ${a.severity === 'high' ? 'size-2.5 bg-bad' : 'ml-0.5 mt-2 size-[9px] rotate-45 bg-warn'}`} />
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span className="num rounded-sm border border-line-strong px-1.5 py-0.5 text-[13px] font-medium text-fg">{a.symbol}</span>
            <span className="text-[15px] font-semibold text-fg">{a.title.replace(`${a.symbol}: `, '')}</span>
          </span>
          <span className="mt-1 block text-[13px] leading-relaxed text-fg-2">{a.detail} <span className="text-[11px] uppercase tracking-wide text-label">{KIND[a.kind]}</span></span>
        </span>
        <span className="col-span-2 flex items-center gap-2.5 pt-1 sm:col-span-1 sm:flex-col sm:items-end sm:gap-1.5 sm:pt-1">
          <RunStrip total={total} held={held} />
          <span className="num whitespace-nowrap text-xs text-label">{held > 1 ? `${held} of ${total} readings` : <>for <Ago iso={a.since} mode="for" /></>}</span>
        </span>
      </Link>
    );
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <p className="num text-xs text-fg-2">Latest reading &middot; {total} readings since {allCaptures[0] ? new Date(allCaptures[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</p>
      <h1 className="mt-3 max-w-2xl font-serif text-[clamp(2.75rem,5.6cqw,4.5rem)] leading-none tracking-tight text-fg">What to know before you trade</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-fg-2">
        Conditions in the latest reading where the price you see may be set by very little, or may not be the price you&apos;d get. Each shows how
        long it has been true.
      </p>

      {list.length === 0 && <div className="mt-8 rounded border border-line bg-panel p-5 text-fg-2">Nothing unusual in the latest reading.</div>}

      {high.length > 0 && (
        <section className="mt-10">
          <div className="flex items-baseline justify-between border-b border-fg pb-2.5">
            <h2 className="text-[15px] font-semibold text-bad">Needs attention</h2>
            <span className="num text-xs text-fg-2">{high.length} items</span>
          </div>
          <div>{high.map((a) => <Row key={a.id} a={a} />)}</div>
        </section>
      )}

      {medium.length > 0 && (
        <section className="mt-10">
          <div className="flex items-baseline justify-between border-b border-fg pb-2.5">
            <h2 className="text-[15px] font-semibold text-warn-ink">Worth a look</h2>
            <span className="num text-xs text-fg-2">{medium.length} items</span>
          </div>
          <div>{medium.map((a) => <Row key={a.id} a={a} />)}</div>
        </section>
      )}

      <p className="mt-8 max-w-2xl text-xs text-fg-2">
        The ticks show each of the {total} readings; filled where the condition held. Fires when one exchange holds {Math.round(THRESHOLDS.concentration * 100)}%+
        of an asset&apos;s volume, when an exchange CMC trusts quotes {THRESHOLDS.offMarketBps}+ bps off the median with at least ${THRESHOLDS.offMarketVolume / 1e6}M
        of daily volume, when confidence falls {THRESHOLDS.confidenceDrop}+ points, or when on-chain pools sit {THRESHOLDS.dexGapBps}+ bps from exchanges.{' '}
        <Link className="underline decoration-accent underline-offset-2" href="/methodology">How this works</Link> has the detail. Machine-readable:{' '}
        <Link className="underline decoration-accent underline-offset-2" href="/api/alerts">/api/alerts</Link>
      </p>
    </main>
  );
}
