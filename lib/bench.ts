// Pure helper for components/Charts.tsx's Bench chart, split out so it's testable without a JSX loader.
//
// Capped: a single bad/extreme data point (a thin, newly-listed asset's composite landing far from
// CMC's published price — real example: a per-1000-vs-per-token unit split once put a meme coin's gap
// at ~6.7 million bps) must never blow up the axis-tick count in Bench. Extreme items pin to the edge
// instead, same as any other off-scale value, with the real number still shown in its label.
export const benchDomain = (items: { gapBps: number }[], domain: number, tolerance: number) =>
  Math.min(2000, Math.max(domain, ...items.map((i) => Math.abs(i.gapBps)), tolerance + 5));
