'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usd } from '@/lib/fmt';
import { cmpRwa, RWA_DEFAULT_DIR, type RwaSortKey } from '@/lib/sort';

export type RwaRow = { symbol: string; type: string; r: { dispersionBps: number; tokens: number; liquid: number; untracked: number; mcap: number } };
const toSortable = (x: RwaRow) => ({ symbol: x.symbol, dispersionBps: x.r.dispersionBps, tokens: x.r.tokens, mcap: x.r.mcap });

const GRID = 'sm:grid-cols-[260px_110px_170px_minmax(0,1fr)]';

const Row = ({ symbol, type, r }: RwaRow) => (
  <Link key={symbol} href={`/rwa/${symbol}`} className={`grid grid-cols-1 gap-1.5 border-b border-line py-3.5 transition-colors hover:bg-raised sm:items-center sm:gap-4 ${GRID}`}>
    <div className="flex items-baseline gap-2.5 truncate">
      <span className="num text-[15px] font-medium text-fg">{symbol}</span>
      <span className="truncate text-[13px] text-fg-2">{type}</span>
    </div>
    <span className="num text-[15px] font-medium" style={{ color: r.dispersionBps > 100 ? 'var(--color-bad)' : 'var(--color-fg)' }}>{(r.dispersionBps / 100).toFixed(2)}%</span>
    <span className="num text-[13px] text-fg-2">
      {r.tokens} tokens &middot; {r.liquid} liquid{r.untracked ? ` · ${r.untracked} no price` : ''}
    </span>
    <span className="num text-[13px] text-fg-2">{usd(r.mcap)} tokenised</span>
  </Link>
);

type Sort = { key: RwaSortKey; dir: 1 | -1 };

function Th({ label, k, sort, onClick }: { label: string; k: RwaSortKey; sort: Sort; onClick: (k: RwaSortKey) => void }) {
  const active = sort.key === k;
  return (
    <button type="button" onClick={() => onClick(k)} className={`flex items-center gap-1 text-left text-xs hover:text-fg ${active ? 'text-fg' : 'text-fg-2'}`}>
      {label}{active && <span aria-hidden>{sort.dir === 1 ? '▲' : '▼'}</span>}
    </button>
  );
}

export function RwaList({ shown, rest, restCeiling }: { shown: RwaRow[]; rest: RwaRow[]; restCeiling: number }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>({ key: 'disagreement', dir: -1 });
  const toggleSort = (key: RwaSortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: RWA_DEFAULT_DIR[key] }));

  const needle = q.trim().toUpperCase();
  const all = [...shown, ...rest];
  const isDefault = sort.key === 'disagreement' && sort.dir === -1 && !needle;
  const base = needle ? all.filter((x) => x.symbol.includes(needle) || x.type.toUpperCase().includes(needle)) : all;
  const sorted = isDefault ? null : [...base].sort((a, b) => cmpRwa(toSortable(a), toSortable(b), sort.key) * sort.dir);

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

      <div className={`mt-4 hidden gap-4 border-b border-line pb-2.5 sm:grid ${GRID}`}>
        <Th label="Asset" k="symbol" sort={sort} onClick={toggleSort} />
        <Th label="Disagreement" k="disagreement" sort={sort} onClick={toggleSort} />
        <Th label="Tokens" k="tokens" sort={sort} onClick={toggleSort} />
        <Th label="Market cap" k="mcap" sort={sort} onClick={toggleSort} />
      </div>

      {sorted ? (
        <div className="flex flex-col">
          {sorted.length === 0 && <p className="border-b border-line py-6 text-sm text-fg-2">No assets match &ldquo;{q}&rdquo;.</p>}
          {sorted.map((row) => <Row key={row.symbol} {...row} />)}
        </div>
      ) : (
        <>
          <div className="flex flex-col">{shown.map((row) => <Row key={row.symbol} {...row} />)}</div>
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
