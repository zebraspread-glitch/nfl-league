// Scrapes MGL season history (2021–2025) from the public NFL.com Fantasy
// league pages and writes it to data/history.json.
//
// Run:  node scripts/scrape-history.mjs
//
// The league pages are public (no login). Two views are read per season:
//   - regular-season standings  → W-L-T, win%, streak, points for / against
//   - final standings           → playoff finishing order (rank 1 = champion)
//
// Identity note: NFL keeps a teamId per franchise, but it shifted once when the
// league expanded, so cross-season aggregation is handled later via a franchise
// alias map in the app — this file only records each season's raw truth.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const LEAGUE_ID = "9579168";
const SEASONS = [2021, 2022, 2023, 2024, 2025];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

const base = `https://fantasy.nfl.com/league/${LEAGUE_ID}/history`;
const __dirname = dirname(fileURLToPath(import.meta.url));

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

const num = (s) => Number(String(s).replace(/,/g, ""));

/** Parse the regular-season standings table rows. */
function parseRegular(html) {
  const rows = html.match(/<tr class="team-\d+[^"]*">[\s\S]*?<\/tr>/g) || [];
  return rows.map((row) => {
    const teamId = Number(row.match(/<tr class="team-(\d+)/)[1]);
    const name = row.match(/class="teamName teamId-\d+">([^<]+)</)?.[1]?.trim() ?? `Team ${teamId}`;
    const record = row.match(/class="teamRecord numeric">([\d-]+)</)?.[1] ?? "0-0-0";
    const winPct = row.match(/class="teamWinPct numeric">([.\d]+)</)?.[1] ?? "0";
    const streak = row.match(/class="teamStreak numeric">([^<]+)</)?.[1]?.trim() ?? "—";
    const pts = [...row.matchAll(/class="teamPts stat numeric[^"]*">([\d,.]+)</g)].map((m) => num(m[1]));
    const [w, l, t] = record.split("-").map(Number);
    return {
      teamId,
      name,
      wins: w ?? 0,
      losses: l ?? 0,
      ties: t ?? 0,
      winPct: Number(winPct),
      streak,
      pointsFor: pts[0] ?? 0,
      pointsAgainst: pts[1] ?? 0,
    };
  });
}

/** Final standings view → ordered list of teamIds (rank 1 first). */
function parseFinalOrder(html) {
  const order = [];
  const seen = new Set();
  for (const m of html.matchAll(/class="teamName teamId-(\d+)">/g)) {
    const id = Number(m[1]);
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  return order;
}

async function scrapeSeason(year) {
  const [regHtml, finalHtml] = await Promise.all([
    get(`${base}/${year}/standings?historyStandingsType=regular`),
    get(`${base}/${year}/standings`),
  ]);

  const teamsById = new Map(parseRegular(regHtml).map((t) => [t.teamId, t]));
  const finalOrder = parseFinalOrder(finalHtml);

  // Attach final placement; fall back to PF order for any team missing from the
  // final view (shouldn't happen, but keeps output complete).
  finalOrder.forEach((id, i) => {
    const t = teamsById.get(id);
    if (t) t.finalRank = i + 1;
  });
  const teams = [...teamsById.values()];
  teams
    .filter((t) => !t.finalRank)
    .sort((a, b) => b.pointsFor - a.pointsFor)
    .forEach((t, i) => (t.finalRank = finalOrder.length + i + 1));

  teams.sort((a, b) => a.finalRank - b.finalRank);
  const champion = teams.find((t) => t.finalRank === 1);
  const runnerUp = teams.find((t) => t.finalRank === 2);

  return {
    year,
    teamCount: teams.length,
    champion: champion?.name ?? null,
    championTeamId: champion?.teamId ?? null,
    runnerUp: runnerUp?.name ?? null,
    teams,
  };
}

async function main() {
  const out = {};
  for (const year of SEASONS) {
    process.stdout.write(`Scraping ${year}… `);
    try {
      out[year] = await scrapeSeason(year);
      console.log(`${out[year].teamCount} teams · champion ${out[year].champion}`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }

  const dataDir = join(__dirname, "..", "data");
  await mkdir(dataDir, { recursive: true });
  const file = join(dataDir, "history.json");
  await writeFile(file, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${file}`);
}

main();
