// Client-safe reader for the live Sleeper draft. Sleeper's draft endpoints are
// public and send `access-control-allow-origin: *`, so the overlay polls them
// straight from the browser — no server route, no credentials.

/** The Mike Glennon League 2026 draft room. */
export const MGL_DRAFT_ID = "1374643393300283392";

const SLEEPER_BASE = "https://api.sleeper.app/v1";

export interface SleeperPickMetadata {
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string;
  player_id?: string;
}

export interface SleeperPick {
  pick_no: number;
  round: number;
  draft_slot: number;
  player_id: string | null;
  picked_by: string;
  /** Keepers are seeded into the board before the draft starts, so they are
   *  already "made" at pick 1 and must never be treated as a live selection. */
  is_keeper: boolean | null;
  metadata: SleeperPickMetadata | null;
}

export interface SleeperDraft {
  status: string;
  /** ms since epoch of the last selection, and what the pick clock counts from. */
  last_picked: number | null;
  settings: { pick_timer?: number; rounds?: number; teams?: number } | null;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Offline, rate-limited, or Sleeper is down: the overlay holds its last
    // good board rather than blanking mid-draft.
    return null;
  }
}

export function fetchSleeperDraft(draftId: string) {
  return getJson<SleeperDraft>(`${SLEEPER_BASE}/draft/${draftId}`);
}

export function fetchSleeperPicks(draftId: string) {
  return getJson<SleeperPick[]>(`${SLEEPER_BASE}/draft/${draftId}/picks`);
}

/**
 * The pick the room is actually on.
 *
 * Not `picks.length + 1`: this league's 48 keepers are seeded across rounds
 * 10-15 before a ball is bowled, so counting would start the draft two thirds
 * of the way down the board. The live pick is the lowest number nobody holds.
 */
export function nextPickNo(picks: SleeperPick[], boardSize: number): number {
  const taken = new Set(picks.map((p) => p.pick_no));
  for (let no = 1; no <= boardSize; no += 1) {
    if (!taken.has(no)) return no;
  }
  return boardSize + 1;
}

/** The most recent live selection — keepers and empty slots excluded. */
export function lastLivePick(picks: SleeperPick[], boardSize: number): SleeperPick | undefined {
  let latest: SleeperPick | undefined;
  for (const pick of picks) {
    if (pick.is_keeper || !pick.player_id || pick.pick_no > boardSize) continue;
    if (!latest || pick.pick_no > latest.pick_no) latest = pick;
  }
  return latest;
}

export function playerNameOf(pick: SleeperPick): string {
  const meta = pick.metadata ?? {};
  return [meta.first_name, meta.last_name].filter(Boolean).join(" ").trim();
}
