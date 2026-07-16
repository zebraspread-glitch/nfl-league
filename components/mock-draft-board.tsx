"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SleeperPlayerAvatar } from "@/components/sleeper-player-avatar";
import { TeamAvatar } from "@/components/ui";
import { sleeperPlayerImage } from "@/lib/player-images";
import { TEAM_NEEDS, computeAutopick, draftValue, teamById, type DraftSlot, type MockPlayer } from "@/lib/mock-draft";
import type { TeamMeta } from "@/lib/types";

const STORAGE_KEY = "mgl-mock-draft-2026-v2";
const TEAM_STORAGE_KEY = "mgl-mock-draft-team-v1";
const VIEW_STORAGE_KEY = "mgl-mock-draft-view-v1";
const AUTOPICK_DELAY_MS = 450;
/** Sentinel "team" for the drafting-as select: autopick is off, the user makes every pick. */
const MANUAL_TEAM_ID = 0;

type Picks = Record<string, MockPlayer>;
type DraftViewMode = "classic" | "underdog";
type UnderdogPickerPlacement = "left" | "above" | "below" | "hidden";
type UnderdogHeaderPosition = "QB" | "RB" | "WR" | "TE";
type LineupSlot = "QB" | "RB" | "WR" | "TE" | "RB/WR" | "K" | "DEF" | "BN";

interface LineupRow {
  label: LineupSlot;
  player?: MockPlayer;
  draftSlot?: DraftSlot;
}

type FilledLineupRow = LineupRow & Required<Pick<LineupRow, "player" | "draftSlot">>;

type DraftAnalysisPick = FilledLineupRow & {
  value: number;
};

interface DraftAnalysisTeam {
  team: TeamMeta;
  projected: number;
  startersProjected: number;
  rostered: number;
  avgAdp: number | null;
  valueScore: number;
  balanceScore: number;
  totalScore: number;
  positionCounts: Record<UnderdogHeaderPosition, number>;
  topPlayer?: DraftAnalysisPick;
  bestValue?: DraftAnalysisPick;
}

interface DraftAnalysisHighlight {
  title: string;
  value: string;
  detail: string;
}

function key(round: number, slot: number) {
  return `${round}-${slot}`;
}

const STARTING_LINEUP: LineupSlot[] = ["QB", "RB", "RB", "WR", "WR", "TE", "RB/WR", "K", "DEF"];

/** Splits a team's current players into keepers (locked slots) and mock-drafted picks. */
function rosterEntriesFor(board: DraftSlot[], picks: Picks, teamId: number) {
  const keepers: MockPlayer[] = [];
  const drafted: MockPlayer[] = [];
  for (const s of board) {
    if (s.teamId !== teamId) continue;
    if (s.locked) keepers.push(s.locked);
    else {
      const p = picks[key(s.round, s.slot)];
      if (p) drafted.push(p);
    }
  }
  return { keepers, drafted };
}

const POS_COLOR: Record<string, string> = {
  QB: "#29c5e6",
  RB: "#f0883e",
  WR: "#f0c33c",
  TE: "#3cb878",
  K: "#c9ccd1",
  DEF: "#aab4c1",
};

const UNDERDOG_POS_COLOR: Record<string, string> = {
  QB: "#a65bd4",
  RB: "#2fb39f",
  WR: "#f18b3a",
  TE: "#4aa6d8",
  K: "#aeb6c0",
  DEF: "#8792a2",
};

const UNDERDOG_HEADER_POSITIONS = ["QB", "RB", "WR", "TE"] as const satisfies readonly UnderdogHeaderPosition[];
type UnderdogPickerPosition = "" | UnderdogHeaderPosition;

function canFillLineupSlot(label: LineupSlot, player: MockPlayer) {
  if (label === "BN") return true;
  if (label === "RB/WR") return player.pos === "RB" || player.pos === "WR";
  return player.pos === label;
}

function teamHeaderStyle(team?: TeamMeta) {
  if (!team) return undefined;
  return {
    background: `linear-gradient(90deg, ${team.primary}, ${team.secondary}) top / 100% 3px no-repeat, var(--section)`,
  };
}

function PickedPlayer({ player }: { player: MockPlayer }) {
  return (
    <>
      <div className="grid w-full place-items-center px-1 py-2">
        <SleeperPlayerAvatar sleeperId={player.sleeperId ?? ""} pos={player.pos} name={player.name} size="md" />
      </div>
      <div className="w-full truncate px-1 text-[11px] font-semibold leading-tight">{player.name}</div>
      <div
        className="mt-1.5 w-full px-1 py-1 font-cond text-[10px] font-bold uppercase text-white"
        style={{ background: POS_COLOR[player.pos] ?? "#9aa1ad" }}
      >
        {player.proTeam} - {player.pos}
      </div>
    </>
  );
}

function compactPlayerName(name: string) {
  const parts = name.split(" ");
  if (parts.length < 2) return name;
  const [first, ...rest] = parts;
  return `${first[0]}. ${rest.join(" ")}`;
}

function overallPick(round: number, slot: number, columnCount: number) {
  return (round - 1) * columnCount + slot;
}

function columnForSlot(slot: DraftSlot, columnCount: number) {
  return Math.min(slot.slot, columnCount);
}

function positionCountsFor(board: DraftSlot[], picks: Picks, teamId: number) {
  const { keepers, drafted } = rosterEntriesFor(board, picks, teamId);
  const roster = [...keepers, ...drafted];
  return Object.fromEntries(
    UNDERDOG_HEADER_POSITIONS.map((pos) => [pos, roster.filter((player) => player.pos === pos).length])
  ) as Record<UnderdogHeaderPosition, number>;
}

function displayLineupLabel(label: LineupSlot) {
  return label === "RB/WR" ? "FLEX" : label;
}

function positionSummary(counts: Record<UnderdogHeaderPosition, number>) {
  return UNDERDOG_HEADER_POSITIONS.map((pos) => `${pos} ${counts[pos]}`).join(" / ");
}

function firstPickPosition(board: DraftSlot[], teamId: number, columnCount: number) {
  const firstPick = board
    .filter((slot) => slot.teamId === teamId && slot.round <= 11)
    .sort((a, b) => overallPick(a.round, a.slot, columnCount) - overallPick(b.round, b.slot, columnCount))[0];
  return firstPick?.slot ?? "-";
}

function UnderdogRosterPanel({
  board,
  picks,
  rows,
  teams,
  team,
  selectedTeamId,
  isComplete,
  className = "",
  onTeamChange,
}: {
  board: DraftSlot[];
  picks: Picks;
  rows: LineupRow[];
  teams: TeamMeta[];
  team?: TeamMeta;
  selectedTeamId: number | null;
  isComplete: boolean;
  className?: string;
  onTeamChange: (teamId: number) => void;
}) {
  const columnCount = Math.max(...board.map((slot) => slot.slot));
  const counts = team
    ? positionCountsFor(board, picks, team.id)
    : (Object.fromEntries(UNDERDOG_HEADER_POSITIONS.map((pos) => [pos, 0])) as Record<
        UnderdogHeaderPosition,
        number
      >);
  const rostered = rows.filter((row) => row.player).length;
  const projectedTotal = rows.reduce((sum, row) => sum + (row.player?.projected ?? 0), 0);
  const sections = rows.reduce<{ label: string; rows: LineupRow[] }[]>((acc, row) => {
    const label = displayLineupLabel(row.label);
    const current = acc[acc.length - 1];
    if (current?.label === label) current.rows.push(row);
    else acc.push({ label, rows: [row] });
    return acc;
  }, []);

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#2b2b2b] bg-[#0d0d0d] text-white shadow-sm ${className}`}>
      <div className="border-b border-[#232323] px-2.5 py-2">
        <select
          value={selectedTeamId ?? ""}
          onChange={(e) => onTeamChange(Number(e.target.value))}
          className="w-full bg-[#0d0d0d] font-cond text-[13px] font-extrabold uppercase text-white outline-none"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id} className="bg-[#0d0d0d] text-white">
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="px-2.5 py-3 text-center">
        {team && (
          <div className="mx-auto mb-2 grid place-items-center">
            <TeamAvatar team={team} size="lg" />
          </div>
        )}
        <div className="mx-auto grid max-w-44 grid-cols-2 gap-2">
          <div>
            <div className="font-cond text-lg font-extrabold">{team ? firstPickPosition(board, team.id, columnCount) : "-"}</div>
            <div className="text-[11px] font-semibold text-white/70">Pick position</div>
          </div>
          <div>
            <div className="font-cond text-lg font-extrabold">{projectedTotal ? projectedTotal.toFixed(1) : rostered}</div>
            <div className="text-[11px] font-semibold text-white/70">{projectedTotal ? "Projected" : isComplete ? "Rostered" : "Players"}</div>
          </div>
        </div>
        <div className="mx-auto mt-2 grid h-1.5 max-w-44 grid-cols-4 overflow-hidden rounded-full bg-[#242424]">
          {UNDERDOG_HEADER_POSITIONS.map((pos) => (
            <span
              key={pos}
              className={counts[pos] ? "opacity-100" : "opacity-35"}
              style={{ background: UNDERDOG_POS_COLOR[pos] }}
            />
          ))}
        </div>
        <div className="mx-auto mt-1 grid max-w-44 grid-cols-4 gap-1">
          {UNDERDOG_HEADER_POSITIONS.map((pos) => (
            <div key={pos} className="text-center">
              <div className="font-cond text-[11px] font-extrabold leading-none" style={{ color: UNDERDOG_POS_COLOR[pos] }}>
                {pos}
              </div>
              <div className="font-cond text-sm font-extrabold leading-tight text-white">{counts[pos]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="px-2.5 pb-1 pt-2.5 font-cond text-base font-extrabold leading-none text-white">{section.label}</div>
            {section.rows.map(({ label, player, draftSlot }, i) => (
              <div
                key={draftSlot ? key(draftSlot.round, draftSlot.slot) : `${label}-${i}`}
                className="flex items-center gap-2 border-b border-[#2a2a2a] px-2.5 py-2 last:border-b-0"
              >
                {player ? (
                  <SleeperPlayerAvatar sleeperId={player.sleeperId ?? ""} pos={player.pos} name={player.name} size="sm" />
                ) : (
                  <span className="h-8 w-8 shrink-0 rounded-full bg-white/10" />
                )}
                <div className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-semibold leading-tight text-white">
                    {player?.name ?? `Empty ${displayLineupLabel(label)}`}
                  </div>
                  <div className="truncate text-xs font-semibold text-white/65">{player?.proTeam ?? "-"}</div>
                </div>
                <div className="grid w-[6.3rem] shrink-0 grid-cols-3 gap-1 text-right">
                  <div>
                    <div className="font-cond text-[13px] font-extrabold leading-none text-white">{player?.bye ?? "-"}</div>
                    <div className="text-[10px] font-semibold text-white/55">Bye</div>
                  </div>
                  <div>
                    <div className="font-cond text-[13px] font-extrabold leading-none text-white">{player?.adp ?? player?.rank ?? "-"}</div>
                    <div className="text-[10px] font-semibold text-white/55">ADP</div>
                  </div>
                  <div>
                    <div className="font-cond text-[13px] font-extrabold leading-none text-white">
                      {draftSlot ? `${draftSlot.round}.${draftSlot.slot}` : "-"}
                    </div>
                    <div className="text-[10px] font-semibold text-white/55">Pick</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDraftNumber(value?: number) {
  return typeof value === "number" ? value.toFixed(1) : "-";
}

function UnderdogPlayerPickerPanel({
  targetSlot,
  current,
  players,
  query,
  position,
  positionRanks,
  className = "",
  onQueryChange,
  onPositionChange,
  onPick,
  onClear,
  onCancel,
}: {
  targetSlot: DraftSlot | null;
  current?: MockPlayer;
  players: MockPlayer[];
  query: string;
  position: UnderdogPickerPosition;
  positionRanks: Map<string, number>;
  className?: string;
  onQueryChange: (query: string) => void;
  onPositionChange: (position: UnderdogPickerPosition) => void;
  onPick: (player: MockPlayer) => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  const team = targetSlot ? teamById(targetSlot.teamId) : undefined;
  const canPick = Boolean(targetSlot);

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden border border-[#444] bg-[#191919] text-white shadow-sm ${className}`}>
      <div className="relative border-b border-[#2c2c2c] px-3 py-2 text-center">
        <div className="font-cond text-base font-extrabold">Players</div>
        <div className="mt-0.5 truncate text-[11px] font-semibold text-white/55">
          {targetSlot ? (
            <>
              Pick {targetSlot.round}.{targetSlot.slot} - {team?.name ?? "Team"}
              {current ? ` - ${current.name}` : ""}
            </>
          ) : (
            "Select a pick"
          )}
        </div>
        <div className="absolute right-2 top-2 flex items-center gap-2">
          {current && (
            <button type="button" onClick={onClear} className="font-cond text-[11px] font-bold uppercase text-white/55 hover:text-white">
              Clear
            </button>
          )}
          <button type="button" onClick={onCancel} className="font-cond text-[11px] font-bold uppercase text-white/55 hover:text-white">
            Close
          </button>
        </div>
      </div>

      <div className="border-b border-[#292929] p-2.5">
        <div className="grid grid-cols-[minmax(5.5rem,1.15fr)_repeat(4,minmax(0,1fr))] gap-1.5">
          <input
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search"
            className="min-w-0 rounded-sm border border-white/35 bg-[#2c2c2c] px-2 py-2 text-sm font-semibold text-white outline-none placeholder:text-white/45 focus:border-white/70"
          />
          {UNDERDOG_HEADER_POSITIONS.map((pos) => {
            const selected = position === pos;
            return (
              <button
                key={pos}
                type="button"
                onClick={() => onPositionChange(selected ? "" : pos)}
                className={`rounded-sm px-2 py-2 font-cond text-sm font-extrabold uppercase text-white transition ${
                  selected ? "brightness-110 ring-2 ring-white/40" : "brightness-90 hover:brightness-105"
                }`}
                style={{ background: UNDERDOG_POS_COLOR[pos] }}
              >
                {pos}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_4.3rem_4.3rem_1.4rem] gap-2 border-b border-[#303030] px-3 py-2 text-right font-cond text-[13px] font-extrabold text-white/80">
        <span />
        <span>ADP</span>
        <span>Proj</span>
        <span />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {players.slice(0, 80).map((player) => {
          const color = UNDERDOG_POS_COLOR[player.pos] ?? "#8f98a3";
          const positionRank = player.underdogPositionRank ?? `${player.pos}${positionRanks.get(player.name) ?? ""}`;

          return (
            <button
              key={player.name}
              type="button"
              onClick={() => canPick && onPick(player)}
              disabled={!canPick}
              className="grid min-h-[3.25rem] w-full grid-cols-[1fr_4.3rem_4.3rem_1.4rem] items-center gap-2 border-b border-[#303030] bg-[#1b1b1b] px-3 py-2 text-left last:border-b-0 hover:bg-[#242424] disabled:cursor-default disabled:opacity-60"
              style={{ boxShadow: `inset 3px 0 0 ${color}` }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center text-xl leading-none text-white/75">☆</span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold leading-tight text-white">{player.name}</div>
                  <div className="mt-1 flex min-w-0 items-center gap-1 text-xs font-semibold text-white/70">
                    <span
                      className="shrink-0 rounded px-1 py-0.5 font-cond text-[10px] font-extrabold uppercase leading-none text-white"
                      style={{ background: color }}
                    >
                      {positionRank}
                    </span>
                    <span className="truncate">
                      {player.proTeam}
                      {player.bye ? `, Bye ${player.bye}` : ""}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right font-cond text-sm font-extrabold text-white/85">{formatDraftNumber(player.adp ?? player.rank)}</div>
              <div className="text-right font-cond text-sm font-extrabold text-white/85">{formatDraftNumber(player.projected)}</div>
              <div className="text-center font-cond text-lg font-extrabold text-white/65">v</div>
            </button>
          );
        })}
        {players.length === 0 && <div className="px-3 py-4 text-sm font-semibold text-white/55">No players match.</div>}
      </div>
    </div>
  );
}

function UnderdogTeamPickTag({ team, dark = false }: { team?: TeamMeta; dark?: boolean }) {
  return (
    <div
      title={team ? `${team.name} pick` : "Team pick"}
      className={`absolute left-1.5 top-1 z-20 flex max-w-[5rem] items-center gap-1 rounded px-1 py-0.5 font-cond text-[9px] font-extrabold uppercase ${
        dark ? "bg-white/10 text-white/75" : "bg-black/20 text-black/70"
      }`}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: team ? `linear-gradient(135deg, ${team.primary}, ${team.secondary})` : "#8f98a3" }}
      />
      <span className="truncate">{team?.abbrev ?? "FA"}</span>
    </div>
  );
}

function UnderdogPlayerImage({ player }: { player: MockPlayer }) {
  const [failed, setFailed] = useState(false);
  const image = player.sleeperId ? sleeperPlayerImage(player.sleeperId) : null;

  if (!image || failed) {
    return (
      <span
        className="absolute bottom-1 right-1 grid h-12 w-12 place-items-center rounded-full font-cond text-xs font-bold text-white/95"
        style={{ background: "rgba(0,0,0,0.28)" }}
      >
        {player.pos}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.url}
      alt={player.name}
      width={66}
      height={66}
      onError={() => setFailed(true)}
      className={`absolute bottom-0 right-0 h-16 w-16 ${
        image.isLogo ? "object-contain p-2" : "object-cover object-top"
      }`}
    />
  );
}

function UnderdogPickCard({
  slot,
  picked,
  columnCount,
  isOnClock,
  isUserSlot,
  isDimmed,
  compact,
  canEdit,
  onOpen,
}: {
  slot: DraftSlot;
  picked?: MockPlayer;
  columnCount: number;
  isOnClock: boolean;
  isUserSlot: boolean;
  isDimmed: boolean;
  compact: boolean;
  canEdit: boolean;
  onOpen: () => void;
}) {
  const team = teamById(slot.teamId);
  const pickLabel = `${slot.round}.${slot.slot}`;
  const pickNumber = overallPick(slot.round, slot.slot, columnCount);
  const direction = ">";
  const baseClass =
    "relative h-20 min-w-0 overflow-hidden rounded-md border text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-white/70";
  const clockClass = isOnClock ? "ring-2 ring-[#f5d15f] ring-offset-1 ring-offset-[#101010]" : "";
  const focusClass = isDimmed ? "opacity-25" : "opacity-100";
  const pickedTextPad = compact ? "p-1.5 pr-10 pt-5" : "p-2 pr-12 pt-5";
  const playerNameClass = compact ? "text-[13px]" : "text-sm";

  if (picked) {
    const bg = UNDERDOG_POS_COLOR[picked.pos] ?? "#aeb6c0";
    const content = (
      <>
        <UnderdogTeamPickTag team={team} />
        <div className="absolute right-1.5 top-1 text-[10px] font-bold text-black/40">#{pickNumber}</div>
        {slot.locked && (
          <div className="absolute right-1.5 top-4 rounded bg-black/20 px-1 font-cond text-[9px] font-bold uppercase text-black/65">
            Keep
          </div>
        )}
        <div className={`relative z-10 flex h-full flex-col justify-between ${pickedTextPad} text-[#111418]`}>
          <div className="min-w-0">
            <div className={`truncate font-cond font-extrabold uppercase leading-none ${playerNameClass}`}>
              {compactPlayerName(picked.name)}
            </div>
            <div className="mt-1 truncate text-[10px] font-bold uppercase text-black/55">
              {picked.pos} - {picked.proTeam}
              {picked.bye ? ` (${picked.bye})` : ""}
            </div>
          </div>
          <div className="flex items-center gap-1 font-cond text-base font-extrabold leading-none text-black/70">
            {pickLabel} <span className="text-black/45">{direction}</span>
          </div>
        </div>
        <UnderdogPlayerImage player={picked} />
      </>
    );

    if (canEdit) {
      return (
        <button
          type="button"
          onClick={onOpen}
          title="Change this pick"
          className={`${baseClass} ${clockClass} ${focusClass} border-black/60 hover:brightness-105`}
          style={{ background: bg }}
        >
          {content}
        </button>
      );
    }

    return (
      <div className={`${baseClass} ${clockClass} ${focusClass} border-black/60`} style={{ background: bg }}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!canEdit}
      className={`${baseClass} ${clockClass} ${focusClass} border-[#2a2a2a] bg-[#1b1b1b] p-2 text-white disabled:cursor-default`}
    >
      <UnderdogTeamPickTag team={team} dark />
      <div className="absolute right-1.5 top-1 text-[10px] font-bold text-white/30">#{pickNumber}</div>
      <div className="flex h-full flex-col justify-between pt-5">
        <div>
          <div className="truncate pr-8 font-cond text-xs font-bold uppercase text-white/70">
            {team?.name ?? "Team pick"}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {(TEAM_NEEDS[slot.teamId] ?? []).slice(0, 3).map((need) => (
              <span key={need} className="rounded bg-white/10 px-1 font-cond text-[9px] font-bold text-white/55">
                {need}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-end justify-between gap-2">
          <span className="font-cond text-base font-extrabold leading-none text-white/80">
            {pickLabel} <span className="text-white/35">{direction}</span>
          </span>
          {slot.round <= 11 && (
            <span
              className={`rounded px-1.5 py-0.5 font-cond text-[10px] font-bold uppercase ${
                isOnClock && isUserSlot ? "bg-[#f5d15f] text-[#17130a]" : "bg-white/10 text-white/60"
              }`}
            >
              {isOnClock ? (isUserSlot ? "Make" : "Auto") : "Pick"}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function UnderdogDraftBoard({
  board,
  rounds,
  teams,
  picks,
  userTeamId,
  focusedTeamId,
  isManual,
  compact,
  onTheClockKey,
  openSearch,
}: {
  board: DraftSlot[];
  rounds: [number, DraftSlot[]][];
  teams: TeamMeta[];
  picks: Picks;
  userTeamId: number | null;
  focusedTeamId: number | null;
  isManual: boolean;
  compact: boolean;
  onTheClockKey: string | null;
  openSearch: (slot: DraftSlot) => void;
}) {
  const columnCount = Math.max(...board.map((slot) => slot.slot));
  const gridStyle = { gridTemplateColumns: compact ? `repeat(${columnCount}, minmax(0, 1fr))` : `repeat(${columnCount}, 8.75rem)` };
  const gridClass = compact ? "grid w-full min-w-0 gap-1" : "grid min-w-max gap-1.5";
  const headerTeams = teams.slice(0, columnCount).reverse();
  const rows = rounds.map(([round, slots]) => {
    const cells: (DraftSlot | undefined)[] = Array(columnCount);
    for (const slot of slots) cells[columnForSlot(slot, columnCount) - 1] = slot;
    return { round, cells };
  });

  return (
    <div className="overflow-x-auto rounded-xl bg-[#101010] p-1.5 shadow-sm">
      <div className={gridClass} style={gridStyle}>
        {headerTeams.map((team) => {
          const counts = positionCountsFor(board, picks, team.id);
          const isFocusedHeader = focusedTeamId == null || team.id === focusedTeamId;
          return (
            <div
              key={team.id}
              className={`h-[7.35rem] rounded-md border border-[#2b2b2b] bg-[#171717] p-2 text-white transition-opacity ${
                isFocusedHeader ? "opacity-100" : "opacity-25"
              }`}
            >
              <div className="flex h-full flex-col items-center justify-between gap-1 text-center">
                <TeamAvatar team={team} size="sm" />
                <div className="w-full truncate font-cond text-[13px] font-extrabold uppercase leading-none">{team.name}</div>
                <div className="grid w-full grid-cols-4 gap-1">
                  {UNDERDOG_HEADER_POSITIONS.map((pos) => (
                    <div key={pos} className="min-w-0 text-center">
                      <div
                        className="font-cond text-[10px] font-extrabold leading-none"
                        style={{ color: UNDERDOG_POS_COLOR[pos] }}
                      >
                        {pos}
                      </div>
                      <div className="font-cond text-sm font-extrabold leading-tight text-white/90">{counts[pos]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {rows.map(({ round, cells }) =>
          cells.map((slot, i) => {
            if (!slot) return <div key={`${round}-${i}`} className="h-20 rounded-md bg-[#151515]" />;
            const k = key(slot.round, slot.slot);
            const picked = slot.locked ?? picks[k];
            const isOnClock = k === onTheClockKey;
            const isUserSlot = isManual || slot.teamId === userTeamId;
            const isDimmed = focusedTeamId != null && slot.teamId !== focusedTeamId;
            const canEdit = slot.round <= 11 && !slot.locked;
            return (
              <UnderdogPickCard
                key={k}
                slot={slot}
                picked={picked}
                columnCount={columnCount}
                isOnClock={isOnClock}
                isUserSlot={isUserSlot}
                isDimmed={isDimmed}
                compact={compact}
                canEdit={canEdit}
                onOpen={() => openSearch(slot)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function DraftCompletePrompt({ onViewAnalysis, onDismiss }: { onViewAnalysis: () => void; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#111] p-5 text-white shadow-2xl">
        <div className="font-cond text-xl font-extrabold uppercase">Draft complete</div>
        <p className="mt-2 text-sm font-medium text-white/70">
          Your board is filled. Open the draft analysis for team rankings, best picks, projected totals, and roster balance.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md border border-white/15 px-3 py-2 font-cond text-xs font-bold uppercase text-white/65 hover:bg-white/10 hover:text-white"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onViewAnalysis}
            className="rounded-md bg-teal px-3 py-2 font-cond text-xs font-bold uppercase text-white hover:brightness-110"
          >
            View draft analysis
          </button>
        </div>
      </div>
    </div>
  );
}

function DraftAnalysisModal({
  rankings,
  highlights,
  onClose,
}: {
  rankings: DraftAnalysisTeam[];
  highlights: DraftAnalysisHighlight[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 px-3 py-5">
      <div className="flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#111] text-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <div className="font-cond text-xl font-extrabold uppercase leading-none">Draft analysis</div>
            <div className="mt-1 text-xs font-semibold text-white/55">12 team rankings, projected totals, value picks, and roster builds</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-white/15 px-3 py-1.5 font-cond text-xs font-bold uppercase text-white/65 hover:bg-white/10 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto p-4">
          <div className="grid gap-2 md:grid-cols-4">
            {highlights.map((item) => (
              <div key={item.title} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <div className="font-cond text-[11px] font-extrabold uppercase text-white/45">{item.title}</div>
                <div className="mt-1 truncate font-cond text-lg font-extrabold text-white">{item.value}</div>
                <div className="mt-1 text-xs font-semibold leading-snug text-white/60">{item.detail}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
            <div className="min-w-[56rem]">
              <div className="grid grid-cols-[3rem_minmax(12rem,1fr)_5rem_5.5rem_5.5rem_7.5rem_minmax(10rem,1fr)] gap-3 border-b border-white/10 bg-white/[0.05] px-3 py-2 font-cond text-[11px] font-extrabold uppercase text-white/55">
                <span>Rank</span>
                <span>Team</span>
                <span className="text-right">Score</span>
                <span className="text-right">Proj</span>
                <span className="text-right">Starters</span>
                <span>Build</span>
                <span>Best Pick</span>
              </div>
              {rankings.map((entry, index) => (
                <div
                  key={entry.team.id}
                  className="grid grid-cols-[3rem_minmax(12rem,1fr)_5rem_5.5rem_5.5rem_7.5rem_minmax(10rem,1fr)] items-center gap-3 border-b border-white/10 px-3 py-2 last:border-b-0"
                >
                  <div className="font-cond text-lg font-extrabold text-white/80">#{index + 1}</div>
                  <div className="flex min-w-0 items-center gap-2">
                    <TeamAvatar team={entry.team} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate font-cond text-sm font-extrabold uppercase text-white">{entry.team.name}</div>
                      <div className="truncate text-[11px] font-semibold text-white/45">
                        Avg ADP {entry.avgAdp == null ? "-" : formatDraftNumber(entry.avgAdp)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-cond text-base font-extrabold">{formatDraftNumber(entry.totalScore)}</div>
                  <div className="text-right font-cond text-sm font-extrabold text-white/80">{formatDraftNumber(entry.projected)}</div>
                  <div className="text-right font-cond text-sm font-extrabold text-white/80">{formatDraftNumber(entry.startersProjected)}</div>
                  <div className="truncate text-xs font-semibold text-white/65">{positionSummary(entry.positionCounts)}</div>
                  <div className="min-w-0">
                    {entry.bestValue ? (
                      <>
                        <div className="truncate text-sm font-semibold text-white">{entry.bestValue.player.name}</div>
                        <div className="text-[11px] font-semibold text-white/50">
                          {entry.bestValue.draftSlot.round}.{entry.bestValue.draftSlot.slot}, {formatDraftNumber(entry.bestValue.value)} past ADP
                        </div>
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-white/45">No ADP value</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MockDraftBoard({
  board,
  players,
  teams,
}: {
  board: DraftSlot[];
  players: MockPlayer[];
  teams: TeamMeta[];
}) {
  const [picks, setPicks] = useState<Picks>({});
  const [userTeamId, setUserTeamId] = useState<number | null>(null);
  const [viewTeamId, setViewTeamId] = useState<number | null>(null);
  const [focusTeamId, setFocusTeamId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<DraftViewMode>("classic");
  const [showUnderdogRoster, setShowUnderdogRoster] = useState(true);
  const [underdogPickerPlacement, setUnderdogPickerPlacement] = useState<UnderdogPickerPlacement>("left");
  const [underdogPickerPosition, setUnderdogPickerPosition] = useState<UnderdogPickerPosition>("");
  const [showDraftAnalysis, setShowDraftAnalysis] = useState(false);
  const [analysisPromptDismissed, setAnalysisPromptDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [searchKey, setSearchKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const rankByName = useMemo(() => new Map(players.map((p) => [p.name, p.rank ?? 9999])), [players]);
  const positionRanks = useMemo(() => {
    const counts: Record<string, number> = {};
    const ranks = new Map<string, number>();
    for (const player of players.slice().sort((a, b) => draftValue(a) - draftValue(b))) {
      counts[player.pos] = (counts[player.pos] ?? 0) + 1;
      ranks.set(player.name, counts[player.pos]);
    }
    return ranks;
  }, [players]);

  useEffect(() => {
    // One-time hydration load from localStorage. Reading on the client only
    // (not in a lazy initializer) keeps SSR and first client render in sync,
    // so the synchronous setState here is intentional.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPicks(JSON.parse(raw));
      const team = localStorage.getItem(TEAM_STORAGE_KEY);
      setUserTeamId(team ? Number(team) : teams[0]?.id ?? null);
      const savedView = localStorage.getItem(VIEW_STORAGE_KEY);
      if (savedView === "classic" || savedView === "underdog") setViewMode(savedView);
    } catch {
      // ignore corrupt storage
    }
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [teams]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(picks));
  }, [picks, loaded]);

  useEffect(() => {
    if (!loaded || userTeamId == null) return;
    localStorage.setItem(TEAM_STORAGE_KEY, String(userTeamId));
  }, [userTeamId, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode, loaded]);

  const taken = useMemo(() => {
    const names = new Set<string>();
    for (const slot of board) if (slot.locked) names.add(slot.locked.name);
    for (const p of Object.values(picks)) names.add(p.name);
    return names;
  }, [board, picks]);

  const draftable = useMemo(() => board.filter((s) => s.round <= 11 && !s.locked), [board]);
  const draftableIndexByKey = useMemo(
    () => new Map(draftable.map((slot, index) => [key(slot.round, slot.slot), index])),
    [draftable]
  );
  const onTheClockIndex = useMemo(() => draftable.findIndex((s) => !picks[key(s.round, s.slot)]), [draftable, picks]);
  const onTheClock = onTheClockIndex === -1 ? null : draftable[onTheClockIndex];
  const onTheClockKey = onTheClock ? key(onTheClock.round, onTheClock.slot) : null;
  const picksAway = onTheClockIndex === -1 ? 0 : draftable.length - onTheClockIndex;
  const searchSlot = useMemo(() => (searchKey ? board.find((s) => key(s.round, s.slot) === searchKey) ?? null : null), [board, searchKey]);
  const searchCurrent = searchSlot ? picks[key(searchSlot.round, searchSlot.slot)] : undefined;
  const pickerSlot = searchSlot ?? onTheClock;
  const pickerCurrent = pickerSlot ? picks[key(pickerSlot.round, pickerSlot.slot)] : undefined;

  const rounds = useMemo(() => {
    const map = new Map<number, DraftSlot[]>();
    for (const slot of board) {
      const arr = map.get(slot.round) ?? [];
      arr.push(slot);
      map.set(slot.round, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [board]);

  const makePick = useCallback(
    (round: number, slot: number, player: MockPlayer) => {
      const k = key(round, slot);
      const targetIndex = draftableIndexByKey.get(k);
      if (targetIndex == null || targetIndex < draftable.length - 1) {
        setShowDraftAnalysis(false);
        setAnalysisPromptDismissed(false);
      }
      setPicks((prev) => {
        if (targetIndex == null) return { ...prev, [k]: player };

        const next: Picks = {};
        for (const [pickKey, picked] of Object.entries(prev)) {
          const pickIndex = draftableIndexByKey.get(pickKey);
          if (pickIndex != null && pickIndex < targetIndex) next[pickKey] = picked;
        }
        next[k] = player;
        return next;
      });
      // Only close the search panel if it was open for this slot — an autopick
      // landing elsewhere shouldn't cancel a search the user is browsing.
      if (searchKey === k) {
        setSearchKey(null);
        setQuery("");
      }
    },
    [draftable.length, draftableIndexByKey, searchKey]
  );

  function clearPick(round: number, slot: number) {
    const k = key(round, slot);
    const targetIndex = draftableIndexByKey.get(k);
    setShowDraftAnalysis(false);
    setAnalysisPromptDismissed(false);
    setPicks((prev) => {
      if (targetIndex == null) {
        const next = { ...prev };
        delete next[k];
        return next;
      }

      const next = { ...prev };
      for (const pickKey of Object.keys(next)) {
        const pickIndex = draftableIndexByKey.get(pickKey);
        if (pickIndex == null || pickIndex >= targetIndex) delete next[pickKey];
      }
      return next;
    });
    if (searchKey === k) {
      setSearchKey(null);
      setQuery("");
    }
  }

  function resetAll() {
    setPicks({});
    setShowDraftAnalysis(false);
    setAnalysisPromptDismissed(false);
    localStorage.removeItem(STORAGE_KEY);
  }

  function changeTeam(id: number) {
    setUserTeamId(id);
    resetAll();
  }

  const openSearch = useCallback((slot: DraftSlot) => {
    setSearchKey(key(slot.round, slot.slot));
    setQuery("");
    setUnderdogPickerPlacement((placement) => (placement === "hidden" ? "left" : placement));
  }, []);

  /** Fills every remaining draftable slot with a realistic autopick for that team. */
  function autodraftRest() {
    const usedNames = new Set(taken);
    const next: Picks = { ...picks };
    setShowDraftAnalysis(false);
    setAnalysisPromptDismissed(false);
    for (const [i, slot] of draftable.entries()) {
      const k = key(slot.round, slot.slot);
      if (next[k]) continue;
      const { keepers, drafted } = rosterEntriesFor(board, next, slot.teamId);
      const pick = computeAutopick({
        overallPick: i + 1,
        teamId: slot.teamId,
        available: players.filter((p) => !usedNames.has(p.name)),
        roster: [...keepers, ...drafted],
        drafted,
        remainingPicks: draftable.filter((s) => s.teamId === slot.teamId && !next[key(s.round, s.slot)]).length,
      });
      if (!pick) break;
      usedNames.add(pick.name);
      next[k] = pick;
    }
    setPicks(next);
  }

  const availableForSlot = useCallback(
    (slot: DraftSlot | null) => {
      const blocked = new Set<string>();
      for (const boardSlot of board) if (boardSlot.locked) blocked.add(boardSlot.locked.name);

      const targetIndex = slot ? draftableIndexByKey.get(key(slot.round, slot.slot)) : undefined;
      if (targetIndex != null) {
        for (const draftSlot of draftable) {
          const pickKey = key(draftSlot.round, draftSlot.slot);
          const pickIndex = draftableIndexByKey.get(pickKey);
          if (pickIndex == null || pickIndex >= targetIndex) continue;

          const picked = picks[pickKey];
          if (picked) blocked.add(picked.name);
        }
      } else {
        for (const picked of Object.values(picks)) blocked.add(picked.name);
      }

      return players.filter((player) => !blocked.has(player.name));
    },
    [board, draftable, draftableIndexByKey, picks, players]
  );

  const available = useMemo(
    () =>
      availableForSlot(pickerSlot).filter((p) =>
        query ? p.name.toLowerCase().includes(query.toLowerCase()) || p.pos.toLowerCase() === query.toLowerCase() : true
      ),
    [availableForSlot, pickerSlot, query]
  );
  const underdogAvailable = useMemo(
    () => available.filter((player) => (underdogPickerPosition ? player.pos === underdogPickerPosition : true)),
    [available, underdogPickerPosition]
  );

  // Autopick for every team except the one the user is controlling (nobody in
  // manual mode) — need- and roster-aware, with a little randomness so runs differ.
  useEffect(() => {
    if (!loaded || userTeamId == null || userTeamId === MANUAL_TEAM_ID || !onTheClock || onTheClock.teamId === userTeamId)
      return;
    // Pause the clock while the user is browsing players for the on-clock slot.
    if (searchKey && searchKey === key(onTheClock.round, onTheClock.slot)) return;
    const { keepers, drafted } = rosterEntriesFor(board, picks, onTheClock.teamId);
    const pick = computeAutopick({
      overallPick: onTheClockIndex + 1,
      teamId: onTheClock.teamId,
      available: availableForSlot(onTheClock),
      roster: [...keepers, ...drafted],
      drafted,
      remainingPicks: draftable.filter((s) => s.teamId === onTheClock.teamId && !picks[key(s.round, s.slot)]).length,
    });
    if (!pick) return;
    const timeout = setTimeout(() => makePick(onTheClock.round, onTheClock.slot, pick), AUTOPICK_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [loaded, userTeamId, onTheClock, onTheClockIndex, availableForSlot, board, picks, draftable, searchKey, makePick]);

  const isManual = userTeamId === MANUAL_TEAM_ID;
  const isUsersClock = !!onTheClock && (isManual || onTheClock.teamId === userTeamId);
  const isComplete = !onTheClock;

  const lineupFor = useMemo(() => {
    const rankOf = (player: MockPlayer) => player.rank ?? rankByName.get(player.name) ?? 9999;
    const sortByBestAvailable = (a: Required<Pick<LineupRow, "player" | "draftSlot">>, b: Required<Pick<LineupRow, "player" | "draftSlot">>) =>
      rankOf(a.player) - rankOf(b.player) ||
      a.draftSlot.round - b.draftSlot.round ||
      a.draftSlot.slot - b.draftSlot.slot;

    return (teamId: number) => {
      const remaining = board
        .filter((s) => s.teamId === teamId)
        .map((s) => ({ slot: s, player: s.locked ?? picks[key(s.round, s.slot)] }))
        .filter((row): row is { slot: DraftSlot; player: MockPlayer } => Boolean(row.player))
        .map((row) => ({ draftSlot: row.slot, player: row.player }))
        .sort(sortByBestAvailable);

      const rows: LineupRow[] = STARTING_LINEUP.map((label) => {
        const playerIndex = remaining.findIndex((row) => canFillLineupSlot(label, row.player));
        if (playerIndex === -1) return { label };

        const [row] = remaining.splice(playerIndex, 1);
        return { label, player: row.player, draftSlot: row.draftSlot };
      });

      return [
        ...rows,
        ...remaining.sort(sortByBestAvailable).map((row) => ({
          label: "BN" as const,
          player: row.player,
          draftSlot: row.draftSlot,
        })),
      ];
    };
  }, [board, picks, rankByName]);

  // In manual mode there's no "your team", so the roster viewer starts on the first team.
  const lineupTeamId = viewTeamId ?? (isManual ? teams[0]?.id ?? null : userTeamId ?? teams[0]?.id ?? null);
  const lineupRows = lineupTeamId != null ? lineupFor(lineupTeamId) : [];
  const lineupTeam = teams.find((team) => team.id === lineupTeamId);
  const showUnderdogPicker = viewMode === "underdog" && underdogPickerPlacement !== "hidden";
  const draftAnalysis = useMemo(() => {
    const columnCount = Math.max(...board.map((slot) => slot.slot), 1);

    return teams
      .map((team) => {
        const rows = lineupFor(team.id);
        const filledRows = rows.filter((row): row is FilledLineupRow => Boolean(row.player && row.draftSlot));
        const starterRows = rows
          .slice(0, STARTING_LINEUP.length)
          .filter((row): row is FilledLineupRow => Boolean(row.player && row.draftSlot));
        const projected = filledRows.reduce((sum, row) => sum + (row.player.projected ?? 0), 0);
        const startersProjected = starterRows.reduce((sum, row) => sum + (row.player.projected ?? 0), 0);
        const adpValues = filledRows
          .map((row) => row.player.adp ?? row.player.rank)
          .filter((value): value is number => typeof value === "number");
        const avgAdp = adpValues.length ? adpValues.reduce((sum, value) => sum + value, 0) / adpValues.length : null;
        const valuePicks = filledRows
          .filter((row) => !row.draftSlot.locked && row.draftSlot.round <= 11)
          .map((row) => {
            const expectedPick = row.player.adp ?? row.player.rank;
            if (typeof expectedPick !== "number") return null;

            return {
              ...row,
              value: overallPick(row.draftSlot.round, row.draftSlot.slot, columnCount) - expectedPick,
            };
          })
          .filter((row): row is DraftAnalysisPick => row != null);
        const bestValue = valuePicks
          .filter((row) => row.value > 0)
          .sort((a, b) => b.value - a.value || draftValue(a.player) - draftValue(b.player))[0];
        const topPlayerRow = filledRows
          .slice()
          .sort((a, b) => (b.player.projected ?? 0) - (a.player.projected ?? 0) || draftValue(a.player) - draftValue(b.player))[0];
        const topPlayer = topPlayerRow ? { ...topPlayerRow, value: topPlayerRow.player.projected ?? 0 } : undefined;
        const positionCounts = positionCountsFor(board, picks, team.id);
        const balanceScore =
          Math.min(positionCounts.QB, 1) * 14 +
          Math.min(positionCounts.RB, 4) * 8 +
          Math.min(positionCounts.WR, 5) * 8 +
          Math.min(positionCounts.TE, 1) * 14;
        const valueScore = valuePicks.reduce((sum, row) => sum + Math.max(-10, Math.min(20, row.value)), 0);
        const totalScore = startersProjected + projected * 0.18 + valueScore * 1.6 + balanceScore;

        return {
          team,
          projected,
          startersProjected,
          rostered: filledRows.length,
          avgAdp,
          valueScore,
          balanceScore,
          totalScore,
          positionCounts,
          topPlayer,
          bestValue,
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore || b.projected - a.projected || a.team.name.localeCompare(b.team.name));
  }, [board, picks, teams, lineupFor]);
  const draftAnalysisHighlights = useMemo(() => {
    const bestTeam = draftAnalysis[0];
    if (!bestTeam) return [];

    const bestValueTeam = draftAnalysis
      .filter((entry) => entry.bestValue)
      .sort((a, b) => (b.bestValue?.value ?? -Infinity) - (a.bestValue?.value ?? -Infinity))[0];
    const balancedTeam = draftAnalysis.slice().sort((a, b) => b.balanceScore - a.balanceScore || b.projected - a.projected)[0];
    const topPlayerTeam = draftAnalysis
      .filter((entry) => entry.topPlayer)
      .sort((a, b) => (b.topPlayer?.value ?? -Infinity) - (a.topPlayer?.value ?? -Infinity))[0];

    const highlights: DraftAnalysisHighlight[] = [
      {
        title: "Top roster",
        value: bestTeam.team.name,
        detail: `${formatDraftNumber(bestTeam.projected)} projected points with a ${formatDraftNumber(bestTeam.totalScore)} overall score.`,
      },
      {
        title: "Best build",
        value: balancedTeam.team.name,
        detail: positionSummary(balancedTeam.positionCounts),
      },
      {
        title: "Top scorer",
        value: topPlayerTeam?.topPlayer?.player.name ?? "-",
        detail: topPlayerTeam?.topPlayer
          ? `${topPlayerTeam.team.name}, ${formatDraftNumber(topPlayerTeam.topPlayer.player.projected)} projected points.`
          : "No projected points available.",
      },
      {
        title: "Best value",
        value: bestValueTeam?.bestValue?.player.name ?? "-",
        detail: bestValueTeam?.bestValue
          ? `${bestValueTeam.team.name} got ${formatDraftNumber(bestValueTeam.bestValue.value)} picks of ADP value at ${bestValueTeam.bestValue.draftSlot.round}.${bestValueTeam.bestValue.draftSlot.slot}.`
          : "No positive ADP values found.",
      },
    ];

    return highlights;
  }, [draftAnalysis]);
  const closeDraftAnalysis = useCallback(() => {
    setShowDraftAnalysis(false);
    setAnalysisPromptDismissed(true);
  }, []);
  const renderUnderdogPickerPanel = (className = "") =>
    showUnderdogPicker ? (
      <UnderdogPlayerPickerPanel
        targetSlot={pickerSlot}
        current={pickerCurrent}
        players={underdogAvailable}
        query={query}
        position={underdogPickerPosition}
        positionRanks={positionRanks}
        className={className}
        onQueryChange={setQuery}
        onPositionChange={setUnderdogPickerPosition}
        onPick={(player) => pickerSlot && makePick(pickerSlot.round, pickerSlot.slot, player)}
        onClear={() => pickerSlot && clearPick(pickerSlot.round, pickerSlot.slot)}
        onCancel={() => {
          setSearchKey(null);
          setUnderdogPickerPlacement("hidden");
        }}
      />
    ) : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
        <label className="text-xs font-semibold text-text-muted">Drafting as:</label>
        <select
          value={userTeamId ?? ""}
          onChange={(e) => changeTeam(Number(e.target.value))}
          className="rounded-md border border-border bg-card px-2 py-1 text-sm font-medium"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          <option value={MANUAL_TEAM_ID}>Manual (all teams)</option>
        </select>
        <span className="text-xs text-text-muted">
          {isManual ? "- you make every pick" : "- every other team autopicks"}
        </span>
        <div className="ml-auto inline-flex rounded-lg border border-border bg-card p-0.5 shadow-sm">
          {(["classic", "underdog"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-md px-2.5 py-1 font-cond text-xs font-semibold uppercase ${
                viewMode === mode ? "bg-text text-white" : "text-text-muted hover:bg-card-hover hover:text-text"
              }`}
            >
              {mode === "classic" ? "Classic" : "Underdog"}
            </button>
          ))}
        </div>
        <label className="text-xs font-semibold text-text-muted">Board focus:</label>
        <select
          value={focusTeamId ?? ""}
          onChange={(e) => setFocusTeamId(e.target.value ? Number(e.target.value) : null)}
          className="rounded-md border border-border bg-card px-2 py-1 text-sm font-medium"
        >
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          onClick={autodraftRest}
          className="shrink-0 rounded-lg bg-text px-2.5 py-1 font-cond text-xs font-semibold text-white hover:opacity-90"
        >
          Autodraft All
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-teal px-4 py-2.5 text-white">
        <span className="font-cond text-sm font-semibold">
          {onTheClock ? (
            <>
              On the clock: {onTheClock.round}.{onTheClock.slot} ({teamById(onTheClock.teamId)?.name})
              {isUsersClock ? " - your pick" : " - autopicking..."} - {picksAway} {picksAway === 1 ? "pick" : "picks"} left
            </>
          ) : (
            "Mock draft complete!"
          )}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {isComplete && (
            <button
              type="button"
              onClick={() => setShowDraftAnalysis(true)}
              className="rounded-lg bg-white px-2.5 py-1 font-cond text-xs font-semibold text-teal hover:bg-white/90"
            >
              Analysis
            </button>
          )}
          <button
            onClick={resetAll}
            className="rounded-lg bg-white/15 px-2.5 py-1 font-cond text-xs font-semibold hover:bg-white/25"
          >
            Reset
          </button>
        </div>
      </div>

      {viewMode !== "underdog" && (
        <div className="mb-3 rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-cond text-sm font-semibold">
              {isComplete ? "Full mock draft lineup:" : "Live team roster:"}
            </span>
            <select
              value={lineupTeamId ?? ""}
              onChange={(e) => setViewTeamId(Number(e.target.value))}
              className="rounded-md border border-border bg-card px-2 py-1 text-sm font-medium"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {lineupRows.map(({ label, player, draftSlot }, i) => (
              <div
                key={draftSlot ? key(draftSlot.round, draftSlot.slot) : `${label}-${i}`}
                className="flex items-center gap-2 border-b border-border py-1.5 last:border-0"
              >
                <span className="w-11 shrink-0 text-center font-cond text-xs font-bold text-text-muted">
                  {label}
                </span>
                {player ? (
                  <>
                    <SleeperPlayerAvatar sleeperId={player.sleeperId ?? ""} pos={player.pos} name={player.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{player.name}</span>
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 font-cond text-[10px] font-bold uppercase text-white"
                      style={{ background: POS_COLOR[player.pos] ?? "#9aa1ad" }}
                    >
                      {player.proTeam} - {player.pos}
                    </span>
                  </>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-dim">Empty {label}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {searchSlot && viewMode !== "underdog" && (
        <div className="mb-3 rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-cond text-sm font-semibold">
              Pick {searchSlot.round}.{searchSlot.slot} - {teamById(searchSlot.teamId)?.name}
              {searchCurrent ? ` (now: ${searchCurrent.name})` : ""}
            </span>
            <div className="flex shrink-0 items-center gap-3">
              {searchCurrent && (
                <button
                  onClick={() => clearPick(searchSlot.round, searchSlot.slot)}
                  className="font-cond text-xs font-semibold text-text-dim hover:text-text"
                >
                  Clear pick
                </button>
              )}
              <button onClick={() => setSearchKey(null)} className="font-cond text-xs font-semibold text-text-dim">
                Cancel
              </button>
            </div>
          </div>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search player or position..."
            className="w-full rounded-md border border-border px-2.5 py-1.5 text-sm outline-none focus:border-teal"
          />
          <div className="mt-2 max-h-56 overflow-y-auto">
            {available.slice(0, 40).map((p) => (
              <button
                key={p.name}
                onClick={() => makePick(searchSlot.round, searchSlot.slot, p)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-card-hover"
              >
                <SleeperPlayerAvatar sleeperId={p.sleeperId ?? ""} pos={p.pos} name={p.name} size="sm" />
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <span className="shrink-0 text-xs text-text-muted">
                  {p.pos} - {p.proTeam}
                </span>
              </button>
            ))}
            {available.length === 0 && <div className="px-2 py-1.5 text-sm text-text-muted">No players match.</div>}
          </div>
        </div>
      )}

      {viewMode === "underdog" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-cond text-xs font-semibold uppercase text-text-muted">Players panel:</span>
              <div className="inline-flex rounded-md border border-border bg-card p-0.5 shadow-sm">
                {(["left", "above", "below", "hidden"] as const).map((placement) => (
                  <button
                    key={placement}
                    type="button"
                    onClick={() => setUnderdogPickerPlacement(placement)}
                    className={`rounded px-2 py-1 font-cond text-[11px] font-semibold uppercase ${
                      underdogPickerPlacement === placement
                        ? "bg-text text-white"
                        : "text-text-muted hover:bg-card-hover hover:text-text"
                    }`}
                  >
                    {placement === "hidden" ? "Hide" : placement}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowUnderdogRoster((show) => !show)}
              className="rounded-md border border-border bg-card px-2.5 py-1 font-cond text-xs font-semibold uppercase text-text-muted shadow-sm hover:bg-card-hover hover:text-text"
            >
              {showUnderdogRoster ? "Hide roster" : "Show roster"}
            </button>
          </div>
          {underdogPickerPlacement === "above" && renderUnderdogPickerPanel("h-[24rem] rounded-lg")}
          <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start">
            {underdogPickerPlacement === "left" &&
              renderUnderdogPickerPanel(
                "h-[24rem] rounded-lg xl:sticky xl:top-24 xl:h-[calc(100dvh-7.5rem)] xl:w-80 xl:shrink-0 2xl:w-[22rem]"
              )}
            <div className="min-w-0 flex-1">
              <UnderdogDraftBoard
                board={board}
                rounds={rounds}
                teams={teams}
                picks={picks}
                userTeamId={userTeamId}
                focusedTeamId={focusTeamId}
                isManual={isManual}
                compact={showUnderdogRoster || (showUnderdogPicker && underdogPickerPlacement === "left")}
                onTheClockKey={onTheClockKey}
                openSearch={openSearch}
              />
            </div>
            {showUnderdogRoster && (
              <UnderdogRosterPanel
                board={board}
                picks={picks}
                rows={lineupRows}
                teams={teams}
                team={lineupTeam}
                selectedTeamId={lineupTeamId}
                isComplete={isComplete}
                className="w-full xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7.5rem)] xl:w-64 xl:shrink-0 2xl:w-72"
                onTeamChange={setViewTeamId}
              />
            )}
          </div>
          {underdogPickerPlacement === "below" && renderUnderdogPickerPanel("h-[24rem] rounded-lg")}
        </div>
      ) : (
        <div className="space-y-3">
          {rounds.map(([round, slots]) => (
            <div key={round}>
              <div className="mb-1.5 px-1 font-cond text-xs font-bold uppercase tracking-widest text-text-muted">
                {round <= 11 ? `Round ${round}` : `Round ${round} - Keepers`}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => {
                  const k = key(slot.round, slot.slot);
                  const team = teamById(slot.teamId);
                  const picked = slot.locked ?? picks[k];
                  const isOnClock = k === onTheClockKey;
                  const isUserSlot = isManual || slot.teamId === userTeamId;
                  const isFocusedSlot = focusTeamId == null || slot.teamId === focusTeamId;
                  const canEdit = slot.round <= 11 && !slot.locked;

                  return (
                    <div
                      key={k}
                      className={`flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card text-center shadow-sm transition-opacity ${
                        isOnClock ? "border-teal" : isUserSlot ? "border-teal/40" : "border-border"
                      } ${isFocusedSlot ? "opacity-100" : "opacity-25"}`}
                    >
                      <div
                        className="truncate bg-section px-1 py-1 pt-1.5 text-[10px] font-semibold text-text-muted"
                        style={teamHeaderStyle(team)}
                      >
                        {slot.round}.{slot.slot} ({team?.abbrev ?? "FA"})
                      </div>

                      {picked ? (
                        canEdit ? (
                          <button
                            onClick={() => openSearch(slot)}
                            title="Change this pick"
                            className="flex min-w-0 flex-1 flex-col hover:bg-card-hover"
                          >
                            <PickedPlayer player={picked} />
                          </button>
                        ) : (
                          <PickedPlayer player={picked} />
                        )
                      ) : (
                        <div className="flex flex-1 flex-col items-center justify-between gap-1 px-1.5 py-2">
                          <div className="flex flex-wrap justify-center gap-0.5">
                            {(TEAM_NEEDS[slot.teamId] ?? []).map((n) => (
                              <span
                                key={n}
                                className="rounded bg-section px-1 py-0.5 font-cond text-[9px] font-bold text-text-muted"
                              >
                                {n}
                              </span>
                            ))}
                          </div>
                          {round <= 11 ? (
                            <button
                              onClick={() => openSearch(slot)}
                              className={`w-full rounded-md px-1 py-1 font-cond text-[10px] font-bold ${
                                isOnClock && isUserSlot
                                  ? "bg-teal text-white"
                                  : "bg-section text-text-dim hover:bg-card-hover"
                              }`}
                            >
                              {isOnClock ? (isUserSlot ? "Make Pick" : "Auto...") : "Pick"}
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {loaded && isComplete && !analysisPromptDismissed && !showDraftAnalysis && (
        <DraftCompletePrompt
          onViewAnalysis={() => {
            setShowDraftAnalysis(true);
          }}
          onDismiss={() => setAnalysisPromptDismissed(true)}
        />
      )}
      {loaded && showDraftAnalysis && (
        <DraftAnalysisModal rankings={draftAnalysis} highlights={draftAnalysisHighlights} onClose={closeDraftAnalysis} />
      )}
    </div>
  );
}
