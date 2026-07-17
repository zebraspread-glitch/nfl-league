"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/": "My Team",
  "/settings": "Settings",
  "/standings": "League",
  "/matchups": "Matchups",
  "/teams": "Ladder",
  "/history": "History",
  "/records": "Records",
  "/scoregami": "Scoregami",
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
  "/playoff-simulator": "Playoff Simulator",
  "/newspaper": "League Newspaper",
  "/more": "More",
  "/power-rankings": "Power Rankings",
  "/keepers": "Keepers Board",
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
  return (
    <header
      className="app-fixed-bar fixed inset-x-0 top-0 z-30 mx-auto max-w-xl text-white"
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
