import Link from 'next/link';
import { notFound } from 'next/navigation';
import { captures, rwaObservations, rwaScoreHistory } from '@/lib/data';
import { scoreAssets } from '@/lib/rwa';
import { Dispersion, Trend, Legend, severity, type V } from '@/components/Charts';
import { usd, pct, bps, ago, stamp } from '@/lib/fmt';

const card = 'rounded-lg border border-line bg-panel p-4';
const KIND: Record<string, string> = {
  liquid: 'text-good', thin: 'text-warn', derivative: 'text-accent', unit: 'text-muted', untracked: 'text-muted',
};
const KIND_NOTE: Record<string, string> = {
  liquid: 'liquid', thin: 'low volume', derivative: 'derivative price', unit: 'different unit', untracked: 'no price',
};

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
    <div key={k} className={card}><div className="text-xs text-muted">{k}</div><div className="num mt-1 text-2xl font-semibold">{v}</div></div>
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <Link href="/rwa" className="text-sm text-muted hover:text-fg">← tokenised assets</Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{symbol} <span className="text-muted">{type}, tokenised</span></h1>
      <p className="num mt-1 text-sm text-muted">{ago(at)} · {r.tokens} tokens from {r.issuers} issuers · reference ${r.ref.toLocaleString('en-US', { maximumFractionDigits: 4 })}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat('Weighted disagreement', `${Math.round(r.dispersionBps)} bps`)}
        {stat('Highest vs lowest liquid', bps(r.spreadBps).replace('+', ''))}
        {stat('Liquid tokens', `${r.liquid} of ${r.tokens}`)}
        {stat('Largest issuer', `${pct(r.topShare, 0)} ${r.topIssuer.split(' ')[0]}`)}
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Where each issuer prices {symbol}</h2>
          <Legend grey="low volume or derivative" />
        </div>
        <div className="mt-3 rounded-lg border border-line bg-panel p-4"><Dispersion venues={venues} refPrice={r.ref} h={150} /></div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Every token</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-muted">
            <tr className="border-b border-line">
              <th className="pb-2 font-normal">Issuer</th><th className="pb-2 font-normal">Token</th><th className="pb-2 font-normal">Type</th>
              <th className="pb-2 text-right font-normal">Price</th><th className="pb-2 text-right font-normal">vs reference</th>
              <th className="pb-2 text-right font-normal">Market cap</th><th className="pb-2 text-right font-normal">24h volume</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-b border-line/60">
                <td className="py-1.5">{t.issuer}</td>
                <td className="num py-1.5 text-muted">{t.symbol}</td>
                <td className={`py-1.5 text-xs ${KIND[t.kind]}`}>{KIND_NOTE[t.kind]}</td>
                <td className="num py-1.5 text-right">{t.price ? `$${t.price.toLocaleString('en-US', { maximumFractionDigits: 3 })}` : 'n/a'}</td>
                <td className="num py-1.5 text-right" style={{ color: t.bps === null ? 'var(--color-muted)' : severity(t.bps, t.kind !== 'liquid') }}>{t.bps === null ? 'n/a' : bps(t.bps)}</td>
                <td className="num py-1.5 text-right text-muted">{t.mcap ? usd(t.mcap) : 'n/a'}</td>
                <td className="num py-1.5 text-right text-muted">{t.volume ? usd(t.volume) : 'n/a'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 max-w-3xl text-xs text-muted">
          The reference is the market-cap-weighted median of liquid tokens (at least $10k of 24h volume). The API does not include the underlying
          asset&apos;s own price, so this compares tokens with each other.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Over time</h2>
        {hist.length > 1 ? (
          <>
            <p className="mt-1 text-sm text-muted">{hist.length} captures since {stamp(hist[0].captured_at)}.</p>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <div className={card}><div className="text-sm font-medium">Weighted disagreement (bps)</div>
                <Trend points={pts((h) => h.dispersion_bps)} fmt={(v) => `${Math.round(v)}`} label={`${symbol} issuer disagreement over time`} /></div>
              <div className={card}><div className="text-sm font-medium">Highest vs lowest liquid token (bps)</div>
                <Trend points={pts((h) => h.spread_bps)} fmt={(v) => `${Math.round(v)}`} label={`${symbol} issuer spread over time`} color="var(--color-warn)" /></div>
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">History for tokenised assets is still accumulating.</p>
        )}
      </section>
    </main>
  );
}
