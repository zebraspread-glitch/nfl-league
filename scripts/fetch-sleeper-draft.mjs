// Pulls a completed MGL draft from Sleeper into the same shape the NFL.com
// scraper writes, so /drafts renders every season off one data format.
//
// Run:  node scripts/fetch-sleeper-draft.mjs
//       node scripts/fetch-sleeper-draft.mjs 2026
//
// Output: data/drafts/<season>.json, plus an upserted data/drafts/index.json.
//
// Two things differ from the scraped 2021-2025 seasons and are carried as extra
// fields rather than forced into the old shape:
//   * player ids are Sleeper's, not NFL.com's (different scheme entirely), so
//     they go in `sleeperPlayerId` and `playerId` is left off.
//   * this league keeps players, and Sleeper seeds those keepers onto the board
//     as already-made picks in the back rounds. They are flagged `isKeeper` so
//     the page can label them instead of passing them off as live selections.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { franchiseByRoster } from "./sleeper-franchises.mjs";

const LEAGUE_ID = "1374614405412560896";
const DRAFTS = { 2026: "1374643393300283392" };

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const season = Number(process.argv[2]) || 2026;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

function playerNameOf(meta) {
  return [meta.first_name, meta.last_name].filter(Boolean).join(" ").trim();
}

async function main() {
  const draftId = DRAFTS[season];
  if (!draftId) throw new Error(`No Sleeper draft id known for ${season}`);

  process.stdout.write(`Fetching Sleeper draft ${season}... `);
  const [draft, picks, rosters, users] = await Promise.all([
    getJson(`https://api.sleeper.app/v1/draft/${draftId}`),
    getJson(`https://api.sleeper.app/v1/draft/${draftId}/picks`),
    getJson(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/rosters`),
    getJson(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/users`),
  ]);

  if (draft.status !== "complete") {
    throw new Error(`Draft ${season} is "${draft.status}", not complete — refusing to write a partial board.`);
  }

  const franchise = franchiseByRoster(rosters, users);
  const out = picks
    .map((pick) => {
      const meta = pick.metadata ?? {};
      return {
        season,
        round: pick.round,
        pick: pick.pick_no,
        sleeperPlayerId: pick.player_id ?? undefined,
        playerName: playerNameOf(meta),
        position: meta.position ?? "",
        proTeam: meta.team ?? "",
        isKeeper: pick.is_keeper ? true : undefined,
        fantasyTeamName: franchise.get(pick.roster_id) ?? "Unknown",
        // Managers come from the curated franchise metadata at read time, so
        // there is one place to change a manager's name.
        managers: [],
      };
    })
    .sort((a, b) => a.pick - b.pick);

  const keepers = out.filter((p) => p.isKeeper).length;
  const payload = {
    season,
    rounds: draft.settings?.rounds ?? Math.max(...out.map((p) => p.round)),
    teamCount: draft.settings?.teams ?? franchise.size,
    source: "sleeper",
    draftId,
    keepers,
    picks: out,
  };

  const dir = join(root, "data", "drafts");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${season}.json`), JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`${out.length} picks, ${payload.rounds} rounds, ${keepers} keepers`);

  const indexPath = join(dir, "index.json");
  const index = JSON.parse(await readFile(indexPath, "utf8"));
  const entry = {
    season,
    rounds: payload.rounds,
    teams: payload.teamCount,
    picks: out.length,
    keepers,
  };
  const at = index.findIndex((e) => e.season === season);
  if (at >= 0) index[at] = entry;
  else index.push(entry);
  index.sort((a, b) => b.season - a.season);
  await writeFile(indexPath, JSON.stringify(index, null, 2) + "\n", "utf8");
  console.log(`Wrote ${dir}`);
}

main();
