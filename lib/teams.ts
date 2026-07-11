import type { TeamMeta, TeamId } from "./types";

// Curated franchise metadata. The `id` values are stable and used everywhere
// (URLs, head-to-head keys, ESPN team mapping). Colours give each team its own
// identity on scoreboard tiles and team pages.
//
// LOGOS: image files live in `public/logo/` and are wired via the `logo` path
// below. Any file under /public is served from the site root, so
// `public/logo/dimmy.png` → "/logo/dimmy.png". Square images (PNG/SVG/WebP,
// ~256×256) look best. If `logo` is omitted, the team falls back to its
// coloured initials badge automatically.
export const TEAMS: TeamMeta[] = [
  { id: 1, name: "Dimmy", manager: "Dim", abbrev: "DIM", primary: "#df026b", secondary: "#ff4fa0", logo: "/logo/dimmy.png" },
  { id: 2, name: "Thomo", manager: "Tom", abbrev: "THO", primary: "#8c52ff", secondary: "#6d35d7", logo: "/logo/thomo.png" },
  { id: 3, name: "De'Aaron Cronin", manager: "Noah", abbrev: "DAC", primary: "#821919", secondary: "#b42323", logo: "/logo/deaaroncronin.png" },
  { id: 4, name: "GinniVan Jefferson", manager: "Brodie", abbrev: "GVJ", primary: "#38b6ff", secondary: "#087fbe", logo: "/logo/ginnivanjefferson.png" },
  { id: 5, name: "Lavar Balls", manager: "Noah", abbrev: "LAV", primary: "#ff914d", secondary: "#d95f19", logo: "/logo/lavarballs.png" },
  { id: 6, name: "Monke Vengence", manager: "will", abbrev: "MON", primary: "#7c7973", secondary: "#bdbab2", logo: "/logo/monkevengeance.png" },
  { id: 7, name: "Tinkle Van Ginkel", manager: "Xavier & Joseph", abbrev: "TVG", primary: "#ff3131", secondary: "#c91520", logo: "/logo/tinklevanginkel.png" },
  { id: 8, name: "Dalts", manager: "Talds", abbrev: "DAL", primary: "#22aeb6", secondary: "#5ce1e6", logo: "/logo/dalts.png" },
  { id: 9, name: "Paho", manager: "James", abbrev: "PAH", primary: "#588727", secondary: "#82b84a", logo: "/logo/paho.png" },
  { id: 10, name: "ChiChi", manager: "Chi", abbrev: "CHI", primary: "#000210", secondary: "#0f2747", logo: "/logo/chichi.png" },
  { id: 11, name: "Brownlowrowbottom", manager: "Cam", abbrev: "BRW", primary: "#d6a600", secondary: "#ffde59", logo: "/logo/brownlowrowbottom.png" },
  { id: 12, name: "Lucky Bison", manager: "Cody", abbrev: "LUC", primary: "#5271ff", secondary: "#3047c7", logo: "/logo/luckybison.png" },
];

const BY_ID = new Map<TeamId, TeamMeta>(TEAMS.map((t) => [t.id, t]));
const BY_NAME = new Map<string, TeamMeta>(TEAMS.map((t) => [t.name, t]));

export function getTeam(id: TeamId): TeamMeta | undefined {
  return BY_ID.get(id);
}

/** Resolve a franchise by its display name (used by the static history data).
 *  Unknown names fall back to a grey placeholder. Pass a unique `fallbackId`
 *  (e.g. a negated roster id) so multiple unmapped teams don't collide on the
 *  same id — a negative id also marks the team as having no franchise page. */
export function getTeamByName(name: string, fallbackId = -1): TeamMeta {
  return (
    BY_NAME.get(name) ?? {
      id: fallbackId,
      name,
      manager: "",
      abbrev: name.slice(0, 3).toUpperCase(),
      primary: "#52525b",
      secondary: "#a1a1aa",
    }
  );
}
