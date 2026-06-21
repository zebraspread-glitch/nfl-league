import Link from "next/link";
import { resolvePlayerImage, POS_COLOR } from "@/lib/player-images";

/** Circular player headshot (or D/ST logo), falling back to a coloured
 *  position chip when no image is available. Fixed 32px to align in lists.
 *  Links through to the player's MGL profile page. */
export function PlayerBadge({
  playerId,
  pos,
  name,
}: {
  playerId: number;
  pos: string;
  name: string;
}) {
  const img = resolvePlayerImage(playerId, pos, name);

  if (img.imageUrl) {
    return (
      <Link href={`/players/${playerId}`} className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.imageUrl}
          alt={img.isLogo ? `${name} logo` : img.displayName}
          width={32}
          height={32}
          className={`h-8 w-8 shrink-0 rounded-full ${img.isLogo ? "bg-white object-contain p-0.5" : "bg-section object-cover"}`}
          suppressHydrationWarning
        />
      </Link>
    );
  }

  return (
    <Link
      href={`/players/${playerId}`}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full font-cond text-[10px] font-bold text-white"
      style={{ background: POS_COLOR[pos] ?? "#9aa1ad" }}
    >
      {pos || "-"}
    </Link>
  );
}
