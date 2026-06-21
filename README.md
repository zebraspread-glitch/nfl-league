# MGL Fantasy

A private fantasy football website for the MGL league: live 2026 scoring,
standings, team pages, history and all-time records.

## Stack

- **Next.js 16** (App Router) + **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **ESPN Fantasy API** for the active season (server-side only)
- Scraped NFL.com data for completed historical seasons

## Getting Started

```bash
npm install
cp .env.local.example .env.local   # then fill in your ESPN values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The active season is 2026. Without ESPN credentials, current standings,
matchups and roster views show empty states; the historical 2021-2025 pages
still work from the scraped NFL.com data in `data/`.

## ESPN Credentials

Private ESPN leagues need three values, kept **server-side only** in `.env.local`:

| Variable          | What it is                                  |
| ----------------- | ------------------------------------------- |
| `ESPN_LEAGUE_ID`  | the `leagueId` from your league URL         |
| `ESPN_S2`         | the `espn_s2` browser cookie                |
| `ESPN_SWID`       | the `SWID` browser cookie (braces optional) |
| `ESPN_SEASON`     | season year (defaults to 2026)              |

These have **no `NEXT_PUBLIC_` prefix**, and all ESPN access lives in
[`lib/espn.ts`](lib/espn.ts), which starts with `import "server-only"`. The
cookies are therefore never bundled into client JavaScript. They only travel in
the server-to-ESPN request.

## Architecture

```text
lib/
  types.ts        Frontend-safe shared types (no secrets)
  teams.ts        Curated franchise metadata + colours
  league-data.ts  2026 constants + real 2021-2025 history aggregators
  espn.ts         Server-only ESPN fetcher: cookies + Next fetch cache
components/       Nav, cards, scoreboard tiles, standings table, UI primitives
app/
  page.tsx              /              live scoreboard / dashboard
  standings/            /standings     current ladder
  matchups/             /matchups      weekly matchups (?week=N)
  teams/                /teams         current and historical ladders
  teams/[teamId]/       /teams/:id     individual team + history
  drafts/               /drafts        historical draft results
  history/              /history       2021-2025 champions & final standings
  records/              /records       all-time records
  head-to-head/         /head-to-head  team vs team comparison (?a=&b=)
```

ESPN views used: `mStandings`, `mTeam`, `mMatchup`, `mMatchupScore`, `mRoster`.
Responses are cached via Next's `fetch` cache (`revalidate`). Missing config or
ESPN errors produce empty current-season data instead of local stand-ins.

## League History

MGL historical pages use real data scraped from NFL.com Fantasy league history.

```bash
node scripts/scrape-history.mjs   # -> data/history.json (2021-2025)
```

The scraper reads each season's regular-season standings (W-L-T, points
for/against) and final standings (playoff finish / champion). Because NFL lets
teams rename year to year and the league grew 8 to 10 to 12 teams, cross-season
identity is resolved by a hand-verified alias map in
[lib/franchises.ts](lib/franchises.ts). Re-run the scraper to refresh; edit the
alias map if a franchise mapping is wrong.

### Every Game + Player Scores

```bash
node scripts/scrape-games.mjs          # all seasons -> data/games/<season>.json
node scripts/scrape-games.mjs 2024     # one season
node scripts/scrape-games.mjs 2024 1   # one week
node scripts/scrape-drafts.mjs         # all seasons -> data/drafts/<season>.json
```

This reads every matchup's NFL.com "Game Center" boxscore for all historical
games from 2021-2025. Browse them at `/games` (by season/week) and
`/games/<id>` (full boxscore). Team pages list a franchise's real recent
historical games linking to boxscores.

The Scoreboard, Matchups and current Standings views are 2026-only and require
live ESPN data. Older seasons live under History, Records, Head to Head and
Every Game.
