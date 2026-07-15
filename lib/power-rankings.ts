import "server-only";
import raw from "@/data/power-rankings.json";
import { getTeam } from "./teams";
import type { TeamMeta } from "./types";

// TP's Power Rankings — the only source of truth is `data/power-rankings.json`.
// That file lives in the repo, so only someone with repo access (TP) can change
// the order; edit it and redeploy to publish a new ranking. Everyone viewing the
// site sees whatever order is committed.

export type PowerRankEntry = {
  rank: number;
  team: TeamMeta;
  note: string;
  tier: string;
};

export type PowerRankings = {
  updated: string;
  intro: string;
  entries: PowerRankEntry[];
};

export function getPowerRankings(): PowerRankings {
  const entries: PowerRankEntry[] = raw.ranking
    .map((r, i) => {
      const team = getTeam(r.teamId);
      if (!team) return null;
      return { rank: i + 1, team, note: r.note ?? "", tier: r.tier ?? "" };
    })
    .filter((e): e is PowerRankEntry => e !== null);

  return { updated: raw.updated, intro: raw.intro, entries };
}
