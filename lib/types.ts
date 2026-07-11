// Shared, frontend-safe types. Nothing in here references ESPN cookies or
// secrets — these are the clean shapes returned by the data layer.

export type TeamId = number;

/** Static, hand-curated metadata for a franchise (colours, abbreviation). */
export interface TeamMeta {
  id: TeamId;
  /** Franchise / team display name. */
  name: string;
  /** Manager(s) behind the team. */
  manager: string;
  /** Short 2–4 char tag used on scoreboard tiles. */
  abbrev: string;
  /** Primary brand colour (hex). */
  primary: string;
  /** Secondary/accent colour (hex). */
  secondary: string;
  /**
   * Optional path to a logo image under /public, e.g. "/logos/dimmy.png".
   * When set, TeamBadge renders the image instead of the coloured initials.
   */
  logo?: string;
}

/** A row in the standings ladder. */
export interface Standing {
  team: TeamMeta;
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  pct: number;
  streak: string;
  pointsFor: number;
  pointsAgainst: number;
  /** Position change vs previous week (+up / -down). */
  change: number;
  /** Waiver / draft order position, when known. */
  waiver?: number;
}

/** One side of a matchup. */
export interface MatchupSide {
  team: TeamMeta;
  /** Points scored so far. */
  score: number;
  /** Projected total points. */
  projected?: number;
  record?: { wins: number; losses: number; ties: number };
  /** Sleeper roster_id backing this side, when sourced from the live API. */
  rosterId?: number;
}

export type MatchupStatus = "upcoming" | "live" | "final";

export interface Matchup {
  id: string;
  week: number;
  status: MatchupStatus;
  home: MatchupSide;
  away: MatchupSide;
}

/** A player slot on a roster. */
export interface RosterEntry {
  playerId: number;
  name: string;
  position: string;
  /** Lineup slot, e.g. "QB", "FLEX", "BE", "IR". */
  slot: string;
  proTeam?: string;
  points: number;
  projected?: number;
  /** Rank within position by projected points this week (for the rank badge). */
  posRank?: number;
  started: boolean;
  /** Raw Sleeper player id (numeric for players, team abbreviation for DEF), when sourced live. */
  sleeperId?: string;
  /** This week's NFL game from the player's perspective, e.g. "CLE @ NE" or "DEN vs DAL". */
  gameLabel?: string;
  /** Best-available kickoff display (game day/date — Sleeper's schedule has no exact time). */
  gameWhen?: string;
  /** True once the player's NFL game has kicked off (so we show actual points, not "—"). */
  gameStarted?: boolean;
  /** Sleeper's injury designation, e.g. "Questionable", "Out", "IR", when present. */
  injuryStatus?: string;
}

/** One slot in a roster's lineup — empty when no player is assigned. */
export interface RosterSlot {
  /** Display label, e.g. "QB", "RB", "W/R", "K", "DEF", "BN", "IR". */
  label: string;
  entry?: RosterEntry;
}

export interface Roster {
  team: TeamMeta;
  week: number;
  /** All rostered players (filled slots only), for any aggregate use. */
  entries: RosterEntry[];
  /** The 9 starting slots in lineup order (empty slots included). */
  starters: RosterSlot[];
  /** Bench slots (empty slots included). */
  bench: RosterSlot[];
  /** Injured-reserve slots (empty slots included). */
  ir: RosterSlot[];
}

/** One franchise's line in a past season's standings. */
export interface SeasonStanding {
  rank: number;
  /** The franchise's name *that season* (may differ from today). */
  name: string;
  /** Today's franchise this maps to, if resolvable. */
  team?: TeamMeta;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  streak: string;
  pointsFor: number;
  pointsAgainst: number;
}

/** Final result of a single past season. */
export interface SeasonResult {
  season: number;
  teamCount: number;
  champion: string;
  championTeam?: TeamMeta;
  runnerUp: string;
  regularSeasonLeader: string;
  highestPointsFor: { team: string; points: number };
  /** Final standings, top-to-bottom (rank 1 = champion). */
  finalStandings: SeasonStanding[];
}

/** All-time aggregate record for one franchise. */
export interface AllTimeRecord {
  team: TeamMeta;
  seasons: number;
  wins: number;
  losses: number;
  ties: number;
  pct: number;
  pointsFor: number;
  pointsAgainst: number;
  championships: number;
  titleYears: number[];
  runnerUps: number;
  /** Top-3 finishes. */
  podiums: number;
  bestFinish: number;
}

/** One season line for a single franchise (used on H2H / team pages). */
export interface FranchiseSeason {
  season: number;
  name: string;
  teamCount: number;
  finalRank: number;
  regularRank: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  champion: boolean;
}

/** High-level dashboard payload for the home page. */
export interface LeagueSnapshot {
  season: number;
  currentWeek: number;
  /** True when ESPN current-season credentials are configured. */
  live: boolean;
}
