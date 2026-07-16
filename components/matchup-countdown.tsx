"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "./ui";

export function MatchupCountdown({ kickoffIso, week }: { kickoffIso: string; week: number }) {
  const kickoffMs = useMemo(() => Date.parse(kickoffIso), [kickoffIso]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!Number.isFinite(kickoffMs)) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [kickoffMs]);

  if (!Number.isFinite(kickoffMs)) return null;

  const remaining = Math.max(0, kickoffMs - now);
  const started = remaining <= 0;
  const startLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(kickoffMs));

  return (
    <Card className="p-4 text-center">
      <div className="font-cond text-sm font-semibold uppercase tracking-wide text-text-muted">
        Week {week} Kickoff
      </div>
      <div className="mt-1 font-cond text-3xl font-bold tabular-nums text-text" suppressHydrationWarning>
        {started ? "Started" : formatRemaining(remaining)}
      </div>
      <div className="mt-1 text-xs text-text-muted" suppressHydrationWarning>
        {started ? `Started ${startLabel}` : `Starts ${startLabel}`}
      </div>
    </Card>
  );
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  return `${minutes}m ${pad(seconds)}s`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
