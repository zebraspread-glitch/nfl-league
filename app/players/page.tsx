import { PageIntro } from "@/components/ui";
import { PlayerBrowser } from "./player-browser";
import { getPlayerBrowserItems } from "./player-data";

export const revalidate = 86400;

export const metadata = { title: "Players - MGL Fantasy" };

export default async function PlayersPage() {
  const activePlayers = await getPlayerBrowserItems();

  return (
    <div>
      <PageIntro
        title="Players"
        subtitle={`${activePlayers.length} players - MGL career records from 2021-2025`}
      />
      <PlayerBrowser players={activePlayers} mode="records" />
      <p className="mt-3 px-1 text-xs text-text-muted">
        Player totals count MGL starts in regular season and championship-bracket playoff games. Bench rows remain available on profile game logs.
      </p>
    </div>
  );
}
