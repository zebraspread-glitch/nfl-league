import { getMatchupOdds } from "./odds";
import type { Matchup, TeamMeta } from "./types";

// ---------------------------------------------------------------------------
// Season predictor: pick a winner and a margin for all 84 regular-season games,
// see the ladder it produces, then play out the six-team finals bracket.
//
// Pure and client-safe — no data imports, no randomness. Every game starts with
// a default pick derived from the same simulated line the odds strip shows, so
// the ladder and bracket are complete before the user has touched anything.
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

/** The default pick for a game: the simulated favourite, by the spread. */
export function defaultPick(matchup: Matchup): Pick {
  const odds = getMatchupOdds(matchup);
  const favorite = odds.favorite === "away" ? matchup.away.team.id : matchup.home.team.id;
  const margin = Math.max(1, Math.round(Math.abs(odds.home.spread)));
  return { winnerId: favorite, margin };
}

export function pickFor(matchup: Matchup, picks: PickMap): Pick {
  return picks[matchup.id] ?? defaultPick(matchup);
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
    const pick = pickFor(matchup, picks);
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
