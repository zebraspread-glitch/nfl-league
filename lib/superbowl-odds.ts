import { CURRENT_SEASON, getAllTimeRecords, getCurrentSeasonMatchups } from "./league-data";
import { completedWeeksFromStandings, PLAYOFF_CUTOFF, REGULAR_SEASON_WEEKS } from "./playoff-simulator";
import { getStandings } from "./sleeper";
import { TEAMS } from "./teams";
import type { Standing, TeamMeta, TeamId } from "./types";

// ---------------------------------------------------------------------------
// Title futures for the MGL Book.
//
// Same disclaimer as lib/odds.ts: these prices are FAKE. No money, no real
// book, no real market — just the season-long version of the novelty lines the
// scoreboard already carries.
//
// The board comes out of a Monte Carlo run: every remaining fixture is played
// out thousands of times, the ladder is cut at six, and the bracket is played
// to a champion. Counting how often each franchise lifts the trophy gives the
// probability; the price is that probability with a book's margin on top.
//
// The ratings the run is driven off are fitted to the league's own projected
// title odds — see PRESEASON_RATING — so the title market opens where the
// projection board has it and every other market falls out of the same run.
//
// The whole run is seeded, so a rebuild produces the same board rather than
// numbers that twitch on every revalidate.
// ---------------------------------------------------------------------------

/** How many seasons get played out. At 20k the standard error on a ~10% chance
 *  is ~0.2 percentage points — tighter than anything the board prints. */
const SIMULATIONS = 20_000;

/** Standard deviation of one franchise's weekly score. lib/odds.ts calibrates a
 *  head-to-head margin at SD 50 against Sleeper's own win percentages, and two
 *  independent scores make that margin, so each side carries 50/sqrt(2) ~= 35. */
const TEAM_SCORE_SD = 50 / Math.SQRT2;

/** The point every rating is measured against — the mean of the table below. */
const LEAGUE_AVERAGE_RATING = 115;

/** Where each franchise starts the season, in points per game.
 *
 *  These are not raw scoring rates. They are solved backwards from the title
 *  odds the league's own projection board carries, so that running the Monte
 *  Carlo below on this fixture reproduces those odds to within a fraction of a
 *  point — Monke 36%, GinniVan 16%, Thomo 15%, and so on down to Lucky Bison at
 *  0.5%. Dimmy is the one hand-set number: the projection board had the
 *  franchise under 1% and it is priced here at 8% instead, with the rest of the
 *  field renormalised around it so the twelve chances still add to 100%.
 *
 *  Refitting: change the targets, re-solve, and paste the new table in. The
 *  spread is deliberately wider than real scoring — it encodes roster strength,
 *  not a literal prediction of how many points a franchise puts up. */
const PRESEASON_RATING: Record<TeamId, number> = {
  1: 118.7, // Dimmy
  2: 124.9, // Thomo
  3: 111.5, // De'Aaron Cronin
  4: 126.4, // GinniVan Jefferson
  5: 102.5, // Lavar Balls
  6: 137.9, // Monke Vengeance
  7: 116.5, // Tinkle Van Ginkel
  8: 115.0, // Dalts
  9: 102.4, // Paho
  10: 116.2, // ChiChi
  11: 108.2, // Brownlowrowbottom
  12: 99.9, // Lucky Bison
};

/** Games of the current season needed before results outweigh the preseason
 *  rating. At `n` games played the season carries n/(n+PRIOR_GAMES), so Week 1
 *  is almost pure projection and by Week 12 the board is mostly what has
 *  actually happened — which is the point of a market that moves. */
const PRIOR_GAMES = 6;

/** Margin baked into a whole-league outright market — the twelve prices imply
 *  ~112% together, about what a real book holds on a futures board. */
const OUTRIGHT_OVERROUND = 1.12;

/** Margin on a yes/no market (makes the six, reaches the final): ~104.5%, the
 *  same hold lib/odds.ts takes on a two-way head-to-head. */
const TWO_WAY_OVERROUND = 1.045;

/** Longest price the board will print. Books cap futures rather than posting
 *  the four-figure numbers a raw model spits out for a dead franchise. */
const MAX_PRICE = 501;

const SEED = 0x4d474c21; // "MGL!"

export type MarketKey = "title" | "final" | "playoffs" | "topSeed" | "spoon";

export interface Market {
  key: MarketKey;
  /** Short label for the tab strip. */
  tab: string;
  /** Full market name for the board header. */
  title: string;
  /** One line explaining what the price settles on. */
  blurb: string;
  /** Outright markets price the whole league to ~112%; yes/no ones to ~104.5%. */
  type: "outright" | "yesno";
}

export const MARKETS: Market[] = [
  {
    key: "title",
    tab: "Title",
    title: "Fantasy Super Bowl Winner",
    blurb: "Outright winner of the 2026 MGL title",
    type: "outright",
  },
  {
    key: "final",
    tab: "Final",
    title: "To Reach the Final",
    blurb: "Wins a semi-final and plays for the trophy",
    type: "yesno",
  },
  {
    key: "playoffs",
    tab: "Top 6",
    title: "To Make the Playoffs",
    blurb: `Finishes the regular season inside the top ${PLAYOFF_CUTOFF}`,
    type: "yesno",
  },
  {
    key: "topSeed",
    tab: "Top Seed",
    title: "Minor Premiership",
    blurb: `Finishes Week ${REGULAR_SEASON_WEEKS} as the number one seed`,
    type: "outright",
  },
  {
    key: "spoon",
    tab: "Spoon",
    title: "Wooden Spoon",
    blurb: "Finishes the regular season dead last",
    type: "outright",
  },
];

const MARKET_BY_KEY = new Map(MARKETS.map((m) => [m.key, m]));

export function getMarket(key: string | undefined): Market {
  return MARKET_BY_KEY.get(key as MarketKey) ?? MARKETS[0];
}

export interface FuturesEntry {
  team: TeamMeta;
  /** Projected points per game — the rating every simulated score is drawn off. */
  rating: number;
  wins: number;
  losses: number;
  ties: number;
  /** Mean simulated wins after all 14 weeks. */
  projectedWins: number;
  /** Mean simulated finishing seed. */
  projectedSeed: number;
  /** Titles won 2021-2025. */
  championships: number;
  /** Chance of landing each market, 0-1, before the book's margin. */
  probability: Record<MarketKey, number>;
  /** Decimal price for each market, margin included. */
  price: Record<MarketKey, number>;
}

export interface FuturesBoard {
  season: number;
  /** Regular-season weeks already in the books. */
  completedWeeks: number;
  /** Fixtures still to be played across the whole league. */
  remainingGames: number;
  simulations: number;
  entries: FuturesEntry[];
}

/** How long a built board is reused. The page reads its market off
 *  `searchParams`, which makes the route dynamic, so without this the twenty
 *  thousand seasons would be replayed on every tab click. The run is a pure
 *  function of the standings, so serving a few-minute-old board can only ever
 *  cost freshness — never correctness — and it matches the page's revalidate. */
const BOARD_TTL_MS = 300_000;

let boardCache: { board: FuturesBoard; builtAt: number } | null = null;

/** Build the whole futures board — one Monte Carlo run, every market read off it. */
export async function getFuturesBoard(): Promise<FuturesBoard> {
  if (boardCache && Date.now() - boardCache.builtAt < BOARD_TTL_MS) return boardCache.board;

  const board = await buildFuturesBoard();
  boardCache = { board, builtAt: Date.now() };
  return board;
}

async function buildFuturesBoard(): Promise<FuturesBoard> {
  const standings = await getStandings();
  const completedWeeks = completedWeeksFromStandings(standings);
  const ratings = buildRatings(standings);
  const schedule = remainingSchedule(completedWeeks);
  const tally = simulate(ratings, standings, schedule);
  const titles = titlesByTeam();

  const entries = TEAMS.map((team, i) => {
    const probability: Record<MarketKey, number> = {
      title: tally.title[i] / SIMULATIONS,
      final: tally.final[i] / SIMULATIONS,
      playoffs: tally.playoffs[i] / SIMULATIONS,
      topSeed: tally.topSeed[i] / SIMULATIONS,
      spoon: tally.spoon[i] / SIMULATIONS,
    };
    const standing = standings.find((s) => s.team.id === team.id);

    return {
      team,
      rating: Math.round(ratings[i] * 10) / 10,
      wins: standing?.wins ?? 0,
      losses: standing?.losses ?? 0,
      ties: standing?.ties ?? 0,
      projectedWins: Math.round((tally.wins[i] / SIMULATIONS) * 10) / 10,
      projectedSeed: Math.round((tally.seed[i] / SIMULATIONS) * 10) / 10,
      championships: titles.get(team.id) ?? 0,
      probability,
      price: {
        title: priceFor(probability.title, "outright"),
        final: priceFor(probability.final, "yesno"),
        playoffs: priceFor(probability.playoffs, "yesno"),
        topSeed: priceFor(probability.topSeed, "outright"),
        spoon: priceFor(probability.spoon, "outright"),
      },
    } satisfies FuturesEntry;
  });

  return {
    season: CURRENT_SEASON,
    completedWeeks,
    remainingGames: schedule.length / 2,
    simulations: SIMULATIONS,
    entries,
  };
}

/** The board sorted for one market — shortest price first, ties split on rating. */
export function boardFor(board: FuturesBoard, market: MarketKey): FuturesEntry[] {
  return [...board.entries].sort(
    (a, b) => b.probability[market] - a.probability[market] || b.rating - a.rating
  );
}

/* -------------------------------------------------------------------------- */
/* Ratings                                                                    */
/* -------------------------------------------------------------------------- */

/** Points-per-game rating per franchise, in TEAMS order.
 *
 *  The preseason table is the spine. This season's actual scoring is folded in
 *  as it accumulates, so the board opens on the projected title odds and then
 *  drifts toward what the franchise is really putting up. */
function buildRatings(standings: Standing[]): Float64Array {
  const standingByTeam = new Map(standings.map((s) => [s.team.id, s]));

  const ratings = new Float64Array(TEAMS.length);
  TEAMS.forEach((team, i) => {
    const base = PRESEASON_RATING[team.id] ?? LEAGUE_AVERAGE_RATING;

    const standing = standingByTeam.get(team.id);
    const seasonGames = standing ? standing.wins + standing.losses + standing.ties : 0;
    const seasonRate = standing && seasonGames ? standing.pointsFor / seasonGames : base;
    const seasonWeight = seasonGames / (seasonGames + PRIOR_GAMES);

    ratings[i] = base * (1 - seasonWeight) + seasonRate * seasonWeight;
  });

  return ratings;
}

let titlesCache: Map<TeamId, number> | null = null;
function titlesByTeam(): Map<TeamId, number> {
  titlesCache ??= new Map(getAllTimeRecords().map((r) => [r.team.id, r.championships]));
  return titlesCache;
}

/* -------------------------------------------------------------------------- */
/* Schedule                                                                   */
/* -------------------------------------------------------------------------- */

/** Every fixture from the next week to Week 14, flattened into away/home pairs
 *  of TEAMS indexes — the shape the hot loop wants. */
function remainingSchedule(completedWeeks: number): Int32Array {
  const indexById = new Map(TEAMS.map((t, i) => [t.id, i]));
  const pairs: number[] = [];

  for (let week = completedWeeks + 1; week <= REGULAR_SEASON_WEEKS; week++) {
    for (const matchup of getCurrentSeasonMatchups(week)) {
      const away = indexById.get(matchup.away.team.id);
      const home = indexById.get(matchup.home.team.id);
      if (away === undefined || home === undefined) continue;
      pairs.push(away, home);
    }
  }

  return Int32Array.from(pairs);
}

/* -------------------------------------------------------------------------- */
/* Monte Carlo                                                                */
/* -------------------------------------------------------------------------- */

interface Tally {
  title: Int32Array;
  final: Int32Array;
  playoffs: Int32Array;
  topSeed: Int32Array;
  spoon: Int32Array;
  wins: Float64Array;
  seed: Float64Array;
}

function simulate(ratings: Float64Array, standings: Standing[], schedule: Int32Array): Tally {
  const n = TEAMS.length;
  const last = n - 1;
  const standingByTeam = new Map(standings.map((s) => [s.team.id, s]));

  const baseWins = new Float64Array(n);
  const basePoints = new Float64Array(n);
  TEAMS.forEach((team, i) => {
    const standing = standingByTeam.get(team.id);
    // A tie counts half a win, which is how the ladder already sorts them.
    baseWins[i] = (standing?.wins ?? 0) + (standing?.ties ?? 0) * 0.5;
    basePoints[i] = standing?.pointsFor ?? 0;
  });

  const tally: Tally = {
    title: new Int32Array(n),
    final: new Int32Array(n),
    playoffs: new Int32Array(n),
    topSeed: new Int32Array(n),
    spoon: new Int32Array(n),
    wins: new Float64Array(n),
    seed: new Float64Array(n),
  };

  const wins = new Float64Array(n);
  const points = new Float64Array(n);
  const order = Array.from({ length: n }, (_, i) => i);

  const random = mulberry32(SEED);
  const normal = gaussian(random);
  const score = (i: number) => ratings[i] + normal() * TEAM_SCORE_SD;
  const play = (a: number, b: number) => (score(a) >= score(b) ? a : b);

  for (let sim = 0; sim < SIMULATIONS; sim++) {
    wins.set(baseWins);
    points.set(basePoints);

    for (let g = 0; g < schedule.length; g += 2) {
      const away = schedule[g];
      const home = schedule[g + 1];
      const awayScore = score(away);
      const homeScore = score(home);
      points[away] += awayScore;
      points[home] += homeScore;
      if (awayScore >= homeScore) wins[away] += 1;
      else wins[home] += 1;
    }

    // Ladder: wins first, then points for — the league's own tiebreak.
    order.sort((a, b) => wins[b] - wins[a] || points[b] - points[a]);
    for (let i = 0; i < n; i++) {
      tally.seed[order[i]] += i + 1;
      tally.wins[i] += wins[i];
      if (i < PLAYOFF_CUTOFF) tally.playoffs[order[i]] += 1;
    }
    tally.topSeed[order[0]] += 1;
    tally.spoon[order[last]] += 1;

    // Six-team bracket: seeds 1 and 2 sit out the quarters, then the survivors
    // are reseeded so the top seed always draws the longest shot still alive.
    const thirdSixth = play(order[2], order[5]);
    const fourthFifth = play(order[3], order[4]);
    // Seed 6 surviving is the longest shot left; otherwise seed 3 came through
    // and whoever won 4 v 5 is the lower seed of the two.
    const lowerSeedIn = thirdSixth === order[5] ? thirdSixth : fourthFifth;
    const higherSeedIn = lowerSeedIn === thirdSixth ? fourthFifth : thirdSixth;

    const semiOne = play(order[0], lowerSeedIn);
    const semiTwo = play(order[1], higherSeedIn);
    tally.final[semiOne] += 1;
    tally.final[semiTwo] += 1;
    tally.title[play(semiOne, semiTwo)] += 1;
  }

  return tally;
}

/** Deterministic 32-bit PRNG — the same board on every rebuild. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draws (Box-Muller, keeping the second value of each pair). */
function gaussian(random: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    const u = Math.max(random(), Number.EPSILON);
    const v = random();
    const radius = Math.sqrt(-2 * Math.log(u));
    const angle = 2 * Math.PI * v;
    spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  };
}

/* -------------------------------------------------------------------------- */
/* Pricing                                                                    */
/* -------------------------------------------------------------------------- */

function priceFor(probability: number, type: Market["type"]): number {
  const overround = type === "outright" ? OUTRIGHT_OVERROUND : TWO_WAY_OVERROUND;
  const priced = probability * overround;
  if (priced <= 1 / MAX_PRICE) return MAX_PRICE;
  return Math.max(1.01, Math.min(MAX_PRICE, 1 / priced));
}

/** How a futures board prints a price: short ones carry cents, long ones don't.
 *  (lib/odds.ts always uses two places, but that market never gets past ~26.) */
export function formatPrice(price: number): string {
  if (price >= 50) return String(Math.round(price));
  if (price >= 10) return price.toFixed(1);
  return price.toFixed(2);
}

/** "12.4%" — the implied chance printed next to the price. Anything live but
 *  tiny reads "<0.1%" rather than rounding away to nothing. */
export function formatChance(probability: number): string {
  if (probability > 0 && probability < 0.001) return "<0.1%";
  return `${(probability * 100).toFixed(1)}%`;
}

/** "8-6" / "8-5-1" — a franchise's record so far. */
export function formatRecord(entry: FuturesEntry): string {
  return entry.ties ? `${entry.wins}-${entry.losses}-${entry.ties}` : `${entry.wins}-${entry.losses}`;
}
