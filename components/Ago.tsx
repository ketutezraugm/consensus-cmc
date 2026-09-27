'use client';

import { useEffect, useState } from 'react';
import { stamp } from '@/lib/fmt';

// Pages are cached between captures, so a relative time rendered on the server would freeze and become wrong.
// The server renders an absolute UTC time; the browser replaces it with the live relative one.
export function Ago({ iso, mode = 'ago' }: { iso: string; mode?: 'ago' | 'for' }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
      const span = m < 90 ? `${Math.max(m, 1)} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} days`;
      setText(mode === 'ago' ? (m < 1 ? 'just now' : `${span} ago`) : span);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [iso, mode]);
  return <span suppressHydrationWarning>{text ?? (mode === 'ago' ? stamp(iso) : '')}</span>;
}
