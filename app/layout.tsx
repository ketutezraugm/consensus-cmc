import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Consensus: how CoinMarketCap's price is made",
  description:
    "Per-venue analysis of perpetual-futures prices from the CoinMarketCap API: who sets the price, where venues disagree, and how that changes over time.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 text-sm">
            <Link href="/" className="font-semibold tracking-tight">Consensus</Link>
            <Link href="/" className="text-zinc-500 hover:text-foreground">Assets</Link>
            <Link href="/anomalies" className="text-zinc-500 hover:text-foreground">Off-market venues</Link>
            <a href="https://github.com/ketutezraugm/consensus-cmc" className="ml-auto text-zinc-500 hover:text-foreground">Source</a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
