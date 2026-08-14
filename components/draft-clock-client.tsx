"use client";

import dynamic from "next/dynamic";
import type { LivePick, TradePlayer } from "@/lib/draft-clock";

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
}: {
  picks: LivePick[];
  players?: TradePlayer[];
}) {
  return <DraftClock picks={picks} players={players} />;
}
