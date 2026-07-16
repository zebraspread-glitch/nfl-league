import Link from "next/link";
import { getMatchups, getSnapshot, getStandings } from "@/lib/sleeper";
import { CURRENT_SEASON, getSeasonResults, HISTORY_SEASONS } from "@/lib/league-data";
import { Card, EmptyState, Hexagon, PageIntro, TeamAvatar, rankBadgeTone } from "@/components/ui";
import type { Matchup, MatchupStatus, SeasonResult, SeasonStanding, Standing, TeamMeta } from "@/lib/types";

export const revalidate = 300;

const REGULAR_SEASON_WEEKS = 14;
const CURRENT_LADDER_TABS = [
  { key: "brief", label: "Breif" },
  { key: "extended", label: "Extended" },
  { key: "next5", label: "Next 5" },
  { key: "form", label: "Form" },
] as const;
const HISTORICAL_LADDER_TABS = [
  { key: "regular", label: "Regular Season" },
  { key: "final", label: "Final" },
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
  searchParams: Promise<{ season?: string; ladder?: string; sort?: string; dir?: string }>;
}) {
  const snapshot = getSnapshot();
  const { season: seasonParam, ladder: ladderParam, sort: sortParam, dir: dirParam } = await searchParams;
  const currentSeason = snapshot.season || CURRENT_SEASON;
  const seasons = [currentSeason, ...[...HISTORY_SEASONS].reverse()];
  const requestedSeason = Number(seasonParam);
  const season = seasons.includes(requestedSeason) ? requestedSeason : seasons[0];
  const view = viewForSeason(season, currentSeason, ladderParam);
  const historical = getSeasonResults().find((s) => s.season === season);
  const standings = season === currentSeason ? await getStandings() : [];
  const matchupWeeks =
    season === currentSeason && needsCurrentMatchups(view)
      ? await loadMatchupsForWeeks(currentMatchupWeeks(snapshot.currentWeek, view))
      : new Map<number, Matchup[]>();
  const currentContext = season === currentSeason ? buildCurrentContext(matchupWeeks, snapshot.currentWeek) : new Map();

  const sort: SortKey = (["rank", "wl", "wins", "losses", "pct", "for", "against"] as const).includes(sortParam as SortKey)
    ? (sortParam as SortKey)
    : "rank";
  const dir: SortDir = dirParam === "asc" || dirParam === "desc" ? dirParam : defaultSortDir(sort);

  const playoffCutoff = season === currentSeason ? 6 : playoffCutoffForSeason(season);

  let rows: LadderRow[] | null = null;
  if (season === currentSeason) {
    if (standings.length) rows = normalizeCurrent(standings, currentContext);
  } else if (historical) {
    const historicalView = isHistoricalLadderView(view) ? view : defaultHistoricalViewForSeason(season);
    rows = normalizeHistorical(historicalView === "regular" ? regularSeasonRows(historical) : historical.finalStandings);
  }

  const sortedRows = rows ? sortRows(rows, sort, dir) : null;

  return (
    <div>
      <PageIntro title="Ladder" subtitle={ladderSubtitle(season, view)} />

      <SeasonTabs seasons={seasons} active={season} view={view} currentSeason={currentSeason} />
      {season === currentSeason ? (
        <CurrentLadderSwitch season={season} active={isCurrentLadderView(view) ? view : "brief"} />
      ) : (
        <HistoricalLadderSwitch season={season} active={isHistoricalLadderView(view) ? view : "final"} />
      )}

      {sortedRows ? (
        <LadderTable rows={sortedRows} playoffCutoff={playoffCutoff} sort={sort} dir={dir} season={season} view={view} />
      ) : (
        <EmptyState>
          No {season === currentSeason ? currentSeason : season} {emptyViewLabel(view)} ladder
          is available{season === currentSeason ? " yet" : ""}.
        </EmptyState>
      )}
    </div>
  );
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
  return view === "next5" || view === "form";
}

function defaultSortDir(sort: SortKey): SortDir {
  return sort === "rank" || sort === "losses" ? "asc" : "desc";
}

function seasonHref(season: number, view: LadderView, currentSeason: number): string {
  const defaultView = defaultViewForSeason(season, currentSeason);
  const nextView = compatibleViewForSeason(view, season, currentSeason);
  return nextView === defaultView ? `/teams?season=${season}` : `/teams?season=${season}&ladder=${nextView}`;
}

function SeasonTabs({
  seasons,
  active,
  view,
  currentSeason,
}: {
  seasons: number[];
  active: number;
  view: LadderView;
  currentSeason: number;
}) {
  return (
    <div className="mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {seasons.map((season) => (
        <Link
          key={season}
          href={seasonHref(season, view, currentSeason)}
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

function CurrentLadderSwitch({ season, active }: { season: number; active: CurrentLadderView }) {
  return (
    <div className="mb-3 grid grid-cols-4 gap-1 rounded-lg bg-section p-1">
      {CURRENT_LADDER_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/teams?season=${season}&ladder=${tab.key}`}
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

function HistoricalLadderSwitch({ season, active }: { season: number; active: HistoricalLadderView }) {
  return (
    <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-section p-1">
      {HISTORICAL_LADDER_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/teams?season=${season}&ladder=${tab.key}`}
          className={`rounded-md px-2 py-2 text-center font-cond text-sm font-semibold uppercase tracking-wide transition-colors ${
            active === tab.key ? "bg-card text-text shadow-sm" : "text-text-muted hover:text-text"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

function playoffCutoffForSeason(season: number): number {
  return season >= 2023 && season <= 2025 ? 8 : 6;
}

function regularSeasonRows(season: SeasonResult): SeasonStanding[] {
  return [...season.finalStandings]
    .sort((a, b) => b.winPct - a.winPct || b.pointsFor - a.pointsFor || a.pointsAgainst - b.pointsAgainst)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function currentMatchupWeeks(currentWeek: number, view: LadderView): number[] {
  if (view === "next5") {
    const start = Math.min(Math.max(currentWeek, 1), REGULAR_SEASON_WEEKS);
    return Array.from({ length: 5 }, (_, i) => start + i).filter((week) => week <= REGULAR_SEASON_WEEKS);
  }
  if (view === "form") {
    const end = Math.min(Math.max(currentWeek - 1, 0), REGULAR_SEASON_WEEKS);
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

function ladderSubtitle(season: number, view: LadderView): string {
  if (view === "regular") return `${season} regular season ladder`;
  if (view === "final") return `${season} final ladder`;
  const label = CURRENT_LADDER_TABS.find((tab) => tab.key === view)?.label ?? "Breif";
  return `${season} ${label.toLowerCase()} ladder`;
}

function emptyViewLabel(view: LadderView): string {
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
}: {
  rows: LadderRow[];
  playoffCutoff: number;
  sort: SortKey;
  dir: SortDir;
  season: number;
  view: LadderView;
}) {
  return (
    <Card>
      <LadderHeader sort={sort} dir={dir} season={season} view={view} />
      {rows.map((row, i) => (
        <LadderRowView key={row.key} row={row} index={i} view={view} />
      ))}
      <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-xs text-text-muted">
        <span className="hexagon inline-block h-3.5 w-3 bg-teal" /> Top {playoffCutoff} make the playoffs
      </div>
    </Card>
  );
}

function LadderRowView({ row, index, view }: { row: LadderRow; index: number; view: LadderView }) {
  const content = (
    <>
      <span className="flex w-9 justify-center">
        <Hexagon value={row.rank} tone={rankBadgeTone(row.rank)} />
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

  const className = `flex items-center gap-3 px-3 py-2.5 ${index % 2 ? "bg-card" : "bg-row"} ${
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

function sortHref(key: SortKey, sort: SortKey, dir: SortDir, season: number, view: LadderView): string {
  const nextDir: SortDir = sort === key ? (dir === "asc" ? "desc" : "asc") : defaultSortDir(key);
  return `/teams?season=${season}&ladder=${view}&sort=${key}&dir=${nextDir}`;
}

function SortLabel({
  label,
  sortKey,
  sort,
  dir,
  season,
  view,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortKey;
  dir: SortDir;
  season: number;
  view: LadderView;
}) {
  const active = sort === sortKey;
  return (
    <Link
      href={sortHref(sortKey, sort, dir, season, view)}
      scroll={false}
      className={`flex items-center gap-0.5 ${active ? "text-teal" : "hover:text-text"}`}
    >
      {label}
      {active && <span className="text-[9px]">{dir === "asc" ? "▲" : "▼"}</span>}
    </Link>
  );
}

function LadderHeader({ sort, dir, season, view }: { sort: SortKey; dir: SortDir; season: number; view: LadderView }) {
  if (view === "brief") {
    return (
      <div className="flex items-center gap-3 border-b border-border bg-section px-3 py-2 font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted sm:text-sm">
        <span className="w-9 text-center">
          <SortLabel label="Rank" sortKey="rank" sort={sort} dir={dir} season={season} view={view} />
        </span>
        <span className="flex-1 pl-11">Team</span>
        <span className="w-12 text-center">
          <SortLabel label="W-L" sortKey="wl" sort={sort} dir={dir} season={season} view={view} />
        </span>
        <span className="w-14 text-right">
          <span className="flex justify-end">
            <SortLabel label="PF" sortKey="for" sort={sort} dir={dir} season={season} view={view} />
          </span>
        </span>
      </div>
    );
  }

  if (view === "extended") {
    return (
      <div className="flex items-center gap-3 border-b border-border bg-section px-3 py-2 font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted sm:text-sm">
        <span className="w-9 text-center">
          <SortLabel label="Rank" sortKey="rank" sort={sort} dir={dir} season={season} view={view} />
        </span>
        <span className="flex-1 pl-11">Team</span>
        <span className="w-8 text-center">
          <SortLabel label="W" sortKey="wins" sort={sort} dir={dir} season={season} view={view} />
        </span>
        <span className="w-8 text-center">
          <SortLabel label="L" sortKey="losses" sort={sort} dir={dir} season={season} view={view} />
        </span>
        <span className="w-12 text-right">
          <span className="flex justify-end">
            <SortLabel label="PF" sortKey="for" sort={sort} dir={dir} season={season} view={view} />
          </span>
        </span>
        <span className="w-12 text-right">
          <span className="flex justify-end">
            <SortLabel label="PA" sortKey="against" sort={sort} dir={dir} season={season} view={view} />
          </span>
        </span>
      </div>
    );
  }

  if (view === "next5") {
    return (
      <div className="flex items-center gap-3 border-b border-border bg-section px-3 py-2 font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted sm:text-sm">
        <span className="w-9 text-center">
          <SortLabel label="Rank" sortKey="rank" sort={sort} dir={dir} season={season} view={view} />
        </span>
        <span className="flex-1 pl-11">Team</span>
        <span className="w-36 text-right sm:w-48">Next 5</span>
      </div>
    );
  }

  if (view === "form") {
    return (
      <div className="flex items-center gap-3 border-b border-border bg-section px-3 py-2 font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted sm:text-sm">
        <span className="w-9 text-center">
          <SortLabel label="Rank" sortKey="rank" sort={sort} dir={dir} season={season} view={view} />
        </span>
        <span className="flex-1 pl-11">Team</span>
        <span className="w-36 text-right sm:w-48">Form</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 border-b border-border bg-section px-3 py-2 font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted sm:gap-3 sm:text-sm">
      <span className="w-9 text-center">
        <SortLabel label="Rank" sortKey="rank" sort={sort} dir={dir} season={season} view={view} />
      </span>
      <span className="flex-1 pl-11">Team</span>
      <span className="w-12 text-center">
        <SortLabel label="W-L" sortKey="wl" sort={sort} dir={dir} season={season} view={view} />
      </span>
      <span className="hidden w-12 text-center sm:block">
        <SortLabel label="Pct" sortKey="pct" sort={sort} dir={dir} season={season} view={view} />
      </span>
      <span className="w-14 text-right">
        <span className="flex justify-end">
          <SortLabel label="For" sortKey="for" sort={sort} dir={dir} season={season} view={view} />
        </span>
      </span>
      <span className="hidden w-14 text-right sm:block">
        <span className="flex justify-end">
          <SortLabel label="Against" sortKey="against" sort={sort} dir={dir} season={season} view={view} />
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
          className="grid h-6 w-6 shrink-0 place-items-center rounded bg-section font-cond text-[9px] font-semibold leading-none text-text-muted sm:w-8 sm:text-[10px]"
        >
          {item.opponent.abbrev}
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
