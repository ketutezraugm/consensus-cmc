'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usd } from '@/lib/fmt';

export type RwaRow = { symbol: string; type: string; r: { dispersionBps: number; tokens: number; liquid: number; untracked: number; mcap: number } };

const Row = ({ symbol, type, r }: RwaRow) => (
  <Link key={symbol} href={`/rwa/${symbol}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 border-b border-line py-3.5 transition-colors hover:bg-raised sm:grid-cols-[280px_140px_minmax(0,1fr)]">
    <div className="flex items-baseline gap-2.5 truncate">
      <span className="num text-[15px] font-medium text-fg">{symbol}</span>
      <span className="truncate text-[13px] text-fg-2">{type}</span>
    </div>
    <span className="num text-right text-[15px] font-medium sm:text-left" style={{ color: r.dispersionBps > 100 ? 'var(--color-bad)' : 'var(--color-fg)' }}>{(r.dispersionBps / 100).toFixed(2)}%</span>
    <span className="col-span-2 text-[13px] text-fg-2 sm:col-span-1">
      {r.tokens} tokens &middot; {r.liquid} liquid{r.untracked ? ` · ${r.untracked} with no price yet` : ''} &middot; {usd(r.mcap)} tokenised
    </span>
  </Link>
);

export function RwaList({ shown, rest, restCeiling }: { shown: RwaRow[]; rest: RwaRow[]; restCeiling: number }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toUpperCase();
  const all = [...shown, ...rest];
  const filtered = needle ? all.filter((x) => x.symbol.includes(needle) || x.type.toUpperCase().includes(needle)) : null;

  return (
    <>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter by symbol or type…"
        aria-label="Filter tokenised assets by symbol or type"
        className="mt-4 w-full max-w-xs rounded border border-line bg-panel px-3 py-2 text-sm text-fg placeholder:text-fg-2 focus:border-accent focus:outline-none"
      />

      {filtered ? (
        <div className="mt-4 flex flex-col">
          {filtered.length === 0 && <p className="border-b border-line py-6 text-sm text-fg-2">No assets match &ldquo;{q}&rdquo;.</p>}
          {filtered.map((row) => <Row key={row.symbol} {...row} />)}
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-col">{shown.map((row) => <Row key={row.symbol} {...row} />)}</div>
          {rest.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer border-b border-line py-3.5 text-sm text-fg underline decoration-accent underline-offset-2">
                {rest.length} more assets, each with issuers within {(restCeiling / 100).toFixed(2)}% of each other
              </summary>
              <div className="flex flex-col">{rest.map((row) => <Row key={row.symbol} {...row} />)}</div>
            </details>
          )}
        </>
      )}
    </>
  );
}
