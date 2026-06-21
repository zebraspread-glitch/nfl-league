import { getCountingGames, type Game, type GamePlayer } from "./games";
import { franchiseForName, franchiseIdForName } from "./franchises";
import { HISTORY_SEASONS } from "./league-data";
import type { TeamMeta } from "./types";

// Per-player career aggregation built directly from the scraped game-by-game
// boxscores. There's no separate "players" dataset — a player's full MGL
// history (team-by-team, week-by-week) is just every roster appearance across
// data/games/<season>.json.

export interface PlayerGameLog {
  gameId: string;
  season: number;
  week: number;
  opponent: string;
  proTeam: string;
  pos: string;
  slot: string;
  started: boolean;
  points: number;
  stats: Record<string, number>;
  /** MGL franchise that rostered this player for this game. */
  team?: TeamMeta;
  teamName: string;
}

/** A contiguous run with one franchise, possibly spanning multiple seasons
 *  (or ending mid-season on a trade). */
export interface PlayerStint {
  team?: TeamMeta;
  teamName: string;
  fromSeason: number;
  toSeason: number;
  /** True if this stint runs through the most recent scraped season. */
  current: boolean;
}

export interface PlayerCareerTotals {
  gamesPlayed: number;
  starts: number;
  totalPoints: number;
  avgPoints: number;
  bestGame?: PlayerGameLog;
  worstGame?: PlayerGameLog;
  passYds: number;
  passTD: number;
  passInt: number;
  rushYds: number;
  rushTD: number;
  recYds: number;
  recTD: number;
  fum: number;
  twoPt: number;
  fgMade: number;
  fgMiss: number;
  patMade: number;
  defSack: number;
  defInt: number;
  defFumRec: number;
  defTD: number;
  defRetTD: number;
  defSafety: number;
  totalTDs: number;
}

export interface PlayerProfile {
  playerId: number;
  name: string;
  pos: string;
  proTeam: string;
  log: PlayerGameLog[];
  teamHistory: PlayerStint[];
  totals: PlayerCareerTotals;
}

export interface PlayerSummaryTeam {
  id?: number;
  name: string;
  manager?: string;
}

export interface PlayerSummary {
  playerId: number;
  name: string;
  pos: string;
  proTeam: string;
  firstSeason: number;
  lastSeason: number;
  seasons: number[];
  rosteredGames: number;
  gamesPlayed: number;
  starts: number;
  totalPoints: number;
  avgPoints: number;
  bestGamePoints: number;
  bestGameId?: string;
  passYds: number;
  passTD: number;
  passInt: number;
  rushYds: number;
  rushTD: number;
  recYds: number;
  recTD: number;
  fgMade: number;
  fgMiss: number;
  patMade: number;
  defSack: number;
  defInt: number;
  defFumRec: number;
  defTD: number;
  defSafety: number;
  totalTDs: number;
  teamCount: number;
  proTeamCount: number;
  teams: PlayerSummaryTeam[];
}

function sum(stats: Record<string, number>, key: string): number {
  return stats[key] ?? 0;
}

function fgMadeOf(stats: Record<string, number>): number {
  return sum(stats, "fg0_19") + sum(stats, "fg20_29") + sum(stats, "fg30_39") + sum(stats, "fg40_49") + sum(stats, "fg50");
}
function fgMissOf(stats: Record<string, number>): number {
  return (
    sum(stats, "fgMiss0_19") +
    sum(stats, "fgMiss20_29") +
    sum(stats, "fgMiss30_39") +
    sum(stats, "fgMiss40_49") +
    sum(stats, "fgMiss50")
  );
}

function buildEntry(game: Game, side: "home" | "away", p: GamePlayer): PlayerGameLog {
  const gameSide = game[side];
  const opp = side === "home" ? game.away : game.home;
  return {
    gameId: game.id,
    season: game.season,
    week: game.week,
    opponent: opp.name,
    proTeam: p.proTeam,
    pos: p.pos,
    slot: p.slot,
    started: p.started,
    points: p.points,
    stats: p.stats ?? {},
    team: gameSide.team,
    teamName: gameSide.name,
  };
}

const LATEST_SEASON = Math.max(...HISTORY_SEASONS);

/** Collapse chronological game entries into franchise stints, splitting on
 *  every roster change (covers mid-season trades) and merging consecutive
 *  seasons with the same franchise into one range. */
function buildStints(entries: PlayerGameLog[]): PlayerStint[] {
  const chrono = [...entries].sort((a, b) => a.season - b.season || a.week - b.week);
  const stints: PlayerStint[] = [];

  for (const e of chrono) {
    const id = e.team?.id ?? franchiseIdForName(e.teamName) ?? null;
    const last = stints[stints.length - 1];
    const lastId = last ? (last.team?.id ?? franchiseIdForName(last.teamName) ?? null) : null;
    if (last && lastId === id) {
      last.toSeason = e.season;
    } else {
      stints.push({ team: e.team ?? franchiseForName(e.teamName), teamName: e.teamName, fromSeason: e.season, toSeason: e.season, current: false });
    }
  }

  if (stints.length) stints[stints.length - 1].current = stints[stints.length - 1].toSeason >= LATEST_SEASON;
  return stints.reverse();
}

let allEntriesCache: Map<number, { name: string; entries: PlayerGameLog[] }> | null = null;

async function allEntries(): Promise<Map<number, { name: string; entries: PlayerGameLog[] }>> {
  if (allEntriesCache) return allEntriesCache;
  const games = await getCountingGames();
  const byId = new Map<number, { name: string; entries: PlayerGameLog[] }>();
  for (const g of games) {
    for (const side of ["home", "away"] as const) {
      for (const p of g[side].players) {
        const rec = byId.get(p.playerId) ?? { name: p.name, entries: [] };
        rec.entries.push(buildEntry(g, side, p));
        byId.set(p.playerId, rec);
      }
    }
  }
  allEntriesCache = byId;
  return byId;
}

function startedEntries(entries: PlayerGameLog[]): PlayerGameLog[] {
  return entries.filter((entry) => entry.started);
}

function totalPointsOf(entries: PlayerGameLog[]): number {
  return Math.round(entries.reduce((total, entry) => total + entry.points, 0) * 100) / 100;
}

function totalTouchdownsOf(entries: PlayerGameLog[]): number {
  return entries.reduce(
    (total, entry) =>
      total +
      sum(entry.stats, "passTD") +
      sum(entry.stats, "rushTD") +
      sum(entry.stats, "recTD") +
      sum(entry.stats, "defTD") +
      sum(entry.stats, "defRetTD"),
    0,
  );
}

function summaryTeams(entries: PlayerGameLog[]): PlayerSummaryTeam[] {
  const teams = new Map<string, PlayerSummaryTeam>();

  for (const entry of entries) {
    const id = entry.team?.id ?? franchiseIdForName(entry.teamName);
    const key = id ? `id:${id}` : `name:${entry.teamName}`;
    if (!teams.has(key)) {
      teams.set(key, {
        id,
        name: entry.team?.name ?? entry.teamName,
        manager: entry.team?.manager,
      });
    }
  }

  return [...teams.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function buildSummary(playerId: number, rec: { name: string; entries: PlayerGameLog[] }): PlayerSummary {
  const entries = rec.entries;
  const latest = [...entries].sort((a, b) => b.season - a.season || b.week - a.week)[0];
  const started = startedEntries(entries);
  const seasons = [...new Set(entries.map((entry) => entry.season))].sort((a, b) => a - b);
  const teams = summaryTeams(entries);
  const proTeams = new Set(entries.map((entry) => entry.proTeam).filter(Boolean));
  const bestGame = [...started].sort((a, b) => b.points - a.points)[0];
  const totalPoints = totalPointsOf(started);
  const passYds = started.reduce((s, e) => s + sum(e.stats, "passYds"), 0);
  const passTD = started.reduce((s, e) => s + sum(e.stats, "passTD"), 0);
  const passInt = started.reduce((s, e) => s + sum(e.stats, "passInt"), 0);
  const rushYds = started.reduce((s, e) => s + sum(e.stats, "rushYds"), 0);
  const rushTD = started.reduce((s, e) => s + sum(e.stats, "rushTD"), 0);
  const recYds = started.reduce((s, e) => s + sum(e.stats, "recYds"), 0);
  const recTD = started.reduce((s, e) => s + sum(e.stats, "recTD"), 0);
  const fgMade = started.reduce((s, e) => s + fgMadeOf(e.stats), 0);
  const fgMiss = started.reduce((s, e) => s + fgMissOf(e.stats), 0);
  const patMade = started.reduce((s, e) => s + sum(e.stats, "patMade"), 0);
  const defSack = started.reduce((s, e) => s + sum(e.stats, "defSack"), 0);
  const defInt = started.reduce((s, e) => s + sum(e.stats, "defInt"), 0);
  const defFumRec = started.reduce((s, e) => s + sum(e.stats, "defFumRec"), 0);
  const defTD = started.reduce((s, e) => s + sum(e.stats, "defTD") + sum(e.stats, "defRetTD"), 0);
  const defSafety = started.reduce((s, e) => s + sum(e.stats, "defSafety"), 0);

  return {
    playerId,
    name: rec.name,
    pos: latest?.pos ?? "",
    proTeam: latest?.proTeam ?? "",
    firstSeason: seasons[0] ?? latest?.season ?? 0,
    lastSeason: seasons[seasons.length - 1] ?? latest?.season ?? 0,
    seasons,
    rosteredGames: entries.length,
    gamesPlayed: started.length,
    starts: started.length,
    totalPoints,
    avgPoints: started.length ? Math.round((totalPoints / started.length) * 100) / 100 : 0,
    bestGamePoints: bestGame?.points ?? 0,
    bestGameId: bestGame?.gameId,
    passYds,
    passTD,
    passInt,
    rushYds,
    rushTD,
    recYds,
    recTD,
    fgMade,
    fgMiss,
    patMade,
    defSack,
    defInt,
    defFumRec,
    defTD,
    defSafety,
    totalTDs: totalTouchdownsOf(started),
    teamCount: teams.length,
    proTeamCount: proTeams.size,
    teams,
  };
}

export async function getPlayerSummaries(): Promise<PlayerSummary[]> {
  const map = await allEntries();
  return [...map.entries()]
    .map(([playerId, rec]) => buildSummary(playerId, rec))
    .sort((a, b) => b.totalPoints - a.totalPoints || b.gamesPlayed - a.gamesPlayed || a.name.localeCompare(b.name));
}

export async function getPlayerProfile(playerId: number): Promise<PlayerProfile | null> {
  const map = await allEntries();
  const rec = map.get(playerId);
  if (!rec) return null;

  const log = [...rec.entries].sort((a, b) => b.season - a.season || b.week - a.week);
  const latest = log[0];

  const teamHistory = buildStints(rec.entries);

  const started = rec.entries.filter((e) => e.started);
  const totals: PlayerCareerTotals = {
    gamesPlayed: started.length,
    starts: started.length,
    totalPoints: Math.round(started.reduce((s, e) => s + e.points, 0) * 100) / 100,
    avgPoints: started.length ? Math.round((started.reduce((s, e) => s + e.points, 0) / started.length) * 100) / 100 : 0,
    bestGame: [...started].sort((a, b) => b.points - a.points)[0],
    worstGame: [...started].sort((a, b) => a.points - b.points)[0],
    passYds: started.reduce((s, e) => s + sum(e.stats, "passYds"), 0),
    passTD: started.reduce((s, e) => s + sum(e.stats, "passTD"), 0),
    passInt: started.reduce((s, e) => s + sum(e.stats, "passInt"), 0),
    rushYds: started.reduce((s, e) => s + sum(e.stats, "rushYds"), 0),
    rushTD: started.reduce((s, e) => s + sum(e.stats, "rushTD"), 0),
    recYds: started.reduce((s, e) => s + sum(e.stats, "recYds"), 0),
    recTD: started.reduce((s, e) => s + sum(e.stats, "recTD"), 0),
    fum: started.reduce((s, e) => s + sum(e.stats, "fum"), 0),
    twoPt: started.reduce((s, e) => s + sum(e.stats, "twoPt"), 0),
    fgMade: started.reduce((s, e) => s + fgMadeOf(e.stats), 0),
    fgMiss: started.reduce((s, e) => s + fgMissOf(e.stats), 0),
    patMade: started.reduce((s, e) => s + sum(e.stats, "patMade"), 0),
    defSack: started.reduce((s, e) => s + sum(e.stats, "defSack"), 0),
    defInt: started.reduce((s, e) => s + sum(e.stats, "defInt"), 0),
    defFumRec: started.reduce((s, e) => s + sum(e.stats, "defFumRec"), 0),
    defTD: started.reduce((s, e) => s + sum(e.stats, "defTD"), 0),
    defRetTD: started.reduce((s, e) => s + sum(e.stats, "defRetTD"), 0),
    defSafety: started.reduce((s, e) => s + sum(e.stats, "defSafety"), 0),
    totalTDs: 0,
  };
  totals.totalTDs = totals.passTD + totals.rushTD + totals.recTD + totals.defTD + totals.defRetTD;

  return {
    playerId,
    name: rec.name,
    pos: latest?.pos ?? "",
    proTeam: latest?.proTeam ?? "",
    log,
    teamHistory,
    totals,
  };
}
