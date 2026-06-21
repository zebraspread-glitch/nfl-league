import { resolvePlayerImage } from "@/lib/player-images";
import { getPlayerSummaries } from "@/lib/players";
import type { PlayerBrowserItem } from "./player-browser";

export async function getPlayerBrowserItems(): Promise<PlayerBrowserItem[]> {
  const summaries = await getPlayerSummaries();
  const players: PlayerBrowserItem[] = summaries.map((player) => {
    const image = resolvePlayerImage(player.playerId, player.pos, player.name);
    return {
      ...player,
      displayName: image.displayName,
      imageUrl: image.imageUrl,
      isLogo: image.isLogo,
    };
  });

  return players.filter((player) => player.gamesPlayed > 0);
}
