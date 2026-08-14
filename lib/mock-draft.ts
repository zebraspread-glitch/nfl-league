import { TEAMS } from "./teams";
import { FANTASYPROS_ECR_2026 } from "./fantasypros-ecr";
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
    { name: "Travis Etienne Jr.", pos: "RB", proTeam: "NO", bye: 8 },
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
    { name: "Mike Evans", pos: "WR", proTeam: "SF", bye: 8 },
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
    { name: "Kenneth Walker III", pos: "RB", proTeam: "KC", bye: 5 },
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
    // Position first, so a shared name resolves to our man rather than to
    // whoever the bare name happens to rank highest (getPlayerNameToIdMap).
    const name = normalizeName(p.name);
    const id = nameToId.get(`${name}|${p.pos}`) ?? nameToId.get(name);
    return id ? { ...p, sleeperId: id } : p;
  });
}

export function attachSleeperIdsToBoard(board: DraftSlot[], nameToId: Map<string, string>): DraftSlot[] {
  return board.map((s) => (s.locked ? { ...s, locked: attachSleeperIds([s.locked], nameToId)[0] } : s));
}

// Player pool: the full FantasyPros 2026 PPR consensus board — all 517 ranked
// players (lib/fantasypros-ecr.ts), so every non-keeper on their cheat sheet is
// draftable. `rank` is their literal overall ECR rank, so the pool is already in
// real ranking order.
const ADP_OVERRIDES: Record<string, number> = {
  // Consensus 1.01 in this league — the top rookie RB, and every veteran ranked
  // above him is already kept (rounds 12-15).
  "Jeremiyah Love": 1,
};

const RAW_PLAYERS: MockPlayer[] = FANTASYPROS_ECR_2026.map((p) => ({
  name: p.name,
  pos: p.pos,
  proTeam: p.proTeam,
  bye: p.bye,
  rank: p.rank,
  adp: ADP_OVERRIDES[p.name],
}));

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
