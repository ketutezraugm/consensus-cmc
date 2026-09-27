import { ImageResponse } from 'next/og';
import { captures, observations, toVenue } from '@/lib/data';
import { score } from '@/lib/consensus';

export const alt = "Consensus: how CoinMarketCap's price is made";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const C = { bg: '#F2F1EC', panel: '#FBFAF7', line: '#DEDBD2', fg: '#1B2027', muted: '#4A515B', accent: '#A67C3D', bad: '#B8462F', warn: '#B8862B' };

export default async function Image() {
  // Best real finding available right now: the most volume-concentrated tracked asset.
  let headline = "One price hides hundreds of venues that don't agree.";
  let bars: { w: number; color: string }[] = [];
  try {
    const at = (await captures())[0];
    if (at) {
      const obs = await observations(at);
      const rows = Object.values(Object.groupBy(obs, (o) => o.symbol))
        .map((rs) => ({ symbol: rs![0].symbol, venues: rs!.map(toVenue), r: score(rs!.map(toVenue), Date.parse(at)) }))
        .filter((x): x is { symbol: string; venues: ReturnType<typeof toVenue>[]; r: NonNullable<ReturnType<typeof score>> } => !!x.r)
        .sort((a, b) => b.r.top.share - a.r.top.share);
      const top = rows[0];
      if (top) {
        headline = `${Math.round(top.r.top.share * 100)}% of ${top.symbol} perp volume is on ${top.r.top.name}`;
        const total = top.venues.reduce((s, v) => s + v.volume, 0);
        bars = [...top.venues].sort((a, b) => b.volume - a.volume).slice(0, 24)
          .map((v, i) => ({ w: Math.max((v.volume / total) * 100, 0.4), color: i === 0 ? C.bad : v.excluded ? C.line : C.accent }));
      }
    }
  } catch { /* fall back to the static headline below; the image must never fail to render */ }

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, padding: 72, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: C.fg }}>Consensus</div>
          <div style={{ fontSize: 20, color: C.muted }}>CoinMarketCap API</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 28 }}>
          <div style={{ fontSize: 52, fontWeight: 700, color: C.fg, lineHeight: 1.15, display: 'flex' }}>{headline}</div>
          {bars.length > 0 && (
            <div style={{ display: 'flex', width: '100%', height: 22, borderRadius: 4, overflow: 'hidden' }}>
              {bars.map((b, i) => (
                <div key={i} style={{ width: `${b.w}%`, height: '100%', background: b.color, opacity: i === 0 ? 1 : 0.85 }} />
              ))}
            </div>
          )}
          <div style={{ fontSize: 26, color: C.muted, display: 'flex' }}>
            Who sets the price, who disagrees, and for how long — recorded every 30 minutes.
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: C.muted, borderTop: `1px solid ${C.line}`, paddingTop: 24 }}>
          <div style={{ display: 'flex' }}>consensus-cmc.vercel.app</div>
          <div style={{ display: 'flex' }}>Build with CMC: API Hackathon</div>
        </div>
      </div>
    ),
    size,
  );
}
