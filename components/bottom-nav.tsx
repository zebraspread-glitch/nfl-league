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
    icon: I("M12 17.3l-5.4 3.3 1.5-6.2L3 10.2l6.3-.5L12 4l2.7 5.7 6.3.5-5.1 4.2 1.5 6.2z"),
  },
  {
    href: "/matchups",
    label: "Matchup",
    match: (p) => p.startsWith("/matchups"),
    icon: I("M2 12h20|M6 8v8|M18 8v8|M12 6v12"),
  },
  {
    href: "/teams",
    label: "Ladder",
    match: (p) => p.startsWith("/teams"),
    icon: I("M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8|M23 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75"),
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
