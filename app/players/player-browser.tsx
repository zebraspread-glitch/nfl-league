"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PlayerSummaryTeam } from "@/lib/players";
import { Card, Score } from "@/components/ui";
import { POS_COLOR } from "@/lib/player-images";

export interface PlayerBrowserItem {
  playerId: number;
  name: string;
  displayName: string;
  imageUrl?: string;
  isLogo: boolean;
  pos: string;
  proTeam: string;
  firstSeason: number;
  lastSeason: number;
  seasons: number[];
  rosteredGames: number;
  gamesPlayed: number;
  starts: number;
  totalPoints: number;
  avgPoints: number;
  bestGamePoints: number;
  bestGameId?: string;
  passYds: number;
  passTD: number;
  passInt: number;
  rushYds: number;
  rushTD: number;
  recYds: number;
  recTD: number;
  fgMade: number;
  fgMiss: number;
  patMade: number;
  defSack: number;
  defInt: number;
  defFumRec: number;
  defTD: number;
  defSafety: number;
  totalTDs: number;
  teamCount: number;
  proTeamCount: number;
  teams: PlayerSummaryTeam[];
}

type SortKey =
  | "points"
  | "games"
  | "average"
  | "teams"
  | "best"
  | "tds"
  | "seasons"
  | "passing"
  | "rushing"
  | "receiving"
  | "name";
type PlayerBrowserMode = "all" | "records" | "search";

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];
const PAGE_SIZE = 50;

const SORTS: { key: SortKey; label: string }[] = [
  { key: "points", label: "Most points" },
  { key: "games", label: "Most games" },
  { key: "average", label: "Best average" },
  { key: "teams", label: "Most MGL teams" },
  { key: "best", label: "Best single game" },
  { key: "tds", label: "Most TDs" },
  { key: "seasons", label: "Most seasons" },
  { key: "passing", label: "Pass yards" },
  { key: "rushing", label: "Rush yards" },
  { key: "receiving", label: "Rec yards" },
  { key: "name", label: "Name" },
];

export function PlayerBrowser({ players, mode = "all" }: { players: PlayerBrowserItem[]; mode?: PlayerBrowserMode }) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("points");
  const [page, setPage] = useState(1);

  const leaders = useMemo(() => buildLeaders(players), [players]);
  const boards = useMemo(() => buildBoards(players), [players]);
  const positionLeaders = useMemo(() => buildPositionLeaders(players), [players]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...players]
      .filter((player) => position === "ALL" || player.pos === position)
      .filter((player) => {
        if (!q) return true;
        const teams = player.teams.map((team) => team.name).join(" ");
        return `${player.displayName} ${player.name} ${player.pos} ${player.proTeam} ${teams}`.toLowerCase().includes(q);
      })
      .sort((a, b) => comparePlayers(a, b, sort));
  }, [players, position, query, sort]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagePlayers = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div className="space-y-3">
      {mode !== "search" && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <RecordTile title="Most Points" player={leaders.points} value={formatNumber(leaders.points.totalPoints)} />
            <RecordTile title="Most Games" player={leaders.games} value={leaders.games.gamesPlayed.toString()} />
            <RecordTile title="Most Teams" player={leaders.teams} value={leaders.teams.teamCount.toString()} />
            <RecordTile title="Best Game" player={leaders.best} value={leaders.best.bestGamePoints.toFixed(2)} />
            <RecordTile title="Best Avg" player={leaders.average} value={leaders.average.avgPoints.toFixed(2)} />
            <RecordTile title="Most TDs" player={leaders.tds} value={leaders.tds.totalTDs.toString()} />
            <RecordTile title="Most Seasons" player={leaders.seasons} value={leaders.seasons.seasons.length.toString()} />
            <RecordTile title="Most Starts" player={leaders.starts} value={leaders.starts.starts.toString()} />
          </div>

          <Link href="/players/search">
            <Card className="flex items-center gap-3 px-4 py-3 hover:bg-card-hover">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-section font-cond text-sm font-bold text-text-muted">
                SR
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-cond text-lg font-semibold leading-tight">Search All Players</div>
                <div className="truncate text-xs text-text-muted">Browse every player profile with filters and pagination</div>
              </div>
              <span className="text-text-dim">&gt;</span>
            </Card>
          </Link>

          <div className="grid gap-3 sm:grid-cols-2">
            <RecordBoard title="Scoring" rows={boards.scoring} value={(player) => formatDecimal(player.totalPoints)} sub={(player) => `${player.gamesPlayed} GP - ${player.avgPoints.toFixed(2)} avg`} />
            <RecordBoard title="Peak Games" rows={boards.peak} value={(player) => player.bestGamePoints.toFixed(2)} sub={(player) => `${player.pos}${player.bestGameId ? " - tap for profile" : ""}`} />
            <RecordBoard title="Passing" rows={boards.passing} value={(player) => formatNumber(player.passYds)} sub={(player) => `${player.passTD} TD - ${player.passInt} INT`} />
            <RecordBoard title="Rushing" rows={boards.rushing} value={(player) => formatNumber(player.rushYds)} sub={(player) => `${player.rushTD} TD`} />
            <RecordBoard title="Receiving" rows={boards.receiving} value={(player) => formatNumber(player.recYds)} sub={(player) => `${player.recTD} TD`} />
            <RecordBoard title="Kicking" rows={boards.kicking} value={(player) => `${player.fgMade}/${player.fgMade + player.fgMiss}`} sub={(player) => `${player.patMade} PAT`} />
            <RecordBoard title="Defense" rows={boards.defense} value={(player) => `${player.defSack} SCK`} sub={(player) => `${player.defInt} INT - ${player.defTD} TD`} />
            <RecordBoard title="Journeymen" rows={boards.journeymen} value={(player) => player.teamCount.toString()} sub={(player) => player.teams.map((team) => team.name).join(", ")} />
          </div>

          <Card>
            <div className="border-b border-border bg-section px-3 py-2 font-cond text-base font-semibold">
              Position Leaders
            </div>
            <div className="grid grid-cols-2 gap-px bg-section/70 sm:grid-cols-3">
              {positionLeaders.map((player) => (
                <Link key={player.pos} href={`/players/${player.playerId}`} className="bg-card px-3 py-2 hover:bg-card-hover">
                  <div className="font-cond text-xs font-semibold uppercase tracking-wide text-text-muted">{player.pos}</div>
                  <div className="truncate text-sm font-semibold">{player.displayName}</div>
                  <div className="font-cond text-lg font-bold tabular-nums">{formatNumber(player.totalPoints)}</div>
                </Link>
              ))}
            </div>
          </Card>
        </>
      )}

      {mode !== "records" && (
        <>
          <Card className="p-3">
            <div className="grid gap-2">
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search players, teams or positions"
                className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal/20"
              />

              <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => {
                      setPosition(pos);
                      setPage(1);
                    }}
                    className={`h-8 shrink-0 rounded-lg px-3 font-cond text-sm font-semibold transition-colors ${
                      position === pos ? "bg-teal text-white" : "bg-section text-text-muted hover:bg-card-hover"
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>

              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as SortKey);
                  setPage(1);
                }}
                aria-label="Sort players"
                className="h-10 rounded-lg border border-border bg-card px-3 font-cond text-sm font-semibold outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal/20"
              >
                {SORTS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b border-border bg-section px-3 py-2">
              <div className="font-cond text-base font-semibold">Player Search</div>
              <div className="font-cond text-xs font-semibold uppercase tracking-wide text-text-muted">
                {filtered.length} found
              </div>
            </div>
            {pagePlayers.map((player, index) => (
              <PlayerRow key={player.playerId} player={player} rank={pageStart + index + 1} alt={index % 2 === 1} />
            ))}
            <Pagination
              page={safePage}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageStart={pageStart}
              pageCount={pagePlayers.length}
              onPageChange={setPage}
            />
          </Card>
        </>
      )}
    </div>
  );
}

function buildLeaders(players: PlayerBrowserItem[]) {
  const eligibleAverage = players.filter((player) => player.gamesPlayed >= 8);
  return {
    points: maxBy(players, (player) => player.totalPoints),
    games: maxBy(players, (player) => player.gamesPlayed),
    starts: maxBy(players, (player) => player.starts),
    teams: maxBy(players, (player) => player.teamCount),
    best: maxBy(players, (player) => player.bestGamePoints),
    average: maxBy(eligibleAverage.length ? eligibleAverage : players, (player) => player.avgPoints),
    tds: maxBy(players, (player) => player.totalTDs),
    seasons: maxBy(players, (player) => player.seasons.length),
  };
}

function buildBoards(players: PlayerBrowserItem[]) {
  return {
    scoring: topBy(players, (player) => player.totalPoints),
    peak: topBy(players, (player) => player.bestGamePoints),
    passing: topBy(players.filter((player) => player.passYds > 0), (player) => player.passYds),
    rushing: topBy(players.filter((player) => player.rushYds > 0), (player) => player.rushYds),
    receiving: topBy(players.filter((player) => player.recYds > 0), (player) => player.recYds),
    kicking: topBy(players.filter((player) => player.fgMade > 0 || player.patMade > 0), (player) => player.fgMade),
    defense: topBy(players.filter((player) => player.defSack > 0 || player.defInt > 0), (player) => player.defSack),
    journeymen: topBy(players.filter((player) => player.teamCount > 1), (player) => player.teamCount),
  };
}

function buildPositionLeaders(players: PlayerBrowserItem[]): PlayerBrowserItem[] {
  return POSITIONS.filter((pos) => pos !== "ALL")
    .map((pos) => maxBy(players.filter((player) => player.pos === pos), (player) => player.totalPoints))
    .filter(Boolean);
}

function topBy(players: PlayerBrowserItem[], value: (player: PlayerBrowserItem) => number, count = 5): PlayerBrowserItem[] {
  return [...players]
    .sort((a, b) => value(b) - value(a) || b.totalPoints - a.totalPoints || a.displayName.localeCompare(b.displayName))
    .slice(0, count);
}

function maxBy(players: PlayerBrowserItem[], value: (player: PlayerBrowserItem) => number): PlayerBrowserItem {
  return [...players].sort((a, b) => value(b) - value(a) || b.gamesPlayed - a.gamesPlayed || a.displayName.localeCompare(b.displayName))[0];
}

function comparePlayers(a: PlayerBrowserItem, b: PlayerBrowserItem, sort: SortKey): number {
  switch (sort) {
    case "games":
      return b.gamesPlayed - a.gamesPlayed || b.totalPoints - a.totalPoints;
    case "average":
      return b.avgPoints - a.avgPoints || b.gamesPlayed - a.gamesPlayed;
    case "teams":
      return b.teamCount - a.teamCount || b.totalPoints - a.totalPoints;
    case "best":
      return b.bestGamePoints - a.bestGamePoints || b.totalPoints - a.totalPoints;
    case "tds":
      return b.totalTDs - a.totalTDs || b.totalPoints - a.totalPoints;
    case "seasons":
      return b.seasons.length - a.seasons.length || b.totalPoints - a.totalPoints;
    case "passing":
      return b.passYds - a.passYds || b.passTD - a.passTD;
    case "rushing":
      return b.rushYds - a.rushYds || b.rushTD - a.rushTD;
    case "receiving":
      return b.recYds - a.recYds || b.recTD - a.recTD;
    case "name":
      return a.displayName.localeCompare(b.displayName);
    case "points":
    default:
      return b.totalPoints - a.totalPoints || b.gamesPlayed - a.gamesPlayed;
  }
}

function RecordTile({ title, player, value }: { title: string; player: PlayerBrowserItem; value: string }) {
  return (
    <Link href={`/players/${player.playerId}`}>
      <Card className="h-full p-3 hover:bg-card-hover">
        <div className="font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted">{title}</div>
        <div className="mt-1 truncate text-sm font-semibold">{player.displayName}</div>
        <div className="font-cond text-2xl font-bold tabular-nums">{value}</div>
      </Card>
    </Link>
  );
}

function RecordBoard({
  title,
  rows,
  value,
  sub,
}: {
  title: string;
  rows: PlayerBrowserItem[];
  value: (player: PlayerBrowserItem) => string;
  sub: (player: PlayerBrowserItem) => string;
}) {
  return (
    <Card>
      <div className="border-b border-border bg-section px-3 py-2 font-cond text-base font-semibold">{title}</div>
      {rows.map((player, index) => (
        <Link
          key={`${title}-${player.playerId}`}
          href={`/players/${player.playerId}`}
          className={`flex items-center gap-2 px-3 py-2 ${index % 2 ? "bg-card" : "bg-row"} hover:bg-card-hover`}
        >
          <div className="w-5 shrink-0 text-center font-cond text-sm font-bold text-text-muted">{index + 1}</div>
          <PlayerImage player={player} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{player.displayName}</div>
            <div className="truncate text-[11px] text-text-muted">{sub(player)}</div>
          </div>
          <div className="shrink-0 text-right font-cond text-lg font-bold tabular-nums">{value(player)}</div>
        </Link>
      ))}
    </Card>
  );
}

function PlayerRow({ player, rank, alt }: { player: PlayerBrowserItem; rank: number; alt: boolean }) {
  const teams = player.teams.map((team) => team.name).join(", ");

  return (
    <Link
      href={`/players/${player.playerId}`}
      className={`flex items-center gap-2.5 px-3 py-2.5 ${alt ? "bg-card" : "bg-row"} hover:bg-card-hover`}
    >
      <div className="w-6 shrink-0 text-center font-cond text-sm font-bold text-text-muted">{rank}</div>
      <PlayerImage player={player} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{player.displayName}</div>
        <div className="truncate text-[11px] text-text-muted">
          {player.pos}
          {player.proTeam ? ` - ${player.proTeam}` : ""}
          {teams ? ` - ${teams}` : ""}
        </div>
      </div>
      <div className="w-16 shrink-0 text-right">
        <Score value={player.totalPoints} className="text-base" dim={player.totalPoints === 0} />
        <div className="font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          {player.gamesPlayed} GP
        </div>
      </div>
    </Link>
  );
}

function Pagination({
  page,
  totalPages,
  totalItems,
  pageStart,
  pageCount,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageStart: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  const pages = nearbyPages(page, totalPages);
  const firstItem = totalItems ? pageStart + 1 : 0;
  const lastItem = pageStart + pageCount;

  return (
    <div className="border-t border-border bg-card px-3 py-2.5">
      <div className="mb-2 text-center text-xs text-text-muted">
        Showing {firstItem}-{lastItem} of {totalItems}
      </div>
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="h-8 rounded-lg bg-section px-3 font-cond text-sm font-semibold text-text-muted transition-colors hover:bg-card-hover disabled:opacity-35"
        >
          Prev
        </button>
        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            className={`grid h-8 w-8 place-items-center rounded-lg font-cond text-sm font-semibold transition-colors ${
              pageNumber === page ? "bg-teal text-white" : "bg-section text-text-muted hover:bg-card-hover"
            }`}
          >
            {pageNumber}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="h-8 rounded-lg bg-section px-3 font-cond text-sm font-semibold text-text-muted transition-colors hover:bg-card-hover disabled:opacity-35"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function nearbyPages(page: number, totalPages: number): number[] {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function PlayerImage({ player }: { player: PlayerBrowserItem }) {
  if (player.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={player.imageUrl}
        alt={player.isLogo ? `${player.displayName} logo` : player.displayName}
        width={36}
        height={36}
        className={`h-9 w-9 shrink-0 rounded-full ${player.isLogo ? "bg-white object-contain p-1" : "bg-section object-cover"}`}
        suppressHydrationWarning
      />
    );
  }

  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-cond text-[10px] font-bold text-white"
      style={{ background: POS_COLOR[player.pos] ?? "#9aa1ad" }}
    >
      {player.pos || "-"}
    </span>
  );
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatDecimal(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
