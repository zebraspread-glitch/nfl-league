import Link from "next/link";
import { getSnapshot, getStandings } from "@/lib/sleeper";
import { CURRENT_SEASON, getSeasonResults, HISTORY_SEASONS } from "@/lib/league-data";
import { Card, EmptyState, Hexagon, PageIntro, TeamAvatar, rankBadgeTone } from "@/components/ui";
import type { SeasonResult, SeasonStanding, Standing, TeamMeta } from "@/lib/types";

export const revalidate = 300;

type LadderView = "regular" | "final";
type SortKey = "rank" | "wl" | "pct" | "for" | "against";
type SortDir = "asc" | "desc";

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
  const defaultView = defaultViewForSeason(season, currentSeason);
  const view: LadderView = ladderParam === "regular" || ladderParam === "final" ? ladderParam : defaultView;
  const historical = getSeasonResults().find((s) => s.season === season);
  const standings = season === currentSeason && view === "regular" ? await getStandings() : [];

  const sort: SortKey = (["rank", "wl", "pct", "for", "against"] as const).includes(sortParam as SortKey)
    ? (sortParam as SortKey)
    : "rank";
  const dir: SortDir = dirParam === "asc" || dirParam === "desc" ? dirParam : sort === "rank" ? "asc" : "desc";

  const playoffCutoff = season === currentSeason ? 6 : playoffCutoffForSeason(season);

  let rows: LadderRow[] | null = null;
  if (season === currentSeason) {
    if (view === "regular" && standings.length) rows = normalizeCurrent(standings);
  } else if (historical) {
    rows = normalizeHistorical(view === "regular" ? regularSeasonRows(historical) : historical.finalStandings);
  }

  const sortedRows = rows ? sortRows(rows, sort, dir) : null;

  return (
    <div>
      <PageIntro title="Ladder" subtitle={`${season} ${view === "regular" ? "regular season" : "final"} ladder`} />

      <SeasonTabs seasons={seasons} active={season} view={view} currentSeason={currentSeason} />
      <LadderSwitch season={season} active={view} />

      {sortedRows ? (
        <LadderTable rows={sortedRows} playoffCutoff={playoffCutoff} sort={sort} dir={dir} season={season} view={view} />
      ) : (
        <EmptyState>
          No {season === currentSeason ? currentSeason : season} {view === "regular" ? "regular season" : "final"} ladder
          is available{season === currentSeason ? " yet" : ""}.
        </EmptyState>
      )}
    </div>
  );
}

function normalizeCurrent(standings: Standing[]): LadderRow[] {
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
  }));
}

function sortRows(rows: LadderRow[], sort: SortKey, dir: SortDir): LadderRow[] {
  const sign = dir === "asc" ? 1 : -1;
  const sorted = [...rows].sort((a, b) => {
    switch (sort) {
      case "wl":
        return (a.wins - b.wins) * sign || (b.losses - a.losses) * sign;
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
  return season === currentSeason ? "regular" : "final";
}

function seasonHref(season: number, view: LadderView, currentSeason: number): string {
  const defaultView = defaultViewForSeason(season, currentSeason);
  return view === defaultView ? `/teams?season=${season}` : `/teams?season=${season}&ladder=${view}`;
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

function LadderSwitch({ season, active }: { season: number; active: LadderView }) {
  return (
    <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-section p-1">
      <Link
        href={`/teams?season=${season}&ladder=regular`}
        className={`rounded-md px-2 py-2 text-center font-cond text-sm font-semibold uppercase tracking-wide transition-colors ${
          active === "regular" ? "bg-card text-text shadow-sm" : "text-text-muted hover:text-text"
        }`}
      >
        Regular Season
      </Link>
      <Link
        href={`/teams?season=${season}&ladder=final`}
        className={`rounded-md px-2 py-2 text-center font-cond text-sm font-semibold uppercase tracking-wide transition-colors ${
          active === "final" ? "bg-card text-text shadow-sm" : "text-text-muted hover:text-text"
        }`}
      >
        Final
      </Link>
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
        <LadderRowView key={row.key} row={row} index={i} />
      ))}
      <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-xs text-text-muted">
        <span className="hexagon inline-block h-3.5 w-3 bg-teal" /> Top {playoffCutoff} make the playoffs
      </div>
    </Card>
  );
}

function LadderRowView({ row, index }: { row: LadderRow; index: number }) {
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
      <RecordCell wins={row.wins} losses={row.losses} ties={row.ties} />
      <PctCell pct={row.pct} />
      <PointsCell points={row.pointsFor} />
      <AgainstCell points={row.pointsAgainst} />
      <StreakCell streak={row.streak} />
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
  const nextDir: SortDir = sort === key ? (dir === "asc" ? "desc" : "asc") : key === "rank" ? "asc" : "desc";
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

function RecordCell({ wins, losses, ties }: { wins: number; losses: number; ties: number }) {
  return (
    <div className="w-12 text-center font-cond text-lg font-semibold tabular-nums">
      {wins}-{losses}
      {ties ? `-${ties}` : ""}
    </div>
  );
}

function PointsCell({ points }: { points: number }) {
  return (
    <div className="w-14 text-right font-cond text-lg font-semibold tabular-nums">
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

function AgainstCell({ points }: { points: number }) {
  return (
    <div className="hidden w-14 text-right font-cond text-sm font-semibold tabular-nums text-text-muted sm:block">
      {points.toFixed(1)}
    </div>
  );
}
