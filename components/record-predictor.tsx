"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TeamMeta } from "@/lib/types";

// ---------------------------------------------------------------------------
// Record prediction: the NFL app's "RECORD PREDICTION" screen for an MGL team.
// Tap a side of each week's bar to pick the winner (tap it again to clear) and
// the record box keeps count.
//
// Every size is in cqw of the panel, measured off the NFL app at 414pt wide,
// so the whole screen scales like the original at any phone width.
// ---------------------------------------------------------------------------

/** One regular-season game, trimmed to what this screen needs. */
export interface ScheduleGame {
  id: string;
  week: number;
  awayId: number;
  homeId: number;
}

/** Winner's team id, keyed by matchup id. Stored per game rather than per
 *  team, so tipping Thomo over GVJ also shows as an L on GVJ's schedule. */
type Picks = Record<string, number>;

const STORAGE_KEY = "mgl_record_prediction_2026";

/** Weeks in the left column; the rest sit on the right above the record box,
 *  the same split that keeps the NFL screen's two columns level. */
const LEFT_COLUMN_WEEKS = 8;

// Stand-ins for the NFL team palettes. `fill` is the flat colour behind each
// headshot, sampled from the logo artwork (which is not always team.primary),
// so the photo blends into its bar with no seam. `accent` is the team name and
// record box; `ground` tints the top of the backdrop.
const LOOK: Record<number, { fill: string; accent: string; ground: string }> = {
  1: { fill: "#df026b", accent: "#ff4fa0", ground: "#430a25" }, // Dimmy
  2: { fill: "#8c52ff", accent: "#8c52ff", ground: "#1d0a43" }, // Thomo
  3: { fill: "#821919", accent: "#e04545", ground: "#400c0c" }, // De'Aaron Cronin
  4: { fill: "#38b6ff", accent: "#38b6ff", ground: "#0a2e43" }, // GinniVan Jefferson
  5: { fill: "#ff914d", accent: "#ff914d", ground: "#43200a" }, // Lavar Balls
  6: { fill: "#bdbab2", accent: "#bdbab2", ground: "#292823" }, // Monke Vengeance
  7: { fill: "#ff3131", accent: "#ff3131", ground: "#430a0a" }, // Tinkle Van Ginkel
  8: { fill: "#5ce1e6", accent: "#5ce1e6", ground: "#0a4143" }, // Dalts
  9: { fill: "#588727", accent: "#82b84a", ground: "#273b11" }, // Paho
  10: { fill: "#000210", accent: "#9db8ff", ground: "#0a1143" }, // ChiChi
  11: { fill: "#ffde59", accent: "#ffde59", ground: "#43380a" }, // Brownlowrowbottom
  12: { fill: "#5271ff", accent: "#5271ff", ground: "#0a1443" }, // Lucky Bison
};

/** Height of the face in each 1080px logo, as % from the top, so the thin
 *  crop inside a bar lands on the face rather than the forehead or shirt. */
const FACE_Y: Record<number, number> = {
  1: 56, 2: 55, 3: 52, 4: 47, 5: 45, 6: 45, 7: 50, 8: 50, 9: 62, 10: 47, 11: 40, 12: 50,
};

/** The logo is drawn at this multiple of the bar height, filling it the way
 *  the NFL crests do. */
const LOGO_ZOOM = 2.6;

// Result colours, sampled from the NFL screen.
const RESULT = {
  W: { tint: "rgba(25, 114, 10, 0.8)", edge: "#17b71d", glow: "rgba(23, 183, 29, 0.5)", letter: "#18c20e" },
  L: { tint: "rgba(109, 5, 11, 0.8)", edge: "#ef1f1c", glow: "rgba(239, 31, 28, 0.45)", letter: "#ff1010" },
} as const;

const EDGE = "max(1px, 0.25cqw)";

/** Team name size in cqw, matching the `text-[5.4cqw]` class it starts from. */
const NAME_SIZE = 5.4;

type SideState = "open" | "W" | "L" | "dim";

function lookFor(team: TeamMeta) {
  return LOOK[team.id] ?? { fill: team.primary, accent: team.secondary, ground: "#0b1a2e" };
}

/** White text on the record box unless the accent is too pale to carry it. */
function inkOn(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  const luma = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return luma > 175 ? "#0b1220" : "#ffffff";
}

export function RecordPredictor({
  games,
  teams,
  initialTeamId,
}: {
  games: ScheduleGame[];
  teams: TeamMeta[];
  initialTeamId: number;
}) {
  const [teamId, setTeamId] = useState(initialTeamId);
  const [picks, setPicks] = useState<Picks>({});

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPicks(JSON.parse(raw) as Picks);
    } catch {}
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const byId = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const menu = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name)), [teams]);
  const team = byId.get(teamId) ?? teams[0];
  const look = lookFor(team);

  // BROWNLOWROWBOTTOM would run under the logo at full size, so long names
  // shrink to fit. Everything is sized in cqw, so one fit holds at any width.
  const nameRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const name = nameRef.current;
    const label = name?.parentElement;
    const column = label?.parentElement;
    const caret = label?.querySelector("svg");
    if (!name || !label || !column || !caret) return;
    const fit = () => {
      name.style.fontSize = "";
      const room = column.clientWidth - caret.getBoundingClientRect().width - parseFloat(getComputedStyle(label).columnGap);
      if (name.scrollWidth > room) name.style.fontSize = `${(NAME_SIZE * room) / name.scrollWidth}cqw`;
    };
    fit();
    document.fonts?.ready.then(fit);
  }, [team.id]);

  const schedule = games
    .filter((g) => g.awayId === team.id || g.homeId === team.id)
    .sort((a, b) => a.week - b.week);

  /** The stored winner, ignoring anything that isn't one of the two sides. */
  const winnerOf = (game: ScheduleGame) => {
    const id = picks[game.id];
    return id === game.awayId || id === game.homeId ? id : undefined;
  };

  let wins = 0;
  let losses = 0;
  for (const game of schedule) {
    const winner = winnerOf(game);
    if (winner === undefined) continue;
    if (winner === team.id) wins += 1;
    else losses += 1;
  }

  const pick = (game: ScheduleGame, winnerId: number) =>
    setPicks((prev) => {
      const next = { ...prev };
      if (next[game.id] === winnerId) delete next[game.id];
      else next[game.id] = winnerId;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

  const chooseTeam = (id: number) => {
    setTeamId(id);
    window.history.replaceState(null, "", `?team=${id}`);
  };

  const stateOf = (game: ScheduleGame, sideId: number): SideState => {
    const winner = winnerOf(game);
    if (winner === undefined) return "open";
    if (sideId !== team.id) return "dim";
    return winner === team.id ? "W" : "L";
  };

  const week = (game: ScheduleGame) => (
    <div key={game.id} className="pt-[1.55cqw]">
      <div className="text-center text-[3.25cqw] leading-none tracking-[0.01em] text-[#cfd2d8]">WEEK {game.week}</div>
      <div className="mt-[1.1cqw] flex h-[5.9cqw]">
        {/* The selected team always takes the left half, whoever is at home. */}
        {[team.id, game.awayId === team.id ? game.homeId : game.awayId].map((sideId) => {
          const side = byId.get(sideId);
          if (!side) return <div key={sideId} className="flex-1" />;
          return (
            <Side
              key={sideId}
              team={side}
              state={stateOf(game, sideId)}
              picked={winnerOf(game) === sideId}
              onPick={() => pick(game, sideId)}
              label={`Week ${game.week}: ${side.name} to win`}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      className="relative -mx-3 -mb-24 -mt-3 min-h-[calc(100dvh-3.5rem)] overflow-hidden pb-28 text-white"
      style={{ background: `linear-gradient(180deg, ${look.ground} 0%, #070a0f 80%, #040507 100%)` }}
    >
      {/* Halftone dots in two corners and a faint diagonal sheen, as on the NFL backdrop. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 0.9px, transparent 1.4px)",
          backgroundSize: "11px 11px",
          maskImage:
            "radial-gradient(ellipse 55% 30% at 88% 6%, #000, transparent), radial-gradient(ellipse 60% 25% at 8% 92%, #000, transparent)",
          WebkitMaskImage:
            "radial-gradient(ellipse 55% 30% at 88% 6%, #000, transparent), radial-gradient(ellipse 60% 25% at 8% 92%, #000, transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(118deg, transparent 18%, rgba(255,255,255,0.025) 24%, transparent 31%, transparent 52%, rgba(255,255,255,0.02) 60%, transparent 68%)",
        }}
      />

      <div className="@container relative mx-auto w-full max-w-[560px] font-extrabold">
        <header className="px-[5.6cqw] pt-[5.2cqw]">
          <div className="flex items-center justify-between gap-[3cqw]">
            <div className="min-w-0 flex-1">
              <h2 className="text-[4.4cqw] leading-[1.2]">RECORD PREDICTION</h2>
              <label className="relative mt-[0.5cqw] flex cursor-pointer items-center gap-[3.4cqw]" style={{ color: look.accent }}>
                <span ref={nameRef} className="whitespace-nowrap text-[5.4cqw] leading-[1.2]">
                  {team.name.toUpperCase()}
                </span>
                <svg viewBox="0 0 10 6" aria-hidden className="w-[2.1cqw] shrink-0" fill="currentColor">
                  <path d="M0 0h10L5 6z" />
                </svg>
                <select
                  aria-label="Team"
                  value={team.id}
                  onChange={(event) => chooseTeam(Number(event.target.value))}
                  className="absolute inset-0 cursor-pointer opacity-0"
                >
                  {menu.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {team.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={team.logo}
                alt={`${team.name} logo`}
                className="mr-[2.4cqw] size-[9.6cqw] shrink-0 rounded-full object-cover"
                suppressHydrationWarning
              />
            ) : null}
          </div>
          <div className="mt-[3.6cqw] bg-white/70" style={{ height: "max(1px, 0.32cqw)" }} />
        </header>

        <div className="mt-[1cqw] grid select-none grid-cols-2 gap-x-[2.9cqw] px-[2.8cqw]">
          <div>{schedule.slice(0, LEFT_COLUMN_WEEKS).map(week)}</div>
          <div>
            {schedule.slice(LEFT_COLUMN_WEEKS).map(week)}
            <div
              className="mx-auto mt-[2.6cqw] flex h-[11.6cqw] w-[23.2cqw] flex-col items-center justify-center gap-[1.3cqw] leading-none"
              style={{ background: look.accent, color: inkOn(look.accent) }}
            >
              <span className="text-[4.1cqw]">RECORD</span>
              <span className="text-[5cqw] tracking-[0.02em]">
                {wins}-{losses}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One team's half of a week's bar. */
function Side({
  team,
  state,
  picked,
  onPick,
  label,
}: {
  team: TeamMeta;
  state: SideState;
  /** This side is the tipped winner. */
  picked: boolean;
  onPick: () => void;
  label: string;
}) {
  const look = lookFor(team);
  const result = state === "W" || state === "L" ? RESULT[state] : null;
  const faceY = FACE_Y[team.id] ?? 50;

  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={label}
      aria-pressed={picked}
      className={`relative min-w-0 flex-1 overflow-hidden ${result ? "z-10" : ""}`}
      style={{
        background: look.fill,
        border: `${EDGE} solid ${result ? result.edge : state === "open" ? "#fff" : "transparent"}`,
        boxShadow: result ? `0 0 1.3cqw ${result.glow}` : undefined,
        filter: state === "dim" ? "brightness(0.38)" : undefined,
      }}
    >
      {team.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.logo}
          alt=""
          draggable={false}
          className="absolute left-1/2 block w-auto max-w-none -translate-x-1/2"
          style={{
            height: `${LOGO_ZOOM * 100}%`,
            top: `${50 - LOGO_ZOOM * faceY}%`,
            // Feathers the sides so gradient backdrops (Paho) melt into the fill.
            maskImage: "linear-gradient(90deg, transparent, #000 16%, #000 84%, transparent)",
            WebkitMaskImage: "linear-gradient(90deg, transparent, #000 16%, #000 84%, transparent)",
          }}
          suppressHydrationWarning
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-[3cqw] text-white">{team.abbrev}</span>
      )}

      {result ? (
        <>
          <span aria-hidden className="absolute inset-0" style={{ background: result.tint }} />
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center text-[10.6cqw] leading-none"
            style={{
              color: result.letter,
              WebkitTextStroke: "0.03em #fff",
              paintOrder: "stroke fill",
            }}
          >
            {state}
          </span>
        </>
      ) : null}
    </button>
  );
}
