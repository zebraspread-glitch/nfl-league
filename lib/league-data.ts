import { getTeam } from "./teams";
import { franchiseForName, franchiseIdForName } from "./franchises";
import historyData from "@/data/history.json";
import type {
  Standing,
  Matchup,
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

export function getFallbackMatchups(week: number): Matchup[] {
  void week;
  return [];
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
    out.push({
      season: s.year,
      name: row.name,
      teamCount: s.teamCount,
      finalRank: row.finalRank,
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
