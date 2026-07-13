"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

export type PlayerAvailability = "FA" | "Taken" | "Waivers";

export interface PlayerStats {
  passAtt: number;
  passCmp: number;
  passYds: number;
  passTD: number;
  passInt: number;
  passSack: number;
  rushAtt: number;
  rushYds: number;
  rushTD: number;
  targets: number;
  rec: number;
  recYds: number;
  recTD: number;
  retTD: number;
  fumTD: number;
  twoPt: number;
  fumLost: number;
  fgMade: number;
  fgAtt: number;
  xpMade: number;
  defSack: number;
  defInt: number;
  defTD: number;
  points: number;
  projected: number;
  gp: number;
}

/** Wire format for a stat line: zero fields are omitted server-side so the
 *  pre-rendered payload stays under Vercel's ISR size limit. Expand with
 *  `statsFor` before reading individual fields. */
export type SparseStats = Partial<PlayerStats>;

interface FantasyAgainstValue {
  rank: number;
  avg: number;
}

export interface PlayerWeekMatchup {
  date?: string;
  gameId?: string;
  opponent?: string;
  team?: string;
}

export interface PlayerBrowserItem {
  playerId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  fullName: string;
  imageUrl?: string;
  isLogo: boolean;
  pos: string;
  proTeam: string;
  jerseyNumber?: number;
  height?: string;
  weight?: string;
  college?: string;
  opponent: string;
  gameId?: string;
  gameWeek?: number;
  gameDate?: string;
  byeWeek?: number;
  manager: string;
  status: PlayerAvailability;
  rosterId?: number;
  ownerTeamName?: string;
  ownerTeamAbbrev?: string;
  ownerTeamLogo?: string;
  ownerTeamPrimary?: string;
  ownerTeamSecondary?: string;
  matchup: string;
  posRank: number;
  projectionRank: number;
  injuryStatus?: string;
  sleeperStatus?: string;
  searchRank?: number;
  yearsExp?: number;
  age?: number;
  depthChartOrder?: number;
  addTrend: number;
  dropTrend: number;
  rosterAdds: number;
  rosterDrops: number;
  waiverAdds: number;
  fantasyAgainst?: FantasyAgainstValue;
  stats: SparseStats;
  projection: SparseStats;
  statsByPeriod: Record<string, SparseStats>;
  projectionsByPeriod: Record<string, SparseStats>;
  matchupsByPeriod: Record<string, PlayerWeekMatchup>;
}

type PlayerBrowserMode = "all" | "records" | "search";
type View = "PROJECTIONS" | "STATS" | "TRENDS";
type PositionFilter = "All Offense" | "QB" | "RB" | "WR" | "TE" | "W/R" | "K" | "DEF";
type StatusFilter = "All Available Players" | "All Players" | "Taken" | "Free Agents" | "On Waivers";
type SortDirection = "asc" | "desc";

interface SortState {
  key: string;
  direction: SortDirection;
}

interface Column {
  key: string;
  label: string;
  group?: string;
  blue?: boolean;
  strong?: boolean;
  wide?: boolean;
  decimals?: number;
  zeroDash?: boolean;
  get: (player: PlayerBrowserItem, stats: PlayerStats, actual: PlayerStats, projection: PlayerStats) => ReactNode;
}

const VIEWS: View[] = ["PROJECTIONS", "STATS", "TRENDS"];
const POSITIONS: PositionFilter[] = ["All Offense", "QB", "RB", "WR", "TE", "W/R", "K", "DEF"];
const STATUS_OPTIONS: StatusFilter[] = ["All Available Players", "All Players", "Taken", "Free Agents", "On Waivers"];
const PERIODS = ["2026 Season", "Last 4 WKS", "Last 2 WKS", "18", "17", "16", "15", "14", "13", "12", "11", "10", "9", "8", "7", "6", "5", "4", "3", "2", "1"];

const EMPTY_STATS: PlayerStats = {
  passAtt: 0,
  passCmp: 0,
  passYds: 0,
  passTD: 0,
  passInt: 0,
  passSack: 0,
  rushAtt: 0,
  rushYds: 0,
  rushTD: 0,
  targets: 0,
  rec: 0,
  recYds: 0,
  recTD: 0,
  retTD: 0,
  fumTD: 0,
  twoPt: 0,
  fumLost: 0,
  fgMade: 0,
  fgAtt: 0,
  xpMade: 0,
  defSack: 0,
  defInt: 0,
  defTD: 0,
  points: 0,
  projected: 0,
  gp: 0,
};

const DEFAULT_SORT: Record<View, SortState> = {
  PROJECTIONS: { key: "projected", direction: "desc" },
  STATS: { key: "points", direction: "desc" },
  TRENDS: { key: "trendNet", direction: "desc" },
};

// Rows rendered per "page" — keeps the pre-rendered HTML small (the full list is
// thousands of rows) and the initial paint fast; Show More reveals the rest.
const PAGE_SIZE = 50;

export function PlayerBrowser({ players, mode = "search" }: { players: PlayerBrowserItem[]; mode?: PlayerBrowserMode }) {
  void mode;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All Available Players");
  const [position, setPosition] = useState<PositionFilter>("All Offense");
  const [view, setView] = useState<View>("STATS");
  const [period, setPeriod] = useState("2025 Season");
  const [team, setTeam] = useState("All MGL Teams");
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT.STATS);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const teamOptions = useMemo(() => {
    const names = new Set(players.map((player) => player.ownerTeamName).filter((name): name is string => Boolean(name)));
    return ["All MGL Teams", ...[...names].sort((a, b) => a.localeCompare(b))];
  }, [players]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter((player) => {
        if (status === "All Players") return true;
        if (status === "Taken") return player.status === "Taken";
        if (status === "Free Agents") return player.status === "FA";
        if (status === "On Waivers") return player.status === "Waivers";
        return player.status !== "Taken";
      })
      .filter((player) => {
        if (team === "All MGL Teams") return true;
        return player.ownerTeamName === team;
      })
      .filter((player) => {
        if (position === "All Offense") return player.pos === "QB" || player.pos === "RB" || player.pos === "WR" || player.pos === "TE";
        if (position === "W/R") return player.pos === "WR" || player.pos === "RB";
        return player.pos === position;
      })
      .filter((player) => {
        if (!q) return true;
        return [
          player.displayName,
          player.fullName,
          player.proTeam,
          player.pos,
          player.manager,
          player.ownerTeamName,
          player.sleeperStatus,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => comparePlayers(a, b, sort, view, period));
  }, [players, period, position, query, sort, status, team, view]);

  const changeView = (next: View) => {
    setView(next);
    setSort(DEFAULT_SORT[next]);
  };

  const requestSort = (key: string) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  };

  return (
    <div className="-mx-3 -mt-3 min-h-screen bg-[#dfddd8] pb-28 text-[#353638]">
      <section className="px-3 pt-3">
        <div className="rounded-2xl bg-white px-3 py-3 shadow-[0_2px_0_rgba(0,0,0,0.22)]">
          <label className="flex h-9 items-center gap-2 rounded-lg border-2 border-[#d8d8d8] bg-white px-2.5">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name"
              className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[#333] outline-none placeholder:text-[#787878]"
            />
            <SearchIcon />
          </label>

          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            {VIEWS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => changeView(tab)}
                className={`h-7 rounded-md border-2 font-cond text-[13px] font-semibold uppercase ${
                  view === tab ? "border-[#b8dfe8] bg-[#d9f5fb] text-[#4a4d50]" : "border-[#eeeeee] bg-white text-[#666]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => setPosition(pos)}
                className={`h-7 rounded-md border-2 font-cond text-[12px] font-semibold uppercase ${
                  position === pos ? "border-[#b8dfe8] bg-[#d9f5fb] text-[#4a4d50]" : "border-[#eeeeee] bg-white text-[#5f6266]"
                }`}
              >
                {pos === "All Offense" ? "ALL" : pos}
              </button>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <SelectShell>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as StatusFilter)}
                className="h-full w-full appearance-none bg-transparent px-2.5 pr-7 font-cond text-[12px] font-bold text-[#2f3338] outline-none"
                aria-label="Player status"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </SelectShell>
            <SelectShell>
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="h-full w-full appearance-none bg-transparent px-2.5 pr-7 font-cond text-[12px] font-bold text-[#2f3338] outline-none"
                aria-label="Stats period"
              >
                {PERIODS.map((option) => (
                  <option key={option} value={option}>
                    {option.length <= 2 ? `Week ${option}` : option}
                  </option>
                ))}
              </select>
            </SelectShell>
          </div>

          <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-1.5">
            <SelectShell>
              <select
                value={team}
                onChange={(event) => setTeam(event.target.value)}
                className="h-full w-full appearance-none bg-transparent px-2.5 pr-7 font-cond text-[12px] font-bold text-[#2f3338] outline-none"
                aria-label="MGL team"
              >
                {teamOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </SelectShell>
            <div className="flex h-8 min-w-14 items-center justify-center rounded-md bg-[#f4f4f4] px-2.5 font-cond text-[12px] font-bold text-[#6a6d72]">
              {filtered.length}
            </div>
          </div>
        </div>
      </section>

      <div className="px-3 pb-3 pt-5 font-cond text-[17px] font-bold uppercase text-[#5b5d61]">
        Filter Results
      </div>

      <PlayerStatsTable players={filtered.slice(0, limit)} view={view} period={period} sort={sort} onSort={requestSort} />

      {filtered.length > limit ? (
        <div className="bg-white px-4 pb-6 pt-3 text-center">
          <button
            type="button"
            onClick={() => setLimit((current) => current + PAGE_SIZE)}
            className="h-9 rounded-md border-2 border-[#d8d8d8] bg-white px-5 font-cond text-[13px] font-semibold uppercase text-[#4a4d50]"
          >
            Show more ({filtered.length - limit} remaining)
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SelectShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-8 overflow-hidden rounded-md bg-[#f4f4f4]">
      {children}
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
        <ChevronIcon />
      </span>
    </div>
  );
}

function PlayerStatsTable({
  players,
  view,
  period,
  sort,
  onSort,
}: {
  players: PlayerBrowserItem[];
  view: View;
  period: string;
  sort: SortState;
  onSort: (key: string) => void;
}) {
  const columns = columnsFor(view);
  const groups = groupColumns(columns);

  return (
    <div className="relative overflow-x-auto bg-white [scrollbar-width:thin]">
      <table className="min-w-[960px] border-collapse text-[#3d3f43]">
        <thead className="font-cond uppercase text-[#63666b]">
          <tr className="h-8 bg-white text-[12px]">
            <StickyHead rowSpan={2} left="left-0" width="w-10">
              Team
            </StickyHead>
            <StickyHead rowSpan={2} left="left-10" width="w-44" align="left">
              Player
            </StickyHead>
            {groups.map((group) => (
              <th key={group.name || "base"} colSpan={group.count} className="border-l border-[#eeeeee] px-2 text-center font-bold">
                {group.name}
              </th>
            ))}
          </tr>
          <tr className="h-8 border-t border-[#f0f0f0] bg-white text-[11px]">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`border-l border-[#eeeeee] px-2 text-center font-bold ${
                  column.blue ? "bg-[#d8f6fb]" : ""
                } ${column.wide ? "min-w-20" : "min-w-12"}`}
              >
                <button type="button" onClick={() => onSort(column.key)} className="inline-flex items-center gap-1">
                  {sort.key === column.key ? <span className="text-[#009cbb]">{sort.direction === "desc" ? "v" : "^"}</span> : null}
                  {column.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <PlayerRow key={player.playerId} player={player} columns={columns} view={view} period={period} />
          ))}
          {players.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 2} className="px-4 py-10 text-center font-cond text-base font-bold text-[#72757a]">
                No players match those filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function PlayerRow({ player, columns, view, period }: { player: PlayerBrowserItem; columns: Column[]; view: View; period: string }) {
  const actual = statsFor(player, "stats", period);
  const projection = statsFor(player, "projection", period);
  const active = view === "PROJECTIONS" ? projection : actual;

  return (
    <tr className="h-[52px] border-t border-[#e8e8e8] bg-white text-[13px] even:bg-[#f6f6f6]">
      <td className="sticky left-0 z-20 w-10 bg-inherit px-1 text-center shadow-[8px_0_14px_rgba(255,255,255,0.88)]">
        <OwnerTeamLogo player={player} />
      </td>
      <td className="sticky left-10 z-20 w-44 bg-inherit px-2 shadow-[12px_0_18px_rgba(255,255,255,0.9)]">
        <div className="flex min-w-0 items-center gap-2">
          <PlayerImage player={player} />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1">
              <RankBadge rank={view === "PROJECTIONS" ? player.projectionRank : player.posRank} />
              <Link href={`/players/${player.playerId}?season=2026`} className="truncate font-cond text-[15px] font-bold text-[#303236]">
                {player.displayName}
              </Link>
              <AvailabilityBadge status={player.status} />
              {player.injuryStatus ? <span className="font-cond text-[11px] font-bold text-[#e23313]">{player.injuryStatus[0]}</span> : null}
            </div>
            <div className="font-cond text-[12px] font-bold text-[#666a70]">
              {player.proTeam || "FA"} - {player.pos}
            </div>
            <div className="truncate font-cond text-[11px] font-bold text-[#333]">{player.matchup}</div>
          </div>
        </div>
      </td>
      {columns.map((column) => (
        <td
          key={column.key}
          className={`px-2 text-center font-cond ${column.blue ? "bg-[#d8f6fb]" : ""} ${
            column.strong ? "text-[15px] font-bold text-[#222]" : "font-semibold text-[#686b70]"
          } ${column.wide ? "min-w-20" : "min-w-12"}`}
        >
          {column.get(player, active, actual, projection)}
        </td>
      ))}
    </tr>
  );
}

function columnsFor(view: View): Column[] {
  const base: Column[] = [
    { key: "matchup", label: "Opp", group: "", wide: true, get: (player) => player.matchup },
    { key: "manager", label: "Manager", group: "", wide: true, get: (player) => player.manager },
  ];

  if (view === "TRENDS") {
    return [
      ...base,
      { key: "addTrend", label: "Adds", group: "24H Trend", blue: true, strong: true, get: (player) => fmt(player.addTrend) },
      { key: "dropTrend", label: "Drops", group: "24H Trend", get: (player) => fmt(player.dropTrend) },
      { key: "trendNet", label: "Net", group: "24H Trend", blue: true, get: (player) => fmt(player.addTrend - player.dropTrend) },
      { key: "rosterAdds", label: "Adds", group: "League Moves", get: (player) => fmt(player.rosterAdds) },
      { key: "rosterDrops", label: "Drops", group: "League Moves", get: (player) => fmt(player.rosterDrops) },
      { key: "waiverAdds", label: "Waivers", group: "League Moves", get: (player) => fmt(player.waiverAdds) },
      { key: "points", label: "Points", group: "Fantasy", blue: true, get: (_player, _stats, actual) => fmt(actual.points, 2, false) },
      { key: "projected", label: "Proj", group: "Fantasy", blue: true, get: (_player, _stats, _actual, projection) => fmt(projection.projected, 2, false) },
      { key: "posRank", label: "Pos Rank", group: "Fantasy", get: (player) => `${player.pos}${player.posRank}` },
      { key: "status", label: "Status", group: "Sleeper", wide: true, get: (player) => statusLabel(player.status) },
    ];
  }

  const scoringKey = view === "PROJECTIONS" ? "projected" : "points";
  const scoringLabel = view === "PROJECTIONS" ? "Proj" : "Points";
  const scoringGetter =
    view === "PROJECTIONS"
      ? (_player: PlayerBrowserItem, stats: PlayerStats) => fmt(stats.projected, 2, false)
      : (_player: PlayerBrowserItem, stats: PlayerStats) => fmt(stats.points, 2, false);

  return [
    ...base,
    { key: scoringKey, label: scoringLabel, group: "Fantasy", blue: true, strong: true, get: scoringGetter },
    { key: "rank", label: "Pos Rank", group: "Fantasy", get: (player) => `${player.pos}${view === "PROJECTIONS" ? player.projectionRank : player.posRank}` },
    { key: "fpaRank", label: "Rank", group: "Fan Pts Agnst", get: (player) => player.fantasyAgainst?.rank ?? "-" },
    { key: "fpaAvg", label: "Avg", group: "Fan Pts Agnst", get: (player) => fmt(player.fantasyAgainst?.avg ?? 0, 2) },
    { key: "passAtt", label: "Att", group: "Passing", get: (_player, stats) => fmt(stats.passAtt) },
    { key: "passCmp", label: "Cmp", group: "Passing", get: (_player, stats) => fmt(stats.passCmp) },
    { key: "passYds", label: "Yds", group: "Passing", get: (_player, stats) => fmt(stats.passYds) },
    { key: "passTD", label: "TD", group: "Passing", get: (_player, stats) => fmt(stats.passTD) },
    { key: "passInt", label: "Int", group: "Passing", get: (_player, stats) => fmt(stats.passInt) },
    { key: "passSack", label: "Sck", group: "Passing", get: (_player, stats) => fmt(stats.passSack) },
    { key: "rushAtt", label: "Att", group: "Rushing", get: (_player, stats) => fmt(stats.rushAtt) },
    { key: "rushYds", label: "Rush Yds", group: "Rushing", wide: true, get: (_player, stats) => fmt(stats.rushYds) },
    { key: "rushTD", label: "Rush TD", group: "Rushing", wide: true, get: (_player, stats) => fmt(stats.rushTD) },
    { key: "targets", label: "Tgt", group: "Receiving", get: (_player, stats) => fmt(stats.targets) },
    { key: "rec", label: "Rec", group: "Receiving", get: (_player, stats) => fmt(stats.rec) },
    { key: "recYds", label: "Rec Yds", group: "Receiving", wide: true, get: (_player, stats) => fmt(stats.recYds) },
    { key: "recTD", label: "Rec TD", group: "Receiving", wide: true, get: (_player, stats) => fmt(stats.recTD) },
    { key: "fgMade", label: "FGM", group: "Kicking", get: (_player, stats) => fmt(stats.fgMade) },
    { key: "fgAtt", label: "FGA", group: "Kicking", get: (_player, stats) => fmt(stats.fgAtt) },
    { key: "xpMade", label: "XPM", group: "Kicking", get: (_player, stats) => fmt(stats.xpMade) },
    { key: "retTD", label: "Ret TD", group: "Misc", wide: true, get: (_player, stats) => fmt(stats.retTD) },
    { key: "fumTD", label: "FumTD", group: "Misc", get: (_player, stats) => fmt(stats.fumTD) },
    { key: "twoPt", label: "2PT", group: "Misc", get: (_player, stats) => fmt(stats.twoPt) },
    { key: "fumLost", label: "Lost", group: "Fum", get: (_player, stats) => fmt(stats.fumLost) },
  ];
}

function groupColumns(columns: Column[]): { name: string; count: number }[] {
  const groups: { name: string; count: number }[] = [];
  for (const column of columns) {
    const name = column.group ?? "";
    const last = groups[groups.length - 1];
    if (last && last.name === name) {
      last.count += 1;
    } else {
      groups.push({ name, count: 1 });
    }
  }
  return groups;
}

function StickyHead({
  children,
  rowSpan,
  left,
  width,
  align = "center",
}: {
  children: ReactNode;
  rowSpan: number;
  left: string;
  width: string;
  align?: "left" | "center";
}) {
  return (
    <th
      rowSpan={rowSpan}
      className={`sticky ${left} z-40 ${width} bg-white px-2 font-bold shadow-[10px_0_18px_rgba(255,255,255,0.92)] ${
        align === "left" ? "text-left" : "text-center"
      }`}
    >
      {children}
    </th>
  );
}

function comparePlayers(a: PlayerBrowserItem, b: PlayerBrowserItem, sort: SortState, view: View, period: string): number {
  const aValue = sortValue(a, sort.key, view, period);
  const bValue = sortValue(b, sort.key, view, period);
  const direction = sort.direction === "asc" ? 1 : -1;

  if (typeof aValue === "number" && typeof bValue === "number") {
    const diff = aValue - bValue;
    if (diff) return diff * direction;
  } else {
    const diff = String(aValue).localeCompare(String(bValue));
    if (diff) return diff * direction;
  }

  return (
    (b.stats.points ?? 0) - (a.stats.points ?? 0) ||
    (b.projection.projected ?? 0) - (a.projection.projected ?? 0) ||
    a.displayName.localeCompare(b.displayName)
  );
}

function sortValue(player: PlayerBrowserItem, key: string, view: View, period: string): string | number {
  const actual = statsFor(player, "stats", period);
  const projection = statsFor(player, "projection", period);
  const active = view === "PROJECTIONS" ? projection : actual;

  switch (key) {
    case "team":
      return player.ownerTeamName ?? statusLabel(player.status);
    case "player":
      return player.displayName;
    case "matchup":
      return player.matchup;
    case "manager":
      return player.manager;
    case "points":
      return actual.points;
    case "projected":
      return projection.projected;
    case "rank":
    case "posRank":
      return view === "PROJECTIONS" ? player.projectionRank : player.posRank;
    case "fpaRank":
      return player.fantasyAgainst?.rank ?? 999;
    case "fpaAvg":
      return player.fantasyAgainst?.avg ?? 0;
    case "status":
      return statusLabel(player.status);
    case "addTrend":
      return player.addTrend;
    case "dropTrend":
      return player.dropTrend;
    case "trendNet":
      return player.addTrend - player.dropTrend;
    case "rosterAdds":
      return player.rosterAdds;
    case "rosterDrops":
      return player.rosterDrops;
    case "waiverAdds":
      return player.waiverAdds;
    default:
      return numericStat(active, key);
  }
}

function numericStat(stats: PlayerStats, key: string): number {
  return stats[key as keyof PlayerStats] ?? 0;
}

function statsFor(player: PlayerBrowserItem, type: "stats" | "projection", period: string): PlayerStats {
  const source = type === "stats" ? player.statsByPeriod : player.projectionsByPeriod;
  const sparse = source[period];
  return sparse ? { ...EMPTY_STATS, ...sparse } : EMPTY_STATS;
}

function OwnerTeamLogo({ player }: { player: PlayerBrowserItem }) {
  if (player.ownerTeamLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={player.ownerTeamLogo}
        alt={player.ownerTeamName ?? "MGL team"}
        className="mx-auto h-7 w-7 rounded-full object-cover"
        suppressHydrationWarning
      />
    );
  }

  if (player.status === "Waivers") {
    return <span className="mx-auto grid h-7 w-7 place-items-center rounded-md bg-[#f07600] font-cond text-[12px] font-bold text-white">W</span>;
  }

  if (player.status === "Taken") {
    return (
      <span
        className="mx-auto grid h-7 w-7 place-items-center rounded-full font-cond text-[10px] font-bold text-white"
        style={{
          background: `linear-gradient(135deg, ${player.ownerTeamPrimary ?? "#667085"}, ${player.ownerTeamSecondary ?? "#98a2b3"})`,
        }}
        title={player.ownerTeamName}
      >
        {player.ownerTeamAbbrev ?? "MGL"}
      </span>
    );
  }

  return <span className="mx-auto grid h-7 w-7 place-items-center rounded-md bg-[#ef2b00] font-cond text-[12px] font-bold text-white">FA</span>;
}

function PlayerImage({ player }: { player: PlayerBrowserItem }) {
  if (player.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={player.imageUrl}
        alt={player.displayName}
        className={`h-9 w-9 shrink-0 rounded-full ${player.isLogo ? "object-contain p-1" : "object-cover"}`}
        suppressHydrationWarning
      />
    );
  }
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white font-cond text-[11px] font-bold text-[#5d6065] ring-1 ring-[#d6d6d6]">
      {player.pos}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (!Number.isFinite(rank) || rank > 999) return null;
  return (
    <span className="grid h-4 min-w-4 place-items-center rounded-full border border-[#d8d8d8] bg-white px-1 font-cond text-[10px] font-bold text-[#222]">
      {rank}
    </span>
  );
}

function AvailabilityBadge({ status }: { status: PlayerAvailability }) {
  if (status === "Taken") return null;
  return (
    <span className={`rounded-sm px-1 font-cond text-[10px] font-bold text-white ${status === "Waivers" ? "bg-[#f07600]" : "bg-[#67c777]"}`}>
      {status === "Waivers" ? "W" : "F"}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4.5 4.5" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4d5157" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function fmt(value: number, decimals = 0, zeroDash = true): string {
  if (!Number.isFinite(value) || (zeroDash && value === 0)) return "-";
  return value.toFixed(decimals);
}

function statusLabel(status: PlayerAvailability): string {
  if (status === "FA") return "Free Agent";
  if (status === "Waivers") return "On Waivers";
  return "Taken";
}
