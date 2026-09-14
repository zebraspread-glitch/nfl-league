import type { Matchup, Standing } from "./types";

// Sleeper only folds a week into each roster's W/L once that week finalises, so
// while games are being played the ladder lags a full round behind the
// scoreboard. The live ladders on /teams add the in-progress week to the
// confirmed record two ways:
//   live       every matchup settled on the score as it stands right now
//   projected  every matchup settled on Sleeper's projected final score

export type LiveLadderMode = "live" | "projected";

/** Mirrors the win percentage Sleeper's own standings are ranked on. */
function pct(wins: number, losses: number, ties: number): number {
  const games = wins + losses + ties;
  return games ? Math.round((wins / games) * 1000) / 1000 : 0;
}

/** True once any of the week's matchups has points on the board. */
export function weekHasStarted(matchups: Matchup[]): boolean {
  return matchups.some((m) => m.status !== "upcoming" || m.home.score > 0 || m.away.score > 0);
}

/** True when the week's matchups carry projections to build a projected ladder from. */
export function weekHasProjections(matchups: Matchup[]): boolean {
  return matchups.some((m) => m.home.liveProjected != null || m.away.liveProjected != null);
}

/**
 * True while `currentWeek` is still missing from the confirmed standings.
 *
 * A team having played fewer games than the week number is what tells us the
 * live scores are additive rather than already counted. Without this guard a
 * week that finalises while the page is being served would be applied twice,
 * handing everyone a phantom extra win or loss.
 */
export function liveWeekIsPending(standings: Standing[], currentWeek: number): boolean {
  if (!standings.length) return false;
  const played = Math.max(...standings.map((s) => s.wins + s.losses + s.ties));
  return played < currentWeek;
}

/** The points a side is credited with under each mode. */
export function modePoints(side: Matchup["home"], mode: LiveLadderMode): number {
  return mode === "projected" ? side.liveProjected ?? side.projected ?? side.score : side.score;
}

/**
 * The ladder as it would stand if the in-progress week ended now (`live`) or
 * finished on its projections (`projected`).
 *
 * Each counted matchup is settled as a win, loss or tie and added to that team's
 * confirmed record and points, then the ladder is re-sorted and re-ranked on the
 * same keys the confirmed one uses. `change` carries how many places each team
 * moved against the confirmed ladder. The live mode leaves matchups yet to kick
 * off alone, so a half-played week only moves the teams already out there.
 */
export function applyLiveWeek(standings: Standing[], matchups: Matchup[], mode: LiveLadderMode = "live"): Standing[] {
  const live = new Map<number, { wins: number; losses: number; ties: number; pointsFor: number; pointsAgainst: number }>();

  for (const matchup of matchups) {
    if (mode === "live" && matchup.status === "upcoming" && !matchup.home.score && !matchup.away.score) continue;
    for (const [self, opponent] of [
      [matchup.home, matchup.away],
      [matchup.away, matchup.home],
    ] as const) {
      const pointsFor = modePoints(self, mode);
      const pointsAgainst = modePoints(opponent, mode);
      live.set(self.team.id, {
        wins: pointsFor > pointsAgainst ? 1 : 0,
        losses: pointsFor < pointsAgainst ? 1 : 0,
        ties: pointsFor === pointsAgainst ? 1 : 0,
        pointsFor,
        pointsAgainst,
      });
    }
  }

  const confirmedRank = new Map(standings.map((s) => [s.team.id, s.rank]));
  return standings
    .map((s) => {
      const delta = live.get(s.team.id);
      if (!delta) return { ...s };
      const wins = s.wins + delta.wins;
      const losses = s.losses + delta.losses;
      const ties = s.ties + delta.ties;
      return {
        ...s,
        wins,
        losses,
        ties,
        pct: pct(wins, losses, ties),
        pointsFor: Math.round((s.pointsFor + delta.pointsFor) * 100) / 100,
        pointsAgainst: Math.round((s.pointsAgainst + delta.pointsAgainst) * 100) / 100,
      } satisfies Standing;
    })
    .sort((a, b) => b.pct - a.pct || b.pointsFor - a.pointsFor)
    .map((s, i) => ({ ...s, rank: i + 1, change: (confirmedRank.get(s.team.id) ?? i + 1) - (i + 1) }));
}
