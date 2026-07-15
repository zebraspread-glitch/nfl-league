import { getAiPowerRankings, getPowerRankings } from "@/lib/power-rankings";
import { PageIntro } from "@/components/ui";
import PowerRankingsView from "@/components/power-rankings-view";

export const metadata = { title: "Power Rankings - MGL Fantasy" };

export default function PowerRankingsPage() {
  const tp = getPowerRankings();
  const ai = getAiPowerRankings();

  return (
    <div>
      <PageIntro title="Power Rankings" />
      <PowerRankingsView tp={tp} ai={ai} />
    </div>
  );
}
