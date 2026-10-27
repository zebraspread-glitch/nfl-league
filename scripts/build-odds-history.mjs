// Snapshots the ladder as it stood after every completed week — and, from the
// matchup replays, at the end of every day — so the futures board can be
// replayed rather than only read at its current price.
//
// The odds themselves are not stored. The Monte Carlo in lib/superbowl-odds.ts
// is a pure function of (standings, completed weeks), so keeping the standings
// is enough — lib/odds-history.ts re-runs the sim off each snapshot and the
// market can never drift out of step with the board the site prints today.
//
// The daily snapshots go further than the weekly ones: a day that lands in the
// middle of a week catches matchups half-played, so each one carries the
// finished results as standings plus whatever is still live, with the score so
// far and the replay's own win probability at that moment.
//
// Run:    node scripts/build-odds-history.mjs
// Output: data/odds-history/<season>.json — { season, weeks, days }

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

  const days = buildDays(teamByRoster, through);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${SEASON}.json`);
  fs.writeFileSync(file, `${JSON.stringify({ season: SEASON, weeks, days }, null, 2)}\n`);
  console.log(`wrote ${file} (${weeks.length} weeks, ${days.length} days)`);
}

/* -------------------------------------------------------------------------- */
/* Daily snapshots                                                            */
/* -------------------------------------------------------------------------- */

/** League-local date of an instant, as "2026-09-14". Days are cut in Melbourne
 *  time because that is the clock the league reads the ladder on — a Monday
 *  night NFL game lands on Tuesday here, and that is when the week settles. */
const LEAGUE_TZ = 'Australia/Melbourne';
const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: LEAGUE_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const dayKey = (ms) => dayFormat.format(new Date(ms));

/** The last instant of a league-local day, as epoch ms. Found by walking
 *  forward from noon UTC until the local date rolls over, which sidesteps
 *  having to know the offset or when daylight saving moves. */
function endOfDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  let ms = Date.UTC(y, m - 1, d, 12, 0, 0);
  while (dayKey(ms) < key) ms += 3600e3;
  while (dayKey(ms + 3600e3) <= key) ms += 3600e3;
  // Now within the last hour of the day; step to its final minute.
  while (dayKey(ms + 60e3) <= key) ms += 60e3;
  return ms;
}

/** Each replay's score line, read at an arbitrary instant. */
function replayState(replay, at) {
  const startMs = Date.parse(replay.start);
  const points = replay.points;
  const endMs = startMs + points[points.length - 1][0] * 60000;

  if (at < startMs) return { status: 'pending' };

  // Last change at or before `at` — the replay stores change points, so the
  // score holds flat between them.
  let i = 0;
  for (let k = 0; k < points.length; k++) {
    if (startMs + points[k][0] * 60000 <= at) i = k;
    else break;
  }
  const [, away, home, awayWinProb] = points[i];

  return {
    status: at >= endMs ? 'final' : 'live',
    away,
    home,
    awayWinProb: awayWinProb / 100,
  };
}

/** One snapshot per league-local day: everything finished folded into the
 *  ladder, everything still being played left live. */
function buildDays(teamByRoster, through) {
  const replayFile = path.join(ROOT, 'data', 'replays', `${SEASON}.json`);
  if (!fs.existsSync(replayFile)) {
    console.log('no replays — skipping daily snapshots');
    return [];
  }
  const replays = JSON.parse(fs.readFileSync(replayFile, 'utf8'));

  // Only weeks the weekly snapshots cover, so the two views end together.
  const entries = Object.entries(replays)
    .map(([key, replay]) => ({ week: Number(key.split('-')[0]), replay }))
    .filter((e) => e.week >= 1 && e.week <= through);

  if (!entries.length) return [];

  const first = Math.min(...entries.map((e) => Date.parse(e.replay.start)));
  const last = Math.max(
    ...entries.map((e) => Date.parse(e.replay.start) + e.replay.points[e.replay.points.length - 1][0] * 60000),
  );

  const days = [];
  for (let key = dayKey(first); key <= dayKey(last); key = dayKey(endOfDay(key) + 2 * 3600e3)) {
    const at = Math.min(endOfDay(key), last);

    const totals = new Map(
      [...teamByRoster.values()].map((id) => [id, { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 }]),
    );
    const live = [];
    // A week's six matchups do not all start together — a Thursday night game
    // puts one or two on the clock while the rest are untouched. Those stragglers
    // are ordinary fixtures still to be played, and have to be handed to the
    // simulator as such or they go missing from the season entirely.
    const pending = [];
    let startedThrough = 0;

    for (const { week, replay } of entries) {
      const awayId = teamByRoster.get(replay.away);
      const homeId = teamByRoster.get(replay.home);
      if (!awayId || !homeId) continue;

      const state = replayState(replay, at);
      if (state.status !== 'pending') startedThrough = Math.max(startedThrough, week);
      if (state.status === 'pending') {
        pending.push({ week, away: awayId, home: homeId });
        continue;
      }

      if (state.status === 'live') {
        live.push({
          away: { teamId: awayId, points: r2(state.away) },
          home: { teamId: homeId, points: r2(state.home) },
          awayWinProb: Math.round(state.awayWinProb * 1000) / 1000,
        });
        continue;
      }

      const at_ = totals.get(awayId);
      const ht = totals.get(homeId);
      at_.pointsFor += state.away;
      at_.pointsAgainst += state.home;
      ht.pointsFor += state.home;
      ht.pointsAgainst += state.away;
      if (state.away > state.home) { at_.wins++; ht.losses++; }
      else if (state.home > state.away) { ht.wins++; at_.losses++; }
      else { at_.ties++; ht.ties++; }
    }

    // Everything up to and including `startedThrough` is accounted for above,
    // as a result, a live score or a pending fixture. The simulator schedules
    // the untouched weeks after it, plus the pending stragglers.
    days.push({
      date: key,
      scheduleFromWeek: startedThrough + 1,
      pending: pending.filter((p) => p.week <= startedThrough).map(({ away, home }) => ({ away, home })),
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
      live,
    });
  }

  console.log(`  ${days.length} daily snapshots, ${days[0].date} to ${days[days.length - 1].date}`);
  return days;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
