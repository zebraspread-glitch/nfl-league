"use client";

import { useMemo, useRef, useState } from "react";
import type { TeamMeta } from "@/lib/types";

/** The shape lib/odds-history.ts hands over, flattened for the client. */
export interface ChartSeries {
  team: TeamMeta;
  /** [week, chance 0-1] — week 0 is the pre-season board. */
  points: [number, number][];
}

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

/**
 * One market's whole season: a line per franchise from the opening board to
 * now. Hovering a week reads every price at that moment; tapping a franchise
 * pulls its line to the front and leaves the rest as context.
 */
export function OddsHistoryChart({
  series,
  caption,
}: {
  series: ChartSeries[];
  caption: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const g = useMemo(() => {
    const weeks = series[0]?.points.map(([w]) => w) ?? [0];
    const last = weeks.length - 1;

    // A twelve-horse title market tops out around a third, so a fixed 0-100%
    // axis would squash every line into the bottom of the plot. The scale is
    // cut to the market instead: the next round ceiling above the best price
    // anyone has held all season.
    const peak = Math.max(0.05, ...series.flatMap((s) => s.points.map(([, p]) => p)));
    const top = [0.1, 0.2, 0.25, 0.4, 0.5, 0.6, 0.75, 1].find((t) => t >= peak - 1e-9) ?? 1;
    const gridlines = [0, 0.25, 0.5, 0.75, 1].map((f) => top * f);

    const x = (i: number) => PAD.l + (last === 0 ? 0 : (i / last) * PLOT_W);
    const y = (p: number) => PAD.t + PLOT_H - (p / top) * PLOT_H;

    const lines = series.map((s) => ({
      team: s.team,
      values: s.points.map(([, p]) => p),
      path: s.points.map(([, p], i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" "),
      end: s.points[last][1],
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
    const floor = PAD.t + PLOT_H;
    for (let i = named.length - 1; i > 0; i--) {
      if (named[i].ly > floor) named[i].ly = floor;
      const overlap = LABEL_H - (named[i].ly - named[i - 1].ly);
      if (overlap > 0) named[i - 1].ly -= overlap;
    }

    const ticks = weeks.map((w, i) => ({ px: x(i), label: w === 0 ? "Pre" : `W${w}` }));

    return { lines, named, ticks, weeks, gridlines, x, y, last };
  }, [series]);

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

  const at = hover ?? g.last;

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
          {hover === null
            ? "Hover the chart to scrub through the season"
            : g.weeks[hover] === 0
              ? "Opening board, before Week 1"
              : `After Week ${g.weeks[hover]}`}
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
