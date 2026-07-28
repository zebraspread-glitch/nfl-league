"use client";

import { useEffect, useMemo, useState } from "react";

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
