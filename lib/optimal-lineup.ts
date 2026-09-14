// The best lineup a roster could have fielded, under the league's own slot
// rules. The betting lines are priced off this rather than the lineup a manager
// actually set, so points left on the bench don't move the market.

/** Which player positions may fill each Sleeper lineup slot. */
const SLOT_ELIGIBILITY: Record<string, string[]> = {
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  K: ["K"],
  DEF: ["DEF"],
  DL: ["DL"],
  LB: ["LB"],
  DB: ["DB"],
  IDP_FLEX: ["DL", "LB", "DB"],
  WRRB_FLEX: ["WR", "RB"],
  REC_FLEX: ["WR", "TE"],
  FLEX: ["WR", "RB", "TE"],
  SUPER_FLEX: ["QB", "WR", "RB", "TE"],
};

/** One rostered player considered for a starting slot. */
export interface LineupCandidate {
  id: string;
  /** Sleeper position, e.g. "WR". Anything unrecognised simply fills no slot. */
  position: string;
  projected: number;
}

/** Positions a slot accepts; an unknown slot only accepts its own name. */
function eligibleFor(slot: string): string[] {
  return SLOT_ELIGIBILITY[slot] ?? [slot];
}

/**
 * Highest projected total this roster could field across `startingSlots`.
 *
 * Filling slots is a bipartite matching between players and slots, so a plain
 * "best player per slot" sweep can misfire — handing a WR to the W/T flex when
 * the W/R flex needed it. Instead players are offered in descending projection
 * and placed via an augmenting path that may shuffle already-placed players
 * into other slots they qualify for. Taking the best available at each step is
 * optimal here because the placeable sets form a transversal matroid, where
 * greedy by weight is exact rather than approximate.
 */
export function optimalLineupTotal(candidates: LineupCandidate[], startingSlots: string[]): number {
  const slots = startingSlots.map(eligibleFor);
  if (!slots.length) return 0;

  // Zero-projection players can only ever add zero, so leave them out.
  const players = candidates.filter((c) => c.projected > 0).sort((a, b) => b.projected - a.projected);

  /** Index of the player currently holding each slot. */
  const heldBy: (number | null)[] = slots.map(() => null);

  const place = (playerIndex: number, tried: Set<number>): boolean => {
    for (let slot = 0; slot < slots.length; slot++) {
      if (tried.has(slot)) continue;
      if (!slots[slot].includes(players[playerIndex].position)) continue;
      tried.add(slot);
      const occupant = heldBy[slot];
      // Take the slot outright, or move its occupant somewhere else it fits.
      if (occupant === null || place(occupant, tried)) {
        heldBy[slot] = playerIndex;
        return true;
      }
    }
    return false;
  };

  let total = 0;
  players.forEach((player, index) => {
    if (place(index, new Set())) total += player.projected;
  });

  return Math.round(total * 100) / 100;
}
