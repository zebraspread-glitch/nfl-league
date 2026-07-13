import type { PlayerAvailability, PlayerBrowserItem, PlayerStats, SparseStats } from "./player-browser";
import { getTeam, getTeamByName, TEAMS } from "@/lib/teams";
import type { TeamId, TeamMeta } from "@/lib/types";

/** Internal build shape: full (dense) stat lines for easy accumulation. Converted to the
 *  sparse wire format at the end of getPlayerBrowserItems — shipping dense maps blew the
 *  pre-rendered page past Vercel's ~19 MB ISR response limit. */
type FullStatsItem = Omit<PlayerBrowserItem, "stats" | "projection" | "statsByPeriod" | "projectionsByPeriod"> & {
  stats: PlayerStats;
  projection: PlayerStats;
  statsByPeriod: Record<string, PlayerStats>;
  projectionsByPeriod: Record<string, PlayerStats>;
};

const SLEEPER_API = "https://api.sleeper.app/v1";
const SLEEPER_DATA_API = "https://api.sleeper.com";
const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID || "1374614405412560896";
export const PLAYER_DATA_SEASON = Number(process.env.SLEEPER_SEASON) || 2026;
const DEFAULT_SEASON = PLAYER_DATA_SEASON;
const SEASON_KEY = `${DEFAULT_SEASON} Season`;
const LAST_2_KEY = "Last 2 WKS";
const LAST_4_KEY = "Last 4 WKS";
const WEEKS = Array.from({ length: 18 }, (_, index) => index + 1);
const LAST_2_WEEKS = new Set([17, 18]);
const LAST_4_WEEKS = new Set([15, 16, 17, 18]);
const POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

interface SleeperStatRow {
  player_id: string;
  week: number;
  team?: string;
  opponent?: string;
  stats?: Record<string, number>;
  player?: SleeperPlayerMeta;
}

interface SleeperPlayerMeta {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  position?: string;
  team?: string;
  injury_status?: string | null;
  fantasy_positions?: string[];
  search_rank?: number;
  status?: string;
  years_exp?: number;
  age?: number;
  depth_chart_order?: number;
}

interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  players?: string[] | null;
  starters?: string[] | null;
  reserve?: string[] | null;
  metadata?: { team_name?: string } | null;
}

interface SleeperUser {
  user_id: string;
  display_name: string;
  metadata?: { team_name?: string };
}

interface SleeperTrendRow {
  player_id: string;
  count: number;
}

interface SleeperTransaction {
  type?: "trade" | "free_agent" | "waiver";
  status?: string;
  adds?: Record<string, number> | null;
  drops?: Record<string, number> | null;
  created?: number;
  status_updated?: number;
}

interface OwnedBy {
  status: "Taken";
  rosterId: number;
  manager: string;
  ownerTeamName: string;
  ownerTeamAbbrev: string;
  ownerTeamLogo?: string;
  ownerTeamPrimary: string;
  ownerTeamSecondary: string;
}

interface TransactionSummary {
  waiverPlayerIds: Set<string>;
  rosterAdds: Map<string, number>;
  rosterDrops: Map<string, number>;
  waiverAdds: Map<string, number>;
}

interface FantasyAgainstValue {
  rank: number;
  avg: number;
}

const SLEEPER_USERNAME_TO_TEAM_ID: Record<string, TeamId> = {
  pahomgl: 9,
  brownlowrow: 11,
  chicook: 10,
  thomopatto: 2,
  thomoo: 2,
  dimmymgl: 1,
  monkevengence: 6,
  lucasdalts98746: 8,
  tyhillmgl: 8,
  luckybison: 12,
  lavarballs27: 5,
  lavarballsmgl: 5,
  ginnivanjefferson: 4,
};

const SLEEPER_ROSTER_TO_TEAM_ID: Record<number, TeamId> = {
  11: 7, // Tinkle Van Ginkel
  12: 3, // De'Aaron Cronin
};

function n(stats: Record<string, number> | undefined, key: string): number {
  return Number(stats?.[key] ?? 0);
}

function blankStats(): PlayerStats {
  return {
    passAtt: 0,
    passCmp: 0,
    passYds: 0,
    passTD: 0,
    passInt: 0,
    passSack: 0,
    rushAtt: 0,
    rushYds: 0,
    rushTD: 0,
    targets: 0,
    rec: 0,
    recYds: 0,
    recTD: 0,
    retTD: 0,
    fumTD: 0,
    twoPt: 0,
    fumLost: 0,
    fgMade: 0,
    fgAtt: 0,
    xpMade: 0,
    defSack: 0,
    defInt: 0,
    defTD: 0,
    points: 0,
    projected: 0,
    gp: 0,
  };
}

function addStats(total: PlayerStats, row: Record<string, number> | undefined, source: "actual" | "projection") {
  total.passAtt += n(row, "pass_att");
  total.passCmp += n(row, "pass_cmp");
  total.passYds += n(row, "pass_yd");
  total.passTD += n(row, "pass_td");
  total.passInt += n(row, "pass_int");
  total.passSack += n(row, "pass_sack");
  total.rushAtt += n(row, "rush_att");
  total.rushYds += n(row, "rush_yd");
  total.rushTD += n(row, "rush_td");
  total.targets += n(row, "rec_tgt");
  total.rec += n(row, "rec");
  total.recYds += n(row, "rec_yd");
  total.recTD += n(row, "rec_td");
  total.retTD += n(row, "ret_td") + n(row, "kick_ret_td") + n(row, "punt_ret_td");
  total.fumTD += n(row, "fum_rec_td") + n(row, "def_fum_td") + n(row, "st_fum_rec_td");
  total.twoPt += n(row, "pass_2pt") + n(row, "rush_2pt") + n(row, "rec_2pt");
  total.fumLost += n(row, "fum_lost");
  total.fgMade += n(row, "fgm");
  total.fgAtt += n(row, "fga");
  total.xpMade += n(row, "xpm");
  total.defSack += n(row, "sack");
  total.defInt += n(row, "int");
  total.defTD += n(row, "def_td");

  const points = n(row, "pts_ppr");
  if (source === "projection") {
    total.projected += points;
  } else {
    total.points += points;
    total.gp += n(row, "gp") || (points !== 0 ? 1 : 0);
  }
}

function periodKeysForWeek(week: number): string[] {
  const keys = [SEASON_KEY, String(week)];
  if (LAST_2_WEEKS.has(week)) keys.push(LAST_2_KEY);
  if (LAST_4_WEEKS.has(week)) keys.push(LAST_4_KEY);
  return keys;
}

function statsForPeriod(map: Record<string, PlayerStats>, key: string): PlayerStats {
  map[key] ??= blankStats();
  return map[key];
}

async function fetchJson<T>(url: string, revalidate = 86400): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.warn("[players] Sleeper fetch failed", url, err);
    return null;
  }
}

function ownerName(roster: SleeperRoster, user?: SleeperUser): string {
  return roster.metadata?.team_name || user?.metadata?.team_name || user?.display_name || `Roster ${roster.roster_id}`;
}

function normalized(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function ownerTeam(roster: SleeperRoster, user?: SleeperUser): TeamMeta {
  const byUsername = SLEEPER_USERNAME_TO_TEAM_ID[normalized(user?.display_name)];
  if (byUsername) {
    const team = getTeam(byUsername);
    if (team) return team;
  }

  const name = ownerName(roster, user);
  const byName = TEAMS.find((team) => normalized(team.name) === normalized(name));
  if (byName) return byName;

  const byManager = TEAMS.find((team) => normalized(team.manager) === normalized(user?.display_name));
  if (byManager) return byManager;

  const byRoster = SLEEPER_ROSTER_TO_TEAM_ID[roster.roster_id];
  if (byRoster) {
    const team = getTeam(byRoster);
    if (team) return team;
  }

  return getTeamByName(name || `Roster ${roster.roster_id}`, -roster.roster_id);
}

async function getOwnership(): Promise<Map<string, OwnedBy>> {
  const [rosters, users] = await Promise.all([
    fetchJson<SleeperRoster[]>(`${SLEEPER_API}/league/${LEAGUE_ID}/rosters`, 300),
    fetchJson<SleeperUser[]>(`${SLEEPER_API}/league/${LEAGUE_ID}/users`, 300),
  ]);
  const userById = new Map((users ?? []).map((user) => [user.user_id, user]));
  const ownership = new Map<string, OwnedBy>();

  for (const roster of rosters ?? []) {
    const user = roster.owner_id ? userById.get(roster.owner_id) : undefined;
    const manager = ownerName(roster, user);
    const team = ownerTeam(roster, user);
    const players = new Set([...(roster.players ?? []), ...(roster.starters ?? []), ...(roster.reserve ?? [])].filter(Boolean));
    for (const playerId of players) {
      ownership.set(playerId, {
        status: "Taken",
        rosterId: roster.roster_id,
        manager,
        ownerTeamName: team.name,
        ownerTeamAbbrev: team.abbrev,
        ownerTeamLogo: team.logo,
        ownerTeamPrimary: team.primary,
        ownerTeamSecondary: team.secondary,
      });
    }
  }

  return ownership;
}

async function getTransactions(): Promise<TransactionSummary> {
  const weeks = await Promise.all(
    WEEKS.map((week) => fetchJson<SleeperTransaction[]>(`${SLEEPER_API}/league/${LEAGUE_ID}/transactions/${week}`, 300)),
  );
  const rosterAdds = new Map<string, number>();
  const rosterDrops = new Map<string, number>();
  const waiverAdds = new Map<string, number>();
  const droppedAt = new Map<string, number>();

  for (const transaction of weeks.flatMap((week) => week ?? [])) {
    if (transaction.status && transaction.status !== "complete") continue;
    const timestamp = transaction.status_updated ?? transaction.created ?? 0;

    for (const playerId of Object.keys(transaction.adds ?? {})) {
      rosterAdds.set(playerId, (rosterAdds.get(playerId) ?? 0) + 1);
      if (transaction.type === "waiver") {
        waiverAdds.set(playerId, (waiverAdds.get(playerId) ?? 0) + 1);
      }
    }

    for (const playerId of Object.keys(transaction.drops ?? {})) {
      rosterDrops.set(playerId, (rosterDrops.get(playerId) ?? 0) + 1);
      droppedAt.set(playerId, Math.max(droppedAt.get(playerId) ?? 0, timestamp));
    }
  }

  const recentDropCutoff = Math.max(0, ...droppedAt.values()) - 1000 * 60 * 60 * 24 * 7;
  const waiverPlayerIds = new Set([...droppedAt.entries()].filter(([, dropped]) => dropped >= recentDropCutoff).map(([playerId]) => playerId));

  return { waiverPlayerIds, rosterAdds, rosterDrops, waiverAdds };
}

async function getTrending(type: "add" | "drop"): Promise<Map<string, number>> {
  const rows = await fetchJson<SleeperTrendRow[]>(`${SLEEPER_API}/players/nfl/trending/${type}?lookback_hours=24&limit=200`, 900);
  return new Map((rows ?? []).map((row) => [row.player_id, Number(row.count) || 0]));
}

function displayName(playerId: string, meta?: SleeperPlayerMeta): string {
  const first = meta?.first_name ?? "";
  const last = meta?.last_name ?? "";
  const full = meta?.full_name || `${first} ${last}`.trim();
  if (!full) return playerId;
  if (!first || !last) return full;
  return `${first[0]}. ${last}`;
}

function fullName(playerId: string, meta?: SleeperPlayerMeta): string {
  return meta?.full_name || [meta?.first_name, meta?.last_name].filter(Boolean).join(" ") || playerId;
}

function playerPhoto(playerId: string, pos: string): { imageUrl: string; isLogo: boolean } {
  if (pos === "DEF" || /^[A-Z]{2,3}$/.test(playerId)) {
    return { imageUrl: `https://sleepercdn.com/images/team_logos/nfl/${playerId.toLowerCase()}.png`, isLogo: true };
  }
  return { imageUrl: `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`, isLogo: false };
}

function availability(playerId: string, owned?: OwnedBy, transactions?: TransactionSummary): PlayerAvailability {
  if (owned) return "Taken";
  if (transactions?.waiverPlayerIds.has(playerId)) return "Waivers";
  return "FA";
}

function buildFantasyAgainst(rows: SleeperStatRow[]): Map<string, FantasyAgainstValue> {
  const totals = new Map<string, { pos: string; opponent: string; points: number; games: number }>();

  for (const row of rows) {
    const pos = row.player?.position || "";
    const opponent = row.opponent || "";
    if (!POSITIONS.has(pos) || !opponent) continue;
    const points = n(row.stats, "pts_ppr");
    const games = n(row.stats, "gp") || (points !== 0 ? 1 : 0);
    if (!games) continue;
    const key = `${pos}:${opponent}`;
    const total = totals.get(key) ?? { pos, opponent, points: 0, games: 0 };
    total.points += points;
    total.games += games;
    totals.set(key, total);
  }

  const byPos = new Map<string, { opponent: string; avg: number }[]>();
  for (const total of totals.values()) {
    const bucket = byPos.get(total.pos) ?? [];
    bucket.push({ opponent: total.opponent, avg: total.points / total.games });
    byPos.set(total.pos, bucket);
  }

  const result = new Map<string, FantasyAgainstValue>();
  for (const [pos, bucket] of byPos) {
    bucket
      .sort((a, b) => b.avg - a.avg)
      .forEach((entry, index) => {
        result.set(`${pos}:${entry.opponent}`, { rank: index + 1, avg: Math.round(entry.avg * 100) / 100 });
      });
  }
  return result;
}

function positionFor(playerId: string, meta?: SleeperPlayerMeta): string {
  if (/^[A-Z]{2,3}$/.test(playerId)) return "DEF";
  return meta?.position || meta?.fantasy_positions?.[0] || "";
}

/** Relevance gate, applied to every player (catalog- and stat-row-sourced alike) to keep
 *  the payload small: anyone involved in the league always passes, DEFs always pass, and
 *  everyone else needs an NFL team, a rosterable status, and a reasonable search rank. */
function isRelevantPlayer(playerId: string, pos: string, meta: SleeperPlayerMeta | undefined, ownership: Map<string, OwnedBy>, addTrend: Map<string, number>, dropTrend: Map<string, number>): boolean {
  if (!POSITIONS.has(pos)) return false;
  if (ownership.has(playerId) || addTrend.has(playerId) || dropTrend.has(playerId)) return true;
  if (pos === "DEF") return true;
  if (!meta?.team) return false;
  if (meta.status && !["Active", "Inactive", "Injured Reserve", "Physically Unable to Perform"].includes(meta.status)) return false;
  return (meta.search_rank ?? 9999) <= 1200;
}

/** Wire conversion: drop zero fields and round away float accumulation noise
 *  (e.g. "263.79999999999995") — both bloat the serialized page enormously. */
function sparse(stats: PlayerStats): SparseStats {
  const out: SparseStats = {};
  for (const key of Object.keys(stats) as (keyof PlayerStats)[]) {
    const value = stats[key];
    if (!value) continue;
    out[key] = Math.round(value * 100) / 100;
  }
  return out;
}

function sparseMap(map: Record<string, PlayerStats>): Record<string, SparseStats> {
  const out: Record<string, SparseStats> = {};
  for (const [key, value] of Object.entries(map)) {
    const slim = sparse(value);
    if (Object.keys(slim).length) out[key] = slim;
  }
  return out;
}

export async function getPlayerBrowserItems(): Promise<PlayerBrowserItem[]> {
  const [ownership, transactions, addTrend, dropTrend, playerCatalog, weeklyStats, weeklyProjections] = await Promise.all([
    getOwnership(),
    getTransactions(),
    getTrending("add"),
    getTrending("drop"),
    fetchJson<Record<string, SleeperPlayerMeta>>(`${SLEEPER_API}/players/nfl`, 86400),
    Promise.all(
      WEEKS.map((week) =>
        fetchJson<SleeperStatRow[]>(`${SLEEPER_DATA_API}/stats/nfl/${DEFAULT_SEASON}/${week}?season_type=regular`, 86400),
      ),
    ),
    Promise.all(
      WEEKS.map((week) =>
        fetchJson<SleeperStatRow[]>(`${SLEEPER_DATA_API}/projections/nfl/${DEFAULT_SEASON}/${week}?season_type=regular`, 86400),
      ),
    ),
  ]);

  const allStatsRows = weeklyStats.flatMap((week) => week ?? []);
  const fantasyAgainst = buildFantasyAgainst(allStatsRows);
  const byId = new Map<string, FullStatsItem>();

  const ensurePlayer = (playerId: string, rowMeta?: SleeperPlayerMeta, row?: Pick<SleeperStatRow, "team" | "opponent">): FullStatsItem | null => {
    const meta = rowMeta ?? playerCatalog?.[playerId];
    const pos = positionFor(playerId, meta);
    if (!isRelevantPlayer(playerId, pos, playerCatalog?.[playerId] ?? rowMeta, ownership, addTrend, dropTrend)) return null;

    const owned = ownership.get(playerId);
    const status = availability(playerId, owned, transactions);
    const current = byId.get(playerId);
    if (current) {
      current.proTeam = meta?.team || row?.team || current.proTeam;
      current.opponent = row?.opponent || current.opponent;
      current.matchup = current.opponent ? `@${current.opponent}` : current.matchup;
      current.injuryStatus = meta?.injury_status || current.injuryStatus;
      current.fantasyAgainst = current.opponent ? fantasyAgainst.get(`${current.pos}:${current.opponent}`) : current.fantasyAgainst;
      return current;
    }

    const statsByPeriod: Record<string, PlayerStats> = {};
    const projectionsByPeriod: Record<string, PlayerStats> = {};
    const opponent = row?.opponent || "";
    const item = {
      playerId,
      displayName: displayName(playerId, meta),
      fullName: fullName(playerId, meta),
      pos,
      proTeam: meta?.team || row?.team || "",
      opponent,
      manager: owned?.manager ?? (status === "Waivers" ? "Waivers" : "FA"),
      status,
      rosterId: owned?.rosterId,
      ownerTeamName: owned?.ownerTeamName,
      ownerTeamAbbrev: owned?.ownerTeamAbbrev,
      ownerTeamLogo: owned?.ownerTeamLogo,
      ownerTeamPrimary: owned?.ownerTeamPrimary,
      ownerTeamSecondary: owned?.ownerTeamSecondary,
      matchup: opponent ? `@${opponent}` : "-",
      posRank: 999,
      projectionRank: 999,
      injuryStatus: meta?.injury_status || undefined,
      sleeperStatus: meta?.status,
      searchRank: meta?.search_rank,
      yearsExp: meta?.years_exp,
      age: meta?.age,
      depthChartOrder: meta?.depth_chart_order,
      addTrend: addTrend.get(playerId) ?? 0,
      dropTrend: dropTrend.get(playerId) ?? 0,
      rosterAdds: transactions.rosterAdds.get(playerId) ?? 0,
      rosterDrops: transactions.rosterDrops.get(playerId) ?? 0,
      waiverAdds: transactions.waiverAdds.get(playerId) ?? 0,
      fantasyAgainst: opponent ? fantasyAgainst.get(`${pos}:${opponent}`) : undefined,
      stats: blankStats(),
      projection: blankStats(),
      statsByPeriod,
      projectionsByPeriod,
      ...playerPhoto(playerId, pos),
    } satisfies FullStatsItem;
    byId.set(playerId, item);
    return item;
  };

  for (const row of allStatsRows) {
    const item = ensurePlayer(row.player_id, row.player, row);
    if (!item) continue;
    for (const key of periodKeysForWeek(row.week)) {
      addStats(statsForPeriod(item.statsByPeriod, key), row.stats, "actual");
    }
  }

  for (const row of weeklyProjections.flatMap((week) => week ?? [])) {
    const item = ensurePlayer(row.player_id, row.player, row);
    if (!item) continue;
    for (const key of periodKeysForWeek(row.week)) {
      addStats(statsForPeriod(item.projectionsByPeriod, key), row.stats, "projection");
    }
  }

  for (const [playerId, meta] of Object.entries(playerCatalog ?? {})) {
    ensurePlayer(playerId, meta);
  }

  const players = [...byId.values()];
  for (const player of players) {
    player.stats = player.statsByPeriod[SEASON_KEY] ?? blankStats();
    player.projection = player.projectionsByPeriod[SEASON_KEY] ?? blankStats();
  }

  const rankBy = (selector: (player: FullStatsItem) => number, field: "posRank" | "projectionRank") => {
    const byPos = new Map<string, FullStatsItem[]>();
    for (const player of players) {
      const bucket = byPos.get(player.pos) ?? [];
      bucket.push(player);
      byPos.set(player.pos, bucket);
    }
    for (const bucket of byPos.values()) {
      bucket
        .sort((a, b) => selector(b) - selector(a) || a.displayName.localeCompare(b.displayName))
        .forEach((player, index) => {
          player[field] = index + 1;
        });
    }
  };

  rankBy((player) => player.stats.points, "posRank");
  rankBy((player) => player.projection.projected, "projectionRank");

  players.sort((a, b) => b.stats.points - a.stats.points || b.projection.projected - a.projection.projected || a.displayName.localeCompare(b.displayName));

  // Convert to the sparse wire format last, once ranks and sort order are settled.
  return players.map((player) => {
    const statsByPeriod = sparseMap(player.statsByPeriod);
    const projectionsByPeriod = sparseMap(player.projectionsByPeriod);
    return {
      ...player,
      statsByPeriod,
      projectionsByPeriod,
      stats: statsByPeriod[SEASON_KEY] ?? {},
      projection: projectionsByPeriod[SEASON_KEY] ?? {},
    };
  });
}

export async function getCurrentPlayerProfile(playerId: string): Promise<PlayerBrowserItem | null> {
  const players = await getPlayerBrowserItems();
  return players.find((player) => player.playerId === playerId) ?? null;
}
