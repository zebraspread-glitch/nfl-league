// Snapshots the ladder as it stood after every completed week, so the futures
// board can be replayed rather than only read at its current price.
//
// The odds themselves are not stored. The Monte Carlo in lib/superbowl-odds.ts
// is a pure function of (standings, completed weeks), so keeping the standings
// is enough — lib/odds-history.ts re-runs the sim off each snapshot and the
// market can never drift out of step with the board the site prints today.
//
// Run:    node scripts/build-odds-history.mjs
// Output: data/odds-history/<season>.json — { season, weeks: [{ week, standings }] }

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { franchiseByRoster } from './sleeper-franchises.mjs';

const LEAGUE = '1374614405412560896';
const SEASON = 2026;
const REGULAR_SEASON_WEEKS = 14;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'odds-history');

// Mirrors TEAMS in lib/teams.ts — the snapshot stores franchise ids, not the
// join-order roster ids Sleeper hands out.
const FRANCHISE_ID = {
  Dimmy: 1,
  Thomo: 2,
  "De'Aaron Cronin": 3,
  'GinniVan Jefferson': 4,
  'Lavar Balls': 5,
  'Monke Vengeance': 6,
  'Tinkle Van Ginkel': 7,
  Dalts: 8,
  Paho: 9,
  ChiChi: 10,
  Brownlowrowbottom: 11,
  'Lucky Bison': 12,
};

const get = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

const r2 = (v) => Math.round(v * 100) / 100;

/** The last regular-season week that is finished — every matchup scored and
 *  settled. A week still being played is left out rather than frozen midway. */
function lastCompletedWeek(state) {
  if (Number(state.season) !== SEASON || state.season_type !== 'regular') return REGULAR_SEASON_WEEKS;
  return Math.min(Math.max((state.week ?? 1) - 1, 0), REGULAR_SEASON_WEEKS);
}

async function main() {
  const [state, rosters, users] = await Promise.all([
    get('https://api.sleeper.app/v1/state/nfl'),
    get(`https://api.sleeper.app/v1/league/${LEAGUE}/rosters`),
    get(`https://api.sleeper.app/v1/league/${LEAGUE}/users`),
  ]);

  const nameByRoster = franchiseByRoster(rosters, users);
  const teamByRoster = new Map();
  for (const [rosterId, name] of nameByRoster) {
    const id = FRANCHISE_ID[name];
    if (!id) throw new Error(`Franchise "${name}" is not in FRANCHISE_ID`);
    teamByRoster.set(rosterId, id);
  }

  const through = lastCompletedWeek(state);
  console.log(`${SEASON}: weeks 1-${through}`);

  // Running totals, carried forward week to week — the ladder is cumulative.
  const totals = new Map(
    [...teamByRoster.values()].map((id) => [id, { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 }]),
  );
  const weeks = [];

  for (let week = 1; week <= through; week++) {
    const rows = await get(`https://api.sleeper.app/v1/league/${LEAGUE}/matchups/${week}`);

    const byMatchup = new Map();
    for (const row of rows) {
      if (row.matchup_id == null) continue;
      byMatchup.set(row.matchup_id, [...(byMatchup.get(row.matchup_id) ?? []), row]);
    }

    let games = 0;
    for (const pair of byMatchup.values()) {
      if (pair.length !== 2) continue;
      const [a, b] = pair;
      const aId = teamByRoster.get(a.roster_id);
      const bId = teamByRoster.get(b.roster_id);
      if (!aId || !bId) continue;

      const aPts = Number(a.points) || 0;
      const bPts = Number(b.points) || 0;
      const at = totals.get(aId);
      const bt = totals.get(bId);

      at.pointsFor += aPts;
      at.pointsAgainst += bPts;
      bt.pointsFor += bPts;
      bt.pointsAgainst += aPts;

      if (aPts > bPts) { at.wins++; bt.losses++; }
      else if (bPts > aPts) { bt.wins++; at.losses++; }
      else { at.ties++; bt.ties++; }

      games++;
    }

    if (games !== teamByRoster.size / 2) {
      throw new Error(`Week ${week}: ${games} matchups, expected ${teamByRoster.size / 2}`);
    }

    weeks.push({
      week,
      standings: [...totals.entries()]
        .map(([teamId, t]) => ({
          teamId,
          wins: t.wins,
          losses: t.losses,
          ties: t.ties,
          pointsFor: r2(t.pointsFor),
          pointsAgainst: r2(t.pointsAgainst),
        }))
        .sort((x, y) => x.teamId - y.teamId),
    });

    const leader = [...totals.entries()].sort((x, y) => y[1].wins - x[1].wins || y[1].pointsFor - x[1].pointsFor)[0];
    console.log(
      `  Week ${String(week).padStart(2)}: ${games} matchups, ` +
        `leader ${leader[1].wins}-${leader[1].losses} on ${leader[1].pointsFor.toFixed(2)}`,
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${SEASON}.json`);
  fs.writeFileSync(file, `${JSON.stringify({ season: SEASON, weeks }, null, 2)}\n`);
  console.log(`wrote ${file} (${weeks.length} weeks)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
