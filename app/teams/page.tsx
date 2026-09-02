import Link from "next/link";
import { getMatchups, getSnapshot, getStandings } from "@/lib/sleeper";
import { buildLadder, getLadderThroughWeek, LADDER_WEEKS, type LadderResult } from "@/lib/games";
import { CURRENT_SEASON, getSeasonResults, HISTORY_SEASONS } from "@/lib/league-data";
import { Card, EmptyState, Hexagon, PageIntro, TeamAvatar } from "@/components/ui";
import type { Matchup, MatchupStatus, SeasonResult, SeasonStanding, Standing, TeamMeta } from "@/lib/types";

export const revalidate = 300;

const CURRENT_LADDER_TABS = [
  { key: "brief", label: "Breif" },
  { key: "extended", label: "Extended" },
  { key: "next5", label: "Next 5" },
  { key: "form", label: "Form" },
  { key: "week", label: "By Week" },
] as const;
const HISTORICAL_LADDER_TABS = [
  { key: "regular", label: "Regular" },
  { key: "final", label: "Final" },
  { key: "week", label: "By Week" },
] as const;

type CurrentLadderView = (typeof CURRENT_LADDER_TABS)[number]["key"];
type HistoricalLadderView = (typeof HISTORICAL_LADDER_TABS)[number]["key"];
type LadderView = CurrentLadderView | HistoricalLadderView;
type SortKey = "rank" | "wl" | "wins" | "losses" | "pct" | "for" | "against";
type SortDir = "asc" | "desc";

interface ScheduleItem {
  week: number;
  opponent: TeamMeta;
  homeAway: "vs" | "@";
  status: MatchupStatus;
}

interface FormItem {
  week: number;
  result: "W" | "L" | "T";
  pointsFor: number;
  pointsAgainst: number;
}

interface LadderRow {
  key: string;
  rank: number;
  href?: string;
  team?: TeamMeta;
  name: string;
  sub: string;
  wins: number;
  losses: number;
  ties: number;
  pct: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: string;
  nextFive: ScheduleItem[];
  form: FormItem[];
}

export default async function LadderPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; ladder?: string; week?: string; sort?: string; dir?: string }>;
}) {
  const snapshot = getSnapshot();
  const {
    season: seasonParam,
    ladder: ladderParam,
    week: weekParam,
    sort: sortParam,
    dir: dirParam,
  } = await searchParams;
  const currentSeason = snapshot.season || CURRENT_SEASON;
  const seasons = [currentSeason, ...[...HISTORY_SEASONS].reverse()];
  const requestedSeason = Number(seasonParam);
  const season = seasons.includes(requestedSeason) ? requestedSeason : seasons[0];
  const view = viewForSeason(season, currentSeason, ladderParam);
  // A past season rewinds to any week; the live one only as far as we have played.
  const lastWeek = season === currentSeason ? clamp(snapshot.currentWeek, 1, LADDER_WEEKS) : LADDER_WEEKS;
  const week = clamp(Number(weekParam) || lastWeek, 1, lastWeek);
  const historical = getSeasonResults().find((s) => s.season === season);
  const standings = season === currentSeason && view !== "week" ? await getStandings() : [];
  const matchupWeeks =
    season === currentSeason && needsCurrentMatchups(view)
      ? await loadMatchupsForWeeks(currentMatchupWeeks(snapshot.currentWeek, view, week))
      : new Map<number, Matchup[]>();
  const currentContext =
    season === currentSeason && view !== "week" ? buildCurrentContext(matchupWeeks, snapshot.currentWeek) : new Map();

  const sort: SortKey = (["rank", "wl", "wins", "losses", "pct", "for", "against"] as const).includes(sortParam as SortKey)
    ? (sortParam as SortKey)
    : "rank";
  const dir: SortDir = dirParam === "asc" || dirParam === "desc" ? dirParam : defaultSortDir(sort);

  const playoffCutoff = playoffCutoffForSeason(season);

  let rows: LadderRow[] | null = null;
  if (view === "week") {
    const ladder =
      season === currentSeason ? buildLadder(playedResults(matchupWeeks)) : await getLadderThroughWeek(season, week);
    if (ladder.length) rows = normalizeHistorical(ladder);
  } else if (season === currentSeason) {
    if (standings.length) rows = normalizeCurrent(standings, currentContext);
  } else if (historical) {
    const historicalView = isHistoricalLadderView(view) ? view : defaultHistoricalViewForSeason(season);
    rows = normalizeHistorical(historicalView === "regular" ? regularSeasonRows(historical) : historical.finalStandings);
  }

  const sortedRows = rows ? sortRows(rows, sort, dir) : null;

  return (
    <div>
      <PageIntro title="Ladder" subtitle={ladderSubtitle(season, view, week)} />

      <SeasonTabs seasons={seasons} active={season} view={view} week={week} currentSeason={currentSeason} />
      {season === currentSeason ? (
        <CurrentLadderSwitch season={season} active={isCurrentLadderView(view) ? view : "brief"} week={week} />
      ) : (
        <HistoricalLadderSwitch season={season} active={isHistoricalLadderView(view) ? view : "final"} week={week} />
      )}
      {view === "week" && <WeekTabs season={season} active={week} lastWeek={lastWeek} sort={sort} dir={dir} />}

      {sortedRows ? (
        <LadderTable
          rows={sortedRows}
          playoffCutoff={playoffCutoff}
          sort={sort}
          dir={dir}
          season={season}
          view={view}
          week={week}
        />
      ) : (
        <EmptyState>
          No {season} {emptyViewLabel(view, week)} ladder is available{season === currentSeason ? " yet" : ""}.
        </EmptyState>
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return max;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

/** Current-season matchups that have actually been played, in ladder terms. */
function playedResults(matchupsByWeek: Map<number, Matchup[]>): LadderResult[] {
  const results: LadderResult[] = [];
  for (const [week, matchups] of matchupsByWeek) {
    for (const game of matchups) {
      if (!game.home.score && !game.away.score) continue;
      for (const [self, opponent] of [
        [game.home, game.away],
        [game.away, game.home],
      ] as const) {
        results.push({
          key: String(self.team.id),
          name: self.team.name,
          team: self.team,
          week,
          pointsFor: self.score,
          pointsAgainst: opponent.score,
        });
      }
    }
  }
  return results;
}

function normalizeCurrent(standings: Standing[], context: Map<number, Pick<LadderRow, "nextFive" | "form">>): LadderRow[] {
  return standings.map((s) => ({
    key: String(s.team.id),
    rank: s.rank,
    href: s.team.id > 0 ? `/teams/${s.team.id}` : undefined,
    team: s.team,
    name: s.team.name,
    sub: s.team.manager,
    wins: s.wins,
    losses: s.losses,
    ties: s.ties,
    pct: s.pct,
    pointsFor: s.pointsFor,
    pointsAgainst: s.pointsAgainst,
    streak: s.streak,
    nextFive: context.get(s.team.id)?.nextFive ?? [],
    form: context.get(s.team.id)?.form ?? [],
  }));
}

function normalizeHistorical(standings: SeasonStanding[]): LadderRow[] {
  return standings.map((row) => ({
    key: `${row.rank}-${row.name}`,
    rank: row.rank,
    href: row.team && row.team.id > 0 ? `/teams/${row.team.id}` : undefined,
    team: row.team,
    name: row.name,
    sub: row.team && row.team.name !== row.name ? `Now ${row.team.name}` : row.team?.manager ?? "Historical team",
    wins: row.wins,
    losses: row.losses,
    ties: row.ties,
    pct: row.winPct,
    pointsFor: row.pointsFor,
    pointsAgainst: row.pointsAgainst,
    streak: row.streak,
    nextFive: [],
    form: [],
  }));
}

function sortRows(rows: LadderRow[], sort: SortKey, dir: SortDir): LadderRow[] {
  const sign = dir === "asc" ? 1 : -1;
  const sorted = [...rows].sort((a, b) => {
    switch (sort) {
      case "wl":
        return (a.wins - b.wins) * sign || (b.losses - a.losses) * sign;
      case "wins":
        return (a.wins - b.wins) * sign || (a.pointsFor - b.pointsFor) * sign;
      case "losses":
        return (a.losses - b.losses) * sign || (b.pointsFor - a.pointsFor) * sign;
      case "pct":
        return (a.pct - b.pct) * sign;
      case "for":
        return (a.pointsFor - b.pointsFor) * sign;
      case "against":
        return (a.pointsAgainst - b.pointsAgainst) * sign;
      default:
        return (a.rank - b.rank) * sign;
    }
  });
  return sorted;
}

function defaultViewForSeason(season: number, currentSeason: number): LadderView {
  return season === currentSeason ? "brief" : defaultHistoricalViewForSeason(season);
}

function defaultHistoricalViewForSeason(season: number): HistoricalLadderView {
  void season;
  return "final";
}

function viewForSeason(season: number, currentSeason: number, rawView?: string): LadderView {
  if (season === currentSeason) return isCurrentLadderView(rawView) ? rawView : defaultViewForSeason(season, currentSeason);
  return isHistoricalLadderView(rawView) ? rawView : defaultViewForSeason(season, currentSeason);
}

function compatibleViewForSeason(view: LadderView, season: number, currentSeason: number): LadderView {
  if (season === currentSeason) return isCurrentLadderView(view) ? view : defaultViewForSeason(season, currentSeason);
  return isHistoricalLadderView(view) ? view : defaultViewForSeason(season, currentSeason);
}

function isCurrentLadderView(value: unknown): value is CurrentLadderView {
  return CURRENT_LADDER_TABS.some((tab) => tab.key === value);
}

function isHistoricalLadderView(value: unknown): value is HistoricalLadderView {
  return HISTORICAL_LADDER_TABS.some((tab) => tab.key === value);
}

function needsCurrentMatchups(view: LadderView): boolean {
  return view === "next5" || view === "form" || view === "week";
}

function defaultSortDir(sort: SortKey): SortDir {
  return sort === "rank" || sort === "losses" ? "asc" : "desc";
}

function ladderHref(season: number, view: LadderView, week: number, sort?: SortKey, dir?: SortDir): string {
  const params = new URLSearchParams({ season: String(season), ladder: view });
  if (view === "week") params.set("week", String(week));
  if (sort && dir) {
    params.set("sort", sort);
    params.set("dir", dir);
  }
  return `/teams?${params}`;
}

function seasonHref(season: number, view: LadderView, week: number, currentSeason: number): string {
  const defaultView = defaultViewForSeason(season, currentSeason);
  const nextView = compatibleViewForSeason(view, season, currentSeason);
  return nextView === defaultView ? `/teams?season=${season}` : ladderHref(season, nextView, week);
}

function SeasonTabs({
  seasons,
  active,
  view,
  week,
  currentSeason,
}: {
  seasons: number[];
  active: number;
  view: LadderView;
  week: number;
  currentSeason: number;
}) {
  return (
    <div className="mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {seasons.map((season) => (
        <Link
          key={season}
          href={seasonHref(season, view, week, currentSeason)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 font-cond text-sm font-semibold transition-colors ${
            season === active ? "bg-teal text-white" : "bg-card text-text-muted hover:bg-card-hover"
          }`}
        >
          {season}
        </Link>
      ))}
    </div>
  );
}

function CurrentLadderSwitch({ season, active, week }: { season: number; active: CurrentLadderView; week: number }) {
  return (
    <div className="mb-3 grid grid-cols-5 gap-1 rounded-lg bg-section p-1">
      {CURRENT_LADDER_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={ladderHref(season, tab.key, week)}
          className={`rounded-md px-1 py-2 text-center font-cond text-xs font-semibold uppercase tracking-wide transition-colors sm:text-sm ${
            active === tab.key ? "bg-card text-text shadow-sm" : "text-text-muted hover:text-text"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

function HistoricalLadderSwitch({ season, active, week }: { season: number; active: HistoricalLadderView; week: number }) {
  return (
    <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-section p-1">
      {HISTORICAL_LADDER_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={ladderHref(season, tab.key, week)}
          className={`rounded-md px-1 py-2 text-center font-cond text-xs font-semibold uppercase tracking-wide transition-colors sm:text-sm ${
            active === tab.key ? "bg-card text-text shadow-sm" : "text-text-muted hover:text-text"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

/** Week 1-14 picker — the ladder as it stood after that week's games. */
function WeekTabs({
  season,
  active,
  lastWeek,
  sort,
  dir,
}: {
  season: number;
  active: number;
  lastWeek: number;
  sort: SortKey;
  dir: SortDir;
}) {
  return (
    <div className="mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {Array.from({ length: lastWeek }, (_, i) => i + 1).map((week) => (
        <Link
          key={week}
          href={ladderHref(season, "week", week, sort, dir)}
          scroll={false}
          className={`shrink-0 rounded-full px-3 py-1.5 font-cond text-sm font-semibold transition-colors ${
            week === active ? "bg-teal text-white" : "bg-card text-text-muted hover:bg-card-hover"
          }`}
        >
          W{week}
        </Link>
      ))}
    </div>
  );
}

function playoffCutoffForSeason(season: number): number {
  return season >= 2023 ? 8 : 6;
}

function regularSeasonRows(season: SeasonResult): SeasonStanding[] {
  return [...season.finalStandings]
    .sort((a, b) => b.winPct - a.winPct || b.pointsFor - a.pointsFor || a.pointsAgainst - b.pointsAgainst)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function currentMatchupWeeks(currentWeek: number, view: LadderView, week: number): number[] {
  if (view === "week") {
    return Array.from({ length: clamp(week, 1, LADDER_WEEKS) }, (_, i) => i + 1);
  }
  if (view === "next5") {
    const start = Math.min(Math.max(currentWeek, 1), LADDER_WEEKS);
    return Array.from({ length: 5 }, (_, i) => start + i).filter((week) => week <= LADDER_WEEKS);
  }
  if (view === "form") {
    const end = Math.min(Math.max(currentWeek - 1, 0), LADDER_WEEKS);
    const start = Math.max(1, end - 4);
    return end >= start ? Array.from({ length: end - start + 1 }, (_, i) => start + i) : [];
  }
  return [];
}

async function loadMatchupsForWeeks(weeks: number[]): Promise<Map<number, Matchup[]>> {
  const entries = await Promise.all(weeks.map(async (week) => [week, await getMatchups(week)] as const));
  return new Map(entries);
}

function buildCurrentContext(matchupsByWeek: Map<number, Matchup[]>, currentWeek: number): Map<number, Pick<LadderRow, "nextFive" | "form">> {
  const context = new Map<number, Pick<LadderRow, "nextFive" | "form">>();

  const ensure = (teamId: number) => {
    const existing = context.get(teamId);
    if (existing) return existing;
    const next: Pick<LadderRow, "nextFive" | "form"> = { nextFive: [], form: [] };
    context.set(teamId, next);
    return next;
  };

  for (const [week, matchups] of matchupsByWeek) {
    for (const matchup of matchups) {
      const sides = [
        { self: matchup.away, opponent: matchup.home, homeAway: "@" as const },
        { self: matchup.home, opponent: matchup.away, homeAway: "vs" as const },
      ];

      for (const side of sides) {
        const row = ensure(side.self.team.id);
        if (week >= currentWeek) {
          row.nextFive.push({
            week,
            opponent: side.opponent.team,
            homeAway: side.homeAway,
            status: matchup.status,
          });
        } else if (side.self.score || side.opponent.score) {
          row.form.push({
            week,
            result: resultLetter(side.self.score, side.opponent.score),
            pointsFor: side.self.score,
            pointsAgainst: side.opponent.score,
          });
        }
      }
    }
  }

  for (const row of context.values()) {
    row.nextFive.sort((a, b) => a.week - b.week);
    row.form.sort((a, b) => b.week - a.week);
  }

  return context;
}

function resultLetter(pointsFor: number, pointsAgainst: number): FormItem["result"] {
  if (pointsFor > pointsAgainst) return "W";
  if (pointsFor < pointsAgainst) return "L";
  return "T";
}

function ladderSubtitle(season: number, view: LadderView, week: number): string {
  if (view === "week") return `${season} ladder after week ${week}`;
  if (view === "regular") return `${season} regular season ladder`;
  if (view === "final") return `${season} final ladder`;
  const label = CURRENT_LADDER_TABS.find((tab) => tab.key === view)?.label ?? "Breif";
  return `${season} ${label.toLowerCase()} ladder`;
}

function emptyViewLabel(view: LadderView, week: number): string {
  if (view === "week") return `week ${week}`;
  if (view === "regular") return "regular season";
  if (view === "final") return "final";
  return CURRENT_LADDER_TABS.find((tab) => tab.key === view)?.label.toLowerCase() ?? "breif";
}

function LadderTable({
  rows,
  playoffCutoff,
  sort,
  dir,
  season,
  view,
  week,
}: {
  rows: LadderRow[];
  playoffCutoff: number;
  sort: SortKey;
  dir: SortDir;
  season: number;
  view: LadderView;
  week: number;
}) {
  const rankOrder = sort === "rank" && dir === "asc";
  return (
    <Card>
      <LadderHeader sort={sort} dir={dir} season={season} view={view} week={week} />
      {rows.map((row, i) => {
        const rowView = (
          <LadderRowView key={row.key} row={row} index={i} view={view} playoffCutoff={playoffCutoff} />
        );
        // The cutoff band only reads correctly while the ladder is in rank order.
        return rankOrder && row.rank === playoffCutoff + 1 ? (
          <div key={row.key}>
            <div className="bg-bg px-4 py-3 font-cond text-base font-semibold text-text-muted">
              Out of playoffs if season ended today
            </div>
            {rowView}
          </div>
        ) : (
          rowView
        );
      })}
      {!rankOrder && (
        <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-xs text-text-muted">
          <span className="hexagon inline-block h-3.5 w-3 bg-teal" /> Top {playoffCutoff} make the playoffs
        </div>
      )}
    </Card>
  );
}

function LadderRowView({
  row,
  index,
  view,
  playoffCutoff,
}: {
  row: LadderRow;
  index: number;
  view: LadderView;
  playoffCutoff: number;
}) {
  const inPlayoffs = row.rank <= playoffCutoff;
  const content = (
    <>
      {/* rank rail — tinted for playoff spots, muted once you're out */}
      <span
        className={`-my-2.5 flex w-14 shrink-0 items-center justify-center self-stretch ${
          inPlayoffs ? "bg-teal/12" : "bg-section"
        }`}
      >
        <Hexagon value={row.rank} tone={inPlayoffs ? "teal" : "grey"} />
      </span>
      {row.team ? <TeamAvatar team={row.team} size="md" /> : <span className="h-11 w-11 shrink-0 rounded-full bg-section" />}
      <div className="min-w-0 flex-1">
        <div className="truncate font-cond text-lg font-semibold leading-tight">{row.name}</div>
        <div className="truncate text-xs text-text-muted">{row.sub}</div>
      </div>
      {view === "brief" ? (
        <>
          <RecordCell wins={row.wins} losses={row.losses} ties={row.ties} />
          <PointsCell points={row.pointsFor} />
        </>
      ) : view === "extended" ? (
        <>
          <NumberCell value={row.wins} />
          <NumberCell value={row.losses} muted />
          <PointsCell points={row.pointsFor} compact />
          <AgainstCell points={row.pointsAgainst} compact />
        </>
      ) : view === "next5" ? (
        <NextFiveCell items={row.nextFive} />
      ) : view === "form" ? (
        <FormCell items={row.form} />
      ) : (
        <>
          <RecordCell wins={row.wins} losses={row.losses} ties={row.ties} />
          <PctCell pct={row.pct} />
          <PointsCell points={row.pointsFor} />
          <AgainstCell points={row.pointsAgainst} />
          <StreakCell streak={row.streak} />
        </>
      )}
    </>
  );

  const className = `flex items-center gap-3 py-2.5 pr-3 ${index % 2 ? "bg-card" : "bg-row"} ${
    row.href ? "hover:bg-card-hover" : ""
  }`;

  return row.href ? (
    <Link href={row.href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function sortHref(key: SortKey, sort: SortKey, dir: SortDir, season: number, view: LadderView, week: number): string {
  const nextDir: SortDir = sort === key ? (dir === "asc" ? "desc" : "asc") : defaultSortDir(key);
  return ladderHref(season, view, week, key, nextDir);
}

function SortLabel({
  label,
  sortKey,
  sort,
  dir,
  season,
  view,
  week,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortKey;
  dir: SortDir;
  season: number;
  view: LadderView;
  week: number;
}) {
  const active = sort === sortKey;
  return (
    <Link
      href={sortHref(sortKey, sort, dir, season, view, week)}
      scroll={false}
      className={`flex items-center gap-0.5 ${active ? "text-teal" : "hover:text-text"}`}
    >
      {label}
      {active && <span className="text-[9px]">{dir === "asc" ? "▲" : "▼"}</span>}
    </Link>
  );
}

function LadderHeader({
  sort,
  dir,
  season,
  view,
  week,
}: {
  sort: SortKey;
  dir: SortDir;
  season: number;
  view: LadderView;
  week: number;
}) {
  if (view === "brief") {
    return (
      <div className="flex items-center gap-3 border-b border-border bg-section py-2 pr-3 font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted sm:text-sm">
        <span className="-my-2 flex w-14 shrink-0 items-center justify-center self-stretch bg-teal/12 text-text">
          <SortLabel label="Rank" sortKey="rank" sort={sort} dir={dir} season={season} view={view} week={week} />
        </span>
        <span className="flex-1 pl-11">Team</span>
        <span className="w-12 text-center">
          <SortLabel label="W-L" sortKey="wl" sort={sort} dir={dir} season={season} view={view} week={week} />
        </span>
        <span className="w-14 text-right">
          <span className="flex justify-end">
            <SortLabel label="PF" sortKey="for" sort={sort} dir={dir} season={season} view={view} week={week} />
          </span>
        </span>
      </div>
    );
  }

  if (view === "extended") {
    return (
      <div className="flex items-center gap-3 border-b border-border bg-section py-2 pr-3 font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted sm:text-sm">
        <span className="-my-2 flex w-14 shrink-0 items-center justify-center self-stretch bg-teal/12 text-text">
          <SortLabel label="Rank" sortKey="rank" sort={sort} dir={dir} season={season} view={view} week={week} />
        </span>
        <span className="flex-1 pl-11">Team</span>
        <span className="w-8 text-center">
          <SortLabel label="W" sortKey="wins" sort={sort} dir={dir} season={season} view={view} week={week} />
        </span>
        <span className="w-8 text-center">
          <SortLabel label="L" sortKey="losses" sort={sort} dir={dir} season={season} view={view} week={week} />
        </span>
        <span className="w-12 text-right">
          <span className="flex justify-end">
            <SortLabel label="PF" sortKey="for" sort={sort} dir={dir} season={season} view={view} week={week} />
          </span>
        </span>
        <span className="w-12 text-right">
          <span className="flex justify-end">
            <SortLabel label="PA" sortKey="against" sort={sort} dir={dir} season={season} view={view} week={week} />
          </span>
        </span>
      </div>
    );
  }

  if (view === "next5") {
    return (
      <div className="flex items-center gap-3 border-b border-border bg-section py-2 pr-3 font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted sm:text-sm">
        <span className="-my-2 flex w-14 shrink-0 items-center justify-center self-stretch bg-teal/12 text-text">
          <SortLabel label="Rank" sortKey="rank" sort={sort} dir={dir} season={season} view={view} week={week} />
        </span>
        <span className="flex-1 pl-11">Team</span>
        <span className="w-36 text-right sm:w-48">Next 5</span>
      </div>
    );
  }

  if (view === "form") {
    return (
      <div className="flex items-center gap-3 border-b border-border bg-section py-2 pr-3 font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted sm:text-sm">
        <span className="-my-2 flex w-14 shrink-0 items-center justify-center self-stretch bg-teal/12 text-text">
          <SortLabel label="Rank" sortKey="rank" sort={sort} dir={dir} season={season} view={view} week={week} />
        </span>
        <span className="flex-1 pl-11">Team</span>
        <span className="w-36 text-right sm:w-48">Form</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 border-b border-border bg-section py-2 pr-3 font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted sm:gap-3 sm:text-sm">
      <span className="-my-2 flex w-14 shrink-0 items-center justify-center self-stretch bg-teal/12 text-text">
        <SortLabel label="Rank" sortKey="rank" sort={sort} dir={dir} season={season} view={view} week={week} />
      </span>
      <span className="flex-1 pl-11">Team</span>
      <span className="w-12 text-center">
        <SortLabel label="W-L" sortKey="wl" sort={sort} dir={dir} season={season} view={view} week={week} />
      </span>
      <span className="hidden w-12 text-center sm:block">
        <SortLabel label="Pct" sortKey="pct" sort={sort} dir={dir} season={season} view={view} week={week} />
      </span>
      <span className="w-14 text-right">
        <span className="flex justify-end">
          <SortLabel label="For" sortKey="for" sort={sort} dir={dir} season={season} view={view} week={week} />
        </span>
      </span>
      <span className="hidden w-14 text-right sm:block">
        <span className="flex justify-end">
          <SortLabel label="Against" sortKey="against" sort={sort} dir={dir} season={season} view={view} week={week} />
        </span>
      </span>
      <span className="hidden w-12 text-center sm:block">Stk</span>
    </div>
  );
}

function NumberCell({ value, muted = false }: { value: number; muted?: boolean }) {
  return (
    <div className={`w-8 text-center font-cond text-lg font-semibold tabular-nums ${muted ? "text-text-muted" : ""}`}>
      {value}
    </div>
  );
}

function RecordCell({ wins, losses, ties }: { wins: number; losses: number; ties: number }) {
  return (
    <div className="w-12 text-center font-cond text-lg font-semibold tabular-nums">
      {wins}-{losses}
      {ties ? `-${ties}` : ""}
    </div>
  );
}

function PointsCell({ points, compact = false }: { points: number; compact?: boolean }) {
  return (
    <div className={`${compact ? "w-12" : "w-14"} text-right font-cond text-lg font-semibold tabular-nums`}>
      {points.toFixed(1)}
    </div>
  );
}

function PctCell({ pct }: { pct: number }) {
  return (
    <div className="hidden w-12 text-center font-cond text-sm font-semibold tabular-nums text-text-muted sm:block">
      {pct.toFixed(3).replace(/^0/, "")}
    </div>
  );
}

function StreakCell({ streak }: { streak: string }) {
  const isWin = streak.trim().toUpperCase().startsWith("W");
  const isLoss = streak.trim().toUpperCase().startsWith("L");
  return (
    <div
      className={`hidden w-12 text-center font-cond text-sm font-semibold tabular-nums sm:block ${
        isWin ? "text-teal" : isLoss ? "text-red-500" : "text-text-muted"
      }`}
    >
      {streak || "—"}
    </div>
  );
}

function AgainstCell({ points, compact = false }: { points: number; compact?: boolean }) {
  return (
    <div className={`${compact ? "w-12" : "hidden w-14 sm:block"} text-right font-cond text-sm font-semibold tabular-nums text-text-muted`}>
      {points.toFixed(1)}
    </div>
  );
}

function NextFiveCell({ items }: { items: ScheduleItem[] }) {
  if (!items.length) return <div className="w-36 text-right text-sm font-semibold text-text-muted sm:w-48">-</div>;
  return (
    <div className="flex w-36 justify-end gap-1 sm:w-48">
      {items.slice(0, 5).map((item) => (
        <span
          key={`${item.week}-${item.opponent.id}`}
          title={`Week ${item.week} ${item.homeAway} ${item.opponent.name}`}
          className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-section"
        >
          {item.opponent.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.opponent.logo}
              alt={`${item.opponent.name} logo`}
              className="h-7 w-7 rounded-full object-cover"
              suppressHydrationWarning
            />
          ) : (
            <span
              className="grid h-7 w-7 place-items-center rounded-full font-cond text-[10px] font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${item.opponent.primary}, ${item.opponent.secondary})` }}
            >
              {item.opponent.abbrev}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function FormCell({ items }: { items: FormItem[] }) {
  if (!items.length) return <div className="w-36 text-right text-sm font-semibold text-text-muted sm:w-48">-</div>;
  return (
    <div className="flex w-36 justify-end gap-1 sm:w-48">
      {items.slice(0, 5).map((item) => (
        <span
          key={item.week}
          title={`Week ${item.week}: ${item.pointsFor.toFixed(1)}-${item.pointsAgainst.toFixed(1)}`}
          className={`grid h-6 w-6 place-items-center rounded font-cond text-xs font-bold ${
            item.result === "W" ? "bg-teal text-white" : item.result === "L" ? "bg-red-500 text-white" : "bg-section text-text-muted"
          }`}
        >
          {item.result}
        </span>
      ))}
    </div>
  );
}
