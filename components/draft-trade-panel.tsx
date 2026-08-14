"use client";

import { useMemo, useState } from "react";
import type { LivePick, LiveTrade, TradeSide } from "@/lib/draft-clock";
import type { TeamMeta } from "@/lib/types";

const VOLT = "#d2ec1f";

const selectClass =
  "rounded-md border border-white/25 bg-black px-2 py-1.5 font-cond text-sm uppercase text-white";

function emptySide(teamId: number): TradeSide {
  return { teamId, picks: [], players: [] };
}

/** One team's contribution: which of its picks, plus any players by name. */
function SideEditor({
  title,
  side,
  otherTeamId,
  teams,
  picks,
  playerNames,
  onChange,
}: {
  title: string;
  side: TradeSide;
  otherTeamId: number;
  teams: TeamMeta[];
  picks: LivePick[];
  playerNames: string[];
  onChange: (next: TradeSide) => void;
}) {
  const [playerDraft, setPlayerDraft] = useState("");

  // Only picks this team still owns can be given up.
  const owned = useMemo(() => picks.filter((p) => p.team.id === side.teamId), [picks, side.teamId]);

  function togglePick(overall: number) {
    const has = side.picks.includes(overall);
    onChange({
      ...side,
      picks: has ? side.picks.filter((p) => p !== overall) : [...side.picks, overall].sort((a, b) => a - b),
    });
  }

  function addPlayer() {
    const name = playerDraft.trim();
    if (!name || side.players.includes(name)) return;
    onChange({ ...side, players: [...side.players, name] });
    setPlayerDraft("");
  }

  return (
    <div className="min-w-0 flex-1 rounded-lg border border-white/15 p-2">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-cond text-xs uppercase tracking-widest text-white/40">{title}</span>
        <select
          className={selectClass}
          value={side.teamId}
          onChange={(e) => onChange({ ...emptySide(Number(e.target.value)) })}
        >
          {teams
            .filter((t) => t.id !== otherTeamId)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
      </div>

      <div className="mb-1.5 max-h-24 overflow-y-auto rounded border border-white/10">
        {owned.length === 0 ? (
          <div className="px-2 py-1.5 font-cond text-xs uppercase text-white/30">No picks left</div>
        ) : (
          owned.map((p) => (
            <label
              key={p.overall}
              className="flex cursor-pointer items-center gap-2 px-2 py-1 font-cond text-sm text-white/80 hover:bg-white/10"
            >
              <input
                type="checkbox"
                checked={side.picks.includes(p.overall)}
                onChange={() => togglePick(p.overall)}
              />
              #{p.overall} - R{p.round} P{p.slot}
            </label>
          ))
        )}
      </div>

      <div className="flex gap-1.5">
        <input
          list="mgl-player-names"
          value={playerDraft}
          placeholder="Add player"
          onChange={(e) => setPlayerDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addPlayer();
            }
          }}
          className="min-w-0 flex-1 rounded-md border border-white/25 bg-black px-2 py-1.5 font-cond text-sm text-white"
        />
        <button
          onClick={addPlayer}
          className="rounded-md border border-white/25 px-2.5 py-1.5 font-cond text-sm uppercase text-white/70"
        >
          Add
        </button>
      </div>

      {side.players.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {side.players.map((name) => (
            <button
              key={name}
              onClick={() => onChange({ ...side, players: side.players.filter((p) => p !== name) })}
              className="rounded-full border border-white/25 px-2 py-0.5 font-cond text-xs uppercase text-white/70"
              title="Remove"
            >
              {name} ×
            </button>
          ))}
        </div>
      )}

      <datalist id="mgl-player-names">
        {playerNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
}

export function DraftTradePanel({
  picks,
  teams,
  playerNames,
  tradeCount,
  onAnnounce,
  onUndo,
  onClose,
}: {
  picks: LivePick[];
  teams: TeamMeta[];
  playerNames: string[];
  tradeCount: number;
  onAnnounce: (trade: LiveTrade) => void;
  onUndo: () => void;
  onClose: () => void;
}) {
  const [a, setA] = useState<TradeSide>(() => emptySide(teams[0]?.id ?? 0));
  const [b, setB] = useState<TradeSide>(() => emptySide(teams[1]?.id ?? 0));

  const ready =
    a.teamId !== b.teamId &&
    a.picks.length + a.players.length + b.picks.length + b.players.length > 0;

  return (
    <div
      data-trade-panel
      className="absolute inset-x-0 bottom-16 mx-auto max-w-4xl rounded-lg border border-white/15 bg-black/95 p-3"
    >
      <div className="flex gap-3">
        <SideEditor
          title="Gives"
          side={a}
          otherTeamId={b.teamId}
          teams={teams}
          picks={picks}
          playerNames={playerNames}
          onChange={setA}
        />
        <SideEditor
          title="Gives"
          side={b}
          otherTeamId={a.teamId}
          teams={teams}
          picks={picks}
          playerNames={playerNames}
          onChange={setB}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={() => onAnnounce({ id: Date.now(), a, b })}
          disabled={!ready}
          className="rounded-md px-4 py-2 font-cond text-base font-extrabold uppercase tracking-wider text-black disabled:opacity-30"
          style={{ background: VOLT }}
        >
          Announce Trade
        </button>
        <button
          onClick={onUndo}
          disabled={tradeCount === 0}
          className="rounded-md border border-white/20 px-3 py-2 font-cond text-sm uppercase tracking-wider text-white/70 disabled:opacity-30"
        >
          Undo All ({tradeCount})
        </button>
        <button
          onClick={onClose}
          className="rounded-md border border-white/20 px-3 py-2 font-cond text-sm uppercase tracking-wider text-white/70"
        >
          Close
        </button>
      </div>
    </div>
  );
}
