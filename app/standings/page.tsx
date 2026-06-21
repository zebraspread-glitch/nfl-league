import { getStandings, getSnapshot } from "@/lib/espn";
import { StandingsTable } from "@/components/standings-table";
import { EmptyState, PageIntro } from "@/components/ui";

export const revalidate = 300;

export default async function StandingsPage() {
  const snapshot = getSnapshot();
  const standings = await getStandings();

  return (
    <div>
      <PageIntro title="Standings" subtitle={`${snapshot.season} regular season`} />
      {standings.length ? (
        <StandingsTable standings={standings} />
      ) : (
        <EmptyState>No 2026 standings are available yet.</EmptyState>
      )}
    </div>
  );
}
