import "server-only";

import type {
  Standing,
  Matchup,
  Roster,
  RosterEntry,
  TeamMeta,
  LeagueSnapshot,
} from "./types";
import { getTeamByName, TEAMS } from "./teams";
import {
  CURRENT_SEASON,
  CURRENT_WEEK,
  getFallbackStandings,
  getFallbackMatchups,
  getFallbackRoster,
} from "./league-data";

// ===========================================================================
// SERVER-ONLY ESPN DATA LAYER
//
// `import "server-only"` guarantees this module can never be bundled into a
// client component, so the ESPN cookies it reads from the environment are never
// shipped to the browser. Pages call the exported getX() helpers from server
// components / route handlers only.
//
// When ESPN credentials are missing OR a request fails, current-season helpers
// return empty data. Historical pages use the scraped NFL.com data directly.
// ===========================================================================

const ESPN_BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl";

interface EspnConfig {
  leagueId: string;
  season: number;
  s2?: string;
  swid?: string;
}

function readConfig(): EspnConfig | null {
  const leagueId = process.env.ESPN_LEAGUE_ID;
  if (!leagueId) return null;
  return {
    leagueId,
    season: Number(process.env.ESPN_SEASON) || CURRENT_SEASON,
    s2: process.env.ESPN_S2,
    swid: process.env.ESPN_SWID,
  };
}

export function isLiveConfigured(): boolean {
  return readConfig() !== null;
}

/**
 * Low-level ESPN fetch. Adds the private-league cookies server-side and caches
 * via Next's fetch cache. Returns null on any failure so callers can render
 * empty current-season states.
 */
async function espnFetch<T>(
  views: string[],
  { revalidateSeconds = 300, scoringPeriodId }: { revalidateSeconds?: number; scoringPeriodId?: number } = {},
): Promise<T | null> {
  const cfg = readConfig();
  if (!cfg) return null;

  const params = new URLSearchParams();
  for (const v of views) params.append("view", v);
  if (scoringPeriodId) params.set("scoringPeriodId", String(scoringPeriodId));

  const url = `${ESPN_BASE}/seasons/${cfg.season}/segments/0/leagues/${cfg.leagueId}?${params}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (cfg.s2 && cfg.swid) {
    // SWID must keep its surrounding braces.
    const swid = cfg.swid.startsWith("{") ? cfg.swid : `{${cfg.swid}}`;
    headers.Cookie = `espn_s2=${cfg.s2}; SWID=${swid}`;
  }

  try {
    const res = await fetch(url, {
      headers,
      next: { revalidate: revalidateSeconds },
    });
    if (!res.ok) {
      console.warn(`[espn] ${res.status} ${res.statusText} for views ${views.join(",")}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn("[espn] fetch failed:", err);
    return null;
  }
}

// --- ESPN response shapes (only the bits we use) ---------------------------

interface EspnRecordDetail {
  wins: number;
  losses: number;
  ties: number;
  percentage: number;
  pointsFor: number;
  pointsAgainst: number;
  streakLength?: number;
  streakType?: string;
}

interface EspnTeam {
  id: number;
  name?: string;
  location?: string;
  nickname?: string;
  abbrev?: string;
  playoffSeed?: number;
  rankCalculatedFinal?: number;
  draftDayProjectedRank?: number;
  record?: { overall: EspnRecordDetail };
}

interface EspnCompetitor {
  teamId: number;
  totalPoints?: number;
  totalProjectedPointsLive?: number;
  rosterForCurrentScoringPeriod?: { entries: EspnRosterEntry[] };
}

interface EspnScheduleItem {
  id: number;
  matchupPeriodId: number;
  winner?: string;
  home?: EspnCompetitor;
  away?: EspnCompetitor;
}

interface EspnRosterEntry {
  playerId: number;
  lineupSlotId: number;
  playerPoolEntry?: {
    appliedStatTotal?: number;
    player?: {
      fullName?: string;
      defaultPositionId?: number;
      proTeamId?: number;
    };
  };
}

interface EspnLeague {
  scoringPeriodId?: number;
  status?: { currentMatchupPeriod?: number; latestScoringPeriod?: number };
  teams?: EspnTeam[];
  schedule?: EspnScheduleItem[];
}

// --- Mapping helpers --------------------------------------------------------

function espnTeamName(t: EspnTeam): string {
  return t.name || [t.location, t.nickname].filter(Boolean).join(" ").trim() || `Team ${t.id}`;
}

/** Map an ESPN team to our curated metadata, matching by name then by id. */
function resolveTeam(t: EspnTeam): TeamMeta {
  const name = espnTeamName(t);
  const byName = TEAMS.find((m) => m.name.toLowerCase() === name.toLowerCase());
  if (byName) return byName;
  const byId = TEAMS.find((m) => m.id === t.id);
  if (byId) return { ...byId, name };
  return getTeamByName(name);
}

function streakString(r?: EspnRecordDetail): string {
  if (!r?.streakLength) return "—";
  const type = r.streakType === "LOSS" ? "L" : "W";
  return `${type}${r.streakLength}`;
}

const SLOT_MAP: Record<number, string> = {
  0: "QB", 2: "RB", 4: "WR", 6: "TE", 16: "D/ST", 17: "K",
  23: "FLEX", 20: "BE", 21: "IR", 7: "OP",
};
const POS_MAP: Record<number, string> = {
  1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "D/ST",
};

// --- Public API -------------------------------------------------------------

export function getSnapshot(): LeagueSnapshot {
  return {
    season: Number(process.env.ESPN_SEASON) || CURRENT_SEASON,
    currentWeek: CURRENT_WEEK,
    live: isLiveConfigured(),
  };
}

export async function getStandings(): Promise<Standing[]> {
  const data = await espnFetch<EspnLeague>(["mStandings", "mTeam"]);
  if (!data?.teams?.length) return getFallbackStandings();

  const standings = data.teams.map((t) => {
    const overall = t.record?.overall;
    const rank = t.playoffSeed || t.rankCalculatedFinal || 0;
    return {
      team: resolveTeam(t),
      rank,
      wins: overall?.wins ?? 0,
      losses: overall?.losses ?? 0,
      ties: overall?.ties ?? 0,
      pct: overall?.percentage ?? 0,
      streak: streakString(overall),
      pointsFor: Math.round((overall?.pointsFor ?? 0) * 100) / 100,
      pointsAgainst: Math.round((overall?.pointsAgainst ?? 0) * 100) / 100,
      change: 0,
    } satisfies Standing;
  });

  standings.sort((a, b) => (a.rank || 99) - (b.rank || 99) || b.pct - a.pct);
  standings.forEach((s, i) => (s.rank = i + 1));
  return standings;
}

export async function getMatchups(week: number): Promise<Matchup[]> {
  const data = await espnFetch<EspnLeague>(["mMatchup", "mMatchupScore", "mTeam"], {
    scoringPeriodId: week,
  });
  if (!data?.schedule?.length || !data.teams?.length) return getFallbackMatchups(week);

  const teamById = new Map(data.teams.map((t) => [t.id, resolveTeam(t)]));
  const recordById = new Map(
    data.teams.map((t) => [
      t.id,
      {
        wins: t.record?.overall?.wins ?? 0,
        losses: t.record?.overall?.losses ?? 0,
        ties: t.record?.overall?.ties ?? 0,
      },
    ]),
  );
  const currentPeriod = data.status?.currentMatchupPeriod ?? CURRENT_WEEK;

  const games = data.schedule.filter((s) => s.matchupPeriodId === week && s.home && s.away);
  if (!games.length) return getFallbackMatchups(week);

  return games.map((g) => {
    const status: Matchup["status"] =
      g.winner && g.winner !== "UNDECIDED"
        ? "final"
        : week === currentPeriod
        ? "live"
        : week > currentPeriod
        ? "upcoming"
        : "final";

    const side = (c: EspnCompetitor) => {
      const team = teamById.get(c.teamId) ?? getTeamByName(`Team ${c.teamId}`);
      return {
        team,
        score: Math.round((c.totalPoints ?? 0) * 100) / 100,
        projected: c.totalProjectedPointsLive
          ? Math.round(c.totalProjectedPointsLive * 100) / 100
          : undefined,
        record: recordById.get(c.teamId),
      };
    };

    return {
      id: String(g.id),
      week,
      status,
      home: side(g.home!),
      away: side(g.away!),
    } satisfies Matchup;
  });
}

export async function getRoster(teamId: number, week: number): Promise<Roster | null> {
  const data = await espnFetch<EspnLeague>(["mRoster", "mTeam"], { scoringPeriodId: week });
  if (!data?.schedule?.length) return getFallbackRoster(teamId, week);

  const teamMeta = data.teams?.find((t) => t.id === teamId);
  const competitor = data.schedule
    .flatMap((s) => [s.home, s.away])
    .find((c) => c?.teamId === teamId && c.rosterForCurrentScoringPeriod);

  if (!teamMeta || !competitor?.rosterForCurrentScoringPeriod) {
    return getFallbackRoster(teamId, week);
  }

  const entries: RosterEntry[] = competitor.rosterForCurrentScoringPeriod.entries.map((e) => {
    const player = e.playerPoolEntry?.player;
    const slot = SLOT_MAP[e.lineupSlotId] ?? "BE";
    return {
      playerId: e.playerId,
      name: player?.fullName ?? "Unknown",
      position: POS_MAP[player?.defaultPositionId ?? -1] ?? "—",
      slot,
      points: Math.round((e.playerPoolEntry?.appliedStatTotal ?? 0) * 100) / 100,
      started: slot !== "BE" && slot !== "IR",
    };
  });

  return { team: resolveTeam(teamMeta), week, entries };
}
