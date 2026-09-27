import Link from 'next/link';
import { scoreHistory, anomalyRows } from '@/lib/data';
import { venueBoard, marketBoard } from '@/lib/history';
import { usd, pct, bps, stamp } from '@/lib/fmt';

// Rendered once per capture: fetches below are tagged 'data' and the recorder revalidates that tag after each capture.
export const revalidate = 1800;

export const metadata = { title: 'Off-market venues | Consensus' };

export default async function Anomalies() {
  const [scores, rows] = await Promise.all([scoreHistory(), anomalyRows()]);
  const total = new Set(scores.map((s) => s.captured_at)).size;
  const venues = venueBoard(rows, total).slice(0, 15);
  const markets = marketBoard(rows, total).slice(0, 25);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <p className="text-sm text-fg-2"><Link href="/methodology" className="hover:text-fg">How this works</Link> / Off-market exchanges</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight text-fg sm:text-5xl">Off-market exchanges</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-fg-2">
        Exchanges whose price sits more than 1% away from the median of the exchanges CoinMarketCap trusts, yet which CoinMarketCap does not
        exclude from price. Ranked by how many assets they affect and how many of the {total} recorded readings they appear in.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-fg-2">
        This shows what the API returns. It does not show whether CoinMarketCap&apos;s headline price uses these rows, and small exchanges barely move an aggregate.
      </p>

      <h2 className="mt-10 border-t border-fg pt-4 font-serif text-2xl">By exchange</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-fg-2">
            <tr><th className="py-2 pr-4 font-normal">Exchange</th><th className="pr-4 text-right font-normal">Assets</th><th className="pr-4 text-right font-normal">Readings</th><th className="pr-4 text-right font-normal">Typical gap</th><th className="text-right font-normal">Peak 24h volume</th></tr>
          </thead>
          <tbody>
            {venues.map((v) => (
              <tr key={v.key} className="border-t border-line align-top">
                <td className="py-2 pr-4 text-fg">{v.key}<div className="text-xs font-normal text-fg-2">{v.assets.join(', ')}</div></td>
                <td className="pr-4 text-right num">{v.assets.length}</td>
                <td className="pr-4 text-right num">{v.captures} of {total} <span className="text-fg-2">({pct(v.presence, 0)})</span></td>
                <td className="pr-4 text-right num text-bad">{bps(v.medianBps)}</td>
                <td className="text-right num">{usd(v.maxVolume)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-12 border-t border-fg pt-4 font-serif text-2xl">By market</h2>
      <p className="text-sm text-fg-2">The same data per asset, exchange and pair. A market that appears twice in one reading is a duplicate the API returned.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-fg-2">
            <tr><th className="py-2 pr-4 font-normal">Market</th><th className="pr-4 text-right font-normal">Rows seen</th><th className="pr-4 text-right font-normal">Typical gap</th><th className="pr-4 text-right font-normal">Peak 24h volume</th><th className="text-right font-normal">First seen</th></tr>
          </thead>
          <tbody>
            {markets.map((m) => (
              <tr key={m.key} className="border-t border-line">
                <td className="py-2 pr-4"><Link className="text-fg hover:underline" href={`/${m.assets[0]}`}>{m.key}</Link></td>
                <td className="pr-4 text-right num">{m.captures}</td>
                <td className="pr-4 text-right num text-bad">{bps(m.medianBps)}</td>
                <td className="pr-4 text-right num">{usd(m.maxVolume)}</td>
                <td className="text-right num text-fg-2">{stamp(m.first)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
