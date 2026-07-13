"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SleeperPlayerAvatar } from "@/components/sleeper-player-avatar";
import { TEAM_NEEDS, computeAutopick, teamById, type DraftSlot, type MockPlayer } from "@/lib/mock-draft";
import type { TeamMeta } from "@/lib/types";

const STORAGE_KEY = "mgl-mock-draft-2026-v1";
const TEAM_STORAGE_KEY = "mgl-mock-draft-team-v1";
const AUTOPICK_DELAY_MS = 450;
/** Sentinel "team" for the drafting-as select: autopick is off, the user makes every pick. */
const MANUAL_TEAM_ID = 0;

type Picks = Record<string, MockPlayer>;
type LineupSlot = "QB" | "RB" | "WR" | "TE" | "RB/WR" | "K" | "DEF" | "BN";

interface LineupRow {
  label: LineupSlot;
  player?: MockPlayer;
  draftSlot?: DraftSlot;
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

function canFillLineupSlot(label: LineupSlot, player: MockPlayer) {
  if (label === "BN") return true;
  if (label === "RB/WR") return player.pos === "RB" || player.pos === "WR";
  return player.pos === label;
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
  const [loaded, setLoaded] = useState(false);
  const [searchKey, setSearchKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const rankByName = useMemo(() => new Map(players.map((p) => [p.name, p.rank ?? 9999])), [players]);

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

  const taken = useMemo(() => {
    const names = new Set<string>();
    for (const slot of board) if (slot.locked) names.add(slot.locked.name);
    for (const p of Object.values(picks)) names.add(p.name);
    return names;
  }, [board, picks]);

  const draftable = useMemo(() => board.filter((s) => s.round <= 11 && !s.locked), [board]);
  const onTheClockIndex = useMemo(() => draftable.findIndex((s) => !picks[key(s.round, s.slot)]), [draftable, picks]);
  const onTheClock = onTheClockIndex === -1 ? null : draftable[onTheClockIndex];
  const onTheClockKey = onTheClock ? key(onTheClock.round, onTheClock.slot) : null;
  const picksAway = onTheClockIndex === -1 ? 0 : draftable.length - onTheClockIndex;

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
      setPicks((prev) => ({ ...prev, [k]: player }));
      // Only close the search panel if it was open for this slot — an autopick
      // landing elsewhere shouldn't cancel a search the user is browsing.
      if (searchKey === k) {
        setSearchKey(null);
        setQuery("");
      }
    },
    [searchKey]
  );

  function clearPick(round: number, slot: number) {
    const k = key(round, slot);
    setPicks((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
    if (searchKey === k) {
      setSearchKey(null);
      setQuery("");
    }
  }

  function resetAll() {
    setPicks({});
    localStorage.removeItem(STORAGE_KEY);
  }

  function changeTeam(id: number) {
    setUserTeamId(id);
    resetAll();
  }

  /** Fills every remaining draftable slot with a realistic autopick for that team. */
  function autodraftRest() {
    const usedNames = new Set(taken);
    const next: Picks = { ...picks };
    for (const slot of draftable) {
      const k = key(slot.round, slot.slot);
      if (next[k]) continue;
      const { keepers, drafted } = rosterEntriesFor(board, next, slot.teamId);
      const pick = computeAutopick({
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

  const available = useMemo(
    () =>
      players.filter((p) => !taken.has(p.name)).filter((p) =>
        query ? p.name.toLowerCase().includes(query.toLowerCase()) || p.pos.toLowerCase() === query.toLowerCase() : true
      ),
    [players, taken, query]
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
      teamId: onTheClock.teamId,
      available: players.filter((p) => !taken.has(p.name)),
      roster: [...keepers, ...drafted],
      drafted,
      remainingPicks: draftable.filter((s) => s.teamId === onTheClock.teamId && !picks[key(s.round, s.slot)]).length,
    });
    if (!pick) return;
    const timeout = setTimeout(() => makePick(onTheClock.round, onTheClock.slot, pick), AUTOPICK_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [loaded, userTeamId, onTheClock, players, taken, board, picks, draftable, searchKey, makePick]);

  const searchSlot = searchKey ? board.find((s) => key(s.round, s.slot) === searchKey) : null;
  const searchCurrent = searchSlot ? picks[key(searchSlot.round, searchSlot.slot)] : undefined;
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

  // In manual mode there's no "your team", so the lineup viewer starts on the first team.
  const lineupTeamId = viewTeamId ?? (isManual ? teams[0]?.id ?? null : userTeamId);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 px-1">
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
        <button
          onClick={autodraftRest}
          className="ml-auto shrink-0 rounded-lg bg-text px-2.5 py-1 font-cond text-xs font-semibold text-white hover:opacity-90"
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
        <button
          onClick={resetAll}
          className="shrink-0 rounded-lg bg-white/15 px-2.5 py-1 font-cond text-xs font-semibold hover:bg-white/25"
        >
          Reset
        </button>
      </div>

      {isComplete && (
        <div className="mb-3 rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="font-cond text-sm font-semibold">Full mock draft lineup:</span>
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
            {lineupTeamId != null &&
              lineupFor(lineupTeamId).map(({ label, player, draftSlot }, i) => (
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

      {searchSlot && (
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
                const canEdit = slot.round <= 11 && !slot.locked;
                const openSearch = () => {
                  setSearchKey(k);
                  setQuery("");
                };

                return (
                  <div
                    key={k}
                    className={`flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card text-center shadow-sm ${
                      isOnClock ? "border-teal" : isUserSlot ? "border-teal/40" : "border-border"
                    }`}
                  >
                    <div className="truncate bg-section px-1 py-1 text-[10px] font-semibold text-text-muted">
                      {slot.round}.{slot.slot} ({team?.abbrev ?? "FA"})
                    </div>

                    {picked ? (
                      canEdit ? (
                        <button
                          onClick={openSearch}
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
                            onClick={openSearch}
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
    </div>
  );
}
