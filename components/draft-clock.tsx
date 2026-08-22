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
/** Carries the board from the control window to the TV window. Same browser,
 *  so a second monitor over HDMI is exactly the case this covers. */
const SYNC_CHANNEL = "mgl-draft-clock-sync";

/**
 * "control" is the operator: every button, and the source of truth.
 * "display" is the TV: the same board with no chrome, following the control
 * window. Both windows tick their own clock off the shared `startedAt`, so
 * only the board itself has to travel — not a message per second.
 *
 * Presentation is a separate axis (`overlayStyle`), because the banner laid
 * over the Sleeper draft room can be either: a follower fed by Sleeper, or the
 * operator's own clock with its controls sitting on top of the board.
 */
export type DraftClockMode = "control" | "display";

/** Who each pick was spent on, keyed by overall pick number. Keyed that way
 *  rather than by team so a traded pick keeps its selection. */
type PickedPlayers = Record<number, string>;
type PickAnnouncement = {
  pick: LivePick;
  player: TradePlayer;
  background: string;
  accent: string;
};

/** Everything the TV mirrors. Deliberately not `showControls` or `tradeOpen`:
 *  the operator's chrome is the one thing that stays on the laptop. */
export type SyncSnapshot = {
  state: ClockState;
  overrides: PickOverrides;
  picked: PickedPlayers;
  announcement: PickAnnouncement | null;
  trade: LiveTrade | null;
  tradeStage: number;
};

type SyncMessage = { type: "hello" } | { type: "sync"; snapshot: SyncSnapshot };

// Palette and proportions are traced from the NFL Network draft ticker this is
// meant to look like. The reference crop is 419x101, so every size inside the
// banner is expressed as a share of that: 1 reference px = 100/419 vw. Keep
// them in those units and the banner scales to any TV at the exact same shape.
const REF_W = 419;
const REF_H = 101;
/** Reference px -> vw, given the banner spans the full viewport width. */
const px = (n: number) => `${(n * 100) / REF_W}vw`;

/** Broadcast yellow-green used for the clock and "PICK IS IN". */
export const VOLT = "#d2ec1f";
const BAR_GREEN = "#66d411";
const DANGER = "#ff3b30";
/** Clock/accent colour when the team's backdrop is too light for VOLT. */
export const INK = "#0b1220";

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
  mode = "control",
  feed = null,
  overlayStyle = false,
  overlayScale = 1,
}: {
  picks: LivePick[];
  /** Tradable players — autocomplete in the editor, headshots in the alert. */
  players?: TradePlayer[];
  /** "display" strips the operator's chrome and follows the control window. */
  mode?: DraftClockMode;
  /** A board pushed in from outside, for a follower with no control window. */
  feed?: SyncSnapshot | null;
  /** No backdrop, pinned to the bottom edge: the banner over a draft board. */
  overlayStyle?: boolean;
  /** Shrinks the banner so it sits over a draft board without burying it. */
  overlayScale?: number;
}) {
  const isOverlay = overlayStyle;
  /** A follower: no chrome, no writes, no keys of its own. */
  const isDisplay = mode === "display";
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

  // Only the control window writes. The TV holds the same board but is a
  // follower, so letting it save would risk it overwriting the real state with
  // whatever it had when a message was missed.
  useEffect(() => {
    if (!loaded || isDisplay) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loaded, isDisplay]);

  useEffect(() => {
    if (!loaded || isDisplay) return;
    localStorage.setItem(TRADES_KEY, JSON.stringify(overrides));
  }, [overrides, loaded, isDisplay]);

  useEffect(() => {
    if (!loaded || isDisplay) return;
    localStorage.setItem(PICKED_KEY, JSON.stringify(picked));
  }, [picked, loaded, isDisplay]);

  useEffect(() => {
    if (!loaded || isDisplay) return;
    if (announcement) localStorage.setItem(ANNOUNCEMENT_KEY, JSON.stringify(announcement));
    else localStorage.removeItem(ANNOUNCEMENT_KEY);
  }, [announcement, loaded, isDisplay]);

  const snapshot = useMemo<SyncSnapshot>(
    () => ({ state, overrides, picked, announcement, trade, tradeStage }),
    [state, overrides, picked, announcement, trade, tradeStage]
  );
  /** Read by the "hello" reply, which has to answer with the board as it is at
   *  that moment rather than the one captured when the channel opened. */
  const latest = useRef(snapshot);
  useEffect(() => {
    latest.current = snapshot;
  }, [snapshot]);

  const outbound = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (isDisplay || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(SYNC_CHANNEL);
    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      // A TV window opened mid-draft: hand it the board rather than making it
      // wait for the next press to catch up.
      if (event.data?.type === "hello") channel.postMessage({ type: "sync", snapshot: latest.current });
    };
    outbound.current = channel;
    return () => {
      channel.close();
      outbound.current = null;
    };
  }, [isDisplay]);

  useEffect(() => {
    if (isDisplay || !loaded) return;
    outbound.current?.postMessage({ type: "sync", snapshot });
  }, [isDisplay, loaded, snapshot]);

  // Overlay mode skips the channel entirely: inside a third-party iframe on
  // sleeper.com its storage is partitioned away from the real site, so it is
  // driven by the Sleeper feed below instead.
  useEffect(() => {
    if (mode !== "display" || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(SYNC_CHANNEL);
    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      const message = event.data;
      if (message?.type !== "sync") return;
      setState(message.snapshot.state);
      setOverrides(message.snapshot.overrides);
      setPicked(message.snapshot.picked);
      setAnnouncement(message.snapshot.announcement);
      setTrade(message.snapshot.trade);
      setTradeStage(message.snapshot.tradeStage);
      setNow(Date.now());
    };
    channel.postMessage({ type: "hello" });
    return () => channel.close();
  }, [mode]);

  // Mirroring an external feed into the board is exactly the subscription case
  // the rule is written for — the polling lives outside React and the clock has
  // no other way to hear about a pick.
  useEffect(() => {
    if (!feed) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setState(feed.state);
    setOverrides(feed.overrides);
    setPicked(feed.picked);
    setAnnouncement(feed.announcement);
    setTrade(feed.trade);
    setTradeStage(feed.tradeStage);
    setNow(Date.now());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [feed]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running]);

  // The pick just completed, shown above the banner while the next team is on
  // the clock. Reads through `picks`, so a traded pick credits its new owner.
  const lastPick = state.index > 0 ? picks[state.index - 1] : undefined;
  const lastPlayer = lastPick ? playerByName.get(picked[lastPick.overall] ?? "") : undefined;

  /** Every pick made so far, in draft order — what the strip rolls through
   *  once it is done holding on the pick that just landed. */
  const history = useMemo(() => {
    const made: { pick: LivePick; player: TradePlayer }[] = [];
    for (const pick of picks.slice(0, state.index)) {
      const name = picked[pick.overall];
      if (!name) continue;
      made.push({ pick, player: playerByName.get(name) ?? { name, pos: "NFL" } });
    }
    return made;
  }, [picked, picks, playerByName, state.index]);

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

  /** Opens the chrome-free feed to drag onto the TV. Named, so pressing it a
   *  second time re-focuses the window that is already out there rather than
   *  opening a second one. Relative to this page, so /admin/draft and any
   *  future mount of the clock each find their own TV route. */
  const openTvWindow = useCallback(() => {
    const base = window.location.pathname.replace(/\/$/, "");
    window.open(`${base}/tv`, "mgl-draft-tv", "width=1280,height=760");
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

      // The TV window takes no instructions of its own beyond going fullscreen
      // — everything else would put the two screens out of step.
      if (isDisplay) {
        if (event.key === "f" || event.key === "F") toggleFullscreen();
        return;
      }

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
  }, [primary, togglePause, back, resetClock, resetDraft, toggleFullscreen, addSeconds, isDisplay]);

  // The TV feed has no button to click, so the whole surface is the fullscreen
  // toggle — the one thing that has to be done from that window itself.
  useEffect(() => {
    if (!isDisplay) return;
    const onDouble = () => toggleFullscreen();
    document.addEventListener("dblclick", onDouble);
    return () => document.removeEventListener("dblclick", onDouble);
  }, [isDisplay, toggleFullscreen]);

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
  const controlsVisible = showControls && !isDisplay;

  if (!current) {
    return (
      <Shell
        reserveControlSpace={!isDisplay}
        overlayMode={isOverlay}
        overlayScale={overlayScale}
        clickThrough={isOverlay && isDisplay}
        overlay={
          isDisplay ? null : (
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
          )
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
        reserveControlSpace={controlsVisible}
        overlayMode={isOverlay}
        overlayScale={overlayScale}
        clickThrough={isOverlay && isDisplay}
        overlay={
          <>
            {tradeOpen && !isDisplay && (
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

            {isDisplay ? null : controlsVisible ? (
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
                <ControlButton onClick={openTvWindow}>TV Window</ControlButton>
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
          // Keyed by pick so the hold restarts from the top every time a new
          // selection lands.
          <PickStrip
            key={lastPick.overall}
            pick={lastPick}
            player={lastPlayer}
            history={history}
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
          operator={!isDisplay}
          clickThrough={isOverlay && isDisplay}
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
  overlayMode = false,
  overlayScale = 1,
  clickThrough = false,
}: {
  children: React.ReactNode;
  /** Lets the page underneath take the mouse. Only for a follower — an
   *  operator needs to reach their own buttons. */
  clickThrough?: boolean;
  /** Drops the black surround and pins the banner to the bottom edge, so the
   *  page underneath shows through everywhere the banner isn't. */
  overlayMode?: boolean;
  /** Applied on top of the fit scale, to keep the banner off the board. */
  overlayScale?: number;
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

  const total = (scale < 1 ? scale : 1) * overlayScale;

  return (
    <div
      className={`fixed inset-0 z-50 select-none text-white ${
        overlayMode ? "bg-transparent" : "bg-black"
      }${clickThrough ? " pointer-events-none" : ""}`}
    >
      <div
        ref={frame}
        className={`flex h-full flex-col items-center overflow-hidden ${
          overlayMode ? "justify-end" : "justify-center"
        }`}
        style={{ paddingBottom: reserveControlSpace ? "7.5rem" : undefined }}
      >
        <div
          ref={stack}
          className="flex w-full flex-col items-center"
          style={{
            transform: total !== 1 ? `scale(${total})` : undefined,
            transformOrigin: overlayMode ? "bottom center" : undefined,
          }}
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

/** `#rrggbb` -> `rgba(...)`, for laying a franchise colour over the artwork. */
function withAlpha(hex: string, alpha: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  if (hex.length !== 7 || Number.isNaN(n)) return hex;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** How long the pick that just landed holds the strip before the roll starts. */
const LAST_PICK_HOLD_MS = 30_000;
/** Roll speed, as a share of the viewport width per second. */
const TICKER_VW_PER_SECOND = 5.5;
/** Rows in the roll run smaller than the held pick, so more than one is on
 *  screen at a time and it reads as a ticker rather than a slideshow. */
const TICKER_SCALE = 0.5;

/**
 * One completed pick: crest, slot, franchise, headshot, player. `scale` shrinks
 * it for the ticker, where several rows share the strip, from the full-width
 * proportions it uses when a single pick has the strip to itself.
 */
function PickRow({
  pick,
  player,
  ink,
  scale = 1,
}: {
  pick: LivePick;
  player: TradePlayer;
  ink: string;
  scale?: number;
}) {
  const size = (n: number) => px(n * scale);

  return (
    <>
      {pick.team.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pick.team.logo}
          alt=""
          aria-hidden
          className="shrink-0 rounded-full border border-black/20 object-cover"
          style={{ width: size(20), height: size(20) }}
        />
      )}

      <span className="shrink-0 font-extrabold" style={{ fontSize: size(15) }}>
        {pickLabel(pick)}
      </span>
      <span className="shrink-0 font-bold tracking-wider" style={{ fontSize: size(12), opacity: 0.75 }}>
        {pick.team.abbrev}
      </span>

      <span aria-hidden className="shrink-0" style={{ fontSize: size(11), opacity: 0.4 }}>
        |
      </span>

      <DraftPlayerFace player={player} ink={ink} size={size(20)} chipFontSize={size(8)} />
      <span className="min-w-0 truncate font-extrabold" style={{ fontSize: size(15) }}>
        {player.name}
      </span>
      <span className="shrink-0" style={{ fontSize: size(9), opacity: 0.65 }}>
        {[player.pos, player.proTeam].filter(Boolean).join(" · ")}
      </span>
    </>
  );
}

/**
 * The strip above the banner. It opens on the pick that just happened, in the
 * selecting team's colour, and holds there for LAST_PICK_HOLD_MS — long enough
 * for the room to read it. After that it becomes a ticker rolling through every
 * pick of the draft so far, on repeat, until the next selection resets it.
 */
function PickStrip({
  pick,
  player,
  history,
  background,
}: {
  pick: LivePick;
  player: TradePlayer;
  /** Every pick made so far, oldest first. Includes `pick`. */
  history: { pick: LivePick; player: TradePlayer }[];
  background: string;
}) {
  // A one-pick draft has nothing to roll through, so it just keeps holding.
  const canRoll = history.length > 1;
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (!canRoll) return;
    const id = setTimeout(() => setRolling(true), LAST_PICK_HOLD_MS);
    return () => clearTimeout(id);
  }, [canRoll]);

  if (!rolling) {
    return (
      <div
        className="draft-slide-in flex w-screen items-center overflow-hidden font-cond uppercase"
        style={{
          background,
          color: isDark(background) ? "#ffffff" : INK,
          gap: px(6),
          paddingLeft: px(9),
          paddingRight: px(11),
          paddingTop: px(3),
          paddingBottom: px(3),
        }}
      >
        <PickRow pick={pick} player={player} ink={isDark(background) ? "#ffffff" : INK} />
      </div>
    );
  }

  return <PickTicker history={history} />;
}

/**
 * Every pick so far, sliding right to left on a loop. The list is rendered
 * twice and the row is translated by exactly half its width, so the second copy
 * is under the first at the moment the animation restarts and the seam never
 * shows.
 */
function PickTicker({ history }: { history: { pick: LivePick; player: TradePlayer }[] }) {
  const row = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);

  // Duration is derived from the measured width so the strip moves at one
  // constant speed whether three picks have been made or all 132.
  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    const copyWidth = el.scrollWidth / 2;
    const perSecond = (window.innerWidth * TICKER_VW_PER_SECOND) / 100;
    setDuration(perSecond > 0 ? copyWidth / perSecond : 0);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useLayoutEffect(measure);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    // Headshots load late and each one widens the row, so watch it rather than
    // measuring once and running at the wrong speed for the rest of the night.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    document.addEventListener("fullscreenchange", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      document.removeEventListener("fullscreenchange", measure);
    };
  }, [measure]);

  return (
    <div className="flex w-screen items-stretch overflow-hidden font-cond uppercase" style={{ background: "#0b1220", color: "#ffffff" }}>
      <div
        className="z-10 flex shrink-0 items-center font-extrabold tracking-widest"
        style={{
          background: VOLT,
          color: INK,
          fontSize: px(9),
          paddingLeft: px(9),
          paddingRight: px(9),
        }}
      >
        Picks so far
      </div>

      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div
          ref={row}
          className="draft-ticker-roll flex w-max items-center"
          style={{ animationDuration: duration > 0 ? `${duration}s` : undefined }}
        >
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
              {history.map((entry) => (
                <div
                  key={entry.pick.overall}
                  className="flex shrink-0 items-center border-l"
                  style={{
                    gap: px(6 * TICKER_SCALE),
                    borderColor: "rgba(255,255,255,0.12)",
                    borderLeftWidth: px(0.4),
                    paddingLeft: px(9),
                    paddingRight: px(9),
                    paddingTop: px(3),
                    paddingBottom: px(3),
                  }}
                >
                  <PickRow pick={entry.pick} player={entry.player} ink="#ffffff" scale={TICKER_SCALE} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Sets the biggest font size, between `minVw` and `maxVw`, at which the text
 * still fits its container on one line. A character count is too crude to size
 * these by hand — "Brian Thomas Jr." is two characters shorter than "Amon-Ra
 * St. Brown" and a good deal wider — and a name that wrapped or truncated mid-
 * announcement would be the one thing on screen everyone is looking at.
 */
function FitText({
  text,
  maxVw,
  minVw,
  className,
  style,
}: {
  text: string;
  maxVw: number;
  minVw: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<number | null>(null);

  // Same shape as Shell's fit: measure at the max size, so a wider window (or
  // going fullscreen for the TV) lets the type grow back rather than only ever
  // shrinking. The measurement ignores the size we then set, so it settles.
  const fit = useCallback(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    const max = (window.innerWidth * maxVw) / 100;
    const min = (window.innerWidth * minVw) / 100;
    el.style.fontSize = `${max}px`;
    const room = parent.clientWidth;
    const needed = el.scrollWidth;
    const next = needed > room ? Math.max(min, Math.floor((max * room) / needed)) : max;
    el.style.fontSize = `${next}px`;
    setSize(next);
  }, [maxVw, minVw]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useLayoutEffect(fit);

  useEffect(() => {
    window.addEventListener("resize", fit);
    document.addEventListener("fullscreenchange", fit);
    return () => {
      window.removeEventListener("resize", fit);
      document.removeEventListener("fullscreenchange", fit);
    };
  }, [fit]);

  return (
    <div ref={ref} className={className} style={{ ...style, fontSize: size ?? undefined, whiteSpace: "nowrap" }}>
      {text}
    </div>
  );
}

/** One segment of the round/pick/overall bar. */
function MetaCell({
  label,
  value,
  fill,
  ink,
}: {
  label: string;
  value: number;
  /** Set to paint the segment in the accent (used for the overall number). */
  fill?: string;
  ink?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center border-l border-white/10"
      style={{
        gap: "clamp(2px, 0.4vh, 6px)",
        minWidth: "clamp(64px, 7vw, 130px)",
        padding: "clamp(8px, 0.9vh, 18px) clamp(8px, 0.9vw, 20px)",
        background: fill ?? "rgba(0,0,0,0.3)",
        color: fill ? ink : "#ffffff",
      }}
    >
      <span
        className="font-bold leading-none tracking-[0.22em]"
        style={{ fontSize: "clamp(0.6rem, 0.82vw, 1rem)", opacity: fill ? 0.72 : 0.5 }}
      >
        {label}
      </span>
      <span className="font-extrabold leading-none" style={{ fontSize: "clamp(1.3rem, 2.1vw, 2.7rem)" }}>
        {value}
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
  operator = true,
  clickThrough = false,
}: {
  pick: LivePick;
  player: TradePlayer;
  background: string;
  accent: string;
  onNext: () => void;
  /** False on the TV feed: the footer keeps its space so both screens compose
   *  identically, but the prompt and the button are not shown. */
  operator?: boolean;
  /** Lets clicks fall through to the draft room underneath the overlay. */
  clickThrough?: boolean;
}) {
  const secondary = pick.team.secondary || background;
  const playerMeta = [player.pos, player.proTeam].filter(Boolean).join(" · ");
  const nflLogo = proTeamLogoUrl(player.proTeam);
  const pickText = pickLabel(pick);
  // The banner picks a dark accent for teams whose colour is light, but this
  // screen always resolves to a near-black composition — a dark accent would
  // disappear on it, so fall back to the broadcast volt.
  const hi = isDark(accent) ? VOLT : accent;
  const onHi = isDark(hi) ? "#ffffff" : "#000000";
  // The header sits on the top-left corner, the one part of the frame still in
  // full team colour. Volt on a light franchise (gold, teal) is unreadable
  // there, so that corner alone flips to ink.
  const onTeam = isDark(background);
  const headerAccent = onTeam ? hi : INK;
  const headerInk = onTeam ? "rgba(255,255,255,0.82)" : "rgba(11,18,32,0.78)";
  const pad = "clamp(20px, 2.7vw, 52px)";

  return (
    <div
      className={`selection-reveal-root fixed inset-0 z-[80] overflow-hidden bg-black font-cond uppercase text-white${
        clickThrough ? " pointer-events-none" : ""
      }`}
      style={{ position: "fixed", inset: 0, zIndex: 2147483647, background: "#000000" }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {/* The team's colour, driven diagonally into near-black so type on the
          right half always has a dark, even bed to sit on. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: `linear-gradient(118deg, ${background} 0%, ${secondary} 32%, #0a1020 70%, #01030a 100%)` }}
      />
      {/* The dark half is the franchise's too: its colours come back as glows in
          the corners the gradient has already faded out, so the whole frame is
          in team colour without ever putting a mid-tone behind the type. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: [
            `radial-gradient(70% 60% at 96% 88%, ${withAlpha(secondary, 0.5)}, transparent 72%)`,
            `radial-gradient(55% 50% at 78% 8%, ${withAlpha(background, 0.42)}, transparent 74%)`,
            "radial-gradient(60% 55% at 10% 6%, rgba(255,255,255,0.24), transparent 70%)",
          ].join(", "),
        }}
      />
      {/* Franchise artwork as a soft medallion, bleeding off the right edge.
          Several franchise "logos" are photographs, so it is knocked down to a
          duotone in the team's own colour and masked to a circle that fades out
          before its edge — that way a photo reads as branding rather than as a
          stray picture someone left on the screen. */}
      {pick.team.logo && (
        <div
          aria-hidden
          className="pointer-events-none absolute overflow-hidden rounded-full"
          style={{
            // Positioned inline as well as by class: this is a ~500px box, so
            // if the utility sheet is ever missing (a stale rebuild in dev will
            // do it) an in-flow medallion shoves the whole takeover off screen.
            position: "absolute",
            right: "-6vw",
            top: "44%",
            transform: "translateY(-50%)",
            width: "min(52vh, 34vw)",
            height: "min(52vh, 34vw)",
            opacity: 0.26,
            isolation: "isolate",
            maskImage: "radial-gradient(circle at 50% 50%, #000 38%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 38%, transparent 70%)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pick.team.logo}
            alt=""
            className="h-full w-full object-cover"
            style={{ filter: "grayscale(1) contrast(1.15)" }}
          />
          <div className="absolute inset-0" style={{ background: secondary, mixBlendMode: "color" }} />
        </div>
      )}
      {/* Broadcast pinstripe, faint enough to read as texture rather than lines. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: "repeating-linear-gradient(115deg, #ffffff 0 2px, transparent 2px 15px)" }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "radial-gradient(125% 105% at 50% 45%, transparent 32%, rgba(0,0,0,0.66) 100%)" }}
      />
      <div
        aria-hidden
        className="selection-reveal-scan pointer-events-none absolute inset-y-0 left-0 w-1/4"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)" }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[0.28rem]"
        style={{ background: `linear-gradient(90deg, ${background} 0%, ${secondary} 42%, ${hi} 100%)` }}
      />

      <div
        className="relative z-10 flex h-full min-h-0 flex-col overflow-hidden"
        style={{ padding: pad, gap: "clamp(12px, 2vh, 30px)" }}
      >
        <header className="selection-reveal-stage flex shrink-0 items-center justify-between" style={{ gap: "clamp(16px, 2vw, 40px)" }}>
          <div className="flex min-w-0 items-center" style={{ gap: "clamp(10px, 1.1vw, 22px)" }}>
            <span aria-hidden className="block shrink-0" style={{ width: "0.5rem", height: "clamp(1.7rem, 2.7vw, 3.4rem)", background: headerAccent }} />
            <span className="shrink-0 font-extrabold tracking-[0.22em]" style={{ color: headerAccent, fontSize: "clamp(1rem, 1.7vw, 2.3rem)" }}>
              MGL Draft
            </span>
            <span className="min-w-0 truncate font-extrabold tracking-[0.2em]" style={{ color: headerInk, fontSize: "clamp(0.9rem, 1.45vw, 2rem)" }}>
              The pick is in
            </span>
          </div>

          <div className="flex shrink-0 items-center" style={{ gap: "clamp(10px, 1.1vw, 22px)" }}>
            {pick.team.logo && (
              <div
                className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-white/95"
                style={{
                  height: "clamp(2.2rem, 3.4vw, 4.2rem)",
                  width: "clamp(2.2rem, 3.4vw, 4.2rem)",
                  boxShadow: `0 0 0 0.2rem ${secondary}, 0 0 1.6rem ${withAlpha(secondary, 0.55)}`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pick.team.logo} alt={`${pick.team.name} logo`} className="h-full w-full object-cover" />
              </div>
            )}

            <div className="flex shrink-0 items-stretch overflow-hidden rounded-md">
            <span
              className="flex items-center bg-black/55 font-bold tracking-[0.24em] text-white/60"
              style={{ fontSize: "clamp(0.7rem, 1vw, 1.25rem)", padding: "0 clamp(10px, 0.9vw, 18px)" }}
            >
              Pick
            </span>
            <span
              className="flex items-center font-extrabold tabular-nums"
              style={{
                background: hi,
                color: onHi,
                fontSize: "clamp(1.1rem, 1.75vw, 2.3rem)",
                padding: "clamp(6px, 0.7vh, 12px) clamp(12px, 1.1vw, 22px)",
              }}
            >
              {pickText}
            </span>
            </div>
          </div>
        </header>

        <div
          className="grid min-h-0 flex-1"
          style={{ gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 1.2fr)", gap: "clamp(20px, 3vw, 64px)" }}
        >
          <div
            className="selection-reveal-card relative min-h-0 overflow-hidden rounded-[1.1rem] ring-1 ring-white/20"
            style={{ boxShadow: `0 2.5rem 6rem rgba(0,0,0,0.6), 0 0 5rem ${withAlpha(secondary, 0.4)}` }}
          >
            <PlayerHeroImage player={player} />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 24%, transparent 46%, rgba(2,4,10,0.88) 100%)",
              }}
            />

            <div
              className="absolute inset-x-0 bottom-0 flex items-end justify-between"
              style={{ gap: "clamp(8px, 1vw, 18px)", padding: "clamp(12px, 1.4vw, 26px)", paddingBottom: "clamp(18px, 2vw, 34px)" }}
            >
              <div className="flex min-w-0 items-center" style={{ gap: "clamp(8px, 0.7vw, 14px)" }}>
                <span
                  className="shrink-0 rounded-md font-extrabold leading-none"
                  style={{
                    background: hi,
                    color: onHi,
                    fontSize: "clamp(1.1rem, 1.7vw, 2.2rem)",
                    padding: "clamp(7px, 0.7vw, 14px) clamp(10px, 0.9vw, 18px)",
                  }}
                >
                  {player.pos}
                </span>
                {player.proTeam && (
                  <span
                    className="shrink-0 rounded-md bg-black/60 font-extrabold tracking-[0.16em] text-white"
                    style={{
                      fontSize: "clamp(0.85rem, 1.25vw, 1.6rem)",
                      padding: "clamp(7px, 0.7vw, 14px) clamp(10px, 0.9vw, 18px)",
                    }}
                  >
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
                  className="shrink-0 object-contain drop-shadow-[0_0.8rem_1.6rem_rgba(0,0,0,0.6)]"
                  style={{ height: "clamp(46px, 7vh, 92px)", width: "clamp(46px, 7vh, 92px)" }}
                />
              )}
            </div>

            <div aria-hidden className="absolute inset-x-0 bottom-0" style={{ height: "0.32rem", background: hi }} />
          </div>

          {/* The info bar sits on the bottom edge, level with the portrait, and
              the name centres in whatever is left above it. */}
          <div className="flex min-h-0 min-w-0 flex-col" style={{ gap: "clamp(10px, 1.7vh, 24px)" }}>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center" style={{ gap: "clamp(6px, 1vh, 14px)" }}>
              <div className="selection-reveal-stage flex min-w-0 items-center" style={{ gap: "clamp(8px, 0.8vw, 16px)" }}>
                {nflLogo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={nflLogo} alt="" aria-hidden className="shrink-0 object-contain" style={{ height: "clamp(22px, 2.6vh, 38px)" }} />
                )}
                <span className="min-w-0 truncate font-bold tracking-[0.28em] text-white/65" style={{ fontSize: "clamp(0.8rem, 1.15vw, 1.5rem)" }}>
                  {playerMeta || "Selected player"}
                </span>
              </div>

              <FitText
                text={player.name}
                maxVw={7.4}
                minVw={2.6}
                className="selection-reveal-name min-w-0 font-extrabold text-white"
                style={{
                  letterSpacing: "-0.035em",
                  lineHeight: 0.88,
                  textShadow: "0 0.06em 0.3em rgba(0,0,0,0.6)",
                }}
              />

              <div
                aria-hidden
                className="selection-reveal-rule"
                style={{ height: "0.34rem", width: "clamp(5rem, 10vw, 13rem)", background: hi }}
              />
            </div>

            {/* Who got him and where the pick came from, in one bar. Kept as a
                single block so its bottom edge lines up with the portrait's. */}
            <div
              className="selection-reveal-card flex min-w-0 shrink-0 items-stretch overflow-hidden rounded-[0.9rem] border border-white/12"
              style={{
                borderLeft: `0.4rem solid ${hi}`,
                background: `linear-gradient(90deg, ${withAlpha(background, 0.55)} 0%, ${withAlpha(secondary, 0.28)} 48%, rgba(255,255,255,0.05) 100%)`,
              }}
            >
              <div
                className="flex min-w-0 flex-1 items-center"
                style={{ gap: "clamp(12px, 1.2vw, 26px)", padding: "clamp(10px, 1vw, 20px)" }}
              >
                <div
                  className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-white/95"
                  style={{
                    height: "clamp(56px, 8.6vh, 104px)",
                    width: "clamp(56px, 8.6vh, 104px)",
                    boxShadow: `0 0 0 0.18rem ${withAlpha(secondary, 0.9)}`,
                  }}
                >
                  {pick.team.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pick.team.logo} alt={`${pick.team.name} logo`} className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-extrabold" style={{ color: background, fontSize: "clamp(1.2rem, 2.2vw, 3rem)" }}>
                      {pick.team.abbrev}
                    </span>
                  )}
                </div>

                {/* flex-1 so the name measures against a width the flex layout
                    fixes, rather than one its own font size decides. */}
                <div className="min-w-0 flex-1">
                  <div className="font-bold tracking-[0.26em] text-white/55" style={{ fontSize: "clamp(0.68rem, 0.95vw, 1.15rem)" }}>
                    Drafted to
                  </div>
                  <FitText
                    text={pick.team.name}
                    maxVw={3.1}
                    minVw={1.15}
                    className="min-w-0 font-extrabold leading-[1.05] text-white"
                    style={{ letterSpacing: "-0.015em" }}
                  />
                  <div className="min-w-0 truncate font-bold tracking-[0.2em] text-white/45" style={{ fontSize: "clamp(0.64rem, 0.88vw, 1.05rem)" }}>
                    {pick.team.manager}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-stretch">
                <MetaCell label="Round" value={pick.round} />
                <MetaCell label="Pick" value={pick.slot} />
                <MetaCell label="Overall" value={pick.overall} fill={hi} ink={onHi} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer keeps the operator's button out of the artwork, so nothing on
            the TV feed has to leave a hole in the layout for it. */}
        <footer
          className="flex shrink-0 items-center justify-between"
          style={{ gap: "clamp(12px, 1.5vw, 28px)", visibility: operator ? undefined : "hidden" }}
          aria-hidden={!operator}
        >
          <span className="min-w-0 truncate font-bold tracking-[0.34em] text-white/25" style={{ fontSize: "clamp(0.62rem, 0.85vw, 1.05rem)" }}>
            Space — next pick
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onNext();
            }}
            className="shrink-0 rounded-md font-extrabold uppercase tracking-[0.2em] shadow-[0_0_2rem_rgba(0,0,0,0.35)]"
            style={{
              background: hi,
              color: onHi,
              fontSize: "clamp(0.8rem, 1.05vw, 1.3rem)",
              padding: "clamp(9px, 1vh, 16px) clamp(16px, 1.6vw, 32px)",
            }}
          >
            Next Pick
          </button>
        </footer>
      </div>
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
        // Belt and braces, as on the franchise medallion: a full-size headshot
        // that falls into normal flow drags the layout down with it.
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
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
