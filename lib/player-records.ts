import { getCountingGames } from "./games";
import type { TeamMeta } from "./types";

// Single-game player feats mined from the per-player boxscore data
// (data/games/<season>.json). Computed over counting games only, so they share
// the same universe as the rest of the Record Book (consolation excluded).

export interface PlayerGameRecord {
  gameId: string;
  season: number;
  week: number;
  playerId: number;
  playerName: string;
  pos: string;
  proTeam: string;
  points: number;
  teamName: string;
  team?: TeamMeta;
  oppName: string;
  /** Headline metric for the leaderboard this belongs to. */
  value: number;
  /** Optional small caption, e.g. "33.3 of 66.7 pts". */
  detail?: string;
}

export interface LabeledPlayerRecord {
  label: string;
  rec?: PlayerGameRecord;
}

export interface PlayerRecords {
  highestGames: PlayerGameRecord[];
  mostInLoss: PlayerGameRecord[];
  oneManShows: PlayerGameRecord[];
  benchMistakes: PlayerGameRecord[];
  bestByPosition: LabeledPlayerRecord[];
  statLines: LabeledPlayerRecord[];
}

interface Entry {
  rec: Omit<PlayerGameRecord, "value" | "detail">;
  won: boolean;
  started: boolean;
  teamTotal: number;
  stats: Record<string, number>;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export async function getPlayerRecords(limit = 10): Promise<PlayerRecords> {
  const games = await getCountingGames();
  const entries: Entry[] = [];

  for (const g of games) {
    for (const side of [g.home, g.away] as const) {
      const opp = side === g.home ? g.away : g.home;
      const won = side.total > opp.total;
      for (const p of side.players) {
        entries.push({
          rec: {
            gameId: g.id,
            season: g.season,
            week: g.week,
            playerId: p.playerId,
            playerName: p.name,
            pos: p.pos,
            proTeam: p.proTeam,
            points: p.points,
            teamName: side.name,
            team: side.team,
            oppName: opp.name,
          },
          won,
          started: p.started,
          teamTotal: side.total,
          stats: p.stats ?? {},
        });
      }
    }
  }

  const started = entries.filter((e) => e.started);

  const make = (e: Entry, value: number, detail?: string): PlayerGameRecord => ({ ...e.rec, value, detail });

  const highestGames = [...started]
    .sort((a, b) => b.rec.points - a.rec.points)
    .slice(0, limit)
    .map((e) => make(e, e.rec.points));

  const mostInLoss = started
    .filter((e) => !e.won)
    .sort((a, b) => b.rec.points - a.rec.points)
    .slice(0, limit)
    .map((e) => make(e, e.rec.points, `lost ${e.teamTotal.toFixed(1)}`));

  const benchMistakes = entries
    .filter((e) => !e.started)
    .sort((a, b) => b.rec.points - a.rec.points)
    .slice(0, limit)
    .map((e) => make(e, e.rec.points, "left on bench"));

  const oneManShows = started
    .filter((e) => e.teamTotal > 0 && e.rec.points > 0)
    .map((e) => ({ e, pct: r1((e.rec.points / e.teamTotal) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, limit)
    .map(({ e, pct }) => make(e, pct, `${e.rec.points.toFixed(1)} of ${e.teamTotal.toFixed(1)} pts`));

  const bestAt = (pos: string): PlayerGameRecord | undefined => {
    const best = started.filter((e) => e.rec.pos === pos).sort((a, b) => b.rec.points - a.rec.points)[0];
    return best ? make(best, best.rec.points) : undefined;
  };
  const bestByPosition: LabeledPlayerRecord[] = ["QB", "RB", "WR", "TE", "K", "DEF"].map((pos) => ({
    label: pos,
    rec: bestAt(pos),
  }));

  const bestStat = (key: (s: Record<string, number>) => number): PlayerGameRecord | undefined => {
    let best: Entry | undefined;
    let bestVal = 0;
    for (const e of started) {
      const v = key(e.stats);
      if (v > bestVal) {
        bestVal = v;
        best = e;
      }
    }
    return best ? make(best, bestVal, `${best.rec.points.toFixed(1)} pts`) : undefined;
  };
  const statLines: LabeledPlayerRecord[] = [
    { label: "Pass yards", rec: bestStat((s) => s.passYds ?? 0) },
    { label: "Rush yards", rec: bestStat((s) => s.rushYds ?? 0) },
    { label: "Rec yards", rec: bestStat((s) => s.recYds ?? 0) },
    { label: "Touchdowns", rec: bestStat((s) => (s.passTD ?? 0) + (s.rushTD ?? 0) + (s.recTD ?? 0)) },
  ];

  return { highestGames, mostInLoss, oneManShows, benchMistakes, bestByPosition, statLines };
}
