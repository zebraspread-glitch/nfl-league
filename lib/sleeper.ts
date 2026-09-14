import "server-only";

import type {
  Standing,
  Matchup,
  MatchupSide,
  Roster,
  RosterEntry,
  RosterSlot,
  TeamMeta,
  TeamId,
  LeagueSnapshot,
} from "./types";
import { getTeam, getTeamByName, TEAMS } from "./teams";
import { optimalLineupTotal } from "./optimal-lineup";
import {
  CURRENT_SEASON,
  CURRENT_WEEK,
  getCurrentSeasonMatchups,
  getFallbackStandings,
  getFallbackMatchups,
  getFallbackRoster,
} from "./league-data";

// ===========================================================================
// SERVER-ONLY SLEEPER DATA LAYER
//
// Sleeper's read API is public — no credentials are required, just a league
// id. Pages call the exported getX() helpers from server components / route
// handlers only. When the league id is missing, or a request fails, or the
// league has no live data yet (e.g. still pre_draft), current-season helpers
// return empty data. Historical pages use the scraped NFL.com data directly.
// ===========================================================================

const SLEEPER_BASE = "https://api.sleeper.app/v1";
const DEFAULT_SLEEPER_LEAGUE_ID = "1374614405412560896";

function readLeagueId(): string | null {
  return process.env.SLEEPER_LEAGUE_ID || DEFAULT_SLEEPER_LEAGUE_ID;
}

export function isLiveConfigured(): boolean {
  return readLeagueId() !== null;
}

async function sleeperFetch<T>(path: string, revalidateSeconds = 120): Promise<T | null> {
  const leagueId = readLeagueId();
  if (!leagueId) return null;

  try {
    const res = await fetch(`${SLEEPER_BASE}/league/${leagueId}${path}`, {
      next: { revalidate: revalidateSeconds },
    });
    if (!res.ok) {
      console.warn(`[sleeper] ${res.status} ${res.statusText} for ${path}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn("[sleeper] fetch failed:", err);
    return null;
  }
}

// --- Sleeper response shapes (only the bits we use) -------------------------

interface SleeperUser {
  user_id: string;
  display_name: string;
  metadata?: { team_name?: string };
}

interface SleeperRosterSettings {
  wins?: number;
  losses?: number;
  ties?: number;
  fpts?: number;
  fpts_decimal?: number;
  fpts_against?: number;
  fpts_against_decimal?: number;
}

interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  players?: string[] | null;
  starters?: string[] | null;
  reserve?: string[] | null;
  settings?: SleeperRosterSettings;
  metadata?: { streak?: string } | null;
}

interface SleeperMatchup {
  matchup_id: number | null;
  roster_id: number;
  points?: number;
  starters?: string[];
  players?: string[];
  players_points?: Record<string, number>;
}

interface SleeperPlayer {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string;
  injury_status?: string;
  /** False once Sleeper retires a player, but they stay in the catalog forever. */
  active?: boolean;
}

// --- Mapping helpers ---------------------------------------------------------

function teamNameFor(roster: SleeperRoster, user?: SleeperUser): string {
  return roster.metadata && "team_name" in (roster.metadata as object)
    ? (roster.metadata as { team_name?: string }).team_name || ""
    : user?.metadata?.team_name || user?.display_name || `Team ${roster.roster_id}`;
}

/**
 * Sleeper display names don't match our curated franchise names or manager
 * names closely enough for exact/fuzzy matching, so each joined member's
 * Sleeper username is mapped to their franchise id by hand. Confirmed when
 * the 2026 league filled out. Some managers have renamed their Sleeper handle
 * since first joining (e.g. thomopatto→thomoo, lavarballs27→LavarBallsMGL,
 * lucasdalts98746→tyhillmgl), so old and new aliases both map to the same
 * franchise id. Ownerless Sleeper rosters are mapped by live roster id below.
 */
const SLEEPER_USERNAME_TO_TEAM_ID: Record<string, TeamId> = {
  pahomgl: 9,
  brownlowrow: 11,
  chicook: 10,
  thomopatto: 2, // old handle
  thomoo: 2, // renamed 2026
  dimmymgl: 1,
  monkevengence: 6,
  lucasdalts98746: 8, // old handle
  tyhillmgl: 8, // Dalts, renamed 2026 (confirmed by owner)
  luckybison: 12,
  lavarballs27: 5, // old handle
  lavarballsmgl: 5, // renamed 2026
  ginnivanjefferson: 4,
  tinklevanginkel: 7, // joined 2026
  deaaroncronin: 3, // joined 2026
};

const SLEEPER_ROSTER_TO_TEAM_ID: Record<number, TeamId> = {
  11: 7, // Tinkle Van Ginkel
  12: 3, // De'Aaron Cronin
};

/**
 * Map a Sleeper roster to our curated metadata, matching by team/owner name.
 * Sleeper's roster_id is assigned by join order, not by our franchise id, so
 * named/owned rosters resolve by username or team name first. The explicit
 * roster-id fallback covers the two ownerless slots in the live league.
 */
function resolveTeam(roster: SleeperRoster, user?: SleeperUser): TeamMeta {
  const byUsername = user && SLEEPER_USERNAME_TO_TEAM_ID[user.display_name.toLowerCase()];
  if (byUsername) {
    const team = getTeam(byUsername);
    if (team) return team;
  }
  const name = teamNameFor(roster, user);
  const byName = TEAMS.find((m) => m.name.toLowerCase() === name.toLowerCase());
  if (byName) return byName;
  const byManager = user && TEAMS.find((m) => m.manager.toLowerCase() === user.display_name.toLowerCase());
  if (byManager) return byManager;
  const byRoster = SLEEPER_ROSTER_TO_TEAM_ID[roster.roster_id];
  if (byRoster) {
    const team = getTeam(byRoster);
    if (team) return team;
  }
  // Unmapped roster: unique negative id (from roster_id) so placeholders never
  // collide on a shared id, and so consumers can detect "no franchise page".
  return getTeamByName(name || `Team ${roster.roster_id}`, -roster.roster_id);
}

function pct(wins: number, losses: number, ties: number): number {
  const games = wins + losses + ties;
  return games ? Math.round((wins / games) * 1000) / 1000 : 0;
}

function decimalPoints(whole?: number, decimal?: number): number {
  return Math.round(((whole ?? 0) + (decimal ?? 0) / 100) * 100) / 100;
}

async function getUsers(): Promise<SleeperUser[]> {
  return (await sleeperFetch<SleeperUser[]>("/users", 300)) ?? [];
}

async function getRosters(): Promise<SleeperRoster[]> {
  return (await sleeperFetch<SleeperRoster[]>("/rosters", 120)) ?? [];
}

interface SleeperLeague {
  roster_positions?: string[];
  settings?: { reserve_slots?: number };
  scoring_settings?: Record<string, number>;
}

interface LeagueConfig {
  rosterPositions: string[];
  reserveSlots: number;
  /** The league's own scoring rules — stat key to points per unit. */
  scoringSettings: Record<string, number>;
}

const DEFAULT_ROSTER_POSITIONS = ["QB", "RB", "RB", "WR", "WR", "TE", "WRRB_FLEX", "K", "DEF", "BN", "BN", "BN", "BN", "BN", "BN"];

/** League slot template (starting positions, bench count, IR slots). Static within a season. */
async function getLeagueConfig(): Promise<LeagueConfig> {
  const data = await sleeperFetch<SleeperLeague>("", 3600);
  return {
    rosterPositions: data?.roster_positions?.length ? data.roster_positions : DEFAULT_ROSTER_POSITIONS,
    reserveSlots: data?.settings?.reserve_slots ?? 0,
    scoringSettings: data?.scoring_settings ?? {},
  };
}

/** Human label for a Sleeper lineup position (flex spots get a slash form). */
const SLOT_LABELS: Record<string, string> = {
  WRRB_FLEX: "W/R",
  REC_FLEX: "W/T",
  FLEX: "W/R/T",
  SUPER_FLEX: "Q/W/R/T",
};
function slotLabel(pos: string): string {
  return SLOT_LABELS[pos] ?? pos;
}

// --- Public API ---------------------------------------------------------------

export function getSnapshot(): LeagueSnapshot {
  return {
    season: Number(process.env.SLEEPER_SEASON) || CURRENT_SEASON,
    currentWeek: CURRENT_WEEK,
    live: isLiveConfigured(),
  };
}

interface SleeperNflState {
  week?: number;
  season_type?: string;
  season?: string;
}

/**
 * The NFL week in play right now, from Sleeper's league-wide state.
 *
 * `CURRENT_WEEK` in league-data is a hand-set constant, so anything that has to
 * follow the season week to week (the live ladder) reads this instead. Falls
 * back to the constant off-season or when Sleeper can't be reached.
 */
export async function getCurrentWeek(): Promise<number> {
  try {
    const res = await fetch(`${SLEEPER_BASE}/state/nfl`, { next: { revalidate: 300 } });
    if (!res.ok) return CURRENT_WEEK;
    const state = (await res.json()) as SleeperNflState;
    const season = Number(process.env.SLEEPER_SEASON) || CURRENT_SEASON;
    if (Number(state.season) !== season || state.season_type !== "regular" || !state.week) return CURRENT_WEEK;
    return state.week;
  } catch {
    return CURRENT_WEEK;
  }
}

export async function getStandings(): Promise<Standing[]> {
  const [rosters, users] = await Promise.all([getRosters(), getUsers()]);
  if (!rosters.length) return getFallbackStandings();

  const userById = new Map(users.map((u) => [u.user_id, u]));

  const standings = rosters.map((r) => {
    const s = r.settings ?? {};
    const wins = s.wins ?? 0;
    const losses = s.losses ?? 0;
    const ties = s.ties ?? 0;
    return {
      team: resolveTeam(r, r.owner_id ? userById.get(r.owner_id) : undefined),
      rank: 0,
      wins,
      losses,
      ties,
      pct: pct(wins, losses, ties),
      streak: r.metadata?.streak || "—",
      pointsFor: decimalPoints(s.fpts, s.fpts_decimal),
      pointsAgainst: decimalPoints(s.fpts_against, s.fpts_against_decimal),
      change: 0,
    } satisfies Standing;
  });

  standings.sort((a, b) => b.pct - a.pct || b.pointsFor - a.pointsFor);
  standings.forEach((s, i) => (s.rank = i + 1));
  return standings;
}

function rosterRecord(roster: SleeperRoster): MatchupSide["record"] {
  return {
    wins: roster.settings?.wins ?? 0,
    losses: roster.settings?.losses ?? 0,
    ties: roster.settings?.ties ?? 0,
  };
}

async function enrichManualMatchups(matchups: Matchup[], week: number): Promise<Matchup[]> {
  const season = Number(process.env.SLEEPER_SEASON) || CURRENT_SEASON;
  const [matchupRows, rosters, users, projections, players, config, schedule, scores] = await Promise.all([
    sleeperFetch<SleeperMatchup[]>(`/matchups/${week}`),
    getRosters(),
    getUsers(),
    fetchProjections(season, week),
    fetchPlayerCatalog(),
    getLeagueConfig(),
    fetchSchedule(season),
    fetchScores(season, week),
  ]);
  if (!rosters.length) return matchups;
  const startingSlots = startingSlotsFor(config);
  const gameByTeam = gameInfoForWeek(schedule, week, scores);

  const userById = new Map(users.map((u) => [u.user_id, u]));
  const rosterByTeamId = new Map<TeamId, SleeperRoster>();
  for (const roster of rosters) {
    const team = resolveTeam(roster, roster.owner_id ? userById.get(roster.owner_id) : undefined);
    rosterByTeamId.set(team.id, roster);
  }

  const liveByRosterId = new Map((matchupRows ?? []).map((row) => [row.roster_id, row]));
  const side = (manualSide: MatchupSide): [MatchupSide, LineupProgress | undefined] => {
    const roster = rosterByTeamId.get(manualSide.team.id);
    if (!roster) return [manualSide, undefined];
    const live = liveByRosterId.get(roster.roster_id);
    const progress = lineupProgress(roster, live, projections, players, gameByTeam);
    return [
      {
        ...manualSide,
        score: Math.round((live?.points ?? manualSide.score) * 100) / 100,
        projected: projectedTotal(roster, live, projections) ?? manualSide.projected,
        optimalProjected: optimalProjectedTotal(roster, live, projections, players, startingSlots),
        liveProjected: progress.liveProjected,
        record: rosterRecord(roster),
        rosterId: roster.roster_id,
      },
      progress,
    ];
  };

  return matchups.map((matchup) => {
    const [away, awayProgress] = side(matchup.away);
    const [home, homeProgress] = side(matchup.home);
    return {
      ...matchup,
      status: matchupStatus(away, home, awayProgress, homeProgress, matchup.status),
      away,
      home,
    };
  });
}

interface LineupProgress {
  liveProjected: number | undefined;
  /** Some starter's NFL game has kicked off. */
  started: boolean;
  /** Every starter's NFL game is over (or they have none this week). */
  finished: boolean;
}

/**
 * Where a lineup stands mid-week: whether its players are out there yet, and
 * the final score it's on track for.
 *
 * The projected final is what the Sleeper app shows while games run — a
 * finished player's points are banked, a player in a live game keeps his
 * points and earns the unplayed share of his projection (by game minutes
 * left), and a player yet to kick off is worth his full projection.
 */
function lineupProgress(
  roster: SleeperRoster | undefined,
  live: SleeperMatchup | undefined,
  projections: Map<string, number>,
  players: Record<string, SleeperPlayer> | null,
  gameByTeam: Map<string, TeamGameInfo>,
): LineupProgress {
  const scored = live?.players_points && Object.values(live.players_points).some((p) => p > 0);
  const starters = ((scored ? live?.starters : roster?.starters) ?? roster?.starters ?? []).filter(
    (id): id is string => Boolean(id) && id !== "0",
  );
  if (!starters.length) return { liveProjected: undefined, started: false, finished: false };

  let total = 0;
  let started = false;
  let finished = true;
  for (const id of starters) {
    // Team defences are keyed by their abbreviation and may be missing from the catalog.
    const proTeam = players?.[id]?.team ?? (/^[A-Z]{2,3}$/.test(id) ? id : undefined);
    const game = proTeam ? gameByTeam.get(proTeam) : undefined;
    const points = live?.players_points?.[id] ?? 0;
    const projected = projections.get(id) ?? 0;
    if (!game) {
      total += points; // bye week or free agent: nothing more to come
    } else if (!game.started) {
      total += projected;
      finished = false;
    } else if (game.live) {
      total += points + projected * (game.minutesRemaining / 60);
      started = true;
      finished = false;
    } else {
      total += points;
      started = true;
    }
  }
  return { liveProjected: Math.round(total * 100) / 100, started, finished };
}

/** Upcoming until a starter kicks off, final once every starter on both sides is done. */
function matchupStatus(
  away: MatchupSide,
  home: MatchupSide,
  awayProgress: LineupProgress | undefined,
  homeProgress: LineupProgress | undefined,
  fallback: Matchup["status"],
): Matchup["status"] {
  if (!awayProgress || !homeProgress) return away.score || home.score ? "live" : fallback;
  if (!awayProgress.started && !homeProgress.started && !away.score && !home.score) return "upcoming";
  return awayProgress.finished && homeProgress.finished ? "final" : "live";
}

export async function getMatchups(week: number): Promise<Matchup[]> {
  const currentSeasonMatchups = getCurrentSeasonMatchups(week);
  if (currentSeasonMatchups.length) return enrichManualMatchups(currentSeasonMatchups, week);

  const leagueId = readLeagueId();
  if (!leagueId) return getFallbackMatchups(week);

  const season = Number(process.env.SLEEPER_SEASON) || CURRENT_SEASON;
  const [matchupRows, rosters, users, projections, players, config, schedule, scores] = await Promise.all([
    sleeperFetch<SleeperMatchup[]>(`/matchups/${week}`),
    getRosters(),
    getUsers(),
    fetchProjections(season, week),
    fetchPlayerCatalog(),
    getLeagueConfig(),
    fetchSchedule(season),
    fetchScores(season, week),
  ]);
  if (!matchupRows?.length || !rosters.length) return getFallbackMatchups(week);
  const startingSlots = startingSlotsFor(config);
  const gameByTeam = gameInfoForWeek(schedule, week, scores);

  const userById = new Map(users.map((u) => [u.user_id, u]));
  const rosterById = new Map(rosters.map((r) => [r.roster_id, r]));
  const recordById = new Map(
    rosters.map((r) => [
      r.roster_id,
      { wins: r.settings?.wins ?? 0, losses: r.settings?.losses ?? 0, ties: r.settings?.ties ?? 0 },
    ]),
  );

  const grouped = new Map<number, SleeperMatchup[]>();
  for (const m of matchupRows) {
    if (m.matchup_id == null) continue;
    grouped.set(m.matchup_id, [...(grouped.get(m.matchup_id) ?? []), m]);
  }

  const out: Matchup[] = [];
  for (const [matchupId, pair] of grouped) {
    if (pair.length < 2) continue;
    const [a, b] = pair;
    const side = (m: SleeperMatchup): [MatchupSide, LineupProgress] => {
      const roster = rosterById.get(m.roster_id);
      const team = roster
        ? resolveTeam(roster, roster.owner_id ? userById.get(roster.owner_id) : undefined)
        : getTeamByName(`Team ${m.roster_id}`);
      const progress = lineupProgress(roster, m, projections, players, gameByTeam);
      return [
        {
          team,
          score: Math.round((m.points ?? 0) * 100) / 100,
          projected: projectedTotal(roster, m, projections),
          optimalProjected: optimalProjectedTotal(roster, m, projections, players, startingSlots),
          liveProjected: progress.liveProjected,
          record: recordById.get(m.roster_id),
          rosterId: m.roster_id,
        },
        progress,
      ];
    };

    const [away, awayProgress] = side(a);
    const [home, homeProgress] = side(b);
    out.push({
      id: `${week}-${matchupId}`,
      week,
      status: matchupStatus(away, home, awayProgress, homeProgress, "upcoming"),
      away,
      home,
    } satisfies Matchup);
  }

  if (!out.length) return getFallbackMatchups(week);
  return out;
}

export async function getRoster(teamId: number, week: number): Promise<Roster | null> {
  const leagueId = readLeagueId();
  if (!leagueId) return getFallbackRoster(teamId, week);

  const season = Number(process.env.SLEEPER_SEASON) || CURRENT_SEASON;

  const [rosters, users, matchupRows, players, projections, schedule, scores, config] = await Promise.all([
    getRosters(),
    getUsers(),
    sleeperFetch<SleeperMatchup[]>(`/matchups/${week}`),
    fetchPlayerCatalog(),
    fetchProjections(season, week),
    fetchSchedule(season),
    fetchScores(season, week),
    getLeagueConfig(),
  ]);

  const roster = rosters.find((r) => r.roster_id === teamId);
  if (!roster) return getFallbackRoster(teamId, week);

  const userById = new Map(users.map((u) => [u.user_id, u]));
  const team = resolveTeam(roster, roster.owner_id ? userById.get(roster.owner_id) : undefined);
  const live = matchupRows?.find((m) => m.roster_id === teamId);
  const gameByTeam = gameInfoForWeek(schedule, week, scores);

  // Rank within position by projected points (the rank badge, à la NFL.com).
  const posRankMap = new Map<string, number>();
  if (players) {
    const byPos = new Map<string, { id: string; pts: number }[]>();
    for (const [pid, pts] of projections) {
      const pos = players[pid]?.position;
      if (!pos) continue;
      (byPos.get(pos) ?? byPos.set(pos, []).get(pos)!).push({ id: pid, pts });
    }
    for (const arr of byPos.values()) {
      arr.sort((a, b) => b.pts - a.pts);
      arr.forEach((x, i) => posRankMap.set(x.id, i + 1));
    }
  }

  const buildEntry = (pid: string, slot: string, started: boolean): RosterEntry => {
    const meta = players?.[pid];
    const proTeam = meta?.team ?? undefined;
    const game = proTeam ? gameByTeam.get(proTeam) : undefined;
    return {
      playerId: Number(pid) || 0,
      name:
        meta?.first_name && meta?.last_name
          ? `${meta.first_name[0]}. ${meta.last_name}`
          : meta?.full_name || pid,
      position: meta?.position ?? "—",
      slot,
      proTeam,
      points: Math.round((live?.players_points?.[pid] ?? 0) * 100) / 100,
      projected: projections.get(pid),
      posRank: posRankMap.get(pid),
      started,
      sleeperId: pid,
      gameLabel: game?.label,
      gameWhen: game?.when,
      gameStarted: game?.started,
      gameLive: game?.live,
      gameClock: game?.clock,
      minutesRemaining: game?.minutesRemaining,
      injuryStatus: meta?.injury_status || undefined,
    };
  };

  // The lineup shown is the manager's actual set lineup (roster.starters). Only
  // once a game in the matchup has started scoring do we switch to the matchup's
  // locked starters (Sleeper auto-fills matchup starters before lock, which would
  // otherwise show benched players as starting).
  const hasScoring = !!live?.players_points && Object.values(live.players_points).some((p) => p > 0);
  const starterArr = (hasScoring ? live?.starters : roster.starters) ?? [];
  const startingPositions = config.rosterPositions.filter((p) => p !== "BN");
  const benchCount = config.rosterPositions.filter((p) => p === "BN").length;

  const starterIds = new Set(starterArr.filter((id) => id && id !== "0"));
  const reserveIds = (roster.reserve ?? []).filter((id) => id && id !== "0");
  const reserveSet = new Set(reserveIds);

  const starters: RosterSlot[] = startingPositions.map((pos, i) => {
    const pid = starterArr[i];
    const filled = pid && pid !== "0";
    const label = slotLabel(pos);
    return { label, entry: filled ? buildEntry(pid, label, true) : undefined };
  });

  const allPlayers = live?.players ?? roster.players ?? [];
  const benchPlayers = allPlayers.filter((pid) => !starterIds.has(pid) && !reserveSet.has(pid));
  const bench: RosterSlot[] = Array.from({ length: Math.max(benchCount, benchPlayers.length) }, (_, i) => ({
    label: "BN",
    entry: benchPlayers[i] ? buildEntry(benchPlayers[i], "BN", false) : undefined,
  }));

  const ir: RosterSlot[] = Array.from({ length: config.reserveSlots }, (_, i) => ({
    label: "IR",
    entry: reserveIds[i] ? buildEntry(reserveIds[i], "IR", false) : undefined,
  }));

  const entries = [...starters, ...bench, ...ir]
    .map((s) => s.entry)
    .filter((e): e is RosterEntry => Boolean(e));

  return { team, week, entries, starters, bench, ir };
}

/** Resolve one of our curated franchise ids to its live Sleeper roster_id, then
 *  load that roster's lineup. Returns null when the franchise has no claimed
 *  roster in the current Sleeper league (e.g. a franchise that hasn't joined). */
export async function getRosterByFranchise(franchiseId: number, week: number): Promise<Roster | null> {
  const leagueId = readLeagueId();
  if (!leagueId) return null;
  const [rosters, users] = await Promise.all([getRosters(), getUsers()]);
  const userById = new Map(users.map((u) => [u.user_id, u]));
  const match = rosters.find(
    (r) => resolveTeam(r, r.owner_id ? userById.get(r.owner_id) : undefined).id === franchiseId,
  );
  if (!match) return null;
  return getRoster(match.roster_id, week);
}

export async function getWeekKickoff(week: number): Promise<WeekKickoff | null> {
  const season = Number(process.env.SLEEPER_SEASON) || CURRENT_SEASON;
  const [schedule, scores] = await Promise.all([fetchSchedule(season), fetchScores(season, week)]);
  const scoreByGameId = new Map(scores.map((score) => [score.game_id, score]));

  const candidates: number[] = [];
  for (const game of schedule) {
    if (game.week !== week) continue;
    const score = scoreByGameId.get(game.game_id);
    const timestamp = parseKickoffTimestamp(score?.metadata?.date_time ?? score?.date ?? game.date);
    if (timestamp != null) candidates.push(timestamp);
  }

  if (!candidates.length) {
    for (const score of scores) {
      const timestamp = parseKickoffTimestamp(score.metadata?.date_time ?? score.date);
      if (timestamp != null) candidates.push(timestamp);
    }
  }

  if (!candidates.length) return null;
  return { week, iso: new Date(Math.min(...candidates)).toISOString() };
}

export interface KeeperPlayer {
  sleeperId: string;
  name: string;
  position: string;
  proTeam?: string;
  injuryStatus?: string;
}

export interface TeamKeepers {
  team: TeamMeta;
  players: KeeperPlayer[];
}

// Order positions the way a fantasy roster reads (QB, RB, WR, TE, then K/DEF).
const KEEPER_POS_ORDER = ["QB", "RB", "WR", "TE", "K", "DEF"];

/**
 * Every franchise's currently-kept players heading into the 2026 draft. While
 * the league is pre-draft, `roster.players` holds only the handful of keepers
 * each manager has locked in — exactly the forward-looking roster snapshot the
 * Keepers Board wants. Sorted by franchise id, players grouped by position.
 */
export async function getKeepers(): Promise<TeamKeepers[]> {
  const leagueId = readLeagueId();
  if (!leagueId) return [];

  const [rosters, users, catalog] = await Promise.all([
    getRosters(),
    getUsers(),
    fetchPlayerCatalog(),
  ]);
  const userById = new Map(users.map((u) => [u.user_id, u]));

  const rows: TeamKeepers[] = rosters.map((roster) => {
    const team = resolveTeam(roster, roster.owner_id ? userById.get(roster.owner_id) : undefined);
    const players: KeeperPlayer[] = (roster.players ?? [])
      .filter((id) => id && id !== "0")
      .map((id) => {
        const meta = catalog?.[id];
        return {
          sleeperId: id,
          name: meta?.full_name || [meta?.first_name, meta?.last_name].filter(Boolean).join(" ") || id,
          position: meta?.position ?? "—",
          proTeam: meta?.team ?? undefined,
          injuryStatus: meta?.injury_status || undefined,
        };
      })
      .sort((a, b) => {
        const pa = KEEPER_POS_ORDER.indexOf(a.position);
        const pb = KEEPER_POS_ORDER.indexOf(b.position);
        return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb) || a.name.localeCompare(b.name);
      });
    return { team, players };
  });

  return rows.sort((a, b) => a.team.id - b.team.id);
}

export interface ByePlayer {
  sleeperId: string;
  /** "J. Jefferson", or the nickname ("Chargers") for a team defence. */
  name: string;
  position: string;
  proTeam: string;
}

/** byes[franchiseId][week] — that roster's players whose NFL team is on bye. */
export type ByeMap = Record<number, Record<number, ByePlayer[]>>;

/**
 * Every rostered player (IR included) filed under their NFL team's bye week.
 * A team's bye is the regular-season week it's missing from Sleeper's NFL
 * schedule; MGL weeks run in step with NFL weeks, so they line up directly.
 */
export async function getByePlayers(): Promise<ByeMap> {
  const leagueId = readLeagueId();
  if (!leagueId) return {};

  const season = Number(process.env.SLEEPER_SEASON) || CURRENT_SEASON;
  const [rosters, users, catalog, schedule] = await Promise.all([
    getRosters(),
    getUsers(),
    fetchPlayerCatalog(),
    fetchSchedule(season),
  ]);
  if (!catalog || !schedule.length) return {};

  const weeks = [...new Set(schedule.map((g) => g.week))].sort((a, b) => a - b);
  const weeksPlayed = new Map<string, Set<number>>();
  for (const game of schedule) {
    for (const proTeam of [game.home, game.away]) {
      (weeksPlayed.get(proTeam) ?? weeksPlayed.set(proTeam, new Set()).get(proTeam)!).add(game.week);
    }
  }
  const byeWeek = new Map<string, number>();
  for (const [proTeam, played] of weeksPlayed) {
    const bye = weeks.find((w) => !played.has(w));
    if (bye !== undefined) byeWeek.set(proTeam, bye);
  }

  const userById = new Map(users.map((u) => [u.user_id, u]));
  const byes: ByeMap = {};
  for (const roster of rosters) {
    const team = resolveTeam(roster, roster.owner_id ? userById.get(roster.owner_id) : undefined);
    const byWeek: Record<number, ByePlayer[]> = (byes[team.id] = {});
    for (const id of roster.players ?? []) {
      const meta = catalog[id];
      const week = meta?.team ? byeWeek.get(meta.team) : undefined;
      if (!meta?.team || week === undefined) continue;
      (byWeek[week] ??= []).push({
        sleeperId: id,
        name:
          meta.position === "DEF"
            ? meta.last_name || meta.team
            : meta.first_name && meta.last_name
              ? `${meta.first_name[0]}. ${meta.last_name}`
              : meta.full_name || id,
        position: meta.position ?? "—",
        proTeam: meta.team,
      });
    }
    for (const list of Object.values(byWeek)) {
      list.sort((a, b) => {
        const pa = KEEPER_POS_ORDER.indexOf(a.position);
        const pb = KEEPER_POS_ORDER.indexOf(b.position);
        return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb) || a.name.localeCompare(b.name);
      });
    }
  }
  return byes;
}

function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'']/g, "")
    .replace(/\s+(jr|sr|ii|iii|iv)\.?$/, "")
    .trim();
}

let nameToIdCache: Map<string, string> | null = null;

/**
 * Sleeper never drops a player from its catalog, so common names collide — there
 * are two Lamar Jacksons in there, the Ravens QB and a cornerback. Rank the
 * candidates so the fantasy-relevant one wins a bare-name lookup: on an NFL
 * roster beats off it, and still-active beats retired.
 */
function nameMatchRank(p: SleeperPlayer): number {
  return (p.team ? 2 : 0) + (p.active === false ? 0 : 1);
}

/** Name → Sleeper player id, for matching static/curated player lists (e.g. the mock draft
 *  pool) to Sleeper's own id scheme so they can use the real headshot CDN.
 *
 *  Every player is filed under two keys: `"name|POS"`, which separates
 *  same-named players at different positions outright, and the bare `"name"` as
 *  a fallback for when the caller's position label doesn't match Sleeper's.
 *  Look the composite key up first — see attachSleeperIds. */
export async function getPlayerNameToIdMap(): Promise<Map<string, string>> {
  if (nameToIdCache) return nameToIdCache;
  const catalog = await fetchPlayerCatalog();
  const map = new Map<string, string>();
  const bestRank = new Map<string, number>();

  if (catalog) {
    for (const [id, p] of Object.entries(catalog)) {
      const full = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ");
      if (!full) continue;

      const name = normalizePlayerName(full);
      const rank = nameMatchRank(p);
      for (const key of p.position ? [`${name}|${p.position}`, name] : [name]) {
        if ((bestRank.get(key) ?? -1) >= rank) continue;
        bestRank.set(key, rank);
        map.set(key, id);
      }
    }
  }

  nameToIdCache = map;
  return map;
}

let playerCatalogCache: Record<string, SleeperPlayer> | null = null;

/** Sleeper's full player catalog is large and static within a season, so cache it in memory. */
async function fetchPlayerCatalog(): Promise<Record<string, SleeperPlayer> | null> {
  if (playerCatalogCache) return playerCatalogCache;
  try {
    const res = await fetch(`${SLEEPER_BASE.replace("/v1", "")}/v1/players/nfl`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    playerCatalogCache = (await res.json()) as Record<string, SleeperPlayer>;
    return playerCatalogCache;
  } catch (err) {
    console.warn("[sleeper] player catalog fetch failed:", err);
    return null;
  }
}

// --- Projections + NFL schedule (for pre-game roster views) -----------------
// Projections live on api.sleeper.com (not the .app v1 host); the NFL schedule
// (home/away, status, date) lives on the .app host. Both are keyed so they can
// be joined to roster entries by Sleeper player id and pro-team abbreviation.

const SLEEPER_HOST = SLEEPER_BASE.replace("/v1", ""); // https://api.sleeper.app
const SLEEPER_DATA_HOST = "https://api.sleeper.com";

interface SleeperProjection {
  player_id: string;
  stats?: Record<string, number>;
}

interface SleeperScheduleGame {
  status: string;
  date: string;
  home: string;
  away: string;
  week: number;
  game_id: string;
}

interface SleeperScoreGame {
  status: string;
  date: string;
  game_id: string;
  week: number;
  metadata?: {
    away_score?: number;
    away_team?: string;
    closed?: boolean;
    has_started?: boolean;
    home_score?: number;
    home_team?: string;
    is_in_progress?: boolean;
    quarter_num?: number;
    time_remaining?: string;
    is_over?: boolean;
    status?: string;
    date_time?: string;
  };
}

export interface WeekKickoff {
  week: number;
  iso: string;
}

// Projections move through the week (injuries, inactives), so expire them in step
// with the fetch's revalidate window below.
const PROJECTIONS_TTL_MS = 300_000;
const projectionCache = new Map<string, { at: number; data: Map<string, number> }>();

/**
 * Per-player projected points, keyed by Sleeper player id.
 *
 * Scored with the LEAGUE's own rules rather than the feed's ready-made
 * `pts_ppr`. MGL deviates from standard PPR (interceptions -3 not -1, lost
 * fumbles -3 not -2), so `pts_ppr` runs a few points hot per team — enough to
 * shift a projected total and the betting line built on it. Applying
 * scoring_settings to the raw stat line reproduces the numbers Sleeper itself
 * shows for this league.
 */
async function fetchProjections(season: number, week: number): Promise<Map<string, number>> {
  const key = `${season}-${week}`;
  const cached = projectionCache.get(key);
  if (cached && Date.now() - cached.at < PROJECTIONS_TTL_MS) return cached.data;

  const map = new Map<string, number>();
  try {
    const [res, config] = await Promise.all([
      // Not `no-store`: getMatchups reads projections now, and a no-store fetch
      // drags every page that calls it out of static rendering (/newspaper and
      // /playoff-simulator would bail out and get no projections at all). The
      // payload is past the 2MB data-cache ceiling regardless, so this revalidate
      // window costs nothing and keeps those routes prerenderable.
      fetch(`${SLEEPER_DATA_HOST}/projections/nfl/${season}/${week}?season_type=regular`, {
        next: { revalidate: 300 },
      }),
      getLeagueConfig(),
    ]);
    if (res.ok) {
      const data = (await res.json()) as SleeperProjection[];
      const scoring = config.scoringSettings;
      const hasScoring = Object.keys(scoring).length > 0;
      for (const p of data) {
        const stats = p.stats;
        if (!stats) continue;
        // Fall back to the feed's PPR total if the league config is unavailable.
        let pts = 0;
        if (hasScoring) {
          for (const [stat, value] of Object.entries(stats)) {
            const weight = scoring[stat];
            if (typeof weight === "number" && typeof value === "number") pts += value * weight;
          }
        } else if (typeof stats.pts_ppr === "number") {
          pts = stats.pts_ppr;
        } else {
          continue;
        }
        map.set(p.player_id, Math.round(pts * 100) / 100);
      }
    } else {
      console.warn(`[sleeper] projections ${res.status} for ${key}`);
    }
  } catch (err) {
    console.warn("[sleeper] projections fetch failed:", err);
  }
  projectionCache.set(key, { at: Date.now(), data: map });
  return map;
}

/**
 * Projected total for a roster: its starters' projections summed.
 *
 * Before kickoff this uses the manager's own lineup (`roster.starters`).
 * Sleeper auto-fills the matchup endpoint's starters before lock, so reading
 * those would project benched players as starting. Once anything in the
 * matchup has scored, the live lineup is the real one.
 */
function projectedTotal(
  roster: SleeperRoster | undefined,
  live: SleeperMatchup | undefined,
  projections: Map<string, number>,
): number | undefined {
  if (!projections.size) return undefined;
  const started = live?.players_points && Object.values(live.players_points).some((p) => p > 0);
  const starters = (started ? live?.starters : roster?.starters) ?? roster?.starters ?? [];
  const ids = starters.filter((id): id is string => Boolean(id) && id !== "0");
  if (!ids.length) return undefined;
  const total = ids.reduce((sum, id) => sum + (projections.get(id) ?? 0), 0);
  return Math.round(total * 100) / 100;
}

/**
 * Projected total for the best lineup this roster could field.
 *
 * Unlike {@link projectedTotal} this ignores who the manager actually started —
 * every rostered player bar IR is a candidate for a slot. It exists to price the
 * novelty betting lines, which should read a roster's strength rather than
 * whether its manager remembered to set a lineup.
 */
function optimalProjectedTotal(
  roster: SleeperRoster | undefined,
  live: SleeperMatchup | undefined,
  projections: Map<string, number>,
  players: Record<string, SleeperPlayer> | null,
  startingSlots: string[],
): number | undefined {
  if (!projections.size || !players || !roster || !startingSlots.length) return undefined;
  const reserve = new Set((roster.reserve ?? []).filter((id) => id && id !== "0"));
  const ids = (live?.players ?? roster.players ?? []).filter((id) => id && id !== "0" && !reserve.has(id));
  if (!ids.length) return undefined;
  const total = optimalLineupTotal(
    ids.map((id) => ({ id, position: players[id]?.position ?? "", projected: projections.get(id) ?? 0 })),
    startingSlots,
  );
  return total > 0 ? total : undefined;
}

/** The league's starting slots — everything that isn't bench or IR. */
function startingSlotsFor(config: LeagueConfig): string[] {
  return config.rosterPositions.filter((p) => p !== "BN" && p !== "IR");
}

const scheduleCache = new Map<number, SleeperScheduleGame[]>();

async function fetchSchedule(season: number): Promise<SleeperScheduleGame[]> {
  const cached = scheduleCache.get(season);
  if (cached) return cached;
  try {
    const res = await fetch(`${SLEEPER_HOST}/schedule/nfl/regular/${season}`, { next: { revalidate: 86400 } });
    if (!res.ok) {
      console.warn(`[sleeper] schedule ${res.status} for ${season}`);
      return [];
    }
    const data = (await res.json()) as SleeperScheduleGame[];
    scheduleCache.set(season, data);
    return data;
  } catch (err) {
    console.warn("[sleeper] schedule fetch failed:", err);
    return [];
  }
}

const NOT_STARTED_STATUSES = new Set(["", "pre_game", "scheduled"]);

// Live game state, so the in-memory copy has to expire along with the fetch's own
// revalidate window — held forever it would freeze clocks and "live" flags.
const SCORES_TTL_MS = 60_000;
const scoresCache = new Map<string, { at: number; data: SleeperScoreGame[] }>();

async function fetchScores(season: number, week: number): Promise<SleeperScoreGame[]> {
  const key = `${season}-${week}`;
  const cached = scoresCache.get(key);
  if (cached && Date.now() - cached.at < SCORES_TTL_MS) return cached.data;

  try {
    const res = await fetch(`${SLEEPER_HOST}/scores/nfl/regular/${season}/${week}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      console.warn(`[sleeper] scores ${res.status} for ${key}`);
      return [];
    }
    const data = (await res.json()) as SleeperScoreGame[];
    scoresCache.set(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    console.warn("[sleeper] scores fetch failed:", err);
    return [];
  }
}

interface TeamGameInfo {
  label: string;
  when: string;
  started: boolean;
  /** In progress right now (kicked off, not yet final). */
  live: boolean;
  /** Live clock, e.g. "Q3 04:12" — only set while the game is in progress. */
  clock?: string;
  /** NFL minutes still to play, 0-60. Drives the "Min. Remaining" bars. */
  minutesRemaining: number;
}

/** NFL game minutes still to play: a full 60 before kickoff, the rest of the
 *  current quarter plus whatever quarters follow while live, 0 once final. */
function minutesLeft(meta: SleeperScoreGame["metadata"], started: boolean, complete: boolean): number {
  if (complete) return 0;
  if (!started) return 60;
  const quarter = meta?.quarter_num ?? 1;
  const [mm = "0"] = (meta?.time_remaining ?? "15:00").split(":");
  const inQuarter = Math.max(0, Math.min(15, Number(mm) || 0));
  // Overtime (quarter 5+) is untimed as far as this estimate goes.
  const quartersLeft = Math.max(0, 4 - quarter);
  return quartersLeft * 15 + inQuarter;
}

/** Map each NFL team to its game this week, from that team's perspective ("CLE @ NE" vs "DEN vs DAL"). */
function gameInfoForWeek(
  schedule: SleeperScheduleGame[],
  week: number,
  scores: SleeperScoreGame[]
): Map<string, TeamGameInfo> {
  const map = new Map<string, TeamGameInfo>();
  const scoreByGameId = new Map(scores.map((s) => [s.game_id, s]));

  for (const g of schedule) {
    if (g.week !== week) continue;
    const score = scoreByGameId.get(g.game_id);
    const scoreMeta = score?.metadata;
    const when = formatGameDate(score?.date ?? g.date);
    const started = Boolean(scoreMeta?.has_started) || !NOT_STARTED_STATUSES.has(score?.status ?? g.status);
    const complete = Boolean(scoreMeta?.is_over || scoreMeta?.closed || score?.status === "complete");
    const awayScore = scoreMeta?.away_score;
    const homeScore = scoreMeta?.home_score;
    const hasScore = started && typeof awayScore === "number" && typeof homeScore === "number";

    const live = started && !complete;
    // Live games read as a running score ("BUF 14 vs PHI 7"); finals keep the
    // result letter; anything not yet kicked off is just the fixture.
    const awayLabel =
      hasScore && complete
        ? `${g.away} ${awayScore} @ ${g.home} ${homeScore} ((${resultLetter(awayScore, homeScore)}))`
        : hasScore && live
        ? `${g.away} ${awayScore} @ ${g.home} ${homeScore}`
        : `${g.away} @ ${g.home}`;
    const homeLabel =
      hasScore && complete
        ? `${g.home} ${homeScore} vs ${g.away} ${awayScore} ((${resultLetter(homeScore, awayScore)}))`
        : hasScore && live
        ? `${g.home} ${homeScore} vs ${g.away} ${awayScore}`
        : `${g.home} vs ${g.away}`;

    const quarter = scoreMeta?.quarter_num;
    const clock = live && quarter ? `Q${quarter} ${scoreMeta?.time_remaining ?? ""}`.trim() : undefined;
    const remaining = minutesLeft(scoreMeta, started, complete);

    map.set(g.away, { label: awayLabel, when, started, live, clock, minutesRemaining: remaining });
    map.set(g.home, { label: homeLabel, when, started, live, clock, minutesRemaining: remaining });
  }
  return map;
}

function parseKickoffTimestamp(value?: string): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function resultLetter(teamScore: number, oppScore: number): "W" | "L" | "T" {
  if (teamScore > oppScore) return "W";
  if (teamScore < oppScore) return "L";
  return "T";
}

/** Sleeper's schedule gives a game date (no kickoff time), so render the day, e.g. "Sun, Sep 7". */
function formatGameDate(date: string): string {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
