"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** How far a finger must travel horizontally before it counts as a swipe. */
const SWIPE_MIN_PX = 60;
/** How much more horizontal than vertical the travel must be. Keeps a diagonal
 *  flick during a vertical scroll from navigating out from under the reader. */
const HORIZONTAL_BIAS = 1.5;

/**
 * Pager for the matchup page: swipe left/right to move through the rest of the
 * week's games, with tappable dots for pointer users.
 *
 * Navigation rather than a real carousel — each matchup pulls two full rosters,
 * so holding all six mounted to slide between them would mean six times the
 * fetching for five screens nobody may look at. The dots are <Link>s, so Next
 * prefetches the neighbouring games and the swipe lands on warm data.
 */
export function MatchupSwiper({ ids, currentId }: { ids: string[]; currentId: string }) {
  const router = useRouter();
  const index = ids.indexOf(currentId);

  useEffect(() => {
    if (index < 0 || ids.length < 2) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onStart = (event: TouchEvent) => {
      // Ignore pinch/multi-touch — that's a zoom, not a page turn.
      tracking = event.touches.length === 1;
      if (!tracking) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    };

    const onEnd = (event: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = event.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * HORIZONTAL_BIAS) return;

      // Swipe left moves forward, the way a paged carousel reads.
      const next = index + (dx < 0 ? 1 : -1);
      if (next < 0 || next >= ids.length) return;
      router.push(`/matchups/${ids[next]}`);
    };

    // Passive: this never calls preventDefault, so vertical scrolling stays smooth.
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [ids, index, router]);

  if (index < 0 || ids.length < 2) return null;

  return (
    <nav aria-label="Other matchups this week" className="mt-2 flex items-center justify-center gap-0.5">
      {ids.map((id, i) => {
        const active = i === index;
        return (
          <Link
            key={id}
            href={`/matchups/${id}`}
            aria-label={`Matchup ${i + 1} of ${ids.length}`}
            aria-current={active ? "page" : undefined}
            className="group grid h-7 w-7 place-items-center"
          >
            <span
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                active ? "bg-teal" : "bg-border group-hover:bg-border-strong"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
