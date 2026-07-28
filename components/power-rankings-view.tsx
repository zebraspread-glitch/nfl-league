"use client";

import { useState } from "react";
import type { PowerRankings } from "@/lib/power-rankings";
import { Card, Hexagon, SectionHeader, TeamAvatar, TeamLink, rankBadgeTone } from "@/components/ui";
import { usePowerRankingPreviousRanks } from "@/components/power-rankings-seen";

type Mode = "tp" | "ai";

export default function PowerRankingsView({
  tp,
  ai,
}: {
  tp: PowerRankings;
  ai: PowerRankings;
}) {
  const [mode, setMode] = useState<Mode>("tp");
  const active = mode === "tp" ? tp : ai;
  const previousRanks = usePowerRankingPreviousRanks(mode, active.version, active.entries);

  const updatedLabel = new Date(active.updated + "T00:00:00").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // Group consecutive entries by tier, preserving order.
  const groups: { tier: string; entries: PowerRankings["entries"] }[] = [];
  for (const e of active.entries) {
    const last = groups[groups.length - 1];
    if (last && last.tier === e.tier) last.entries.push(e);
    else groups.push({ tier: e.tier, entries: [e] });
  }

  return (
    <div>
      {/* Toggle between TP's and the AI's rankings */}
      <div className="mb-3 flex rounded-full bg-section p-1">
        {(["tp", "ai"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-full px-4 py-2 font-cond text-sm font-semibold uppercase tracking-wide transition-colors ${
              mode === m ? "bg-card text-text shadow-sm" : "text-text-muted"
            }`}
          >
            {m === "tp" ? "TP's Rankings" : "AI Rankings"}
          </button>
        ))}
      </div>

      {active.intro && <p className="mb-2 px-1 text-sm text-text-muted">{active.intro}</p>}
      <div className="mb-2 px-1 font-cond text-xs font-semibold uppercase tracking-widest text-text-muted">
        Updated {updatedLabel}
      </div>

      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.tier || "_"}>
            {g.tier && <SectionHeader>{g.tier}</SectionHeader>}
            <Card className={g.tier ? "rounded-t-none" : ""}>
              {g.entries.map((e, i) => (
                <div
                  key={e.team.id}
                  className={`flex items-center gap-3 px-3 py-3 ${i % 2 ? "bg-card" : "bg-row"}`}
                >
                  <div className="flex w-14 shrink-0 items-center gap-1">
                    <Hexagon value={e.rank} tone={rankBadgeTone(e.rank)} />
                    <RankMovement rank={e.rank} previousRank={previousRanks[String(e.team.id)]} />
                  </div>
                  <TeamAvatar team={e.team} size="md" />
                  <div className="min-w-0 flex-1">
                    {e.team.id > 0 ? (
                      <TeamLink team={e.team} className="font-cond text-lg font-semibold leading-tight">
                        {e.team.name}
                      </TeamLink>
                    ) : (
                      <div className="font-cond text-lg font-semibold leading-tight">{e.team.name}</div>
                    )}
                    {e.team.manager && <div className="text-xs text-text-muted">{e.team.manager}</div>}
                    {e.note && <div className="mt-0.5 text-sm text-text">{e.note}</div>}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        ))}
      </div>

      <p className="px-1 pt-3 text-xs text-text-dim">
        {mode === "tp"
          ? "These are TP's personal rankings. Only TP can change the order."
          : "AI ranking for the 2026 season, based on kept players and recent form. TP has no hand in this one."}
      </p>
    </div>
  );
}

function RankMovement({ rank, previousRank }: { rank: number; previousRank?: number }) {
  if (!previousRank || previousRank === rank) return <span className="w-5" aria-hidden="true" />;

  const movedUp = previousRank > rank;
  const spots = Math.abs(previousRank - rank);

  return (
    <span
      title={`${movedUp ? "Up" : "Down"} ${spots} from #${previousRank}`}
      className={`inline-flex w-5 items-center justify-center gap-0.5 font-cond text-xs font-bold ${
        movedUp ? "text-up" : "text-down"
      }`}
    >
      <svg
        aria-hidden="true"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {movedUp ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}
      </svg>
      <span>{spots}</span>
    </span>
  );
}
