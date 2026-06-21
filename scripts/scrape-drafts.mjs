// Scrapes MGL draft results from the public NFL.com Fantasy history pages.
//
// Run:         node scripts/scrape-drafts.mjs
// One season:  node scripts/scrape-drafts.mjs 2023
//
// Output: data/drafts/<season>.json + data/drafts/index.json

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LEAGUE_ID = "9579168";
const SEASONS = [2021, 2022, 2023, 2024, 2025];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
const DELAY_MS = 250;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const onlySeason = process.argv[2] ? Number(process.argv[2]) : null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function draftUrl(season, detail = 0) {
  const params = new URLSearchParams({
    draftResultsDetail: String(detail),
    draftResultsTab: "round",
    draftResultsType: "results",
  });
  return `https://fantasy.nfl.com/league/${LEAGUE_ID}/history/${season}/draftresults?${params}`;
}

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

function decodeHtml(value = "") {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&raquo;/g, ">>")
    .trim();
}

function cleanText(value = "") {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

function parseMaxRound(html) {
  const rounds = [...html.matchAll(/draftResultsDetail=(\d+)/g)]
    .map((m) => Number(m[1]))
    .filter((n) => n > 0);
  return rounds.length ? Math.max(...rounds) : 0;
}

function roundChunks(html) {
  const starts = [...html.matchAll(/<div class="wrap">\s*<h4>Round (\d+)<\/h4>/g)];
  return starts.map((match, index) => {
    const start = match.index ?? 0;
    const end = starts[index + 1]?.index ?? html.indexOf("</div><!-- .wrap -->", start);
    return {
      round: Number(match[1]),
      html: html.slice(start, end > start ? end : undefined),
    };
  });
}

function pickChunks(roundHtml) {
  const starts = [...roundHtml.matchAll(/<li class="[^"]*">\s*<span class="count">/g)];
  return starts.map((match, index) => {
    const start = match.index ?? 0;
    const end = starts[index + 1]?.index ?? roundHtml.length;
    return roundHtml.slice(start, end);
  });
}

function parsePick(chunk, season, round) {
  const pick = Number(chunk.match(/<span class="count">(\d+)\.<\/span>/)?.[1]);
  const playerMatch = chunk.match(/playerNameId-(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/);
  if (!pick || !playerMatch) return null;

  const posTeam = cleanText(chunk.match(/<em>([\s\S]*?)<\/em>/)?.[1] ?? "");
  const [position = "", proTeam = ""] = posTeam.split(" - ").map((s) => s.trim());
  const teamMatch = chunk.match(/class="teamName teamId-(\d+)">([\s\S]*?)<\/a>/);
  const managers = [...(chunk.match(/<span class="tw">([\s\S]*?)<\/span>/)?.[1] ?? "").matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
    .map((m) => cleanText(m[1]))
    .filter(Boolean);
  const statusMatch = chunk.match(/<strong class="status [^"]*" title="([^"]+)">([^<]+)<\/strong>/);

  return {
    season,
    round,
    pick,
    playerId: Number(playerMatch[1]),
    playerName: cleanText(playerMatch[2]),
    position,
    proTeam,
    status: statusMatch ? { label: cleanText(statusMatch[2]), title: decodeHtml(statusMatch[1]) } : undefined,
    fantasyTeamId: teamMatch ? Number(teamMatch[1]) : 0,
    fantasyTeamName: teamMatch ? cleanText(teamMatch[2]) : "Unknown",
    managers,
  };
}

function parseDraftPage(html, season) {
  const picks = [];
  for (const round of roundChunks(html)) {
    for (const chunk of pickChunks(round.html)) {
      const pick = parsePick(chunk, season, round.round);
      if (pick) picks.push(pick);
    }
  }
  return picks;
}

async function scrapeSeason(season) {
  const allHtml = await get(draftUrl(season, 0));
  let picks = parseDraftPage(allHtml, season);
  const maxRound = parseMaxRound(allHtml);

  if (maxRound && new Set(picks.map((p) => p.round)).size < maxRound) {
    picks = [];
    for (let round = 1; round <= maxRound; round++) {
      const html = await get(draftUrl(season, round));
      picks.push(...parseDraftPage(html, season));
      await sleep(DELAY_MS);
    }
  }

  picks.sort((a, b) => a.pick - b.pick || a.round - b.round);
  const teamCount = new Set(picks.map((p) => p.fantasyTeamId).filter(Boolean)).size;
  return { season, rounds: maxRound || Math.max(...picks.map((p) => p.round)), teamCount, picks };
}

async function main() {
  const seasons = onlySeason ? [onlySeason] : SEASONS;
  const dir = join(root, "data", "drafts");
  await mkdir(dir, { recursive: true });

  const index = [];
  for (const season of seasons) {
    process.stdout.write(`Scraping draft ${season}... `);
    const draft = await scrapeSeason(season);
    await writeFile(join(dir, `${season}.json`), JSON.stringify(draft, null, 2) + "\n", "utf8");
    index.push({
      season,
      rounds: draft.rounds,
      teams: draft.teamCount,
      picks: draft.picks.length,
    });
    console.log(`${draft.picks.length} picks, ${draft.rounds} rounds`);
    await sleep(DELAY_MS);
  }

  index.sort((a, b) => b.season - a.season);
  await writeFile(join(dir, "index.json"), JSON.stringify(index, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${dir}`);
}

main();
