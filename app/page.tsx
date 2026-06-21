import { getMatchups, getStandings, getSnapshot } from "@/lib/espn";
import { MatchupCard } from "@/components/matchup-card";
import { EmptyState } from "@/components/ui";

export const revalidate = 120;

export default async function HomePage() {
  const snapshot = getSnapshot();
  const [matchups, standings] = await Promise.all([
    getMatchups(snapshot.currentWeek),
    getStandings(),
  ]);

  const rankMap = new Map(standings.map((s) => [s.team.id, s.rank]));
  const rankOf = (id: number) => rankMap.get(id);

  return (
    <div>
      <div className="px-1 pb-3 pt-1 font-cond text-sm uppercase tracking-widest text-text-muted">
        Mike Glennon League · {snapshot.season} · Week {snapshot.currentWeek}
      </div>

      <div className="space-y-3">
        {matchups.length ? (
          matchups.map((m, i) => (
            <MatchupCard key={m.id} matchup={m} title={`Matchup ${i + 1}`} rankOf={rankOf} />
          ))
        ) : (
          <EmptyState>No 2026 matchup data is available yet.</EmptyState>
        )}
      </div>
    </div>
  );
}
