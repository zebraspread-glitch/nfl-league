import { cookies } from "next/headers";
import { getStandings, getSnapshot } from "@/lib/sleeper";
import { playoffCutoffForSeason } from "@/lib/games";
import { StandingsTable } from "@/components/standings-table";
import { EmptyState, PageIntro } from "@/components/ui";

export const revalidate = 300;

export default async function StandingsPage() {
  const snapshot = getSnapshot();
  const standings = await getStandings();
  // Highlights the viewer's own team in the ladder, same as the My Team page.
  const myTeam = Number((await cookies()).get("mgl_team")?.value) || null;

  return (
    <div>
      <PageIntro title="Standings" subtitle={`${snapshot.season} regular season`} />
      {standings.length ? (
        <StandingsTable
          standings={standings}
          playoffCutoff={playoffCutoffForSeason(snapshot.season)}
          highlightTeamId={myTeam}
        />
      ) : (
        <EmptyState>No 2026 standings are available yet.</EmptyState>
      )}
    </div>
  );
}
