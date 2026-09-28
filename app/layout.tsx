import type { Metadata } from "next";
import Link from "next/link";
import { Instrument_Serif, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavLink } from "@/components/NavLink";
import { scoreHistory, anomalyRows } from "@/lib/data";
import { alerts } from "@/lib/alerts";
import "./globals.css";

const serif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

const title = "Consensus — how CoinMarketCap's price is made";
const description =
  "Every exchange's quote behind CoinMarketCap's price, recorded every 30 minutes. Who sets the price, who disagrees, and for how long.";

export const metadata: Metadata = {
  metadataBase: new URL('https://consensus-cmc.vercel.app'),
  title, description,
  openGraph: { title, description, url: '/', siteName: 'Consensus', type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
};

export const revalidate = 1800;

const nav = [
  ['/', 'Assets'],
  ['/alerts', 'Watchlist'],
  ['/rwa', 'Tokenised stocks'],
  ['/methodology', 'How this works'],
] as const;

// Blocking, pre-hydration: reads the visitor's saved theme (if any) so the page never flashes the
// wrong face. Absent an override, prefers-color-scheme in globals.css decides.
const noFlash = `try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  let watchCount: number | null = null;
  try {
    const [scores, anoms] = await Promise.all([scoreHistory(), anomalyRows()]);
    watchCount = alerts(scores, anoms).length;
  } catch { /* nav still renders without a count if data isn't up yet */ }

  return (
    <html lang="en" className={`${serif.variable} ${plexSans.variable} ${plexMono.variable} h-full`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: noFlash }} /></head>
      <body className="flex min-h-full flex-col bg-bg font-sans text-fg antialiased">
        <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 text-sm">
            <Link href="/" className="flex items-center gap-2.5 text-fg">
              <Logo size={20} />
              <span className="font-serif text-xl leading-none">Consensus</span>
            </Link>
            <div className="ml-2 flex flex-wrap items-center gap-x-5 gap-y-2">
              {nav.map(([href, label]) => (
                <NavLink key={href} href={href}>
                  {label}{href === '/alerts' && watchCount !== null ? ` ${watchCount}` : ''}
                </NavLink>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-4">
              <a href="https://github.com/ketutezraugm/consensus-cmc" className="hidden text-fg-2 transition-colors hover:text-fg sm:inline">Source</a>
              <ThemeToggle />
            </div>
          </nav>
        </header>
        {children}
        <footer className="mt-16 border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-fg-2">
            <span className="flex items-center gap-2"><Logo size={13} /> Built on the CoinMarketCap Pro API for the Build with CMC hackathon. Shows what the API returns, not how CoinMarketCap computes its published price.</span>
            <span className="flex gap-4 whitespace-nowrap">
              <Link href="/methodology" className="underline decoration-accent underline-offset-2 hover:text-fg">How this works</Link>
              <a href="https://github.com/ketutezraugm/consensus-cmc" className="underline decoration-accent underline-offset-2 hover:text-fg">Source on GitHub</a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
