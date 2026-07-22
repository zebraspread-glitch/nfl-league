import { TEAMS } from "./teams";
import { UNDERDOG_BIG_BOARD } from "./underdog-big-board";
import type { TeamId } from "./types";

// Static data transcribed from the 2026 Sleeper draft setup: the snake order
// for rounds 1-11 (by team id, see lib/teams.ts), the round 12-15 keeper slots
// (locked — every team's keepers occupy a fixed late-round slot in Sleeper),
// and each team's positional needs. None of this is derivable from the live
// Sleeper API since the league hasn't drafted yet — it's manually maintained here.

export interface MockPlayer {
  name: string;
  pos: string;
  proTeam: string;
  bye?: number;
  /** Sleeper player id, attached at request time by matching name → Sleeper's catalog, used for the real headshot CDN. */
  sleeperId?: string;
  /** Approximate overall 2026 PPR redraft rank — lower is better. Drives autopick and search ordering. */
  rank?: number;
  /** League ADP override — where this league would actually draft the player when that
   *  differs sharply from FantasyPros (e.g. Jeremiyah Love is the consensus 1.01 here).
   *  Takes precedence over `rank` everywhere draft order matters. */
  adp?: number;
  /** Underdog projected fantasy points from the 2026 ADP big board. */
  projected?: number;
  /** Underdog positional ADP rank, e.g. RB12 or WR38. */
  underdogPositionRank?: string;
}

export interface DraftSlot {
  round: number;
  slot: number; // 1-indexed within the round
  teamId: TeamId;
  /** Set for picks that are real/locked (already happened, or a keeper slot) — not pickable in the mock. */
  locked?: MockPlayer;
}

const T = {
  dimmy: 1,
  thomo: 2,
  cronin: 3,
  ginnivan: 4,
  lavar: 5,
  monke: 6,
  tinkle: 7,
  dalts: 8,
  paho: 9,
  chichi: 10,
  brownlow: 11,
  lucky: 12,
} as const;

export const TEAM_NEEDS: Record<TeamId, string[]> = {
  [T.thomo]: ["QB", "WR", "TE"],
  [T.lucky]: ["QB", "TE"],
  [T.brownlow]: ["QB", "FLX"],
  [T.chichi]: ["QB"],
  [T.paho]: ["TE", "FLX"],
  [T.cronin]: ["RB", "TE", "FLX"],
  [T.dalts]: ["RB", "TE", "FLX"],
  [T.tinkle]: ["QB", "RB"],
  [T.dimmy]: ["QB", "RB"],
  [T.monke]: ["QB", "TE", "FLX"],
  [T.lavar]: ["QB", "TE", "FLX"],
  [T.ginnivan]: ["WR", "TE", "FLX"],
};

// Rounds 1-11 snake order, by team id. Round 1 has 12 slots but several teams
// own multiple (or zero) picks due to trades — see the league's Future Picks page.
const ROUND_ORDER: TeamId[][] = [
  [T.lucky, T.brownlow, T.chichi, T.paho, T.dimmy, T.tinkle, T.chichi, T.thomo, T.thomo, T.cronin, T.thomo, T.dimmy],
  [T.lucky, T.brownlow, T.chichi, T.paho, T.dalts, T.tinkle, T.dimmy, T.dalts, T.monke, T.cronin, T.thomo, T.dimmy],
  [T.tinkle, T.brownlow, T.dimmy, T.paho, T.monke, T.tinkle, T.monke, T.lavar, T.ginnivan, T.cronin, T.chichi, T.dimmy],
  [T.dimmy, T.brownlow, T.monke, T.paho, T.paho, T.tinkle, T.monke, T.dalts, T.monke, T.cronin, T.paho, T.dimmy],
  [T.dalts, T.cronin, T.chichi, T.paho, T.brownlow, T.tinkle, T.ginnivan, T.lavar, T.ginnivan, T.cronin, T.dalts, T.monke],
  [T.lucky, T.brownlow, T.chichi, T.thomo, T.dalts, T.tinkle, T.monke, T.lavar, T.monke, T.dalts, T.thomo, T.chichi],
  [T.tinkle, T.brownlow, T.brownlow, T.paho, T.dalts, T.tinkle, T.lucky, T.brownlow, T.ginnivan, T.cronin, T.thomo, T.dimmy],
  [T.lucky, T.brownlow, T.chichi, T.paho, T.dalts, T.lucky, T.ginnivan, T.thomo, T.ginnivan, T.cronin, T.thomo, T.dimmy],
  [T.lucky, T.brownlow, T.chichi, T.paho, T.dalts, T.tinkle, T.monke, T.lavar, T.ginnivan, T.cronin, T.cronin, T.lucky],
  [T.lucky, T.brownlow, T.chichi, T.cronin, T.dalts, T.tinkle, T.monke, T.lavar, T.ginnivan, T.cronin, T.thomo, T.dimmy],
  [T.lucky, T.brownlow, T.ginnivan, T.paho, T.lucky, T.tinkle, T.monke, T.lavar, T.ginnivan, T.lavar, T.cronin, T.dalts],
];

// Rounds 12-15 are keeper slots — fixed team order, fixed (already-rostered) player per slot.
// Names are spelled out in full (not "F. Last") so they match AVAILABLE_PLAYERS exactly and
// get excluded from the pool — nobody should be able to draft a player someone already kept.
const KEEPER_TEAM_ORDER: TeamId[] = [
  T.lucky, T.brownlow, T.chichi, T.paho, T.dalts, T.tinkle, T.monke, T.lavar, T.ginnivan, T.cronin, T.thomo, T.dimmy,
];

const KEEPER_ROUNDS: MockPlayer[][] = [
  // Round 12
  [
    { name: "Alec Pierce", pos: "WR", proTeam: "IND", bye: 13 },
    { name: "TreVeyon Henderson", pos: "RB", proTeam: "NE", bye: 11 },
    { name: "Bucky Irving", pos: "RB", proTeam: "TB", bye: 10 },
    { name: "Brian Thomas Jr.", pos: "WR", proTeam: "JAC", bye: 7 },
    { name: "Amon-Ra St. Brown", pos: "WR", proTeam: "DET", bye: 6 },
    { name: "Drake London", pos: "WR", proTeam: "ATL", bye: 11 },
    { name: "Jahmyr Gibbs", pos: "RB", proTeam: "DET", bye: 6 },
    { name: "Jaxon Smith-Njigba", pos: "WR", proTeam: "SEA", bye: 11 },
    { name: "Bijan Robinson", pos: "RB", proTeam: "ATL", bye: 11 },
    { name: "Jonathan Taylor", pos: "RB", proTeam: "IND", bye: 13 },
    { name: "Christian McCaffrey", pos: "RB", proTeam: "SF", bye: 8 },
    { name: "De'Von Achane", pos: "RB", proTeam: "MIA", bye: 6 },
  ],
  // Round 13
  [
    { name: "Cam Skattebo", pos: "RB", proTeam: "NYG", bye: 8 },
    { name: "DeVonta Smith", pos: "WR", proTeam: "PHI", bye: 10 },
    { name: "Chris Olave", pos: "WR", proTeam: "NO", bye: 8 },
    { name: "Travis Etienne Jr.", pos: "RB", proTeam: "JAC", bye: 8 },
    { name: "Malik Nabers", pos: "WR", proTeam: "NYG", bye: 8 },
    { name: "James Cook III", pos: "RB", proTeam: "BUF", bye: 7 },
    { name: "Ja'Marr Chase", pos: "WR", proTeam: "CIN", bye: 6 },
    { name: "Kyren Williams", pos: "RB", proTeam: "LAR", bye: 11 },
    { name: "Puka Nacua", pos: "WR", proTeam: "LAR", bye: 11 },
    { name: "Justin Jefferson", pos: "WR", proTeam: "MIN", bye: 6 },
    { name: "Nico Collins", pos: "WR", proTeam: "HOU", bye: 8 },
    { name: "Rashee Rice", pos: "WR", proTeam: "KC", bye: 5 },
  ],
  // Round 14
  [
    { name: "Mike Evans", pos: "WR", proTeam: "TB", bye: 8 },
    { name: "Colston Loveland", pos: "TE", proTeam: "CHI", bye: 10 },
    { name: "Brock Bowers", pos: "TE", proTeam: "LV", bye: 13 },
    { name: "Joe Burrow", pos: "QB", proTeam: "CIN", bye: 6 },
    { name: "Lamar Jackson", pos: "QB", proTeam: "BAL", bye: 13 },
    { name: "Tetairoa McMillan", pos: "WR", proTeam: "CAR", bye: 5 },
    { name: "CeeDee Lamb", pos: "WR", proTeam: "DAL", bye: 14 },
    { name: "Ladd McConkey", pos: "WR", proTeam: "LAC", bye: 7 },
    { name: "Josh Allen", pos: "QB", proTeam: "BUF", bye: 7 },
    { name: "Jalen Hurts", pos: "QB", proTeam: "PHI", bye: 10 },
    { name: "Ashton Jeanty", pos: "RB", proTeam: "LV", bye: 13 },
    { name: "Trey McBride", pos: "TE", proTeam: "ARI", bye: 14 },
  ],
  // Round 15
  [
    { name: "Kenneth Walker III", pos: "RB", proTeam: "SEA", bye: 5 },
    { name: "Saquon Barkley", pos: "RB", proTeam: "PHI", bye: 10 },
    { name: "George Pickens", pos: "WR", proTeam: "DAL", bye: 14 },
    { name: "Josh Jacobs", pos: "RB", proTeam: "GB", bye: 11 },
    { name: "Chase Brown", pos: "RB", proTeam: "CIN", bye: 6 },
    { name: "A.J. Brown", pos: "WR", proTeam: "NE", bye: 11 },
    { name: "Derrick Henry", pos: "RB", proTeam: "BAL", bye: 13 },
    { name: "Quinshon Judkins", pos: "RB", proTeam: "CLE", bye: 11 },
    { name: "Breece Hall", pos: "RB", proTeam: "NYJ", bye: 13 },
    { name: "Marvin Harrison Jr.", pos: "WR", proTeam: "ARI", bye: 14 },
    { name: "Omarion Hampton", pos: "RB", proTeam: "LAC", bye: 7 },
    { name: "Emeka Egbuka", pos: "WR", proTeam: "TB", bye: 10 },
  ],
];

/** Full 15-round board: rounds 1-11 are the editable snake draft, rounds 12-15 are fixed keeper slots. */
export function buildDraftBoard(): DraftSlot[] {
  const board: DraftSlot[] = [];

  ROUND_ORDER.forEach((order, ri) => {
    const round = ri + 1;
    order.forEach((teamId, si) => {
      const slot = si + 1;
      board.push({ round, slot, teamId });
    });
  });

  KEEPER_ROUNDS.forEach((players, ri) => {
    const round = 12 + ri;
    KEEPER_TEAM_ORDER.forEach((teamId, si) => {
      board.push({ round, slot: si + 1, teamId, locked: withUnderdogData(players[si]) });
    });
  });

  return board;
}

export function teamById(id: TeamId) {
  return TEAMS.find((t) => t.id === id);
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/\s+(jr|sr|ii|iii|iv)\.?$/, "")
    .trim();
}

const UNDERDOG_NAME_ALIASES: Record<string, string> = {
  "kenneth gainwell": "kenny gainwell",
};

const UNDERDOG_BIG_BOARD_BY_NAME = new Map(UNDERDOG_BIG_BOARD.map((entry) => [normalizeName(entry.name), entry]));

function underdogEntryFor(player: MockPlayer) {
  const nameKey = normalizeName(player.name);
  return UNDERDOG_BIG_BOARD_BY_NAME.get(nameKey) ?? UNDERDOG_BIG_BOARD_BY_NAME.get(UNDERDOG_NAME_ALIASES[nameKey]);
}

function withUnderdogData<T extends MockPlayer>(player: T): T {
  const entry = underdogEntryFor(player);
  if (!entry) return player;
  return {
    ...player,
    adp: entry.adp ?? player.adp,
    projected: entry.projected,
    underdogPositionRank: entry.positionRank,
  };
}

/** Attaches a Sleeper player id (for the real headshot CDN) by matching name → Sleeper's
 *  catalog. Pure — the actual catalog lookup happens server-side in lib/sleeper.ts, since
 *  this file is imported by client components and can't pull in "server-only" code. */
export function attachSleeperIds<T extends MockPlayer>(players: T[], nameToId: Map<string, string>): T[] {
  return players.map((p) => {
    if (p.pos === "DEF") return { ...p, sleeperId: p.proTeam };
    const id = nameToId.get(normalizeName(p.name));
    return id ? { ...p, sleeperId: id } : p;
  });
}

export function attachSleeperIdsToBoard(board: DraftSlot[], nameToId: Map<string, string>): DraftSlot[] {
  return board.map((s) => (s.locked ? { ...s, locked: attachSleeperIds([s.locked], nameToId)[0] } : s));
}

// Player pool sourced from FantasyPros' 2026 PPR consensus cheat sheet
// (https://www.fantasypros.com/nfl/rankings/ppr-cheatsheets.php) — `rank` is
// their literal overall ECR rank, so the pool is already in real ranking
// order. Pasted by hand (the page renders client-side, so it can't be
// scraped); covers ranks 1-150 of skill players plus enough K/DEF depth for
// every draftable slot.
const RAW_PLAYERS: MockPlayer[] = [
  { name: "Ja'Marr Chase", pos: "WR", proTeam: "CIN", bye: 6, rank: 1 },
  { name: "Bijan Robinson", pos: "RB", proTeam: "ATL", bye: 11, rank: 2 },
  { name: "Puka Nacua", pos: "WR", proTeam: "LAR", bye: 11, rank: 3 },
  { name: "Jaxon Smith-Njigba", pos: "WR", proTeam: "SEA", bye: 11, rank: 4 },
  { name: "Jahmyr Gibbs", pos: "RB", proTeam: "DET", bye: 6, rank: 5 },
  { name: "Amon-Ra St. Brown", pos: "WR", proTeam: "DET", bye: 6, rank: 6 },
  { name: "Christian McCaffrey", pos: "RB", proTeam: "SF", bye: 8, rank: 7 },
  { name: "CeeDee Lamb", pos: "WR", proTeam: "DAL", bye: 14, rank: 8 },
  { name: "Justin Jefferson", pos: "WR", proTeam: "MIN", bye: 6, rank: 9 },
  { name: "Jonathan Taylor", pos: "RB", proTeam: "IND", bye: 13, rank: 10 },
  { name: "Drake London", pos: "WR", proTeam: "ATL", bye: 11, rank: 11 },
  { name: "Nico Collins", pos: "WR", proTeam: "HOU", bye: 8, rank: 12 },
  { name: "De'Von Achane", pos: "RB", proTeam: "MIA", bye: 6, rank: 13 },
  { name: "A.J. Brown", pos: "WR", proTeam: "NE", bye: 11, rank: 14 },
  { name: "Ashton Jeanty", pos: "RB", proTeam: "LV", bye: 13, rank: 15 },
  { name: "George Pickens", pos: "WR", proTeam: "DAL", bye: 14, rank: 16 },
  { name: "Trey McBride", pos: "TE", proTeam: "ARI", bye: 14, rank: 17 },
  { name: "Chris Olave", pos: "WR", proTeam: "NO", bye: 8, rank: 18 },
  { name: "James Cook III", pos: "RB", proTeam: "BUF", bye: 7, rank: 19 },
  { name: "Brock Bowers", pos: "TE", proTeam: "LV", bye: 13, rank: 20 },
  { name: "Chase Brown", pos: "RB", proTeam: "CIN", bye: 6, rank: 21 },
  { name: "Rashee Rice", pos: "WR", proTeam: "KC", bye: 5, rank: 22 },
  { name: "Josh Allen", pos: "QB", proTeam: "BUF", bye: 7, rank: 23 },
  { name: "Omarion Hampton", pos: "RB", proTeam: "LAC", bye: 7, rank: 24 },
  { name: "Malik Nabers", pos: "WR", proTeam: "NYG", bye: 8, rank: 25 },
  { name: "DeVonta Smith", pos: "WR", proTeam: "PHI", bye: 10, rank: 26 },
  { name: "Tetairoa McMillan", pos: "WR", proTeam: "CAR", bye: 5, rank: 27 },
  { name: "Saquon Barkley", pos: "RB", proTeam: "PHI", bye: 10, rank: 28 },
  { name: "Garrett Wilson", pos: "WR", proTeam: "NYJ", bye: 13, rank: 29 },
  { name: "Lamar Jackson", pos: "QB", proTeam: "BAL", bye: 13, rank: 30 },
  { name: "Kenneth Walker III", pos: "RB", proTeam: "KC", bye: 5, rank: 31 },
  { name: "Drake Maye", pos: "QB", proTeam: "NE", bye: 11, rank: 32 },
  { name: "Tee Higgins", pos: "WR", proTeam: "CIN", bye: 6, rank: 33 },
  { name: "Ladd McConkey", pos: "WR", proTeam: "LAC", bye: 7, rank: 34 },
  { name: "Zay Flowers", pos: "WR", proTeam: "BAL", bye: 13, rank: 35 },
  // adp 1: consensus 1.01 in this league — the top rookie RB, and every veteran
  // ranked above him is already kept (rounds 12-15).
  { name: "Jeremiyah Love", pos: "RB", proTeam: "ARI", bye: 14, rank: 36, adp: 1 },
  { name: "Colston Loveland", pos: "TE", proTeam: "CHI", bye: 10, rank: 37 },
  { name: "Jaylen Waddle", pos: "WR", proTeam: "DEN", bye: 10, rank: 38 },
  { name: "Derrick Henry", pos: "RB", proTeam: "BAL", bye: 13, rank: 39 },
  { name: "Breece Hall", pos: "RB", proTeam: "NYJ", bye: 13, rank: 40 },
  { name: "Terry McLaurin", pos: "WR", proTeam: "WAS", bye: 7, rank: 41 },
  { name: "Kyren Williams", pos: "RB", proTeam: "LAR", bye: 11, rank: 42 },
  { name: "Luther Burden III", pos: "WR", proTeam: "CHI", bye: 10, rank: 43 },
  { name: "Joe Burrow", pos: "QB", proTeam: "CIN", bye: 6, rank: 44 },
  { name: "Josh Jacobs", pos: "RB", proTeam: "GB", bye: 11, rank: 45 },
  { name: "Emeka Egbuka", pos: "WR", proTeam: "TB", bye: 10, rank: 46 },
  { name: "Travis Etienne Jr.", pos: "RB", proTeam: "NO", bye: 8, rank: 47 },
  { name: "Javonte Williams", pos: "RB", proTeam: "DAL", bye: 14, rank: 48 },
  { name: "Davante Adams", pos: "WR", proTeam: "LAR", bye: 11, rank: 49 },
  { name: "Mike Evans", pos: "WR", proTeam: "SF", bye: 8, rank: 50 },
  { name: "Jameson Williams", pos: "WR", proTeam: "DET", bye: 6, rank: 51 },
  { name: "DJ Moore", pos: "WR", proTeam: "BUF", bye: 7, rank: 52 },
  { name: "Tyler Warren", pos: "TE", proTeam: "IND", bye: 13, rank: 53 },
  { name: "Jayden Daniels", pos: "QB", proTeam: "WAS", bye: 7, rank: 54 },
  { name: "Christian Watson", pos: "WR", proTeam: "GB", bye: 11, rank: 55 },
  { name: "Cam Skattebo", pos: "RB", proTeam: "NYG", bye: 8, rank: 56 },
  { name: "Bucky Irving", pos: "RB", proTeam: "TB", bye: 10, rank: 57 },
  { name: "Jalen Hurts", pos: "QB", proTeam: "PHI", bye: 10, rank: 58 },
  { name: "Quinshon Judkins", pos: "RB", proTeam: "CLE", bye: 11, rank: 59 },
  { name: "Rome Odunze", pos: "WR", proTeam: "CHI", bye: 10, rank: 60 },
  { name: "TreVeyon Henderson", pos: "RB", proTeam: "NE", bye: 11, rank: 61 },
  { name: "Carnell Tate", pos: "WR", proTeam: "TEN", bye: 9, rank: 62 },
  { name: "D'Andre Swift", pos: "RB", proTeam: "CHI", bye: 10, rank: 63 },
  { name: "Jaylen Warren", pos: "RB", proTeam: "PIT", bye: 9, rank: 64 },
  { name: "Caleb Williams", pos: "QB", proTeam: "CHI", bye: 10, rank: 65 },
  { name: "David Montgomery", pos: "RB", proTeam: "HOU", bye: 8, rank: 66 },
  { name: "Marvin Harrison Jr.", pos: "WR", proTeam: "ARI", bye: 14, rank: 67 },
  { name: "Tucker Kraft", pos: "TE", proTeam: "GB", bye: 11, rank: 68 },
  { name: "Justin Herbert", pos: "QB", proTeam: "LAC", bye: 7, rank: 69 },
  { name: "Harold Fannin Jr.", pos: "TE", proTeam: "CLE", bye: 11, rank: 70 },
  { name: "Courtland Sutton", pos: "WR", proTeam: "DEN", bye: 10, rank: 71 },
  { name: "Alec Pierce", pos: "WR", proTeam: "IND", bye: 13, rank: 72 },
  { name: "DK Metcalf", pos: "WR", proTeam: "PIT", bye: 9, rank: 73 },
  { name: "Bhayshul Tuten", pos: "RB", proTeam: "JAC", bye: 7, rank: 74 },
  { name: "Trevor Lawrence", pos: "QB", proTeam: "JAC", bye: 7, rank: 75 },
  { name: "Chris Godwin Jr.", pos: "WR", proTeam: "TB", bye: 10, rank: 76 },
  { name: "RJ Harvey", pos: "RB", proTeam: "DEN", bye: 10, rank: 77 },
  { name: "Chuba Hubbard", pos: "RB", proTeam: "CAR", bye: 5, rank: 78 },
  { name: "Michael Wilson", pos: "WR", proTeam: "ARI", bye: 14, rank: 79 },
  { name: "Kyle Pitts Sr.", pos: "TE", proTeam: "ATL", bye: 11, rank: 80 },
  { name: "Jadarian Price", pos: "RB", proTeam: "SEA", bye: 11, rank: 81 },
  { name: "Jaxson Dart", pos: "QB", proTeam: "NYG", bye: 8, rank: 82 },
  { name: "Jordyn Tyson", pos: "WR", proTeam: "NO", bye: 8, rank: 83 },
  { name: "Rhamondre Stevenson", pos: "RB", proTeam: "NE", bye: 11, rank: 84 },
  { name: "Michael Pittman Jr.", pos: "WR", proTeam: "PIT", bye: 9, rank: 85 },
  { name: "Rico Dowdle", pos: "RB", proTeam: "PIT", bye: 9, rank: 86 },
  { name: "Wan'Dale Robinson", pos: "WR", proTeam: "TEN", bye: 9, rank: 87 },
  { name: "Tony Pollard", pos: "RB", proTeam: "TEN", bye: 9, rank: 88 },
  { name: "Dak Prescott", pos: "QB", proTeam: "DAL", bye: 14, rank: 89 },
  { name: "Sam LaPorta", pos: "TE", proTeam: "DET", bye: 6, rank: 90 },
  { name: "Jakobi Meyers", pos: "WR", proTeam: "JAC", bye: 7, rank: 91 },
  { name: "Brian Thomas Jr.", pos: "WR", proTeam: "JAC", bye: 7, rank: 92 },
  { name: "Makai Lemon", pos: "WR", proTeam: "PHI", bye: 10, rank: 93 },
  { name: "Brock Purdy", pos: "QB", proTeam: "SF", bye: 8, rank: 94 },
  { name: "Parker Washington", pos: "WR", proTeam: "JAC", bye: 7, rank: 95 },
  { name: "Kyle Monangai", pos: "RB", proTeam: "CHI", bye: 10, rank: 96 },
  { name: "Kenneth Gainwell", pos: "RB", proTeam: "TB", bye: 10, rank: 97 },
  { name: "Josh Downs", pos: "WR", proTeam: "IND", bye: 13, rank: 98 },
  { name: "Ricky Pearsall", pos: "WR", proTeam: "SF", bye: 8, rank: 99 },
  { name: "Patrick Mahomes II", pos: "QB", proTeam: "KC", bye: 5, rank: 100 },
  { name: "Travis Kelce", pos: "TE", proTeam: "KC", bye: 5, rank: 101 },
  { name: "Bo Nix", pos: "QB", proTeam: "DEN", bye: 10, rank: 102 },
  { name: "Aaron Jones Sr.", pos: "RB", proTeam: "MIN", bye: 6, rank: 103 },
  { name: "Matthew Stafford", pos: "QB", proTeam: "LAR", bye: 11, rank: 104 },
  { name: "Jake Ferguson", pos: "TE", proTeam: "DAL", bye: 14, rank: 105 },
  { name: "Jordan Addison", pos: "WR", proTeam: "MIN", bye: 6, rank: 106 },
  { name: "J.K. Dobbins", pos: "RB", proTeam: "DEN", bye: 10, rank: 107 },
  { name: "Dalton Kincaid", pos: "TE", proTeam: "BUF", bye: 7, rank: 108 },
  { name: "Jared Goff", pos: "QB", proTeam: "DET", bye: 6, rank: 109 },
  { name: "Blake Corum", pos: "RB", proTeam: "LAR", bye: 11, rank: 110 },
  { name: "Jayden Reed", pos: "WR", proTeam: "GB", bye: 11, rank: 111 },
  { name: "Kyler Murray", pos: "QB", proTeam: "MIN", bye: 6, rank: 112 },
  { name: "Quentin Johnston", pos: "WR", proTeam: "LAC", bye: 7, rank: 113 },
  { name: "Khalil Shakir", pos: "WR", proTeam: "BUF", bye: 7, rank: 114 },
  { name: "Rachaad White", pos: "RB", proTeam: "WAS", bye: 7, rank: 115 },
  { name: "Jordan Love", pos: "QB", proTeam: "GB", bye: 11, rank: 116 },
  { name: "Jayden Higgins", pos: "WR", proTeam: "HOU", bye: 8, rank: 117 },
  { name: "Dallas Goedert", pos: "TE", proTeam: "PHI", bye: 10, rank: 118 },
  { name: "George Kittle", pos: "TE", proTeam: "SF", bye: 8, rank: 119 },
  { name: "Baker Mayfield", pos: "QB", proTeam: "TB", bye: 10, rank: 120 },
  { name: "Tyler Shough", pos: "QB", proTeam: "NO", bye: 8, rank: 121 },
  { name: "Isaiah Likely", pos: "TE", proTeam: "NYG", bye: 8, rank: 122 },
  { name: "Jacory Croskey-Merritt", pos: "RB", proTeam: "WAS", bye: 7, rank: 123 },
  { name: "Xavier Worthy", pos: "WR", proTeam: "KC", bye: 5, rank: 124 },
  { name: "Tyrone Tracy Jr.", pos: "RB", proTeam: "NYG", bye: 8, rank: 125 },
  { name: "KC Concepcion", pos: "WR", proTeam: "CLE", bye: 11, rank: 126 },
  { name: "Romeo Doubs", pos: "WR", proTeam: "NE", bye: 11, rank: 127 },
  { name: "Malik Willis", pos: "QB", proTeam: "MIA", bye: 6, rank: 128 },
  { name: "Jordan Mason", pos: "RB", proTeam: "MIN", bye: 6, rank: 129 },
  { name: "Jalen Coker", pos: "WR", proTeam: "CAR", bye: 5, rank: 130 },
  { name: "Tyler Allgeier", pos: "RB", proTeam: "ARI", bye: 14, rank: 131 },
  { name: "Mark Andrews", pos: "TE", proTeam: "BAL", bye: 13, rank: 132 },
  { name: "Woody Marks", pos: "RB", proTeam: "HOU", bye: 8, rank: 133 },
  { name: "C.J. Stroud", pos: "QB", proTeam: "HOU", bye: 8, rank: 134 },
  { name: "Zach Charbonnet", pos: "RB", proTeam: "SEA", bye: 11, rank: 135 },
  { name: "Matthew Golden", pos: "WR", proTeam: "GB", bye: 11, rank: 136 },
  { name: "Sam Darnold", pos: "QB", proTeam: "SEA", bye: 11, rank: 137 },
  { name: "Tyjae Spears", pos: "RB", proTeam: "TEN", bye: 9, rank: 138 },
  { name: "Juwan Johnson", pos: "TE", proTeam: "NO", bye: 8, rank: 139 },
  { name: "Jonathon Brooks", pos: "RB", proTeam: "CAR", bye: 5, rank: 140 },
  { name: "Dylan Sampson", pos: "RB", proTeam: "CLE", bye: 11, rank: 141 },
  { name: "Alvin Kamara", pos: "RB", proTeam: "NO", bye: 8, rank: 142 },
  { name: "Brenton Strange", pos: "TE", proTeam: "JAC", bye: 7, rank: 143 },
  { name: "Chris Rodriguez Jr.", pos: "RB", proTeam: "JAC", bye: 7, rank: 144 },
  { name: "Oronde Gadsden II", pos: "TE", proTeam: "LAC", bye: 7, rank: 145 },
  { name: "Cam Ward", pos: "QB", proTeam: "TEN", bye: 9, rank: 146 },
  { name: "Isiah Pacheco", pos: "RB", proTeam: "DET", bye: 6, rank: 147 },
  { name: "Jerry Jeudy", pos: "WR", proTeam: "CLE", bye: 11, rank: 148 },
  { name: "Rashid Shaheed", pos: "WR", proTeam: "SEA", bye: 11, rank: 149 },
  { name: "Denzel Boston", pos: "WR", proTeam: "CLE", bye: 11, rank: 150 },

  // Kickers and defenses, ranks per the same FantasyPros sheet (most sit well past 150).
  { name: "Brandon Aubrey", pos: "K", proTeam: "DAL", bye: 14, rank: 192 },
  { name: "Cameron Dicker", pos: "K", proTeam: "LAC", bye: 7, rank: 202 },
  { name: "Ka'imi Fairbairn", pos: "K", proTeam: "HOU", bye: 8, rank: 203 },
  { name: "Jason Myers", pos: "K", proTeam: "SEA", bye: 11, rank: 206 },
  { name: "Cam Little", pos: "K", proTeam: "JAC", bye: 7, rank: 208 },
  { name: "Eddy Pineiro", pos: "K", proTeam: "SF", bye: 8, rank: 214 },
  { name: "Tyler Loop", pos: "K", proTeam: "BAL", bye: 13, rank: 216 },
  { name: "Evan McPherson", pos: "K", proTeam: "CIN", bye: 6, rank: 219 },
  { name: "Cairo Santos", pos: "K", proTeam: "CHI", bye: 10, rank: 221 },
  { name: "Andy Borregales", pos: "K", proTeam: "NE", bye: 11, rank: 224 },
  { name: "Chase McLaughlin", pos: "K", proTeam: "TB", bye: 10, rank: 233 },
  { name: "Jake Bates", pos: "K", proTeam: "DET", bye: 6, rank: 235 },
  { name: "Harrison Butker", pos: "K", proTeam: "KC", bye: 5, rank: 244 },
  { name: "Harrison Mevis", pos: "K", proTeam: "LAR", bye: 11, rank: 250 },
  { name: "Chris Boswell", pos: "K", proTeam: "PIT", bye: 9, rank: 255 },
  { name: "Wil Lutz", pos: "K", proTeam: "DEN", bye: 10, rank: 282 },
  { name: "Will Reichard", pos: "K", proTeam: "MIN", bye: 6, rank: 290 },
  { name: "Charlie Smyth", pos: "K", proTeam: "NO", bye: 8, rank: 300 },
  { name: "Houston Texans", pos: "DEF", proTeam: "HOU", bye: 8, rank: 164 },
  { name: "Denver Broncos", pos: "DEF", proTeam: "DEN", bye: 10, rank: 175 },
  { name: "Seattle Seahawks", pos: "DEF", proTeam: "SEA", bye: 11, rank: 179 },
  { name: "Los Angeles Rams", pos: "DEF", proTeam: "LAR", bye: 11, rank: 181 },
  { name: "Philadelphia Eagles", pos: "DEF", proTeam: "PHI", bye: 10, rank: 185 },
  { name: "New England Patriots", pos: "DEF", proTeam: "NE", bye: 11, rank: 193 },
  { name: "Pittsburgh Steelers", pos: "DEF", proTeam: "PIT", bye: 9, rank: 195 },
  { name: "Jacksonville Jaguars", pos: "DEF", proTeam: "JAC", bye: 7, rank: 196 },
  { name: "Minnesota Vikings", pos: "DEF", proTeam: "MIN", bye: 6, rank: 197 },
  { name: "Los Angeles Chargers", pos: "DEF", proTeam: "LAC", bye: 7, rank: 200 },
  { name: "Green Bay Packers", pos: "DEF", proTeam: "GB", bye: 11, rank: 210 },
  { name: "Kansas City Chiefs", pos: "DEF", proTeam: "KC", bye: 5, rank: 212 },
  { name: "Baltimore Ravens", pos: "DEF", proTeam: "BAL", bye: 13, rank: 217 },
  { name: "Cleveland Browns", pos: "DEF", proTeam: "CLE", bye: 11, rank: 220 },
  { name: "Detroit Lions", pos: "DEF", proTeam: "DET", bye: 6, rank: 228 },
  { name: "Buffalo Bills", pos: "DEF", proTeam: "BUF", bye: 7, rank: 238 },
  { name: "Atlanta Falcons", pos: "DEF", proTeam: "ATL", bye: 11, rank: 285 },
  { name: "San Francisco 49ers", pos: "DEF", proTeam: "SF", bye: 8, rank: 286 },
];

export const AVAILABLE_PLAYERS: MockPlayer[] = RAW_PLAYERS.map(withUnderdogData).sort(
  (a, b) => draftValue(a) - draftValue(b)
);

// ---------------------------------------------------------------------------
// Autopick — need- and roster-aware so mock results resemble a real draft.

/** Draft-order value: the league ADP override wins, then FantasyPros rank. Lower = earlier. */
export function draftValue(p: MockPlayer): number {
  return p.adp ?? p.rank ?? 999;
}

// Randomness mirrors real drafters occasionally reaching a few spots early —
// weights apply to the top of the candidate list after need adjustments.
const VARIANCE_WEIGHTS = [0.42, 0.22, 0.14, 0.09, 0.06, 0.04, 0.03];
// Candidates more than this many value spots behind the best option are never
// picked. Big tier gaps therefore make a pick deterministic (e.g. the 1.01).
const TIER_WIDTH = 18;
const SCORE_JITTER = 6;
// Value-spot boosts for matching a listed team need / plugging an empty starting slot.
const NEED_BONUS = 10;
const LINEUP_BONUS = 6;

const FIXED_AUTOPICK_PLAN = [
  ["Jeremiyah Love"],
  ["Carnell Tate"],
  ["Garrett Wilson"],
  ["Jordyn Tyson"],
  ["Jadarian Price", "Luther Burden III"],
  ["Drake Maye", "Javonte Williams"],
  ["Javonte Williams", "Tee Higgins"],
];

function weightedRandom<T>(candidates: T[], random: () => number): T | undefined {
  if (!candidates.length) return undefined;
  const r = random();
  let acc = 0;
  for (let i = 0; i < candidates.length; i++) {
    acc += VARIANCE_WEIGHTS[i];
    if (r <= acc) return candidates[i];
  }
  return candidates[0];
}

interface LineupHole {
  label: string;
  fits(pos: string): boolean;
}

/** Starting-lineup holes (QB, RB×2, WR×2, TE, RB/WR flex, K, DEF) the roster can't fill yet. */
function lineupHoles(roster: MockPlayer[]): LineupHole[] {
  const count = (pos: string) => roster.filter((p) => p.pos === pos).length;
  const rb = count("RB");
  const wr = count("WR");
  const holes: LineupHole[] = [];
  if (count("QB") < 1) holes.push({ label: "QB", fits: (pos) => pos === "QB" });
  for (let i = rb; i < 2; i++) holes.push({ label: "RB", fits: (pos) => pos === "RB" });
  for (let i = wr; i < 2; i++) holes.push({ label: "WR", fits: (pos) => pos === "WR" });
  if (count("TE") < 1) holes.push({ label: "TE", fits: (pos) => pos === "TE" });
  if (Math.max(0, rb - 2) + Math.max(0, wr - 2) < 1)
    holes.push({ label: "RB/WR", fits: (pos) => pos === "RB" || pos === "WR" });
  if (count("K") < 1) holes.push({ label: "K", fits: (pos) => pos === "K" });
  if (count("DEF") < 1) holes.push({ label: "DEF", fits: (pos) => pos === "DEF" });
  return holes;
}

/**
 * Realistic autopick for one slot: best available by league draft value, nudged
 * toward the team's listed needs and lineup holes, never doubling up on QB/TE
 * in a 1-QB league, and saving K/DEF for the team's final picks.
 */
export function computeAutopick({
  overallPick,
  teamId,
  available,
  roster,
  drafted,
  remainingPicks,
  random = Math.random,
}: {
  /** 1-indexed overall draft position within the mockable rounds. */
  overallPick?: number;
  teamId: TeamId;
  /** Undrafted players (any order). */
  available: MockPlayer[];
  /** Everything the team currently has: keepers plus mock picks. */
  roster: MockPlayer[];
  /** Just the mock picks — these consume entries from TEAM_NEEDS. */
  drafted: MockPlayer[];
  /** How many picks the team still has, counting this one. */
  remainingPicks: number;
  random?: () => number;
}): MockPlayer | undefined {
  if (!available.length) return undefined;
  const fixedPick = overallPick ? FIXED_AUTOPICK_PLAN[overallPick - 1] : undefined;
  const allowVariance = !overallPick || overallPick > FIXED_AUTOPICK_PLAN.length;
  if (fixedPick) {
    const lockedIn = fixedPick
      .map((name) => available.find((p) => p.name === name))
      .find((player): player is MockPlayer => Boolean(player));
    if (lockedIn) return lockedIn;
  }

  const pool = available.slice().sort((a, b) => draftValue(a) - draftValue(b));
  const holes = lineupHoles(roster);

  // Endgame: no picks to spare, so plug the empty starting slots — this is what
  // pushes K/DEF (and a forgotten QB or TE) into a team's final picks.
  if (remainingPicks <= holes.length) {
    const mustFill = allowVariance
      ? weightedRandom(
          pool.filter((p) => holes.some((h) => h.fits(p.pos))).slice(0, VARIANCE_WEIGHTS.length),
          random
        )
      : pool.find((p) => holes.some((h) => h.fits(p.pos)));
    if (mustFill) return mustFill;
  }

  // Preseason needs minus what this mock has already addressed.
  const needs = [...(TEAM_NEEDS[teamId] ?? [])];
  for (const p of drafted) {
    const exact = needs.indexOf(p.pos);
    if (exact !== -1) {
      needs.splice(exact, 1);
    } else if (p.pos === "RB" || p.pos === "WR") {
      const flex = needs.indexOf("FLX");
      if (flex !== -1) needs.splice(flex, 1);
    }
  }

  const hasQB = roster.some((p) => p.pos === "QB");
  const hasTE = roster.some((p) => p.pos === "TE");
  const scored = pool.slice(0, 36).map((p) => {
    let score = draftValue(p);
    if (p.pos === "K" || p.pos === "DEF") score += 500; // only drafted via the endgame branch above
    if (p.pos === "QB" && hasQB) score += 150; // 1-QB league — nobody drafts two
    if (p.pos === "TE" && hasTE) score += 80;
    if (needs.includes(p.pos) || (needs.includes("FLX") && (p.pos === "RB" || p.pos === "WR"))) score -= NEED_BONUS;
    if (holes.some((h) => h.fits(p.pos))) score -= LINEUP_BONUS;
    if (allowVariance) score += random() * SCORE_JITTER;
    return { player: p, score };
  });
  scored.sort((a, b) => a.score - b.score);

  const candidates = scored.filter((c, i) => i < VARIANCE_WEIGHTS.length && c.score - scored[0].score <= TIER_WIDTH);
  return weightedRandom(candidates, random)?.player;
}
