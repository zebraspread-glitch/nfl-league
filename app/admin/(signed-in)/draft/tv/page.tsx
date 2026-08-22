import { DraftClockClient } from "@/components/draft-clock-client";
import { buildLiveDraftOrder } from "@/lib/draft-clock";
import { tradablePlayers } from "@/lib/draft-tradables";

export const metadata = {
  title: "Draft Clock (TV) - MGL Fantasy",
  robots: { index: false, follow: false },
};

/**
 * The feed the TV shows: the same clock with none of the operator's chrome.
 * It follows the control window at /admin/draft over a BroadcastChannel, so
 * this window is a mirror with no buttons of its own to press.
 */
export default async function DraftClockTvPage() {
  return <DraftClockClient picks={buildLiveDraftOrder()} players={await tradablePlayers()} mode="display" />;
}
