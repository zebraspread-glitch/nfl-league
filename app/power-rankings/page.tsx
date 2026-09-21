import { getPowerRankings } from "@/lib/power-rankings";
import { PageIntro } from "@/components/ui";
import PowerRankingsView from "@/components/power-rankings-view";

export const metadata = { title: "Power Rankings - MGL Fantasy" };

export default function PowerRankingsPage() {
  return (
    <div>
      <PageIntro title="Power Rankings" />
      <PowerRankingsView tp={getPowerRankings()} />
    </div>
  );
}
