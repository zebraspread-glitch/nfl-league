"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/": "Scoreboard",
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
  "/more": "More",
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/teams/")) return "Team";
  if (pathname.startsWith("/games/")) return "Boxscore";
  if (pathname.startsWith("/players/")) return "Player Profile";
  if (pathname.startsWith("/records/")) return "Record Book";
  return "MGL";
}

export function TopBar() {
  const pathname = usePathname();
  return (
    <header
      className="sticky top-0 z-30 text-white"
      style={{ background: "linear-gradient(180deg, var(--teal) 0%, var(--teal-dark) 100%)" }}
    >
      <div className="flex items-center justify-between px-3 py-3">
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

        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#0b2a33] font-cond text-sm font-bold">
          MGL
        </span>
      </div>
    </header>
  );
}
