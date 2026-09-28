'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const OTHER_TOP_LEVEL = ['/alerts', '/rwa', '/methodology', '/anomalies'];

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  // "/" also covers a bare asset page like /BTC, since that's still the Assets section.
  const active = href === '/'
    ? pathname === '/' || !OTHER_TOP_LEVEL.some((p) => pathname === p || pathname.startsWith(`${p}/`))
    : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} className={active ? 'text-fg shadow-[inset_0_-1.5px_0_var(--color-accent)] pb-1.5' : 'text-fg-2 transition-colors hover:text-fg'}>
      {children}
    </Link>
  );
}
