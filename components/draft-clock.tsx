"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { TEAMS } from "@/lib/teams";
import { DraftTradeAlert } from "@/components/draft-trade-alert";
import { DraftTradePanel } from "@/components/draft-trade-panel";

const STORAGE_KEY = "mgl-draft-clock-v1";
const TRADES_KEY = "mgl-draft-trades-v1";

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

  const [state, setState] = useState<ClockState>(() => initialState(basePicks));
  const [now, setNow] = useState(() => Date.now());
  const [loaded, setLoaded] = useState(false);
  const [showControls, setShowControls] = useState(true);
  // Keyed by source so a team change falls back immediately instead of
  // briefly painting the banner in the previous team's colour.
  const [logoBg, setLogoBg] = useState<{ src: string; hex: string } | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const current = picks[state.index];
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
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running]);

  // Take the banner's colour from the team's own artwork (see sampleLogoColor).
  const logoSrc = current?.team.logo;
  useEffect(() => {
    if (!logoSrc) return;
    let cancelled = false;
    void sampleLogoColor(logoSrc).then((hex) => {
      if (!cancelled && hex) setLogoBg({ src: logoSrc, hex });
    });
    return () => {
      cancelled = true;
    };
  }, [logoSrc]);

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
  }, [picks, start, trade, advanceTrade]);

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
    if (!window.confirm("Restart the draft from pick 1?")) return;
    setState(initialState(picks));
    setNow(Date.now());
  }, [picks]);

  const back = useCallback(() => {
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
  const sampled = logoBg && logoBg.src === logoSrc ? logoBg.hex : null;
  const bannerBg = sampled ?? current?.team.primary ?? "#123049";
  const onDark = isDark(bannerBg);
  const ink = onDark ? "#ffffff" : INK;
  const accent = onDark ? VOLT : INK;

  if (!current) {
    return (
      <Shell>
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
      </Shell>
    );
  }

  return (
    <Shell reserveControlSpace={showControls}>
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
    </Shell>
  );
}

/** Black surround, with the banner centred at the reference aspect ratio. */
function Shell({
  children,
  controls,
  reserveControlSpace,
}: {
  children: React.ReactNode;
  controls?: React.ReactNode;
  /** Keeps the centred stack clear of the control bar when it is showing. */
  reserveControlSpace?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 select-none bg-black text-white">
      <div
        className="flex h-full flex-col items-center justify-center"
        style={{ paddingBottom: reserveControlSpace ? "7.5rem" : undefined }}
      >
        {children}
      </div>
      {controls}
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
