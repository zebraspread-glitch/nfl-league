"use client";

import { useEffect } from "react";
import { DraftClockClient } from "@/components/draft-clock-client";
import type { LivePick, TradePlayer } from "@/lib/draft-clock";

/**
 * The operator's own clock, drawn over the Sleeper draft room.
 *
 * Nothing here reads Sleeper — the draft is run by hand exactly as it is on the
 * TV window, just composited onto the board instead of sitting beside it. The
 * extension parks this frame in click-through mode so the board underneath
 * stays usable, and hands it the mouse and keyboard on Alt+C; Alt+C from in
 * here gives them back.
 */
export function DraftOverlayManual({
  picks,
  players,
  scale,
}: {
  picks: LivePick[];
  players?: TradePlayer[];
  scale: number;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!event.altKey) return;
      if (event.key !== "c" && event.key !== "C") return;
      event.preventDefault();
      // Only ever the word "release" — no draft state leaves this frame.
      window.parent?.postMessage({ source: "mgl-overlay", type: "release" }, "*");
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return <DraftClockClient picks={picks} players={players} overlayStyle overlayScale={scale} />;
}
