// Scrapes every add/drop (waiver & free-agent) transaction (2021-2025) from
// the public NFL.com Fantasy league transaction log and writes it to
// data/transactions.json.
//
// Run:  node scripts/scrape-transactions.mjs
//
// Trades have their own scraper (scripts/scrape-trades.mjs) and dedicated
// HTML structure. Commissioner notes and weekly lineup/roster moves are
// skipped here — too noisy to be useful on a "Transactions" page.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const LEAGUE_ID = "9579168";
const SEASONS = [2021, 2022, 2023, 2024, 2025];
const TYPES = ["add", "drop"];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
const MAX_OFFSET = 300;

const __dirname = dirname(fileURLToPath(import.meta.url));

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

function parseRows(html, type) {
  const rows = html.match(new RegExp(`<tr class="transaction-${type}-\\d+[^"]*">[\\s\\S]*?<\\/tr>`, "g")) || [];
  return rows.map((row) => {
    const id = row.match(new RegExp(`transaction-${type}-(\\d+)`))[1];
    const date = row.match(/class="transactionDate first">([^<]+)</)?.[1]?.trim() ?? "";
    const week = Number(row.match(/class="transactionWeek">(\d+)</)?.[1] ?? 0);

    const playerM = row.match(
      /playerNameId-(\d+)[^>]*">([^<]+)<\/a>\s*<em>([^<]*)<\/em>/,
    );
    const posTeam = playerM?.[3]?.trim() ?? "";
    const [pos, proTeam] = posTeam.split(" - ").map((s) => s?.trim());

    const fromM = row.match(/class="transactionFrom">(?:<a[^>]*teamId=(\d+)[^>]*>([^<]+)<\/a>|([^<]+))</);
    const toM = row.match(/class="transactionTo">(?:<a[^>]*teamId=(\d+)[^>]*>([^<]+)<\/a>|([^<]+))</);

    return {
      id: `${type}-${id}`,
      type,
      date,
      week,
      player: playerM
        ? { playerId: Number(playerM[1]), name: playerM[2].trim(), pos: pos ?? "", proTeam: proTeam ?? "" }
        : null,
      fromTeamId: fromM?.[1] ? Number(fromM[1]) : null,
      fromName: (fromM?.[2] ?? fromM?.[3] ?? "").trim(),
      toTeamId: toM?.[1] ? Number(toM[1]) : null,
      toName: (toM?.[2] ?? toM?.[3] ?? "").trim(),
    };
  });
}

async function scrapeSeasonType(season, type) {
  const base = `https://fantasy.nfl.com/league/${LEAGUE_ID}/history/${season}/transactions?transactionType=${type}`;
  const byId = new Map();
  let emptyStreak = 0;

  for (let offset = 0; offset <= MAX_OFFSET; offset++) {
    const url = offset === 0 ? base : `${base}&offset=${offset}`;
    const html = await get(url);
    const rows = parseRows(html, type);
    if (rows.length === 0) {
      emptyStreak++;
      if (emptyStreak >= 2) break;
      continue;
    }
    emptyStreak = 0;
    for (const r of rows) byId.set(r.id, r);
  }

  return [...byId.values()].map((r) => ({ ...r, season }));
}

async function main() {
  const all = [];
  for (const season of SEASONS) {
    for (const type of TYPES) {
      process.stdout.write(`Scraping ${season} ${type}… `);
      try {
        const rows = await scrapeSeasonType(season, type);
        all.push(...rows);
        console.log(`${rows.length} rows`);
      } catch (err) {
        console.log(`FAILED: ${err.message}`);
      }
    }
  }

  all.sort((a, b) => b.season - a.season || b.week - a.week);

  const dataDir = join(__dirname, "..", "data");
  await mkdir(dataDir, { recursive: true });
  const file = join(dataDir, "transactions.json");
  await writeFile(file, JSON.stringify(all, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${file} (${all.length} total transactions)`);
}

main();
