"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TabIcon = "team" | "matchup" | "ladder" | "players" | "more";
type Tab = { href: string; label: string; match: (p: string) => boolean; icon: TabIcon };

const TABS: Tab[] = [
  {
    href: "/",
    label: "My Team",
    match: (p) => p === "/",
    icon: "team",
  },
  {
    href: "/matchups",
    label: "Matchup",
    match: (p) => p.startsWith("/matchups"),
    icon: "matchup",
  },
  {
    href: "/teams",
    label: "Ladder",
    match: (p) => p.startsWith("/teams"),
    icon: "ladder",
  },
  {
    href: "/players",
    label: "Players",
    match: (p) => p.startsWith("/players"),
    icon: "players",
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
      p.startsWith("/playoff-simulator") ||
      p.startsWith("/newspaper") ||
      p.startsWith("/standings") ||
      p.startsWith("/managers") ||
      p.startsWith("/history") ||
      p.startsWith("/records") ||
      p.startsWith("/head-to-head") ||
      p.startsWith("/power-rankings") ||
      p.startsWith("/keepers"),
    icon: "more",
  },
];

function NavIcon({ icon, active }: { icon: TabIcon; active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-7 w-9 place-items-center rounded-full transition-all ${
        active
          ? "bg-teal/10 text-teal shadow-[inset_0_0_0_1px_rgba(22,167,198,0.18)]"
          : "text-text-dim group-hover:bg-section group-hover:text-text-muted"
      }`}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="overflow-visible"
      >
        <IconPaths icon={icon} />
      </svg>
    </span>
  );
}

function IconPaths({ icon }: { icon: TabIcon }) {
  switch (icon) {
    case "team":
      return (
        <>
          <path
            d="M8.8 3.4 4.9 5.1 3.4 8.8l3.2 1.5L8.2 8v12.5h7.6V8l1.6 2.3 3.2-1.5-1.5-3.7-3.9-1.7a3.3 3.3 0 0 1-6.4 0Z"
            fill="currentColor"
            fillOpacity="0.12"
          />
          <path d="M8.8 3.4 4.9 5.1 3.4 8.8l3.2 1.5L8.2 8v12.5h7.6V8l1.6 2.3 3.2-1.5-1.5-3.7-3.9-1.7" />
          <path d="M8.8 3.4a3.3 3.3 0 0 0 6.4 0" />
          <path d="M10 13h4" />
        </>
      );
    case "matchup":
      return (
        <>
          <path
            d="M4.5 16.7C3.3 13.1 5.2 8 8.8 5.4c3.5-2.6 8.5-2.6 10.7 1.9 1.2 3.6-.7 8.7-4.3 11.3-3.5 2.6-8.5 2.6-10.7-1.9Z"
            fill="currentColor"
            fillOpacity="0.12"
          />
          <path d="M4.5 16.7C3.3 13.1 5.2 8 8.8 5.4c3.5-2.6 8.5-2.6 10.7 1.9 1.2 3.6-.7 8.7-4.3 11.3-3.5 2.6-8.5 2.6-10.7-1.9Z" />
          <path d="M6.2 17.3 18 6.7" />
          <path d="m9.8 12.7 2 2.3" />
          <path d="m11.5 11.2 2 2.3" />
          <path d="m13.2 9.7 2 2.3" />
          <path d="M7.4 7.2c1 .4 2.1.4 3.2-.1" />
          <path d="M13.4 16.9c1.1-.5 2.2-.5 3.2-.1" />
        </>
      );
    case "ladder":
      return (
        <>
          <path d="M7.5 3.5 5.7 20.5" />
          <path d="m16.5 3.5 1.8 17" />
          <path d="M7 7h10" />
          <path d="M6.5 11h11" />
          <path d="M6.1 15h11.8" />
          <path d="M5.7 19h12.6" />
        </>
      );
    case "players":
      return (
        <>
          <path d="M12 5.1a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2Z" fill="currentColor" fillOpacity="0.12" />
          <path d="M12 5.1a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2Z" />
          <path d="M5.6 19.5c.8-3.2 3-5 6.4-5s5.6 1.8 6.4 5" />
          <path d="M5.8 8.4a2.2 2.2 0 1 0 0 4.4" />
          <path d="M18.2 8.4a2.2 2.2 0 1 1 0 4.4" />
          <path d="M3.4 18.2c.4-1.8 1.5-3 3.2-3.5" />
          <path d="M20.6 18.2c-.4-1.8-1.5-3-3.2-3.5" />
        </>
      );
    case "more":
      return (
        <>
          <circle cx="6" cy="12" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="18" cy="12" r="1.7" fill="currentColor" stroke="none" />
          <path d="M4.5 6.5h15" opacity="0.35" />
          <path d="M4.5 17.5h15" opacity="0.35" />
        </>
      );
  }
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl border-t border-border bg-card shadow-[0_-10px_30px_rgba(21,24,29,0.08)]">
      <div className="grid grid-cols-5">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`group flex min-h-[64px] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-semibold tracking-[0.08em] transition-colors ${
                active ? "text-teal" : "text-text-dim hover:text-text-muted"
              }`}
            >
              <NavIcon icon={t.icon} active={active} />
              <span className="font-cond uppercase">{t.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
