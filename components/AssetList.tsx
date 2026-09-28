'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { score } from '@/lib/consensus';
import { Dispersion, band } from './Charts';
import { pct } from '@/lib/fmt';

export type AssetRow = { symbol: string; name: string; venues: Parameters<typeof Dispersion>[0]['venues']; r: NonNullable<ReturnType<typeof score>>; pub: number | null };

export function AssetList({ rows }: { rows: AssetRow[] }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toUpperCase();
  const filtered = needle ? rows.filter((x) => x.symbol.includes(needle) || x.name.toUpperCase().includes(needle)) : rows;

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

      <div className="mt-4 hidden grid-cols-[170px_150px_minmax(0,1fr)_190px_96px] gap-6 border-b border-line pb-2.5 text-xs text-fg-2 sm:grid">
        <span>Asset</span><span>Trust</span><span>Exchanges by distance from the agreed price</span><span>Largest exchange</span><span className="text-right">vs published</span>
      </div>

      {filtered.length === 0 && <p className="border-b border-line py-6 text-sm text-fg-2">No assets match &ldquo;{q}&rdquo;.</p>}

      <div className="divide-y divide-line border-b border-line sm:border-t-0">
        {filtered.map(({ symbol, name, venues, r, pub }) => {
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
