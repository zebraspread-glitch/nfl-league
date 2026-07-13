import { getAllGames, getCountingGames } from "./games";
import type { TeamMeta } from "./types";

// Derived analytics that aren't just "who won" — computed from the same
// game-by-game data (data/games/<season>.json) as the Record Book, but framed
// to surface luck and roster-construction insights.

const round = (value: number): number => Math.round(value * 100) / 100;

// --- All-Play & Luck ---------------------------------------------------------
// Each regular-season week, every franchise is scored against the WHOLE league,
// not just its one opponent. A team's all-play record is how it would have done
// versus everyone; comparing that to its actual record isolates schedule luck.

export interface AllPlayRow {
  team: TeamMeta;
  weeks: number;
  actualWins: number;
  actualLosses: number;
  actualTies: number;
  actualPct: number;
  allPlayWins: number;
  allPlayLosses: number;
  allPlayTies: number;
  allPlayPct: number;
  /** allPlayPct × weeks — wins a neutral schedule would have produced. */
  expectedWins: number;
  /** actualWins − expectedWins. Positive = lucky, negative = unlucky. */
  luckWins: number;
  /** Weeks this team posted the league's top score. */
  crowns: number;
  /** Weeks this team posted the league's lowest score. */
  cellars: number;
  pointsFor: number;
  avgPointsFor: number;
}

interface AllPlayAcc {
  team: TeamMeta;
  weeks: number;
  actualWins: number;
  actualLosses: number;
  actualTies: number;
  allPlayWins: number;
  allPlayLosses: number;
  allPlayTies: number;
  crowns: number;
  cellars: number;
  pointsFor: number;
}

/** All-play standings and the resulting luck differential, regular season only
 *  (weeks 1–14, when every franchise plays and the comparison is complete). */
export async function getAllPlayStandings(): Promise<AllPlayRow[]> {
  const games = await getAllGames();
  const acc = new Map<number, AllPlayAcc>();
  const weekGroups = new Map<string, { id: number; score: number }[]>();

  const ensure = (team: TeamMeta): AllPlayAcc => {
    const existing = acc.get(team.id);
    if (existing) return existing;
    const fresh: AllPlayAcc = {
      team,
      weeks: 0,
      actualWins: 0,
      actualLosses: 0,
      actualTies: 0,
      allPlayWins: 0,
      allPlayLosses: 0,
      allPlayTies: 0,
      crowns: 0,
      cellars: 0,
      pointsFor: 0,
    };
    acc.set(team.id, fresh);
    return fresh;
  };

  for (const game of games) {
    if (game.week > 14) continue; // regular season only
    for (const [self, opp] of [
      [game.home, game.away],
      [game.away, game.home],
    ] as const) {
      const team = self.team;
      if (!team) continue;
      const rec = ensure(team);
      rec.weeks += 1;
      rec.pointsFor += self.total;
      if (self.total > opp.total) rec.actualWins += 1;
      else if (self.total < opp.total) rec.actualLosses += 1;
      else rec.actualTies += 1;

      const key = `${game.season}-${game.week}`;
      const bucket = weekGroups.get(key) ?? [];
      bucket.push({ id: team.id, score: self.total });
      weekGroups.set(key, bucket);
    }
  }

  for (const bucket of weekGroups.values()) {
    const max = Math.max(...bucket.map((entry) => entry.score));
    const min = Math.min(...bucket.map((entry) => entry.score));
    for (const entry of bucket) {
      const rec = acc.get(entry.id);
      if (!rec) continue;
      for (const other of bucket) {
        if (other === entry) continue;
        if (entry.score > other.score) rec.allPlayWins += 1;
        else if (entry.score < other.score) rec.allPlayLosses += 1;
        else rec.allPlayTies += 1;
      }
      if (entry.score === max) rec.crowns += 1;
      if (entry.score === min) rec.cellars += 1;
    }
  }

  return [...acc.values()]
    .map((rec) => {
      const actualGames = rec.actualWins + rec.actualLosses + rec.actualTies;
      const allPlayGames = rec.allPlayWins + rec.allPlayLosses + rec.allPlayTies;
      const actualPct = actualGames ? rec.actualWins / actualGames : 0;
      const allPlayPct = allPlayGames ? rec.allPlayWins / allPlayGames : 0;
      const expectedWins = allPlayPct * rec.weeks;
      return {
        team: rec.team,
        weeks: rec.weeks,
        actualWins: rec.actualWins,
        actualLosses: rec.actualLosses,
        actualTies: rec.actualTies,
        actualPct: round(actualPct),
        allPlayWins: rec.allPlayWins,
        allPlayLosses: rec.allPlayLosses,
        allPlayTies: rec.allPlayTies,
        allPlayPct: round(allPlayPct),
        expectedWins: round(expectedWins),
        luckWins: round(rec.actualWins - expectedWins),
        crowns: rec.crowns,
        cellars: rec.cellars,
        pointsFor: round(rec.pointsFor),
        avgPointsFor: rec.weeks ? round(rec.pointsFor / rec.weeks) : 0,
      };
    })
    .sort((a, b) => b.allPlayPct - a.allPlayPct || b.pointsFor - a.pointsFor);
}

// --- Positional Firepower ----------------------------------------------------
// Where does each franchise's scoring actually come from? Sums the points of
// STARTED players by position across every counting game, exposing whether a
// team wins on QB play, running backs, receivers, etc.

export const INSIGHT_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
export type InsightPosition = (typeof INSIGHT_POSITIONS)[number];

export interface PositionRow {
  team: TeamMeta;
  total: number;
  byPos: Record<InsightPosition, number>;
  shareByPos: Record<InsightPosition, number>;
  /** Position this franchise leans on most, by share of points. */
  topPos: InsightPosition;
}

export interface PositionalBreakdown {
  rows: PositionRow[];
  /** League-wide share of all started-player points by position (0–1). */
  leagueShare: Record<InsightPosition, number>;
  leagueAvgPerPos: Record<InsightPosition, number>;
  positions: readonly InsightPosition[];
}

function zeroByPos(): Record<InsightPosition, number> {
  return { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
}

function normalizePos(pos: string): InsightPosition | null {
  const upper = pos.toUpperCase();
  if (upper === "DST" || upper === "D/ST") return "DEF";
  return (INSIGHT_POSITIONS as readonly string[]).includes(upper) ? (upper as InsightPosition) : null;
}

/** Scoring-by-position for every franchise, plus the league baseline, across
 *  all counting games (regular season + championship bracket). */
export async function getPositionalBreakdown(): Promise<PositionalBreakdown> {
  const games = await getCountingGames();
  const byTeam = new Map<number, { team: TeamMeta; byPos: Record<InsightPosition, number> }>();
  const leagueTotals = zeroByPos();

  for (const game of games) {
    for (const side of [game.home, game.away]) {
      const team = side.team;
      if (!team) continue;
      const rec = byTeam.get(team.id) ?? { team, byPos: zeroByPos() };
      for (const player of side.players) {
        if (!player.started) continue;
        const pos = normalizePos(player.pos);
        if (!pos) continue;
        rec.byPos[pos] += player.points;
        leagueTotals[pos] += player.points;
      }
      byTeam.set(team.id, rec);
    }
  }

  const leagueGrand = INSIGHT_POSITIONS.reduce((sum, pos) => sum + leagueTotals[pos], 0);
  const teamCount = byTeam.size || 1;

  const rows: PositionRow[] = [...byTeam.values()]
    .map(({ team, byPos }) => {
      const total = INSIGHT_POSITIONS.reduce((sum, pos) => sum + byPos[pos], 0);
      const shareByPos = zeroByPos();
      let topPos: InsightPosition = "QB";
      for (const pos of INSIGHT_POSITIONS) {
        shareByPos[pos] = total ? round((byPos[pos] / total) * 100) / 100 : 0;
        byPos[pos] = round(byPos[pos]);
        if (byPos[pos] > byPos[topPos]) topPos = pos;
      }
      return { team, total: round(total), byPos, shareByPos, topPos };
    })
    .sort((a, b) => b.total - a.total);

  const leagueShare = zeroByPos();
  const leagueAvgPerPos = zeroByPos();
  for (const pos of INSIGHT_POSITIONS) {
    leagueShare[pos] = leagueGrand ? round((leagueTotals[pos] / leagueGrand) * 100) / 100 : 0;
    leagueAvgPerPos[pos] = round(leagueTotals[pos] / teamCount);
  }

  return { rows, leagueShare, leagueAvgPerPos, positions: INSIGHT_POSITIONS };
}
