"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Hexagon, SectionHeader, TeamAvatar, rankBadgeTone } from "./ui";
import { TipBar } from "./tip-bar";
import {
  autoTip,
  buildFinals,
  buildLadder,
  clampMargin,
  DEFAULT_FINALS_MARGIN,
  ladderText,
  MAX_MARGIN,
  modelLine,
  modelPick,
  REGULAR_SEASON_WEEKS,
  resolveFinalsPick,
  type FinalsGame,
  type FinalsSlotId,
  type LadderRow,
  type Pick,
  type PickMap,
} from "@/lib/predictor";
import type { Matchup, TeamMeta } from "@/lib/types";

const STORAGE_KEY = "mgl_predictor_2026";

export function SeasonPredictor({
  matchups,
  teams,
  season,
}: {
  matchups: Matchup[];
  teams: TeamMeta[];
  season: number;
}) {
  const [picks, setPicks] = useState<PickMap>({});
  const [ready, setReady] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [manual, setManual] = useState(false);
  const [showFixture, setShowFixture] = useState(false);
  const [teamFilter, setTeamFilter] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as PickMap;
        setPicks(stored);
        const firstOpen = matchups.findIndex((m) => !stored[m.id]);
        setCursor(firstOpen === -1 ? matchups.length - 1 : firstOpen);
      }
    } catch {}
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [matchups]);

  const commit = (updater: (prev: PickMap) => PickMap) =>
    setPicks((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

  const ladder = useMemo(() => buildLadder(matchups, picks, teams), [matchups, picks, teams]);
  const finals = useMemo(() => buildFinals(ladder, picks), [ladder, picks]);

  const tipped = matchups.filter((m) => picks[m.id]).length;
  const seasonDone = tipped === matchups.length;
  const game = matchups[Math.min(cursor, matchups.length - 1)];
  const pick = picks[game.id];
  const activePick = pick ?? modelPick(game);
  const line = modelLine(game);

  /** Tip the current game and slide to the next one still open. */
  const tip = (homeWins: boolean, margin: number) => {
    const nextPick = { winnerId: homeWins ? game.home.team.id : game.away.team.id, margin };
    const nextPicks = { ...picks, [game.id]: nextPick };
    commit(() => nextPicks);
    advance(nextPicks);
  };

  const setCurrentPick = (homeWins: boolean, margin: number) => {
    const nextPick = { winnerId: homeWins ? game.home.team.id : game.away.team.id, margin };
    commit((prev) => ({ ...prev, [game.id]: nextPick }));
  };

  const advance = (nextPicks = picks) => {
    const pool = filtered();
    const at = pool.findIndex((m) => m.id === game.id);
    const nextGame = pool.slice(at + 1).find((m) => !nextPicks[m.id]) ?? pool[at + 1];
    if (nextGame) setCursor(matchups.indexOf(nextGame));
  };

  const filtered = () =>
    teamFilter == null
      ? matchups
      : matchups.filter((m) => m.away.team.id === teamFilter || m.home.team.id === teamFilter);

  const prev = () => {
    const pool = filtered();
    const at = pool.findIndex((m) => m.id === game.id);
    if (at > 0) setCursor(matchups.indexOf(pool[at - 1]));
  };

  const runAutoTip = () => {
    commit((prev) => autoTip(matchups, prev, Date.now()));
    setCursor(matchups.length - 1);
  };

  const reset = () => {
    setPicks({});
    setCursor(0);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const copyLadder = async () => {
    try {
      await navigator.clipboard.writeText(ladderText(ladder, season));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const champion = finals.championId ? teams.find((t) => t.id === finals.championId) : undefined;
  const highlight = new Set([game.away.team.id, game.home.team.id]);

  return (
    // The app renders in a narrow centred column (~576px on desktop), so this
    // stacks rather than putting the ladder in a side rail — a second column
    // squeezes the tipping bar down to nothing.
    <div className="space-y-3">
      <div className="space-y-3">
        <Card>
          <div className="px-4 pb-3 pt-4 text-center">
            <div className="font-cond text-xs uppercase tracking-widest text-text-muted">
              Week {game.week}, {season}
            </div>
            <div className="font-cond text-xl font-semibold uppercase tracking-wide">
              {game.away.team.name} v {game.home.team.name}
            </div>
            <div className="text-xs text-text-muted">
              {game.id.endsWith("-primetime") ? "Primetime" : `Game ${cursor + 1} of ${matchups.length}`}
            </div>
          </div>

          {/* Avatars sit above the bar so the bar gets the full card width —
              it needs the room to be tappable to the point. */}
          <div className="flex items-center justify-between px-3 pb-2">
            <span className="flex items-center gap-2">
              <TeamAvatar team={game.away.team} size="md" />
              <span className="font-cond text-sm font-semibold">{game.away.team.abbrev}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="font-cond text-sm font-semibold">{game.home.team.abbrev}</span>
              <TeamAvatar team={game.home.team} size="md" />
            </span>
          </div>

          <div className="px-3 pb-3">
            <TipBar
              mean={line.mean}
              sd={line.sd}
              margin={activePick.margin}
              homeWins={activePick.winnerId === game.home.team.id}
              awayName={game.away.team.name}
              homeName={game.home.team.name}
              awayLabel={game.away.team.abbrev}
              homeLabel={game.home.team.abbrev}
              awayPrimary={game.away.team.primary}
              awaySecondary={game.away.team.secondary}
              homePrimary={game.home.team.primary}
              homeSecondary={game.home.team.secondary}
              status={pick ? "user" : "model"}
              onTip={tip}
            />
          </div>

          <div className="flex items-center justify-between gap-2 px-4 pb-4">
            <button
              type="button"
              onClick={() => setManual((m) => !m)}
              className={`rounded-lg border px-3 py-1.5 font-cond text-xs font-semibold uppercase tracking-wide ${
                manual ? "border-teal bg-teal/10 text-teal" : "border-border text-text-muted hover:bg-card-hover"
              }`}
            >
              Manual
            </button>
            {manual ? (
              <div className="flex items-center gap-2">
                <select
                  value={activePick.winnerId === game.home.team.id ? "home" : "away"}
                  onChange={(e) =>
                    setCurrentPick(e.target.value === "home", activePick.margin)
                  }
                  className="rounded-lg border border-border bg-card px-2 py-1.5 font-cond text-xs"
                >
                  <option value="away">{game.away.team.abbrev}</option>
                  <option value="home">{game.home.team.abbrev}</option>
                </select>
                <span className="font-cond text-xs uppercase text-text-muted">by</span>
                <input
                  type="number"
                  min={1}
                  max={MAX_MARGIN}
                  value={activePick.margin}
                  placeholder="0"
                  onChange={(e) =>
                    setCurrentPick(activePick.winnerId === game.home.team.id, clampMargin(Number(e.target.value)))
                  }
                  className="w-16 rounded-lg border border-border bg-card px-2 py-1.5 text-center font-cond text-sm tabular-nums"
                />
              </div>
            ) : (
              <span className="font-cond text-sm text-text-muted">
                {pick
                  ? `${pick.winnerId === game.home.team.id ? game.home.team.abbrev : game.away.team.abbrev} by ${pick.margin}`
                  : `Model: ${activePick.winnerId === game.home.team.id ? game.home.team.abbrev : game.away.team.abbrev} by ${activePick.margin}`}
              </span>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ControlButton onClick={prev}>Prev game</ControlButton>
          <ControlButton onClick={runAutoTip}>AutoTip</ControlButton>
          <ControlButton onClick={reset}>Reset</ControlButton>
          <ControlButton onClick={() => setShowFixture((s) => !s)}>
            <span className="block">Fixture</span>
            <span className="block text-[11px] font-normal normal-case text-text-muted">
              {ready ? `${tipped} / ${matchups.length} tipped` : " "}
            </span>
          </ControlButton>
        </div>

        {showFixture ? (
          <FixturePanel
            matchups={matchups}
            picks={picks}
            teams={teams}
            teamFilter={teamFilter}
            onFilter={setTeamFilter}
            onJump={(m) => {
              setCursor(matchups.indexOf(m));
              setShowFixture(false);
            }}
            currentId={game.id}
          />
        ) : null}

        <FinalsView games={finals.games} picks={picks} onPick={(id, p) => commit((prev) => ({ ...prev, [id]: p }))} champion={champion} />
        {!seasonDone ? (
          <Card>
            <div className="px-4 py-3 text-sm text-text-muted">
              Untipped regular-season games use the model tip. Override any game or hit AutoTip to fill the fixture.
            </div>
          </Card>
        ) : null}
      </div>

      <div className="space-y-2">
        <Ladder rows={ladder} highlight={highlight} />
        <button
          type="button"
          onClick={copyLadder}
          className="w-full rounded-xl bg-card py-2.5 font-cond text-sm font-semibold uppercase tracking-wide text-text-muted shadow-sm hover:bg-card-hover"
        >
          {copied ? "Copied" : "Copy ladder"}
        </button>
        <p className="px-1 text-xs text-text-muted">
          Tap or drag the bar to tip a winner — the further from the middle, the bigger the margin. AutoTip simulates the
          remaining games thousands of times and keeps a typical season, so favourites do not go undefeated. Picks
          are saved on this device.
        </p>
      </div>
    </div>
  );
}

function ControlButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl bg-card px-3 py-2.5 text-center font-cond text-sm font-semibold uppercase tracking-wide shadow-sm hover:bg-card-hover"
    >
      {children}
    </button>
  );
}

function FixturePanel({
  matchups,
  picks,
  teams,
  teamFilter,
  onFilter,
  onJump,
  currentId,
}: {
  matchups: Matchup[];
  picks: PickMap;
  teams: TeamMeta[];
  teamFilter: number | null;
  onFilter: (id: number | null) => void;
  onJump: (m: Matchup) => void;
  currentId: string;
}) {
  const list =
    teamFilter == null
      ? matchups
      : matchups.filter((m) => m.away.team.id === teamFilter || m.home.team.id === teamFilter);

  return (
    <Card>
      <SectionHeader>Fixture</SectionHeader>
      <div className="flex flex-wrap gap-1 border-b border-border p-2">
        <button
          type="button"
          onClick={() => onFilter(null)}
          className={`rounded-lg px-2 py-1 font-cond text-xs font-semibold uppercase ${
            teamFilter == null ? "bg-teal text-white" : "bg-row text-text-muted hover:bg-card-hover"
          }`}
        >
          All
        </button>
        {teams.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onFilter(teamFilter === t.id ? null : t.id)}
            className={`rounded-lg px-2 py-1 font-cond text-xs font-semibold uppercase ${
              teamFilter === t.id ? "bg-teal text-white" : "bg-row text-text-muted hover:bg-card-hover"
            }`}
          >
            {t.abbrev}
          </button>
        ))}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {list.map((m) => {
          const p = picks[m.id];
          const preview = p ?? modelPick(m);
          const winner = preview.winnerId === m.home.team.id ? m.home.team : m.away.team;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onJump(m)}
              className={`flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm hover:bg-card-hover ${
                m.id === currentId ? "bg-teal/10" : ""
              }`}
            >
              <span className="w-8 shrink-0 font-cond text-xs text-text-muted">W{m.week}</span>
              <span className="min-w-0 flex-1 truncate font-cond">
                {m.away.team.abbrev} v {m.home.team.abbrev}
              </span>
              <span className={`shrink-0 font-cond text-xs ${p ? "text-teal" : "text-text-dim"}`}>
                {p ? `${winner.abbrev} by ${p.margin}` : `Model ${winner.abbrev} by ${preview.margin}`}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function Ladder({ rows, highlight }: { rows: LadderRow[]; highlight: Set<number> }) {
  return (
    <Card>
      <SectionHeader>Predicted Ladder</SectionHeader>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-sm">
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
                className={`${highlight.has(row.team.id) ? "bg-teal/10" : row.seed % 2 === 0 ? "bg-row" : ""} ${
                  row.seed === 8 ? "border-b-2 border-teal" : "border-b border-border"
                }`}
              >
                <td className="px-2 py-1.5">
                  <Hexagon value={row.seed} tone={row.seed <= 8 ? rankBadgeTone(row.seed) : "grey"} size="sm" />
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
      <p className="px-3 py-2 text-xs text-text-muted">Top eight make the finals. Tiebreak is points for.</p>
    </Card>
  );
}

function FinalsView({
  games,
  picks,
  onPick,
  champion,
}: {
  games: FinalsGame[];
  picks: PickMap;
  onPick: (id: string, pick: Pick) => void;
  champion?: TeamMeta;
}) {
  if (!games.length) return null;

  const byId = new Map(games.map((game) => [game.id, game]));
  const bracket: { id: FinalsSlotId; label: string; className: string }[] = [
    { id: "qf-1", label: "QF1", className: "col-start-1 row-start-1" },
    { id: "qf-2", label: "QF2", className: "col-start-2 row-start-1" },
    { id: "qf-3", label: "QF3", className: "col-start-3 row-start-1" },
    { id: "qf-4", label: "QF4", className: "col-start-4 row-start-1" },
    { id: "sf-1", label: "SF1", className: "col-start-1 col-span-2 row-start-2 px-[5.75rem]" },
    { id: "sf-2", label: "SF2", className: "col-start-3 col-span-2 row-start-2 px-[5.75rem]" },
    { id: "final", label: "GF", className: "col-start-2 col-span-2 row-start-3 px-28" },
  ];

  return (
    <div className="space-y-3">
      <Card>
        <SectionHeader>Top 8 Finals Bracket</SectionHeader>
        <div className="overflow-x-auto">
          <div className="relative grid min-w-[820px] grid-cols-4 grid-rows-[auto_auto_auto] gap-x-3 gap-y-7 bg-[#f8fafc] p-4">
            <BracketLine className="left-[12.5%] top-[100px] h-[42px]" />
            <BracketLine className="left-[37.5%] top-[100px] h-[42px]" />
            <BracketLine className="left-[62.5%] top-[100px] h-[42px]" />
            <BracketLine className="left-[87.5%] top-[100px] h-[42px]" />
            <BracketLine className="left-1/4 top-[226px] h-[42px]" />
            <BracketLine className="left-3/4 top-[226px] h-[42px]" />
            {bracket.map((slot) => {
              const game = byId.get(slot.id);
              if (!game) return null;
              return (
                <div key={slot.id} className={slot.className}>
                  <FinalsGameBox label={slot.label} game={game} picks={picks} onPick={onPick} />
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {champion ? (
        <Card>
          <div className="flex items-center gap-3 bg-teal px-4 py-4 text-white">
            <TeamAvatar team={champion} size="lg" />
            <div className="min-w-0">
              <div className="font-cond text-xs uppercase tracking-widest text-white/80">Champion</div>
              <div className="truncate font-cond text-2xl font-semibold">{champion.name}</div>
              <div className="truncate text-sm text-white/80">{champion.manager}</div>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function FinalsGameBox({
  label,
  game,
  picks,
  onPick,
}: {
  label: string;
  game: FinalsGame;
  picks: PickMap;
  onPick: (id: string, pick: Pick) => void;
}) {
  const pick = resolveFinalsPick(game, picks) ?? { winnerId: 0, margin: DEFAULT_FINALS_MARGIN };
  if (!game.a || !game.b) {
    return (
      <div>
        <BracketLabel>{label}</BracketLabel>
        <div className="relative h-[86px] overflow-hidden rounded-lg border border-[#45484d] bg-[radial-gradient(circle_at_center,#cdd2d7_0%,#777d84_42%,#303238_100%)] shadow-sm">
          <div className="absolute left-1/2 top-0 h-full w-px bg-black/35" />
          <div className="absolute left-1/2 top-1/2 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#3f4449] font-cond text-sm font-bold text-white shadow">
            v
          </div>
        </div>
      </div>
    );
  }

  const aWins = pick.winnerId === game.a.team.id;

  return (
    <div>
      <BracketLabel>{label}</BracketLabel>
      <div className="relative h-[86px] overflow-hidden rounded-lg border border-[#45484d] bg-[#2d3035] shadow-sm">
        <div className="grid h-full grid-cols-2">
          <BracketTeam entry={game.a} selected={aWins} onSelect={(id) => onPick(game.id, { winnerId: id, margin: DEFAULT_FINALS_MARGIN })} />
          <BracketTeam entry={game.b} selected={!aWins} align="right" onSelect={(id) => onPick(game.id, { winnerId: id, margin: DEFAULT_FINALS_MARGIN })} />
        </div>
        <div className="absolute left-1/2 top-0 h-full w-px bg-black/35" />
        <div className="absolute left-1/2 top-1/2 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#3f4449] font-cond text-sm font-bold text-white shadow">
          v
        </div>
      </div>
    </div>
  );
}

function BracketLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto -mb-1 w-fit rounded-t-md bg-teal px-4 py-0.5 font-cond text-xs font-semibold uppercase tracking-wide text-white">
      {children}
    </div>
  );
}

function BracketLine({ className }: { className: string }) {
  return <div aria-hidden="true" className={`absolute w-px bg-[#cfd5dc] ${className}`} />;
}

function BracketTeam({
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
  const logoOpacity = selected ? 0.34 : 0.18;

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.team.id)}
      aria-pressed={selected}
      className={`group relative min-w-0 overflow-hidden px-2 text-left text-white transition-[filter,opacity] ${
        selected ? "opacity-100" : "opacity-60 grayscale hover:opacity-85"
      } ${align === "right" ? "text-right" : ""}`}
      style={{
        background: `linear-gradient(135deg, ${entry.team.primary}, ${entry.team.secondary})`,
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.42),rgba(0,0,0,0.28)_58%,rgba(0,0,0,0.54))]" />
      {entry.team.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.team.logo}
          alt=""
          className={`absolute top-1/2 h-20 w-20 -translate-y-1/2 object-contain ${
            align === "right" ? "right-1" : "left-1"
          }`}
          style={{ opacity: logoOpacity }}
        />
      ) : null}
      <div
        className={`relative flex h-full min-w-0 flex-col justify-center gap-1 ${
          align === "right" ? "items-end pl-5" : "items-start pr-5"
        }`}
      >
        <span className="rounded bg-black/35 px-1.5 py-0.5 font-cond text-[10px] font-semibold uppercase tracking-wide text-white/80">
          Seed {entry.seed}
        </span>
        <span className="max-w-full truncate font-cond text-base font-semibold leading-none drop-shadow">
          {entry.team.abbrev}
        </span>
      </div>
    </button>
  );
}

export { REGULAR_SEASON_WEEKS };
