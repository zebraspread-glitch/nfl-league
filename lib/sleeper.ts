import "server-only";

import type {
  Standing,
  Matchup,
  Roster,
  RosterEntry,
  RosterSlot,
  TeamMeta,
  TeamId,
  LeagueSnapshot,
} from "./types";
import { getTeam, getTeamByName, TEAMS } from "./teams";
import {
  CURRENT_SEASON,
  CURRENT_WEEK,
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

function readLeagueId(): string | null {
  return process.env.SLEEPER_LEAGUE_ID || null;
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
 * franchise id. All 10 joined managers are mapped; the two remaining rosters
 * have no owner yet (De'Aaron Cronin id 3 and Tinkle Van Ginkel id 7 still to
 * join) and fall through to a grey placeholder until claimed.
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
};

/**
 * Map a Sleeper roster to our curated metadata, matching by team/owner name.
 * Sleeper's roster_id is assigned by join order, not by our franchise id, so
 * it's never used as an identity hint — only the manager's chosen team name
 * (or display name) tells us which franchise a roster really is. Rosters
 * still unclaimed (no owner) fall through to a generic placeholder.
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
}

interface LeagueConfig {
  rosterPositions: string[];
  reserveSlots: number;
}

const DEFAULT_ROSTER_POSITIONS = ["QB", "RB", "RB", "WR", "WR", "TE", "WRRB_FLEX", "K", "DEF", "BN", "BN", "BN", "BN", "BN", "BN"];

/** League slot template (starting positions, bench count, IR slots). Static within a season. */
async function getLeagueConfig(): Promise<LeagueConfig> {
  const data = await sleeperFetch<SleeperLeague>("", 3600);
  return {
    rosterPositions: data?.roster_positions?.length ? data.roster_positions : DEFAULT_ROSTER_POSITIONS,
    reserveSlots: data?.settings?.reserve_slots ?? 0,
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

export async function getMatchups(week: number): Promise<Matchup[]> {
  const leagueId = readLeagueId();
  if (!leagueId) return getFallbackMatchups(week);

  const [matchupRows, rosters, users] = await Promise.all([
    sleeperFetch<SleeperMatchup[]>(`/matchups/${week}`),
    getRosters(),
    getUsers(),
  ]);
  if (!matchupRows?.length || !rosters.length) return getFallbackMatchups(week);

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
    const side = (m: SleeperMatchup) => {
      const roster = rosterById.get(m.roster_id);
      const team = roster
        ? resolveTeam(roster, roster.owner_id ? userById.get(roster.owner_id) : undefined)
        : getTeamByName(`Team ${m.roster_id}`);
      return {
        team,
        score: Math.round((m.points ?? 0) * 100) / 100,
        record: recordById.get(m.roster_id),
        rosterId: m.roster_id,
      };
    };

    out.push({
      id: `${week}-${matchupId}`,
      week,
      status: a.points || b.points ? "live" : "upcoming",
      away: side(a),
      home: side(b),
    } satisfies Matchup);
  }

  if (!out.length) return getFallbackMatchups(week);
  return out;
}

export async function getRoster(teamId: number, week: number): Promise<Roster | null> {
  const leagueId = readLeagueId();
  if (!leagueId) return getFallbackRoster(teamId, week);

  const season = Number(process.env.SLEEPER_SEASON) || CURRENT_SEASON;

  const [rosters, users, matchupRows, players, projections, schedule, config, scores] = await Promise.all([
    getRosters(),
    getUsers(),
    sleeperFetch<SleeperMatchup[]>(`/matchups/${week}`),
    fetchPlayerCatalog(),
    fetchProjections(season, week),
    fetchSchedule(season),
    getLeagueConfig(),
    fetchScores(season, week),
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

function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'']/g, "")
    .replace(/\s+(jr|sr|ii|iii|iv)\.?$/, "")
    .trim();
}

let nameToIdCache: Map<string, string> | null = null;

/** Name → Sleeper player id, for matching static/curated player lists (e.g. the mock draft
 *  pool) to Sleeper's own id scheme so they can use the real headshot CDN. */
export async function getPlayerNameToIdMap(): Promise<Map<string, string>> {
  if (nameToIdCache) return nameToIdCache;
  const catalog = await fetchPlayerCatalog();
  const map = new Map<string, string>();
  if (catalog) {
    for (const [id, p] of Object.entries(catalog)) {
      const full = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ");
      if (full) map.set(normalizePlayerName(full), id);
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
  stats?: { pts_ppr?: number };
}

interface SleeperScheduleGame {
  status: string;
  date: string;
  home: string;
  away: string;
  week: number;
  game_id: string;
}

const projectionCache = new Map<string, Map<string, number>>();

/** Per-player projected points (PPR — the league scores 1.0 per reception), keyed by Sleeper player id. */
async function fetchProjections(season: number, week: number): Promise<Map<string, number>> {
  const key = `${season}-${week}`;
  const cached = projectionCache.get(key);
  if (cached) return cached;

  const map = new Map<string, number>();
  try {
    const res = await fetch(`${SLEEPER_DATA_HOST}/projections/nfl/${season}/${week}?season_type=regular`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as SleeperProjection[];
      for (const p of data) {
        const pts = p.stats?.pts_ppr;
        if (typeof pts === "number") map.set(p.player_id, Math.round(pts * 100) / 100);
      }
    } else {
      console.warn(`[sleeper] projections ${res.status} for ${key}`);
    }
  } catch (err) {
    console.warn("[sleeper] projections fetch failed:", err);
  }
  projectionCache.set(key, map);
  return map;
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

interface TeamGameInfo {
  label: string;
  when: string;
  started: boolean;
}

/** Final/live score for one NFL game, keyed by team abbreviation, from ESPN's public scoreboard. */
interface TeamScore {
  teamScore: number;
  oppScore: number;
  completed: boolean;
}

// ESPN team abbreviations occasionally differ from Sleeper's.
const ESPN_ABBR_TO_SLEEPER: Record<string, string> = { WSH: "WAS", JAX: "JAC" };

const scoresCache = new Map<string, Map<string, TeamScore>>();

/** Live/final NFL scores for the week, from ESPN's public (unauthenticated) scoreboard API. */
async function fetchScores(season: number, week: number): Promise<Map<string, TeamScore>> {
  const key = `${season}-${week}`;
  const cached = scoresCache.get(key);
  if (cached) return cached;
  const map = new Map<string, TeamScore>();
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}&seasontype=2&year=${season}`,
      { next: { revalidate: 60 } }
    );
    if (res.ok) {
      const data = await res.json();
      for (const event of data?.events ?? []) {
        const competition = event?.competitions?.[0];
        const state = competition?.status?.type?.state;
        const completed = state === "post";
        const competitors = competition?.competitors ?? [];
        for (const c of competitors) {
          const opp = competitors.find((o: { id: string }) => o.id !== c.id);
          if (!opp) continue;
          let abbr: string = c.team?.abbreviation ?? "";
          abbr = ESPN_ABBR_TO_SLEEPER[abbr] ?? abbr;
          map.set(abbr, {
            teamScore: Number(c.score) || 0,
            oppScore: Number(opp.score) || 0,
            completed,
          });
        }
      }
    } else {
      console.warn(`[sleeper] scoreboard ${res.status} for week ${week}`);
    }
  } catch (err) {
    console.warn("[sleeper] scoreboard fetch failed:", err);
  }
  scoresCache.set(key, map);
  return map;
}

/** Map each NFL team to its game this week, from that team's perspective ("CLE @ NE" vs "DEN vs DAL"). */
function gameInfoForWeek(
  schedule: SleeperScheduleGame[],
  week: number,
  scores: Map<string, TeamScore>
): Map<string, TeamGameInfo> {
  const map = new Map<string, TeamGameInfo>();
  for (const g of schedule) {
    if (g.week !== week) continue;
    const when = formatGameDate(g.date);
    const started = !NOT_STARTED_STATUSES.has(g.status);

    const awayScore = scores.get(g.away);
    const homeScore = scores.get(g.home);

    const awayLabel =
      awayScore?.completed
        ? `${g.away} ${awayScore.teamScore} @ ${g.home} ${awayScore.oppScore} ((${resultLetter(awayScore)}))`
        : `${g.away} @ ${g.home}`;
    const homeLabel =
      homeScore?.completed
        ? `${g.home} ${homeScore.teamScore} vs ${g.away} ${homeScore.oppScore} ((${resultLetter(homeScore)}))`
        : `${g.home} vs ${g.away}`;

    map.set(g.away, { label: awayLabel, when, started });
    map.set(g.home, { label: homeLabel, when, started });
  }
  return map;
}

function resultLetter(score: TeamScore): "W" | "L" | "T" {
  if (score.teamScore > score.oppScore) return "W";
  if (score.teamScore < score.oppScore) return "L";
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
