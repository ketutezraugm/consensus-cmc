import Link from 'next/link';
import { scoreHistory, anomalyRows } from '@/lib/data';
import { venueBoard, marketBoard } from '@/lib/history';
import { usd, pct, bps, stamp } from '@/lib/fmt';

export const metadata = { title: 'Off-market venues | Consensus' };

export default async function Anomalies() {
  const [scores, rows] = await Promise.all([scoreHistory(), anomalyRows()]);
  const total = new Set(scores.map((s) => s.captured_at)).size;
  const venues = venueBoard(rows, total).slice(0, 15);
  const markets = marketBoard(rows, total).slice(0, 25);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Off-market venues</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Venues whose perpetual-futures price sits more than 1% away from the median of the venues CoinMarketCap trusts, yet which CoinMarketCap does not
        exclude from price. Ranked by how many assets they affect and how many of the {total} recorded captures they appear in.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        This shows what the API returns. It does not show whether CoinMarketCap&apos;s headline price uses these rows, and small venues barely move an aggregate.
      </p>

      <h2 className="mt-10 text-lg font-semibold">By venue</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr><th className="py-2 pr-4">Venue</th><th className="pr-4 text-right">Assets</th><th className="pr-4 text-right">Captures</th><th className="pr-4 text-right">Typical gap</th><th className="text-right">Peak 24h volume</th></tr>
          </thead>
          <tbody>
            {venues.map((v) => (
              <tr key={v.key} className="border-t border-line align-top">
                <td className="py-2 pr-4 font-medium">{v.key}<div className="text-xs font-normal text-muted">{v.assets.join(', ')}</div></td>
                <td className="pr-4 text-right num">{v.assets.length}</td>
                <td className="pr-4 text-right num">{v.captures} of {total} <span className="text-muted">({pct(v.presence, 0)})</span></td>
                <td className="pr-4 text-right num text-red-500">{bps(v.medianBps)}</td>
                <td className="text-right num">{usd(v.maxVolume)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-12 text-lg font-semibold">By market</h2>
      <p className="text-sm text-muted">The same data per asset, venue and pair. A market that appears twice in one capture is a duplicate the API returned.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr><th className="py-2 pr-4">Market</th><th className="pr-4 text-right">Rows seen</th><th className="pr-4 text-right">Typical gap</th><th className="pr-4 text-right">Peak 24h volume</th><th className="text-right">First seen</th></tr>
          </thead>
          <tbody>
            {markets.map((m) => (
              <tr key={m.key} className="border-t border-line">
                <td className="py-2 pr-4"><Link className="hover:underline" href={`/${m.assets[0]}`}>{m.key}</Link></td>
                <td className="pr-4 text-right num">{m.captures}</td>
                <td className="pr-4 text-right num text-red-500">{bps(m.medianBps)}</td>
                <td className="pr-4 text-right num">{usd(m.maxVolume)}</td>
                <td className="text-right num text-muted">{stamp(m.first)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
