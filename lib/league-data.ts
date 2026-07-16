import { getTeam } from "./teams";
import { franchiseForName, franchiseIdForName } from "./franchises";
import historyData from "@/data/history.json";
import type {
  Standing,
  Matchup,
  MatchupSide,
  Roster,
  SeasonResult,
  SeasonStanding,
  AllTimeRecord,
  FranchiseSeason,
} from "./types";

// Current-season data is sourced only from ESPN. When ESPN credentials are not
// configured, or ESPN does not return current data yet, the current-season
// views render empty states instead of local current-season data.
//
// Historical pages use the real scraped 2021-2025 NFL.com data below.

export const CURRENT_SEASON = 2026;
export const CURRENT_WEEK = 1;
export const HISTORY_SEASONS = [2021, 2022, 2023, 2024, 2025];

export function getFallbackStandings(): Standing[] {
  return [];
}

function matchupSide(teamId: number): MatchupSide {
  const team = getTeam(teamId);
  if (!team) throw new Error(`Unknown team id: ${teamId}`);
  return { team, score: 0 };
}

const WEEK_ONE_MATCHUPS: Matchup[] = [
  {
    id: "1-primetime",
    week: 1,
    status: "upcoming",
    away: matchupSide(4),
    home: matchupSide(2),
  },
  {
    id: "1-2",
    week: 1,
    status: "upcoming",
    away: matchupSide(1),
    home: matchupSide(8),
  },
  {
    id: "1-3",
    week: 1,
    status: "upcoming",
    away: matchupSide(3),
    home: matchupSide(7),
  },
  {
    id: "1-4",
    week: 1,
    status: "upcoming",
    away: matchupSide(10),
    home: matchupSide(9),
  },
  {
    id: "1-5",
    week: 1,
    status: "upcoming",
    away: matchupSide(12),
    home: matchupSide(5),
  },
  {
    id: "1-6",
    week: 1,
    status: "upcoming",
    away: matchupSide(6),
    home: matchupSide(11),
  },
];

const WEEK_FOURTEEN_MATCHUPS: Matchup[] = [
  {
    id: "14-1",
    week: 14,
    status: "upcoming",
    away: matchupSide(9),
    home: matchupSide(11),
  },
  {
    id: "14-2",
    week: 14,
    status: "upcoming",
    away: matchupSide(1),
    home: matchupSide(2),
  },
  {
    id: "14-3",
    week: 14,
    status: "upcoming",
    away: matchupSide(6),
    home: matchupSide(10),
  },
  {
    id: "14-4",
    week: 14,
    status: "upcoming",
    away: matchupSide(5),
    home: matchupSide(4),
  },
  {
    id: "14-5",
    week: 14,
    status: "upcoming",
    away: matchupSide(8),
    home: matchupSide(12),
  },
  {
    id: "14-6",
    week: 14,
    status: "upcoming",
    away: matchupSide(7),
    home: matchupSide(3),
  },
];

export function getCurrentSeasonMatchups(week: number): Matchup[] {
  if (week === 1) return WEEK_ONE_MATCHUPS;
  if (week === 14) return WEEK_FOURTEEN_MATCHUPS;
  return [];
}

export function getFallbackMatchups(week: number): Matchup[] {
  return getCurrentSeasonMatchups(week);
}

export function getFallbackRoster(teamId: number, week: number): Roster | null {
  void teamId;
  void week;
  return null;
}

interface RawSeasonTeam {
  teamId: number;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  streak: string;
  pointsFor: number;
  pointsAgainst: number;
  finalRank: number;
}

interface RawSeason {
  year: number;
  teamCount: number;
  champion: string | null;
  championTeamId: number | null;
  runnerUp: string | null;
  teams: RawSeasonTeam[];
}

const HISTORY = historyData as unknown as Record<string, RawSeason>;

function rawSeasons(): RawSeason[] {
  return HISTORY_SEASONS.map((y) => HISTORY[String(y)]).filter(Boolean);
}

export function getSeasonResults(): SeasonResult[] {
  return rawSeasons().map((s) => {
    const byFinal = [...s.teams].sort((a, b) => a.finalRank - b.finalRank);
    const regLeader = [...s.teams].sort(
      (a, b) => b.winPct - a.winPct || b.pointsFor - a.pointsFor,
    )[0];
    const topScorer = [...s.teams].sort((a, b) => b.pointsFor - a.pointsFor)[0];

    const finalStandings: SeasonStanding[] = byFinal.map((t) => ({
      rank: t.finalRank,
      name: t.name,
      team: franchiseForName(t.name),
      wins: t.wins,
      losses: t.losses,
      ties: t.ties,
      winPct: t.winPct,
      streak: t.streak,
      pointsFor: t.pointsFor,
      pointsAgainst: t.pointsAgainst,
    }));

    return {
      season: s.year,
      teamCount: s.teamCount,
      champion: s.champion ?? "-",
      championTeam: s.champion ? franchiseForName(s.champion) : undefined,
      runnerUp: s.runnerUp ?? "-",
      regularSeasonLeader: regLeader?.name ?? "-",
      highestPointsFor: { team: topScorer?.name ?? "-", points: topScorer?.pointsFor ?? 0 },
      finalStandings,
    };
  });
}

export function getAllTimeRecords(): AllTimeRecord[] {
  const acc = new Map<number, AllTimeRecord>();

  for (const s of rawSeasons()) {
    for (const t of s.teams) {
      const id = franchiseIdForName(t.name);
      if (!id) continue;
      const team = getTeam(id)!;
      const rec =
        acc.get(id) ??
        ({
          team,
          seasons: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          pct: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          championships: 0,
          titleYears: [],
          runnerUps: 0,
          podiums: 0,
          bestFinish: 99,
        } satisfies AllTimeRecord);

      rec.seasons += 1;
      rec.wins += t.wins;
      rec.losses += t.losses;
      rec.ties += t.ties;
      rec.pointsFor += t.pointsFor;
      rec.pointsAgainst += t.pointsAgainst;
      if (t.finalRank === 1) {
        rec.championships += 1;
        rec.titleYears.push(s.year);
      }
      if (t.finalRank === 2) rec.runnerUps += 1;
      if (t.finalRank <= 3) rec.podiums += 1;
      rec.bestFinish = Math.min(rec.bestFinish, t.finalRank);
      acc.set(id, rec);
    }
  }

  const records = [...acc.values()].map((r) => {
    const games = r.wins + r.losses + r.ties;
    return {
      ...r,
      pct: games ? Math.round((r.wins / games) * 1000) / 1000 : 0,
      pointsFor: Math.round(r.pointsFor * 100) / 100,
      pointsAgainst: Math.round(r.pointsAgainst * 100) / 100,
      titleYears: r.titleYears.sort(),
      bestFinish: r.bestFinish === 99 ? 0 : r.bestFinish,
    };
  });

  return records.sort(
    (a, b) => b.championships - a.championships || b.pct - a.pct || b.pointsFor - a.pointsFor,
  );
}

export function getFranchiseSeasons(teamId: number): FranchiseSeason[] {
  const out: FranchiseSeason[] = [];
  for (const s of rawSeasons()) {
    const row = s.teams.find((t) => franchiseIdForName(t.name) === teamId);
    if (!row) continue;
    const byRegular = [...s.teams].sort(
      (a, b) => b.winPct - a.winPct || b.pointsFor - a.pointsFor,
    );
    const regularRank = byRegular.findIndex((t) => t === row) + 1;
    out.push({
      season: s.year,
      name: row.name,
      teamCount: s.teamCount,
      finalRank: row.finalRank,
      regularRank,
      wins: row.wins,
      losses: row.losses,
      ties: row.ties,
      pointsFor: row.pointsFor,
      pointsAgainst: row.pointsAgainst,
      champion: row.finalRank === 1,
    });
  }
  return out.sort((a, b) => b.season - a.season);
}
