// Builds a small test image manifest for every kicker in the local MGL data.
//
// Run: node scripts/scrape-kicker-images.mjs
//
// Output: data/players/kickers.json

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LEAGUE_ID = "9579168";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
const DELAY_MS = 150;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeHtml(value = "") {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function mergePlayer(players, raw, season, source) {
  const position = raw.position ?? raw.pos;
  if (position !== "K" || !raw.playerId) return;

  const id = String(raw.playerId);
  const player =
    players.get(id) ??
    ({
      playerId: Number(raw.playerId),
      name: raw.playerName ?? raw.name,
      position: "K",
      proTeams: new Set(),
      seasons: new Set(),
      sources: new Set(),
    });

  if (raw.playerName && raw.playerName.length > player.name.length) player.name = raw.playerName;
  if (raw.name && !player.name) player.name = raw.name;
  if (raw.proTeam) player.proTeams.add(raw.proTeam);
  player.seasons.add(season);
  player.sources.add(source);
  players.set(id, player);
}

async function collectKickers() {
  const players = new Map();

  for (const file of await readdir(join(root, "data", "drafts"))) {
    if (!/^\d{4}\.json$/.test(file)) continue;
    const season = Number(file.slice(0, 4));
    const draft = JSON.parse(await readFile(join(root, "data", "drafts", file), "utf8"));
    for (const pick of draft.picks ?? []) mergePlayer(players, pick, season, "draft");
  }

  for (const file of await readdir(join(root, "data", "games"))) {
    if (!/^\d{4}\.json$/.test(file)) continue;
    const season = Number(file.slice(0, 4));
    const games = JSON.parse(await readFile(join(root, "data", "games", file), "utf8"));
    for (const game of games) {
      for (const player of [...(game.home?.players ?? []), ...(game.away?.players ?? [])]) {
        mergePlayer(players, player, season, "game");
      }
    }
  }

  return [...players.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function playerCardUrl(playerId, season) {
  const params = new URLSearchParams({
    gameSeason: String(season),
    leagueId: LEAGUE_ID,
    playerId: String(playerId),
  });
  return `https://fantasy.nfl.com/players/cardhistory?${params}`;
}

async function fetchCard(player) {
  const seasons = [...player.seasons].sort((a, b) => b - a);
  for (const season of seasons) {
    const url = playerCardUrl(player.playerId, season);
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) continue;
    const html = await res.text();
    const imageMatch = html.match(/class="player-card-bio-list-player-headshot" src="([^"]+)"[^>]*alt="([^"]*)"/);
    if (!imageMatch) continue;
    const pos = decodeHtml(html.match(/class="player-card-bio-list-pos">([^<\s]+)/)?.[1] ?? "");
    return {
      imageUrl: decodeHtml(imageMatch[1]),
      displayName: decodeHtml(imageMatch[2]) || player.name,
      position: pos || "K",
      sourceSeason: season,
      cardUrl: url,
    };
  }
  return null;
}

async function main() {
  const kickers = await collectKickers();
  const out = [];

  for (const [index, player] of kickers.entries()) {
    process.stdout.write(`${index + 1}/${kickers.length} ${player.name}... `);
    try {
      const card = await fetchCard(player);
      out.push({
        playerId: player.playerId,
        name: card?.displayName ?? player.name,
        position: "K",
        proTeams: [...player.proTeams].sort(),
        seasons: [...player.seasons].sort(),
        sources: [...player.sources].sort(),
        imageUrl: card?.imageUrl ?? null,
        imageSource: card ? "nfl-fantasy-cardhistory" : null,
        sourceSeason: card?.sourceSeason ?? null,
        cardUrl: card?.cardUrl ?? null,
      });
      console.log(card?.imageUrl ? "image" : "missing");
    } catch (err) {
      out.push({
        playerId: player.playerId,
        name: player.name,
        position: "K",
        proTeams: [...player.proTeams].sort(),
        seasons: [...player.seasons].sort(),
        sources: [...player.sources].sort(),
        imageUrl: null,
        imageSource: null,
        sourceSeason: null,
        cardUrl: null,
        error: err instanceof Error ? err.message : String(err),
      });
      console.log("failed");
    }
    await sleep(DELAY_MS);
  }

  const dir = join(root, "data", "players");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "kickers.json"), JSON.stringify(out, null, 2) + "\n", "utf8");

  const found = out.filter((p) => p.imageUrl).length;
  console.log(`\nWrote ${join(dir, "kickers.json")} (${found}/${out.length} images)`);
}

main();
