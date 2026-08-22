"use client";

import dynamic from "next/dynamic";
import type { LivePick, TradePlayer } from "@/lib/draft-clock";
import type { DraftClockMode } from "@/components/draft-clock";

const DraftClock = dynamic(
  () => import("@/components/draft-clock").then((mod) => mod.DraftClock),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02040a] text-white">
        <div className="font-cond text-3xl font-extrabold uppercase tracking-widest text-white/45">
          Loading draft clock
        </div>
      </div>
    ),
  }
);

export function DraftClockClient({
  picks,
  players,
  mode,
}: {
  picks: LivePick[];
  players?: TradePlayer[];
  /** "display" is the TV feed: no controls, follows the control window. */
  mode?: DraftClockMode;
}) {
  return <DraftClock picks={picks} players={players} mode={mode} />;
}
