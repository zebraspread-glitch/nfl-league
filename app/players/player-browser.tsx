"use client";

import { useMemo, useState } from "react";

export interface PlayerStats {
  passYds: number;
  passTD: number;
  passInt: number;
  passSack: number;
  rushYds: number;
  rushTD: number;
  rec: number;
  recYds: number;
  recTD: number;
  retTD: number;
  fumTD: number;
  twoPt: number;
  fumLost: number;
  points: number;
  projected: number;
  gp: number;
}

export interface PlayerBrowserItem {
  playerId: string;
  displayName: string;
  fullName: string;
  imageUrl?: string;
  isLogo: boolean;
  pos: string;
  proTeam: string;
  opponent: string;
  manager: string;
  status: "FA" | "Taken";
  ownerTeamName?: string;
  ownerTeamAbbrev?: string;
  ownerTeamLogo?: string;
  ownerTeamPrimary?: string;
  ownerTeamSecondary?: string;
  matchup: string;
  posRank: number;
  injuryStatus?: string;
  stats: PlayerStats;
}

type PlayerBrowserMode = "all" | "records" | "search";
type View = "PROJECTIONS" | "STATS" | "TRENDS";
type PositionFilter = "All Offense" | "QB" | "RB" | "WR" | "TE" | "W/R" | "K" | "DEF";
type StatusFilter = "All Available Players" | "All Players" | "Taken" | "Free Agents" | "On Waivers";

const VIEWS: View[] = ["PROJECTIONS", "STATS", "TRENDS"];
const POSITIONS: PositionFilter[] = ["All Offense", "QB", "RB", "WR", "TE", "W/R", "K", "DEF"];
const STATUS_OPTIONS: StatusFilter[] = ["All Available Players", "All Players", "Taken", "Free Agents", "On Waivers"];
const WEEKS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "Last 2 WKS", "Last 4 WKS", "2025 Season"];

export function PlayerBrowser({ players, mode = "search" }: { players: PlayerBrowserItem[]; mode?: PlayerBrowserMode }) {
  void mode;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All Available Players");
  const [position, setPosition] = useState<PositionFilter>("All Offense");
  const [view, setView] = useState<View>("STATS");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter((player) => {
        if (status === "All Players") return true;
        if (status === "Taken") return player.status === "Taken";
        return player.status === "FA";
      })
      .filter((player) => {
        if (position === "All Offense") return player.pos === "QB" || player.pos === "RB" || player.pos === "WR" || player.pos === "TE";
        if (position === "W/R") return player.pos === "WR" || player.pos === "RB";
        return player.pos === position;
      })
      .filter((player) => {
        if (!q) return true;
        return `${player.displayName} ${player.fullName} ${player.proTeam} ${player.pos} ${player.manager} ${player.ownerTeamName ?? ""}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => b.stats.points - a.stats.points || a.displayName.localeCompare(b.displayName));
  }, [players, position, query, status]);

  return (
    <div className="-mx-3 bg-white pb-24 text-[#1d3550]">
      <section className="border-b border-[#d8d8d8] bg-white px-1 py-2">
        <div className="flex items-center gap-2 text-[11px] leading-none">
          <span className="font-cond font-bold uppercase text-[#555]">Status:</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            className="max-w-[13rem] bg-transparent font-cond text-[11px] font-bold uppercase text-[#0070b8] outline-none"
            aria-label="Player status"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <label className="ml-auto flex h-7 w-[220px] max-w-[45vw] items-center rounded border border-[#c8c8c8] bg-white px-2">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Player By Name"
              className="min-w-0 flex-1 text-xs text-[#333] outline-none placeholder:text-[#777]"
            />
            <SearchIcon />
          </label>
        </div>

        <div className="mt-2 flex items-center gap-1 overflow-x-auto bg-[#f4f4f4] px-2 py-1 text-[11px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="mr-3 text-[#555]">Position:</span>
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPosition(pos)}
              className={`shrink-0 px-2 py-1 ${position === pos ? "font-bold text-[#0070b8]" : "text-[#41536a]"}`}
            >
              {pos}
            </button>
          ))}
        </div>

        <div className="mt-4 flex border-b border-[#d8d8d8]">
          {VIEWS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setView(tab)}
              className={`h-9 px-5 font-cond text-xs font-bold uppercase ${
                view === tab ? "border-b-4 border-[#009bd7] text-[#111]" : "text-[#333]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 overflow-x-auto bg-[#f7f7f7] px-2 py-2 text-[11px] text-[#566171] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="font-bold text-[#555]">Weeks:</span>
          {WEEKS.map((week) => (
            <span key={week} className={`shrink-0 ${week === "2025 Season" ? "font-bold text-[#0070b8]" : ""}`}>
              {week}
            </span>
          ))}
          <span className="ml-auto shrink-0 text-[#777]">1 of {filtered.length}</span>
        </div>
      </section>

      <PlayerStatsTable players={filtered} />
    </div>
  );
}

function PlayerStatsTable({ players }: { players: PlayerBrowserItem[] }) {
  return (
    <div className="overflow-x-auto [scrollbar-width:thin]">
      <table className="min-w-[920px] border-collapse text-[10px] leading-tight text-[#17365d]">
        <thead className="bg-[#d9d9d9] text-[10px] text-[#555]">
          <tr className="h-5">
            <GroupHead colSpan={2} />
            <GroupHead colSpan={1} />
            <GroupHead colSpan={1} />
            <GroupHead label="Passing" colSpan={4} />
            <GroupHead label="Rushing" colSpan={2} />
            <GroupHead label="Receiving" colSpan={3} />
            <GroupHead label="Ret" colSpan={1} />
            <GroupHead label="Misc" colSpan={2} />
            <GroupHead label="Fum" colSpan={1} />
            <GroupHead label="Fantasy" colSpan={1} />
            <GroupHead label="Sleeper" colSpan={3} />
          </tr>
          <tr className="h-7 border-b border-[#c8c8c8] text-[9px]">
            <Head>Team</Head>
            <Head align="left">Player</Head>
            <Head>Opp</Head>
            <Head>Manager</Head>
            <Head>Yds</Head>
            <Head>TD</Head>
            <Head>Int</Head>
            <Head>Sck</Head>
            <Head>Yds</Head>
            <Head>TD</Head>
            <Head>Rec</Head>
            <Head>Yds</Head>
            <Head>TD</Head>
            <Head>TD</Head>
            <Head>FumTD</Head>
            <Head>2PT</Head>
            <Head>Lost</Head>
            <Head blue>Points</Head>
            <Head blue>ECR</Head>
            <Head blue>Proj</Head>
            <Head blue>Matchup</Head>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <PlayerRow key={player.playerId} player={player} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerRow({ player }: { player: PlayerBrowserItem }) {
  const s = player.stats;
  return (
    <tr className="h-[42px] border-b border-[#dddddd] even:bg-[#f7f7f7]">
      <td className="w-11 px-1 text-center">
        <OwnerTeamLogo player={player} />
      </td>
      <td className="w-[172px] px-1">
        <div className="flex min-w-0 items-center gap-2">
          <PlayerImage player={player} />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="truncate text-[11px] text-[#064f9e]">{player.displayName}</span>
              {player.status === "FA" ? <span className="rounded-sm bg-[#6ac878] px-1 text-[8px] font-bold text-white">F</span> : null}
              {player.injuryStatus ? <span className="text-[9px] font-bold text-[#c23030]">{player.injuryStatus[0]}</span> : null}
            </div>
            <div className="truncate text-[10px] text-[#333]">
              {player.pos} - {player.proTeam || "FA"}
            </div>
          </div>
        </div>
      </td>
      <Cell>{player.matchup}</Cell>
      <Cell>{player.manager}</Cell>
      <Cell>{fmt(s.passYds, 0)}</Cell>
      <Cell>{fmt(s.passTD, 0)}</Cell>
      <Cell>{fmt(s.passInt, 0)}</Cell>
      <Cell>{fmt(s.passSack, 0)}</Cell>
      <Cell>{fmt(s.rushYds, 0)}</Cell>
      <Cell>{fmt(s.rushTD, 0)}</Cell>
      <Cell>{fmt(s.rec, 0)}</Cell>
      <Cell>{fmt(s.recYds, 0)}</Cell>
      <Cell>{fmt(s.recTD, 0)}</Cell>
      <Cell>{fmt(s.retTD, 0)}</Cell>
      <Cell>{fmt(s.fumTD, 0)}</Cell>
      <Cell>{fmt(s.twoPt, 0)}</Cell>
      <Cell>{fmt(s.fumLost, 0)}</Cell>
      <Cell blue strong>{fmt(s.points, 2)}</Cell>
      <Cell blue>{player.pos}{player.posRank}</Cell>
      <Cell blue>{fmt(s.projected, 2)}</Cell>
      <Cell blue>{starsFor(player.posRank)}</Cell>
    </tr>
  );
}

function GroupHead({ label = "", colSpan }: { label?: string; colSpan: number }) {
  return (
    <th colSpan={colSpan} className="border border-white px-1 py-0.5 text-center font-bold">
      {label}
    </th>
  );
}

function Head({ children, align = "center", blue = false }: { children: React.ReactNode; align?: "left" | "center"; blue?: boolean }) {
  return (
    <th className={`border border-white px-1 font-bold ${align === "left" ? "text-left" : "text-center"} ${blue ? "bg-[#dff1fb] text-[#064f9e]" : ""}`}>
      {children}
    </th>
  );
}

function Cell({ children, blue = false, strong = false }: { children: React.ReactNode; blue?: boolean; strong?: boolean }) {
  return (
    <td className={`w-10 px-1 text-center ${blue ? "bg-[#e7f5fd]" : ""} ${strong ? "font-bold text-[#111]" : ""}`}>
      {children}
    </td>
  );
}

function OwnerTeamLogo({ player }: { player: PlayerBrowserItem }) {
  if (player.ownerTeamLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={player.ownerTeamLogo}
        alt={player.ownerTeamName ?? "MGL team"}
        className="mx-auto h-8 w-8 rounded-full object-cover"
        suppressHydrationWarning
      />
    );
  }

  if (player.status === "Taken") {
    return (
      <span
        className="mx-auto grid h-8 w-8 place-items-center rounded-full text-[9px] font-bold text-white"
        style={{
          background: `linear-gradient(135deg, ${player.ownerTeamPrimary ?? "#667085"}, ${player.ownerTeamSecondary ?? "#98a2b3"})`,
        }}
        title={player.ownerTeamName}
      >
        {player.ownerTeamAbbrev ?? "MGL"}
      </span>
    );
  }

  return (
    <span className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-[#eeeeee] text-[9px] font-bold text-[#777777]">
      FA
    </span>
  );
}

function PlayerImage({ player }: { player: PlayerBrowserItem }) {
  if (player.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={player.imageUrl}
        alt={player.displayName}
        className={`h-9 w-9 shrink-0 rounded ${player.isLogo ? "object-contain p-1" : "object-cover"}`}
        suppressHydrationWarning
      />
    );
  }
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-white text-[9px] font-bold text-[#5d6065] ring-1 ring-[#d6d6d6]">
      {player.pos}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4.5 4.5" />
    </svg>
  );
}

function fmt(value: number, decimals = 0): string {
  if (!value) return decimals ? "0.00" : "-";
  return value.toFixed(decimals);
}

function starsFor(rank: number): string {
  const count = rank <= 5 ? 5 : rank <= 12 ? 4 : rank <= 24 ? 3 : rank <= 36 ? 2 : 1;
  return "★".repeat(count) + "☆".repeat(5 - count);
}
