"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchSleeperDraft,
  fetchSleeperPicks,
  lastLivePick,
  nextPickNo,
  playerNameOf,
  type SleeperPick,
} from "@/lib/sleeper-draft";
import { isDark } from "@/lib/draft-colors";
import type { LivePick, TradePlayer } from "@/lib/draft-clock";
import { INK, VOLT, type SyncSnapshot } from "@/components/draft-clock";

const DraftClock = dynamic(() => import("@/components/draft-clock").then((m) => m.DraftClock), {
  ssr: false,
});

/** Sleeper's own board refreshes about this often; matching it keeps the
 *  overlay and the room underneath from disagreeing for long. */
const POLL_MS = 2000;
/** How long a selection holds the screen before handing it back to the board. */
const REVEAL_MS = 8000;

function playerOf(pick: SleeperPick): TradePlayer {
  const meta = pick.metadata ?? {};
  return {
    name: playerNameOf(pick),
    sleeperId: pick.player_id ?? meta.player_id,
    pos: meta.position ?? "NFL",
    proTeam: meta.team,
  };
}

/**
 * Turns the live Sleeper draft into the board the clock already knows how to
 * draw. The draft room stays the source of truth for everything — who is up,
 * how long they have, and who they took — so there is nothing to operate.
 */
export function DraftOverlayClient({
  picks: board,
  scale = 0.62,
  reveal = true,
  draftId,
}: {
  picks: LivePick[];
  /** Banner size relative to the viewport, so it sits over the board rather
   *  than burying it. Tunable per screen with ?scale=. */
  scale?: number;
  /** ?reveal=0 keeps the board visible and skips the full-screen selection. */
  reveal?: boolean;
  draftId: string;
}) {
  const [picks, setPicks] = useState<SleeperPick[]>([]);
  const [pickTimerMs, setPickTimerMs] = useState(90_000);
  const [lastPicked, setLastPicked] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  /** Cleared once a selection has had its moment, so the board comes back. */
  const [revealed, setRevealed] = useState<SleeperPick | null>(null);
  const seen = useRef<number | null>(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const [draft, live] = await Promise.all([fetchSleeperDraft(draftId), fetchSleeperPicks(draftId)]);
      if (cancelled) return;

      if (draft) {
        setStarted(draft.status !== "pre_draft");
        setLastPicked(draft.last_picked);
        if (draft.settings?.pick_timer) setPickTimerMs(draft.settings.pick_timer * 1000);
      }
      if (!live) return;

      setPicks(live);

      // Only a selection that lands while we're watching earns the takeover —
      // otherwise opening the overlay mid-draft would replay an old pick.
      const latest = lastLivePick(live, board.length);
      if (firstLoad.current) {
        firstLoad.current = false;
        seen.current = latest?.pick_no ?? 0;
        return;
      }
      if (latest && latest.pick_no !== seen.current) {
        seen.current = latest.pick_no;
        if (reveal) setRevealed(latest);
      }
    }

    void poll();
    const id = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [board.length, draftId, reveal]);

  useEffect(() => {
    if (!revealed) return;
    const id = setTimeout(() => setRevealed(null), REVEAL_MS);
    return () => clearTimeout(id);
  }, [revealed]);

  const feed = useMemo<SyncSnapshot>(() => {
    const index = Math.min(nextPickNo(picks, board.length) - 1, board.length);

    /** Every live selection so far, so the ticker under the banner can roll
     *  through the picks that have already landed. */
    const picked: Record<number, string> = {};
    for (const pick of picks) {
      if (pick.is_keeper || !pick.player_id || pick.pick_no > board.length) continue;
      picked[pick.pick_no] = playerNameOf(pick);
    }

    const current = board[index];
    let announcement: SyncSnapshot["announcement"] = null;
    if (revealed) {
      const slot = board[revealed.pick_no - 1];
      if (slot) {
        const background = slot.team.primary || "#123049";
        announcement = {
          pick: slot,
          player: playerOf(revealed),
          background,
          accent: isDark(background) ? VOLT : INK,
        };
      }
    }

    return {
      // The clock counts from Sleeper's own last_picked, so the overlay agrees
      // with the timer in the room rather than running its own race.
      state: {
        index,
        phase: "clock",
        remainingMs: pickTimerMs,
        startedAt: started && lastPicked && current ? lastPicked : null,
      },
      overrides: {},
      picked,
      announcement,
      trade: null,
      tradeStage: 0,
    };
  }, [board, picks, pickTimerMs, lastPicked, started, revealed]);

  // Built from the picks themselves rather than the draft pool: the strip that
  // rolls through the picks so far looks players up by name, and Sleeper's own
  // spelling is the one guaranteed to match what it just sent us.
  const drafted = useMemo(
    () => picks.filter((p) => !p.is_keeper && p.player_id && p.pick_no <= board.length).map(playerOf),
    [picks, board.length]
  );

  return <DraftClock picks={board} players={drafted} mode="display" feed={feed} overlayStyle overlayScale={scale} />;
}
