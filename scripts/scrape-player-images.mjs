// Builds an image manifest for fantasy-relevant players in the local MGL data.
//
// Default positions: QB, RB, WR, TE, K
// Run:              node scripts/scrape-player-images.mjs
// Position subset:  node scripts/scrape-player-images.mjs QB RB WR TE
//
// Output: data/players/images.json

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LEAGUE_ID = "9579168";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
const DEFAULT_POSITIONS = ["QB", "RB", "WR", "TE", "K"];
const CONCURRENCY = 5;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const requestedPositions = process.argv.slice(2).map((p) => p.toUpperCase());
const POSITIONS = new Set(requestedPositions.length ? requestedPositions : DEFAULT_POSITIONS);

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
  if (!POSITIONS.has(position) || !raw.playerId) return;

  const id = String(raw.playerId);
  const name = raw.playerName ?? raw.name ?? "";
  const player =
    players.get(id) ??
    ({
      playerId: Number(raw.playerId),
      name,
      position,
      proTeams: new Set(),
      seasons: new Set(),
      sources: new Set(),
    });

  if (name.length > player.name.length) player.name = name;
  if (raw.proTeam) player.proTeams.add(raw.proTeam);
  player.seasons.add(season);
  player.sources.add(source);
  players.set(id, player);
}

async function collectPlayers() {
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

  return [...players.values()].sort((a, b) => a.position.localeCompare(b.position) || a.name.localeCompare(b.name));
}

async function loadExisting() {
  const entries = new Map();
  for (const file of ["images.json", "kickers.json"]) {
    const fullPath = join(root, "data", "players", file);
    if (!existsSync(fullPath)) continue;
    const rows = JSON.parse(await readFile(fullPath, "utf8"));
    for (const row of rows) {
      if (row?.playerId && row?.imageUrl) entries.set(String(row.playerId), row);
    }
  }
  return entries;
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
      cardPosition: pos || player.position,
      sourceSeason: season,
      cardUrl: url,
    };
  }
  return null;
}

function toOutput(player, card, existing) {
  return {
    playerId: player.playerId,
    name: card?.displayName ?? existing?.name ?? player.name,
    position: player.position,
    proTeams: [...player.proTeams].sort(),
    seasons: [...player.seasons].sort(),
    sources: [...player.sources].sort(),
    imageUrl: card?.imageUrl ?? existing?.imageUrl ?? null,
    imageSource: card ? "nfl-fantasy-cardhistory" : existing?.imageSource ?? null,
    sourceSeason: card?.sourceSeason ?? existing?.sourceSeason ?? null,
    cardUrl: card?.cardUrl ?? existing?.cardUrl ?? null,
  };
}

async function worker(queue, existing, out, stats, workerId) {
  while (queue.length) {
    const player = queue.shift();
    if (!player) return;

    const cached = existing.get(String(player.playerId));
    if (cached?.imageUrl) {
      out.push(toOutput(player, null, cached));
      stats.cached += 1;
      process.stdout.write(`cached ${player.position} ${player.name}\n`);
      continue;
    }

    process.stdout.write(`fetch ${workerId}: ${player.position} ${player.name}... `);
    try {
      const card = await fetchCard(player);
      out.push(toOutput(player, card, null));
      if (card?.imageUrl) {
        stats.found += 1;
        process.stdout.write("image\n");
      } else {
        stats.missing += 1;
        process.stdout.write("missing\n");
      }
    } catch (err) {
      out.push({ ...toOutput(player, null, null), error: err instanceof Error ? err.message : String(err) });
      stats.failed += 1;
      process.stdout.write("failed\n");
    }
  }
}

async function main() {
  const players = await collectPlayers();
  const existing = await loadExisting();
  const queue = [...players];
  const out = [];
  const stats = { cached: 0, found: 0, missing: 0, failed: 0 };

  console.log(`Collecting ${players.length} players: ${[...POSITIONS].join(", ")}`);
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, (_, i) => worker(queue, existing, out, stats, i + 1)),
  );

  out.sort((a, b) => a.position.localeCompare(b.position) || a.name.localeCompare(b.name));
  const dir = join(root, "data", "players");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "images.json"), JSON.stringify(out, null, 2) + "\n", "utf8");

  const images = out.filter((p) => p.imageUrl).length;
  console.log(`\nWrote ${join(dir, "images.json")} (${images}/${out.length} images)`);
  console.log(`Cached ${stats.cached}, fetched ${stats.found}, missing ${stats.missing}, failed ${stats.failed}`);
}

main();
