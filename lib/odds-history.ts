import historyJson from "@/data/odds-history/2026.json";
import { CURRENT_SEASON } from "./league-data";
import { simulateMarkets, type LiveMatchup, type MarketKey } from "./superbowl-odds";
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

/** An end-of-day snapshot, which can land mid-week: finished matchups are in
 *  the standings, anything still being played is carried alongside. */
interface DaySnapshot {
  date: string;
  scheduleFromWeek: number;
  pending: { away: number; home: number }[];
  standings: SnapshotTeam[];
  live: LiveMatchup[];
}

export type Granularity = "week" | "day";

/** Sims per replayed week. The board itself runs 20k for a price that has to
 *  stand up to the cent; a curve only has to be readable, and nine weeks of 20k
 *  is work nobody sees. At 6k the standard error on a 10% chance is ~0.4pp —
 *  under half a pixel on a 280-unit chart. */
const SIMULATIONS = 6_000;

/** The day view runs seven times as many boards as the week view, so it trades
 *  some precision for the build staying quick. At 3k the standard error on a
 *  10% chance is ~0.5pp, and because the run is seeded, two days with the same
 *  ladder return byte-identical numbers — a flat stretch stays flat rather than
 *  shimmering with sampling noise. */
const DAY_SIMULATIONS = 3_000;

export interface OddsPoint {
  /** Chance of landing the market, 0-1. */
  p: number;
  /** Short x-axis tick, e.g. "W3" or "14 Sep". */
  tick: string;
  /** What the footer reads out when this point is scrubbed to. */
  label: string;
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
  days: number;
  simulations: number;
  /** One series per franchise, longest-priced last, per granularity. */
  series: Record<Granularity, Record<MarketKey, OddsSeries[]>>;
}

const history = historyJson as { season: number; weeks: Snapshot[]; days?: DaySnapshot[] };
const snapshots = history.weeks;
const dailySnapshots = history.days ?? [];

/** A stored snapshot inflated into the `Standing[]` the simulator expects.
 *  Only wins/ties/pointsFor are read by the model; the rest of the shape is
 *  filled in so the snapshot can be passed straight through. */
function standingsFor(snapshot: { standings: SnapshotTeam[] } | null): Standing[] {
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

const OPENING = { tick: "Pre", label: "Opening board, before Week 1" };

const fmtDayTick = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtDayLabel = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** One point on a curve: the board run off a single snapshot. */
interface Run {
  chances: Record<MarketKey, number>[];
  tick: string;
  label: string;
}

/** Turn a list of runs into one sorted series per market. */
function seriesFrom(runs: Run[]): Record<MarketKey, OddsSeries[]> {
  const out = {} as Record<MarketKey, OddsSeries[]>;

  for (const market of MARKET_KEYS) {
    out[market] = TEAMS.map((team, i) => {
      const points = runs.map((run) => ({
        p: run.chances[i][market],
        tick: run.tick,
        label: run.label,
      }));

      return {
        team,
        points,
        current: points[points.length - 1].p,
        opening: points[0].p,
      } satisfies OddsSeries;
    }).sort((a, b) => b.current - a.current || b.opening - a.opening);
  }

  return out;
}

/** The opening board, shared by both granularities: no results at all, so the
 *  model is pure projection. */
function openingRun(simulations: number): Run {
  return { chances: simulateMarkets(standingsFor(null), 0, simulations), ...OPENING };
}

/** Every market's line at both granularities. Built once per process — the
 *  snapshots are a committed file and the simulation is seeded, so the result
 *  never changes between calls. */
export function getOddsHistory(): OddsHistory {
  if (cache) return cache;

  const byWeek: Run[] = [
    openingRun(SIMULATIONS),
    ...snapshots.map((snapshot) => ({
      chances: simulateMarkets(standingsFor(snapshot), snapshot.week, SIMULATIONS),
      tick: `W${snapshot.week}`,
      label: `After Week ${snapshot.week}`,
    })),
  ];

  const byDay: Run[] = [
    openingRun(DAY_SIMULATIONS),
    ...dailySnapshots.map((day) => {
      // Dates are stored as plain league-local days, so they are read back in
      // UTC — parsing them in the viewer's zone would slide the label a day.
      const at = new Date(`${day.date}T00:00:00Z`);
      return {
        chances: simulateMarkets(standingsFor(day), day.scheduleFromWeek - 1, DAY_SIMULATIONS, {
          live: day.live,
          pending: day.pending,
        }),
        tick: fmtDayTick.format(at),
        label: fmtDayLabel.format(at) + (day.live.length ? ` — ${day.live.length} live` : ""),
      };
    }),
  ];

  cache = {
    season: history.season ?? CURRENT_SEASON,
    completedWeeks: snapshots.length,
    days: dailySnapshots.length,
    simulations: SIMULATIONS,
    series: { week: seriesFrom(byWeek), day: seriesFrom(byDay) },
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
