"use client";

import { useMemo, useState } from "react";
import {
  PLAYOFF_CUTOFF,
  projectStandings,
  type ProjectedTeam,
  type SimulatorGame,
  type SimulatorTeam,
} from "@/lib/playoff-simulator";
import { Card, Hexagon, SectionHeader, TeamAvatar, TeamLink, rankBadgeTone } from "@/components/ui";

type Scenario = "favorites" | "home" | "chaos";

export function PlayoffSimulator({
  teams,
  schedule,
  completedWeeks,
}: {
  teams: SimulatorTeam[];
  schedule: SimulatorGame[];
  completedWeeks: number;
}) {
  const [winners, setWinners] = useState<Record<string, number>>(() => scenarioWinners(schedule, "favorites"));
  const projected = useMemo(() => projectStandings(teams, schedule, winners), [teams, schedule, winners]);
  const bubble = projected.slice(PLAYOFF_CUTOFF - 2, PLAYOFF_CUTOFF + 2);
  const gamesByWeek = useMemo(() => {
    const map = new Map<number, SimulatorGame[]>();
    for (const game of schedule) {
      const bucket = map.get(game.week) ?? [];
      bucket.push(game);
      map.set(game.week, bucket);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [schedule]);

  function applyScenario(scenario: Scenario) {
    setWinners(scenarioWinners(schedule, scenario));
  }

  function pickWinner(game: SimulatorGame, teamId: number) {
    setWinners((prev) => ({ ...prev, [game.id]: teamId }));
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <ScenarioButton label="Favorites" active={matchesScenario(winners, schedule, "favorites")} onClick={() => applyScenario("favorites")} />
        <ScenarioButton label="Home Run" active={matchesScenario(winners, schedule, "home")} onClick={() => applyScenario("home")} />
        <ScenarioButton label="Chaos" active={matchesScenario(winners, schedule, "chaos")} onClick={() => applyScenario("chaos")} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="font-cond text-xs uppercase tracking-wide text-text-muted">Projected Top Seed</div>
          <TeamSpot row={projected[0]} value={`${projected[0]?.wins ?? 0}-${projected[0]?.losses ?? 0}`} />
        </Card>
        <Card className="p-3">
          <div className="font-cond text-xs uppercase tracking-wide text-text-muted">Cut Line</div>
          <TeamSpot row={projected[PLAYOFF_CUTOFF - 1]} value={`Seed ${PLAYOFF_CUTOFF}`} />
        </Card>
      </div>

      <Card>
        <SectionHeader>Projected Ladder</SectionHeader>
        {projected.map((row, index) => (
          <ProjectedRow key={row.team.id} row={row} index={index} />
        ))}
      </Card>

      <Card className="p-3">
        <div className="mb-2 font-cond text-sm font-semibold uppercase tracking-wide text-text-muted">Bubble Watch</div>
        <div className="grid grid-cols-2 gap-2">
          {bubble.map((row) => (
            <div key={row.team.id} className={`rounded-lg border px-2 py-2 ${row.seed <= PLAYOFF_CUTOFF ? "border-teal/40 bg-teal/5" : "border-border bg-row"}`}>
              <div className="flex items-center gap-2">
                <Hexagon value={row.seed} tone={row.seed <= PLAYOFF_CUTOFF ? "teal" : "grey"} size="sm" />
                <TeamAvatar team={row.team} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-cond text-sm font-semibold">{row.team.name}</div>
                  <div className="font-cond text-xs tabular-nums text-text-muted">{row.wins}-{row.losses}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {schedule.length ? (
        <div className="space-y-3">
          {gamesByWeek.map(([week, games]) => (
            <Card key={week}>
              <SectionHeader>Week {week}</SectionHeader>
              {games.map((game, index) => (
                <GamePicker
                  key={game.id}
                  game={game}
                  winnerId={winners[game.id] ?? game.favoriteId}
                  index={index}
                  onPick={pickWinner}
                />
              ))}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-6 text-center text-sm text-text-muted">
          The regular-season slate is already complete through Week {completedWeeks}.
        </Card>
      )}
    </div>
  );
}

function ScenarioButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 font-cond text-sm font-semibold uppercase tracking-wide transition-colors ${
        active ? "bg-teal text-white" : "bg-card text-text-muted shadow-sm hover:bg-card-hover"
      }`}
    >
      {label}
    </button>
  );
}

function ProjectedRow({ row, index }: { row: ProjectedTeam; index: number }) {
  const inPlayoffs = row.seed <= PLAYOFF_CUTOFF;
  return (
    <TeamLink
      team={row.team}
      className={`flex items-center gap-3 border-t border-border px-3 py-2.5 ${
        index % 2 ? "bg-card" : "bg-row"
      } hover:bg-card-hover`}
    >
      <Hexagon value={row.seed} tone={rankBadgeTone(row.seed)} />
      <TeamAvatar team={row.team} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-cond text-base font-semibold leading-tight">{row.team.name}</div>
        <div className="text-xs text-text-muted">Power rank {row.powerRank}</div>
      </div>
      <div className="text-right">
        <div className="font-cond text-lg font-bold tabular-nums">{row.wins}-{row.losses}</div>
        <div className={`font-cond text-[10px] font-bold uppercase tracking-wide ${inPlayoffs ? "text-teal" : "text-text-dim"}`}>
          {inPlayoffs ? "In" : "Out"}
        </div>
      </div>
    </TeamLink>
  );
}

function TeamSpot({ row, value }: { row?: ProjectedTeam; value: string }) {
  if (!row) return null;
  return (
    <TeamLink team={row.team} className="mt-1.5 flex items-center gap-2 hover:opacity-80">
      <TeamAvatar team={row.team} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-cond text-base font-semibold">{row.team.name}</div>
        <div className="font-cond text-2xl font-bold tabular-nums">{value}</div>
      </div>
    </TeamLink>
  );
}

function GamePicker({
  game,
  winnerId,
  index,
  onPick,
}: {
  game: SimulatorGame;
  winnerId: number;
  index: number;
  onPick: (game: SimulatorGame, teamId: number) => void;
}) {
  return (
    <div className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-border px-3 py-2.5 ${index % 2 ? "bg-card" : "bg-row"}`}>
      <TeamPickButton team={game.away} selected={winnerId === game.away.id} favorite={game.favoriteId === game.away.id} onClick={() => onPick(game, game.away.id)} />
      <span className="font-cond text-xs font-bold text-text-dim">at</span>
      <TeamPickButton team={game.home} selected={winnerId === game.home.id} favorite={game.favoriteId === game.home.id} onClick={() => onPick(game, game.home.id)} align="right" />
    </div>
  );
}

function TeamPickButton({
  team,
  selected,
  favorite,
  onClick,
  align = "left",
}: {
  team: SimulatorGame["home"];
  selected: boolean;
  favorite: boolean;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
        selected ? "border-teal bg-teal/10 text-text" : "border-border bg-card hover:bg-card-hover"
      } ${align === "right" ? "justify-end text-right" : "text-left"}`}
    >
      {align === "left" && <TeamAvatar team={team} size="sm" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-cond text-sm font-semibold">{team.name}</span>
        {favorite && <span className="block font-cond text-[10px] font-bold uppercase tracking-wide text-teal">Fav</span>}
      </span>
      {align === "right" && <TeamAvatar team={team} size="sm" />}
    </button>
  );
}

function scenarioWinners(schedule: SimulatorGame[], scenario: Scenario): Record<string, number> {
  const out: Record<string, number> = {};
  schedule.forEach((game, index) => {
    if (scenario === "home") out[game.id] = game.home.id;
    else if (scenario === "chaos") out[game.id] = index % 3 === 0 ? otherTeam(game, game.favoriteId) : game.favoriteId;
    else out[game.id] = game.favoriteId;
  });
  return out;
}

function matchesScenario(winners: Record<string, number>, schedule: SimulatorGame[], scenario: Scenario): boolean {
  const expected = scenarioWinners(schedule, scenario);
  return schedule.every((game) => winners[game.id] === expected[game.id]);
}

function otherTeam(game: SimulatorGame, teamId: number): number {
  return game.home.id === teamId ? game.away.id : game.home.id;
}
