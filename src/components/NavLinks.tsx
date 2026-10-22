"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type NavItem = { href: string; label: string };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/** Primary inline links. */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative shrink-0 rounded-lg px-2 py-1.5 text-xs transition-all duration-300 sm:px-2.5 sm:text-sm ${
              active ? "text-text" : "text-muted hover:bg-line hover:text-text"
            }`}
          >
            {item.label}
            {active ? (
              <span className="absolute inset-x-1.5 -bottom-px h-px bg-gradient-to-r from-accent to-accent-2" />
            ) : null}
          </Link>
        );
      })}
    </>
  );
}

/**
 * Accessible "More" dropdown. Closes on link click, outside click, Escape,
 * and route change. Positioned absolutely so it is never clipped.
 */
export function NavMenu({ items, label = "More" }: { items: NavItem[]; label?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const anyChildActive = items.some((i) => isActive(pathname, i.href));

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors sm:px-2.5 sm:text-sm ${
          open || anyChildActive ? "bg-line text-text" : "text-muted hover:bg-line hover:text-text"
        }`}
      >
        {label}
        <span className={`inline-block transition-transform duration-300 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-48 origin-top-right overflow-hidden rounded-xl border border-line-strong glass shadow-2xl animate-pop"
        >
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`block px-3.5 py-2 text-sm transition-colors ${
                  active ? "bg-accent/10 text-accent" : "text-muted hover:bg-line hover:text-text"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
