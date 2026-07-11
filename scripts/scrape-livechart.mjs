// Scrapes the "Live Chart" time-series for every MGL game (2021–2025) from
// NFL.com Fantasy. The on-page chart is a dead Flash widget, but it is fed by a
// live JSON endpoint that returns each player's *cumulative* raw stats at every
// 5-minute slice for the whole week:
//
//   /players/weektimestats?season=<s>&gameId=10<s>&week=<w>&timezone=UTC
//
// (gameId is just `10${season}` — same for every week of a season.)
//
// We replay those slices through the league's scoring rules (lifted verbatim
// from the page's Y.Scores config) to rebuild each team's running total, then
// store the home/away totals per slice so the site can draw a margin chart.
//
// Run:        node scripts/scrape-livechart.mjs
// One season: node scripts/scrape-livechart.mjs 2024
//
// Output: data/livecharts/<season>.json  — { [gameId]: { start, points } }
//   where points = [[minutesFromStart, homePts, awayPts], ...] (change-points
//   only; flat dead-time stretches are collapsed to their endpoints).

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
const DELAY_MS = 400;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const onlySeason = process.argv[2] ? Number(process.argv[2]) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r2 = (v) => Math.round(v * 100) / 100;

// League scoring config, lifted verbatim from the gamecenter page's
// Y.Scores.init payload (league 9579168: fractionalPts=true, negativePts=true,
// ptsFormat=2). Keyed by NFL statId. t: "y" = yards_per_point, "p" = points.
const STATS = {
  5: { t: "y", m: 25 }, 6: { t: "p", m: 4 }, 7: { t: "p", m: -3 }, 8: { t: "p", m: -1 },
  14: { t: "y", m: 10 }, 15: { t: "p", m: 6 }, 20: { t: "p", m: 1 }, 21: { t: "y", m: 10 },
  22: { t: "p", m: 6 }, 28: { t: "p", m: 6 }, 29: { t: "p", m: 6 }, 30: { t: "p", m: -3 },
  32: { t: "p", m: 2 }, 33: { t: "p", m: 1 }, 34: { t: "p", m: -1 }, 35: { t: "p", m: 3 },
  36: { t: "p", m: 3 }, 37: { t: "p", m: 3 }, 38: { t: "p", m: 4 }, 39: { t: "p", m: 5 },
  45: { t: "p", m: 1 }, 46: { t: "p", m: 3 }, 47: { t: "p", m: 3 }, 49: { t: "p", m: 2 },
  50: { t: "p", m: 6 }, 51: { t: "p", m: 3 }, 53: { t: "p", m: 6 }, 55: { t: "p", m: 10 },
  56: { t: "p", m: 7 }, 57: { t: "p", m: 4 }, 58: { t: "p", m: 1 }, 59: { t: "p", m: 0 },
  60: { t: "p", m: -1 }, 61: { t: "p", m: -4 }, 73: { t: "p", m: 3 }, 76: { t: "p", m: 6 },
  77: { t: "p", m: 6 }, 78: { t: "p", m: 6 }, 79: { t: "p", m: 2 }, 80: { t: "p", m: 2 },
  81: { t: "p", m: 1 }, 82: { t: "y", m: 10 }, 93: { t: "p", m: 2 },
};

/** One player's fantasy total from accumulated raw stats (mirrors getPlayerTotal). */
function playerTotal(stats) {
  let total = 0;
  for (const id in stats) {
    const sc = STATS[id];
    if (!sc) continue;
    const v = Number(stats[id]);
    if (!v) continue;
    total += sc.t === "y" ? v / sc.m : v * sc.m;
  }
  return total;
}

async function fetchWeekStats(season, week) {
  const url =
    `https://fantasy.nfl.com/players/weektimestats?random=${Date.now()}` +
    `&season=${season}&gameId=10${season}&week=${week}&timezone=UTC`;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Ajax-Request": "dynamicRequest" } });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

/** Build the home/away running-total series for one game from week slices. */
function buildSeries(game, slices, sliceTimes) {
  const homeIds = game.home.players.filter((p) => p.started).map((p) => String(p.playerId));
  const awayIds = game.away.players.filter((p) => p.started).map((p) => String(p.playerId));
  const acc = {}; // playerId -> accumulated stats

  const series = []; // [{ ms, h, a }]
  for (const ts of sliceTimes) {
    const slice = slices[ts];
    for (const pid in slice) acc[pid] = Object.assign(acc[pid] || {}, slice[pid]);
    const sum = (ids) => r2(ids.reduce((s, pid) => s + (acc[pid] ? playerTotal(acc[pid]) : 0), 0));
    series.push({ ms: Date.parse(ts), h: sum(homeIds), a: sum(awayIds) });
  }
  return series;
}

/** Collapse flat stretches: keep first, last, and any point where h or a changed. */
function compress(series) {
  if (series.length === 0) return { start: null, points: [] };
  const start = series[0].ms;
  const kept = [];
  for (let i = 0; i < series.length; i++) {
    const p = series[i];
    const prev = series[i - 1];
    const isEnd = i === 0 || i === series.length - 1;
    if (isEnd || p.h !== prev.h || p.a !== prev.a) {
      kept.push([Math.round((p.ms - start) / 60000), p.h, p.a]);
    }
  }
  return { start: new Date(start).toISOString(), points: kept };
}

async function scrapeSeason(season, games) {
  const seasonGames = games.filter((g) => g.season === season);
  const weeks = [...new Set(seasonGames.map((g) => g.week))].sort((a, b) => a - b);
  const out = {};

  for (const week of weeks) {
    let data;
    try {
      data = await fetchWeekStats(season, week);
    } catch (e) {
      console.log(`  ${season} wk${week}: FETCH FAILED ${e.message}`);
      continue;
    }
    await sleep(DELAY_MS);

    const slices = data.playerTimeStats;
    if (!slices || Array.isArray(slices) || Object.keys(slices).length === 0) {
      console.log(`  ${season} wk${week}: no slice data`);
      continue;
    }
    const sliceTimes = Object.keys(slices).sort();

    let ok = 0;
    let warn = 0;
    for (const game of seasonGames.filter((g) => g.week === week)) {
      const series = buildSeries(game, slices, sliceTimes);
      const last = series[series.length - 1];
      // The live time-feed captures in-game stats; the official boxscore can
      // differ slightly after post-game stat corrections. NFL's own chart snaps
      // the final point to the official total — do the same so the chart ends
      // exactly at the score shown everywhere else on the site.
      if (last) {
        const drift = Math.abs(last.h - game.home.total) + Math.abs(last.a - game.away.total);
        if (drift > 0.05) warn++;
        last.h = game.home.total;
        last.a = game.away.total;
      }
      out[game.id] = compress(series);
      ok++;
    }
    console.log(`  ${season} wk${week}: ${ok} games${warn ? ` (${warn} mismatch)` : ""}`);
  }
  return out;
}

async function main() {
  const seasons = onlySeason ? [onlySeason] : [2021, 2022, 2023, 2024, 2025];
  const dir = join(root, "data", "livecharts");
  await mkdir(dir, { recursive: true });

  for (const season of seasons) {
    console.log(`\n=== ${season} ===`);
    const games = JSON.parse(await readFile(join(root, "data", "games", `${season}.json`), "utf8"));
    const out = await scrapeSeason(season, games);
    const path = join(dir, `${season}.json`);
    const json = JSON.stringify(out) + "\n";
    await writeFile(path, json, "utf8");
    console.log(`  → ${Object.keys(out).length} charts, ${(json.length / 1024).toFixed(0)}KB`);
  }
}

main();
