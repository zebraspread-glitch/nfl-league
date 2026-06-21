import playerImages from "@/data/players/images.json";

// Shared player-image resolution used by the boxscore and draft pages.
// Headshots come from data/players/images.json (scraped from NFL.com player
// cards); team defenses fall back to the NFL team logo.

interface RawPlayerImage {
  playerId: number;
  name: string;
  imageUrl: string | null;
}

const PLAYER_IMAGES = new Map<number, RawPlayerImage>(
  (playerImages as RawPlayerImage[]).filter((p) => p.imageUrl).map((p) => [p.playerId, p]),
);

const IMAGE_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K"]);

const NFL_TEAM_LOGOS: Record<string, string> = {
  "49ers": "sf", Bears: "chi", Bengals: "cin", Bills: "buf", Broncos: "den",
  Browns: "cle", Buccaneers: "tb", Cardinals: "ari", Chargers: "lac", Chiefs: "kc",
  Colts: "ind", Commanders: "wsh", Cowboys: "dal", Dolphins: "mia", Eagles: "phi",
  Falcons: "atl", "Football Team": "wsh", Giants: "nyg", Jaguars: "jax", Jets: "nyj",
  Lions: "det", Packers: "gb", Panthers: "car", Patriots: "ne", Raiders: "lv",
  Rams: "lar", Ravens: "bal", Redskins: "wsh", Saints: "no", Seahawks: "sea",
  Steelers: "pit", Texans: "hou", Titans: "ten", Vikings: "min",
};

function defenseLogoUrl(name: string): string | undefined {
  const ab = NFL_TEAM_LOGOS[name];
  return ab ? `https://a.espncdn.com/i/teamlogos/nfl/500/${ab}.png` : undefined;
}

export const POS_COLOR: Record<string, string> = {
  QB: "#e26a9a", RB: "#56c1b6", WR: "#5aa9e6", TE: "#f0a868",
  DEF: "#b08fd6", "D/ST": "#b08fd6", K: "#c4b06a",
};

export interface ResolvedPlayerImage {
  imageUrl?: string;
  displayName: string;
  /** True for a team D/ST logo (render contained, not cover-cropped). */
  isLogo: boolean;
}

export function resolvePlayerImage(playerId: number, pos: string, name: string): ResolvedPlayerImage {
  const photo = IMAGE_POSITIONS.has(pos) ? PLAYER_IMAGES.get(playerId) : undefined;
  if (photo?.imageUrl) return { imageUrl: photo.imageUrl, displayName: photo.name ?? name, isLogo: false };

  const logo = pos === "DEF" || pos === "D/ST" ? defenseLogoUrl(name) : undefined;
  if (logo) return { imageUrl: logo, displayName: name, isLogo: true };

  return { displayName: name, isLogo: false };
}
