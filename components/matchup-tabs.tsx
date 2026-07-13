"use client";

import { useState, type ReactNode } from "react";

/** Two-tab switcher for the matchup page: keeps both panels mounted (they are
 *  server-rendered nodes passed in as props) and toggles visibility. */
export function MatchupTabs({ teams, preview }: { teams: ReactNode; preview: ReactNode }) {
  const [tab, setTab] = useState<"teams" | "preview">("teams");

  const tabClass = (active: boolean) =>
    `h-10 rounded-lg font-cond text-sm font-bold uppercase tracking-wide transition-colors ${
      active ? "bg-teal text-white" : "border border-border bg-card text-text-muted hover:bg-card-hover"
    }`;

  return (
    <div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setTab("teams")} className={tabClass(tab === "teams")}>
          Teams
        </button>
        <button type="button" onClick={() => setTab("preview")} className={tabClass(tab === "preview")}>
          Preview
        </button>
      </div>

      <div className={tab === "teams" ? "" : "hidden"}>{teams}</div>
      <div className={tab === "preview" ? "" : "hidden"}>{preview}</div>
    </div>
  );
}
