import { PlayerBrowser } from "./player-browser";
import { getPlayerBrowserItems } from "./player-data";

export const revalidate = 86400;

export const metadata = { title: "Players - MGL Fantasy" };

export default async function PlayersPage() {
  const activePlayers = await getPlayerBrowserItems();

  return (
    <PlayerBrowser players={activePlayers} mode="search" />
  );
}
