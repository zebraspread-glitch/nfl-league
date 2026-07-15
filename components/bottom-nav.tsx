"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; match: (p: string) => boolean; icon: React.ReactNode };

const I = (d: string) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d.split("|").map((p, i) => (
      <path key={i} d={p} />
    ))}
  </svg>
);

const TABS: Tab[] = [
  {
    href: "/",
    label: "My Team",
    match: (p) => p === "/",
    // Jersey / team shirt
    icon: I("M9 3 4 6l2 4 3-2v11h6V8l3 2 2-4-5-3|M9 3a3 2.5 0 0 0 6 0"),
  },
  {
    href: "/matchups",
    label: "Matchup",
    match: (p) => p.startsWith("/matchups"),
    // Head-to-head / versus arrows
    icon: I("M7 4 3 8l4 4|M3 8h13|M17 20l4-4-4-4|M21 16H8"),
  },
  {
    href: "/teams",
    label: "Ladder",
    match: (p) => p.startsWith("/teams"),
    // Ladder: two rails + rungs
    icon: I("M7 2v20|M17 2v20|M7 7h10|M7 12h10|M7 17h10"),
  },
  {
    href: "/players",
    label: "Players",
    match: (p) => p.startsWith("/players"),
    icon: I("M12 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z|M8.5 20 10 12h4l1.5 8|m8 13-2 3.2|m16 13 2 3.2"),
  },
  {
    href: "/more",
    label: "More",
    match: (p) =>
      p === "/more" ||
      p.startsWith("/settings") ||
      p.startsWith("/mock-draft") ||
      p.startsWith("/games") ||
      p.startsWith("/drafts") ||
      p.startsWith("/trades") ||
      p.startsWith("/transactions") ||
      p.startsWith("/playoffs") ||
      p.startsWith("/standings") ||
      p.startsWith("/managers") ||
      p.startsWith("/history") ||
      p.startsWith("/records") ||
      p.startsWith("/head-to-head") ||
      p.startsWith("/power-rankings") ||
      p.startsWith("/keepers"),
    icon: I("M4 6h16|M4 12h16|M4 18h16"),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl border-t border-border bg-card">
      <div className="grid grid-cols-5">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold tracking-wide transition-colors ${
                active ? "text-teal" : "text-text-dim hover:text-text-muted"
              }`}
            >
              {t.icon}
              <span className="font-cond uppercase">{t.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
