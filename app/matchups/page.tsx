import Link from "next/link";
import { getMatchups, getSnapshot } from "@/lib/sleeper";
import { getTeam, TEAMS } from "@/lib/teams";
import { MatchupCard } from "@/components/matchup-card";
import { Card, EmptyState } from "@/components/ui";
import type { TeamMeta } from "@/lib/types";

export const revalidate = 120;

const TOTAL_WEEKS = 14;
const AVAILABLE_WEEKS = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);
const PRIMETIME_MATCHUP_ID = "1-primetime";

export default async function MatchupsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; team?: string }>;
}) {
  const snapshot = getSnapshot();
  const { week: weekParam, team: teamParam } = await searchParams;
  const week = Math.min(Math.max(Number(weekParam) || snapshot.currentWeek, 1), TOTAL_WEEKS);
  const selectedTeam = teamParam ? getTeam(Number(teamParam)) : undefined;

  const matchups = await getMatchups(week);
  const visibleMatchups = selectedTeam
    ? matchups.filter((m) => m.away.team.id === selectedTeam.id || m.home.team.id === selectedTeam.id)
    : matchups;

  return (
    <div>
      <div className="mb-3 flex gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {AVAILABLE_WEEKS.map((w) => (
          <Link
            key={w}
            href={matchupsHref(w, selectedTeam)}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg font-cond text-base font-semibold transition-colors ${
              w === week ? "bg-teal text-white" : "bg-card text-text-muted hover:bg-card-hover"
            }`}
          >
            {w}
          </Link>
        ))}
      </div>

      <TeamFilter selectedTeam={selectedTeam} week={week} />

      <div className="space-y-3">
        {visibleMatchups.length ? (
          visibleMatchups.map((m) => (
            <MatchupCard
              key={m.id}
              matchup={m}
              title={m.id === PRIMETIME_MATCHUP_ID ? "Primetime" : undefined}
            />
          ))
        ) : (
          <EmptyState>
            {selectedTeam
              ? `No 2026 matchup data is available for ${selectedTeam.name} in Week ${week} yet.`
              : `No 2026 matchup data is available for Week ${week} yet.`}
          </EmptyState>
        )}
      </div>
    </div>
  );
}

function matchupsHref(week: number, selectedTeam?: TeamMeta): string {
  return selectedTeam ? `/matchups?week=${week}&team=${selectedTeam.id}` : `/matchups?week=${week}`;
}

function TeamFilter({ selectedTeam, week }: { selectedTeam?: TeamMeta; week: number }) {
  return (
    <Card className="mb-3 p-3">
      <form method="GET" className="grid grid-cols-[1fr_auto] items-end gap-2">
        <input type="hidden" name="week" value={week} />
        <label className="min-w-0">
          <span className="mb-1 block font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Show matchups for
          </span>
          <select
            name="team"
            defaultValue={selectedTeam?.id ?? ""}
            className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm font-medium outline-none focus:border-teal"
          >
            <option value="">All teams</option>
            {TEAMS.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-10 rounded-lg bg-teal px-4 font-cond text-sm font-bold uppercase tracking-wide text-white hover:bg-teal-dark"
        >
          View
        </button>
      </form>
    </Card>
  );
}
