import type { Matchup, TeamId } from "./types";

// ---------------------------------------------------------------------------
// Novelty sportsbook lines for MGL fixtures.
//
// These odds are FAKE. Nothing here touches money, a real book, or a real
// market — it is a bit of scoreboard flavour, off by default and switched on
// per-device in Settings ("Betting odds").
//
// Everything is derived deterministically from the matchup, so the same game
// always shows the same line on the server and on the client (no Math.random,
// no Date.now — those would cause hydration mismatches).
// ---------------------------------------------------------------------------

/** All-time points-for per game, 2021-2025 (from data/history.json via
 *  getAllTimeRecords). Recomputed by hand when a season is added — a static
 *  table keeps this module dependency-free so it can render inside client
 *  components without pulling history.json into the browser bundle. */
const POWER_RATING: Record<TeamId, number> = {
  1: 119.76, // Dimmy
  2: 129.4, // Thomo
  3: 106.19, // De'Aaron Cronin
  4: 118.03, // GinniVan Jefferson
  5: 112.87, // Lavar Balls
  6: 119.31, // Monke Vengeance
  7: 110.81, // Tinkle Van Ginkel
  8: 116.42, // Dalts
  9: 119.6, // Paho
  10: 107.61, // ChiChi
  11: 114.95, // Brownlowrowbottom
  12: 104.36, // Lucky Bison
};

/** League-wide points-for per game across 2021-2025. Used for franchises with
 *  no history (placeholder rosters with a negative id). */
const LEAGUE_AVERAGE = 115.17;

/** Standard deviation of a weekly head-to-head margin. A fantasy team's weekly
 *  score swings by roughly 25 points, so the margin between two of them swings
 *  by about sqrt(2) x that. Drives how a spread converts into a win %. */
const MARGIN_SD = 34;

/** Total juice baked into the two moneylines — they imply ~104.5% together,
 *  the same hold a real book takes on a two-way market. */
const VIG = 0.045;

/** Standard price on either side of the spread and the total. */
export const STANDARD_JUICE = -110;

export interface SideOdds {
  /** Spread from this team's perspective, e.g. -6.5 for a favourite. */
  spread: number;
  /** American moneyline, e.g. -240 or +195. */
  moneyline: number;
  /** Implied (vig-free) chance of winning, 0-1. */
  winProbability: number;
  /** Projected score used to build the line. */
  projected: number;
}

export interface MatchupOdds {
  away: SideOdds;
  home: SideOdds;
  /** Over/under on the combined score. */
  total: number;
  /** Which side is favoured; null when the spread lands on pick'em. */
  favorite: "home" | "away" | null;
}

/** Deterministic 32-bit hash — the seed for a matchup's weekly "form" wobble. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Form swing for a team in a given week: a repeatable value in [-4, +4] that
 *  stops every meeting of two teams from producing an identical line. Kept
 *  smaller than the gaps between power ratings so form rarely flips a
 *  mismatch — the better franchise should still be favoured. */
function formAdjustment(teamId: TeamId, week: number): number {
  const unit = hash(`mgl-form:${teamId}:${week}`) / 0xffffffff;
  return Math.round((unit * 8 - 4) * 10) / 10;
}

function rating(teamId: TeamId): number {
  return POWER_RATING[teamId] ?? LEAGUE_AVERAGE;
}

/** Normal CDF (Abramowitz & Stegun 7.1.26 error-function approximation). */
function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/** Convert a win probability into an American moneyline, rounded like a book. */
function toMoneyline(probability: number): number {
  const p = Math.min(Math.max(probability, 0.02), 0.98);
  const raw = p >= 0.5 ? -(100 * p) / (1 - p) : (100 * (1 - p)) / p;
  const rounded = Math.round(raw / 5) * 5;
  return Math.max(-2500, Math.min(2500, rounded));
}

const toHalfPoint = (n: number) => Math.round(n * 2) / 2;

/** Build the (fake) line for one matchup. Pure and deterministic. */
export function getMatchupOdds(matchup: Matchup): MatchupOdds {
  const { week, away, home } = matchup;

  const awayProjected = rating(away.team.id) + formAdjustment(away.team.id, week);
  const homeProjected = rating(home.team.id) + formAdjustment(home.team.id, week);

  const homeMargin = toHalfPoint(homeProjected - awayProjected);
  const total = toHalfPoint(awayProjected + homeProjected);

  // Price the moneyline off the same margin the spread is built from.
  const homeWinProbability = normalCdf(homeMargin / MARGIN_SD);
  const awayWinProbability = 1 - homeWinProbability;

  return {
    away: {
      spread: homeMargin,
      moneyline: toMoneyline(awayWinProbability + VIG / 2),
      winProbability: awayWinProbability,
      projected: Math.round(awayProjected * 10) / 10,
    },
    home: {
      spread: -homeMargin,
      moneyline: toMoneyline(homeWinProbability + VIG / 2),
      winProbability: homeWinProbability,
      projected: Math.round(homeProjected * 10) / 10,
    },
    total,
    favorite: homeMargin === 0 ? null : homeMargin > 0 ? "home" : "away",
  };
}

/** "-6.5" / "+6.5" / "PK" — how a book prints a spread. */
export function formatSpread(spread: number): string {
  if (spread === 0) return "PK";
  return `${spread > 0 ? "+" : "-"}${Math.abs(spread).toFixed(1)}`;
}

/** "-240" / "+195" — American odds always carry their sign. */
export function formatMoneyline(moneyline: number): string {
  return `${moneyline > 0 ? "+" : "-"}${Math.abs(moneyline)}`;
}
