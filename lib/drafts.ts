import { franchiseForName } from "./franchises";
import type { TeamMeta } from "./types";

export interface DraftIndexEntry {
  season: number;
  rounds: number;
  teams: number;
  picks: number;
}

interface RawDraftPick {
  season: number;
  round: number;
  pick: number;
  playerId: number;
  playerName: string;
  position: string;
  proTeam: string;
  status?: { label: string; title: string };
  fantasyTeamId: number;
  fantasyTeamName: string;
  managers: string[];
}

interface RawDraftSeason {
  season: number;
  rounds: number;
  teamCount: number;
  picks: RawDraftPick[];
}

export interface DraftPick extends RawDraftPick {
  team?: TeamMeta;
}

export interface DraftSeason {
  season: number;
  rounds: number;
  teamCount: number;
  picks: DraftPick[];
}

const cache = new Map<number, DraftSeason>();

function hydratePick(pick: RawDraftPick): DraftPick {
  return { ...pick, team: franchiseForName(pick.fantasyTeamName) };
}

export async function getDraftIndex(): Promise<DraftIndexEntry[]> {
  try {
    const mod = await import("@/data/drafts/index.json");
    return mod.default as DraftIndexEntry[];
  } catch {
    return [];
  }
}

export async function getSeasonDraft(season: number): Promise<DraftSeason | null> {
  if (cache.has(season)) return cache.get(season)!;
  try {
    const mod = await import(`@/data/drafts/${season}.json`);
    const raw = mod.default as RawDraftSeason;
    const draft = {
      ...raw,
      picks: raw.picks.map(hydratePick),
    };
    cache.set(season, draft);
    return draft;
  } catch {
    return null;
  }
}
