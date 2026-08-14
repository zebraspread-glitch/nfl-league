import { buildDraftBoard } from "./mock-draft";
import { getTeam } from "./teams";
import type { TeamId, TeamMeta } from "./types";

// Data for the live draft clock shown on the TV. The pick order comes straight
// from lib/mock-draft.ts's ROUND_ORDER, the real 2026 snake order including
// traded picks, so there is only one place to fix if the order changes.
//
// Rounds 12-15 are keeper slots, already filled in Sleeper, so they are never
// on the clock: the live draft is rounds 1-11, 12 picks each = 132 picks.

export const LAST_LIVE_ROUND = 11;

/** Seconds on the clock, per round. Round 1 is 4:30 as agreed. */
export const PICK_SECONDS_BY_ROUND: Record<number, number> = {
  1: 270,
};

/** Used for any round without an entry above. */
export const DEFAULT_PICK_SECONDS = 120;

export function pickSecondsForRound(round: number) {
  return PICK_SECONDS_BY_ROUND[round] ?? DEFAULT_PICK_SECONDS;
}

export interface LivePick {
  /** 1-based position across the whole draft, e.g. 13 = start of round 2. */
  overall: number;
  round: number;
  /** 1-based position within the round. */
  slot: number;
  team: TeamMeta;
  seconds: number;
}

/**
 * Live trades, as `{ [overall pick number]: new team id }`. The base order from
 * buildLiveDraftOrder stays immutable and this layers on top, so a trade is
 * always undoable and the stored form survives a refresh.
 */
export type PickOverrides = Record<number, TeamId>;

/** A player that can be named in a trade, with what's needed to show a headshot. */
export interface TradePlayer {
  name: string;
  /** Sleeper id, for the headshot CDN. Absent when the name isn't in Sleeper's catalog. */
  sleeperId?: string;
  pos: string;
  proTeam?: string;
}

/** What one team puts into a trade. Players are display-only — this app holds
 *  no roster state, so a traded player is announced, not moved. */
export interface TradeSide {
  teamId: TeamId;
  /** Overall pick numbers this team gives up. */
  picks: number[];
  /** Player names this team gives up. */
  players: string[];
}

export interface LiveTrade {
  /** Bumped per announcement so the reveal animation replays. */
  id: number;
  a: TradeSide;
  b: TradeSide;
}

/** Each side's picks change hands to the other team. */
export function overridesForTrade(trade: LiveTrade): PickOverrides {
  const next: PickOverrides = {};
  for (const overall of trade.a.picks) next[overall] = trade.b.teamId;
  for (const overall of trade.b.picks) next[overall] = trade.a.teamId;
  return next;
}

export function tradeIsEmpty(trade: LiveTrade) {
  return (
    trade.a.picks.length + trade.a.players.length + trade.b.picks.length + trade.b.players.length === 0
  );
}

export function applyPickOverrides(picks: LivePick[], overrides: PickOverrides): LivePick[] {
  if (Object.keys(overrides).length === 0) return picks;

  return picks.map((pick) => {
    const teamId = overrides[pick.overall];
    if (teamId === undefined || teamId === pick.team.id) return pick;
    const team = getTeam(teamId);
    return team ? { ...pick, team } : pick;
  });
}

/** The full running order, in the sequence picks actually happen. */
export function buildLiveDraftOrder(): LivePick[] {
  const picks: LivePick[] = [];

  for (const slot of buildDraftBoard()) {
    if (slot.round > LAST_LIVE_ROUND) continue;
    const team = getTeam(slot.teamId);
    if (!team) continue;

    picks.push({
      overall: picks.length + 1,
      round: slot.round,
      slot: slot.slot,
      team,
      seconds: pickSecondsForRound(slot.round),
    });
  }

  return picks;
}
