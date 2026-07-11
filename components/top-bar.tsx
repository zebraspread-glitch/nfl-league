"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useSettings } from "@/components/settings-provider";
import { getTeam } from "@/lib/teams";

const TITLES: Record<string, string> = {
  "/": "My Team",
  "/settings": "Settings",
  "/standings": "League",
  "/matchups": "Matchups",
  "/teams": "Ladder",
  "/history": "History",
  "/records": "Records",
  "/head-to-head": "Head to Head",
  "/games": "Every Game",
  "/drafts": "Draft Results",
  "/players": "Players",
  "/players/search": "Player Search",
  "/managers": "Managers",
  "/playoffs": "Playoffs",
  "/trades": "Trades",
  "/transactions": "Transactions",
  "/mock-draft": "Mock Draft",
  "/more": "More",
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/teams/")) return "Team";
  if (pathname.startsWith("/matchups/")) return "Matchup";
  if (pathname.startsWith("/games/")) return "Boxscore";
  if (pathname.startsWith("/players/")) return "Player Profile";
  if (pathname.startsWith("/records/")) return "Record Book";
  return "MGL";
}

export function TopBar() {
  const pathname = usePathname();
  const { teamId } = useSettings();
  const selectedTeam = teamId ? getTeam(teamId) : undefined;
  const isHome = pathname === "/";

  useEffect(() => {
    document.documentElement.style.setProperty("--topbar-height", isHome ? "9.4rem" : "3.5rem");
    return () => {
      document.documentElement.style.removeProperty("--topbar-height");
    };
  }, [isHome]);

  if (isHome) {
    return (
      <header
        className="fixed inset-x-0 top-0 z-30 mx-auto max-w-xl text-[#00284d]"
        style={{
          background: "var(--teal)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="flex h-[9.4rem] items-center justify-between px-8 pt-6">
          <Link
            href="/"
            aria-label="Home"
            className="grid h-16 w-16 place-items-center rounded-[14px] bg-[#0f9fba] text-[#00284d]"
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M3 10.8 12 3l9 7.8v9.7a.5.5 0 0 1-.5.5h-5.3v-6.4a.6.6 0 0 0-.6-.6H9.4a.6.6 0 0 0-.6.6V21H3.5a.5.5 0 0 1-.5-.5z" />
            </svg>
          </Link>

          <Link
            href="/settings"
            className="flex h-16 min-w-36 items-center justify-center gap-3 rounded-[14px] bg-[#0f9fba] px-5 font-cond text-[25px] font-bold leading-none text-[#00284d]"
          >
            <span className="max-w-28 truncate">{selectedTeam?.name ?? "Team"}</span>
            <svg width="25" height="15" viewBox="0 0 25 15" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m2 2 10.5 10.5L23 2" />
            </svg>
          </Link>

          <Link
            href="/settings"
            aria-label="Settings"
            className="relative grid h-16 w-16 place-items-center rounded-[14px] bg-[#003968] text-white"
          >
            <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-[#ff4a00]" />
            <span className="relative font-cond text-[36px] font-extrabold leading-none tracking-[-0.02em]">
              F<span className="absolute -bottom-1 -right-4 text-[25px] text-[#2ed466]">+</span>
            </span>
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header
      className="fixed inset-x-0 top-0 z-30 mx-auto max-w-xl text-white"
      style={{
        background: "linear-gradient(180deg, var(--teal) 0%, var(--teal-dark) 100%)",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="flex h-14 items-center justify-between px-3">
        <Link
          href="/"
          aria-label="Home"
          className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 transition-colors hover:bg-white/25"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11l9-8 9 8" />
            <path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" />
          </svg>
        </Link>

        <h1 className="font-cond text-xl font-semibold tracking-wide">{titleFor(pathname)}</h1>

        <Link
          href="/settings"
          aria-label="Settings"
          className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 transition-colors hover:bg-white/25"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
