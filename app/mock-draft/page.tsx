import { PageIntro } from "@/components/ui";
import { AVAILABLE_PLAYERS, attachSleeperIds, attachSleeperIdsToBoard, buildDraftBoard } from "@/lib/mock-draft";
import { getPlayerNameToIdMap } from "@/lib/sleeper";
import { MockDraftBoard } from "@/components/mock-draft-board";
import { TEAMS } from "@/lib/teams";

export const metadata = { title: "Mock Draft - MGL Fantasy" };

export default async function MockDraftPage() {
  const nameToId = await getPlayerNameToIdMap();
  const board = attachSleeperIdsToBoard(buildDraftBoard(), nameToId);
  const players = attachSleeperIds(AVAILABLE_PLAYERS, nameToId);

  return (
    <div>
      <PageIntro title="Mock Draft" subtitle="2026 draft board - rounds 1-11 are yours to draft, 12-15 are locked keepers" />
      <MockDraftBoard board={board} players={players} teams={TEAMS} />
    </div>
  );
}
