import { franchiseForName } from "./franchises";
import type { TeamMeta } from "./types";

export interface DraftIndexEntry {
  season: number;
  rounds: number;
  teams: number;
  picks: number;
  /** Seeded keeper slots, on the Sleeper-era seasons that have them. */
  keepers?: number;
}

interface RawDraftPick {
  season: number;
  round: number;
  pick: number;
  /** Scraped NFL.com id — 2021-2025 only. */
  playerId?: number;
  /** Sleeper's own player id — 2026 on. The two schemes don't overlap, so a
   *  pick carries whichever its season was sourced from. */
  sleeperPlayerId?: string;
  playerName: string;
  position: string;
  proTeam: string;
  status?: { label: string; title: string };
  fantasyTeamId?: number;
  fantasyTeamName: string;
  /** Empty on Sleeper seasons, which fall back to the franchise's manager. */
  managers: string[];
  /** A kept player Sleeper seeded onto the board, not a live selection. */
  isKeeper?: boolean;
}

interface RawDraftSeason {
  season: number;
  rounds: number;
  teamCount: number;
  keepers?: number;
  picks: RawDraftPick[];
}

export interface DraftPick extends RawDraftPick {
  team?: TeamMeta;
}

export interface DraftSeason {
  season: number;
  rounds: number;
  teamCount: number;
  keepers?: number;
  picks: DraftPick[];
}

const cache = new Map<number, DraftSeason>();

function hydratePick(pick: RawDraftPick): DraftPick {
  return { ...pick, team: franchiseForName(pick.fantasyTeamName) };
}

/** The player's profile page, keyed by whichever id scheme the season used. */
export function playerHref(pick: DraftPick): string | undefined {
  const id = pick.sleeperPlayerId ?? pick.playerId;
  return id ? `/players/${id}` : undefined;
}

/** Who made the pick. Sleeper seasons ship no manager names of their own, so
 *  they read through to the curated franchise metadata. */
export function managerLabel(pick: DraftPick): string {
  if (pick.managers.length) return pick.managers.join(", ");
  return pick.team?.manager || "Unknown manager";
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
