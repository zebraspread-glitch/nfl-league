// Pulls completed trades for a Sleeper season into the same shape the NFL.com
// scraper writes, so /trades renders every season off one data format.
//
// Run:  node scripts/fetch-sleeper-trades.mjs
//       node scripts/fetch-sleeper-trades.mjs 2026
//
// Output: data/trades-sleeper.json — every Sleeper-era trade, replacing just
// the fetched season's entries. Kept separate from data/trades.json so a
// re-run of scrape-trades.mjs (which rewrites 2021-2025 wholesale) can't
// clobber it.
//
// Two things differ from the scraped seasons and are carried as extra fields:
//   * player ids are Sleeper's, not NFL.com's, so they go in `sleeperPlayerId`.
//   * Sleeper files every off-season trade under scoring leg 1. Calling those
//     "Week 1" would claim they happened during week 1 games, so a trade made
//     before the season opener is stored as week 0 and renders "Preseason".

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatTradeDate, franchiseByRoster } from "./sleeper-franchises.mjs";

const LEAGUES = { 2026: "1374614405412560896" };
// Kickoff of each season's week 1 — trades before it are preseason business.
const SEASON_OPENER_MS = { 2026: Date.parse("2026-09-10T00:00:00Z") };
const WEEKS = 18;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const season = Number(process.argv[2]) || 2026;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/** Sleeper's full NFL catalogue, keyed by its own player ids (~19MB, one hit). */
async function playerCatalogue() {
  const all = await getJson("https://api.sleeper.app/v1/players/nfl");
  return (id) => {
    const p = all[id];
    if (!p) return { name: id, pos: "", proTeam: "" };
    const name = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || id;
    return { name, pos: p.position ?? "", proTeam: p.team ?? "" };
  };
}

/**
 * One leg per (giver -> receiver) pair, matching the scraped shape where a
 * leg is a single team's outgoing side. Sleeper describes a trade as flat
 * adds/drops/draft_picks maps instead, so the pairs are rebuilt here.
 */
function legsOf(tx, franchise, lookup) {
  const byPair = new Map();
  const add = (from, to, item) => {
    if (from == null || to == null || from === to) return;
    const key = `${from}>${to}`;
    const leg = byPair.get(key) ?? {
      fromTeamId: null,
      fromName: franchise.get(from) ?? `Roster ${from}`,
      toTeamId: null,
      toName: franchise.get(to) ?? `Roster ${to}`,
      items: [],
    };
    leg.items.push(item);
    byPair.set(key, leg);
  };

  // adds maps player -> receiving roster, drops maps the same player -> sender.
  for (const [playerId, to] of Object.entries(tx.adds ?? {})) {
    const from = (tx.drops ?? {})[playerId];
    const p = lookup(playerId);
    add(from, to, { kind: "player", sleeperPlayerId: playerId, name: p.name, pos: p.pos, proTeam: p.proTeam });
  }

  for (const pick of tx.draft_picks ?? []) {
    // `roster_id` is the pick's ORIGINAL owner, which is not always the team
    // handing it over — a pick can change hands more than once.
    const via = pick.roster_id !== pick.previous_owner_id ? ` (via ${franchise.get(pick.roster_id) ?? "?"})` : "";
    add(pick.previous_owner_id, pick.owner_id, {
      kind: "pick",
      label: `Draft Pick - ${pick.season} Rd ${pick.round}${via}`,
    });
  }

  for (const faab of tx.waiver_budget ?? []) {
    add(faab.sender, faab.receiver, { kind: "faab", label: `$${faab.amount} FAAB` });
  }

  return [...byPair.values()];
}

async function main() {
  const leagueId = LEAGUES[season];
  if (!leagueId) throw new Error(`No Sleeper league id known for ${season}`);

  process.stdout.write(`Fetching Sleeper trades ${season}... `);
  const [rosters, users, lookup] = await Promise.all([
    getJson(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
    getJson(`https://api.sleeper.app/v1/league/${leagueId}/users`),
    playerCatalogue(),
  ]);
  const franchise = franchiseByRoster(rosters, users);

  const raw = [];
  for (let week = 1; week <= WEEKS; week += 1) {
    const tx = await getJson(`https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`);
    raw.push(...tx.filter((t) => t.type === "trade" && t.status === "complete").map((t) => ({ ...t, week })));
  }

  const opener = SEASON_OPENER_MS[season] ?? 0;
  const trades = raw
    .map((tx) => ({
      id: `${season}-${tx.transaction_id}`,
      season,
      week: tx.created < opener ? 0 : tx.week,
      date: formatTradeDate(tx.created),
      legs: legsOf(tx, franchise, lookup),
    }))
    .filter((t) => t.legs.length > 0)
    .sort((a, b) => b.id.localeCompare(a.id));

  const path = join(root, "data", "trades-sleeper.json");
  await mkdir(dirname(path), { recursive: true });
  let existing = [];
  try {
    existing = JSON.parse(await readFile(path, "utf8"));
  } catch {
    existing = [];
  }
  const merged = [...existing.filter((t) => t.season !== season), ...trades].sort(
    (a, b) => b.season - a.season || b.week - a.week,
  );
  await writeFile(path, JSON.stringify(merged, null, 2) + "\n", "utf8");
  console.log(`${trades.length} trades (${merged.length} Sleeper-era total)`);
  console.log(`Wrote ${path}`);
}

main();
