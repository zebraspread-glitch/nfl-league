import type { PlayerBrowserItem, PlayerStats } from "./player-browser";

const SLEEPER_API = "https://api.sleeper.app/v1";
const SLEEPER_DATA_API = "https://api.sleeper.com";
const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID || "1374614405412560896";
const DEFAULT_SEASON = 2025;
const WEEKS = Array.from({ length: 18 }, (_, index) => index + 1);
const POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

interface SleeperStatRow {
  player_id: string;
  week: number;
  team?: string;
  opponent?: string;
  stats?: Record<string, number>;
  player?: {
    first_name?: string;
    last_name?: string;
    full_name?: string;
    position?: string;
    team?: string;
    injury_status?: string | null;
  };
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

interface OwnedBy {
  status: "FA" | "Taken";
  manager: string;
}

function n(stats: Record<string, number> | undefined, key: string): number {
  return Number(stats?.[key] ?? 0);
}

function addStats(total: PlayerStats, row: Record<string, number> | undefined) {
  total.passYds += n(row, "pass_yd");
  total.passTD += n(row, "pass_td");
  total.passInt += n(row, "pass_int");
  total.passSack += n(row, "pass_sack");
  total.rushYds += n(row, "rush_yd");
  total.rushTD += n(row, "rush_td");
  total.rec += n(row, "rec");
  total.recYds += n(row, "rec_yd");
  total.recTD += n(row, "rec_td");
  total.retTD += n(row, "ret_td") + n(row, "kick_ret_td") + n(row, "punt_ret_td");
  total.fumTD += n(row, "fum_rec_td") + n(row, "def_fum_td") + n(row, "st_fum_rec_td");
  total.twoPt += n(row, "pass_2pt") + n(row, "rush_2pt") + n(row, "rec_2pt");
  total.fumLost += n(row, "fum_lost");
  total.points += n(row, "pts_ppr");
  total.gp += n(row, "gp");
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
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

async function getOwnership(): Promise<Map<string, OwnedBy>> {
  const [rosters, users] = await Promise.all([
    fetchJson<SleeperRoster[]>(`${SLEEPER_API}/league/${LEAGUE_ID}/rosters`),
    fetchJson<SleeperUser[]>(`${SLEEPER_API}/league/${LEAGUE_ID}/users`),
  ]);
  const userById = new Map((users ?? []).map((user) => [user.user_id, user]));
  const ownership = new Map<string, OwnedBy>();

  for (const roster of rosters ?? []) {
    const user = roster.owner_id ? userById.get(roster.owner_id) : undefined;
    const manager = ownerName(roster, user);
    const players = new Set([...(roster.players ?? []), ...(roster.starters ?? []), ...(roster.reserve ?? [])].filter(Boolean));
    for (const playerId of players) ownership.set(playerId, { status: "Taken", manager });
  }

  return ownership;
}

function blankStats(): PlayerStats {
  return {
    passYds: 0,
    passTD: 0,
    passInt: 0,
    passSack: 0,
    rushYds: 0,
    rushTD: 0,
    rec: 0,
    recYds: 0,
    recTD: 0,
    retTD: 0,
    fumTD: 0,
    twoPt: 0,
    fumLost: 0,
    points: 0,
    projected: 0,
    gp: 0,
  };
}

function displayName(row: SleeperStatRow): string {
  const first = row.player?.first_name ?? "";
  const last = row.player?.last_name ?? "";
  const full = row.player?.full_name || `${first} ${last}`.trim();
  if (!full) return row.player_id;
  if (!first || !last) return full;
  return `${first[0]}. ${last}`;
}

function playerPhoto(playerId: string, pos: string): { imageUrl: string; isLogo: boolean } {
  if (pos === "DEF" || /^[A-Z]{2,3}$/.test(playerId)) {
    return { imageUrl: `https://sleepercdn.com/images/team_logos/nfl/${playerId.toLowerCase()}.png`, isLogo: true };
  }
  return { imageUrl: `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`, isLogo: false };
}

export async function getPlayerBrowserItems(): Promise<PlayerBrowserItem[]> {
  const [ownership, weeklyStats, weeklyProjections] = await Promise.all([
    getOwnership(),
    Promise.all(WEEKS.map((week) =>
      fetchJson<SleeperStatRow[]>(`${SLEEPER_DATA_API}/stats/nfl/${DEFAULT_SEASON}/${week}?season_type=regular`),
    )),
    Promise.all(WEEKS.map((week) =>
      fetchJson<SleeperStatRow[]>(`${SLEEPER_DATA_API}/projections/nfl/${DEFAULT_SEASON}/${week}?season_type=regular`),
    )),
  ]);

  const byId = new Map<string, PlayerBrowserItem>();

  for (const row of weeklyStats.flatMap((week) => week ?? [])) {
    const pos = row.player?.position || "";
    if (!POSITIONS.has(pos)) continue;

    const owned = ownership.get(row.player_id);
    const current =
      byId.get(row.player_id) ??
      ({
        playerId: row.player_id,
        displayName: displayName(row),
        fullName: row.player?.full_name || [row.player?.first_name, row.player?.last_name].filter(Boolean).join(" "),
        pos,
        proTeam: row.player?.team || row.team || "",
        opponent: row.opponent || "",
        manager: owned?.manager ?? "FA",
        status: owned?.status ?? "FA",
        matchup: row.opponent ? `@${row.opponent}` : "-",
        posRank: 999,
        injuryStatus: row.player?.injury_status || undefined,
        ...playerPhoto(row.player_id, pos),
        stats: blankStats(),
      } satisfies PlayerBrowserItem);

    current.proTeam = row.player?.team || row.team || current.proTeam;
    current.opponent = row.opponent || current.opponent;
    current.matchup = current.opponent ? `@${current.opponent}` : "-";
    current.injuryStatus = row.player?.injury_status || current.injuryStatus;
    addStats(current.stats, row.stats);
    byId.set(row.player_id, current);
  }

  for (const row of weeklyProjections.flatMap((week) => week ?? [])) {
    const current = byId.get(row.player_id);
    if (!current) continue;
    current.stats.projected += n(row.stats, "pts_ppr");
  }

  const players = [...byId.values()].filter((player) => player.stats.points > 0 || player.stats.gp > 0);
  const byPos = new Map<string, PlayerBrowserItem[]>();
  for (const player of players) {
    const bucket = byPos.get(player.pos) ?? [];
    bucket.push(player);
    byPos.set(player.pos, bucket);
  }
  for (const bucket of byPos.values()) {
    bucket
      .sort((a, b) => b.stats.points - a.stats.points || a.displayName.localeCompare(b.displayName))
      .forEach((player, index) => {
        player.posRank = index + 1;
      });
  }

  return players.sort((a, b) => b.stats.points - a.stats.points || a.displayName.localeCompare(b.displayName));
}
