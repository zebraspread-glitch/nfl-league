"use client";

import { useState } from "react";
import type { TradePlayer } from "@/lib/draft-clock";
import { POS_COLOR, sleeperPlayerImage } from "@/lib/player-images";

/**
 * Sleeper headshot with a coloured position chip as the fallback, mirroring
 * SleeperPlayerAvatar but sized by the caller in banner units rather than fixed
 * pixels, so it scales with the rest of the draft board.
 */
export function DraftPlayerFace({
  player,
  ink,
  size,
  chipFontSize,
}: {
  player: TradePlayer;
  /** Text colour for the fallback chip, matching the surface behind it. */
  ink: string;
  /** CSS length — both width and height. */
  size: string;
  /** CSS length for the position letters on the fallback chip. */
  chipFontSize: string;
}) {
  const [failed, setFailed] = useState(false);

  if (player.sleeperId && !failed) {
    const { url, isLogo } = sleeperPlayerImage(player.sleeperId);
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={player.name}
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full border border-black/20 ${isLogo ? "bg-white object-contain p-1" : "object-cover"}`}
        style={{ width: size, height: size, background: isLogo ? "#fff" : "rgba(0,0,0,0.15)" }}
      />
    );
  }

  return (
    <div
      className="grid shrink-0 place-items-center rounded-full font-cond font-bold"
      style={{
        width: size,
        height: size,
        background: POS_COLOR[player.pos] ?? "#9aa1ad",
        fontSize: chipFontSize,
        color: ink,
      }}
    >
      {player.pos}
    </div>
  );
}
