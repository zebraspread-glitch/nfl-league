import Link from "next/link";
import { getMatchups, getSnapshot } from "@/lib/sleeper";
import { getTeam, TEAMS } from "@/lib/teams";
import { MatchupCard } from "@/components/matchup-card";
import { EmptyState } from "@/components/ui";
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
    <div className="relative z-10 mb-3 px-1">
      <details className="group relative inline-block">
        <summary className="flex h-9 cursor-pointer list-none items-center rounded-full border border-border bg-card px-3.5 font-cond text-sm font-bold text-text shadow-sm transition-colors hover:bg-card-hover">
          <span>{selectedTeam ? selectedTeam.name : "Team"}</span>
        </summary>

        <div className="absolute left-0 top-11 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          <Link
            href={`/matchups?week=${week}`}
            className={`block px-3 py-2 text-sm font-semibold hover:bg-card-hover ${
              selectedTeam ? "text-text-muted" : "bg-section text-text"
            }`}
          >
            Round fixture
          </Link>
          <div className="max-h-80 overflow-y-auto border-t border-border">
            {TEAMS.map((team) => (
              <Link
                key={team.id}
                href={`/matchups?week=${week}&fixture=${team.id}`}
                className={`block px-3 py-2 text-sm font-semibold hover:bg-card-hover ${
                  selectedTeam?.id === team.id ? "bg-teal/10 text-text" : "text-text-muted"
                }`}
              >
                {team.name}
              </Link>
            ))}
          </div>
        </div>
      </details>
    </div>
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
            matchup={orientMatchupForTeam(item.matchup, team.id)}
            title={item.matchup.id === PRIMETIME_MATCHUP_ID ? "Primetime" : undefined}
          />
        </section>
      ))}
    </div>
  );
}

function orientMatchupForTeam(matchup: Matchup, teamId: number): Matchup {
  if (matchup.away.team.id === teamId) return matchup;
  if (matchup.home.team.id !== teamId) return matchup;
  return {
    ...matchup,
    away: matchup.home,
    home: matchup.away,
  };
}
