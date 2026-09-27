'use client';

import { useState } from 'react';

// Paper is the default face; dark is the same notebook under a desk lamp, opted into explicitly.
// A blocking inline script in <head> (see layout.tsx) sets data-theme before paint, so reading the
// DOM attribute directly in the initializer (rather than an effect) matches what's already on screen.
export function ThemeToggle() {
  const [dark, setDark] = useState(() => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark');

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
  };

  return (
    <button onClick={toggle} aria-label="Toggle dark mode" title="Toggle dark mode"
            className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-fg-2 transition-colors hover:border-line-strong hover:text-fg">
      <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden="true">
        <circle cx={8} cy={8} r={6.5} fill="none" stroke="currentColor" strokeWidth={1.3} />
        <path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill={dark ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.3} suppressHydrationWarning />
      </svg>
    </button>
  );
}
