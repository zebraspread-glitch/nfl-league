"use client";

import { useEffect, useMemo, useState } from "react";
import { SleeperPlayerAvatar } from "@/components/sleeper-player-avatar";
import { TEAM_NEEDS, teamById, type DraftSlot, type MockPlayer } from "@/lib/mock-draft";
import type { TeamMeta } from "@/lib/types";

const STORAGE_KEY = "mgl-mock-draft-2026-v1";
const TEAM_STORAGE_KEY = "mgl-mock-draft-team-v1";
const AUTOPICK_DELAY_MS = 450;

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

// Weighted toward the top of the pool (real rankings order) but not deterministic —
// mirrors how real drafters occasionally reach a few spots early/late.
const VARIANCE_WEIGHTS = [0.55, 0.22, 0.13, 0.06, 0.04];

function pickWithVariance(pool: MockPlayer[]): MockPlayer | undefined {
  if (!pool.length) return undefined;
  const window = Math.min(VARIANCE_WEIGHTS.length, pool.length);
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < window; i++) {
    acc += VARIANCE_WEIGHTS[i];
    if (r <= acc) return pool[i];
  }
  return pool[0];
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

  function makePick(round: number, slot: number, player: MockPlayer) {
    setPicks((prev) => ({ ...prev, [key(round, slot)]: player }));
    setSearchKey(null);
    setQuery("");
  }

  function resetAll() {
    setPicks({});
    localStorage.removeItem(STORAGE_KEY);
  }

  function changeTeam(id: number) {
    setUserTeamId(id);
    resetAll();
  }

  /** Fills every remaining draftable slot with a (slightly randomized) best-available pick. */
  function autodraftRest() {
    const usedNames = new Set(taken);
    const next: Picks = { ...picks };
    for (const slot of draftable) {
      const k = key(slot.round, slot.slot);
      if (next[k]) continue;
      const pool = players.filter((p) => !usedNames.has(p.name));
      const pick = pickWithVariance(pool);
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

  // Autopick for every team except the one the user is controlling — stays close to
  // real rankings order, with a little randomness so it's not perfectly deterministic.
  useEffect(() => {
    if (!loaded || userTeamId == null || !onTheClock || onTheClock.teamId === userTeamId) return;
    const pool = players.filter((p) => !taken.has(p.name));
    const pick = pickWithVariance(pool);
    if (!pick) return;
    const timeout = setTimeout(() => makePick(onTheClock.round, onTheClock.slot, pick), AUTOPICK_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [loaded, userTeamId, onTheClock, players, taken]);

  const searchSlot = searchKey ? board.find((s) => key(s.round, s.slot) === searchKey) : null;
  const isUsersClock = !!onTheClock && onTheClock.teamId === userTeamId;
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

  const lineupTeamId = viewTeamId ?? userTeamId;

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
        </select>
        <span className="text-xs text-text-muted">- every other team autopicks</span>
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
          <div className="mb-2 flex items-center justify-between">
            <span className="font-cond text-sm font-semibold">
              Pick {searchSlot.round}.{searchSlot.slot} - {teamById(searchSlot.teamId)?.name}
            </span>
            <button onClick={() => setSearchKey(null)} className="font-cond text-xs font-semibold text-text-dim">
              Cancel
            </button>
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
                const isUserSlot = slot.teamId === userTeamId;

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
                      <>
                        <div className="grid place-items-center px-1 py-2">
                          <SleeperPlayerAvatar sleeperId={picked.sleeperId ?? ""} pos={picked.pos} name={picked.name} size="md" />
                        </div>
                        <div className="truncate px-1 text-[11px] font-semibold leading-tight">{picked.name}</div>
                        <div
                          className="mt-1.5 px-1 py-1 font-cond text-[10px] font-bold uppercase text-white"
                          style={{ background: POS_COLOR[picked.pos] ?? "#9aa1ad" }}
                        >
                          {picked.proTeam} - {picked.pos}
                        </div>
                      </>
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
                            disabled={!isOnClock || !isUserSlot}
                            onClick={() => {
                              setSearchKey(k);
                              setQuery("");
                            }}
                            className={`w-full rounded-md px-1 py-1 font-cond text-[10px] font-bold ${
                              isOnClock && isUserSlot ? "bg-teal text-white" : "bg-section text-text-dim"
                            }`}
                          >
                            {isOnClock ? (isUserSlot ? "Make Pick" : "Auto...") : "Upcoming"}
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
