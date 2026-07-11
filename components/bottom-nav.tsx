"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; match: (p: string) => boolean; icon: React.ReactNode };

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const TABS: Tab[] = [
  {
    href: "/",
    label: "Team",
    match: (p) => p === "/",
    icon: (
      <svg width="34" height="34" viewBox="0 0 24 24" {...strokeProps}>
        <path d="M3 15c.8-5.3 4.6-9 9.4-9 3.6 0 6.4 1.8 8.1 4.8" />
        <path d="M4.2 14.5 9 17.2h7.3c1.4 0 2.4.9 2.8 2.3" />
        <path d="M7.3 10.7h4.2" />
      </svg>
    ),
  },
  {
    href: "/matchups",
    label: "Matchup",
    match: (p) => p.startsWith("/matchups"),
    icon: (
      <svg width="34" height="34" viewBox="0 0 24 24" {...strokeProps}>
        <path d="M5 19c5.9-.6 10.9-5.6 11.8-11.8" />
        <path d="M9.4 20.3C4.7 19.1 2.5 14.6 4.2 10.7 6 6.5 11 4.1 18.6 3.4c.5 7.6-1.9 12.6-6.1 14.4" />
        <path d="M7.8 14.8 14.8 7.8" />
      </svg>
    ),
  },
  {
    href: "/mock-draft",
    label: "Zone",
    match: (p) => p.startsWith("/mock-draft"),
    icon: (
      <span className="grid h-8 w-8 place-items-center rounded-b-md bg-current [clip-path:polygon(12%_0,88%_0,88%_62%,50%_100%,12%_62%)]">
        <span className="font-cond text-[13px] font-extrabold leading-none text-white">FZ</span>
      </span>
    ),
  },
  {
    href: "/players",
    label: "Players",
    match: (p) => p.startsWith("/players"),
    icon: (
      <svg width="34" height="34" viewBox="0 0 24 24" {...strokeProps}>
        <path d="M12 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
        <path d="M8.5 20 10 12h4l1.5 8" />
        <path d="m8 13-2 3.2" />
        <path d="m16 13 2 3.2" />
      </svg>
    ),
  },
  {
    href: "/standings",
    label: "League",
    match: (p) =>
      p.startsWith("/standings") ||
      p.startsWith("/teams") ||
      p.startsWith("/settings") ||
      p.startsWith("/more") ||
      p.startsWith("/games") ||
      p.startsWith("/drafts") ||
      p.startsWith("/trades") ||
      p.startsWith("/transactions") ||
      p.startsWith("/playoffs") ||
      p.startsWith("/managers") ||
      p.startsWith("/history") ||
      p.startsWith("/records") ||
      p.startsWith("/head-to-head"),
    icon: (
      <svg width="34" height="34" viewBox="0 0 24 24" {...strokeProps}>
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
        <path d="M17 5h3v2a3 3 0 0 1-3 3" />
        <path d="M7 5H4v2a3 3 0 0 0 3 3" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl border-t border-[#e4e4e4] bg-white">
      <div className="grid h-[76px] grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-1 font-cond text-[16px] font-bold uppercase leading-none tracking-wide transition-colors ${
                active ? "text-[#00284d]" : "text-[#a5a7ac] hover:text-[#6f737b]"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
