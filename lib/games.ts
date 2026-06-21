import { franchiseForName, franchiseIdForName } from "./franchises";
import { HISTORY_SEASONS, getSeasonResults } from "./league-data";
import { TEAMS } from "./teams";
import type { TeamMeta } from "./types";

const TEAMS_BY_ID = new Map(TEAMS.map((t) => [t.id, t]));

// Loaders for the full game-by-game history scraped from NFL.com.
// Data lives in data/games/<season>.json (see scripts/scrape-games.mjs) and is
// loaded per-season on demand so the 3.5MB dataset never lands in one bundle.

/** Raw NFL Fantasy scoring inputs for one player's game, e.g. passYds, rushTD. */
export type PlayerStatLine = Record<string, number>;

export interface GamePlayer {
  slot: string;
  name: string;
  playerId: number;
  pos: string;
  proTeam: string;
  opponent: string;
  points: number;
  started: boolean;
  stats: PlayerStatLine;
}

export interface GameSide {
  teamId: number;
  name: string;
  total: number;
  players: GamePlayer[];
  /** Today's franchise this side maps to. */
  team?: TeamMeta;
}

export interface Game {
  id: string;
  season: number;
  week: number;
  home: GameSide;
  away: GameSide;
}

interface RawSide {
  teamId: number;
  name: string;
  total: number;
  players: GamePlayer[];
}
interface RawGame {
  id: string;
  season: number;
  week: number;
  home: RawSide;
  away: RawSide;
}

function hydrate(g: RawGame): Game {
  return {
    ...g,
    home: { ...g.home, team: franchiseForName(g.home.name) },
    away: { ...g.away, team: franchiseForName(g.away.name) },
  };
}

const cache = new Map<number, Game[]>();

export async function getSeasonGames(season: number): Promise<Game[]> {
  if (cache.has(season)) return cache.get(season)!;
  try {
    const mod = await import(`@/data/games/${season}.json`);
    const games = (mod.default as RawGame[]).map(hydrate);
    cache.set(season, games);
    return games;
  } catch {
    return [];
  }
}

export async function getAllGames(): Promise<Game[]> {
  const all = await Promise.all(HISTORY_SEASONS.map(getSeasonGames));
  return all.flat();
}

// --- Playoff vs consolation classification ----------------------------------
// Weeks 15–17 contain both the real championship bracket and meaningless
// consolation games. Only regular-season games and championship-bracket games
// count toward records / head-to-head / win totals; consolation games are still
// browsable on /games but excluded from every aggregation.

export function playoffCutoffForSeason(season: number): number {
  return season >= 2023 && season <= 2025 ? 8 : 6;
}

let playoffRankCache: Map<number, Map<number, number>> | null = null;
function playoffRanks(): Map<number, Map<number, number>> {
  if (playoffRankCache) return playoffRankCache;
  playoffRankCache = new Map();
  for (const s of getSeasonResults()) {
    const ranks = new Map<number, number>();
    for (const row of s.finalStandings) {
      const id = row.team?.id ?? franchiseIdForName(row.name);
      if (id) ranks.set(id, row.rank);
    }
    playoffRankCache.set(s.season, ranks);
  }
  return playoffRankCache;
}

function playoffActiveRankCutoff(game: Game): number {
  if (game.week === 15) return playoffCutoffForSeason(game.season);
  if (game.week === 16) return 4;
  if (game.week === 17) return 2;
  return 0;
}

/** True for a real championship-bracket game where both teams are still alive. */
export function isPlayoffBracketGame(game: Game): boolean {
  if (game.week <= 14) return false;
  const cutoff = playoffActiveRankCutoff(game);
  if (!cutoff) return false;
  const ranks = playoffRanks().get(game.season);
  if (!ranks) return false;
  const h = game.home.team?.id ?? franchiseIdForName(game.home.name);
  const a = game.away.team?.id ?? franchiseIdForName(game.away.name);
  const hRank = h ? ranks.get(h) : undefined;
  const aRank = a ? ranks.get(a) : undefined;
  return Boolean(hRank && aRank && hRank <= cutoff && aRank <= cutoff);
}

/** A weeks-15–17 game that is not part of the championship bracket. */
export function isConsolationGame(game: Game): boolean {
  return game.week >= 15 && !isPlayoffBracketGame(game);
}

/** Does this game count toward records, H2H and win totals? */
export function gameCounts(game: Game): boolean {
  return game.week <= 14 || isPlayoffBracketGame(game);
}

/** All games that count toward records (regular season + championship bracket). */
export async function getCountingGames(): Promise<Game[]> {
  return (await getAllGames()).filter(gameCounts);
}

// --- Playoff bracket visualization -------------------------------------------
// Derives an actual single-elimination bracket (with byes) for a season,
// using final standing rank as the source of truth for who advanced: rank 1-2
// reached the final, rank 1-4 reached the semifinal, rank 1-N (playoff cutoff)
// reached the quarterfinal. Any cutoff-eligible team with no real week-15
// bracket game gets a first-round bye.

export interface BracketSlot {
  id: number;
  team?: TeamMeta;
  name: string;
  score?: number;
}

export interface BracketMatchup {
  gameId?: string;
  a: BracketSlot;
  b?: BracketSlot;
  winnerId: number;
  bye?: boolean;
}

export interface PlayoffBracket {
  season: number;
  quarterfinal: BracketMatchup[];
  semifinal: BracketMatchup[];
  final: BracketMatchup[];
  championId?: number;
}

export async function getPlayoffBracket(season: number): Promise<PlayoffBracket | null> {
  const results = getSeasonResults().find((s) => s.season === season);
  const ranks = playoffRanks().get(season);
  if (!results || !ranks) return null;

  const standingById = new Map<number, { id: number; team?: TeamMeta; name: string }>();
  for (const row of results.finalStandings) {
    const id = row.team?.id ?? franchiseIdForName(row.name);
    if (id) standingById.set(id, { id, team: row.team, name: row.team?.name ?? row.name });
  }

  const slotFor = (id: number, score?: number): BracketSlot => {
    const meta = standingById.get(id);
    return { id, team: meta?.team, name: meta?.name ?? `Team ${id}`, score };
  };

  const games = await getSeasonGames(season);
  const gameSlots = (g: Game) => {
    const hId = g.home.team?.id ?? franchiseIdForName(g.home.name);
    const aId = g.away.team?.id ?? franchiseIdForName(g.away.name);
    if (!hId || !aId) return null;
    const winnerId = g.home.total >= g.away.total ? hId : aId;
    return { gameId: g.id, a: slotFor(hId, g.home.total), b: slotFor(aId, g.away.total), winnerId };
  };

  const byWeek = (w: number) =>
    games
      .filter((g) => g.week === w && isPlayoffBracketGame(g))
      .map(gameSlots)
      .filter((g): g is NonNullable<typeof g> => g !== null);

  const qfGames = byWeek(15);
  const sfGames = byWeek(16);
  const finalGames = byWeek(17);

  const sfEntrantIds = [...ranks.entries()].filter(([, rank]) => rank <= 4).map(([id]) => id);
  const qfParticipantIds = new Set(qfGames.flatMap((g) => [g.a.id, g.b.id]));
  const byeIds = sfEntrantIds.filter((id) => !qfParticipantIds.has(id)).sort((a, b) => (ranks.get(a) ?? 99) - (ranks.get(b) ?? 99));

  const quarterfinalRaw: BracketMatchup[] = [
    ...qfGames.map((g) => ({ gameId: g.gameId, a: g.a, b: g.b, winnerId: g.winnerId })),
    ...byeIds.map((id) => ({ a: slotFor(id), winnerId: id, bye: true })),
  ];

  const semifinalRaw: BracketMatchup[] = sfGames.map((g) => ({ gameId: g.gameId, a: g.a, b: g.b, winnerId: g.winnerId }));
  const final: BracketMatchup[] = finalGames.map((g) => ({ gameId: g.gameId, a: g.a, b: g.b, winnerId: g.winnerId }));

  // Reorder each round so adjacent entries actually feed the same next-round
  // matchup (entry 2j/2j+1 -> next round's matchup j), so the bracket
  // renderer's index-based pairing draws correct connector lines.
  const orderByFeed = (round: BracketMatchup[], next: BracketMatchup[]): BracketMatchup[] => {
    const byWinner = new Map(round.map((m) => [m.winnerId, m]));
    const ordered: BracketMatchup[] = [];
    for (const n of next) {
      const left = byWinner.get(n.a.id);
      const right = n.b ? byWinner.get(n.b.id) : undefined;
      if (left) ordered.push(left);
      if (right) ordered.push(right);
    }
    for (const m of round) if (!ordered.includes(m)) ordered.push(m);
    return ordered;
  };

  const semifinal = final.length ? orderByFeed(semifinalRaw, final) : semifinalRaw;
  const quarterfinal = semifinal.length ? orderByFeed(quarterfinalRaw, semifinal) : quarterfinalRaw;

  return { season, quarterfinal, semifinal, final, championId: final[0]?.winnerId };
}

export interface PlayoffTeamStat {
  id: number;
  team?: TeamMeta;
  name: string;
  appearances: number;
  wins: number;
  losses: number;
  gamesPlayed: number;
  totalPoints: number;
  avgPoints: number;
  finalsAppearances: number;
  championships: number;
}

/** All-time playoff record across every season: real bracket-game W-L,
 *  average points scored in those games, finals reached and titles won. */
export async function getAllTimePlayoffStats(): Promise<PlayoffTeamStat[]> {
  type Acc = PlayoffTeamStat & { seasonsSeen: Set<number> };
  const map = new Map<number, Acc>();

  const ensure = (slot: BracketSlot): Acc => {
    const existing = map.get(slot.id);
    if (existing) return existing;
    const fresh: Acc = {
      id: slot.id,
      team: slot.team,
      name: slot.team?.name ?? slot.name,
      appearances: 0,
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      totalPoints: 0,
      avgPoints: 0,
      finalsAppearances: 0,
      championships: 0,
      seasonsSeen: new Set(),
    };
    map.set(slot.id, fresh);
    return fresh;
  };

  for (const season of HISTORY_SEASONS) {
    const bracket = await getPlayoffBracket(season);
    if (!bracket) continue;

    for (const m of [...bracket.quarterfinal, ...bracket.semifinal, ...bracket.final]) {
      for (const slot of [m.a, m.b] as (BracketSlot | undefined)[]) {
        if (!slot) continue;
        const rec = ensure(slot);
        rec.seasonsSeen.add(season);
        if (slot.score != null) {
          rec.gamesPlayed += 1;
          rec.totalPoints += slot.score;
          if (m.winnerId === slot.id) rec.wins += 1;
          else rec.losses += 1;
        }
      }
    }

    for (const m of bracket.final) {
      for (const slot of [m.a, m.b] as (BracketSlot | undefined)[]) {
        if (!slot) continue;
        const rec = ensure(slot);
        rec.finalsAppearances += 1;
        if (bracket.championId === slot.id) rec.championships += 1;
      }
    }
  }

  return [...map.values()]
    .map(({ seasonsSeen, ...rest }) => ({
      ...rest,
      appearances: seasonsSeen.size,
      totalPoints: Math.round(rest.totalPoints * 100) / 100,
      avgPoints: rest.gamesPlayed ? Math.round((rest.totalPoints / rest.gamesPlayed) * 100) / 100 : 0,
    }))
    .sort(
      (a, b) =>
        b.championships - a.championships ||
        b.finalsAppearances - a.finalsAppearances ||
        b.wins - a.wins ||
        b.avgPoints - a.avgPoints,
    );
}

export async function getGame(id: string): Promise<Game | null> {
  const season = Number(id.split("-")[0]);
  if (!season) return null;
  const games = await getSeasonGames(season);
  return games.find((g) => g.id === id) ?? null;
}

export interface FranchiseGame {
  game: Game;
  /** This franchise's side. */
  self: GameSide;
  opp: GameSide;
  result: "W" | "L" | "T";
}

/** Every counting game a current franchise has played, newest first.
 *  Excludes consolation games (see gameCounts). */
export async function getFranchiseGames(franchiseId: number): Promise<FranchiseGame[]> {
  const games = await getCountingGames();
  const out: FranchiseGame[] = [];
  for (const g of games) {
    const homeIs = franchiseIdForName(g.home.name) === franchiseId;
    const awayIs = franchiseIdForName(g.away.name) === franchiseId;
    if (!homeIs && !awayIs) continue;
    const self = homeIs ? g.home : g.away;
    const opp = homeIs ? g.away : g.home;
    const result = self.total > opp.total ? "W" : self.total < opp.total ? "L" : "T";
    out.push({ game: g, self, opp, result });
  }
  return out.sort((a, b) => b.game.season - a.game.season || b.game.week - a.game.week);
}

export function weekLabel(week: number): string {
  if (week <= 14) return `Week ${week}`;
  return { 15: "Quarterfinal", 16: "Semifinal", 17: "Final" }[week] ?? `Week ${week}`;
}

export function shortWeek(week: number): string {
  return week > 14 ? `P${week - 14}` : `W${week}`;
}

// --- Head to head between two franchises (real game meetings) ----------------

export interface H2HMeeting {
  gameId: string;
  season: number;
  week: number;
  aScore: number;
  bScore: number;
  winner: "a" | "b" | "tie";
}

export interface HeadToHead {
  meetings: H2HMeeting[];
  aWins: number;
  bWins: number;
  ties: number;
  aPoints: number;
  bPoints: number;
  /** Largest win for each side: { margin, meeting }. */
  biggestA?: H2HMeeting;
  biggestB?: H2HMeeting;
}

export async function getHeadToHead(aId: number, bId: number): Promise<HeadToHead> {
  const games = await getCountingGames();
  const meetings: H2HMeeting[] = [];

  for (const g of games) {
    const homeId = franchiseIdForName(g.home.name);
    const awayId = franchiseIdForName(g.away.name);
    const isMeeting = (homeId === aId && awayId === bId) || (homeId === bId && awayId === aId);
    if (!isMeeting) continue;

    const aSide = homeId === aId ? g.home : g.away;
    const bSide = homeId === aId ? g.away : g.home;
    meetings.push({
      gameId: g.id,
      season: g.season,
      week: g.week,
      aScore: aSide.total,
      bScore: bSide.total,
      winner: aSide.total > bSide.total ? "a" : bSide.total > aSide.total ? "b" : "tie",
    });
  }

  meetings.sort((x, y) => y.season - x.season || y.week - x.week);

  const h2h: HeadToHead = {
    meetings,
    aWins: meetings.filter((m) => m.winner === "a").length,
    bWins: meetings.filter((m) => m.winner === "b").length,
    ties: meetings.filter((m) => m.winner === "tie").length,
    aPoints: Math.round(meetings.reduce((s, m) => s + m.aScore, 0) * 100) / 100,
    bPoints: Math.round(meetings.reduce((s, m) => s + m.bScore, 0) * 100) / 100,
  };
  h2h.biggestA = [...meetings]
    .filter((m) => m.winner === "a")
    .sort((x, y) => y.aScore - y.bScore - (x.aScore - x.bScore))[0];
  h2h.biggestB = [...meetings]
    .filter((m) => m.winner === "b")
    .sort((x, y) => y.bScore - y.aScore - (x.bScore - x.aScore))[0];
  return h2h;
}

// --- Record book (extremes across every game) -------------------------------

export interface TeamGameRecord {
  gameId: string;
  season: number;
  week: number;
  team?: TeamMeta;
  teamName: string;
  score: number;
  oppName: string;
  oppScore: number;
  margin: number;
  win: boolean;
}

export interface MatchupRecord {
  gameId: string;
  season: number;
  week: number;
  winnerName: string;
  winnerTeam?: TeamMeta;
  loserName: string;
  loserTeam?: TeamMeta;
  winnerScore: number;
  loserScore: number;
  margin: number;
  combined: number;
}

export interface StreakRecord {
  team?: TeamMeta;
  teamName: string;
  length: number;
  from: string;
  to: string;
}

export interface RivalryRecord {
  team?: TeamMeta;
  teamName: string;
  opponent?: TeamMeta;
  opponentName: string;
  wins: number;
  losses: number;
  ties: number;
  games: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface RivalryStreakRecord {
  team?: TeamMeta;
  teamName: string;
  opponent?: TeamMeta;
  opponentName: string;
  length: number;
  from: string;
  to: string;
}

export interface PairRivalryRecord {
  a?: TeamMeta;
  aName: string;
  b?: TeamMeta;
  bName: string;
  games: number;
  aWins: number;
  bWins: number;
  ties: number;
  aPoints: number;
  bPoints: number;
  pointDiff: number;
  avgCombined: number;
}

export interface RecordBook {
  highestScores: TeamGameRecord[];
  lowestScores: TeamGameRecord[];
  mostInLoss: TeamGameRecord[];
  fewestInWin: TeamGameRecord[];
  blowouts: MatchupRecord[];
  nailbiters: MatchupRecord[];
  shootouts: MatchupRecord[];
  longestWinStreak: StreakRecord;
  longestLoseStreak: StreakRecord;
  longestH2HWinStreaks: RivalryStreakRecord[];
  mostWinsOverOpponent: RivalryRecord[];
  bestH2HWinPct: RivalryRecord[];
  mostPlayedRivalries: PairRivalryRecord[];
  closestRivalries: PairRivalryRecord[];
  highestScoringRivalries: PairRivalryRecord[];
  totalGames: number;
}

function teamGameRecords(games: Game[]): TeamGameRecord[] {
  const out: TeamGameRecord[] = [];
  for (const g of games) {
    for (const [self, opp] of [
      [g.home, g.away],
      [g.away, g.home],
    ] as const) {
      out.push({
        gameId: g.id,
        season: g.season,
        week: g.week,
        team: self.team,
        teamName: self.name,
        score: self.total,
        oppName: opp.name,
        oppScore: opp.total,
        margin: Math.round((self.total - opp.total) * 100) / 100,
        win: self.total > opp.total,
      });
    }
  }
  return out;
}

function matchupRecords(games: Game[]): MatchupRecord[] {
  return games
    .filter((g) => g.home.total !== g.away.total)
    .map((g) => {
      const [w, l] = g.home.total >= g.away.total ? [g.home, g.away] : [g.away, g.home];
      return {
        gameId: g.id,
        season: g.season,
        week: g.week,
        winnerName: w.name,
        winnerTeam: w.team,
        loserName: l.name,
        loserTeam: l.team,
        winnerScore: w.total,
        loserScore: l.total,
        margin: Math.round((w.total - l.total) * 100) / 100,
        combined: Math.round((w.total + l.total) * 100) / 100,
      };
    });
}

function computeStreaks(games: Game[]): { win: StreakRecord; lose: StreakRecord } {
  // chronological per franchise
  const byFranchise = new Map<number, { season: number; week: number; win: boolean }[]>();
  for (const g of games) {
    for (const side of [g.home, g.away]) {
      const id = side.team?.id;
      if (!id) continue;
      const opp = side === g.home ? g.away : g.home;
      if (side.total === opp.total) continue; // ignore ties for streaks
      const arr = byFranchise.get(id) ?? [];
      arr.push({ season: g.season, week: g.week, win: side.total > opp.total });
      byFranchise.set(id, arr);
    }
  }

  let bestWin: StreakRecord = { teamName: "—", length: 0, from: "", to: "" };
  let bestLose: StreakRecord = { teamName: "—", length: 0, from: "", to: "" };

  for (const [id, raw] of byFranchise) {
    const team = getTeamMetaById(id);
    raw.sort((a, b) => a.season - b.season || a.week - b.week);
    let curWin = 0,
      curLose = 0,
      winStart = raw[0],
      loseStart = raw[0];
    for (let i = 0; i < raw.length; i++) {
      const r = raw[i];
      if (r.win) {
        if (curWin === 0) winStart = r;
        curWin++;
        curLose = 0;
        if (curWin > bestWin.length)
          bestWin = { team, teamName: team?.name ?? "", length: curWin, from: `${winStart.season} ${shortWeek(winStart.week)}`, to: `${r.season} ${shortWeek(r.week)}` };
      } else {
        if (curLose === 0) loseStart = r;
        curLose++;
        curWin = 0;
        if (curLose > bestLose.length)
          bestLose = { team, teamName: team?.name ?? "", length: curLose, from: `${loseStart.season} ${shortWeek(loseStart.week)}`, to: `${r.season} ${shortWeek(r.week)}` };
      }
    }
  }
  return { win: bestWin, lose: bestLose };
}

interface PairGame {
  season: number;
  week: number;
  aScore: number;
  bScore: number;
  winner: "a" | "b" | "tie";
}

interface PairAccumulator {
  aId: number;
  bId: number;
  games: PairGame[];
}

function pairKey(aId: number, bId: number): string {
  return aId < bId ? `${aId}-${bId}` : `${bId}-${aId}`;
}

function pairAccumulators(games: Game[]): PairAccumulator[] {
  const pairs = new Map<string, PairAccumulator>();

  for (const game of games) {
    const homeId = game.home.team?.id ?? franchiseIdForName(game.home.name);
    const awayId = game.away.team?.id ?? franchiseIdForName(game.away.name);
    if (!homeId || !awayId || homeId === awayId) continue;

    const aId = Math.min(homeId, awayId);
    const bId = Math.max(homeId, awayId);
    const key = pairKey(aId, bId);
    const acc = pairs.get(key) ?? { aId, bId, games: [] };
    const aSide = homeId === aId ? game.home : game.away;
    const bSide = homeId === aId ? game.away : game.home;
    acc.games.push({
      season: game.season,
      week: game.week,
      aScore: aSide.total,
      bScore: bSide.total,
      winner: aSide.total > bSide.total ? "a" : bSide.total > aSide.total ? "b" : "tie",
    });
    pairs.set(key, acc);
  }

  return [...pairs.values()].map((acc) => ({
    ...acc,
    games: acc.games.sort((a, b) => a.season - b.season || a.week - b.week),
  }));
}

function pairRecord(acc: PairAccumulator): PairRivalryRecord {
  const a = getTeamMetaById(acc.aId);
  const b = getTeamMetaById(acc.bId);
  const aWins = acc.games.filter((game) => game.winner === "a").length;
  const bWins = acc.games.filter((game) => game.winner === "b").length;
  const ties = acc.games.filter((game) => game.winner === "tie").length;
  const aPoints = round(acc.games.reduce((sum, game) => sum + game.aScore, 0));
  const bPoints = round(acc.games.reduce((sum, game) => sum + game.bScore, 0));

  return {
    a,
    aName: a?.name ?? `Team ${acc.aId}`,
    b,
    bName: b?.name ?? `Team ${acc.bId}`,
    games: acc.games.length,
    aWins,
    bWins,
    ties,
    aPoints,
    bPoints,
    pointDiff: round(Math.abs(aPoints - bPoints)),
    avgCombined: round((aPoints + bPoints) / acc.games.length),
  };
}

function directionalRecord(acc: PairAccumulator, side: "a" | "b"): RivalryRecord {
  const pair = pairRecord(acc);
  const wins = side === "a" ? pair.aWins : pair.bWins;
  const losses = side === "a" ? pair.bWins : pair.aWins;
  const pointsFor = side === "a" ? pair.aPoints : pair.bPoints;
  const pointsAgainst = side === "a" ? pair.bPoints : pair.aPoints;
  return {
    team: side === "a" ? pair.a : pair.b,
    teamName: side === "a" ? pair.aName : pair.bName,
    opponent: side === "a" ? pair.b : pair.a,
    opponentName: side === "a" ? pair.bName : pair.aName,
    wins,
    losses,
    ties: pair.ties,
    games: pair.games,
    winPct: round(wins / pair.games),
    pointsFor,
    pointsAgainst,
  };
}

function h2hWinStreaks(accs: PairAccumulator[]): RivalryStreakRecord[] {
  const best: RivalryStreakRecord[] = [];

  for (const acc of accs) {
    let current: { winner: "a" | "b"; length: number; start: PairGame; end: PairGame } | null = null;
    const pushCurrent = () => {
      if (!current) return;
      const teamId = current.winner === "a" ? acc.aId : acc.bId;
      const opponentId = current.winner === "a" ? acc.bId : acc.aId;
      const team = getTeamMetaById(teamId);
      const opponent = getTeamMetaById(opponentId);
      best.push({
        team,
        teamName: team?.name ?? `Team ${teamId}`,
        opponent,
        opponentName: opponent?.name ?? `Team ${opponentId}`,
        length: current.length,
        from: `${current.start.season} ${shortWeek(current.start.week)}`,
        to: `${current.end.season} ${shortWeek(current.end.week)}`,
      });
    };

    for (const game of acc.games) {
      if (game.winner === "tie") {
        pushCurrent();
        current = null;
        continue;
      }
      if (current && current.winner === game.winner) {
        current.length += 1;
        current.end = game;
      } else {
        pushCurrent();
        current = { winner: game.winner, length: 1, start: game, end: game };
      }
    }
    pushCurrent();
  }

  return best.sort((a, b) => b.length - a.length || a.teamName.localeCompare(b.teamName)).slice(0, 5);
}

function rivalryRecords(games: Game[]) {
  const accs = pairAccumulators(games);
  const pairs = accs.map(pairRecord);
  const directional = accs.flatMap((acc) => [directionalRecord(acc, "a"), directionalRecord(acc, "b")]);
  const minThree = pairs.filter((pair) => pair.games >= 3);

  return {
    longestH2HWinStreaks: h2hWinStreaks(accs),
    mostWinsOverOpponent: [...directional].sort((a, b) => b.wins - a.wins || b.games - a.games).slice(0, 5),
    bestH2HWinPct: [...directional]
      .filter((record) => record.games >= 3)
      .sort((a, b) => b.winPct - a.winPct || b.wins - a.wins || b.games - a.games)
      .slice(0, 5),
    mostPlayedRivalries: [...pairs].sort((a, b) => b.games - a.games || a.pointDiff - b.pointDiff).slice(0, 5),
    closestRivalries: [...minThree].sort((a, b) => a.pointDiff - b.pointDiff || b.games - a.games).slice(0, 5),
    highestScoringRivalries: [...minThree].sort((a, b) => b.avgCombined - a.avgCombined || b.games - a.games).slice(0, 5),
  };
}

function getTeamMetaById(id: number): TeamMeta | undefined {
  return TEAMS_BY_ID.get(id);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function getRecordBook(): Promise<RecordBook> {
  const games = await getCountingGames();
  const tg = teamGameRecords(games);
  const mr = matchupRecords(games);
  const top = (arr: TeamGameRecord[], n = 5) => arr.slice(0, n);
  const streaks = computeStreaks(games);
  const rivalries = rivalryRecords(games);

  return {
    totalGames: games.length,
    highestScores: top([...tg].sort((a, b) => b.score - a.score)),
    lowestScores: top([...tg].sort((a, b) => a.score - b.score)),
    mostInLoss: top([...tg].filter((t) => !t.win).sort((a, b) => b.score - a.score)),
    fewestInWin: top([...tg].filter((t) => t.win).sort((a, b) => a.score - b.score)),
    blowouts: [...mr].sort((a, b) => b.margin - a.margin).slice(0, 5),
    nailbiters: [...mr].sort((a, b) => a.margin - b.margin).slice(0, 5),
    shootouts: [...mr].sort((a, b) => b.combined - a.combined).slice(0, 5),
    longestWinStreak: streaks.win,
    longestLoseStreak: streaks.lose,
    ...rivalries,
  };
}
