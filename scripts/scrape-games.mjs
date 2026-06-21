// Scrapes EVERY MGL game ever played (2021–2025) including individual player
// scores, from the public NFL.com Fantasy "Game Center" (boxscore) pages.
//
// Run:        node scripts/scrape-games.mjs
// One season: node scripts/scrape-games.mjs 2024
// One week:   node scripts/scrape-games.mjs 2024 1
//
// Output: data/games/<season>.json (one file per season) + data/games/index.json
//
// Each gamecenter page (teamgamecenter?teamId=&week=) contains the matchup
// header (the two teams in order), the scoreboard strip (every team's total for
// that week) and four player tables: [startersA, benchA, startersB, benchB].

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const LEAGUE_ID = "9579168";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
const MAX_WEEK = 17;
const DELAY_MS = 250;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const onlySeason = process.argv[2] ? Number(process.argv[2]) : null;
const onlyWeek = process.argv[3] ? Number(process.argv[3]) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (s) => Number(String(s).replace(/,/g, ""));

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.text();
}

function gcUrl(season, teamId, week) {
  return `https://fantasy.nfl.com/league/${LEAGUE_ID}/history/${season}/teamgamecenter?teamId=${teamId}&week=${week}`;
}

// NFL Fantasy statId -> our canonical stat-line key. These are the raw scoring
// inputs shown in each player's gamecenter row ("217 Pass Yds, 1 Pass TD, ...").
const STAT_ID_MAP = {
  5: "passYds", 6: "passTD", 7: "passInt",
  14: "rushYds", 15: "rushTD",
  21: "recYds", 22: "recTD",
  30: "fum", 32: "twoPt",
  33: "patMade", 34: "patMiss",
  35: "fg0_19", 36: "fg20_29", 37: "fg30_39", 38: "fg40_49", 39: "fg50",
  40: "fgMiss0_19", 41: "fgMiss20_29", 42: "fgMiss30_39", 43: "fgMiss40_49", 44: "fgMiss50",
  45: "defSack", 46: "defInt", 47: "defFumRec",
  49: "defSafety", 50: "defTD", 53: "defRetTD", 54: "defPtsAllowed",
};

/** Parse one player table chunk (HTML after a "<table") into player rows. */
function parsePlayers(tableHtml) {
  const rows = tableHtml.match(/<tr class="player-[^"]*"[\s\S]*?<\/tr>/g) || [];
  const players = [];
  for (const row of rows) {
    const slot = row.match(/class="teamPosition[^"]*">\s*<span[^>]*>([^<]+)</)?.[1]?.trim() ?? "";
    const nameM = row.match(/class="[^"]*playerName[^"]*playerNameId-(\d+)[^"]*"[^>]*>([^<]+)</);
    if (!nameM) continue; // empty roster slot
    const playerId = Number(nameM[1]);
    const name = nameM[2].trim();
    const posTeam = row.match(/<em>([^<]*)<\/em>/)?.[1]?.trim() ?? "";
    const [pos, proTeam] = posTeam.split(" - ").map((s) => s.trim());
    const opponent = row.match(/class="playerOpponent"[^>]*>([^<]*)</)?.[1]?.trim() ?? "";
    const ptsM = row.match(/class="playerTotal [^"]*"[^>]*>(-?[\d.]+)</);
    const points = ptsM ? Number(ptsM[1]) : 0;
    const started = !["BN", "IR", "RES", "NA"].includes(slot) && slot !== "";

    const stats = {};
    const statsCellM = row.match(/class="playerStats">([\s\S]*?)<\/td>/);
    if (statsCellM) {
      for (const sm of statsCellM[1].matchAll(/statId-(\d+)[^"]*">\s*<b>([^<]*)<\/b>/g)) {
        const key = STAT_ID_MAP[Number(sm[1])];
        if (!key) continue;
        const val = Number(sm[2]);
        if (sm[2] !== "" && !Number.isNaN(val)) stats[key] = val;
      }
    }

    players.push({ slot, name, playerId, pos: pos ?? "", proTeam: proTeam ?? "", opponent, points, started, stats });
  }
  return players;
}

/** Parse a gamecenter page into one matchup, or null if no valid matchup. */
function parseGame(html, season, week) {
  const header = html.match(/teamMatchupHeader"[\s\S]*?(?=<div class="aside|<div id="aside|$)/)?.[0] ?? html;
  const aId = Number(header.match(/teamWrap-1"[\s\S]{0,200}?teamId-(\d+)/)?.[1]);
  const bId = Number(header.match(/teamWrap-2"[\s\S]{0,200}?teamId-(\d+)/)?.[1]);
  if (!aId || !bId) return null;

  // team names + totals from the scoreboard strip (covers all teams that week)
  const names = {};
  for (const m of html.matchAll(/teamTotal teamId-(\d+)" aria-description="Total points for ([^"]+)">(-?[\d.,]+)/g)) {
    names[Number(m[1])] = { name: m[2].trim(), total: num(m[3]) };
  }

  const tables = html.split(/<table/).slice(1).filter((c) => /tableType-player/.test(c.slice(0, 80)));
  if (tables.length < 4) return null;
  const teamAPlayers = [...parsePlayers(tables[0]), ...parsePlayers(tables[1])];
  const teamBPlayers = [...parsePlayers(tables[2]), ...parsePlayers(tables[3])];

  const total = (id, players) =>
    names[id]?.total ?? Math.round(players.filter((p) => p.started).reduce((s, p) => s + p.points, 0) * 100) / 100;

  return {
    id: `${season}-${week}-${Math.min(aId, bId)}-${Math.max(aId, bId)}`,
    season,
    week,
    home: { teamId: aId, name: names[aId]?.name ?? `Team ${aId}`, total: total(aId, teamAPlayers), players: teamAPlayers },
    away: { teamId: bId, name: names[bId]?.name ?? `Team ${bId}`, total: total(bId, teamBPlayers), players: teamBPlayers },
  };
}

async function loadSeasonTeamIds(season) {
  const hist = JSON.parse(await readFile(join(root, "data", "history.json"), "utf8"));
  return hist[String(season)].teams.map((t) => t.teamId);
}

async function scrapeSeason(season) {
  const teamIds = await loadSeasonTeamIds(season);
  const games = [];

  for (let week = 1; week <= MAX_WEEK; week++) {
    if (onlyWeek && week !== onlyWeek) continue;
    const seenPairs = new Set();
    let weekHadGames = false;

    for (const teamId of teamIds) {
      const pairKey = [...seenPairs].find((k) => k.includes(`-${teamId}-`) || k.endsWith(`-${teamId}`));
      if (pairKey) continue; // this team's matchup already captured
      let html;
      try {
        html = await get(gcUrl(season, teamId, week));
      } catch {
        continue;
      }
      await sleep(DELAY_MS);
      const game = parseGame(html, season, week);
      if (!game) continue;
      const key = `-${game.home.teamId}-${game.away.teamId}`;
      if (seenPairs.has(key) || seenPairs.has(`-${game.away.teamId}-${game.home.teamId}`)) continue;
      seenPairs.add(key);
      seenPairs.add(`-${game.away.teamId}-${game.home.teamId}`);
      games.push(game);
      weekHadGames = true;
    }

    process.stdout.write(`  ${season} wk${week}: ${[...seenPairs].length / 2} games\n`);
    if (!weekHadGames && week > 14) break; // past playoffs → done
  }
  return games;
}

async function main() {
  const seasons = onlySeason ? [onlySeason] : [2021, 2022, 2023, 2024, 2025];
  const dir = join(root, "data", "games");
  await mkdir(dir, { recursive: true });

  const index = [];
  for (const season of seasons) {
    console.log(`\n=== ${season} ===`);
    const games = await scrapeSeason(season);
    const players = games.reduce((s, g) => s + g.home.players.length + g.away.players.length, 0);
    await writeFile(join(dir, `${season}.json`), JSON.stringify(games, null, 2) + "\n", "utf8");
    index.push({ season, games: games.length, playerLines: players });
    console.log(`  → ${games.length} games, ${players} player lines`);
  }
  await writeFile(join(dir, "index.json"), JSON.stringify(index, null, 2) + "\n", "utf8");
  console.log("\nDone:", index.map((i) => `${i.season}:${i.games}g`).join("  "));
}

main();
