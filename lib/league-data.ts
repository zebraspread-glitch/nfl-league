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
    away: matchupSide(9),
    home: matchupSide(10),
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

const WEEK_TWO_MATCHUPS: Matchup[] = [
  {
    id: "2-primetime",
    week: 2,
    status: "upcoming",
    away: matchupSide(1),
    home: matchupSide(4),
  },
  {
    id: "2-2",
    week: 2,
    status: "upcoming",
    away: matchupSide(2),
    home: matchupSide(6),
  },
  {
    id: "2-3",
    week: 2,
    status: "upcoming",
    away: matchupSide(8),
    home: matchupSide(5),
  },
  {
    id: "2-4",
    week: 2,
    status: "upcoming",
    away: matchupSide(7),
    home: matchupSide(9),
  },
  {
    id: "2-5",
    week: 2,
    status: "upcoming",
    away: matchupSide(10),
    home: matchupSide(12),
  },
  {
    id: "2-6",
    week: 2,
    status: "upcoming",
    away: matchupSide(11),
    home: matchupSide(3),
  },
];

const WEEK_THREE_MATCHUPS: Matchup[] = [
  {
    id: "3-primetime",
    week: 3,
    status: "upcoming",
    away: matchupSide(4),
    home: matchupSide(6),
  },
  {
    id: "3-2",
    week: 3,
    status: "upcoming",
    away: matchupSide(2),
    home: matchupSide(7),
  },
  {
    id: "3-3",
    week: 3,
    status: "upcoming",
    away: matchupSide(5),
    home: matchupSide(10),
  },
  {
    id: "3-4",
    week: 3,
    status: "upcoming",
    away: matchupSide(8),
    home: matchupSide(3),
  },
  {
    id: "3-5",
    week: 3,
    status: "upcoming",
    away: matchupSide(1),
    home: matchupSide(12),
  },
  {
    id: "3-6",
    week: 3,
    status: "upcoming",
    away: matchupSide(11),
    home: matchupSide(9),
  },
];

const WEEK_FOUR_MATCHUPS: Matchup[] = [
  {
    id: "4-primetime",
    week: 4,
    status: "upcoming",
    away: matchupSide(6),
    home: matchupSide(5),
  },
  {
    id: "4-2",
    week: 4,
    status: "upcoming",
    away: matchupSide(10),
    home: matchupSide(11),
  },
  {
    id: "4-3",
    week: 4,
    status: "upcoming",
    away: matchupSide(7),
    home: matchupSide(1),
  },
  {
    id: "4-4",
    week: 4,
    status: "upcoming",
    away: matchupSide(9),
    home: matchupSide(4),
  },
  {
    id: "4-5",
    week: 4,
    status: "upcoming",
    away: matchupSide(8),
    home: matchupSide(2),
  },
  {
    id: "4-6",
    week: 4,
    status: "upcoming",
    away: matchupSide(12),
    home: matchupSide(3),
  },
];

const WEEK_FIVE_MATCHUPS: Matchup[] = [
  {
    id: "5-primetime",
    week: 5,
    status: "upcoming",
    away: matchupSide(4),
    home: matchupSide(7),
  },
  {
    id: "5-2",
    week: 5,
    status: "upcoming",
    away: matchupSide(10),
    home: matchupSide(6),
  },
  {
    id: "5-3",
    week: 5,
    status: "upcoming",
    away: matchupSide(9),
    home: matchupSide(8),
  },
  {
    id: "5-4",
    week: 5,
    status: "upcoming",
    away: matchupSide(12),
    home: matchupSide(11),
  },
  {
    id: "5-5",
    week: 5,
    status: "upcoming",
    away: matchupSide(5),
    home: matchupSide(1),
  },
  {
    id: "5-6",
    week: 5,
    status: "upcoming",
    away: matchupSide(2),
    home: matchupSide(3),
  },
];

const WEEK_SIX_MATCHUPS: Matchup[] = [
  {
    id: "6-primetime",
    week: 6,
    status: "upcoming",
    away: matchupSide(2),
    home: matchupSide(9),
  },
  {
    id: "6-2",
    week: 6,
    status: "upcoming",
    away: matchupSide(4),
    home: matchupSide(3),
  },
  {
    id: "6-3",
    week: 6,
    status: "upcoming",
    away: matchupSide(5),
    home: matchupSide(6),
  },
  {
    id: "6-4",
    week: 6,
    status: "upcoming",
    away: matchupSide(11),
    home: matchupSide(8),
  },
  {
    id: "6-5",
    week: 6,
    status: "upcoming",
    away: matchupSide(7),
    home: matchupSide(12),
  },
  {
    id: "6-6",
    week: 6,
    status: "upcoming",
    away: matchupSide(10),
    home: matchupSide(1),
  },
];

const WEEK_SEVEN_MATCHUPS: Matchup[] = [
  {
    id: "7-primetime",
    week: 7,
    status: "upcoming",
    away: matchupSide(9),
    home: matchupSide(1),
  },
  {
    id: "7-2",
    week: 7,
    status: "upcoming",
    away: matchupSide(8),
    home: matchupSide(3),
  },
  {
    id: "7-3",
    week: 7,
    status: "upcoming",
    away: matchupSide(11),
    home: matchupSide(4),
  },
  {
    id: "7-4",
    week: 7,
    status: "upcoming",
    away: matchupSide(7),
    home: matchupSide(6),
  },
  {
    id: "7-5",
    week: 7,
    status: "upcoming",
    away: matchupSide(2),
    home: matchupSide(12),
  },
  {
    id: "7-6",
    week: 7,
    status: "upcoming",
    away: matchupSide(5),
    home: matchupSide(10),
  },
];

const WEEK_EIGHT_MATCHUPS: Matchup[] = [
  {
    id: "8-primetime",
    week: 8,
    status: "upcoming",
    away: matchupSide(8),
    home: matchupSide(7),
  },
  {
    id: "8-2",
    week: 8,
    status: "upcoming",
    away: matchupSide(6),
    home: matchupSide(12),
  },
  {
    id: "8-3",
    week: 8,
    status: "upcoming",
    away: matchupSide(3),
    home: matchupSide(1),
  },
  {
    id: "8-4",
    week: 8,
    status: "upcoming",
    away: matchupSide(11),
    home: matchupSide(2),
  },
  {
    id: "8-5",
    week: 8,
    status: "upcoming",
    away: matchupSide(9),
    home: matchupSide(5),
  },
  {
    id: "8-6",
    week: 8,
    status: "upcoming",
    away: matchupSide(10),
    home: matchupSide(4),
  },
];

const WEEK_NINE_MATCHUPS: Matchup[] = [
  {
    id: "9-primetime",
    week: 9,
    status: "upcoming",
    away: matchupSide(8),
    home: matchupSide(12),
  },
  {
    id: "9-2",
    week: 9,
    status: "upcoming",
    away: matchupSide(3),
    home: matchupSide(9),
  },
  {
    id: "9-3",
    week: 9,
    status: "upcoming",
    away: matchupSide(10),
    home: matchupSide(2),
  },
  {
    id: "9-4",
    week: 9,
    status: "upcoming",
    away: matchupSide(1),
    home: matchupSide(11),
  },
  {
    id: "9-5",
    week: 9,
    status: "upcoming",
    away: matchupSide(5),
    home: matchupSide(7),
  },
  {
    id: "9-6",
    week: 9,
    status: "upcoming",
    away: matchupSide(4),
    home: matchupSide(6),
  },
];

const WEEK_TEN_MATCHUPS: Matchup[] = [
  {
    id: "10-primetime",
    week: 10,
    status: "upcoming",
    away: matchupSide(1),
    home: matchupSide(2),
  },
  {
    id: "10-2",
    week: 10,
    status: "upcoming",
    away: matchupSide(9),
    home: matchupSide(6),
  },
  {
    id: "10-3",
    week: 10,
    status: "upcoming",
    away: matchupSide(5),
    home: matchupSide(4),
  },
  {
    id: "10-4",
    week: 10,
    status: "upcoming",
    away: matchupSide(11),
    home: matchupSide(7),
  },
  {
    id: "10-5",
    week: 10,
    status: "upcoming",
    away: matchupSide(10),
    home: matchupSide(8),
  },
  {
    id: "10-6",
    week: 10,
    status: "upcoming",
    away: matchupSide(12),
    home: matchupSide(3),
  },
];

// Week 11 is the one round with no Game of the Week on the fixture graphic, so
// there is no "-primetime" id here.
const WEEK_ELEVEN_MATCHUPS: Matchup[] = [
  {
    id: "11-1",
    week: 11,
    status: "upcoming",
    away: matchupSide(6),
    home: matchupSide(1),
  },
  {
    id: "11-2",
    week: 11,
    status: "upcoming",
    away: matchupSide(2),
    home: matchupSide(9),
  },
  {
    id: "11-3",
    week: 11,
    status: "upcoming",
    away: matchupSide(4),
    home: matchupSide(8),
  },
  {
    id: "11-4",
    week: 11,
    status: "upcoming",
    away: matchupSide(10),
    home: matchupSide(3),
  },
  {
    id: "11-5",
    week: 11,
    status: "upcoming",
    away: matchupSide(12),
    home: matchupSide(7),
  },
  {
    id: "11-6",
    week: 11,
    status: "upcoming",
    away: matchupSide(5),
    home: matchupSide(11),
  },
];

const WEEK_TWELVE_MATCHUPS: Matchup[] = [
  {
    id: "12-1",
    week: 12,
    status: "upcoming",
    away: matchupSide(8),
    home: matchupSide(6),
  },
  {
    id: "12-2",
    week: 12,
    status: "upcoming",
    away: matchupSide(11),
    home: matchupSide(2),
  },
  {
    id: "12-3",
    week: 12,
    status: "upcoming",
    away: matchupSide(9),
    home: matchupSide(1),
  },
  {
    id: "12-4",
    week: 12,
    status: "upcoming",
    away: matchupSide(4),
    home: matchupSide(12),
  },
  {
    id: "12-5",
    week: 12,
    status: "upcoming",
    away: matchupSide(3),
    home: matchupSide(5),
  },
  {
    id: "12-6",
    week: 12,
    status: "upcoming",
    away: matchupSide(10),
    home: matchupSide(7),
  },
];

const WEEK_THIRTEEN_MATCHUPS: Matchup[] = [
  {
    id: "13-1",
    week: 13,
    status: "upcoming",
    away: matchupSide(7),
    home: matchupSide(8),
  },
  {
    id: "13-2",
    week: 13,
    status: "upcoming",
    away: matchupSide(12),
    home: matchupSide(9),
  },
  {
    id: "13-3",
    week: 13,
    status: "upcoming",
    away: matchupSide(6),
    home: matchupSide(3),
  },
  {
    id: "13-4",
    week: 13,
    status: "upcoming",
    away: matchupSide(10),
    home: matchupSide(4),
  },
  {
    id: "13-5",
    week: 13,
    status: "upcoming",
    away: matchupSide(11),
    home: matchupSide(1),
  },
  {
    id: "13-6",
    week: 13,
    status: "upcoming",
    away: matchupSide(2),
    home: matchupSide(5),
  },
];

const WEEK_FOURTEEN_MATCHUPS: Matchup[] = [
  {
    id: "14-1",
    week: 14,
    status: "upcoming",
    away: matchupSide(11),
    home: matchupSide(9),
  },
  {
    id: "14-2",
    week: 14,
    status: "upcoming",
    away: matchupSide(2),
    home: matchupSide(1),
  },
  {
    id: "14-3",
    week: 14,
    status: "upcoming",
    away: matchupSide(4),
    home: matchupSide(5),
  },
  {
    id: "14-4",
    week: 14,
    status: "upcoming",
    away: matchupSide(6),
    home: matchupSide(10),
  },
  {
    id: "14-5",
    week: 14,
    status: "upcoming",
    away: matchupSide(12),
    home: matchupSide(8),
  },
  {
    id: "14-6",
    week: 14,
    status: "upcoming",
    away: matchupSide(3),
    home: matchupSide(7),
  },
];

// The 2026 fixture is being entered a week at a time. Add the new week's array
// above and register it here — the matchups week selector reads its tabs from
// CURRENT_SEASON_FIXTURE_WEEKS, so nothing else needs updating.
const CURRENT_SEASON_MATCHUPS: Record<number, Matchup[]> = {
  1: WEEK_ONE_MATCHUPS,
  2: WEEK_TWO_MATCHUPS,
  3: WEEK_THREE_MATCHUPS,
  4: WEEK_FOUR_MATCHUPS,
  5: WEEK_FIVE_MATCHUPS,
  6: WEEK_SIX_MATCHUPS,
  7: WEEK_SEVEN_MATCHUPS,
  8: WEEK_EIGHT_MATCHUPS,
  9: WEEK_NINE_MATCHUPS,
  10: WEEK_TEN_MATCHUPS,
  11: WEEK_ELEVEN_MATCHUPS,
  12: WEEK_TWELVE_MATCHUPS,
  13: WEEK_THIRTEEN_MATCHUPS,
  14: WEEK_FOURTEEN_MATCHUPS,
};

export const CURRENT_SEASON_FIXTURE_WEEKS = Object.keys(CURRENT_SEASON_MATCHUPS)
  .map(Number)
  .sort((a, b) => a - b);

export function getCurrentSeasonMatchups(week: number): Matchup[] {
  return CURRENT_SEASON_MATCHUPS[week] ?? [];
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
