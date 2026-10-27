import historyJson from "@/data/odds-history/2026.json";
import { CURRENT_SEASON } from "./league-data";
import { simulateMarkets, type MarketKey } from "./superbowl-odds";
import { TEAMS } from "./teams";
import type { Standing, TeamId, TeamMeta } from "./types";

// ---------------------------------------------------------------------------
// The futures board as a season-long line rather than a single price.
//
// scripts/build-odds-history.mjs stores the ladder as it stood after every
// completed week. Replaying lib/superbowl-odds.ts's Monte Carlo against each of
// those snapshots gives every franchise's chance in every market week by week —
// the same shape as a matchup's win-probability replay, stretched over a season.
//
// Nothing here re-implements the model: the snapshot is the only thing stored,
// and the odds come out of the board's own simulation. Change the model and
// these curves move with it.
// ---------------------------------------------------------------------------

/** One stored ladder snapshot. */
interface SnapshotTeam {
  teamId: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

interface Snapshot {
  week: number;
  standings: SnapshotTeam[];
}

/** Sims per replayed week. The board itself runs 20k for a price that has to
 *  stand up to the cent; a curve only has to be readable, and nine weeks of 20k
 *  is work nobody sees. At 6k the standard error on a 10% chance is ~0.4pp —
 *  under half a pixel on a 280-unit chart. */
const SIMULATIONS = 6_000;

export interface OddsPoint {
  /** 0 is the pre-season board, before a ball is kicked. */
  week: number;
  /** Chance of landing the market, 0-1. */
  p: number;
  wins: number;
  losses: number;
  ties: number;
}

export interface OddsSeries {
  team: TeamMeta;
  points: OddsPoint[];
  /** Where the line sits now, and where it opened — the two ends of the story. */
  current: number;
  opening: number;
}

export interface OddsHistory {
  season: number;
  /** Weeks replayed, not counting the pre-season point. */
  completedWeeks: number;
  simulations: number;
  /** One series per franchise, longest-priced last. */
  series: Record<MarketKey, OddsSeries[]>;
}

const snapshots = (historyJson as { season: number; weeks: Snapshot[] }).weeks;

/** A stored snapshot inflated into the `Standing[]` the simulator expects.
 *  Only wins/ties/pointsFor are read by the model; the rest of the shape is
 *  filled in so the snapshot can be passed straight through. */
function standingsFor(snapshot: Snapshot | null): Standing[] {
  const byTeam = new Map((snapshot?.standings ?? []).map((s) => [s.teamId, s]));

  return TEAMS.map((team) => {
    const row = byTeam.get(team.id);
    const wins = row?.wins ?? 0;
    const losses = row?.losses ?? 0;
    const ties = row?.ties ?? 0;
    const games = wins + losses + ties;

    return {
      team,
      rank: 0,
      wins,
      losses,
      ties,
      pct: games ? wins / games : 0,
      streak: "—",
      pointsFor: row?.pointsFor ?? 0,
      pointsAgainst: row?.pointsAgainst ?? 0,
      change: 0,
    } satisfies Standing;
  });
}

const MARKET_KEYS: MarketKey[] = ["title", "final", "playoffs", "topSeed", "spoon"];

let cache: OddsHistory | null = null;

/** Every market's week-by-week line. Built once per process — the snapshots are
 *  a committed file and the simulation is seeded, so the result never changes
 *  between calls. */
export function getOddsHistory(): OddsHistory {
  if (cache) return cache;

  // Week 0 is the opening board: no results, so the model is pure projection.
  const weeks: (Snapshot | null)[] = [null, ...snapshots];

  // [week index][team index] -> chances
  const runs = weeks.map((snapshot) => {
    const standings = standingsFor(snapshot);
    return {
      standings,
      chances: simulateMarkets(standings, snapshot?.week ?? 0, SIMULATIONS),
    };
  });

  const series = {} as Record<MarketKey, OddsSeries[]>;

  for (const market of MARKET_KEYS) {
    series[market] = TEAMS.map((team, i) => {
      const points = runs.map((run, w) => ({
        week: w,
        p: run.chances[i][market],
        wins: run.standings[i].wins,
        losses: run.standings[i].losses,
        ties: run.standings[i].ties,
      }));

      return {
        team,
        points,
        current: points[points.length - 1].p,
        opening: points[0].p,
      } satisfies OddsSeries;
    }).sort((a, b) => b.current - a.current || b.opening - a.opening);
  }

  cache = {
    season: (historyJson as { season: number }).season ?? CURRENT_SEASON,
    completedWeeks: snapshots.length,
    simulations: SIMULATIONS,
    series,
  };
  return cache;
}

/** The biggest move in a market since the opening board — the line that tells
 *  the season's story so far.
 *
 *  `exclude` keeps the pick off a franchise that is already on screen: the
 *  favourite of a thin market is usually also the one that has moved furthest,
 *  and two tiles showing the same team say half as much as two showing two.
 *  Returns null before anything has been played. */
export function biggestMover(
  series: OddsSeries[],
  exclude?: TeamId,
): { team: TeamMeta; change: number } | null {
  let best: { team: TeamMeta; change: number } | null = null;
  for (const s of series) {
    if (s.team.id === exclude) continue;
    const change = s.current - s.opening;
    if (!best || Math.abs(change) > Math.abs(best.change)) best = { team: s.team, change };
  }
  return best && Math.abs(best.change) >= 0.001 ? best : null;
}

export function teamIdsInOrder(series: OddsSeries[]): TeamId[] {
  return series.map((s) => s.team.id);
}
