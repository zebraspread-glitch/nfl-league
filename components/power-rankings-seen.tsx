"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SEEN_EVENT = "mgl-power-rankings-seen";

type RankingEntry = {
  rank: number;
  team: { id: number };
};

type RankingSnapshot = {
  version: string;
  ranks: Record<string, number>;
};

type MovementSnapshot = {
  version: string;
  previousRanks: Record<string, number>;
};

function storageKey(kind: string, suffix: string): string {
  return `mgl_power_rankings_${kind}_${suffix}`;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private modes; the page still works.
  }
}

function snapshotFor(version: string, entries: RankingEntry[]): RankingSnapshot {
  return {
    version,
    ranks: Object.fromEntries(entries.map((entry) => [String(entry.team.id), entry.rank])),
  };
}

function dispatchSeenEvent(): void {
  window.dispatchEvent(new Event(SEEN_EVENT));
}

export function usePowerRankingsUnread(version: string, kind = "tp"): boolean {
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    const key = storageKey(kind, "snapshot");
    const update = () => {
      const seen = readJson<RankingSnapshot>(key);
      setUnread(seen?.version !== version);
    };

    update();
    window.addEventListener("storage", update);
    window.addEventListener(SEEN_EVENT, update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener(SEEN_EVENT, update);
    };
  }, [kind, version]);

  return unread;
}

export function PowerRankingsUnreadDot({
  version,
  kind = "tp",
  className = "",
}: {
  version: string;
  kind?: string;
  className?: string;
}) {
  const unread = usePowerRankingsUnread(version, kind);
  if (!unread) return null;

  return (
    <span
      aria-label="New power rankings"
      title="New power rankings"
      className={`block h-2.5 w-2.5 rounded-full bg-live shadow-[0_0_0_2px_var(--card)] ${className}`}
    />
  );
}

export function usePowerRankingPreviousRanks(kind: string, version: string, entries: RankingEntry[]) {
  const [previousRanks, setPreviousRanks] = useState<Record<string, number>>({});
  const entryKey = useMemo(() => entries.map((entry) => `${entry.team.id}:${entry.rank}`).join("|"), [entries]);

  useEffect(() => {
    const snapshotKey = storageKey(kind, "snapshot");
    const movementKey = storageKey(kind, "movement");
    const movement = readJson<MovementSnapshot>(movementKey);
    let cancelled = false;
    let updateTimer: number | undefined;
    const applyPreviousRanks = (nextPreviousRanks: Record<string, number>) => {
      updateTimer = window.setTimeout(() => {
        if (!cancelled) setPreviousRanks(nextPreviousRanks);
      }, 0);
    };

    if (movement?.version === version) {
      applyPreviousRanks(movement.previousRanks);
      writeJson(snapshotKey, snapshotFor(version, entries));
      dispatchSeenEvent();
      return () => {
        cancelled = true;
        if (updateTimer !== undefined) window.clearTimeout(updateTimer);
      };
    }

    const seen = readJson<RankingSnapshot>(snapshotKey);
    const previous: Record<string, number> = {};

    if (seen && seen.version !== version) {
      for (const entry of entries) {
        const previousRank = seen.ranks[String(entry.team.id)];
        if (previousRank && previousRank !== entry.rank) {
          previous[String(entry.team.id)] = previousRank;
        }
      }
    }

    applyPreviousRanks(previous);
    writeJson(movementKey, { version, previousRanks: previous });
    writeJson(snapshotKey, snapshotFor(version, entries));
    dispatchSeenEvent();

    return () => {
      cancelled = true;
      if (updateTimer !== undefined) window.clearTimeout(updateTimer);
    };
  }, [entryKey, entries, kind, version]);

  return previousRanks;
}

// One-time "rankings updated" popup, shown on any page except the rankings page
// itself. It's keyed to the rankings version, so each new update shows it once:
// dismissing it, tapping through, or simply visiting /power-rankings (which
// writes the snapshot above) all count as having seen it.
export function PowerRankingsUpdatePopup({
  version,
  updated,
  top,
}: {
  version: string;
  updated: string;
  top: { rank: number; name: string }[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const popupKey = storageKey("tp", "popup");

  useEffect(() => {
    if (pathname === "/power-rankings") return;
    const dismissed = readJson<string>(popupKey);
    const viewed = readJson<RankingSnapshot>(storageKey("tp", "snapshot"));
    if (dismissed === version || viewed?.version === version) return;
    const timer = window.setTimeout(() => setOpen(true), 400);
    return () => window.clearTimeout(timer);
  }, [pathname, popupKey, version]);

  if (!open) return null;

  const close = () => {
    writeJson(popupKey, version);
    setOpen(false);
  };
  const updatedLabel = new Date(updated + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "long" });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pr-popup-title"
      onClick={close}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="bg-teal px-5 py-4 text-white">
          <div className="font-cond text-xs font-semibold uppercase tracking-widest text-white/80">Updated {updatedLabel}</div>
          <h2 id="pr-popup-title" className="font-cond text-2xl font-bold leading-tight">
            New power rankings are out
          </h2>
        </div>
        <ol className="px-5 py-3">
          {top.map((t) => (
            <li key={t.rank} className="flex items-baseline gap-3 py-1">
              <span className="w-5 font-cond text-lg font-bold text-text-muted">{t.rank}</span>
              <span className="font-cond text-lg font-semibold text-text">{t.name}</span>
            </li>
          ))}
          <li className="pl-8 pt-1 text-sm text-text-muted">See where everyone else landed…</li>
        </ol>
        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={close}
            className="flex-1 rounded-full bg-section py-2.5 font-cond text-sm font-semibold uppercase tracking-wide text-text-muted"
          >
            Later
          </button>
          <Link
            href="/power-rankings"
            onClick={close}
            className="flex-1 rounded-full bg-teal py-2.5 text-center font-cond text-sm font-semibold uppercase tracking-wide text-white"
          >
            View rankings
          </Link>
        </div>
      </div>
    </div>
  );
}
