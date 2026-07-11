// Scrapes every all-time trade (2021-2025) from the public NFL.com Fantasy
// league transactions pages and writes it to data/trades.json.
//
// Run:  node scripts/scrape-trades.mjs
//
// Each trade shows up as one HTML <tr> per "leg" (one team's outgoing side),
// sharing a "transaction-trade-<id>-<n>" class. A 2-team trade is 2 legs; a
// 3-team trade can be 3+ legs. Pagination is via an `offset` query param with
// undocumented semantics, so we just probe offsets until a page comes back
// with zero trade rows.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const LEAGUE_ID = "9579168";
const SEASONS = [2021, 2022, 2023, 2024, 2025];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
const MAX_OFFSET = 60;

const __dirname = dirname(fileURLToPath(import.meta.url));

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

function parseLegs(html) {
  const rows = html.match(/<tr class="transaction-trade-\d+-\d+[^"]*">[\s\S]*?<\/tr>/g) || [];
  const legs = [];
  for (const row of rows) {
    const idM = row.match(/transaction-trade-(\d+)-(\d+)/);
    const date = row.match(/class="transactionDate first">([^<]+)</)?.[1]?.trim() ?? "";
    const week = Number(row.match(/class="transactionWeek">(\d+)</)?.[1] ?? 0);

    const itemsHtml = row.match(/class="playerNameAndInfo">([\s\S]*?)<\/td>/)?.[1] ?? "";
    const items = [];
    for (const li of itemsHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
      const inner = li[1];
      const playerM = inner.match(
        /playerNameId-(\d+)[^>]*">([^<]+)<\/a>\s*<em>([^<]*)<\/em>/,
      );
      if (playerM) {
        const posTeam = playerM[3].trim(); // "QB - NYJ" or "QB"
        const [pos, proTeam] = posTeam.split(" - ").map((s) => s?.trim());
        items.push({
          kind: "player",
          playerId: Number(playerM[1]),
          name: playerM[2].trim(),
          pos: pos ?? "",
          proTeam: proTeam ?? "",
        });
      } else {
        const text = inner.replace(/<[^>]+>/g, "").trim();
        if (text) items.push({ kind: "pick", label: text });
      }
    }

    const fromM = row.match(/class="transactionFrom">(?:<a[^>]*teamId=(\d+)[^>]*>([^<]+)<\/a>|([^<]+))</);
    const toM = row.match(/class="transactionTo">(?:<a[^>]*teamId=(\d+)[^>]*>([^<]+)<\/a>|([^<]+))</);

    legs.push({
      tradeId: idM[1],
      leg: Number(idM[2]),
      date,
      week,
      fromTeamId: fromM?.[1] ? Number(fromM[1]) : null,
      fromName: (fromM?.[2] ?? fromM?.[3] ?? "").trim(),
      toTeamId: toM?.[1] ? Number(toM[1]) : null,
      toName: (toM?.[2] ?? toM?.[3] ?? "").trim(),
      items,
    });
  }
  return legs;
}

async function scrapeSeason(season) {
  const base = `https://fantasy.nfl.com/league/${LEAGUE_ID}/history/${season}/transactions?transactionType=trade`;
  const byTradeId = new Map();
  let emptyStreak = 0;

  for (let offset = 0; offset <= MAX_OFFSET; offset++) {
    const url = offset === 0 ? base : `${base}&offset=${offset}`;
    const html = await get(url);
    const legs = parseLegs(html);
    if (legs.length === 0) {
      emptyStreak++;
      if (emptyStreak >= 2) break;
      continue;
    }
    emptyStreak = 0;
    for (const leg of legs) {
      const arr = byTradeId.get(leg.tradeId) ?? [];
      if (!arr.some((l) => l.leg === leg.leg)) arr.push(leg);
      byTradeId.set(leg.tradeId, arr);
    }
  }

  const trades = [...byTradeId.entries()].map(([tradeId, legs]) => {
    legs.sort((a, b) => a.leg - b.leg);
    return {
      id: `${season}-${tradeId}`,
      season,
      week: legs[0].week,
      date: legs[0].date,
      legs: legs.map((l) => ({
        fromTeamId: l.fromTeamId,
        fromName: l.fromName,
        toTeamId: l.toTeamId,
        toName: l.toName,
        items: l.items,
      })),
    };
  });

  trades.sort((a, b) => b.week - a.week);
  return trades;
}

async function main() {
  const all = [];
  for (const season of SEASONS) {
    process.stdout.write(`Scraping ${season} trades… `);
    try {
      const trades = await scrapeSeason(season);
      all.push(...trades);
      console.log(`${trades.length} trades`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }

  all.sort((a, b) => b.season - a.season || b.week - a.week);

  const dataDir = join(__dirname, "..", "data");
  await mkdir(dataDir, { recursive: true });
  const file = join(dataDir, "trades.json");
  await writeFile(file, JSON.stringify(all, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${file} (${all.length} total trades)`);
}

main();
