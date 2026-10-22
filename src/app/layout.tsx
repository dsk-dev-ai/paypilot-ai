import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { NavLinks, NavMenu, type NavItem } from "@/components/NavLinks";
import { AmbientBackground } from "@/components/motion/AmbientBackground";

export const metadata: Metadata = {
  title: "Mandate — Verifiable Agentic Checkout",
  description:
    "AI shopping agent whose purchases are bound to a human-approved, SHA-256 consent artifact and verified before PayPal capture.",
};

const primaryNav: NavItem[] = [
  { href: "/search", label: "Search" },
  { href: "/assistant", label: "Assistant" },
  { href: "/plan", label: "Plan" },
  { href: "/checkout", label: "Checkout" },
  { href: "/orders", label: "Orders" },
];

const moreNav: NavItem[] = [
  { href: "/mandate", label: "Policy" },
  { href: "/wishlist", label: "Saved" },
  { href: "/notifications", label: "Alerts" },
  { href: "/account", label: "Account" },
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
                M
              </span>
              <span className="hidden text-sm font-semibold tracking-tight sm:inline">
                <span className="text-gradient">Mandate</span>
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
              Mandate searches authorized sources and routes you to official retailers. Every purchase
              is bound to a human-approved consent hash, and we never automate retailer logins or claim
              cart changes we cannot verify.
            </p>
            <p className="flex items-center gap-2">
              <Link href="/help" className="transition-colors hover:text-muted">
                Help &amp; disclosures
              </Link>
              <span className="h-1 w-1 rounded-full bg-faint" />
              <span>v1.0.0</span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
