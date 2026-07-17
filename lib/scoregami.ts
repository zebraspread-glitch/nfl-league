import { getAllGames, shortWeek, type Game, type GameSide } from "./games";
import { franchiseIdForName } from "./franchises";
import { HISTORY_SEASONS } from "./league-data";
import { getTeam, TEAMS } from "./teams";
import type { TeamMeta } from "./types";

export interface ScoregamiGameSummary {
  gameId: string;
  season: number;
  week: number;
  roundLabel: string;
  scoreKey: string;
  winnerName: string;
  loserName: string;
}

export interface ScoregamiGameRow extends ScoregamiGameSummary {
  winnerTeam?: TeamMeta;
  loserTeam?: TeamMeta;
  winnerScore: number;
  loserScore: number;
  winnerRawScore: number;
  loserRawScore: number;
  margin: number;
  combined: number;
  isScoregami: boolean;
  occurrence: number;
  firstGame?: ScoregamiGameSummary;
  previousGame?: ScoregamiGameSummary;
}

export interface ScoreFrequency {
  scoreKey: string;
  count: number;
  firstGame: ScoregamiGameSummary;
  latestGame: ScoregamiGameSummary;
}

export interface SeasonScoregamiStat {
  season: number;
  games: number;
  scoregamis: number;
  repeats: number;
  uniqueRate: number;
  avgWinner: number;
  avgLoser: number;
  avgTotal: number;
  mostCommon?: ScoreFrequency;
}

export interface TeamScoregamiStat {
  id: number;
  team: TeamMeta;
  games: number;
  wins: number;
  losses: number;
  scoregamis: number;
  scoregamiWins: number;
  scoregamiLosses: number;
  uniqueScores: number;
  avgFor: number;
  avgAgainst: number;
}

export interface RivalryScoregamiStat {
  a: TeamMeta;
  b: TeamMeta;
  games: number;
  uniqueScores: number;
  scoregamis: number;
  repeats: number;
  mostCommon?: ScoreFrequency;
}

export interface ScoreBand {
  key: string;
  label: string;
  min: number;
  max: number;
}

export interface ScoreBandCell {
  winnerBand: ScoreBand;
  loserBand: ScoreBand;
  count: number;
}

export interface ScoreBandGrid {
  winnerBands: ScoreBand[];
  loserBands: ScoreBand[];
  rows: ScoreBandCell[][];
  maxCount: number;
}

export interface ScoregamiStreak {
  length: number;
  from?: ScoregamiGameSummary;
  to?: ScoregamiGameSummary;
}

export interface ScoregamiBook {
  totalGames: number;
  uniqueScores: number;
  scoregamis: number;
  repeats: number;
  oneOffScores: number;
  scoregamiRate: number;
  mostCommonScores: ScoreFrequency[];
  latestScoregamis: ScoregamiGameRow[];
  latestRepeats: ScoregamiGameRow[];
  highestScoregamis: ScoregamiGameRow[];
  lowestScoregamis: ScoregamiGameRow[];
  closestScoregamis: ScoregamiGameRow[];
  biggestBlowoutScoregamis: ScoregamiGameRow[];
  seasonStats: SeasonScoregamiStat[];
  teamStats: TeamScoregamiStat[];
  rivalryStats: RivalryScoregamiStat[];
  rivalryScoregamiLeaders: RivalryScoregamiStat[];
  scoreGrid: ScoreBandGrid;
  longestFreshRun: ScoregamiStreak;
  gamesBySeason: { season: number; games: ScoregamiGameRow[]; scoregamis: number; repeats: number }[];
}

interface BaseScoreRow {
  game: Game;
  winner: GameSide;
  loser: GameSide;
  winnerScore: number;
  loserScore: number;
  scoreKey: string;
}

function integerScore(score: number): number {
  return Math.floor(score);
}

function sideFranchiseId(side: GameSide): number | undefined {
  return side.team?.id ?? franchiseIdForName(side.name);
}

function sideTeam(side: GameSide): TeamMeta | undefined {
  const id = sideFranchiseId(side);
  return id ? getTeam(id) : undefined;
}

function baseScoreRow(game: Game): BaseScoreRow {
  const [winner, loser] = game.home.total >= game.away.total ? [game.home, game.away] : [game.away, game.home];
  const winnerScore = integerScore(winner.total);
  const loserScore = integerScore(loser.total);

  return {
    game,
    winner,
    loser,
    winnerScore,
    loserScore,
    scoreKey: `${winnerScore}-${loserScore}`,
  };
}

function summary(row: ScoregamiGameRow): ScoregamiGameSummary {
  return {
    gameId: row.gameId,
    season: row.season,
    week: row.week,
    roundLabel: row.roundLabel,
    scoreKey: row.scoreKey,
    winnerName: row.winnerName,
    loserName: row.loserName,
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function gameSorter(a: Game, b: Game): number {
  return a.season - b.season || a.week - b.week || a.id.localeCompare(b.id);
}

function frequencySorter(a: ScoreFrequency, b: ScoreFrequency): number {
  return b.count - a.count || a.scoreKey.localeCompare(b.scoreKey, undefined, { numeric: true });
}

function scoreRows(games: Game[]): ScoregamiGameRow[] {
  const seen = new Map<string, ScoregamiGameRow[]>();
  const rows: ScoregamiGameRow[] = [];

  for (const base of games.map(baseScoreRow)) {
    const previousRows = seen.get(base.scoreKey) ?? [];
    const firstGame = previousRows[0] ? summary(previousRows[0]) : undefined;
    const previousGame = previousRows.length ? summary(previousRows[previousRows.length - 1]) : undefined;
    const isScoregami = previousRows.length === 0;

    const row: ScoregamiGameRow = {
      gameId: base.game.id,
      season: base.game.season,
      week: base.game.week,
      roundLabel: shortWeek(base.game.week),
      scoreKey: base.scoreKey,
      winnerName: base.winner.name,
      loserName: base.loser.name,
      winnerTeam: sideTeam(base.winner),
      loserTeam: sideTeam(base.loser),
      winnerScore: base.winnerScore,
      loserScore: base.loserScore,
      winnerRawScore: base.winner.total,
      loserRawScore: base.loser.total,
      margin: base.winnerScore - base.loserScore,
      combined: base.winnerScore + base.loserScore,
      isScoregami,
      occurrence: previousRows.length + 1,
      firstGame,
      previousGame,
    };

    previousRows.push(row);
    seen.set(base.scoreKey, previousRows);
    rows.push(row);
  }

  return rows;
}

function scoreFrequencies(rows: ScoregamiGameRow[]): ScoreFrequency[] {
  const groups = new Map<string, ScoregamiGameRow[]>();
  for (const row of rows) {
    const group = groups.get(row.scoreKey) ?? [];
    group.push(row);
    groups.set(row.scoreKey, group);
  }

  return [...groups.entries()]
    .map(([scoreKey, group]) => ({
      scoreKey,
      count: group.length,
      firstGame: summary(group[0]),
      latestGame: summary(group[group.length - 1]),
    }))
    .sort(frequencySorter);
}

function seasonStats(rows: ScoregamiGameRow[]): SeasonScoregamiStat[] {
  return HISTORY_SEASONS.map((season) => {
    const seasonRows = rows.filter((row) => row.season === season);
    const frequencies = scoreFrequencies(seasonRows);
    const games = seasonRows.length || 1;

    return {
      season,
      games: seasonRows.length,
      scoregamis: seasonRows.filter((row) => row.isScoregami).length,
      repeats: seasonRows.filter((row) => !row.isScoregami).length,
      uniqueRate: round((seasonRows.filter((row) => row.isScoregami).length / games) * 100),
      avgWinner: round(seasonRows.reduce((sum, row) => sum + row.winnerScore, 0) / games),
      avgLoser: round(seasonRows.reduce((sum, row) => sum + row.loserScore, 0) / games),
      avgTotal: round(seasonRows.reduce((sum, row) => sum + row.combined, 0) / games),
      mostCommon: frequencies.find((freq) => freq.count > 1),
    };
  });
}

function teamStats(rows: ScoregamiGameRow[]): TeamScoregamiStat[] {
  type Acc = Omit<TeamScoregamiStat, "uniqueScores" | "avgFor" | "avgAgainst"> & {
    uniqueSet: Set<string>;
    pointsFor: number;
    pointsAgainst: number;
  };

  const acc = new Map<number, Acc>();
  for (const team of TEAMS) {
    acc.set(team.id, {
      id: team.id,
      team,
      games: 0,
      wins: 0,
      losses: 0,
      scoregamis: 0,
      scoregamiWins: 0,
      scoregamiLosses: 0,
      uniqueSet: new Set(),
      pointsFor: 0,
      pointsAgainst: 0,
    });
  }

  for (const row of rows) {
    const winnerId = row.winnerTeam?.id;
    const loserId = row.loserTeam?.id;
    if (winnerId) {
      const record = acc.get(winnerId);
      if (record) {
        record.games += 1;
        record.wins += 1;
        record.uniqueSet.add(row.scoreKey);
        record.pointsFor += row.winnerScore;
        record.pointsAgainst += row.loserScore;
        if (row.isScoregami) {
          record.scoregamis += 1;
          record.scoregamiWins += 1;
        }
      }
    }
    if (loserId) {
      const record = acc.get(loserId);
      if (record) {
        record.games += 1;
        record.losses += 1;
        record.uniqueSet.add(row.scoreKey);
        record.pointsFor += row.loserScore;
        record.pointsAgainst += row.winnerScore;
        if (row.isScoregami) {
          record.scoregamis += 1;
          record.scoregamiLosses += 1;
        }
      }
    }
  }

  return [...acc.values()]
    .map(({ uniqueSet, pointsFor, pointsAgainst, ...record }) => ({
      ...record,
      uniqueScores: uniqueSet.size,
      avgFor: record.games ? round(pointsFor / record.games) : 0,
      avgAgainst: record.games ? round(pointsAgainst / record.games) : 0,
    }))
    .sort((a, b) => b.scoregamis - a.scoregamis || b.uniqueScores - a.uniqueScores || b.games - a.games);
}

function pairKey(aId: number, bId: number): string {
  return aId < bId ? `${aId}-${bId}` : `${bId}-${aId}`;
}

function rivalryStats(rows: ScoregamiGameRow[]): RivalryScoregamiStat[] {
  type Acc = {
    a: TeamMeta;
    b: TeamMeta;
    games: ScoregamiGameRow[];
    uniqueSet: Set<string>;
    scoregamis: number;
  };
  const pairs = new Map<string, Acc>();

  for (const row of rows) {
    const winnerId = row.winnerTeam?.id;
    const loserId = row.loserTeam?.id;
    if (!winnerId || !loserId || winnerId === loserId) continue;

    const aId = Math.min(winnerId, loserId);
    const bId = Math.max(winnerId, loserId);
    const a = getTeam(aId);
    const b = getTeam(bId);
    if (!a || !b) continue;

    const key = pairKey(aId, bId);
    const acc = pairs.get(key) ?? { a, b, games: [], uniqueSet: new Set<string>(), scoregamis: 0 };
    acc.games.push(row);
    acc.uniqueSet.add(row.scoreKey);
    if (row.isScoregami) acc.scoregamis += 1;
    pairs.set(key, acc);
  }

  return [...pairs.values()]
    .map((acc) => {
      const localCommon = scoreFrequencies(acc.games)[0];
      return {
        a: acc.a,
        b: acc.b,
        games: acc.games.length,
        uniqueScores: acc.uniqueSet.size,
        scoregamis: acc.scoregamis,
        repeats: acc.games.length - acc.uniqueSet.size,
        mostCommon: localCommon,
      };
    })
    .sort((a, b) => b.uniqueScores - a.uniqueScores || b.scoregamis - a.scoregamis || b.games - a.games);
}

function makeBands(values: number[]): ScoreBand[] {
  const min = Math.floor(Math.min(...values) / 10) * 10;
  const max = Math.floor(Math.max(...values) / 10) * 10;
  const bands: ScoreBand[] = [];

  for (let start = min; start <= max; start += 10) {
    bands.push({
      key: String(start),
      label: `${start}s`,
      min: start,
      max: start + 9,
    });
  }

  return bands;
}

function bandFor(score: number, bands: ScoreBand[]): ScoreBand {
  return bands.find((band) => score >= band.min && score <= band.max) ?? bands[bands.length - 1];
}

function scoreBandGrid(rows: ScoregamiGameRow[]): ScoreBandGrid {
  const firstRows = rows.filter((row) => row.isScoregami);
  const winnerBands = makeBands(firstRows.map((row) => row.winnerScore));
  const loserBands = makeBands(firstRows.map((row) => row.loserScore));
  const counts = new Map<string, number>();

  for (const row of firstRows) {
    const winnerBand = bandFor(row.winnerScore, winnerBands);
    const loserBand = bandFor(row.loserScore, loserBands);
    const key = `${winnerBand.key}-${loserBand.key}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let maxCount = 1;
  const gridRows = [...loserBands].reverse().map((loserBand) =>
    winnerBands.map((winnerBand) => {
      const count = counts.get(`${winnerBand.key}-${loserBand.key}`) ?? 0;
      maxCount = Math.max(maxCount, count);
      return { winnerBand, loserBand, count };
    }),
  );

  return { winnerBands, loserBands: [...loserBands].reverse(), rows: gridRows, maxCount };
}

function longestFreshRun(rows: ScoregamiGameRow[]): ScoregamiStreak {
  let best: ScoregamiStreak = { length: 0 };
  let current: ScoregamiGameRow[] = [];

  const closeRun = () => {
    if (current.length > best.length) {
      best = {
        length: current.length,
        from: summary(current[0]),
        to: summary(current[current.length - 1]),
      };
    }
  };

  for (const row of rows) {
    if (row.isScoregami) {
      current.push(row);
    } else {
      closeRun();
      current = [];
    }
  }
  closeRun();

  return best;
}

export async function getScoregamiBook(): Promise<ScoregamiBook> {
  const games = (await getAllGames()).sort(gameSorter);
  const rows = scoreRows(games);
  const frequencies = scoreFrequencies(rows);
  const repeatedFrequencies = frequencies.filter((freq) => freq.count > 1);
  const scoregamiRows = rows.filter((row) => row.isScoregami);
  const repeatRows = rows.filter((row) => !row.isScoregami);
  const rivalries = rivalryStats(rows);
  const totalGames = rows.length || 1;

  return {
    totalGames: rows.length,
    uniqueScores: frequencies.length,
    scoregamis: scoregamiRows.length,
    repeats: repeatRows.length,
    oneOffScores: frequencies.filter((freq) => freq.count === 1).length,
    scoregamiRate: round((scoregamiRows.length / totalGames) * 100),
    mostCommonScores: repeatedFrequencies.slice(0, 10),
    latestScoregamis: [...scoregamiRows].reverse().slice(0, 10),
    latestRepeats: [...repeatRows].reverse().slice(0, 10),
    highestScoregamis: [...scoregamiRows].sort((a, b) => b.combined - a.combined || b.winnerScore - a.winnerScore).slice(0, 5),
    lowestScoregamis: [...scoregamiRows].sort((a, b) => a.combined - b.combined || a.winnerScore - b.winnerScore).slice(0, 5),
    closestScoregamis: [...scoregamiRows].sort((a, b) => a.margin - b.margin || b.combined - a.combined).slice(0, 5),
    biggestBlowoutScoregamis: [...scoregamiRows].sort((a, b) => b.margin - a.margin || b.combined - a.combined).slice(0, 5),
    seasonStats: seasonStats(rows),
    teamStats: teamStats(rows),
    rivalryStats: rivalries.slice(0, 8),
    rivalryScoregamiLeaders: [...rivalries].sort((a, b) => b.scoregamis - a.scoregamis || b.uniqueScores - a.uniqueScores).slice(0, 8),
    scoreGrid: scoreBandGrid(rows),
    longestFreshRun: longestFreshRun(rows),
    gamesBySeason: HISTORY_SEASONS.slice()
      .reverse()
      .map((season) => {
        const seasonRows = rows.filter((row) => row.season === season).reverse();
        return {
          season,
          games: seasonRows,
          scoregamis: seasonRows.filter((row) => row.isScoregami).length,
          repeats: seasonRows.filter((row) => !row.isScoregami).length,
        };
      }),
  };
}
