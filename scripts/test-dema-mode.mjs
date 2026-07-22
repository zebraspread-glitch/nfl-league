import assert from "node:assert/strict";
import { draftPickKey, normalizeUniquePicks, setUniquePick } from "../lib/mock-draft-state.ts";

const locked = { name: "Locked Star", pos: "RB", proTeam: "LCK" };
const alpha = { name: "Alpha Runner", pos: "RB", proTeam: "ALP" };
const beta = { name: "Beta Wideout", pos: "WR", proTeam: "BET" };
const gamma = { name: "Gamma Quarterback", pos: "QB", proTeam: "GAM" };

const board = [
  { round: 1, slot: 1, teamId: 1, locked },
  { round: 1, slot: 2, teamId: 2 },
  { round: 1, slot: 3, teamId: 3 },
  { round: 1, slot: 4, teamId: 4 },
];

const draftableIndexByKey = new Map(
  board.filter((slot) => !slot.locked).map((slot, index) => [draftPickKey(slot.round, slot.slot), index])
);

{
  const cleaned = normalizeUniquePicks(
    {
      "1-1": alpha,
      "1-2": locked,
      "1-3": beta,
    },
    board,
    draftableIndexByKey
  );

  assert.deepEqual(Object.keys(cleaned), ["1-3"], "locked slots and locked players are removed from saved picks");
  assert.equal(cleaned["1-3"].name, beta.name);
}

{
  const next = setUniquePick(
    {
      "1-2": alpha,
      "1-3": beta,
    },
    board,
    draftableIndexByKey,
    "1-2",
    beta,
    { swapExisting: true }
  );

  assert.equal(next["1-2"].name, beta.name, "selected player moves into the target slot");
  assert.equal(next["1-3"].name, alpha.name, "target player swaps into the selected player's old slot");
  assert.equal(new Set(Object.values(next).map((player) => player.name)).size, Object.values(next).length, "swap creates no duplicates");
}

{
  const next = setUniquePick({ "1-3": beta }, board, draftableIndexByKey, "1-2", beta, { swapExisting: true });

  assert.deepEqual(Object.keys(next), ["1-2"], "moving into an empty slot removes the old occurrence");
  assert.equal(next["1-2"].name, beta.name);
}

{
  const next = setUniquePick({ "1-2": alpha }, board, draftableIndexByKey, "1-3", locked, { swapExisting: true });

  assert.deepEqual(next, { "1-2": alpha }, "locked players cannot be written into draftable slots");
}

{
  const next = setUniquePick({ "1-2": alpha }, board, draftableIndexByKey, "1-1", gamma, { swapExisting: true });

  assert.deepEqual(next, { "1-2": alpha }, "locked/non-draftable slots cannot receive hidden picks");
}

console.log("Dema mode pick-state tests passed");
