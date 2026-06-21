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
  started: boolean;
}

export interface Roster {
  team: TeamMeta;
  week: number;
  entries: RosterEntry[];
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
