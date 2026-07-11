"use client";

import { useState } from "react";
import { sleeperPlayerImage, POS_COLOR } from "@/lib/player-images";

const SIZES = {
  sm: { box: "h-8 w-8", text: "text-[10px]", px: 32 },
  md: { box: "h-10 w-10", text: "text-xs", px: 40 },
} as const;

/** Circular player headshot sourced from Sleeper's own CDN (keyed by Sleeper's
 *  player id, not our scraped NFL.com ids). Falls back to a coloured position
 *  chip if the image 404s — Sleeper doesn't have a headshot for every player. */
export function SleeperPlayerAvatar({
  sleeperId,
  pos,
  name,
  size = "sm",
}: {
  sleeperId: string;
  pos: string;
  name: string;
  size?: keyof typeof SIZES;
}) {
  const [failed, setFailed] = useState(false);
  const { url, isLogo } = sleeperPlayerImage(sleeperId);
  const s = SIZES[size];

  if (!failed && sleeperId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        width={s.px}
        height={s.px}
        onError={() => setFailed(true)}
        className={`${s.box} shrink-0 rounded-full ${isLogo ? "bg-white object-contain p-0.5" : "object-cover"}`}
        style={isLogo ? undefined : { background: "#b9bec6" }}
      />
    );
  }

  return (
    <span
      className={`grid ${s.box} shrink-0 place-items-center rounded-full font-cond ${s.text} font-bold text-white`}
      style={{ background: POS_COLOR[pos] ?? "#9aa1ad" }}
    >
      {pos || "-"}
    </span>
  );
}
