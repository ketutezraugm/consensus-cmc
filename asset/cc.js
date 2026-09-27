/* Consensus chart + data helper. Every chart is rects/lines/paths/text so it ports 1:1 to server-rendered React SVG. */
(function () {
  const h = (t, p, ...c) => window.React.createElement(t, p, ...c);
  const M = '\u2212';
  function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const pct = (d, dp = 1) => (d < 0 ? M : d > 0 ? '+' : '') + Math.abs(d).toFixed(dp) + '%';
  const bp = (g) => (g < 0 ? M : g > 0 ? '+' : '') + Math.abs(g) + ' bp';
  const band = (s) => s >= 80 ? { word: 'Reliable', c: 'var(--sage)' } : s >= 60 ? { word: 'Watch', c: 'var(--ochre)' } : { word: 'Unreliable', c: 'var(--verm)' };

  const ASSETS = [
    ['BCH', 'Bitcoin Cash', 38, 121, 'Deepcoin', .90, .05, 54],
    ['DOT', 'Polkadot', 87, 119, 'CEEX exchange', .23, .61, -13],
    ['BTC', 'Bitcoin', 88, 172, 'BTCC', .11, .67, -20],
    ['ADA', 'Cardano', 88, 133, '4E', .20, .62, -12],
    ['LTC', 'Litecoin', 89, 131, 'CoinUp.io', .06, .47, -5],
    ['TON', 'Toncoin', 89, 48, 'Binance', .15, .17, -17],
    ['TRX', 'Tron', 90, 112, 'AstralX', .15, .51, -8],
    ['SUI', 'Sui', 90, 133, 'FameEX', .20, .52, -8],
    ['DOGE', 'Dogecoin', 91, 137, 'FameEX', .08, .49, -9],
    ['ETH', 'Ethereum', 91, 175, 'CoinUp.io', .06, .49, -11],
    ['BNB', 'BNB', 91, 131, 'CrypFine', .07, .49, 1],
    ['AVAX', 'Avalanche', 91, 128, 'CEEX exchange', .10, .48, -8],
    ['XRP', 'XRP', 92, 159, 'AstralX', .21, .28, -4],
    ['LINK', 'Chainlink', 92, 141, 'CEEX exchange', .08, .42, -9],
    ['SOL', 'Solana', 92, 155, 'Batonex', .07, .45, -14],
  ].map(([s, name, score, n, top, share, disc, gap]) => ({ s, name, score, n, top, share, disc, gap }));

  // Labelled exchanges come from the live watchlist / anomalies page. SunX "typically 14% below" where no exact figure is published.
  const OUT = {
    BTC: [['Kraken', -20.65, .03], ['SunX', -14, .004]],
    ETH: [['Kraken', -15.90, .02], ['SunX', -7.80, .004]],
    LTC: [['SunX', -22.30, .006], ['Deepcoin', 1.09, .05]],
    DOT: [['SunX', -13.23, .006], ['Deepcoin', 1.32, .04]],
    SOL: [['Zoomex', -5.72, .04], ['SunX', -14, .003], ['Deribit', 1.36, .01]],
    LINK: [['SunX', -14, .004], ['Deepcoin', 1.25, .04]],
    XRP: [['SunX', -14, .004], ['Deribit', 1.10, .01]],
    BCH: [['SunX', -14, .002]], TON: [],
  };
  const fields = {};
  function exchanges(sym) {
    if (fields[sym]) return fields[sym];
    const a = ASSETS.find(x => x.s === sym); const r = rng(sym.split('').reduce((t, c) => t * 31 + c.charCodeAt(0), 7));
    const out = OUT[sym] || [['SunX', -14, .004]];
    const rest = a.n - 1 - out.length; const w = []; for (let i = 0; i < rest; i++) w.push(Math.pow(i + 1, -1.15) * (0.6 + r() * 0.8));
    const remain = 1 - a.share - out.reduce((t, o) => t + o[2], 0); const sw = w.reduce((t, x) => t + x, 0);
    const sd = sym === 'BCH' ? 0.28 : 0.11;
    let list = [{ name: a.top, dev: gauss(r) * 0.03, share: a.share, top: true }];
    w.forEach((x, i) => list.push({ name: 'Exchange ' + (i + 2), dev: gauss(r) * sd * (1 + i / rest), share: x / sw * remain }));
    // mark exchanges CMC discards until the discarded share matches the published figure
    let d = 0; const idx = list.map((_, i) => i).slice(1).sort(() => r() - .5);
    for (const i of idx) { if (d >= a.disc) break; list[i].disc = true; list[i].dev = gauss(r) * 0.9; d += list[i].share; }
    out.forEach(([name, dev, share]) => list.push({ name, dev, share, named: true }));
    return (fields[sym] = list);
  }

  const tone = (e) => e.disc ? 'var(--muted)' : Math.abs(e.dev) < 0.5 ? 'var(--sage)' : Math.abs(e.dev) < 2 ? 'var(--ochre)' : 'var(--verm)';
  const sH = (s) => Math.min(1, Math.max(0.08, Math.sqrt(s / 0.25)));

  /* Dispersion field. x = distance from agreed price; height = √(share ÷ 25%) capped 1, floor 8%; colour = distance band; grey = CMC discards. Beyond ±D the axis breaks into a log-compressed gutter so outliers are shown, never clipped. */
  function field(sym, o = {}) {
    const W = o.w || 1000, H = o.h || 260, compact = !!o.compact, D = o.domain || (compact ? 1 : 1.5);
    const G = compact ? 14 : (o.gutter || 128), top = compact ? 2 : 34, ph = H - top - (compact ? 4 : 44);
    const base = top + ph, x = (d) => G + (d + D) / (2 * D) * (W - 2 * G);
    const gx = (d) => { const k = Math.min(1, Math.log(Math.abs(d) / D) / Math.log(40 / D)); return d < 0 ? G - 14 - (G - 28) * k : W - G + 14 + (G - 28) * k; };
    let list = exchanges(sym).slice(); if (compact) list = list.filter(e => e.named || e.share > 0.004).slice(0, 999); list = list.sort((a, b) => (a.disc ? 0 : 1) - (b.disc ? 0 : 1) || a.share - b.share);
    const els = []; const a = ASSETS.find(z => z.s === sym);
    els.push(h('rect', { key: 'tb', x: x(-.5), y: top, width: x(.5) - x(-.5), height: ph, fill: 'var(--sage)', opacity: compact ? .12 : .09 }));
    if (!compact) [-.5, .5].forEach((d, i) => els.push(h('line', { key: 'te' + i, x1: x(d), x2: x(d), y1: top, y2: base, stroke: 'var(--sage)', strokeDasharray: '2 3', strokeWidth: 1, opacity: .7 })));
    els.push(h('line', { key: 'ax', x1: compact ? 0 : G - 6, x2: compact ? W : W - G + 6, y1: base + .5, y2: base + .5, stroke: 'var(--rule-strong)' }));
    if (!compact) {
      const step = D >= 1.5 ? .5 : .5;
      for (let d = -D; d <= D + 1e-9; d += step) {
        const X = x(d);
        els.push(h('line', { key: 't' + d, x1: X, x2: X, y1: base, y2: base + 5, stroke: 'var(--rule-strong)' }));
        els.push(h('text', { key: 'tl' + d, x: X, y: base + 20, textAnchor: 'middle', fontSize: 11, fontFamily: 'IBM Plex Mono', fill: 'var(--ink-3)' }, Math.abs(d) < 1e-9 ? '0' : pct(d, 1)));
      }
      [G - 6, W - G + 6].forEach((X, i) => els.push(h('path', { key: 'br' + i, d: `M${X - 4} ${base + 5} L${X} ${base - 5} M${X} ${base + 5} L${X + 4} ${base - 5}`, stroke: 'var(--ink-3)', fill: 'none' })));
      els.push(h('text', { key: 'gl', x: 4, y: base + 20, fontSize: 10, fontFamily: 'IBM Plex Mono', fill: 'var(--ink-3)' }, 'off-scale'));
      els.push(h('text', { key: 'gr', x: W - 4, y: base + 20, textAnchor: 'end', fontSize: 10, fontFamily: 'IBM Plex Mono', fill: 'var(--ink-3)' }, 'off-scale'));
    }
    let li = 0, ri = 0;
    list.forEach((e, i) => {
      const off = Math.abs(e.dev) > D; if (off && compact && !e.named) return;
      const X = off ? (compact ? (e.dev < 0 ? 3 : W - 3) : gx(e.dev)) : x(e.dev);
      const hh = ph * (compact ? Math.max(.18, sH(e.share)) : sH(e.share)), c = tone(e), sw = compact ? 1.5 : (e.top ? 3 : 2);
      els.push(h('line', { key: 's' + i, x1: X, x2: X, y1: base, y2: base - hh, stroke: c, strokeWidth: sw, opacity: e.disc ? .55 : 1 },
        compact ? null : h('title', null, `${e.name} · ${pct(e.dev, 2)} · ${(e.share * 100).toFixed(1)}% of volume${e.disc ? ' · CoinMarketCap doesn’t count this exchange' : ''}`)));
      if (!e.disc && Math.abs(e.dev) >= 2) els.push(h('circle', { key: 'c' + i, cx: X, cy: base - hh - (compact ? 0 : 4), r: compact ? 1.6 : 3, fill: c }));
      if (!compact && (e.named || e.top) && !e.disc) {
        const left = e.dev < 0, k = off ? (left ? li++ : ri++) : 0;
        const label = e.top ? `${e.name} · ${Math.round(e.share * 100)}%` : `${e.name} ${pct(e.dev)}`;
        if (off) els.push(h('text', { key: 'l' + i, x: left ? 4 : W - 4, y: base + 36 + k * 14, textAnchor: left ? 'start' : 'end', fontSize: 11, fontFamily: 'IBM Plex Mono', fill: c }, label));
        else els.push(h('text', { key: 'l' + i, x: X + (e.dev < 0 ? -6 : 6), y: base - hh + 4 - (e.top ? 0 : 6), textAnchor: e.dev < 0 ? 'end' : 'start', fontSize: 11, fontFamily: 'IBM Plex Mono', fill: e.top ? 'var(--ink-2)' : c }, label));
      }
    });
    els.push(h('line', { key: 'ref', x1: x(0), x2: x(0), y1: compact ? 0 : top - 12, y2: base, stroke: 'var(--brass)', strokeWidth: compact ? 1.25 : 1.5 }));
    if (!compact) els.push(h('text', { key: 'rl', x: x(0), y: top - 18, textAnchor: 'middle', fontSize: 11, fontFamily: 'IBM Plex Mono', fill: 'var(--brass-ink)' }, o.refLabel || 'agreed price'));
    return h('svg', { viewBox: `0 0 ${W} ${H + (compact ? 0 : 30)}`, width: '100%', style: { display: 'block' }, role: 'img', 'aria-label': `${sym}: ${a.n} exchanges by distance from the agreed price` }, els);
  }

  /* Trust gauge: semicircle 0–100 at true scale so 88 and 92 look close because they are. Band arcs: <60 unreliable, 60–79 watch, 80+ reliable. */
  function gauge(score, o = {}) {
    const W = o.w || 280, cx = W / 2, r = W * 0.42, cy = r + 10, H = cy + 22;
    const p = (v, rr = r) => { const t = Math.PI * (1 - v / 100); return [cx + rr * Math.cos(t), cy - rr * Math.sin(t)]; };
    const arc = (a, b, rr) => { const [x0, y0] = p(a, rr), [x1, y1] = p(b, rr); return `M${x0} ${y0} A${rr} ${rr} 0 0 1 ${x1} ${y1}`; };
    const els = [];
    [[0, 60, 'var(--verm)'], [60, 80, 'var(--ochre)'], [80, 100, 'var(--sage)']].forEach(([a, b, c], i) => els.push(h('path', { key: 'b' + i, d: arc(a + .4, b - .4, r), stroke: c, strokeWidth: 5, fill: 'none', opacity: .85 })));
    for (let v = 0; v <= 100; v += 2) { const major = v % 10 === 0; const [x0, y0] = p(v, r - 8), [x1, y1] = p(v, r - (major ? 18 : 12)); els.push(h('line', { key: 'k' + v, x1: x0, y1: y0, x2: x1, y2: y1, stroke: major ? 'var(--ink-2)' : 'var(--rule-strong)', strokeWidth: major ? 1.2 : .8 })); }
    [0, 60, 80, 100].forEach(v => { const [x, y] = p(v, r - 30); els.push(h('text', { key: 'n' + v, x, y: y + 4, textAnchor: 'middle', fontSize: W * 0.04, fontFamily: 'IBM Plex Mono', fill: 'var(--ink-3)' }, v)); });
    const [nx, ny] = p(score, r - 4);
    els.push(h('line', { key: 'nd', x1: cx, y1: cy, x2: nx, y2: ny, stroke: 'var(--ink)', strokeWidth: 2, strokeLinecap: 'round' }));
    els.push(h('circle', { key: 'hub', cx, cy, r: 6, fill: 'var(--brass)' }));
    els.push(h('line', { key: 'base', x1: cx - r - 4, x2: cx + r + 4, y1: cy + .5, y2: cy + .5, stroke: 'var(--rule-strong)' }));
    return h('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: { display: 'block', maxWidth: W }, role: 'img', 'aria-label': `Trust score ${score} of 100` }, els);
  }

  /* Benchmark vernier: CoinMarketCap's published price fixed at 0; our rebuilt price marked by its gap in bp. Tolerance ±25 bp. Accepts one or many readings. */
  function bench(items, o = {}) {
    items = Array.isArray(items) ? items : [items];
    const W = o.w || 640, D = o.domain || 60, T = 25, H = o.h || (items.length > 1 ? 118 : 104), pad = 18, y0 = H - 44;
    const x = (g) => pad + (g + D) / (2 * D) * (W - 2 * pad), els = [];
    els.push(h('rect', { key: 'tol', x: x(-T), y: 12, width: x(T) - x(-T), height: y0 - 12, fill: 'var(--sage)', opacity: .09 }));
    els.push(h('line', { key: 'ax', x1: pad, x2: W - pad, y1: y0 + .5, y2: y0 + .5, stroke: 'var(--rule-strong)' }));
    for (let g = -D; g <= D; g += 5) { const X = x(g), maj = g % 20 === 0; els.push(h('line', { key: 't' + g, x1: X, x2: X, y1: y0, y2: y0 + (maj ? 8 : 4), stroke: maj ? 'var(--ink-3)' : 'var(--rule-strong)' })); if (maj) els.push(h('text', { key: 'tl' + g, x: X, y: y0 + 22, textAnchor: 'middle', fontSize: 11, fontFamily: 'IBM Plex Mono', fill: 'var(--ink-3)' }, g === 0 ? '0' : (g < 0 ? M : '+') + Math.abs(g) + ' bp')); }
    [-T, T].forEach((g, i) => els.push(h('line', { key: 'te' + i, x1: x(g), x2: x(g), y1: 12, y2: y0, stroke: 'var(--sage)', strokeDasharray: '2 3', opacity: .8 })));
    els.push(h('path', { key: 'cmc', d: `M${x(0)} ${y0 + 1} l-6 10 h12 z`, fill: 'var(--ink)' }));
    els.push(h('line', { key: 'cl', x1: x(0), x2: x(0), y1: 8, y2: y0, stroke: 'var(--ink)', strokeWidth: 1 }));
    els.push(h('text', { key: 'clab', x: x(0), y: H - 4, textAnchor: 'middle', fontSize: 11, fontFamily: 'IBM Plex Sans', fill: 'var(--ink-2)' }, 'CoinMarketCap published'));
    const n = items.length;
    items.forEach((it, i) => {
      const X = x(Math.max(-D, Math.min(D, it.gap))), Y = n > 1 ? 20 + (i % 3) * ((y0 - 34) / 2) : y0 - 26, out = Math.abs(it.gap) > T;
      if (n === 1) {
        els.push(h('path', { key: 'm', d: `M${X} ${y0 - 1} l-7 -12 h14 z`, fill: 'var(--brass)' }));
        els.push(h('line', { key: 'mb', x1: x(0), x2: X, y1: y0 - 18, y2: y0 - 18, stroke: out ? 'var(--verm)' : 'var(--ink-2)', strokeWidth: 1 }));
        els.push(h('text', { key: 'mt', x: (x(0) + X) / 2, y: y0 - 24, textAnchor: 'middle', fontSize: 12, fontFamily: 'IBM Plex Mono', fill: out ? 'var(--verm)' : 'var(--ink)' }, bp(it.gap)));
      } else {
        els.push(h('line', { key: 'v' + i, x1: X, x2: X, y1: Y + 4, y2: y0, stroke: out ? 'var(--verm)' : 'var(--rule-strong)', strokeWidth: 1 }));
        els.push(h('circle', { key: 'd' + i, cx: X, cy: Y, r: 4, fill: out ? 'var(--verm)' : 'var(--brass)' }, h('title', null, `${it.s} ${bp(it.gap)}`)));
        if (out || it.label) els.push(h('text', { key: 'dl' + i, x: X > W - 90 ? X - 8 : X + 8, textAnchor: X > W - 90 ? 'end' : 'start', y: Y + 4, fontSize: 11, fontFamily: 'IBM Plex Mono', fill: out ? 'var(--verm)' : 'var(--ink-2)' }, `${it.s} ${bp(it.gap)}`));
      }
    });
    return h('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: { display: 'block' }, role: 'img', 'aria-label': 'Rebuilt price versus CoinMarketCap published price' }, els);
  }

  /* Concentration: 100 cells, one per percent of volume. The largest exchange fills its share; 90 of 100 filled reads as one voice. */
  function conc(share, o = {}) {
    const s = o.cell || 12, g = 2, n = Math.round(share * 100), W = 10 * (s + g) - g;
    const c = share >= .5 ? 'var(--verm)' : share >= .25 ? 'var(--ochre)' : 'var(--ink)';
    const els = []; for (let i = 0; i < 100; i++) { const col = i % 10, row = Math.floor(i / 10); els.push(h('rect', { key: i, x: col * (s + g), y: row * (s + g), width: s, height: s, fill: i < n ? c : 'transparent', stroke: i < n ? 'none' : 'var(--rule-strong)', strokeWidth: .75 })); }
    return h('svg', { viewBox: `0 0 ${W} ${W}`, width: o.px || W, height: o.px || W, style: { display: 'block', flex: 'none' }, role: 'img', 'aria-label': `${n}% of volume on the largest exchange` }, els);
  }

  /* History as readings, not a line: one dot per 30-minute reading on the true 0–100 scale. */
  function history(sym, o = {}) {
    const a = ASSETS.find(z => z.s === sym), r = rng(sym.length * 97 + 3), W = o.w || 640, H = o.h || 120, n = 65, lo = o.lo ?? 0;
    const vals = []; for (let i = 0; i < n; i++) vals.push(sym === 'BCH' ? (i < 50 ? 66 + gauss(r) * 2 : i < 58 ? 66 - (i - 50) * 3.2 : 38 + gauss(r)) : a.score + Math.round(gauss(r) * .7));
    const y = (v) => 8 + (1 - (v - lo) / (100 - lo)) * (H - 28), x = (i) => 4 + i / (n - 1) * (W - 8), els = [];
    [[80, 100, 'var(--sage)'], [60, 80, 'var(--ochre)'], [lo, 60, 'var(--verm)']].forEach(([a0, b, c], i) => { if (b > lo) els.push(h('rect', { key: 'b' + i, x: 0, width: W, y: y(b), height: y(Math.max(a0, lo)) - y(b), fill: c, opacity: .06 })); });
    [60, 80, 100].forEach(v => els.push(h('text', { key: 'g' + v, x: W, y: y(v) - 3, textAnchor: 'end', fontSize: 10, fontFamily: 'IBM Plex Mono', fill: 'var(--ink-3)' }, v)));
    vals.forEach((v, i) => els.push(h('circle', { key: i, cx: x(i), cy: y(v), r: 2, fill: 'var(--ink)' })));
    els.push(h('line', { key: 'ax', x1: 0, x2: W, y1: H - 20, y2: H - 20, stroke: 'var(--rule-strong)' }));
    els.push(h('text', { key: 'l0', x: 0, y: H - 4, fontSize: 10, fontFamily: 'IBM Plex Mono', fill: 'var(--ink-3)' }, '25 Sep'));
    els.push(h('text', { key: 'l1', x: W, y: H - 4, textAnchor: 'end', fontSize: 10, fontFamily: 'IBM Plex Mono', fill: 'var(--ink-3)' }, 'latest · 65 readings'));
    return h('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: { display: 'block' } }, els);
  }

  /* Logo mark: seven strokes around one taller centre stroke on a baseline. Favicon variant: five strokes. */
  const MARK7 = [.30, .48, .66, 1, .70, .46, .28], MARK5 = [.42, .68, 1, .64, .40];
  function mark(o = {}) {
    const hs = o.small ? MARK5 : MARK7, u = 10, sw = o.small ? 2.4 : 2, W = (hs.length - 1) * u + sw * 2, H = 44;
    const els = hs.map((v, i) => { const c = i === (hs.length - 1) / 2; return h('rect', { key: i, x: sw / 2 + i * u - (c ? sw * .75 : sw / 2) + sw / 2, y: H - 4 - v * (H - 6), width: c ? sw * 1.5 : sw, height: v * (H - 6), fill: c ? (o.centre || o.color || 'var(--brass)') : (o.color || 'var(--ink)') }); });
    els.push(h('rect', { key: 'base', x: 0, y: H - 2, width: W, height: 1.2, fill: o.color || 'var(--ink)' }));
    return h('svg', { viewBox: `0 0 ${W} ${H}`, height: o.size || 28, style: { display: 'block', flex: 'none' }, 'aria-hidden': 'true' }, els);
  }
  function favicon(o = {}) {
    const S = 16, bg = o.bg || 'var(--card)', ink = o.ink || 'var(--ink)', br = o.brass || 'var(--brass)', hs = [5, 9, 12, 8, 5];
    const els = [h('rect', { key: 'bg', width: S, height: S, rx: 2.5, fill: bg })];
    hs.forEach((v, i) => els.push(h('rect', { key: i, x: 2 + i * 2.6, y: 14 - v, width: i === 2 ? 2 : 1.4, height: v, fill: i === 2 ? br : ink })));
    return h('svg', { viewBox: `0 0 ${S} ${S}`, width: o.px || 16, height: o.px || 16, style: { display: 'block', imageRendering: 'pixelated' } }, els);
  }

  const WATCH = [
    { sev: 'high', kind: 'One exchange sets the price', s: 'BCH', what: '90% of trading is on Deepcoin', ev: 'Equivalent to ~1.2 equally-sized exchanges out of 121.', dur: '65 of 65 readings' },
    { sev: 'high', kind: 'Off-market, still counted', s: 'LTC', what: 'SunX is 22.3% below the market', ev: 'LTC/USDT · $1.8M traded in 24h. CoinMarketCap still counts this exchange.', dur: '65 of 65 readings' },
    { sev: 'high', kind: 'Off-market, still counted', s: 'BTC', what: 'Kraken is 20.7% below the market', ev: 'XBT/USD · $289.2M traded in 24h. Returned twice by the API with different prices.', dur: '65 of 65 readings' },
    { sev: 'high', kind: 'Off-market, still counted', s: 'DOT', what: 'SunX is 13.2% below the market', ev: 'DOT/USDT · $1.2M traded in 24h.', dur: '65 of 65 readings' },
    { sev: 'high', kind: 'Off-market, still counted', s: 'ETH', what: 'SunX is 7.8% below the market', ev: 'ETH/USDT · $5.0M traded in 24h.', dur: '65 of 65 readings' },
    { sev: 'high', kind: 'Off-market, still counted', s: 'SOL', what: 'Zoomex is 5.7% below the market', ev: 'SOL/USDT · $284.3M traded in 24h.', dur: 'latest reading' },
    { sev: 'watch', kind: 'Drifting', s: 'SOL', what: 'Deribit is 1.4% above the market', ev: 'SOL/USDC · $6.1M traded in 24h.', dur: 'latest reading' },
    { sev: 'watch', kind: 'Drifting', s: 'DOT', what: 'Deepcoin is 1.3% above the market', ev: 'DOT/USDT · $8.4M traded in 24h.', dur: 'latest reading' },
    { sev: 'watch', kind: 'Drifting', s: 'LINK', what: 'Deepcoin is 1.3% above the market', ev: 'LINK/USDT · $15.6M traded in 24h.', dur: 'latest reading' },
    { sev: 'watch', kind: 'Drifting', s: 'XRP', what: 'Deribit is 1.1% above the market', ev: 'XRP/USDC · $7.2M traded in 24h.', dur: 'latest reading' },
    { sev: 'watch', kind: 'Drifting', s: 'LTC', what: 'Deepcoin is 1.1% above the market', ev: 'LTC/USDT · $69.6M traded in 24h.', dur: 'latest reading' },
  ];
  const RWA = [
    { s: 'SPCX', name: 'SpaceX', bp: 4708, tokens: 11, liquid: 10, unpriced: 0 },
    { s: 'LLY', name: 'Eli Lilly', bp: 60, tokens: 6, liquid: 3, unpriced: 1 },
    { s: 'ORCL', name: 'Oracle', bp: 45, tokens: 7, liquid: 4, unpriced: 0 },
    { s: 'AMAT', name: 'Applied Materials', bp: 42, tokens: 7, liquid: 2, unpriced: 1 },
    { s: 'TSM', name: 'TSMC', bp: 39, tokens: 6, liquid: 3, unpriced: 0 },
    { s: 'MSFT', name: 'Microsoft', bp: 36, tokens: 9, liquid: 4, unpriced: 1 },
    { s: 'GOOGL', name: 'Alphabet', bp: 30, tokens: 10, liquid: 5, unpriced: 1 },
  ];

  const THEMES = {
    light: { '--paper': '#F2F1EC', '--card': '#FBFAF7', '--sunk': '#E9E7E0', '--ink': '#1B2027', '--ink-2': '#4A515B', '--ink-3': '#6E747C', '--rule': '#DEDBD2', '--rule-strong': '#BDB9AE', '--brass': '#A67C3D', '--brass-ink': '#86612A', '--sage': '#4F7A62', '--ochre': '#B8862B', '--ochre-ink': '#8A6417', '--verm': '#B8462F', '--muted': '#A3A49F' },
    dark: { '--paper': '#1D1B18', '--card': '#25231F', '--sunk': '#171513', '--ink': '#EDE9E1', '--ink-2': '#BDB7AB', '--ink-3': '#948E83', '--rule': '#35322C', '--rule-strong': '#524E45', '--brass': '#C9A064', '--brass-ink': '#D8B47C', '--sage': '#83B295', '--ochre': '#D6AC58', '--ochre-ink': '#DDB566', '--verm': '#E07A62', '--muted': '#6A665E' },
  };

  window.CC = { ASSETS, WATCH, RWA, THEMES, exchanges, field, gauge, bench, conc, history, mark, favicon, pct, bp, band };
})();
