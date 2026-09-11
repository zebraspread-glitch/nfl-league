import { cookies } from "next/headers";
import { Montserrat } from "next/font/google";
import { RecordPredictor, type ScheduleGame } from "@/components/record-predictor";
import { CURRENT_SEASON_FIXTURE_WEEKS, getCurrentSeasonMatchups } from "@/lib/league-data";
import { TEAMS, getTeam } from "@/lib/teams";

export const metadata = { title: "Schedule Predictor - MGL Fantasy" };

// The NFL app sets this screen in a heavy geometric sans; Montserrat ExtraBold
// is the closest Google face.
const montserrat = Montserrat({ subsets: ["latin"], weight: "800" });

export default async function SchedulePredictorPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  // ?team= when shared, otherwise the reader's own team from Settings.
  const { team } = await searchParams;
  const myTeam = (await cookies()).get("mgl_team")?.value;
  const initialTeamId = [team, myTeam].map(Number).find((id) => getTeam(id)) ?? TEAMS[0].id;

  const games: ScheduleGame[] = CURRENT_SEASON_FIXTURE_WEEKS.flatMap(getCurrentSeasonMatchups).map((m) => ({
    id: m.id,
    week: m.week,
    awayId: m.away.team.id,
    homeId: m.home.team.id,
  }));

  return (
    <div className={montserrat.className}>
      <RecordPredictor games={games} teams={TEAMS} initialTeamId={initialTeamId} />
    </div>
  );
}
