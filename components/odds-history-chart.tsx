"use client";

import { useMemo, useRef, useState } from "react";
import type { TeamMeta } from "@/lib/types";

/** The shape lib/odds-history.ts hands over, flattened for the client. */
export interface ChartSeries {
  team: TeamMeta;
  /** Chance of landing the market at each snapshot, 0-1. */
  values: number[];
}

export interface ChartScale {
  /** Short x-axis labels, one per snapshot. */
  ticks: string[];
  /** What the footer reads out when a snapshot is scrubbed to. */
  labels: string[];
}

export type Granularity = "week" | "day";

/** Floors the team list can be cut at. A twelve-line chart is a lot to read at
 *  once, and most of those lines are franchises the market has already settled. */
const FLOORS = [
  { value: 0, label: "All" },
  { value: 0.01, label: "1%+" },
  { value: 0.1, label: "10%+" },
];

/** How far back the day view looks. Fifty-odd days of season squeeze a lot of
 *  movement into one chart, and most of the time what matters is the last week
 *  or two. Weeks are never windowed — there are only ever a handful of them. */
const RANGES = [
  { value: 0, label: "All time" },
  { value: 30, label: "30 days" },
  { value: 7, label: "7 days" },
];

// Geometry (viewBox units; the SVG scales to its container). The right margin
// carries the end labels, the way the matchup replay labels its two lines —
// with twelve lines only the leaders get named, and the rest are read off the
// table underneath.
const W = 700;
const H = 300;
const PAD = { t: 14, r: 104, b: 26, l: 10 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;
const PLOT_R = PAD.l + PLOT_W;
/** Vertical room one end label needs, so stacked leaders stay legible. */
const LABEL_H = 15;
/** How many lines get named at the right-hand edge. */
const NAMED = 4;

const pct = (p: number) => `${(p * 100).toFixed(1)}%`;

/** A small pill switch — the chart carries two of them, so they share one. */
function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex rounded-full bg-section p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={`rounded-full px-2.5 py-1 font-cond text-xs font-semibold transition-colors ${
            o.value === value ? "bg-card text-text shadow-sm" : "text-text-muted hover:text-text"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * One market's whole season: a line per franchise from the opening board to
 * now. Hovering a week reads every price at that moment; tapping a franchise
 * pulls its line to the front and leaves the rest as context.
 */
export function OddsHistoryChart({
  series,
  scale,
  caption,
}: {
  series: Record<Granularity, ChartSeries[]>;
  scale: Record<Granularity, ChartScale>;
  caption: string;
}) {
  const [grain, setGrain] = useState<Granularity>("week");
  const [floor, setFloor] = useState(0);
  const [range, setRange] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const full = series[grain];

  // The day view can be wound back to the last 30 or 7 snapshots — one per day,
  // so the window is just the tail. The week view is always shown whole, and
  // dropping the pre-season point with it is the right call: a seven-day window
  // that still started at the opening board would not be a seven-day window.
  const from =
    grain === "day" && range > 0 ? Math.max(0, (full[0]?.values.length ?? 0) - range) : 0;

  const all = useMemo(
    () => (from === 0 ? full : full.map((s) => ({ ...s, values: s.values.slice(from) }))),
    [full, from],
  );
  const axis = useMemo(() => {
    const a = scale[grain];
    return from === 0 ? a : { ticks: a.ticks.slice(from), labels: a.labels.slice(from) };
  }, [scale, grain, from]);

  // Cutting the field is done on where each franchise stands now, not on the
  // point being hovered — lines appearing and vanishing under the cursor would
  // make the chart impossible to read.
  const shown = useMemo(
    () => all.filter((s) => s.values[s.values.length - 1] >= floor),
    [all, floor],
  );
  const hidden = all.length - shown.length;

  const g = useMemo(() => {
    const last = Math.max(0, (shown[0]?.values.length ?? 1) - 1);

    // A twelve-horse title market tops out around a third, so a fixed 0-100%
    // axis would squash every line into the bottom of the plot. The scale is
    // cut to the market instead: the next round ceiling above the best price
    // anyone has held all season.
    const peak = Math.max(0.05, ...shown.flatMap((s) => s.values));
    const top = [0.1, 0.2, 0.25, 0.4, 0.5, 0.6, 0.75, 1].find((t) => t >= peak - 1e-9) ?? 1;
    const gridlines = [0, 0.25, 0.5, 0.75, 1].map((f) => top * f);

    const x = (i: number) => PAD.l + (last === 0 ? 0 : (i / last) * PLOT_W);
    const y = (p: number) => PAD.t + PLOT_H - (p / top) * PLOT_H;

    const lines = shown.map((s) => ({
      team: s.team,
      values: s.values,
      path: s.values.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" "),
      end: s.values[last],
    }));

    // Only the shortest few prices get a name on the chart. They are nudged
    // apart so two franchises within a point of each other stay readable.
    const named = [...lines]
      .sort((a, b) => b.end - a.end)
      .slice(0, NAMED)
      .map((l) => ({ ...l, ly: y(l.end) }))
      .sort((a, b) => a.ly - b.ly);
    for (let i = 1; i < named.length; i++) {
      const overlap = LABEL_H - (named[i].ly - named[i - 1].ly);
      if (overlap > 0) named[i].ly += overlap;
    }
    const bottom = PAD.t + PLOT_H;
    for (let i = named.length - 1; i > 0; i--) {
      if (named[i].ly > bottom) named[i].ly = bottom;
      const overlap = LABEL_H - (named[i].ly - named[i - 1].ly);
      if (overlap > 0) named[i - 1].ly -= overlap;
    }

    // Seven weeks can all be labelled; fifty days cannot, so the day view takes
    // an even sample and always keeps both ends.
    const every = Math.max(1, Math.ceil(axis.ticks.length / 8));
    const ticks = axis.ticks
      .map((label, i) => ({ px: x(i), label, i }))
      .filter((t) => t.i === 0 || t.i === last || (every === 1 ? true : t.i % every === 0 && last - t.i > every / 2));

    return { lines, named, ticks, gridlines, x, y, last };
  }, [shown, axis]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i <= g.last; i++) {
      const d = Math.abs(g.x(i) - px);
      if (d < bestD) { bestD = d; best = i; }
    }
    setHover(best);
  };

  // Switching granularity leaves a stale hover index behind — the day view has
  // far more points than the week view — so it is clamped rather than reset,
  // which keeps the cursor roughly where it was.
  const at = Math.min(hover ?? g.last, g.last);

  // The table under the chart: ranked on whatever week is being read, with the
  // move since the opening board alongside.
  const rows = useMemo(
    () =>
      g.lines
        .map((l) => ({
          team: l.team,
          value: l.values[at],
          change: l.values[at] - l.values[0],
        }))
        .sort((a, b) => b.value - a.value),
    [g.lines, at],
  );

  return (
    <figure className="m-0">
      <div className="flex flex-wrap items-center gap-2 px-3 pb-2 pt-1">
        <Segmented
          options={[
            { value: "week", label: "Week" },
            { value: "day", label: "Day" },
          ]}
          value={grain}
          onChange={(v) => setGrain(v as Granularity)}
        />
        <Segmented
          options={FLOORS.map((f) => ({ value: String(f.value), label: f.label }))}
          value={String(floor)}
          onChange={(v) => setFloor(Number(v))}
        />
        {grain === "day" && (
          <Segmented
            options={RANGES.map((r) => ({ value: String(r.value), label: r.label }))}
            value={String(range)}
            onChange={(v) => setRange(Number(v))}
          />
        )}
        {hidden > 0 && (
          <span className="font-cond text-[11px] text-text-dim">
            {hidden} hidden
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={caption}
      >
        {/* gridlines, scale down the right-hand side */}
        {g.gridlines.map((v) => (
          <g key={v}>
            <line
              x1={PAD.l}
              x2={PLOT_R}
              y1={g.y(v)}
              y2={g.y(v)}
              stroke="var(--border)"
              strokeWidth={0.75}
              strokeDasharray={v === 0 ? undefined : "2 4"}
            />
            <text
              x={W - 6}
              y={g.y(v) + 3.5}
              textAnchor="end"
              className="fill-text-muted"
              style={{ fontSize: 11 }}
            >
              {Math.round(v * 100)}%
            </text>
          </g>
        ))}

        {/* one line per franchise; a picked team is drawn last and heavier */}
        {g.lines.map((l) => {
          const dim = picked !== null && picked !== l.team.id;
          return (
            <polyline
              key={l.team.id}
              points={l.path}
              fill="none"
              stroke={l.team.primary}
              strokeWidth={picked === l.team.id ? 3 : 2}
              strokeOpacity={dim ? 0.18 : 1}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}
        {picked !== null &&
          g.lines
            .filter((l) => l.team.id === picked)
            .map((l) => (
              <polyline
                key={`top-${l.team.id}`}
                points={l.path}
                fill="none"
                stroke={l.team.primary}
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}

        {/* where the shortest prices finished */}
        {g.named.map((l) => (
          <g key={l.team.id} opacity={picked !== null && picked !== l.team.id ? 0.3 : 1}>
            <circle cx={PLOT_R} cy={g.y(l.end)} r={3.5} fill={l.team.primary} />
            <text
              x={PLOT_R + 8}
              y={l.ly + 4}
              style={{ fontSize: 12, fontWeight: 700 }}
              fill={l.team.primary}
            >
              {l.team.abbrev} {pct(l.end)}
            </text>
          </g>
        ))}

        {/* x ticks */}
        {g.ticks.map((t, i) => (
          <text
            key={i}
            x={t.px}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === g.last ? "end" : "middle"}
            className="fill-text-muted"
            style={{ fontSize: 10 }}
          >
            {t.label}
          </text>
        ))}

        {/* hover guide */}
        {hover !== null && (
          <g>
            <line
              x1={g.x(hover)}
              x2={g.x(hover)}
              y1={PAD.t}
              y2={PAD.t + PLOT_H}
              stroke="var(--text-muted)"
              strokeWidth={0.75}
              strokeDasharray="3 3"
            />
            {g.lines.map((l) => (
              <circle
                key={l.team.id}
                cx={g.x(hover)}
                cy={g.y(l.values[hover])}
                r={2.5}
                fill={l.team.primary}
                fillOpacity={picked !== null && picked !== l.team.id ? 0.25 : 1}
              />
            ))}
          </g>
        )}
      </svg>

      <figcaption className="flex items-center justify-between px-3 pb-2 pt-1 text-xs">
        <span className="text-text-muted">
          {hover === null ? "Hover the chart to scrub through the season" : axis.labels[at]}
        </span>
        {picked !== null && (
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="font-cond font-semibold text-teal"
          >
            Show all
          </button>
        )}
      </figcaption>

      <div className="border-t border-border">
        {rows.map((r, i) => (
          <button
            key={r.team.id}
            type="button"
            onClick={() => setPicked(picked === r.team.id ? null : r.team.id)}
            className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
              i % 2 === 1 ? "bg-section" : ""
            } ${picked === r.team.id ? "ring-1 ring-inset ring-teal" : ""}`}
          >
            <span className="w-4 text-center font-cond text-xs text-text-muted tabular-nums">
              {i + 1}
            </span>
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: r.team.primary }}
            />
            <span className="flex-1 truncate text-sm">{r.team.name}</span>
            <span className="w-14 text-right font-cond text-sm font-bold tabular-nums">
              {pct(r.value)}
            </span>
            <span
              className={`w-14 text-right font-cond text-xs font-semibold tabular-nums ${
                r.change > 0.0005
                  ? "text-up"
                  : r.change < -0.0005
                    ? "text-down"
                    : "text-text-muted"
              }`}
            >
              {Math.abs(r.change) < 0.0005
                ? "—"
                : `${r.change > 0 ? "+" : "−"}${(Math.abs(r.change) * 100).toFixed(1)}`}
            </span>
          </button>
        ))}
      </div>
    </figure>
  );
}
