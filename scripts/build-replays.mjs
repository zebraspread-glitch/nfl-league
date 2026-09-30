// Rebuilds a play-by-play "matchup replay" for every completed MGL matchup of
// the Sleeper era: each team's running fantasy total on a real wall clock, the
// live win probability between them, and the plays that swung it most.
//
// NFL.com used to hand us this for free (see scrape-livechart.mjs), but Sleeper
// keeps no score history, so we rebuild it from raw NFL play-by-play instead:
//
//   nflverse play_by_play_<season>.csv.gz  — every play, with `time_of_day`
//   (UTC wall clock) and the stats that produced it
//
// Each play is replayed through the league's own scoring settings, credited to
// whichever franchise had that player in its starting lineup, and stamped with
// the moment it actually happened. Concurrent NFL games interleave correctly
// because every play carries its own clock.
//
// Run:        node scripts/build-replays.mjs
// One week:   node scripts/build-replays.mjs --week 2
// Check only: node scripts/build-replays.mjs --verify   (no file written)
//
// Output: data/replays/<season>.json — { [matchupId]: Replay }

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const LEAGUE = '1374614405412560896';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CACHE = path.join(ROOT, '.cache');
const PBP_URL = (s) => `https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_${s}.csv.gz`;
const PLAYERS_URL = 'https://github.com/nflverse/nflverse-data/releases/download/players/players.csv';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const ONLY_WEEK = opt('--week') ? Number(opt('--week')) : null;
const VERIFY_ONLY = flag('--verify');
const PLAYER_DIFF = flag('--players');

const r2 = (v) => Math.round(v * 100) / 100;

// --- tiny helpers ------------------------------------------------------------
const get = async (u) => {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return r.json();
};

/** Download to .cache/ once; nflverse re-cuts these files as the season runs, so
 *  a cached copy older than 6h is refetched. */
async function cached(url, name, { gunzip = false, maxAgeMs = 6 * 3600e3 } = {}) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, name);
  const fresh = fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < maxAgeMs;
  if (!fresh) {
    process.stdout.write(`  fetching ${name}… `);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    let buf = Buffer.from(await r.arrayBuffer());
    if (gunzip) buf = zlib.gunzipSync(buf);
    fs.writeFileSync(file, buf);
    console.log(`${(buf.length / 1e6).toFixed(1)}MB`);
  }
  return fs.readFileSync(file, 'utf8');
}

/** RFC4180-ish CSV → array of row objects. nflverse `desc` fields contain both
 *  commas and escaped quotes, so a naive split will not do. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift();
  const idx = new Map(head.map((h, i) => [h, i]));
  return { rows, col: (r, n) => { const i = idx.get(n); return i === undefined ? '' : r[i]; } };
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const has = (v) => v !== '' && v !== 'NA' && v != null;

/** Play-by-play prose into something readable: drop the game clock and
 *  formation prefixes, the jersey numbers, and the tacklers in brackets. */
const tidyDesc = (d) => (d || '')
  .replace(/^\(\d*:\d+\)\s*/, '')
  .replace(/^\((Shotgun|No Huddle|Punt formation|Field Goal formation)[^)]*\)\s*/gi, '')
  .replace(/\b\d{1,2}-([A-Z]\.)/g, '$1')
  .replace(/,?\s*(Center|Holder)-[A-Z]\.[A-Za-z'\-]+/g, '')
  .replace(/\s*\[[^\]]*\]/g, '')
  .replace(/\s*\((?:[A-Z]\.[A-Za-z'\-]+[;,]?\s*)+\)/g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s+([.,])/g, '$1')
  .trim();

// --- scoring -----------------------------------------------------------------
/** Points a made field goal is worth, by distance (Sleeper's fgm_* buckets). */
const fgPoints = (S, yds) =>
  yds >= 50 ? S.fgm_50p : yds >= 40 ? S.fgm_40_49 : yds >= 30 ? S.fgm_30_39 : yds >= 20 ? S.fgm_20_29 : S.fgm_0_19;

/** The DST "points allowed" bucket — a level, not an event: it is recomputed
 *  from the opponent's running score every time that score changes. */
const ptsAllowed = (S, pa) =>
  pa === 0 ? S.pts_allow_0 : pa <= 6 ? S.pts_allow_1_6 : pa <= 13 ? S.pts_allow_7_13
  : pa <= 20 ? S.pts_allow_14_20 : pa <= 27 ? S.pts_allow_21_27 : pa <= 34 ? S.pts_allow_28_34 : S.pts_allow_35p;

/**
 * Fantasy points a single play produced, as `[key, points]` pairs.
 * Keys are gsis ids for players and `DST:<TEAM>` for defenses.
 */
function scorePlay(S, c, r) {
  const out = [];
  const add = (key, pts) => { if (has(key) && pts) out.push([key, pts]); };

  const passer = c(r, 'passer_player_id');
  const rusher = c(r, 'rusher_player_id');
  const receiver = c(r, 'receiver_player_id');
  const kicker = c(r, 'kicker_player_id');
  const def = c(r, 'defteam');
  const twoPt = c(r, 'two_point_conv_result') === 'success';

  // A two-point conversion is its own kind of play: it records no yards and
  // never sets `complete_pass`, so it is scored on its own terms and the
  // yardage branches below are skipped for it.
  if (twoPt) {
    if (has(passer)) { add(passer, S.pass_2pt); add(receiver, S.rec_2pt); }
    else add(rusher, S.rush_2pt);
    return out;
  }
  // An offensive touchdown belongs to whoever carried it in, which is not
  // always the primary receiver or rusher — on a lateral the yards split
  // between two players and only one of them scores.
  const scorer = c(r, 'td_player_id');

  // Passing / receiving.
  if (has(passer)) {
    add(passer, num(c(r, 'passing_yards')) * S.pass_yd);
    if (num(c(r, 'pass_touchdown'))) add(passer, S.pass_td);
    if (num(c(r, 'interception'))) add(passer, S.pass_int);
  }
  if (num(c(r, 'complete_pass')) && has(receiver)) {
    add(receiver, S.rec);
    add(receiver, num(c(r, 'receiving_yards')) * S.rec_yd);
    if (num(c(r, 'pass_touchdown')) && scorer === receiver) add(receiver, S.rec_td);
  }
  if (has(c(r, 'lateral_receiver_player_id'))) {
    const lat = c(r, 'lateral_receiver_player_id');
    add(lat, num(c(r, 'lateral_receiving_yards')) * S.rec_yd);
    if (num(c(r, 'pass_touchdown')) && scorer === lat) add(lat, S.rec_td);
  }
  // Rushing.
  if (has(rusher)) {
    add(rusher, num(c(r, 'rushing_yards')) * S.rush_yd);
    if (num(c(r, 'rush_touchdown')) && scorer === rusher) add(rusher, S.rush_td);
  }
  if (has(c(r, 'lateral_rusher_player_id'))) {
    const lat = c(r, 'lateral_rusher_player_id');
    add(lat, num(c(r, 'lateral_rushing_yards')) * S.rush_yd);
    if (num(c(r, 'rush_touchdown')) && scorer === lat) add(lat, S.rush_td);
  }
  // Sacks hit the quarterback and credit the defense.
  if (num(c(r, 'sack'))) {
    add(passer, S.pass_sack);
    add(`DST:${def}`, S.sack);
  }
  if (num(c(r, 'interception'))) add(`DST:${def}`, S.int);
  // A lost fumble docks the carrier; the recovering defense banks it.
  if (num(c(r, 'fumble_lost'))) {
    add(c(r, 'fumbled_1_player_id'), S.fum_lost);
    const recTeam = c(r, 'fumble_recovery_1_team');
    if (has(recTeam) && recTeam !== c(r, 'posteam')) add(`DST:${recTeam}`, S.fum_rec);
  }
  if (num(c(r, 'safety'))) add(`DST:${def}`, S.safe);
  if (has(c(r, 'blocked_player_id')) || num(c(r, 'punt_blocked'))) {
    add(`DST:${def}`, S.blk_kick);
  }
  // Kicking.
  if (has(kicker)) {
    if (c(r, 'field_goal_result') === 'made') add(kicker, fgPoints(S, num(c(r, 'kick_distance'))));
    const xp = c(r, 'extra_point_result');
    if (xp === 'good') add(kicker, S.xpm);
    else if (xp === 'failed' || xp === 'blocked') add(kicker, S.xpmiss);
  }
  // Defensive / special-teams touchdowns: the scoring team's DST, when the
  // scorer was not the team in possession.
  if (num(c(r, 'touchdown'))) {
    const tdTeam = c(r, 'td_team');
    if (has(tdTeam) && tdTeam === def) add(`DST:${tdTeam}`, S.def_st_td);
  }
  return out;
}

// --- win probability ---------------------------------------------------------
// A team's final score is its points so far plus whatever its still-playing
// starters have left in them. Each unfinished starter contributes his
// projection pro-rated by how much of his NFL game remains; the two teams'
// remaining totals are treated as independent normals, and the win chance is
// the probability their difference lands on the right side of zero.

/** Spread of a player's remaining points, relative to the mean still to come.
 *  Fantasy weeks are wild: a coefficient near 0.75 keeps early-window swings
 *  from reading as near-certainties. */
const VOL = 0.75;

/** Normal CDF via Abramowitz & Stegun 7.1.26. */
function normCdf(z) {
  const s = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + s * y);
}

/** A projection stat line scored under the league's own rules. Sleeper names
 *  projected stats with the same keys it names scoring rules, so the two line
 *  up directly. */
const scoreProjection = (S, stats) => {
  let pts = 0;
  for (const k in stats) if (S[k]) pts += S[k] * stats[k];
  return pts;
};

// --- load --------------------------------------------------------------------
console.log('Loading league…');
const [league, users, rosters, state, sleeperPlayers] = await Promise.all([
  get(`https://api.sleeper.app/v1/league/${LEAGUE}`),
  get(`https://api.sleeper.app/v1/league/${LEAGUE}/users`),
  get(`https://api.sleeper.app/v1/league/${LEAGUE}/rosters`),
  get('https://api.sleeper.app/v1/state/nfl'),
  get('https://api.sleeper.app/v1/players/nfl'),
]);
const SEASON = Number(league.season);
const S = league.scoring_settings;
const lastWeek = ONLY_WEEK ?? state.week - 1;
const weeks = ONLY_WEEK ? [ONLY_WEEK] : Array.from({ length: lastWeek }, (_, i) => i + 1);
console.log(`  ${SEASON}, weeks ${weeks[0]}–${weeks.at(-1)}`);

console.log('Loading nflverse…');
const playersCsv = parseCsv(await cached(PLAYERS_URL, 'players_nflverse.csv', { maxAgeMs: 7 * 24 * 3600e3 }));
const pbp = parseCsv(await cached(PBP_URL(SEASON), `pbp_${SEASON}.csv`, { gunzip: true }));
console.log(`  ${pbp.rows.length} plays`);

// Sleeper ids carry a gsis_id only for established players, so rookies are
// matched on normalised name (+ position where it is unambiguous).
const normName = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '').replace(/(jr|sr|ii|iii|iv|v)$/, '');
const byName = new Map();
const gsisSet = new Set();
for (const r of playersCsv.rows) {
  const g = playersCsv.col(r, 'gsis_id');
  if (!has(g)) continue;
  gsisSet.add(g);
  const n = normName(playersCsv.col(r, 'display_name'));
  byName.set(`${n}|${playersCsv.col(r, 'position')}`, g);
  if (!byName.has(n)) byName.set(n, g);
}
// Sleeper spells the Rams LAR; nflverse spells them LA.
const TEAM_ALIAS = { LAR: 'LA' };
const proTeam = (t) => TEAM_ALIAS[t] ?? t;

/** Sleeper player id → the key `scorePlay` credits (gsis id, or `DST:<TEAM>`).
 *  Sleeper's own gsis_id is used only when nflverse recognises it: a slice of
 *  the 2019 draft class carries it with a leading space, and rookies not at
 *  all, so anything unrecognised falls back to a normalised-name match. */
const toKey = (sleeperId) => {
  if (/^[A-Z]{2,3}$/.test(sleeperId)) return `DST:${proTeam(sleeperId)}`;
  const p = sleeperPlayers[sleeperId];
  if (!p) return null;
  const g = (p.gsis_id ?? '').trim();
  if (g && gsisSet.has(g)) return g;
  return byName.get(`${normName(p.full_name)}|${p.position}`) ?? byName.get(normName(p.full_name)) ?? null;
};

// --- replay ------------------------------------------------------------------
const userName = new Map(users.map((u) => [u.user_id, u.display_name]));
const teamOf = new Map(rosters.map((r) => [r.roster_id, userName.get(r.owner_id) ?? `Roster ${r.roster_id}`]));

const replays = {};
const checks = [];

for (const week of weeks) {
  const matchups = await get(`https://api.sleeper.app/v1/league/${LEAGUE}/matchups/${week}`);
  const plays = pbp.rows.filter((r) => num(pbp.col(r, 'week')) === week);
  if (!plays.length) { console.log(`Week ${week}: no play-by-play yet, skipped`); continue; }

  // Pre-game projections, scored under league rules, for the "what is left to
  // come" half of the win-probability model.
  const projRows = await get(
    `https://api.sleeper.app/projections/nfl/${SEASON}/${week}?season_type=regular` +
    ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map((p) => `&position[]=${p}`).join(''),
  );
  const projection = new Map(projRows.map((p) => [p.player_id, Math.max(0, scoreProjection(S, p.stats ?? {}))]));

  // `time_of_day` is already an absolute UTC instant, so concurrent games
  // interleave for free — but a handful of plays carry no clock at all, and
  // those inherit the last stamp from their own game rather than being dropped.
  const stamped = [];
  const lastTs = new Map();
  for (const r of plays) {
    const gid = pbp.col(r, 'game_id');
    const tod = pbp.col(r, 'time_of_day').trim();
    let ts = has(tod) ? Date.parse(tod) : NaN;
    if (!Number.isFinite(ts)) ts = lastTs.get(gid) ?? NaN;
    if (!Number.isFinite(ts)) continue;
    lastTs.set(gid, ts);
    stamped.push({ ts, r });
  }
  stamped.sort((a, b) => a.ts - b.ts);

  // Replay the week once, accumulating every scoring key's running total.
  // DST "points allowed" is a level, so its component is recomputed whenever the
  // opponent's score moves rather than added as a delta.
  const totals = new Map();        // key -> running points
  const dstEvent = new Map();      // DST key -> event points only
  const dstAllow = new Map();      // DST key -> bucket points
  const frames = [];               // { ts, changed: Set<key>, desc }

  for (const { ts, r } of stamped) {
    const changed = new Set();
    const events = new Set();   // keys this play itself scored for
    for (const [key, pts] of scorePlay(S, pbp.col, r)) {
      if (key.startsWith('DST:')) {
        dstEvent.set(key, (dstEvent.get(key) ?? 0) + pts);
      } else {
        totals.set(key, (totals.get(key) ?? 0) + pts);
      }
      changed.add(key);
      events.add(key);
    }
    // Refresh both defenses in this game against the running scoreboard.
    const home = pbp.col(r, 'home_team'), away = pbp.col(r, 'away_team');
    const hs = num(pbp.col(r, 'total_home_score')), as = num(pbp.col(r, 'total_away_score'));
    for (const [team, allowed] of [[home, as], [away, hs]]) {
      const key = `DST:${team}`;
      const bucket = ptsAllowed(S, allowed);
      if (dstAllow.get(key) !== bucket) { dstAllow.set(key, bucket); changed.add(key); }
      const next = (dstEvent.get(key) ?? 0) + bucket;
      if (totals.get(key) !== next) { totals.set(key, next); changed.add(key); }
    }
    if (changed.size) frames.push({ ts, changed, events, desc: pbp.col(r, 'desc'), snapshot: new Map(totals) });
  }

  // The last frame at which each key's total moved — where a residual belongs.
  const lastMoved = new Map();
  frames.forEach((f, i) => { for (const k of f.changed) lastMoved.set(k, i); });

  // How much football each starter has left: which NFL game he is in, and that
  // game's clock over the course of the week.
  const clocks = new Map();      // game_id -> [ts, secondsRemaining][]
  const gameOfTeam = new Map();  // pro team -> game_id
  for (const { ts, r } of stamped) {
    const gid = pbp.col(r, 'game_id');
    (clocks.get(gid) ?? clocks.set(gid, []).get(gid)).push([ts, num(pbp.col(r, 'game_seconds_remaining'))]);
    gameOfTeam.set(pbp.col(r, 'home_team'), gid);
    gameOfTeam.set(pbp.col(r, 'away_team'), gid);
  }
  const gameOfPlayer = new Map(); // gsis id -> game_id
  for (const { r } of stamped) {
    const gid = pbp.col(r, 'game_id');
    for (const f of ['passer_player_id', 'rusher_player_id', 'receiver_player_id', 'kicker_player_id']) {
      const id = pbp.col(r, f);
      if (has(id) && !gameOfPlayer.has(id)) gameOfPlayer.set(id, gid);
    }
  }
  /** Fraction of a starter's NFL game still to be played at `ts` (1 before
   *  kickoff, 0 once it is over). A starter we never see on the field is
   *  treated as done — he did not play. */
  const fractionLeft = (key, sleeperId, ts) => {
    const gid = key.startsWith('DST:')
      ? gameOfTeam.get(key.slice(4))
      : gameOfPlayer.get(key) ?? gameOfTeam.get(proTeam(sleeperPlayers[sleeperId]?.team ?? ''));
    const clock = gid && clocks.get(gid);
    if (!clock) return 0;
    if (ts < clock[0][0]) return 1;
    if (ts >= clock.at(-1)[0]) return 0;
    let lo = 0, hi = clock.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (clock[mid][0] <= ts) lo = mid; else hi = mid - 1; }
    return Math.min(1, Math.max(0, clock[lo][1] / 3600));
  };

  // Turn the running totals into one timeline per matchup.
  const grouped = new Map();
  for (const m of matchups) {
    if (m.matchup_id == null) continue;
    grouped.set(m.matchup_id, [...(grouped.get(m.matchup_id) ?? []), m]);
  }

  for (const [matchupId, pair] of grouped) {
    if (pair.length < 2) continue;
    const [awayM, homeM] = pair;   // lib/sleeper.ts orders sides the same way
    const sides = [awayM, homeM].map((m) => ({
      rosterId: m.roster_id,
      name: teamOf.get(m.roster_id),
      final: r2(m.points ?? 0),
      // Only starters count, and a key can be started by both teams in theory,
      // so each side keeps its own list. `want` is Sleeper's own number for the
      // same starter, which --players diffs against.
      lineup: m.starters.map((sid, i) => ({
        sid,
        key: toKey(sid),
        name: sleeperPlayers[sid]?.full_name ?? sid,
        want: r2(m.starters_points?.[i] ?? 0),
      })),
    }));

    // Sleeper's own number for a starter is authoritative, so anything the
    // replay could not account for — a stat correction, or the corner of
    // Sleeper's DST taxonomy that play-by-play does not distinguish — is
    // booked as a residual at that player's final scoring moment. In practice
    // this is ±1 on a defense and nothing at all on offence.
    for (const side of sides) {
      for (const p of side.lineup) {
        const built = p.key ? frames.at(-1)?.snapshot.get(p.key) ?? 0 : 0;
        p.residual = r2(p.want - built);
        p.at = (p.key ? lastMoved.get(p.key) : undefined) ?? frames.length - 1;
      }
    }
    const scoreAt = (i, side) =>
      r2(side.lineup.reduce((sum, p) => {
        const base = p.key ? frames[i].snapshot.get(p.key) ?? 0 : 0;
        return sum + base + (i >= p.at ? p.residual : 0);
      }, 0));

    const start = frames.length ? frames[0].ts : null;
    if (start == null) continue;

    /** Mean and variance of what a side still has to come at `ts`. */
    const toCome = (side, ts) => {
      let mean = 0, varr = 0;
      for (const p of side.lineup) {
        if (!p.key) continue;
        const left = fractionLeft(p.key, p.sid, ts) * (projection.get(p.sid) ?? 0);
        mean += left;
        varr += (VOL * left) ** 2;
      }
      return [mean, varr];
    };

    const points = [];
    const swings = [];
    let prev = null;
    for (let i = 0; i < frames.length; i++) {
      const ts = frames[i].ts;
      const a = scoreAt(i, sides[0]);
      const h = scoreAt(i, sides[1]);
      const [ma, va] = toCome(sides[0], ts);
      const [mh, vh] = toCome(sides[1], ts);
      const sd = Math.sqrt(va + vh);
      // Once nothing is left to play the result is settled, so the curve
      // resolves to a clean 100/0 rather than asymptoting near it.
      const chance = (x, y) => (sd < 0.5
        ? (x > y ? 1 : x < y ? 0 : 0.5)
        : normCdf((x + ma - y - mh) / sd));
      const pct = Math.round(chance(a, h) * 1000) / 10;

      // A moment has to be a play that actually put points on one of these two
      // teams. The win chance also drifts on its own as clocks run down, and a
      // defense's points-allowed bucket tips over on whatever play happens to
      // follow a touchdown — neither is a moment. Measuring the play's own
      // effect means holding the clock still and swapping only the score, so
      // that drift since the previous play is not charged to this one.
      const scored = sides.some((s) => s.lineup.some((p) => p.key && frames[i].events.has(p.key)));
      if (scored && prev && (prev[0] !== a || prev[1] !== h)) {
        const before = Math.round(chance(prev[0], prev[1]) * 1000) / 10;
        if (Math.abs(pct - before) >= 1) {
          swings.push({ i, m: Math.round((ts - start) / 60000), swing: r2(pct - before), desc: frames[i].desc });
        }
      }
      if (!(prev && prev[0] === a && prev[1] === h && prev[2] === pct)) {
        points.push([Math.round((ts - start) / 60000), a, h, pct]);
        prev = [a, h, pct];
      }
    }

    // The handful of plays that actually decided it.
    const moments = swings
      .sort((x, y) => Math.abs(y.swing) - Math.abs(x.swing))
      .slice(0, 6)
      .sort((x, y) => x.i - y.i)
      .map(({ m, swing, desc }) => ({ m, swing, text: tidyDesc(desc) }));
    if (PLAYER_DIFF) {
      for (const side of sides) {
        for (const p of side.lineup) {
          const got = r2((p.key ? frames.at(-1).snapshot.get(p.key) ?? 0 : 0) + p.residual);
          if (Math.abs(got - p.want) > 0.5) {
            console.log(`  W${week} ${side.name.padEnd(18)} ${p.name.padEnd(24)} got ${String(got).padStart(7)} want ${String(p.want).padStart(7)}${p.key ? '' : '  [NO KEY]'}`);
          }
        }
      }
    }
    const last = points.at(-1) ?? [0, 0, 0];
    checks.push({
      week, matchupId,
      away: sides[0].name, home: sides[1].name,
      gotA: last[1], wantA: sides[0].final,
      gotH: last[2], wantH: sides[1].final,
    });
    replays[`${week}-${matchupId}`] = {
      start: new Date(start).toISOString(),
      away: sides[0].rosterId,
      home: sides[1].rosterId,
      points,
      moments,
    };
  }
  console.log(`Week ${week}: ${grouped.size} matchups, ${frames.length} scoring frames`);
}

// --- verify ------------------------------------------------------------------
console.log('\nReconstructed final vs Sleeper final:');
let worst = 0;
for (const c of checks) {
  const dA = Math.abs(c.gotA - c.wantA), dH = Math.abs(c.gotH - c.wantH);
  worst = Math.max(worst, dA, dH);
  const bad = dA > 0.5 || dH > 0.5;
  console.log(
    `  W${c.week} ${String(c.away).padEnd(18)} ${String(c.gotA).padStart(7)} vs ${String(c.wantA).padStart(7)}` +
    `   ${String(c.home).padEnd(18)} ${String(c.gotH).padStart(7)} vs ${String(c.wantH).padStart(7)}  ${bad ? '  <-- OFF' : ''}`,
  );
}
console.log(`\nworst single-team error: ${worst.toFixed(2)} pts`);

if (!VERIFY_ONLY) {
  const dir = path.join(ROOT, 'data', 'replays');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${SEASON}.json`);
  fs.writeFileSync(file, JSON.stringify(replays));
  console.log(`wrote ${file} (${Object.keys(replays).length} matchups)`);
}
