import Link from "next/link";
import { getMatchups, getSnapshot } from "@/lib/sleeper";
import { MatchupCard } from "@/components/matchup-card";
import { EmptyState } from "@/components/ui";

export const revalidate = 120;

const TOTAL_WEEKS = 14;
const AVAILABLE_WEEKS = [1, 14];
const PRIMETIME_MATCHUP_ID = "1-primetime";

export default async function MatchupsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const snapshot = getSnapshot();
  const { week: weekParam } = await searchParams;
  const requestedWeek = Math.min(Math.max(Number(weekParam) || snapshot.currentWeek, 1), TOTAL_WEEKS);
  const week = AVAILABLE_WEEKS.includes(requestedWeek) ? requestedWeek : AVAILABLE_WEEKS[0];

  const matchups = await getMatchups(week);

  return (
    <div>
      <div className="mb-3 flex gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {AVAILABLE_WEEKS.map((w) => (
          <Link
            key={w}
            href={`/matchups?week=${w}`}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg font-cond text-base font-semibold transition-colors ${
              w === week ? "bg-teal text-white" : "bg-card text-text-muted hover:bg-card-hover"
            }`}
          >
            {w}
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        {matchups.length ? (
          matchups.map((m, i) => (
            <MatchupCard
              key={m.id}
              matchup={m}
              title={m.id === PRIMETIME_MATCHUP_ID ? "Primetime" : `Matchup ${i + 1}`}
            />
          ))
        ) : (
          <EmptyState>No 2026 matchup data is available for Week {week} yet.</EmptyState>
        )}
      </div>
    </div>
  );
}
