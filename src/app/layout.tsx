import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "PayPilot AI — Intelligent Commerce",
  description: "Smarter shopping. Clearer decisions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="antialiased">
        <div className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-[rgba(11,16,38,0.8)] bg-[rgba(11,16,38,0.95)] border-b border-[#20284a]">
          <div className="mx-auto max-w-7xl px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#4f9bff] to-[#7c3fff] flex items-center justify-center text-white font-semibold shadow-[0_0_80px_rgba(79,155,255,0.25)]">PP</div>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white">PayPilot AI</h1>
                <p className="text-xs text-[#9aa3c0]">Intelligent Commerce · PayPal Sandbox</p>
              </div>
            </Link>
            <nav className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm">
              <Link href="/" className="px-3 py-1.5 rounded-lg text-[#e6e8ee] hover:bg-[#121a33] transition-colors">Discover</Link>
              <Link href="/assistant" className="px-3 py-1.5 rounded-lg text-[#e6e8ee] hover:bg-[#121a33] transition-colors">AI Assistant</Link>
              <Link href="/catalog" className="px-3 py-1.5 rounded-lg text-[#e6e8ee] hover:bg-[#121a33] transition-colors">Catalog</Link>
              <Link href="/orders" className="px-3 py-1.5 rounded-lg text-[#e6e8ee] hover:bg-[#121a33] transition-colors">Orders</Link>
              <Link href="/checkout" className="relative px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#4f9bff] to-[#7c3fff] text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.995] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4f9bff] animate-glow">
                Checkout
              </Link>
            </nav>
          </div>
        </div>
        <main className="mx-auto max-w-7xl px-4 py-8 animate-fade-up">{children}</main>
        <footer className="border-t border-[#20284a] mt-12">
          <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-[#9aa3c0] flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>PayPilot AI — Demo only. PayPal Sandbox test payments. Prices in USD.</span>
            <span>© 2026 Darshan Kachare</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
