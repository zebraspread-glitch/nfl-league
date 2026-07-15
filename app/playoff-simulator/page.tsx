import { PlayoffSimulator } from "@/components/playoff-simulator";
import { PageIntro } from "@/components/ui";
import { getAiPowerRankings } from "@/lib/power-rankings";
import { getMatchups, getSnapshot, getStandings } from "@/lib/sleeper";
import {
  buildSimulatorSchedule,
  buildSimulatorTeams,
  completedWeeksFromStandings,
  REGULAR_SEASON_WEEKS,
} from "@/lib/playoff-simulator";

export const revalidate = 300;

export const metadata = { title: "Playoff Simulator - MGL Fantasy" };

export default async function PlayoffSimulatorPage() {
  const snapshot = getSnapshot();
  const [standings, weekOneMatchups] = await Promise.all([getStandings(), getMatchups(1)]);
  const powerRankings = getAiPowerRankings();
  const completedWeeks = completedWeeksFromStandings(standings);
  const teams = buildSimulatorTeams(standings, powerRankings.entries);
  const schedule = buildSimulatorSchedule({
    knownMatchups: weekOneMatchups,
    teams,
    startWeek: completedWeeks + 1,
  });

  return (
    <div>
      <PageIntro
        title="Playoff Simulator"
        subtitle={`${snapshot.season} projection, Weeks ${Math.min(completedWeeks + 1, REGULAR_SEASON_WEEKS)}-${REGULAR_SEASON_WEEKS}`}
      />
      <PlayoffSimulator teams={teams} schedule={schedule} completedWeeks={completedWeeks} />
    </div>
  );
}
