import { getTeam } from "./teams";
import type { TeamMeta } from "./types";

// Maps every team name that has appeared in MGL history (2021-2025) onto one
// of today's 12 franchises. NFL Fantasy lets teams rename year to year and can
// shuffle internal team ids, so this hand-verified alias table is the stable key.
//
// Confident renames: Tom -> Thomo, Garytrentjr -> Brownlowrowbottom,
// De'Aaron Fox -> De'Aaron Cronin, Monke Avengence -> Monke Vengence,
// Dim -> Dimmy, Oliver -> Tinkle Van Ginkel.
// Inferred: The Bills -> Lucky Bison, Cleveland -> Tinkle Van Ginkel,
// "Sir Doug" -> Lavar Balls.
const NAME_TO_FRANCHISE: Record<string, number> = {
  // 1 Dimmy
  Dim: 1,
  Dimmy: 1,
  // 2 Thomo
  Tom: 2,
  Thomo: 2,
  // 3 De'Aaron Cronin
  "De'Aaron Fox": 3,
  "De'Aaron Cronin": 3,
  // 4 GinniVan Jefferson
  "GinniVan Jefferson": 4,
  // 5 Lavar Balls
  "Lavar Ball": 5,
  "Lavar Balls": 5,
  "Sir Doug": 5,
  // 6 Monke Vengeance
  "Monke Avengence": 6,
  "Monke Vengence": 6,
  "Monke Vengeance": 6,
  // 7 Tinkle Van Ginkel
  Cleveland: 7,
  Oliver: 7,
  "Tinkle Van Ginkel": 7,
  // 8 Dalts
  Dalts: 8,
  // 9 Paho
  Paho: 9,
  // 10 ChiChi
  ChiChi: 10,
  // 11 Brownlowrowbottom
  Garytrentjr: 11,
  Brownlowrowbottom: 11,
  // 12 Lucky Bison
  "The Bills": 12,
  "Lucky Bison": 12,
};

/** Resolve a historical season team name to today's franchise id. */
export function franchiseIdForName(name: string): number | undefined {
  return NAME_TO_FRANCHISE[name.trim()];
}

/** Resolve a historical season team name to today's franchise metadata. */
export function franchiseForName(name: string): TeamMeta | undefined {
  const id = franchiseIdForName(name);
  return id ? getTeam(id) : undefined;
}
