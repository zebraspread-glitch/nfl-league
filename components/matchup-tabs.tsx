"use client";

import { useState, type ReactNode } from "react";

/** Tab switcher for the matchup page: keeps every panel mounted (they are
 *  server-rendered nodes passed in as props) and toggles visibility. The replay
 *  panel only exists once a matchup has been played, so the third tab appears
 *  with it. */
export function MatchupTabs({ teams, preview, replay }: { teams: ReactNode; preview: ReactNode; replay?: ReactNode }) {
  const [tab, setTab] = useState<"teams" | "preview" | "replay">("teams");

  const tabClass = (active: boolean) =>
    `h-10 rounded-lg font-cond text-sm font-bold uppercase tracking-wide transition-colors ${
      active ? "bg-teal text-white" : "border border-border bg-card text-text-muted hover:bg-card-hover"
    }`;

  return (
    <div>
      <div className={`mt-3 grid gap-2 ${replay ? "grid-cols-3" : "grid-cols-2"}`}>
        <button type="button" onClick={() => setTab("teams")} className={tabClass(tab === "teams")}>
          Teams
        </button>
        <button type="button" onClick={() => setTab("preview")} className={tabClass(tab === "preview")}>
          Preview
        </button>
        {replay && (
          <button type="button" onClick={() => setTab("replay")} className={tabClass(tab === "replay")}>
            Replay
          </button>
        )}
      </div>

      <div className={tab === "teams" ? "" : "hidden"}>{teams}</div>
      <div className={tab === "preview" ? "" : "hidden"}>{preview}</div>
      {replay && <div className={tab === "replay" ? "" : "hidden"}>{replay}</div>}
    </div>
  );
}
