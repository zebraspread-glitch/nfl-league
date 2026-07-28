import { SeasonPredictor } from "@/components/season-predictor";
import { PageIntro } from "@/components/ui";
import { TEAMS } from "@/lib/teams";
import { CURRENT_SEASON, getCurrentSeasonMatchups } from "@/lib/league-data";
import { REGULAR_SEASON_WEEKS } from "@/lib/predictor";

export const metadata = { title: "Season Predictor - MGL Fantasy" };

export default function PredictorPage() {
  const matchups = Array.from({ length: REGULAR_SEASON_WEEKS }, (_, i) => i + 1).flatMap((week) =>
    getCurrentSeasonMatchups(week),
  );

  return (
    <div>
      <PageIntro
        title="Season Predictor"
        subtitle={`Pick every ${CURRENT_SEASON} margin and play out the finals`}
      />
      <SeasonPredictor matchups={matchups} teams={TEAMS} />
    </div>
  );
}
