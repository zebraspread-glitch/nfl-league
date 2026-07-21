import Link from "next/link";
import { getMatchups, getSnapshot } from "@/lib/sleeper";
import { getTeam, getTeamByName, TEAMS } from "@/lib/teams";
import { HISTORY_SEASONS } from "@/lib/league-data";
import { getSeasonGames, weekLabel, type Game, type GameSide } from "@/lib/games";
import { MatchupCard } from "@/components/matchup-card";
import { EmptyState } from "@/components/ui";
import type { Matchup, TeamMeta } from "@/lib/types";

export const revalidate = 120;

const TOTAL_WEEKS = 14;
const CURRENT_AVAILABLE_WEEKS = [1, 14];
const FIXTURE_WEEKS = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);
const PRIMETIME_MATCHUP_ID = "1-primetime";

export default async function MatchupsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; week?: string; fixture?: string; team?: string }>;
}) {
  const snapshot = getSnapshot();
  const { season: seasonParam, week: weekParam, fixture: fixtureParam, team: legacyTeamParam } = await searchParams;
  const seasons = [...HISTORY_SEASONS, snapshot.season];
  const season = seasons.includes(Number(seasonParam)) ? Number(seasonParam) : snapshot.season;
  const isCurrentSeason = season === snapshot.season;
  const selectedFixtureTeam = getTeam(Number(fixtureParam ?? legacyTeamParam));

  const historicalGames = isCurrentSeason ? [] : await getSeasonGames(season);
  const availableWeeks = isCurrentSeason
    ? CURRENT_AVAILABLE_WEEKS
    : [...new Set(historicalGames.map((game) => game.week))].sort((a, b) => a - b);
  const requestedWeek = Math.min(Math.max(Number(weekParam) || snapshot.currentWeek, 1), Math.max(...availableWeeks, TOTAL_WEEKS));
  const week = availableWeeks.includes(requestedWeek) ? requestedWeek : availableWeeks[0] ?? 1;

  const [roundItems, fixture] = isCurrentSeason
    ? await Promise.all([
        getMatchups(week).then((matchups) => matchups.map(currentFixtureItem)),
        selectedFixtureTeam ? getCurrentTeamFixture(selectedFixtureTeam.id) : Promise.resolve([]),
      ])
    : [
        historicalGames.filter((game) => game.week === week).map(historicalFixtureItem),
        selectedFixtureTeam ? historicalTeamFixture(selectedFixtureTeam.id, historicalGames) : [],
      ];

  return (
    <div>
      <div className="mb-3 flex gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {availableWeeks.map((w) => (
          <Link
            key={w}
            href={matchupsHref({ season, week: w, selectedTeam: selectedFixtureTeam })}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg font-cond text-base font-semibold transition-colors ${
              w === week ? "bg-teal text-white" : "bg-card text-text-muted hover:bg-card-hover"
            }`}
          >
            {w}
          </Link>
        ))}
      </div>

      <div className="relative z-10 mb-3 flex gap-2 px-1">
        <SeasonPicker seasons={seasons} selectedSeason={season} week={week} selectedTeam={selectedFixtureTeam} />
        <FixturePicker selectedTeam={selectedFixtureTeam} season={season} week={week} />
      </div>

      {selectedFixtureTeam ? (
        <TeamFixture season={season} team={selectedFixtureTeam} fixture={fixture} />
      ) : (
        <RoundFixture season={season} week={week} fixture={roundItems} />
      )}
    </div>
  );
}

interface FixtureItem {
  week: number;
  matchup: Matchup;
  href: string;
}

function matchupsHref({
  season,
  week,
  selectedTeam,
}: {
  season: number;
  week?: number;
  selectedTeam?: TeamMeta;
}): string {
  const params = new URLSearchParams();
  params.set("season", String(season));
  if (week != null) params.set("week", String(week));
  if (selectedTeam) params.set("fixture", String(selectedTeam.id));
  return `/matchups?${params.toString()}`;
}

function currentFixtureItem(matchup: Matchup): FixtureItem {
  return { week: matchup.week, matchup, href: `/matchups/${matchup.id}` };
}

async function getCurrentTeamFixture(teamId: number): Promise<FixtureItem[]> {
  const entries = await Promise.all(FIXTURE_WEEKS.map(async (week) => [week, await getMatchups(week)] as const));
  return entries
    .map(([, matchups]) => {
      const matchup = matchups.find((m) => m.away.team.id === teamId || m.home.team.id === teamId);
      return matchup ? currentFixtureItem(matchup) : null;
    })
    .filter((item): item is FixtureItem => item !== null);
}

function historicalTeamFixture(teamId: number, games: Game[]): FixtureItem[] {
  return games
    .filter((game) => game.away.team?.id === teamId || game.home.team?.id === teamId)
    .sort((a, b) => a.week - b.week || a.id.localeCompare(b.id))
    .map(historicalFixtureItem);
}

function historicalFixtureItem(game: Game): FixtureItem {
  return {
    week: game.week,
    matchup: {
      id: game.id,
      week: game.week,
      status: "final",
      away: historicalSide(game.away),
      home: historicalSide(game.home),
    },
    href: `/games/${game.id}`,
  };
}

function historicalSide(side: GameSide): Matchup["away"] {
  return {
    team: side.team ?? getTeamByName(side.name, -side.teamId),
    score: side.total,
  };
}

function SeasonPicker({
  seasons,
  selectedSeason,
  week,
  selectedTeam,
}: {
  seasons: number[];
  selectedSeason: number;
  week: number;
  selectedTeam?: TeamMeta;
}) {
  return (
    <details className="group relative inline-block">
      <summary className="flex h-9 cursor-pointer list-none items-center rounded-full border border-border bg-card px-3.5 font-cond text-sm font-bold text-text shadow-sm transition-colors hover:bg-card-hover">
        <span>{selectedSeason}</span>
      </summary>

      <div className="absolute left-0 top-11 w-32 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        {[...seasons].reverse().map((season) => (
          <Link
            key={season}
            href={matchupsHref({ season, week, selectedTeam })}
            className={`block px-3 py-2 text-sm font-semibold hover:bg-card-hover ${
              selectedSeason === season ? "bg-teal/10 text-text" : "text-text-muted"
            }`}
          >
            {season}
          </Link>
        ))}
      </div>
    </details>
  );
}

function FixturePicker({
  selectedTeam,
  season,
  week,
}: {
  selectedTeam?: TeamMeta;
  season: number;
  week: number;
}) {
  return (
    <details className="group relative inline-block">
      <summary className="flex h-9 cursor-pointer list-none items-center rounded-full border border-border bg-card px-3.5 font-cond text-sm font-bold text-text shadow-sm transition-colors hover:bg-card-hover">
        <span>{selectedTeam ? selectedTeam.name : "Team"}</span>
      </summary>

      <div className="absolute left-0 top-11 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        <Link
          href={matchupsHref({ season, week })}
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
              href={matchupsHref({ season, week, selectedTeam: team })}
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
  );
}

function RoundFixture({ season, week, fixture }: { season: number; week: number; fixture: FixtureItem[] }) {
  return (
    <div className="space-y-3">
      {fixture.length ? (
        fixture.map((item) => (
          <MatchupCard
            key={item.matchup.id}
            matchup={item.matchup}
            href={item.href}
            title={item.matchup.id === PRIMETIME_MATCHUP_ID ? "Primetime" : undefined}
          />
        ))
      ) : (
        <EmptyState>No {season} matchup data is available for {weekLabel(week)} yet.</EmptyState>
      )}
    </div>
  );
}

function TeamFixture({ season, team, fixture }: { season: number; team: TeamMeta; fixture: FixtureItem[] }) {
  if (!fixture.length) {
    return <EmptyState>No {season} fixture data is available for {team.name} yet.</EmptyState>;
  }

  return (
    <div className="space-y-4">
      {fixture.map((item) => (
        <section key={item.matchup.id}>
          <div className="mb-2 px-1 font-cond text-sm font-semibold uppercase tracking-wide text-text-muted">
            {weekLabel(item.week)}
          </div>
          <MatchupCard
            matchup={orientMatchupForTeam(item.matchup, team.id)}
            href={item.href}
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
