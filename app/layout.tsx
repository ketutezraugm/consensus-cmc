import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Consensus — how CoinMarketCap's price is made",
  description:
    "Every perpetual-futures venue's quote, recorded every 30 minutes from the CoinMarketCap API. Who sets the price, who disagrees, and for how long.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-fg">
        <header className="sticky top-0 z-10 border-b border-line bg-bg/85 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3 text-sm">
            <Link href="/" className="font-semibold tracking-tight">
              Consensus<span className="ml-2 text-xs font-normal text-muted">CoinMarketCap API</span>
            </Link>
            <Link href="/" className="ml-2 text-muted transition-colors hover:text-fg">Assets</Link>
            <Link href="/alerts" className="text-muted transition-colors hover:text-fg">Alerts</Link>
            <Link href="/rwa" className="text-muted transition-colors hover:text-fg">Tokenised assets</Link>
            <Link href="/anomalies" className="text-muted transition-colors hover:text-fg">Off-market venues</Link>
            <a href="https://github.com/ketutezraugm/consensus-cmc" className="ml-auto text-muted transition-colors hover:text-fg">Source</a>
          </nav>
        </header>
        {children}
        <footer className="mt-16 border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-6 text-xs text-muted">
            Built on the CoinMarketCap Pro API for the Build with CMC hackathon. Shows what the API returns; it does not claim how CoinMarketCap
            computes its published price.
          </div>
        </footer>
      </body>
    </html>
  );
}
