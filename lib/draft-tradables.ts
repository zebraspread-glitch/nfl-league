import { AVAILABLE_PLAYERS, attachSleeperIds, buildDraftBoard } from "@/lib/mock-draft";
import { getPlayerNameToIdMap } from "@/lib/sleeper";
import type { TradePlayer } from "@/lib/draft-clock";

/**
 * Everyone who can be named in a trade: the draft pool plus every kept player.
 * Sleeper ids are attached here so the alert can show a real headshot.
 *
 * Shared by the control window and the TV window so both mount the clock with
 * an identical player list — a mismatch would show as a missing headshot on
 * one screen and not the other.
 */
export async function tradablePlayers(): Promise<TradePlayer[]> {
  const keepers = buildDraftBoard()
    .map((slot) => slot.locked)
    .filter((p) => p !== undefined);

  const nameToId = await getPlayerNameToIdMap();
  const withIds = attachSleeperIds([...AVAILABLE_PLAYERS, ...keepers], nameToId);

  const byName = new Map<string, TradePlayer>();
  for (const p of withIds) {
    if (!byName.has(p.name)) {
      byName.set(p.name, { name: p.name, sleeperId: p.sleeperId, pos: p.pos, proTeam: p.proTeam });
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
