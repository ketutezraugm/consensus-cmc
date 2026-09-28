import Link from 'next/link';
import { scoreHistory, anomalyRows, captures } from '@/lib/data';
import { findings, latestPerSymbol } from '@/lib/history';
import { TRACKED } from '@/lib/assets';
import { stamp } from '@/lib/fmt';
import { Ago } from '@/components/Ago';

// Rendered once per capture: fetches below are tagged 'data' and the recorder revalidates that tag after each capture.
export const revalidate = 1800;

export const metadata = { title: 'For judges | Consensus' };

export default async function Judge() {
  const caps = await captures();
  if (!caps.length) return <main className="mx-auto max-w-3xl px-5 py-10 text-fg-2">No captures recorded yet.</main>;
  const at = caps[0];
  const [allRaw, anomsRaw] = await Promise.all([scoreHistory(), anomalyRows()]);
  const all = allRaw.filter((s) => TRACKED.has(s.symbol));
  const anoms = anomsRaw.filter((a) => TRACKED.has(a.symbol));
  const total = new Set(all.map((s) => s.captured_at)).size;
  const list = findings(latestPerSymbol(all), all, anoms, total).slice(0, 4);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <p className="text-sm text-fg-2"><Link href="/" className="hover:text-fg">Assets</Link> / For judges</p>
      <h1 className="mt-2 font-serif text-[clamp(2.5rem,5.6cqw,4rem)] leading-none tracking-tight text-fg">The 90-second path through the evidence</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-fg-2">
        Everything below is computed live from recorded data, not staged for this page. Click through each number to the page that backs it.
      </p>

      <ol className="mt-10 flex flex-col gap-7 border-t border-fg pt-6">
        {list.map((f, i) => (
          <li key={f.k} className="flex gap-4">
            <span className="num font-serif text-3xl leading-none text-accent-ink">{i + 1}</span>
            <div>
              <Link href={f.href} className="text-lg font-semibold text-fg underline decoration-accent underline-offset-2 hover:text-accent-ink">
                {f.v} — {f.k}
              </Link>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-fg-2">{f.note}.</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-12 flex flex-col gap-2 border-t border-fg pt-6 text-sm leading-relaxed text-fg-2">
        <p>
          <b className="text-fg">Reproduce it yourself:</b>{' '}
          <code className="num rounded bg-panel px-1.5 py-0.5 text-[13px]">node --no-warnings --env-file=.env.local scripts/report.mjs</code> prints
          every number above from the live recorded data. No CMC credits spent — it reads only what was already captured.
        </p>
        <p>
          <b className="text-fg">Raw, unedited API responses:</b>{' '}
          <a className="underline decoration-accent underline-offset-2 hover:text-fg" href="https://github.com/ketutezraugm/consensus-cmc/tree/main/scripts/out">scripts/out/</a>
          {' '}on GitHub. <b className="text-fg">Tests:</b> 105, <code className="num rounded bg-panel px-1 py-0.5 text-[13px]">node --no-warnings --test</code>, offline.
        </p>
        <p>
          <b className="text-fg">What this doesn&apos;t show:</b> whether CoinMarketCap&apos;s headline price actually uses the flagged rows, or whether
          any exchange&apos;s volume is real. See <Link href="/methodology" className="underline decoration-accent underline-offset-2 hover:text-fg">how this works</Link> for the rest of what has and hasn&apos;t been checked.
        </p>
        <p className="mt-2 text-xs">{total} readings recorded since {stamp(all[0]?.captured_at ?? at)} &middot; latest reading <Ago iso={at} />.</p>
      </div>
    </main>
  );
}
