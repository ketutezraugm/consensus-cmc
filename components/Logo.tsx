// Seven strokes around one taller brass centre stroke, on a baseline. The asymmetric heights are
// deliberate: real distributions are never symmetric. Small variant (favicon, tight spaces) drops to five.
const MARK7 = [0.3, 0.48, 0.66, 1, 0.7, 0.46, 0.28];
const MARK5 = [0.42, 0.68, 1, 0.64, 0.4];

export function Logo({ size = 22, small = false, className }: { size?: number; small?: boolean; className?: string }) {
  const hs = small ? MARK5 : MARK7;
  const u = 10, sw = small ? 2.4 : 2, H = 44;
  const W = (hs.length - 1) * u + sw * 2;
  const centreIdx = (hs.length - 1) / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} height={size} width={(W / H) * size} className={className} style={{ display: 'block', flex: 'none' }} aria-hidden="true">
      {hs.map((v, i) => {
        const centre = i === centreIdx;
        const h = v * (H - 6);
        const x = sw / 2 + i * u - (centre ? sw * 0.75 : sw / 2) + sw / 2;
        return <rect key={i} x={x} y={H - 4 - h} width={centre ? sw * 1.5 : sw} height={h} fill={centre ? 'var(--color-accent)' : 'currentColor'} />;
      })}
      <rect x={0} y={H - 2} width={W} height={1.2} fill="currentColor" />
    </svg>
  );
}
