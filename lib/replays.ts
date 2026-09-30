// Matchup replays: each completed Sleeper-era matchup rebuilt play by play, so
// a finished week can be watched back rather than just read off a box score.
// Written by scripts/build-replays.mjs into data/replays/<season>.json.
//
// Replays are looked up by the pair of Sleeper roster ids rather than by
// matchup id, because the site's canonical ids come from the hand-authored
// fixture list (`1-primetime`) while the replay is built from Sleeper's own
// numbering. The roster pair is the one thing both agree on.

/** One play that moved the win chance enough to matter. */
export interface ReplayMoment {
  /** Minutes from the start of the replay. */
  m: number;
  /** Change in the away team's win chance, in percentage points. */
  swing: number;
  /** The play, in plain words. */
  text: string;
}

export interface Replay {
  /** ISO timestamp of the first play of the week. */
  start: string;
  /** Sleeper roster ids, so a caller can orient itself without trusting order. */
  away: number;
  home: number;
  /** [minutesFromStart, awayPoints, homePoints, awayWinChancePct] */
  points: [number, number, number, number][];
  moments: ReplayMoment[];
}

const cache = new Map<number, Record<string, Replay>>();

async function load(season: number): Promise<Record<string, Replay>> {
  let bySeason = cache.get(season);
  if (!bySeason) {
    try {
      const mod = await import(`@/data/replays/${season}.json`);
      bySeason = mod.default as Record<string, Replay>;
    } catch {
      bySeason = {};
    }
    cache.set(season, bySeason);
  }
  return bySeason;
}

/** The same replay seen from the other side. */
function flip(r: Replay): Replay {
  return {
    ...r,
    away: r.home,
    home: r.away,
    points: r.points.map(([m, a, h, wp]) => [m, h, a, Math.round((100 - wp) * 10) / 10]),
    moments: r.moments.map((mo) => ({ ...mo, swing: -mo.swing })),
  };
}

/**
 * The replay for one matchup, oriented so that `points` and `moments` read from
 * `awayRosterId`'s point of view. Null when that week has not been built.
 */
export async function getMatchupReplay(
  season: number,
  week: number,
  awayRosterId: number | null | undefined,
  homeRosterId: number | null | undefined,
): Promise<Replay | null> {
  if (awayRosterId == null || homeRosterId == null) return null;
  const bySeason = await load(season);
  for (const [key, replay] of Object.entries(bySeason)) {
    if (Number(key.split("-")[0]) !== week) continue;
    if (replay.away === awayRosterId && replay.home === homeRosterId) return replay;
    if (replay.home === awayRosterId && replay.away === homeRosterId) return flip(replay);
  }
  return null;
}
