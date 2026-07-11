"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { LiveChart } from "@/lib/games";

interface Team {
  name: string;
  color: string;
}

// Geometry (viewBox units; the SVG scales to its container width).
const W = 700;
const H = 260;
const PAD = { t: 16, r: 14, b: 26, l: 34 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

const fmtClock = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Sydney",
});
const fmtDay = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  hour: "numeric",
  timeZone: "Australia/Sydney",
});

/** Margin (home − away) over the course of a matchup, as a zero-baseline area:
 *  filled with the home colour while home leads, the away colour while away leads. */
export function LiveMarginChart({ chart, home, away }: { chart: LiveChart; home: Team; away: Team }) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const g = useMemo(() => {
    const startMs = Date.parse(chart.start);
    const pts = chart.points.map(([min, h, a]) => ({ min, h, a, m: Math.round((h - a) * 100) / 100 }));
    const n = pts.length;
    const maxAbs = Math.max(1, ...pts.map((p) => Math.abs(p.m))) * 1.1;

    // x is spaced by change-point index, not wall-clock: scoring activity gets
    // proportional width and the long dead-time gaps between game days collapse.
    const x = (i: number) => PAD.l + (n < 2 ? 0 : (i / (n - 1)) * PLOT_W);
    const y = (m: number) => PAD.t + PLOT_H / 2 - (m / maxAbs) * (PLOT_H / 2);
    const zeroY = y(0);

    const xy = pts.map((p, i) => ({ ...p, px: x(i), py: y(p.m), ms: startMs + p.min * 60000 }));
    const line = xy.map((p) => `${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(" ");
    const area =
      `${x(0).toFixed(1)},${zeroY.toFixed(1)} ` + line + ` ${x(n - 1).toFixed(1)},${zeroY.toFixed(1)}`;

    // ~5 ticks at evenly spaced points, labelled with that point's wall-clock.
    const ticks = Array.from({ length: 5 }, (_, k) => {
      const i = Math.round(((n - 1) * k) / 4);
      return { px: x(i), label: fmtDay.format(new Date(startMs + (pts[i]?.min ?? 0) * 60000)) };
    });

    // y gridlines at a few round margins above/below zero.
    const step = maxAbs > 60 ? 40 : maxAbs > 30 ? 20 : 10;
    const gridVals: number[] = [];
    for (let v = step; v < maxAbs; v += step) gridVals.push(v, -v);

    return { xy, line, area, zeroY, ticks, gridVals, y };
  }, [chart]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < g.xy.length; i++) {
      const d = Math.abs(g.xy[i].px - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover(best);
  };

  const hp = hover != null ? g.xy[hover] : null;
  const leader = hp ? (hp.m > 0 ? home : hp.m < 0 ? away : null) : null;

  return (
    <figure className="m-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Margin chart: ${home.name} vs ${away.name}`}
      >
        <defs>
          <clipPath id={`up-${uid}`}>
            <rect x="0" y="0" width={W} height={g.zeroY} />
          </clipPath>
          <clipPath id={`dn-${uid}`}>
            <rect x="0" y={g.zeroY} width={W} height={H - g.zeroY} />
          </clipPath>
        </defs>

        {/* y gridlines */}
        {g.gridVals.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={g.y(v)} y2={g.y(v)} stroke="var(--border)" strokeWidth={0.5} />
            <text x={PAD.l - 5} y={g.y(v) + 3} textAnchor="end" className="fill-text-muted" style={{ fontSize: 9 }}>
              {v > 0 ? `+${v}` : v}
            </text>
          </g>
        ))}

        {/* area, split at the zero baseline by colour */}
        <polygon points={g.area} fill={home.color} fillOpacity={0.7} clipPath={`url(#up-${uid})`} />
        <polygon points={g.area} fill={away.color} fillOpacity={0.7} clipPath={`url(#dn-${uid})`} />
        <polyline points={g.line} fill="none" stroke="#ffffff" strokeWidth={1.5} strokeLinejoin="round" />

        {/* zero baseline + axis labels (home up, away down) */}
        <line x1={PAD.l} x2={W - PAD.r} y1={g.zeroY} y2={g.zeroY} stroke="var(--text-muted)" strokeWidth={1} />
        <text x={W - PAD.r} y={PAD.t + 9} textAnchor="end" className="fill-text-muted" style={{ fontSize: 10, fontWeight: 700 }}>
          {home.name.toUpperCase()} ▲
        </text>
        <text x={W - PAD.r} y={H - PAD.b - 3} textAnchor="end" className="fill-text-muted" style={{ fontSize: 10, fontWeight: 700 }}>
          {away.name.toUpperCase()} ▼
        </text>

        {/* x ticks */}
        {g.ticks.map((t, i) => (
          <text
            key={i}
            x={t.px}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === g.ticks.length - 1 ? "end" : "middle"}
            className="fill-text-muted"
            style={{ fontSize: 9 }}
          >
            {t.label}
          </text>
        ))}

        {/* hover guide */}
        {hp && (
          <g>
            <line x1={hp.px} x2={hp.px} y1={PAD.t} y2={H - PAD.b} stroke="var(--text-muted)" strokeWidth={0.75} strokeDasharray="3 3" />
            <circle cx={hp.px} cy={hp.py} r={3.5} fill="#fff" stroke={leader ? leader.color : "var(--text-muted)"} strokeWidth={2} />
          </g>
        )}
      </svg>

      <figcaption className="flex items-center justify-between px-3 pb-2 pt-1 text-xs">
        {hp ? (
          <>
            <span className="text-text-muted">{fmtClock.format(new Date(hp.ms))}</span>
            <span className="font-cond font-semibold">
              {leader ? (
                <>
                  <span style={{ color: leader.color }}>{leader.name}</span> +{Math.abs(hp.m).toFixed(2)}
                </>
              ) : (
                "Tied"
              )}
              <span className="ml-2 text-text-muted">
                {hp.h.toFixed(2)} – {hp.a.toFixed(2)}
              </span>
            </span>
          </>
        ) : (
          <span className="text-text-muted">Hover the chart to scrub through the game</span>
        )}
      </figcaption>
    </figure>
  );
}
