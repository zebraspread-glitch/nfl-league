import { DraftClockClient } from "@/components/draft-clock-client";
import { buildLiveDraftOrder } from "@/lib/draft-clock";
import { tradablePlayers } from "@/lib/draft-tradables";

export const metadata = {
  title: "Draft Clock - MGL Fantasy",
  robots: { index: false, follow: false },
};

export default async function AdminDraftClockPage() {
  return <DraftClockClient picks={buildLiveDraftOrder()} players={await tradablePlayers()} />;
}
