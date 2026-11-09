import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { NavLinks, NavMenu, type NavItem } from "@/components/NavLinks";
import { AmbientBackground } from "@/components/motion/AmbientBackground";

/**
 * The app reads live cart/order state and must not serve year-old cached HTML
 * after a deploy. Every page is dynamic; API routes are already dynamic.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PayPilot AI — Accountable Purchasing Agent",
  description:
    "An AI purchasing agent with human-signed spend mandates, real PayPal sandbox capture, instant digital delivery, and a tamper-evident receipt ledger.",
};

const primaryNav: NavItem[] = [
  { href: "/store", label: "Store" },
  { href: "/agent", label: "Agent" },
  { href: "/plan", label: "Plan" },
  { href: "/checkout", label: "Checkout" },
  { href: "/orders", label: "Orders" },
];

const moreNav: NavItem[] = [
  { href: "/dashboard", label: "Control Room" },
  { href: "/verify", label: "Verify" },
  { href: "/mandate", label: "Policy" },
  { href: "/search", label: "Search" },
  { href: "/status", label: "Status" },
  { href: "/help", label: "Help" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <AmbientBackground />
        <header className="sticky top-0 z-40 border-b border-line glass animate-fade-in">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
            <Link href="/" className="group flex shrink-0 items-center gap-2.5">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent via-accent-2 to-accent-3 text-sm font-bold text-white shadow-[0_4px_18px_rgba(109,141,255,0.45)] transition-transform duration-300 group-hover:scale-105">
                P
              </span>
              <span className="hidden text-sm font-semibold tracking-tight sm:inline">
                PayPilot <span className="text-gradient">AI</span>
              </span>
            </Link>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
              <nav className="hidden min-w-0 items-center gap-0.5 overflow-x-auto md:flex md:gap-1">
                <NavLinks items={primaryNav} />
              </nav>
              <NavMenu items={[...primaryNav, ...moreNav]} label="Menu" />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
        <footer className="mt-8 border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="max-w-xl">
              PayPilot is an accountable purchasing agent. The AI proposes, a deterministic mandate decides,
              a human signs the exact cart, and real PayPal sandbox funds move — with instant delivery and a
              tamper-evident receipt you can recompute.
            </p>
            <p className="flex items-center gap-2">
              <Link href="/verify" className="transition-colors hover:text-muted">
                Verify a receipt
              </Link>
              <span className="h-1 w-1 rounded-full bg-faint" />
              <span>v2.0.0</span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
