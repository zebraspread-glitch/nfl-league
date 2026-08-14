"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import {
  applyPickOverrides,
  overridesForTrade,
  tradeIsEmpty,
  type LivePick,
  type LiveTrade,
  type PickOverrides,
  type TradePlayer,
} from "@/lib/draft-clock";
import { isDark, sampleLogoColor } from "@/lib/draft-colors";
import { POS_COLOR, proTeamLogoUrl, sleeperPlayerImage } from "@/lib/player-images";
import { TEAMS } from "@/lib/teams";
import type { TeamMeta } from "@/lib/types";
import { DraftPlayerFace } from "@/components/draft-player-face";
import { DraftTradeAlert } from "@/components/draft-trade-alert";
import { DraftTradePanel } from "@/components/draft-trade-panel";

const STORAGE_KEY = "mgl-draft-clock-v1";
const TRADES_KEY = "mgl-draft-trades-v1";
const PICKED_KEY = "mgl-draft-picked-v1";
const ANNOUNCEMENT_KEY = "mgl-draft-announcement-v1";

/** Who each pick was spent on, keyed by overall pick number. Keyed that way
 *  rather than by team so a traded pick keeps its selection. */
type PickedPlayers = Record<number, string>;
type PickAnnouncement = {
  pick: LivePick;
  player: TradePlayer;
  background: string;
  accent: string;
};

// Palette and proportions are traced from the NFL Network draft ticker this is
// meant to look like. The reference crop is 419x101, so every size inside the
// banner is expressed as a share of that: 1 reference px = 100/419 vw. Keep
// them in those units and the banner scales to any TV at the exact same shape.
const REF_W = 419;
const REF_H = 101;
/** Reference px -> vw, given the banner spans the full viewport width. */
const px = (n: number) => `${(n * 100) / REF_W}vw`;

/** Broadcast yellow-green used for the clock and "PICK IS IN". */
const VOLT = "#d2ec1f";
const BAR_GREEN = "#66d411";
const DANGER = "#ff3b30";
/** Clock/accent colour when the team's backdrop is too light for VOLT. */
const INK = "#0b1220";

type Phase = "clock" | "in";

interface ClockState {
  index: number;
  phase: Phase;
  remainingMs: number;
  startedAt: number | null;
}

function initialState(picks: LivePick[]): ClockState {
  return {
    index: 0,
    phase: "clock",
    remainingMs: (picks[0]?.seconds ?? 0) * 1000,
    startedAt: null,
  };
}

function remainingOf(state: ClockState, now: number) {
  const raw = state.startedAt === null ? state.remainingMs : state.remainingMs - (now - state.startedAt);
  return Math.max(0, raw);
}

function formatClock(ms: number) {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * "TITANS" is 6 characters; "Brownlowrowbottom" is 17. Step the size down so
 * the longest franchise name still sits on one line beside "PICK IS IN".
 */
function nameSize(name: string) {
  if (name.length <= 6) return px(40);
  if (name.length <= 10) return px(32);
  if (name.length <= 14) return px(25);
  return px(20);
}

export function DraftClock({
  picks: basePicks,
  players = [],
}: {
  picks: LivePick[];
  /** Tradable players — autocomplete in the editor, headshots in the alert. */
  players?: TradePlayer[];
}) {
  const playerNames = useMemo(() => players.map((p) => p.name), [players]);
  // Trades are an overlay on the fixed draft order, so everything downstream
  // (ticker, current team, controls) picks them up with no further plumbing.
  const [overrides, setOverrides] = useState<PickOverrides>({});
  const picks = useMemo(() => applyPickOverrides(basePicks, overrides), [basePicks, overrides]);

  const [trade, setTrade] = useState<LiveTrade | null>(null);
  /** 0 = first team shown, 1 = both shown. The next press clears the alert. */
  const [tradeStage, setTradeStage] = useState(0);
  const [tradeOpen, setTradeOpen] = useState(false);

  const [picked, setPicked] = useState<PickedPlayers>({});
  const [announcement, setAnnouncement] = useState<PickAnnouncement | null>(null);
  const playerByName = useMemo(() => new Map(players.map((p) => [p.name, p])), [players]);
  const playerSelectLockUntil = useRef(0);

  const [state, setState] = useState<ClockState>(() => initialState(basePicks));
  const [now, setNow] = useState(() => Date.now());
  const [loaded, setLoaded] = useState(false);
  const [showControls, setShowControls] = useState(true);
  // Keyed by source so a team change falls back immediately instead of briefly
  // painting in the previous team's colour, and so the banner and the last-pick
  // strip can be showing two different teams at once.
  const [logoColors, setLogoColors] = useState<Record<string, string>>({});
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const current = picks[state.index];
  const selectedPlayerName = current ? picked[current.overall] : undefined;
  const selectedPlayer = useMemo(
    () => (selectedPlayerName ? playerByName.get(selectedPlayerName) ?? { name: selectedPlayerName, pos: "NFL" } : undefined),
    [playerByName, selectedPlayerName]
  );
  const running = state.startedAt !== null;
  const remaining = current ? remainingOf(state, now) : 0;
  const totalMs = (current?.seconds ?? 1) * 1000;
  const expired = remaining <= 0;

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as ClockState;
        if (typeof saved.index === "number" && saved.index >= 0 && saved.index <= basePicks.length) {
          setState(saved);
        }
      }
      const savedTrades = localStorage.getItem(TRADES_KEY);
      if (savedTrades) setOverrides(JSON.parse(savedTrades) as PickOverrides);
      const savedPicked = localStorage.getItem(PICKED_KEY);
      if (savedPicked) setPicked(JSON.parse(savedPicked) as PickedPlayers);
      const savedAnnouncement = localStorage.getItem(ANNOUNCEMENT_KEY);
      if (savedAnnouncement) setAnnouncement(JSON.parse(savedAnnouncement) as PickAnnouncement);
    } catch {
      // Ignore corrupt storage.
    }
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [basePicks.length]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(TRADES_KEY, JSON.stringify(overrides));
  }, [overrides, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(PICKED_KEY, JSON.stringify(picked));
  }, [picked, loaded]);

  useEffect(() => {
    if (!loaded) return;
    if (announcement) localStorage.setItem(ANNOUNCEMENT_KEY, JSON.stringify(announcement));
    else localStorage.removeItem(ANNOUNCEMENT_KEY);
  }, [announcement, loaded]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running]);

  // The pick just completed, shown above the banner while the next team is on
  // the clock. Reads through `picks`, so a traded pick credits its new owner.
  const lastPick = state.index > 0 ? picks[state.index - 1] : undefined;
  const lastPlayer = lastPick ? playerByName.get(picked[lastPick.overall] ?? "") : undefined;

  // Take each surface's colour from that team's own artwork (see sampleLogoColor).
  const logoSrc = current?.team.logo;
  const lastLogoSrc = lastPlayer ? lastPick?.team.logo : undefined;
  useEffect(() => {
    let cancelled = false;
    for (const src of [logoSrc, lastLogoSrc]) {
      if (!src) continue;
      void sampleLogoColor(src).then((hex) => {
        if (!cancelled && hex) setLogoColors((c) => (c[src] === hex ? c : { ...c, [src]: hex }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [logoSrc, lastLogoSrc]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // A live draft runs for hours; don't let the laptop blank the TV feed.
  useEffect(() => {
    let cancelled = false;

    async function acquire() {
      try {
        if (!("wakeLock" in navigator)) return;
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release();
          return;
        }
        wakeLock.current = sentinel;
      } catch {
        // Unsupported or denied. The draft still works, the screen may just sleep.
      }
    }

    void acquire();

    const onVisible = () => {
      if (document.visibilityState === "visible" && !wakeLock.current) void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void wakeLock.current?.release();
      wakeLock.current = null;
    };
  }, []);

  const start = useCallback(
    (index: number): ClockState => {
      const seconds = picks[index]?.seconds ?? 0;
      return { index, phase: "clock", remainingMs: seconds * 1000, startedAt: Date.now() };
    },
    [picks]
  );

  const notStarted = state.phase === "clock" && state.startedAt === null && state.remainingMs === totalMs;

  /**
   * The one button that runs the draft. On an untouched clock it starts it (so
   * the first press of the night can't accidentally announce pick 1); on a
   * running clock it announces the pick; once announced it moves the draft on.
   */
  /** First press reveals the second team, second press clears the board. */
  const advanceTrade = useCallback(() => {
    if (tradeStage === 0) {
      setTradeStage(1);
      return;
    }
    setTrade(null);
    setTradeStage(0);
  }, [tradeStage]);

  const primary = useCallback(() => {
    if (announcement) return;
    if (state.phase === "in" && Date.now() < playerSelectLockUntil.current) return;
    if (state.phase === "in" && selectedPlayer) return;
    // A trade on the board owns the button until it has been walked through.
    if (trade) {
      advanceTrade();
      return;
    }
    setState((s) => {
      if (s.index >= picks.length) return s;
      if (s.phase === "clock") {
        const full = (picks[s.index]?.seconds ?? 0) * 1000;
        if (s.startedAt === null && s.remainingMs === full) return { ...s, startedAt: Date.now() };
        return { ...s, phase: "in", remainingMs: remainingOf(s, Date.now()), startedAt: null };
      }
      return start(s.index + 1);
    });
    setNow(Date.now());
  }, [announcement, picks, selectedPlayer, start, state.phase, trade, advanceTrade]);

  const togglePause = useCallback(() => {
    setState((s) => {
      if (s.phase !== "clock") return s;
      return s.startedAt === null
        ? { ...s, startedAt: Date.now() }
        : { ...s, remainingMs: remainingOf(s, Date.now()), startedAt: null };
    });
    setNow(Date.now());
  }, []);

  const addSeconds = useCallback((seconds: number) => {
    setState((s) => ({
      ...s,
      remainingMs: remainingOf(s, Date.now()) + seconds * 1000,
      startedAt: s.startedAt === null ? null : Date.now(),
    }));
    setNow(Date.now());
  }, []);

  const resetClock = useCallback(() => {
    setState((s) => ({
      ...s,
      phase: "clock",
      remainingMs: (picks[s.index]?.seconds ?? 0) * 1000,
      startedAt: null,
    }));
    setNow(Date.now());
  }, [picks]);

  const resetDraft = useCallback(() => {
    if (!window.confirm("Restart the draft from pick 1? This also clears every player selected so far.")) return;
    setState(initialState(picks));
    setPicked({});
    setAnnouncement(null);
    setNow(Date.now());
  }, [picks]);

  /** Records who a pick was spent on. Passing undefined clears it again. */
  const selectPlayer = useCallback((overall: number, name: string | undefined) => {
    if (name) playerSelectLockUntil.current = Date.now() + 5000;

    if (!name) {
      setPicked((p) => {
        const next = { ...p };
        delete next[overall];
        return next;
      });
      setAnnouncement((a) => (a?.pick.overall === overall ? null : a));
      return;
    }

    if (current?.overall === overall) {
      const player = playerByName.get(name) ?? { name, pos: "NFL" };
      const background = (current.team.logo && logoColors[current.team.logo]) || current.team.primary || "#123049";
      const revealOnDark = isDark(background);
      const nextAnnouncement: PickAnnouncement = {
        pick: current,
        player,
        background,
        accent: revealOnDark ? VOLT : INK,
      };

      flushSync(() => {
        setPicked((p) => ({ ...p, [overall]: name }));
        setAnnouncement(nextAnnouncement);
        setState((s) =>
          picks[s.index]?.overall === overall
            ? { ...s, phase: "in", remainingMs: remainingOf(s, Date.now()), startedAt: null }
            : s
        );
      });
      setNow(Date.now());
      return;
    }

    setPicked((p) => ({ ...p, [overall]: name }));
  }, [current, logoColors, picks, playerByName]);

  const lockPlayerSelect = useCallback(() => {
    playerSelectLockUntil.current = Date.now() + 1800;
  }, []);

  const back = useCallback(() => {
    setAnnouncement(null);
    setState((s) => {
      if (s.phase === "in") return { ...s, phase: "clock" };
      const index = Math.max(0, s.index - 1);
      return {
        index,
        phase: "clock",
        remainingMs: (picks[index]?.seconds ?? 0) * 1000,
        startedAt: null,
      };
    });
    setNow(Date.now());
  }, [picks]);

  /** Move every traded pick to its new team, then put the alert on air showing
   *  only the first team. It stays up until it is advanced by hand. */
  const announceTrade = useCallback((next: LiveTrade) => {
    if (next.a.teamId === next.b.teamId || tradeIsEmpty(next)) return;
    setOverrides((o) => ({ ...o, ...overridesForTrade(next) }));
    setTrade(next);
    setTradeStage(0);
    setTradeOpen(false);
  }, []);

  const undoTrades = useCallback(() => {
    if (Object.keys(overrides).length === 0) return;
    if (!window.confirm("Undo every trade and restore the original draft order?")) return;
    setOverrides({});
    setTrade(null);
    setTradeOpen(false);
  }, [overrides]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  const nextFromSelectionReveal = useCallback(() => {
    const announcedOverall = announcement?.pick.overall;
    setAnnouncement(null);
    setState((s) => {
      const currentOverall = picks[s.index]?.overall;
      if (currentOverall === announcedOverall) return start(s.index + 1);
      const announcedIndex = picks.findIndex((pick) => pick.overall === announcedOverall);
      return announcedIndex >= 0 && s.index <= announcedIndex ? start(announcedIndex + 1) : s;
    });
    setNow(Date.now());
  }, [announcement?.pick.overall, picks, start]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // Never hijack keys while the trade form has focus, or Space would
      // announce a pick instead of operating the dropdown.
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("select, input, textarea, [data-trade-panel]")
      ) {
        return;
      }

      if (event.key === "t" || event.key === "T") {
        setTradeOpen((v) => !v);
        return;
      }
      if (event.key === "Escape") {
        setTradeOpen(false);
        setTrade(null);
        return;
      }

      switch (event.key) {
        case " ":
        case "Enter":
          event.preventDefault();
          primary();
          break;
        case "p":
        case "P":
          togglePause();
          break;
        case "Backspace":
        case "ArrowLeft":
          event.preventDefault();
          back();
          break;
        case "r":
        case "R":
          resetClock();
          break;
        case "Home":
          event.preventDefault();
          resetDraft();
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "h":
        case "H":
          setShowControls((v) => !v);
          break;
        case "ArrowUp":
          event.preventDefault();
          addSeconds(30);
          break;
        default:
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [primary, togglePause, back, resetClock, resetDraft, toggleFullscreen, addSeconds]);

  // The reference shows the team on the clock plus the next two.
  const nextTwo = useMemo(() => picks.slice(state.index + 1, state.index + 3), [picks, state.index]);
  const progress = Math.min(100, Math.max(0, (remaining / totalMs) * 100));
  const primaryLabel = trade
    ? tradeStage === 0
      ? "Reveal Other Team"
      : "Clear Trade"
    : notStarted
    ? "Start Clock"
    : state.phase === "clock"
    ? "Pick Is In"
    : "Next Pick";

  // One colour for the whole banner, taken from the logo so the two never differ.
  const tradeCount = Object.keys(overrides).length;
  const bannerBg = (logoSrc && logoColors[logoSrc]) || current?.team.primary || "#123049";
  const onDark = isDark(bannerBg);
  const ink = onDark ? "#ffffff" : INK;
  const accent = onDark ? VOLT : INK;
  const showSelectionTakeover = Boolean(announcement);

  if (!current) {
    return (
      <Shell
        reserveControlSpace
        overlay={
          <Controls>
            <button
              onClick={back}
              className="rounded-md border border-white/25 px-4 py-2 font-cond text-sm uppercase tracking-widest text-white/70"
            >
              Back to last pick
            </button>
            <ControlButton onClick={resetDraft}>Restart Draft</ControlButton>
            <ExitLink />
          </Controls>
        }
      >
        <Banner>
          <div className="flex h-full items-center justify-center">
            <div
              className="font-cond font-extrabold uppercase leading-none tracking-wide text-white"
              style={{ fontSize: px(30) }}
            >
              Draft complete
            </div>
          </div>
        </Banner>
      </Shell>
    );
  }

  return (
    <>
      <Shell
        reserveControlSpace={showControls}
        overlay={
          <>
            {tradeOpen && (
              <DraftTradePanel
                picks={picks.slice(state.index)}
                teams={TEAMS}
                playerNames={playerNames}
                tradeCount={tradeCount}
                onAnnounce={announceTrade}
                onUndo={undoTrades}
                onClose={() => setTradeOpen(false)}
              />
            )}

            {showControls ? (
              <Controls>
                <button
                  onClick={primary}
                  className="rounded-md px-5 py-2.5 font-cond text-lg font-extrabold uppercase tracking-wider text-black"
                  style={{ background: VOLT }}
                >
                  {primaryLabel}
                </button>
                <ControlButton onClick={togglePause} disabled={state.phase !== "clock"}>
                  {running ? "Pause" : "Start"}
                </ControlButton>
                <ControlButton onClick={() => addSeconds(30)}>+30s</ControlButton>
                <ControlButton onClick={resetClock}>Reset Clock</ControlButton>
                <ControlButton onClick={back}>Back</ControlButton>
                <PlayerSearch
                  team={current.team}
                  overall={current.overall}
                  selected={selectedPlayer}
                  names={playerNames}
                  onSelect={selectPlayer}
                  onInteract={lockPlayerSelect}
                />
                {selectedPlayer && !showSelectionTakeover && (
                  <ControlButton onClick={() => selectPlayer(current.overall, undefined)}>Clear Player</ControlButton>
                )}
                <ControlButton onClick={() => setTradeOpen((v) => !v)}>
                  Trade (T){tradeCount > 0 ? ` - ${tradeCount}` : ""}
                </ControlButton>
                <ControlButton onClick={resetDraft}>Restart Draft</ControlButton>
                <ControlButton onClick={toggleFullscreen}>Fullscreen</ControlButton>
                <ControlButton onClick={() => setShowControls(false)}>Hide Controls</ControlButton>
                <span className="font-cond text-sm uppercase tracking-widest text-white/35">
                  {current.team.name} - pick {current.overall} of {picks.length}
                  {state.phase === "clock" && !running && !expired && (notStarted ? " - ready" : " - paused")}
                </span>
                <ExitLink />
              </Controls>
            ) : (
              <button
                onClick={() => setShowControls(true)}
                className="absolute bottom-3 right-3 rounded-md border border-white/10 px-2.5 py-1 font-cond text-[10px] uppercase tracking-widest text-white/20"
              >
                Controls
              </button>
            )}
          </>
        }
      >
        {lastPick && lastPlayer && (
          <LastPickStrip
            key={lastPick.overall}
            pick={lastPick}
            player={lastPlayer}
            background={(lastLogoSrc && logoColors[lastLogoSrc]) || lastPick.team.primary}
          />
        )}

      <Banner>
        {/* Upcoming-picks strip: the team on the clock on a dark cell, the rest grey. */}
        <div className="flex h-[21.78%] items-stretch">
          <div
            className="flex items-baseline font-cond font-bold uppercase"
            style={{
              gap: px(4),
              paddingLeft: px(9),
              paddingRight: px(11),
              background: bannerBg,
              color: ink,
            }}
          >
            <span style={{ fontSize: px(11) }}>{current.overall}.</span>
            <span style={{ fontSize: px(14) }}>{current.team.abbrev}</span>
          </div>

          <div
            className="flex flex-1 items-baseline bg-[linear-gradient(180deg,#9ba5af_0%,#7d8791_100%)] font-cond font-bold uppercase"
            style={{ gap: px(4), paddingLeft: px(11) }}
          >
            {nextTwo.map((pick, i) => (
              <div key={pick.overall} className="flex items-baseline" style={{ gap: px(3) }}>
                {i > 0 && (
                  <span className="text-black/30" style={{ fontSize: px(12), paddingRight: px(6), paddingLeft: px(3) }}>
                    |
                  </span>
                )}
                <span className="text-black/45" style={{ fontSize: px(11) }}>
                  {pick.overall}.
                </span>
                <span className="text-white/85" style={{ fontSize: px(14) }}>
                  {pick.team.abbrev}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Main panel */}
        <div className="relative flex-1 overflow-hidden" style={{ background: bannerBg }}>
          {state.phase === "in" ? (
            // Keyed by pick so the entrance animations replay on every announcement.
            <div key={`in-${current.overall}`} className="flex h-full items-center">
              <div
                className="draft-slide-in min-w-0 flex-1 truncate font-cond font-extrabold uppercase leading-none"
                style={{
                  fontSize: nameSize(current.team.name),
                  paddingLeft: px(14),
                  paddingRight: px(10),
                  letterSpacing: "0.01em",
                  color: ink,
                }}
              >
                {current.team.name}
              </div>
              <div
                className="draft-slam shrink-0 text-right font-cond font-extrabold italic uppercase leading-[0.78]"
                style={{ color: accent, paddingRight: px(12) }}
              >
                <div style={{ fontSize: px(34) }}>Pick</div>
                <div style={{ fontSize: px(21) }}>is in</div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center">
              <div
                className="shrink-0 text-center font-cond font-extrabold uppercase leading-[0.85]"
                style={{ paddingLeft: px(9), paddingRight: px(18), color: ink }}
              >
                <div style={{ fontSize: px(13) }}>RD</div>
                <div style={{ fontSize: px(26) }}>{current.round}</div>
              </div>

              <div
                className={`font-cond font-extrabold leading-none tabular-nums ${expired ? "animate-pulse" : ""}`}
                style={{ fontSize: px(54), color: expired ? DANGER : accent }}
              >
                {formatClock(remaining)}
              </div>

              {current.team.logo && (
                // Last flex child + ml-auto: DOM order pins it to the right edge.
                // The negative margin lets it bleed off, as the reference does.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.team.logo}
                  alt=""
                  aria-hidden
                  className="pointer-events-none ml-auto block shrink-0 object-contain"
                  style={{ height: px(112), marginRight: px(-14) }}
                />
              )}
            </div>
          )}
        </div>

        {/* Announcement hit. Mounts only on entering "in", so it fires once per
            pick and never when stepping back to the clock. */}
        {state.phase === "in" && (
          <div
            key={`fx-${current.overall}`}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
          >
            <div className="draft-flash absolute inset-0 bg-white" />
            <div
              className="draft-wipe absolute inset-y-0 left-0 w-1/4"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)",
              }}
            />
          </div>
        )}

        {/* Time bar */}
        <div className="h-[5.94%] w-full bg-black/60">
          <div
            className="h-full transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%`, background: expired ? DANGER : BAR_GREEN }}
          />
        </div>
      </Banner>

      {trade && (
        <DraftTradeAlert
          key={trade.id}
          trade={trade}
          picks={basePicks}
          teams={TEAMS}
          players={players}
          accent={VOLT}
          stage={tradeStage}
        />
      )}
      </Shell>

      {announcement && (
        <SelectionTakeover
          key={`selection-${announcement.pick.overall}-${announcement.player.name}`}
          pick={announcement.pick}
          player={announcement.player}
          background={announcement.background}
          accent={announcement.accent}
          onNext={nextFromSelectionReveal}
        />
      )}
    </>
  );
}

/** Black surround, with the banner centred at the reference aspect ratio. */
function Shell({
  children,
  overlay,
  reserveControlSpace,
}: {
  children: React.ReactNode;
  /** Pinned to the shell, outside the scaled stack: controls and the trade form.
   *  A transform makes its subtree the containing block, so anything absolutely
   *  positioned against the shell has to live here rather than in children. */
  overlay?: React.ReactNode;
  /** Keeps the centred stack clear of the control bar when it is showing. */
  reserveControlSpace?: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const stack = useRef<HTMLDivElement>(null);
  // Every size in the banner is a share of the viewport *width*, so a short
  // window — a laptop with browser chrome, rather than the fullscreen TV — can
  // leave the banner plus a trade alert taller than the space available. Scale
  // the stack to fit instead of letting the bottom crop off.
  const [scale, setScale] = useState(1);

  // scrollHeight and clientHeight are layout measurements, which a transform
  // doesn't affect, so applying the scale can't feed back in and oscillate —
  // re-running this on a scale change settles rather than loops.
  const fit = useCallback(() => {
    const frameEl = frame.current;
    const stackEl = stack.current;
    if (!frameEl || !stackEl) return;

    const { paddingTop, paddingBottom } = getComputedStyle(frameEl);
    const available = frameEl.clientHeight - parseFloat(paddingTop) - parseFloat(paddingBottom);
    const needed = stackEl.scrollHeight;
    setScale(needed > 0 && needed > available ? available / needed : 1);
  }, []);

  // Measure after every render, so an alert appearing or gaining a row is caught
  // in the same frame it paints — before the viewer sees it overflow. The scale
  // can only be known by measuring, so the cascading render the rule warns about
  // is the point here; it settles in one pass because setScale bails on an equal
  // value and the measurements ignore the transform.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useLayoutEffect(fit);

  // Picks up what a render doesn't: resizing the window, entering fullscreen for
  // the TV, and late layout shifts as fonts or artwork load.
  useEffect(() => {
    const frameEl = frame.current;
    const stackEl = stack.current;
    if (!frameEl || !stackEl) return;

    const observer = new ResizeObserver(fit);
    observer.observe(frameEl);
    observer.observe(stackEl);
    // The observer covers both on its own in a normal browser; the listeners are
    // the cheap guarantee that going fullscreen mid-draft can't leave the banner
    // stuck at a smaller scale until the next render.
    window.addEventListener("resize", fit);
    document.addEventListener("fullscreenchange", fit);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
      document.removeEventListener("fullscreenchange", fit);
    };
  }, [fit]);

  return (
    <div className="fixed inset-0 z-50 select-none bg-black text-white">
      <div
        ref={frame}
        className="flex h-full flex-col items-center justify-center overflow-hidden"
        style={{ paddingBottom: reserveControlSpace ? "7.5rem" : undefined }}
      >
        <div
          ref={stack}
          className="flex w-full flex-col items-center"
          style={{ transform: scale < 1 ? `scale(${scale})` : undefined }}
        >
          {children}
        </div>
      </div>
      {overlay}
    </div>
  );
}

/** Round and slot as the board says it, e.g. "1.09". */
function pickLabel(pick: LivePick) {
  return `${pick.round}.${String(pick.slot).padStart(2, "0")}`;
}

/**
 * The pick that just happened, sitting on top of the banner in the selecting
 * team's colour while the next team runs down their clock.
 */
function LastPickStrip({
  pick,
  player,
  background,
}: {
  pick: LivePick;
  player: TradePlayer;
  background: string;
}) {
  const ink = isDark(background) ? "#ffffff" : INK;

  return (
    <div
      className="draft-slide-in flex w-screen items-center overflow-hidden font-cond uppercase"
      style={{
        background,
        color: ink,
        gap: px(6),
        paddingLeft: px(9),
        paddingRight: px(11),
        paddingTop: px(3),
        paddingBottom: px(3),
      }}
    >
      {pick.team.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pick.team.logo}
          alt=""
          aria-hidden
          className="shrink-0 object-contain"
          style={{ width: px(20), height: px(20) }}
        />
      )}

      <span className="shrink-0 font-extrabold" style={{ fontSize: px(15) }}>
        {pickLabel(pick)}
      </span>
      <span className="shrink-0 truncate font-bold" style={{ fontSize: px(11), opacity: 0.75 }}>
        {pick.team.name}
      </span>

      <span aria-hidden className="shrink-0" style={{ fontSize: px(11), opacity: 0.4 }}>
        |
      </span>

      <DraftPlayerFace player={player} ink={ink} size={px(20)} chipFontSize={px(8)} />
      <span className="min-w-0 truncate font-extrabold" style={{ fontSize: px(15) }}>
        {player.name}
      </span>
      <span className="shrink-0" style={{ fontSize: px(9), opacity: 0.65 }}>
        {[player.pos, player.proTeam].filter(Boolean).join(" · ")}
      </span>
    </div>
  );
}

function SelectionTakeover({
  pick,
  player,
  background,
  accent,
  onNext,
}: {
  pick: LivePick;
  player: TradePlayer;
  background: string;
  accent: string;
  onNext: () => void;
}) {
  const secondary = pick.team.secondary || background;
  const playerMeta = [player.pos, player.proTeam].filter(Boolean).join(" - ");
  const nflLogo = proTeamLogoUrl(player.proTeam);
  const pickText = pickLabel(pick);

  return (
    <div
      className="selection-reveal-root fixed inset-0 z-[80] overflow-hidden bg-black font-cond uppercase text-white"
      style={{ position: "fixed", inset: 0, zIndex: 2147483647, background: "#000000" }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(125deg, ${background} 0%, ${secondary} 37%, #030712 74%, #01030a 100%)`,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 18% 12%, rgba(255,255,255,0.24), transparent 23%), radial-gradient(circle at 80% 72%, rgba(210,236,31,0.18), transparent 28%), linear-gradient(115deg, rgba(2,6,23,0.04) 0%, rgba(2,6,23,0.56) 52%, rgba(2,6,23,0.88) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.24) 46%, transparent 72%)",
          opacity: 0.28,
        }}
      />
      <div
        aria-hidden
        className="selection-reveal-scan pointer-events-none absolute inset-y-0 left-0 w-1/4"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)" }}
      />

      {pick.team.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pick.team.logo}
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-[-4vw] top-1/2 object-contain"
          style={{ width: "min(50vw, 62vh)", height: "min(50vw, 62vh)", opacity: 0.1, transform: "translateY(-50%)" }}
        />
      )}

      <div className="relative z-10 flex h-full min-h-0 flex-col overflow-hidden" style={{ padding: "clamp(22px, 3vw, 54px)" }}>
        <div className="selection-reveal-stage flex shrink-0 items-center justify-between gap-6" style={{ minHeight: "clamp(64px, 9vh, 112px)", paddingRight: "clamp(10rem, 14vw, 17rem)" }}>
          <div className="flex min-w-0 items-center gap-5 overflow-hidden">
            <div
              className="shrink-0 font-extrabold tracking-[0.2em]"
              style={{ color: accent, fontSize: "clamp(1.25rem, 2vw, 2.6rem)" }}
            >
              MGL DRAFT
            </div>
            <div className="h-[0.3rem] min-w-14 flex-1 max-w-[13rem]" style={{ background: accent }} />
            <div className="shrink-0 font-extrabold tracking-[0.18em]" style={{ fontSize: "clamp(1.1rem, 1.7vw, 2.2rem)" }}>
              THE PICK IS IN
            </div>
          </div>
          <div className="shrink-0 bg-black/50 px-5 py-3 font-extrabold tracking-[0.18em]" style={{ fontSize: "clamp(1rem, 1.45vw, 1.8rem)" }}>
            PICK {pickText}
          </div>
        </div>

        <div
          className="grid min-h-0 flex-1 items-center"
          style={{
            gridTemplateColumns: "minmax(18rem, 40vw) minmax(0, 1fr)",
            gap: "clamp(24px, 4vw, 84px)",
            paddingBottom: "clamp(14px, 2vh, 34px)",
            paddingTop: "clamp(12px, 2vh, 28px)",
          }}
        >
          <div
            className="selection-reveal-card relative h-full min-h-0 overflow-hidden border border-white/18 bg-black/35 shadow-[0_2rem_5rem_rgba(0,0,0,0.45)]"
            style={{ maxHeight: "100%" }}
          >
            <PlayerHeroImage player={player} />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.54) 100%)" }}
            />

            <div className="absolute left-[1.5vw] top-[2vh] flex items-center gap-3">
              <span className="grid h-16 w-16 place-items-center bg-black/78 font-extrabold" style={{ color: accent, fontSize: "clamp(1.3rem, 2vw, 2.4rem)" }}>
                {player.pos}
              </span>
              {player.proTeam && (
                <span className="bg-black/62 px-4 py-2 font-extrabold tracking-[0.18em]" style={{ fontSize: "clamp(1rem, 1.5vw, 1.9rem)" }}>
                  {player.proTeam}
                </span>
              )}
            </div>

            {nflLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={nflLogo}
                alt=""
                aria-hidden
                className="absolute bottom-[2.2vh] right-[1.6vw] object-contain drop-shadow-[0_1rem_1.8rem_rgba(0,0,0,0.55)]"
                style={{ height: "clamp(78px, 12vh, 140px)", width: "clamp(78px, 12vh, 140px)" }}
              />
            )}
          </div>

          <div className="flex min-h-0 min-w-0 flex-col justify-center overflow-hidden">
            <div className="selection-reveal-stage font-extrabold tracking-[0.16em] text-white/70" style={{ fontSize: "clamp(1rem, 1.5vw, 2rem)" }}>
              {playerMeta || "Selected Player"}
            </div>

            <div
              className="selection-reveal-name mt-[1.6vh] min-w-0 break-words font-extrabold"
              style={{
                color: "#ffffff",
                fontSize: "clamp(3.2rem, 5.9vw, 7.1rem)",
                letterSpacing: "-0.035em",
                lineHeight: 0.9,
                textShadow: "0 0.08em 0.24em rgba(0,0,0,0.5)",
              }}
            >
              {player.name}
            </div>

            <div className="mt-[3vh] grid min-h-0 grid-cols-2 gap-[1.2vw]">
              <div className="selection-reveal-card grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-4 bg-black/42 p-4 shadow-[0_1rem_3rem_rgba(0,0,0,0.28)]">
                <div className="grid place-items-center bg-white/94 p-3" style={{ height: "clamp(76px, 11vh, 130px)", width: "clamp(76px, 11vh, 130px)" }}>
                  {nflLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={nflLogo} alt={`${player.proTeam} logo`} className="h-full w-full object-contain" />
                  ) : (
                    <span className="font-extrabold text-black" style={{ fontSize: "clamp(1.5rem, 3vw, 4rem)" }}>
                      {player.proTeam || player.pos}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-bold tracking-[0.2em] text-white/58" style={{ fontSize: "clamp(0.75rem, 1.1vw, 1.35rem)" }}>
                    NFL TEAM
                  </div>
                  <div className="truncate font-extrabold leading-none" style={{ fontSize: "clamp(1.8rem, 3.1vw, 4.4rem)" }}>
                    {player.proTeam || "NFL"}
                  </div>
                </div>
              </div>

              <div className="selection-reveal-card grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-4 bg-black/42 p-4 shadow-[0_1rem_3rem_rgba(0,0,0,0.28)]">
                <div className="grid place-items-center bg-white/94 p-3" style={{ height: "clamp(76px, 11vh, 130px)", width: "clamp(76px, 11vh, 130px)" }}>
                  {pick.team.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pick.team.logo} alt={`${pick.team.name} logo`} className="h-full w-full object-contain" />
                  ) : (
                    <span className="font-extrabold" style={{ color: background, fontSize: "clamp(1.5rem, 3vw, 4rem)" }}>
                      {pick.team.abbrev}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-bold tracking-[0.2em] text-white/58" style={{ fontSize: "clamp(0.75rem, 1.1vw, 1.35rem)" }}>
                    DRAFTED TO
                  </div>
                  <div className="truncate font-extrabold leading-none" style={{ fontSize: "clamp(1.7rem, 2.8vw, 4rem)" }}>
                    {pick.team.name}
                  </div>
                </div>
              </div>
            </div>

            <div className="selection-reveal-stage mt-[2.4vh] flex flex-wrap gap-3">
              <div className="bg-black/50 px-5 py-3 font-extrabold tracking-[0.18em] text-white" style={{ fontSize: "clamp(0.95rem, 1.35vw, 1.7rem)" }}>
                ROUND {pick.round}
              </div>
              <div className="bg-black/50 px-5 py-3 font-extrabold tracking-[0.18em] text-white" style={{ fontSize: "clamp(0.95rem, 1.35vw, 1.7rem)" }}>
                PICK {pick.slot}
              </div>
              <div className="px-5 py-3 font-extrabold tracking-[0.18em] text-black" style={{ background: accent, fontSize: "clamp(0.95rem, 1.35vw, 1.7rem)" }}>
                OVERALL {pick.overall}
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onNext();
        }}
        className="absolute right-8 top-8 z-20 px-7 py-3 font-extrabold uppercase tracking-wider text-black shadow-[0_0_2rem_rgba(0,0,0,0.35)]"
        style={{ background: VOLT }}
      >
        Next Pick
      </button>
    </div>
  );
}

function PlayerHeroImage({ player }: { player: TradePlayer }) {
  const [failed, setFailed] = useState(false);
  const image = player.sleeperId && !failed ? sleeperPlayerImage(player.sleeperId) : null;

  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image.url}
        alt={player.name}
        onError={() => setFailed(true)}
        className={image.isLogo ? "absolute inset-0 h-full w-full bg-white/92 object-contain p-[7vh]" : "absolute inset-0 h-full w-full object-cover object-top"}
      />
    );
  }

  return (
    <div className="relative grid h-full w-full place-items-center" style={{ background: POS_COLOR[player.pos] ?? "#475569" }}>
      <span className="font-extrabold text-white/86" style={{ fontSize: "clamp(5rem, 12vw, 14rem)" }}>
        {player.pos}
      </span>
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex w-screen flex-col overflow-hidden"
      style={{ aspectRatio: `${REF_W} / ${REF_H}` }}
    >
      {children}
    </div>
  );
}

function Controls({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-2 p-3">
      {children}
    </div>
  );
}

function ExitLink() {
  return (
    <Link
      href="/admin"
      className="rounded-md border border-white/20 px-3 py-2 font-cond text-sm uppercase tracking-widest text-white/60"
    >
      Exit
    </Link>
  );
}
/**
 * Names the player a pick was spent on. Lives in the control bar rather than on
 * the banner, so nothing operator-facing ever paints on the TV feed. Committing
 * is deliberately forgiving — picking from the datalist, typing the full name,
 * or pressing Enter on a unique prefix all work, since this is being driven in a
 * hurry with a room watching.
 */
function PlayerSearch({
  team,
  overall,
  selected,
  names,
  onSelect,
  onInteract,
}: {
  team: TeamMeta;
  overall: number;
  selected?: TradePlayer;
  names: string[];
  onSelect: (overall: number, name: string | undefined) => void;
  onInteract: () => void;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const value = raw.trim().toLowerCase();
    if (!value) return;
    const match =
      names.find((n) => n.toLowerCase() === value) ??
      names.filter((n) => n.toLowerCase().startsWith(value))[0];
    if (!match) return;
    onSelect(overall, match);
    setDraft("");
  };

  if (selected) {
    return (
      <span className="rounded-md border border-white/15 px-3 py-2 font-cond text-sm uppercase tracking-wider text-white/45">
        {team.abbrev}: {selected.name}
      </span>
    );
  }

  return (
    <>
      <input
        value={draft}
        list="mgl-clock-player-names"
        placeholder={`${team.abbrev} selects...`}
        onFocus={onInteract}
        onPointerDown={onInteract}
        onChange={(e) => {
          onInteract();
          setDraft(e.target.value);
          // Choosing from the datalist fires change with the whole name, so the
          // pick lands on click without needing Enter as well.
          if (names.some((n) => n.toLowerCase() === e.target.value.trim().toLowerCase())) {
            commit(e.target.value);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            onInteract();
            commit(draft);
          }
        }}
        className="w-56 rounded-md border border-white/25 bg-black px-3 py-2 font-cond text-sm text-white placeholder:text-white/30"
      />
      <datalist id="mgl-clock-player-names">
        {names.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </>
  );
}

function ControlButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-white/20 px-3 py-2 font-cond text-sm uppercase tracking-wider text-white/70 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
