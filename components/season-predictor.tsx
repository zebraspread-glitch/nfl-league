"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Hexagon, SectionHeader, TeamAvatar, rankBadgeTone } from "./ui";
import {
  buildFinals,
  buildLadder,
  DEFAULT_FINALS_MARGIN,
  MAX_MARGIN,
  pickFor,
  REGULAR_SEASON_WEEKS,
  resolveFinalsPick,
  scoresFor,
  type FinalsGame,
  type LadderRow,
  type Pick,
  type PickMap,
} from "@/lib/predictor";
import type { Matchup, TeamMeta } from "@/lib/types";

const STORAGE_KEY = "mgl_predictor_2026";

type Tab = number | "finals";

export function SeasonPredictor({ matchups, teams }: { matchups: Matchup[]; teams: TeamMeta[] }) {
  const [picks, setPicks] = useState<PickMap>({});
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>(1);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPicks(JSON.parse(raw) as PickMap);
    } catch {}
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Functional update: a click and a slider drag can land before React
  // re-renders, and reading `picks` from the closure would drop the first one.
  const setPick = (id: string, pick: Pick) =>
    setPicks((prev) => {
      const next = { ...prev, [id]: pick };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

  const clearAll = () => {
    setPicks({});
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const ladder = useMemo(() => buildLadder(matchups, picks, teams), [matchups, picks, teams]);
  const finals = useMemo(() => buildFinals(ladder, picks), [ladder, picks]);

  const weekGames = useMemo(
    () => (tab === "finals" ? [] : matchups.filter((m) => m.week === tab)),
    [matchups, tab],
  );

  const madeCount = matchups.filter((m) => picks[m.id]).length;
  const champion = finals.championId ? teams.find((t) => t.id === finals.championId) : undefined;

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {Array.from({ length: REGULAR_SEASON_WEEKS }, (_, i) => i + 1).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setTab(w)}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg font-cond text-base font-semibold transition-colors ${
              tab === w ? "bg-teal text-white" : "bg-card text-text-muted hover:bg-card-hover"
            }`}
          >
            {w}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setTab("finals")}
          className={`grid h-9 shrink-0 place-items-center rounded-lg px-3 font-cond text-sm font-semibold uppercase tracking-wide transition-colors ${
            tab === "finals" ? "bg-teal text-white" : "bg-card text-text-muted hover:bg-card-hover"
          }`}
        >
          Finals
        </button>
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="font-cond text-xs uppercase tracking-wide text-text-muted">
          {ready ? `${madeCount} of ${matchups.length} games picked` : " "}
        </span>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-lg border border-border px-3 py-1.5 font-cond text-xs font-semibold uppercase tracking-wide text-text-muted hover:bg-card-hover"
        >
          Reset to tips
        </button>
      </div>

      {tab === "finals" ? (
        <FinalsView games={finals.games} byes={finals.byes} picks={picks} onPick={setPick} champion={champion} />
      ) : (
        <div className="space-y-2">
          {weekGames.map((m) => (
            <GameRow
              key={m.id}
              matchup={m}
              pick={pickFor(m, picks)}
              isTip={!picks[m.id]}
              onPick={(p) => setPick(m.id, p)}
            />
          ))}
        </div>
      )}

      <Ladder rows={ladder} />

      <p className="px-1 pb-2 text-xs text-text-muted">
        Every game starts on a tip from the simulated line. Change a pick and it becomes yours — the ladder and
        finals update as you go. Your picks are saved on this device.
      </p>
    </div>
  );
}

function GameRow({
  matchup,
  pick,
  isTip,
  onPick,
}: {
  matchup: Matchup;
  pick: Pick;
  isTip: boolean;
  onPick: (pick: Pick) => void;
}) {
  const { away, home } = matchup;
  const scores = scoresFor(matchup, pick);
  const awayWins = pick.winnerId === away.team.id;

  const choose = (teamId: number) => onPick({ winnerId: teamId, margin: pick.margin });
  const setMargin = (margin: number) =>
    onPick({ winnerId: pick.winnerId, margin: Math.min(MAX_MARGIN, Math.max(1, margin)) });

  return (
    <Card>
      <div className="px-3 py-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
          <TeamPick side={away.team} selected={awayWins} score={awayWins ? scores.winner : scores.loser} onSelect={choose} />
          <div className="flex flex-col items-center justify-center px-1">
            <span className="font-cond text-[10px] uppercase tracking-wide text-text-dim">by</span>
            <span className="font-cond text-2xl font-semibold tabular-nums leading-none">{pick.margin}</span>
          </div>
          <TeamPick side={home.team} selected={!awayWins} score={awayWins ? scores.loser : scores.winner} onSelect={choose} align="right" />
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={MAX_MARGIN}
            step={1}
            value={pick.margin}
            onChange={(e) => setMargin(Number(e.target.value))}
            aria-label={`Winning margin for ${away.team.name} versus ${home.team.name}`}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-teal"
          />
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 font-cond text-[10px] font-semibold uppercase tracking-wide ${
              isTip ? "bg-section text-text-dim" : "bg-teal/15 text-teal"
            }`}
          >
            {isTip ? "Tip" : "Yours"}
          </span>
        </div>
      </div>
    </Card>
  );
}

function TeamPick({
  side,
  selected,
  score,
  onSelect,
  align = "left",
}: {
  side: TeamMeta;
  selected: boolean;
  score: number;
  onSelect: (teamId: number) => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(side.id)}
      aria-pressed={selected}
      className={`flex min-w-0 items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors ${
        align === "right" ? "flex-row-reverse text-right" : ""
      } ${selected ? "border-teal bg-teal/10" : "border-border bg-row hover:bg-card-hover"}`}
    >
      <TeamAvatar team={side} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-cond text-sm font-semibold leading-tight">{side.name}</span>
        <span className={`block font-cond text-xs tabular-nums ${selected ? "text-teal" : "text-text-muted"}`}>
          {score.toFixed(1)}
        </span>
      </span>
    </button>
  );
}

function Ladder({ rows }: { rows: LadderRow[] }) {
  return (
    <Card>
      <SectionHeader>Projected Ladder</SectionHeader>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[380px] text-sm">
          <thead>
            <tr className="bg-section font-cond text-[11px] uppercase tracking-wide text-text-muted">
              <th className="px-2 py-1.5 text-left">#</th>
              <th className="px-2 py-1.5 text-left">Team</th>
              <th className="px-2 py-1.5 text-right">W</th>
              <th className="px-2 py-1.5 text-right">L</th>
              <th className="px-2 py-1.5 text-right">PF</th>
              <th className="px-2 py-1.5 text-right">+/-</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.team.id}
                className={`${row.seed % 2 === 0 ? "bg-row" : ""} ${
                  row.seed === 6 ? "border-b-2 border-teal" : "border-b border-border"
                }`}
              >
                <td className="px-2 py-1.5">
                  <Hexagon value={row.seed} tone={row.seed <= 6 ? rankBadgeTone(row.seed) : "grey"} size="sm" />
                </td>
                <td className="min-w-0 px-2 py-1.5">
                  <span className="flex items-center gap-2">
                    <TeamAvatar team={row.team} size="sm" />
                    <span className="truncate font-cond font-semibold">{row.team.name}</span>
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right font-cond tabular-nums">{row.wins}</td>
                <td className="px-2 py-1.5 text-right font-cond tabular-nums">{row.losses}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-text-muted">{row.pointsFor.toFixed(0)}</td>
                <td
                  className={`px-2 py-1.5 text-right tabular-nums ${row.diff > 0 ? "text-up" : row.diff < 0 ? "text-down" : "text-text-muted"}`}
                >
                  {row.diff > 0 ? "+" : ""}
                  {row.diff.toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-2 text-xs text-text-muted">Top six make the finals. Tiebreak is points for.</p>
    </Card>
  );
}

function FinalsView({
  games,
  byes,
  picks,
  onPick,
  champion,
}: {
  games: FinalsGame[];
  byes: { team: TeamMeta; seed: number }[];
  picks: PickMap;
  onPick: (id: string, pick: Pick) => void;
  champion?: TeamMeta;
}) {
  if (!games.length) return null;

  const rounds = [
    { title: "Quarterfinals — Week 15", games: games.filter((g) => g.round === "Quarterfinal") },
    { title: "Semifinals — Week 16", games: games.filter((g) => g.round === "Semifinal") },
    { title: "Final — Week 17", games: games.filter((g) => g.round === "Final") },
  ];

  return (
    <div className="space-y-3">
      <Card>
        <SectionHeader>First-round byes</SectionHeader>
        <div className="grid grid-cols-2 gap-2 p-3">
          {byes.map((b) => (
            <div key={b.team.id} className="flex items-center gap-2 rounded-lg border border-border bg-row px-3 py-2">
              <Hexagon value={b.seed} tone={rankBadgeTone(b.seed)} size="sm" />
              <TeamAvatar team={b.team} size="sm" />
              <span className="truncate font-cond text-sm font-semibold">{b.team.name}</span>
            </div>
          ))}
        </div>
      </Card>

      {rounds.map((round) => (
        <Card key={round.title}>
          <SectionHeader>{round.title}</SectionHeader>
          <div className="space-y-2 p-3">
            {round.games.map((game) => (
              <FinalsGameRow key={game.id} game={game} picks={picks} onPick={onPick} />
            ))}
          </div>
        </Card>
      ))}

      {champion ? (
        <Card>
          <div className="flex items-center gap-3 bg-teal px-4 py-4 text-white">
            <TeamAvatar team={champion} size="lg" />
            <div className="min-w-0">
              <div className="font-cond text-xs uppercase tracking-widest text-white/80">2026 Champion</div>
              <div className="truncate font-cond text-2xl font-semibold">{champion.name}</div>
              <div className="truncate text-sm text-white/80">{champion.manager}</div>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function FinalsGameRow({
  game,
  picks,
  onPick,
}: {
  game: FinalsGame;
  picks: PickMap;
  onPick: (id: string, pick: Pick) => void;
}) {
  const pick = resolveFinalsPick(game, picks) ?? { winnerId: 0, margin: DEFAULT_FINALS_MARGIN };
  if (!game.a || !game.b) {
    return <div className="rounded-lg border border-border bg-row px-3 py-3 text-sm text-text-muted">To be decided</div>;
  }

  const aWins = pick.winnerId === game.a.team.id;
  const choose = (teamId: number) => onPick(game.id, { winnerId: teamId, margin: pick.margin });
  const setMargin = (margin: number) =>
    onPick(game.id, { winnerId: pick.winnerId, margin: Math.min(MAX_MARGIN, Math.max(1, margin)) });

  return (
    <div className="rounded-lg border border-border p-2">
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        <SeededPick entry={game.a} selected={aWins} onSelect={choose} />
        <div className="flex flex-col items-center justify-center px-1">
          <span className="font-cond text-[10px] uppercase tracking-wide text-text-dim">by</span>
          <span className="font-cond text-xl font-semibold tabular-nums leading-none">{pick.margin}</span>
        </div>
        <SeededPick entry={game.b} selected={!aWins} onSelect={choose} align="right" />
      </div>
      <input
        type="range"
        min={1}
        max={MAX_MARGIN}
        step={1}
        value={pick.margin}
        onChange={(e) => setMargin(Number(e.target.value))}
        aria-label={`Winning margin for ${game.a.team.name} versus ${game.b.team.name}`}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-teal"
      />
    </div>
  );
}

function SeededPick({
  entry,
  selected,
  onSelect,
  align = "left",
}: {
  entry: { team: TeamMeta; seed: number };
  selected: boolean;
  onSelect: (teamId: number) => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.team.id)}
      aria-pressed={selected}
      className={`flex min-w-0 items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors ${
        align === "right" ? "flex-row-reverse text-right" : ""
      } ${selected ? "border-teal bg-teal/10" : "border-border bg-row hover:bg-card-hover"}`}
    >
      <TeamAvatar team={entry.team} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-cond text-sm font-semibold leading-tight">{entry.team.name}</span>
        <span className="block font-cond text-[11px] text-text-muted">Seed {entry.seed}</span>
      </span>
    </button>
  );
}
