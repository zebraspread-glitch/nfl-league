import { getMatchupOdds } from "./odds";
import type { Matchup, TeamMeta } from "./types";

// ---------------------------------------------------------------------------
// Season predictor: pick a winner and a margin for all 84 regular-season games,
// see the ladder it produces, then play out the six-team finals bracket.
//
// Pure and client-safe — no data imports. Untipped games fall back to a model
// pick derived from the same simulated line the odds strip shows, so you can
// tip as many or as few games as you like and still get a complete ladder.
// ---------------------------------------------------------------------------

export const REGULAR_SEASON_WEEKS = 14;
export const FINALS_TEAMS = 6;
export const MAX_MARGIN = 60;

export interface Pick {
  winnerId: number;
  margin: number;
}

export type PickMap = Record<string, Pick>;

export interface LadderRow {
  seed: number;
  team: TeamMeta;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Points differential — the fantasy equivalent of AFL percentage. */
  diff: number;
}

/** The model's line for a game — the shape of the tipping bar's curve. */
export function modelLine(matchup: Matchup): { mean: number; sd: number; homeWinProbability: number } {
  const odds = getMatchupOdds(matchup);
  return { mean: -odds.home.spread, sd: MARGIN_SD, homeWinProbability: odds.home.winProbability };
}

/** Spread of a single game's margin, used to sample AutoTip results. */
const MARGIN_SD = 34;

/** The model's pick for a game. A user pick overrides this, but untipped games
 *  still contribute to the ladder using this baseline. */
export function modelPick(matchup: Matchup): Pick {
  const line = modelLine(matchup);
  return {
    winnerId: line.mean >= 0 ? matchup.home.team.id : matchup.away.team.id,
    margin: clampMargin(Math.round(Math.abs(line.mean)) || 1),
  };
}

export function effectivePick(matchup: Matchup, picks: PickMap): Pick {
  return picks[matchup.id] ?? modelPick(matchup);
}

/** Split a projected total into the two scores a margin implies. */
export function scoresFor(matchup: Matchup, pick: Pick): { winner: number; loser: number } {
  const { total } = getMatchupOdds(matchup);
  const winner = (total + pick.margin) / 2;
  return { winner: round2(winner), loser: round2(total - winner) };
}

export function buildLadder(matchups: Matchup[], picks: PickMap, teams: TeamMeta[]): LadderRow[] {
  const rows = new Map<number, LadderRow>(
    teams.map((team) => [
      team.id,
      { seed: 0, team, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, diff: 0 },
    ]),
  );

  for (const matchup of matchups) {
    const pick = effectivePick(matchup, picks);
    const { winner: winnerScore, loser: loserScore } = scoresFor(matchup, pick);
    const winnerId = pick.winnerId;
    const loserId = winnerId === matchup.home.team.id ? matchup.away.team.id : matchup.home.team.id;

    const winner = rows.get(winnerId);
    const loser = rows.get(loserId);
    if (!winner || !loser) continue;

    winner.wins += 1;
    winner.pointsFor += winnerScore;
    winner.pointsAgainst += loserScore;
    loser.losses += 1;
    loser.pointsFor += loserScore;
    loser.pointsAgainst += winnerScore;
  }

  // League tiebreak: wins, then points for.
  return [...rows.values()]
    .map((r) => ({
      ...r,
      pointsFor: round2(r.pointsFor),
      pointsAgainst: round2(r.pointsAgainst),
      diff: round2(r.pointsFor - r.pointsAgainst),
    }))
    .sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor || a.team.name.localeCompare(b.team.name))
    .map((row, i) => ({ ...row, seed: i + 1 }));
}

/* -------------------------------------------------------------------------- */
/* AutoTip                                                                     */
/*                                                                             */
/* Tipping every favourite produces a fantasy ladder, not a realistic one — a  */
/* team that wins 60% of its games should finish about 8-6, not 14-0. So we    */
/* simulate the remaining season many times, letting upsets fall where the     */
/* probabilities say they should, then keep the single simulation closest to   */
/* the average of all of them: a "typical" season rather than a lucky one.     */
/* (Same approach Squiggle's AutoTip documents.)                               */
/* -------------------------------------------------------------------------- */

const AUTOTIP_SIMS = 4000;

/** Small, fast, seedable PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One standard normal draw (Box-Muller). */
function normal(next: () => number): number {
  const u1 = Math.max(next(), 1e-9);
  const u2 = next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Fill in every game that has no pick yet, keeping the ones already made. */
export function autoTip(matchups: Matchup[], picks: PickMap, seed = Date.now()): PickMap {
  const remaining = matchups.filter((m) => !picks[m.id]);
  if (!remaining.length) return picks;

  const lines = remaining.map((m) => ({ matchup: m, ...modelLine(m) }));
  const teamIds = [...new Set(matchups.flatMap((m) => [m.away.team.id, m.home.team.id]))];
  const index = new Map(teamIds.map((id, i) => [id, i]));

  const next = rng(seed);
  const sims: { picks: Pick[]; wins: number[] }[] = [];
  const meanWins = new Array(teamIds.length).fill(0);

  for (let s = 0; s < AUTOTIP_SIMS; s++) {
    const simPicks: Pick[] = [];
    const wins = new Array(teamIds.length).fill(0);

    for (const line of lines) {
      // Draw a margin from the game's own distribution; its sign picks the winner.
      const margin = line.mean + normal(next) * line.sd;
      const homeWins = margin >= 0;
      const winnerId = homeWins ? line.matchup.home.team.id : line.matchup.away.team.id;
      simPicks.push({ winnerId, margin: clampMargin(Math.round(Math.abs(margin))) });
      wins[index.get(winnerId)!] += 1;
    }

    sims.push({ picks: simPicks, wins });
    for (let i = 0; i < wins.length; i++) meanWins[i] += wins[i] / AUTOTIP_SIMS;
  }

  // Keep the simulation whose win totals sit closest to the average season.
  let best = sims[0];
  let bestDistance = Infinity;
  for (const sim of sims) {
    let distance = 0;
    for (let i = 0; i < sim.wins.length; i++) distance += (sim.wins[i] - meanWins[i]) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = sim;
    }
  }

  const next_ = { ...picks };
  remaining.forEach((m, i) => {
    next_[m.id] = best.picks[i];
  });
  return next_;
}

export function clampMargin(margin: number): number {
  return Math.min(MAX_MARGIN, Math.max(1, margin));
}

export type FinalsSlotId = "qf-1" | "qf-2" | "sf-1" | "sf-2" | "final";

export interface FinalsGame {
  id: FinalsSlotId;
  round: "Quarterfinal" | "Semifinal" | "Final";
  week: number;
  /** Higher seed first. Undefined while an earlier round is undecided. */
  a?: { team: TeamMeta; seed: number };
  b?: { team: TeamMeta; seed: number };
}

export interface Finals {
  byes: { team: TeamMeta; seed: number }[];
  games: FinalsGame[];
  championId?: number;
}

/** Text version of the ladder, for the copy-to-clipboard button. */
export function ladderText(rows: LadderRow[], season: number): string {
  const lines = rows.map((r) => {
    const seed = String(r.seed).padStart(2);
    const name = r.team.name.padEnd(20);
    const record = `${r.wins}-${r.losses}`.padStart(5);
    const diff = `${r.diff > 0 ? "+" : ""}${r.diff.toFixed(0)}`.padStart(6);
    return `${seed}  ${name}${record}${diff}`;
  });
  return [`MGL ${season} predicted ladder`, "", ...lines].join("\n");
}

/** Six-team bracket: seeds 1-2 get a bye, 3v6 and 4v5 in the quarterfinals,
 *  then the semifinals reseed so the top seed draws the lowest survivor. */
export function buildFinals(ladder: LadderRow[], picks: PickMap): Finals {
  const seedOf = (row: LadderRow) => ({ team: row.team, seed: row.seed });
  const top = ladder.slice(0, FINALS_TEAMS).map(seedOf);
  if (top.length < FINALS_TEAMS) return { byes: [], games: [] };

  const [one, two, three, four, five, six] = top;

  const qf1: FinalsGame = { id: "qf-1", round: "Quarterfinal", week: 15, a: three, b: six };
  const qf2: FinalsGame = { id: "qf-2", round: "Quarterfinal", week: 15, a: four, b: five };

  const qf1Winner = resolve(qf1, picks);
  const qf2Winner = resolve(qf2, picks);

  // Reseed: the best remaining seed plays the worst remaining seed.
  const survivors = [qf1Winner, qf2Winner].filter(Boolean) as { team: TeamMeta; seed: number }[];
  survivors.sort((a, b) => a.seed - b.seed);
  const [betterSurvivor, worseSurvivor] = survivors;

  const sf1: FinalsGame = { id: "sf-1", round: "Semifinal", week: 16, a: one, b: worseSurvivor };
  const sf2: FinalsGame = { id: "sf-2", round: "Semifinal", week: 16, a: two, b: betterSurvivor };

  const sf1Winner = resolve(sf1, picks);
  const sf2Winner = resolve(sf2, picks);
  const finalists = [sf1Winner, sf2Winner].filter(Boolean) as { team: TeamMeta; seed: number }[];
  finalists.sort((a, b) => a.seed - b.seed);

  const final: FinalsGame = { id: "final", round: "Final", week: 17, a: finalists[0], b: finalists[1] };
  const champion = resolve(final, picks);

  return {
    byes: [one, two],
    games: [qf1, qf2, sf1, sf2, final],
    championId: champion?.team.id,
  };
}

/** Who wins a finals game — the stored pick if it is still a participant,
 *  otherwise the higher seed. Reseeding can invalidate an older pick. */
export function resolveFinalsPick(game: FinalsGame, picks: PickMap): Pick | undefined {
  if (!game.a || !game.b) return undefined;
  const stored = picks[game.id];
  const valid = stored && (stored.winnerId === game.a.team.id || stored.winnerId === game.b.team.id);
  return valid ? stored : { winnerId: game.a.team.id, margin: DEFAULT_FINALS_MARGIN };
}

export const DEFAULT_FINALS_MARGIN = 8;

function resolve(game: FinalsGame, picks: PickMap) {
  const pick = resolveFinalsPick(game, picks);
  if (!pick || !game.a || !game.b) return undefined;
  return pick.winnerId === game.a.team.id ? game.a : game.b;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
