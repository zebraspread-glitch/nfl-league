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
    label: "Scores",
    match: (p) => p === "/",
    icon: I("M3 11l9-8 9 8|M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10"),
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
    href: "/standings",
    label: "League",
    match: (p) => p.startsWith("/standings"),
    icon: I("M8 21h8|M12 17v4|M7 4h10v5a5 5 0 0 1-10 0V4z|M17 5h3v2a3 3 0 0 1-3 3|M7 5H4v2a3 3 0 0 0 3 3"),
  },
  {
    href: "/more",
    label: "More",
    match: (p) =>
      p === "/more" ||
      p.startsWith("/games") ||
      p.startsWith("/drafts") ||
      p.startsWith("/trades") ||
      p.startsWith("/transactions") ||
      p.startsWith("/playoffs") ||
      p.startsWith("/players") ||
      p.startsWith("/managers") ||
      p.startsWith("/history") ||
      p.startsWith("/records") ||
      p.startsWith("/head-to-head"),
    icon: I("M4 6h16|M4 12h16|M4 18h16"),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl border-t border-border bg-white">
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
