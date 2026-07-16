import { PlayerBrowser } from "./player-browser";
import { getPlayerBrowserItems, PLAYER_DATA_SEASON } from "./player-data";

export const revalidate = 300;

export const metadata = { title: "Players - MGL Fantasy" };

export default async function PlayersPage() {
  const activePlayers = await getPlayerBrowserItems();

  return (
    <PlayerBrowser players={activePlayers} mode="search" season={PLAYER_DATA_SEASON} />
  );
}
