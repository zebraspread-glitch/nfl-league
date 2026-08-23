// Shared Sleeper -> MGL franchise resolution for the fetch-sleeper-* scripts.
//
// Sleeper's roster_id is assigned by join order and means nothing to us, and
// managers rename their handles between seasons, so the stable key is a
// hand-kept username map. Old handles are kept alongside current ones.
// Mirrors SLEEPER_USERNAME_TO_TEAM_ID in lib/sleeper.ts — update both when
// someone joins or renames.

export const USERNAME_TO_FRANCHISE = {
  dimmymgl: "Dimmy",
  thomopatto: "Thomo", // old handle
  thomoo: "Thomo",
  deaaroncronin: "De'Aaron Cronin",
  ginnivanjefferson: "GinniVan Jefferson",
  lavarballs27: "Lavar Balls", // old handle
  lavarballsmgl: "Lavar Balls",
  monkevengence: "Monke Vengeance",
  tinklevanginkel: "Tinkle Van Ginkel",
  lucasdalts98746: "Dalts", // old handle
  tyhillmgl: "Dalts",
  pahomgl: "Paho",
  chicook: "ChiChi",
  brownlowrow: "Brownlowrowbottom",
  luckybison: "Lucky Bison",
};

/**
 * roster_id -> franchise name, resolved through each roster's owner.
 * Throws rather than emitting a "Team N" placeholder, so an unmapped manager
 * fails the fetch loudly instead of quietly landing in committed data.
 */
export function franchiseByRoster(rosters, users) {
  const userById = new Map(users.map((u) => [u.user_id, u]));
  const map = new Map();
  for (const roster of rosters) {
    const user = roster.owner_id ? userById.get(roster.owner_id) : undefined;
    const name = user && USERNAME_TO_FRANCHISE[user.display_name.toLowerCase()];
    if (!name) {
      throw new Error(
        `Roster ${roster.roster_id} has no franchise mapping ` +
          `(owner "${user ? user.display_name : "none"}"). Add it to USERNAME_TO_FRANCHISE.`,
      );
    }
    map.set(roster.roster_id, name);
  }
  return map;
}

/** "Nov 20, 6:08am" in league time, matching the scraped NFL.com date format. */
export function formatTradeDate(ms) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(ms));
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("month")} ${get("day")}, ${get("hour")}:${get("minute")}${get("dayPeriod").toLowerCase().replace(/\./g, "")}`;
}
