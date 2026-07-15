import "server-only";
import tpRaw from "@/data/power-rankings.json";
import aiRaw from "@/data/power-rankings-ai.json";
import { getTeam } from "./teams";
import type { TeamMeta } from "./types";

// Two rankings, same shape:
//  - TP's — the only source of truth is `data/power-rankings.json`. It lives in
//    the repo, so only someone with repo access (TP) can change the order.
//  - AI's — `data/power-rankings-ai.json`, a model-generated ranking derived
//    from the league's 2021-2025 records, titles, scoring and recent trend.
//    Regenerated on request (ask Claude to re-run it), not on every page load.

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

type RawRankings = {
  updated: string;
  intro: string;
  ranking: { teamId: number; note?: string; tier?: string }[];
};

function build(raw: RawRankings): PowerRankings {
  const entries: PowerRankEntry[] = raw.ranking
    .map((r, i) => {
      const team = getTeam(r.teamId);
      if (!team) return null;
      return { rank: i + 1, team, note: r.note ?? "", tier: r.tier ?? "" };
    })
    .filter((e): e is PowerRankEntry => e !== null);

  return { updated: raw.updated, intro: raw.intro, entries };
}

export function getPowerRankings(): PowerRankings {
  return build(tpRaw);
}

export function getAiPowerRankings(): PowerRankings {
  return build(aiRaw);
}
