import type { DraftSlot, MockPlayer } from "./mock-draft";

export type Picks = Record<string, MockPlayer>;

export function draftPickKey(round: number, slot: number) {
  return `${round}-${slot}`;
}

export function lockedPlayerNames(board: DraftSlot[]) {
  const names = new Set<string>();
  for (const slot of board) if (slot.locked) names.add(slot.locked.name);
  return names;
}

export function normalizeUniquePicks(
  picks: Picks,
  board: DraftSlot[],
  draftableIndexByKey: Map<string, number>,
  preferredKey?: string
) {
  const lockedNames = lockedPlayerNames(board);
  const winnersByName = new Map<string, { pickKey: string; player: MockPlayer; index: number }>();
  let changed = false;

  for (const [pickKey, player] of Object.entries(picks)) {
    if (!draftableIndexByKey.has(pickKey) || lockedNames.has(player.name)) {
      changed = true;
      continue;
    }

    const index = draftableIndexByKey.get(pickKey) ?? Number.MAX_SAFE_INTEGER;
    const existing = winnersByName.get(player.name);
    if (!existing) {
      winnersByName.set(player.name, { pickKey, player, index });
      continue;
    }

    changed = true;
    if (pickKey === preferredKey || (existing.pickKey !== preferredKey && index < existing.index)) {
      winnersByName.set(player.name, { pickKey, player, index });
    }
  }

  if (!changed) return picks;

  const winningKeys = new Set([...winnersByName.values()].map((entry) => entry.pickKey));
  const next: Picks = {};
  for (const [pickKey, player] of Object.entries(picks)) {
    if (winningKeys.has(pickKey)) next[pickKey] = player;
  }
  return next;
}

export function setUniquePick(
  picks: Picks,
  board: DraftSlot[],
  draftableIndexByKey: Map<string, number>,
  targetKey: string,
  player: MockPlayer,
  { swapExisting = false } = {}
) {
  if (!draftableIndexByKey.has(targetKey) || lockedPlayerNames(board).has(player.name)) {
    return normalizeUniquePicks(picks, board, draftableIndexByKey, targetKey);
  }

  const targetPlayer = picks[targetKey];
  const sourceKey = Object.entries(picks).find(([pickKey, picked]) => pickKey !== targetKey && picked.name === player.name)?.[0];
  const next: Picks = { ...picks, [targetKey]: player };

  if (sourceKey) {
    if (swapExisting && targetPlayer && targetPlayer.name !== player.name && draftableIndexByKey.has(sourceKey)) {
      next[sourceKey] = targetPlayer;
    } else {
      delete next[sourceKey];
    }
  }

  return normalizeUniquePicks(next, board, draftableIndexByKey, targetKey);
}
