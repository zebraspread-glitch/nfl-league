import Link from "next/link";
import { getMatchups, getSnapshot } from "@/lib/sleeper";
import { getTeam, TEAMS } from "@/lib/teams";
import { MatchupCard } from "@/components/matchup-card";
import { Card, EmptyState, Pill, TeamAvatar } from "@/components/ui";
import type { Matchup, MatchupSide, TeamMeta } from "@/lib/types";

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
  const selectedTeam = getTeam(Number(teamParam)) ?? TEAMS[0];

  const matchupEntries = await Promise.all(
    AVAILABLE_WEEKS.map(async (w) => [w, await getMatchups(w)] as const),
  );
  const matchupsByWeek = new Map(matchupEntries);
  const matchups = matchupsByWeek.get(week) ?? [];
  const teamSchedule = buildTeamSchedule(selectedTeam.id, matchupsByWeek);

  return (
    <div>
      <div className="mb-3 flex gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {AVAILABLE_WEEKS.map((w) => (
          <Link
            key={w}
            href={`/matchups?week=${w}&team=${selectedTeam.id}`}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg font-cond text-base font-semibold transition-colors ${
              w === week ? "bg-teal text-white" : "bg-card text-text-muted hover:bg-card-hover"
            }`}
          >
            {w}
          </Link>
        ))}
      </div>

      <TeamSchedulePanel selectedTeam={selectedTeam} selectedWeek={week} schedule={teamSchedule} />

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
    </div>
  );
}

interface TeamScheduleItem {
  week: number;
  matchup?: Matchup;
  self?: MatchupSide;
  opponent?: MatchupSide;
  homeAway?: "vs" | "@";
}

function buildTeamSchedule(
  teamId: number,
  matchupsByWeek: Map<number, Matchup[]>,
): TeamScheduleItem[] {
  return AVAILABLE_WEEKS.map((week) => {
    const matchup = (matchupsByWeek.get(week) ?? []).find(
      (m) => m.away.team.id === teamId || m.home.team.id === teamId,
    );

    if (!matchup) return { week };

    const isAway = matchup.away.team.id === teamId;
    return {
      week,
      matchup,
      self: isAway ? matchup.away : matchup.home,
      opponent: isAway ? matchup.home : matchup.away,
      homeAway: isAway ? "@" : "vs",
    };
  });
}

function TeamSchedulePanel({
  selectedTeam,
  selectedWeek,
  schedule,
}: {
  selectedTeam: TeamMeta;
  selectedWeek: number;
  schedule: TeamScheduleItem[];
}) {
  return (
    <Card className="mb-3 p-3">
      <form method="GET" className="grid grid-cols-[1fr_auto] items-end gap-2">
        <input type="hidden" name="week" value={selectedWeek} />
        <label className="min-w-0">
          <span className="mb-1 block font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Team schedule
          </span>
          <select
            name="team"
            defaultValue={selectedTeam.id}
            className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm font-medium outline-none focus:border-teal"
          >
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

      <Link
        href={`/teams/${selectedTeam.id}`}
        className="mt-3 flex items-center gap-2 border-t border-border pt-3 hover:text-teal"
      >
        <TeamAvatar team={selectedTeam} size="sm" />
        <div className="min-w-0">
          <div className="truncate font-cond text-base font-semibold leading-tight">{selectedTeam.name}</div>
          <div className="truncate text-xs text-text-muted">{selectedTeam.manager}</div>
        </div>
      </Link>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {schedule.map((item) => (
          <ScheduleTile key={item.week} item={item} active={item.week === selectedWeek} />
        ))}
      </div>
    </Card>
  );
}

function ScheduleTile({ item, active }: { item: TeamScheduleItem; active: boolean }) {
  const baseClass = `flex min-h-14 items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
    active ? "border-teal bg-teal/10" : "border-border bg-row"
  }`;

  if (!item.matchup || !item.self || !item.opponent || !item.homeAway) {
    return (
      <div className={`${baseClass} opacity-65`}>
        <span className="w-8 shrink-0 text-center font-cond text-xs font-bold uppercase text-text-muted">
          W{item.week}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-muted">
          No matchup posted
        </span>
      </div>
    );
  }

  const { matchup, opponent, homeAway } = item;
  const className = `flex min-h-14 items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
    active ? "border-teal bg-teal/10" : "border-border bg-row"
  } hover:bg-card-hover`;

  const content = (
    <>
      <span className="w-8 shrink-0 text-center font-cond text-xs font-bold uppercase text-text-muted">
        W{item.week}
      </span>
      <TeamAvatar team={opponent.team} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {homeAway} {opponent.team.name}
        </span>
        <span className="block truncate text-[11px] text-text-muted">
          {opponent.team.manager}
        </span>
      </span>
      <ScheduleResult item={item} />
    </>
  );

  return (
    <Link href={`/matchups/${matchup.id}`} className={className}>
      {content}
    </Link>
  );
}

function ScheduleResult({ item }: { item: TeamScheduleItem }) {
  if (!item.matchup || !item.self || !item.opponent) return null;

  if (item.matchup.status === "upcoming") {
    return <Pill>Upcoming</Pill>;
  }

  if (item.matchup.status === "live") {
    return <Pill tone="live">Live</Pill>;
  }

  const result =
    item.self.score > item.opponent.score ? "W" : item.self.score < item.opponent.score ? "L" : "T";
  const tone = result === "W" ? "win" : result === "L" ? "loss" : "default";

  return (
    <span className="shrink-0 text-right">
      <Pill tone={tone}>{result}</Pill>
      <span className="mt-1 block font-cond text-xs font-semibold tabular-nums text-text-muted">
        {item.self.score.toFixed(1)}-{item.opponent.score.toFixed(1)}
      </span>
    </span>
  );
}
