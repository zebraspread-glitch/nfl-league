"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PlayerSummaryTeam } from "@/lib/players";
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

type PlayerBrowserMode = "all" | "records" | "search";
type Picker = "availability" | "season" | null;

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "W/R", "K", "DEF"];
const VIEWS = ["PROJECTIONS", "STATS", "TRENDS"] as const;
const SEASONS = ["2025 Season", "All Seasons", "2024 Season", "2023 Season", "2022 Season", "2021 Season"];

export function PlayerBrowser({ players, mode = "search" }: { players: PlayerBrowserItem[]; mode?: PlayerBrowserMode }) {
  void mode;
  const [query, setQuery] = useState("");
  const [view, setView] = useState<(typeof VIEWS)[number]>("STATS");
  const [position, setPosition] = useState("ALL");
  const [availability, setAvailability] = useState("All Players");
  const [season, setSeason] = useState("2025 Season");
  const [picker, setPicker] = useState<Picker>(null);

  const teamOptions = useMemo(() => {
    const names = new Set<string>();
    for (const player of players) {
      for (const team of player.teams) names.add(team.name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [players]);

  const positionRanks = useMemo(() => buildPositionRanks(players), [players]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...players]
      .filter((player) => {
        if (position === "ALL") return true;
        if (position === "W/R") return player.pos === "WR" || player.pos === "RB";
        return player.pos === position;
      })
      .filter((player) => {
        if (availability === "Taken") return player.teamCount > 0;
        if (availability === "Available" || availability === "Free Agents" || availability === "On Waivers") {
          return player.teamCount === 0;
        }
        if (availability !== "All Players") return player.teams.some((team) => team.name === availability);
        return true;
      })
      .filter((player) => {
        if (!q) return true;
        const teams = player.teams.map((team) => team.name).join(" ");
        return `${player.displayName} ${player.name} ${player.pos} ${player.proTeam} ${teams}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.totalPoints - a.totalPoints || b.gamesPlayed - a.gamesPlayed || a.displayName.localeCompare(b.displayName));
  }, [availability, players, position, query]);

  const availabilityOptions = ["All Players", "Available", "Free Agents", "On Waivers", "Taken", ...teamOptions];

  return (
    <div className="-mx-3 bg-[#deddd8] pb-24">
      <div className="px-3 pt-3">
        <section className="overflow-hidden rounded-[14px] bg-white px-3 py-4 shadow-[0_2px_0_rgba(0,0,0,0.16)]">
          <label className="flex h-12 items-center gap-2 rounded-[11px] border-2 border-[#dedede] bg-white px-3">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name"
              className="min-w-0 flex-1 bg-transparent font-cond text-[24px] font-medium leading-none text-[#383a3f] outline-none placeholder:text-[#777]"
            />
            <SearchIcon />
          </label>

          <div className="mt-5 grid grid-cols-3 gap-3">
            {VIEWS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setView(tab)}
                className={`h-12 min-w-0 rounded-[7px] border-2 px-1 font-cond text-[19px] font-medium uppercase tracking-[0.07em] ${
                  view === tab
                    ? "border-[#b8dce4] bg-[#d5f3f8] text-[#65686c]"
                    : "border-[#f0f0f0] bg-white text-[#696c71]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-4 gap-2">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => setPosition(pos)}
                className={`h-11 min-w-0 rounded-[7px] border-2 px-1 font-cond text-[20px] font-medium uppercase tracking-[0.06em] ${
                  position === pos
                    ? "border-[#b8dce4] bg-[#d5f3f8] text-[#55585d]"
                    : "border-[#f0f0f0] bg-white text-[#5d6065]"
                }`}
              >
                {pos}
              </button>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <PickerButton label={availability} onClick={() => setPicker("availability")} />
            <PickerButton label={season} onClick={() => setPicker("season")} />
          </div>
        </section>

        <h2 className="px-3 pb-6 pt-9 font-cond text-[24px] font-bold uppercase tracking-wide text-[#66686d]">
          Filter Results
        </h2>
      </div>

      <PlayerTable players={filtered} positionRanks={positionRanks} />

      {picker ? (
        <PickerSheet
          title={picker === "availability" ? "Player pool" : "Season"}
          value={picker === "availability" ? availability : season}
          options={picker === "availability" ? availabilityOptions : SEASONS}
          onSelect={(value) => {
            if (picker === "availability") setAvailability(value);
            else setSeason(value);
          }}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </div>
  );
}

function PlayerTable({
  players,
  positionRanks,
}: {
  players: PlayerBrowserItem[];
  positionRanks: Map<number, number>;
}) {
  return (
    <div className="overflow-hidden bg-white">
      <div className="w-full">
        <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_4.9rem] border-b border-[#e5e5e5] bg-white font-cond text-[15px] font-bold uppercase text-[#5d6065]">
          <div className="h-16" />
          <div className="h-16" />
          <div className="flex h-16 items-center justify-center border-l border-[#dfdfdf]">Points</div>
        </div>
        <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_4.9rem] border-b border-[#ececec] bg-white font-cond text-[14px] font-bold uppercase text-[#5d6065]">
          <div className="h-12" />
          <div className="h-12" />
          <div className="flex h-12 items-center justify-center gap-1 bg-[#d5f3f8]">
            <ChevronDown small /> Season
          </div>
        </div>

        {players.map((player, index) => (
          <PlayerRow
            key={player.playerId}
            player={player}
            rank={index + 1}
            posRank={positionRanks.get(player.playerId) ?? index + 1}
            action={index === 0 ? "minus" : "move"}
          />
        ))}
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  rank,
  posRank,
  action,
}: {
  player: PlayerBrowserItem;
  rank: number;
  posRank: number;
  action: "minus" | "move";
}) {
  return (
    <Link
      href={`/players/${player.playerId}`}
      className={`grid min-h-[90px] grid-cols-[4.75rem_minmax(0,1fr)_4.9rem] items-center border-b border-[#ececec] ${
        rank % 2 === 0 ? "bg-white" : "bg-[#f7f7f7]"
      }`}
    >
      <div className="flex justify-center">
        <ActionBadge type={action} />
      </div>
      <div className="flex min-w-0 items-center gap-2 pr-2">
        <div className="relative shrink-0">
          <PlayerImage player={player} />
          <RankBadge value={posRank} />
        </div>
        <div className="min-w-0">
          <div className="truncate font-cond text-[23px] font-bold leading-none tracking-wide text-[#33363b]">
            {player.displayName}
          </div>
          <div className="mt-1.5 truncate font-cond text-[17px] font-bold uppercase leading-none tracking-wide text-[#66696f]">
            {player.proTeam || "FA"} - {player.pos}
          </div>
          <div className="mt-1.5 truncate font-cond text-[14px] font-bold uppercase leading-none text-[#35383d]">
            {player.gamesPlayed} GP - {player.starts} starts
          </div>
        </div>
      </div>
      <div className="flex h-full items-center justify-center bg-[#d5f3f8] font-cond text-[20px] font-medium tabular-nums text-[#676a70]">
        {player.totalPoints.toFixed(2)}
      </div>
    </Link>
  );
}

function PickerButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 min-w-0 items-center justify-between rounded-[10px] bg-[#f4f4f4] px-4 text-left font-cond text-[22px] font-bold tracking-wide text-[#33363b]"
    >
      <span className="truncate">{label}</span>
      <ChevronDown />
    </button>
  );
}

function PickerSheet({
  title,
  value,
  options,
  onSelect,
  onClose,
}: {
  title: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 mx-auto max-w-xl bg-black/55" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close picker" />
      <div className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[12px] bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="flex h-16 items-center justify-end border-b border-[#eeeeee] px-6">
          <button type="button" onClick={onClose} className="font-cond text-[22px] font-bold text-[#16a7c6]">
            Done
          </button>
        </div>
        <div className="max-h-[330px] overflow-y-auto py-5">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className={`block h-14 w-full px-6 text-center font-cond text-[28px] font-bold ${
                option === value ? "rounded-[10px] bg-[#e6e7ea] text-[#5d6065]" : "text-[#c7c9cc]"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4.5 4.5" />
    </svg>
  );
}

function ChevronDown({ small = false }: { small?: boolean }) {
  return (
    <svg width={small ? 14 : 24} height={small ? 9 : 16} viewBox="0 0 28 18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 3 11 11L25 3" />
    </svg>
  );
}

function ActionBadge({ type }: { type: "minus" | "move" }) {
  return (
    <span className={`grid h-12 w-12 place-items-center rounded-[9px] text-white ${type === "minus" ? "bg-[#ef2b00]" : "bg-[#ef7d00]"}`}>
      {type === "minus" ? (
        <svg width="32" height="8" viewBox="0 0 32 8" fill="none" aria-hidden="true">
          <path d="M3 4h26" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="35" height="28" viewBox="0 0 35 28" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9h22" />
          <path d="M13 3 6 9l7 6" />
          <path d="M29 19H7" />
          <path d="m22 13 7 6-7 6" />
        </svg>
      )}
    </span>
  );
}

function RankBadge({ value }: { value: number }) {
  return (
    <span className="hexagon absolute -left-2 -top-2 grid h-7 w-7 place-items-center border border-[#cfd1d4] bg-white font-cond text-[13px] font-bold leading-none text-black shadow-sm">
      {value}
    </span>
  );
}

function PlayerImage({ player }: { player: PlayerBrowserItem }) {
  if (player.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={player.imageUrl}
        alt={player.isLogo ? `${player.displayName} logo` : player.displayName}
        width={56}
        height={56}
        className={`h-14 w-14 shrink-0 rounded-full ${
          player.isLogo ? "bg-white object-contain p-2" : "bg-[#d2d2d2] object-cover"
        }`}
        suppressHydrationWarning
      />
    );
  }

  return (
    <span
      className="grid h-14 w-14 shrink-0 place-items-center rounded-full font-cond text-xs font-bold text-white"
      style={{ background: POS_COLOR[player.pos] ?? "#9aa1ad" }}
    >
      {player.pos || "-"}
    </span>
  );
}

function buildPositionRanks(players: PlayerBrowserItem[]): Map<number, number> {
  const map = new Map<number, number>();
  const byPos = new Map<string, PlayerBrowserItem[]>();
  for (const player of players) {
    const list = byPos.get(player.pos) ?? [];
    list.push(player);
    byPos.set(player.pos, list);
  }
  for (const list of byPos.values()) {
    list
      .sort((a, b) => b.totalPoints - a.totalPoints || b.gamesPlayed - a.gamesPlayed)
      .forEach((player, index) => map.set(player.playerId, index + 1));
  }
  return map;
}
