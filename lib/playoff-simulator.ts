import { TEAMS } from "./teams";
import type { Matchup, Standing, TeamMeta } from "./types";

export const REGULAR_SEASON_WEEKS = 14;
export const PLAYOFF_CUTOFF = 6;

export interface SimulatorTeam {
  team: TeamMeta;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  powerRank: number;
  strength: number;
}

export interface SimulatorGame {
  id: string;
  week: number;
  away: TeamMeta;
  home: TeamMeta;
  favoriteId: number;
}

export interface ProjectedTeam extends SimulatorTeam {
  seed: number;
}

export function completedWeeksFromStandings(standings: Standing[]): number {
  return Math.min(
    REGULAR_SEASON_WEEKS,
    Math.max(0, ...standings.map((s) => s.wins + s.losses + s.ties))
  );
}

export function buildSimulatorTeams(
  standings: Standing[],
  powerRanks: { team: TeamMeta; rank: number }[]
): SimulatorTeam[] {
  const standingsByTeam = new Map(standings.map((s) => [s.team.id, s]));
  const rankByTeam = new Map(powerRanks.map((r) => [r.team.id, r.rank]));
  const fallbackRank = TEAMS.length + 1;

  return TEAMS.map((team) => {
    const standing = standingsByTeam.get(team.id);
    const powerRank = rankByTeam.get(team.id) ?? standing?.rank ?? fallbackRank;
    const games = standing ? standing.wins + standing.losses + standing.ties : 0;
    const winRate = games ? (standing!.wins + standing!.ties * 0.5) / games : 0.5;
    const scoringLift = standing?.pointsFor ? standing.pointsFor / Math.max(1, games || 1) / 30 : 0;
    const strength = (fallbackRank - powerRank) * 2.4 + winRate * 6 + scoringLift;

    return {
      team,
      wins: standing?.wins ?? 0,
      losses: standing?.losses ?? 0,
      ties: standing?.ties ?? 0,
      pointsFor: standing?.pointsFor ?? 0,
      pointsAgainst: standing?.pointsAgainst ?? 0,
      powerRank,
      strength: Math.round(strength * 100) / 100,
    };
  });
}

export function buildSimulatorSchedule({
  knownMatchups,
  teams,
  startWeek,
}: {
  knownMatchups: Matchup[];
  teams: SimulatorTeam[];
  startWeek: number;
}): SimulatorGame[] {
  const teamById = new Map(teams.map((t) => [t.team.id, t]));
  const games: SimulatorGame[] = [];

  for (const matchup of knownMatchups) {
    if (matchup.week < startWeek || matchup.week > REGULAR_SEASON_WEEKS) continue;
    games.push(gameFromIds(matchup.week, matchup.away.team.id, matchup.home.team.id, teamById));
  }

  const generatedWeeks = roundRobinWeeks(TEAMS.map((t) => t.id));
  for (let week = 2; week <= REGULAR_SEASON_WEEKS; week++) {
    if (week < startWeek) continue;
    const round = generatedWeeks[(week - 2) % generatedWeeks.length];
    for (const [awayId, homeId] of round) {
      games.push(gameFromIds(week, awayId, homeId, teamById));
    }
  }

  return games.sort((a, b) => a.week - b.week || a.id.localeCompare(b.id));
}

export function projectStandings(teams: SimulatorTeam[], schedule: SimulatorGame[], winners: Record<string, number>): ProjectedTeam[] {
  const rows = new Map(
    teams.map((t) => [
      t.team.id,
      {
        ...t,
        pointsFor: t.pointsFor,
        pointsAgainst: t.pointsAgainst,
        seed: 0,
      },
    ])
  );

  for (const game of schedule) {
    const winnerId = winners[game.id] ?? game.favoriteId;
    const loserId = winnerId === game.home.id ? game.away.id : game.home.id;
    const winner = rows.get(winnerId);
    const loser = rows.get(loserId);
    if (!winner || !loser) continue;

    winner.wins += 1;
    loser.losses += 1;

    const winnerPoints = 100 + winner.strength * 1.8;
    const loserPoints = 92 + loser.strength * 1.5;
    winner.pointsFor += winnerPoints;
    winner.pointsAgainst += loserPoints;
    loser.pointsFor += loserPoints;
    loser.pointsAgainst += winnerPoints;
  }

  return [...rows.values()]
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.ties - a.ties ||
        b.pointsFor - a.pointsFor ||
        a.powerRank - b.powerRank
    )
    .map((row, index) => ({ ...row, seed: index + 1 }));
}

function gameFromIds(week: number, awayId: number, homeId: number, teamById: Map<number, SimulatorTeam>): SimulatorGame {
  const away = teamById.get(awayId);
  const home = teamById.get(homeId);
  if (!away || !home) throw new Error(`Unknown simulator teams: ${awayId} at ${homeId}`);
  const homeEdge = 0.8;
  const favoriteId = home.strength + homeEdge >= away.strength ? home.team.id : away.team.id;

  return {
    id: `${week}-${awayId}-${homeId}`,
    week,
    away: away.team,
    home: home.team,
    favoriteId,
  };
}

function roundRobinWeeks(teamIds: number[]): [number, number][][] {
  const ids = teamIds.slice();
  const rounds: [number, number][][] = [];
  const count = ids.length;

  for (let round = 0; round < count - 1; round++) {
    const pairings: [number, number][] = [];
    for (let i = 0; i < count / 2; i++) {
      const a = ids[i];
      const b = ids[count - 1 - i];
      pairings.push((round + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairings);
    ids.splice(1, 0, ids.pop()!);
  }

  return rounds;
}
