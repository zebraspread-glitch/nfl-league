import Link from "next/link";
import { PageIntro } from "@/components/ui";
import { PlayerBrowser } from "../player-browser";
import { getPlayerBrowserItems, PLAYER_DATA_SEASON } from "../player-data";

export const revalidate = 300;

export const metadata = { title: "Player Search - MGL Fantasy" };

export default async function PlayerSearchPage() {
  const players = await getPlayerBrowserItems();

  return (
    <div>
      <PageIntro title="Player Search" subtitle={`${players.length} player profiles with filters and pagination`} />
      <div className="mb-3 px-1">
        <Link href="/players" className="font-cond text-sm font-semibold text-teal">
          &lt; Player records
        </Link>
      </div>
      <PlayerBrowser players={players} mode="search" season={PLAYER_DATA_SEASON} />
    </div>
  );
}
