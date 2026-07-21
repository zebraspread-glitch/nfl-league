import Link from "next/link";
import { getMatchups, getSnapshot } from "@/lib/sleeper";
import { getTeam, TEAMS } from "@/lib/teams";
import { MatchupCard } from "@/components/matchup-card";
import { Card, EmptyState, TeamAvatar } from "@/components/ui";
import type { Matchup, TeamMeta } from "@/lib/types";

export const revalidate = 120;

const TOTAL_WEEKS = 14;
const AVAILABLE_WEEKS = [1, 14];
const FIXTURE_WEEKS = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);
const PRIMETIME_MATCHUP_ID = "1-primetime";

export default async function MatchupsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; fixture?: string; team?: string }>;
}) {
  const snapshot = getSnapshot();
  const { week: weekParam, fixture: fixtureParam, team: legacyTeamParam } = await searchParams;
  const requestedWeek = Math.min(Math.max(Number(weekParam) || snapshot.currentWeek, 1), TOTAL_WEEKS);
  const week = AVAILABLE_WEEKS.includes(requestedWeek) ? requestedWeek : AVAILABLE_WEEKS[0];
  const selectedFixtureTeam = getTeam(Number(fixtureParam ?? legacyTeamParam));

  const [matchups, fixture] = await Promise.all([
    getMatchups(week),
    selectedFixtureTeam ? getTeamFixture(selectedFixtureTeam.id) : Promise.resolve([]),
  ]);

  return (
    <div>
      <div className="mb-3 flex gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {AVAILABLE_WEEKS.map((w) => (
          <Link
            key={w}
            href={matchupsHref(w, selectedFixtureTeam)}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg font-cond text-base font-semibold transition-colors ${
              w === week ? "bg-teal text-white" : "bg-card text-text-muted hover:bg-card-hover"
            }`}
          >
            {w}
          </Link>
        ))}
      </div>

      <FixturePicker selectedTeam={selectedFixtureTeam} week={week} />

      {selectedFixtureTeam ? (
        <TeamFixture team={selectedFixtureTeam} fixture={fixture} />
      ) : (
        <RoundFixture week={week} matchups={matchups} />
      )}
    </div>
  );
}

interface FixtureItem {
  week: number;
  matchup: Matchup;
}

function matchupsHref(week: number, selectedTeam?: TeamMeta): string {
  return selectedTeam ? `/matchups?week=${week}&fixture=${selectedTeam.id}` : `/matchups?week=${week}`;
}

async function getTeamFixture(teamId: number): Promise<FixtureItem[]> {
  const entries = await Promise.all(FIXTURE_WEEKS.map(async (week) => [week, await getMatchups(week)] as const));
  return entries
    .map(([week, matchups]) => {
      const matchup = matchups.find((m) => m.away.team.id === teamId || m.home.team.id === teamId);
      return matchup ? { week, matchup } : null;
    })
    .filter((item): item is FixtureItem => item !== null);
}

function FixturePicker({
  selectedTeam,
  week,
}: {
  selectedTeam?: TeamMeta;
  week: number;
}) {
  return (
    <Card className="mb-3">
      <details open={Boolean(selectedTeam)} className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 font-cond text-sm font-bold uppercase tracking-wide text-text">
          <span>{selectedTeam ? `${selectedTeam.name} Fixture` : "Team Fixture"}</span>
          <span className="rounded bg-section px-2 py-1 text-xs text-text-muted group-open:hidden">Select</span>
          <span className="hidden rounded bg-section px-2 py-1 text-xs text-text-muted group-open:inline">Close</span>
        </summary>

        <div className="border-t border-border p-3">
          <form method="GET" className="grid grid-cols-[1fr_auto] items-end gap-2">
            <input type="hidden" name="week" value={week} />
            <label className="min-w-0">
              <span className="mb-1 block font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Select team
              </span>
              <select
                name="fixture"
                defaultValue={selectedTeam?.id ?? ""}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm font-medium outline-none focus:border-teal"
              >
                <option value="">Choose a team</option>
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
              Show
            </button>
          </form>

          {selectedTeam ? (
            <>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                <div className="flex min-w-0 items-center gap-2">
                  <TeamAvatar team={selectedTeam} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate font-cond text-base font-semibold leading-tight">{selectedTeam.name}</div>
                    <div className="truncate text-xs text-text-muted">{selectedTeam.manager}</div>
                  </div>
                </div>
                <Link
                  href={`/matchups?week=${week}`}
                  className="shrink-0 rounded-lg border border-border px-3 py-2 font-cond text-xs font-bold uppercase tracking-wide text-text-muted hover:bg-card-hover"
                >
                  Clear
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </details>
    </Card>
  );
}

function RoundFixture({ week, matchups }: { week: number; matchups: Matchup[] }) {
  return (
    <div className="space-y-3">
      {matchups.length ? (
        matchups.map((m) => (
          <MatchupCard
            key={m.id}
            matchup={m}
            title={m.id === PRIMETIME_MATCHUP_ID ? "Primetime" : undefined}
          />
        ))
      ) : (
        <EmptyState>No 2026 matchup data is available for Week {week} yet.</EmptyState>
      )}
    </div>
  );
}

function TeamFixture({ team, fixture }: { team: TeamMeta; fixture: FixtureItem[] }) {
  if (!fixture.length) {
    return <EmptyState>No 2026 fixture data is available for {team.name} yet.</EmptyState>;
  }

  return (
    <div className="space-y-4">
      {fixture.map((item) => (
        <section key={item.matchup.id}>
          <div className="mb-2 px-1 font-cond text-sm font-semibold uppercase tracking-wide text-text-muted">
            Week {item.week}
          </div>
          <MatchupCard
            matchup={item.matchup}
            title={item.matchup.id === PRIMETIME_MATCHUP_ID ? "Primetime" : undefined}
          />
        </section>
      ))}
    </div>
  );
}
