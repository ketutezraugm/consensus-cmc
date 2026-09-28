'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { score } from '@/lib/consensus';
import { Dispersion, band } from './Charts';
import { pct } from '@/lib/fmt';
import { cmpAsset, ASSET_DEFAULT_DIR, type AssetSortKey } from '@/lib/sort';

export type AssetRow = { symbol: string; name: string; venues: Parameters<typeof Dispersion>[0]['venues']; r: NonNullable<ReturnType<typeof score>>; pub: number | null };

type Sort = { key: AssetSortKey; dir: 1 | -1 };
const toSortable = (x: AssetRow) => ({ symbol: x.symbol, confidence: x.r.confidence, share: x.r.top.share, pub: x.pub });

function Th({ label, k, sort, onClick, right }: { label: string; k: AssetSortKey; sort: Sort; onClick: (k: AssetSortKey) => void; right?: boolean }) {
  const active = sort.key === k;
  return (
    <button
      type="button"
      onClick={() => onClick(k)}
      className={`flex items-center gap-1 text-xs hover:text-fg ${active ? 'text-fg' : 'text-fg-2'} ${right ? 'justify-end text-right' : 'text-left'}`}
    >
      {label}{active && <span aria-hidden>{sort.dir === 1 ? '▲' : '▼'}</span>}
    </button>
  );
}

export function AssetList({ rows }: { rows: AssetRow[] }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>({ key: 'confidence', dir: 1 });
  const toggleSort = (key: AssetSortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: ASSET_DEFAULT_DIR[key] }));

  const needle = q.trim().toUpperCase();
  const filtered = needle ? rows.filter((x) => x.symbol.includes(needle) || x.name.toUpperCase().includes(needle)) : rows;
  const sorted = [...filtered].sort((a, b) => cmpAsset(toSortable(a), toSortable(b), sort.key) * sort.dir);

  return (
    <>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter by symbol or name…"
        aria-label="Filter assets by symbol or name"
        className="mt-4 w-full max-w-xs rounded border border-line bg-panel px-3 py-2 text-sm text-fg placeholder:text-fg-2 focus:border-accent focus:outline-none"
      />

      <div className="mt-4 hidden grid-cols-[170px_150px_minmax(0,1fr)_190px_96px] gap-6 border-b border-line pb-2.5 sm:grid">
        <Th label="Asset" k="symbol" sort={sort} onClick={toggleSort} />
        <Th label="Trust" k="confidence" sort={sort} onClick={toggleSort} />
        <span className="text-xs text-fg-2">Exchanges by distance from the agreed price</span>
        <Th label="Largest exchange" k="share" sort={sort} onClick={toggleSort} />
        <Th label="vs published" k="pub" sort={sort} onClick={toggleSort} right />
      </div>

      {sorted.length === 0 && <p className="border-b border-line py-6 text-sm text-fg-2">No assets match &ldquo;{q}&rdquo;.</p>}

      <div className="divide-y divide-line border-b border-line sm:border-t-0">
        {sorted.map(({ symbol, name, venues, r, pub }) => {
          const b = band(r.confidence);
          return (
            <Link key={symbol} href={`/${symbol}`} className="grid grid-cols-1 gap-3 py-4 transition-colors hover:bg-raised sm:grid-cols-[170px_150px_minmax(0,1fr)_190px_96px] sm:items-center sm:gap-6">
              <div className="flex items-baseline gap-2.5 truncate">
                <span className="num text-[15px] font-medium text-fg">{symbol}</span>
                <span className="truncate text-[13px] text-fg-2">{name}</span>
              </div>
              <div className="num flex items-baseline gap-2">
                <span className="text-lg text-fg">{r.confidence}</span>
                <span className="text-xs" style={{ color: b.c }}>{b.word}</span>
              </div>
              <Dispersion venues={venues} refPrice={r.ref} h={40} compact />
              <div className="flex items-baseline gap-2 text-[13px] text-fg-2">
                <span className="truncate">{r.top.name}</span>
                <span className="num" style={{ color: r.top.share >= 0.5 ? 'var(--color-bad)' : 'var(--color-fg)' }}>{pct(r.top.share, 0)}</span>
              </div>
              <div className="num text-right text-[13px]" style={{ color: pub !== null && Math.abs(pub) > 25 ? 'var(--color-bad)' : 'var(--color-fg-2)' }}>
                {pub !== null ? `${pub < 0 ? '−' : '+'}${Math.round(Math.abs(pub))} bp` : ''}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
