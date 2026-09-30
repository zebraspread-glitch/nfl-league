"use client";

import { useMemo, useRef, useState } from "react";
import type { Replay } from "@/lib/replays";
import type { LiveChart } from "@/lib/games";
import { LiveMarginChart } from "@/components/live-margin-chart";
import { SectionHeader } from "@/components/ui";

interface Team {
  name: string;
  abbrev: string;
  color: string;
}

// Geometry (viewBox units; the SVG scales to its container width). The right
// margin is wide because each line is labelled where it ends, rather than in a
// legend somewhere else.
const W = 700;
const H = 280;
const PAD = { t: 16, r: 188, b: 26, l: 10 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;
const PLOT_R = PAD.l + PLOT_W;
/** Vertical room one end-label needs, so the two never sit on top of each other. */
const LABEL_H = 46;

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

/**
 * The matchup replayed: one line per team, mirrored about 50%, each labelled
 * with where it finished. Scrubbing reads out the score and both chances at
 * that moment.
 */
export function MatchupReplay({ replay, away, home }: { replay: Replay; away: Team; home: Team }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const g = useMemo(() => {
    const startMs = Date.parse(replay.start);
    const pts = replay.points.map(([min, a, h, wp]) => ({ min, a, h, wp }));
    const n = pts.length;

    // x is spaced by change-point index, not wall-clock: the long dead stretches
    // between game windows collapse and the busy Sunday gets the room it needs.
    const x = (i: number) => PAD.l + (n < 2 ? 0 : (i / (n - 1)) * PLOT_W);
    const y = (wp: number) => PAD.t + PLOT_H - (wp / 100) * PLOT_H;

    const xy = pts.map((p, i) => ({ ...p, px: x(i), ms: startMs + p.min * 60000 }));
    const path = (of: (p: { wp: number }) => number) =>
      xy.map((p) => `${p.px.toFixed(1)},${y(of(p)).toFixed(1)}`).join(" ");

    const last = pts[n - 1];
    const ends = [
      { team: away, pct: last.wp, y: y(last.wp) },
      { team: home, pct: 100 - last.wp, y: y(100 - last.wp) },
    ].sort((p, q) => p.y - q.y);
    // Nudge the two labels apart when the teams finished close together, then
    // keep both inside the plot — a 0% or 100% finish sits hard against an edge
    // and its number would otherwise hang off the chart.
    const clamp = (v: number) => Math.min(Math.max(v, PAD.t + 16), PAD.t + PLOT_H - 7);
    const overlap = LABEL_H - (ends[1].y - ends[0].y);
    const labels = (overlap > 0
      ? [
          { ...ends[0], ly: ends[0].y - overlap / 2 },
          { ...ends[1], ly: ends[1].y + overlap / 2 },
        ]
      : ends.map((e) => ({ ...e, ly: e.y }))
    ).map((e) => ({ ...e, ly: clamp(e.ly) }));

    const ticks = Array.from({ length: 4 }, (_, k) => {
      const i = Math.round(((n - 1) * k) / 3);
      return { px: x(i), label: fmtDay.format(new Date(startMs + (pts[i]?.min ?? 0) * 60000)) };
    });

    // Moments are stored in replay time, so each is placed at the nearest point.
    const marks = replay.moments.map((mo) => {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const d = Math.abs(pts[i].min - mo.m);
        if (d < bestD) { bestD = d; best = i; }
      }
      const gained = mo.swing > 0 ? away : home;
      const wp = mo.swing > 0 ? pts[best].wp : 100 - pts[best].wp;
      return { px: x(best), py: y(wp), color: gained.color };
    });

    return {
      xy,
      awayLine: path((p) => p.wp),
      homeLine: path((p) => 100 - p.wp),
      labels,
      ticks,
      marks,
      y,
    };
  }, [replay, away, home]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < g.xy.length; i++) {
      const d = Math.abs(g.xy[i].px - px);
      if (d < bestD) { bestD = d; best = i; }
    }
    setHover(best);
  };

  const hp = hover != null ? g.xy[hover] : null;

  // The same replay as a margin chart, reusing the boxscore one. It reads
  // [minutes, home, away] where the replay stores away first.
  const marginChart = useMemo<LiveChart>(
    () => ({ start: replay.start, points: replay.points.map(([m, a, h]) => [m, h, a]) }),
    [replay],
  );

  return (
    <div>
      <SectionHeader>Live Margin</SectionHeader>
      <LiveMarginChart chart={marginChart} home={home} away={away} />

      <SectionHeader>Win Probability</SectionHeader>
      <figure className="m-0">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`Win probability replay: ${away.name} vs ${home.name}`}
        >
          {/* gridlines, with the scale down the right-hand side */}
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line
                x1={PAD.l}
                x2={PLOT_R}
                y1={g.y(v)}
                y2={g.y(v)}
                stroke="var(--border)"
                strokeWidth={v === 50 ? 1 : 0.75}
                strokeDasharray={v === 50 ? undefined : "2 4"}
              />
              <text
                x={W - 6}
                y={g.y(v) + 3.5}
                textAnchor="end"
                className="fill-text-muted"
                style={{ fontSize: 11 }}
              >
                {v}%
              </text>
            </g>
          ))}

          {/* one line per team, mirrored about the 50% line */}
          <polyline points={g.homeLine} fill="none" stroke={home.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={g.awayLine} fill="none" stroke={away.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* the plays listed under Big Moments */}
          {g.marks.map((m, i) => (
            <circle key={i} cx={m.px} cy={m.py} r={2.5} fill={m.color} stroke="var(--card)" strokeWidth={1} />
          ))}

          {/* where each line finished */}
          {g.labels.map((l) => (
            <g key={l.team.abbrev}>
              <circle cx={PLOT_R} cy={l.y} r={8} fill={l.team.color} fillOpacity={0.25} />
              <circle cx={PLOT_R} cy={l.y} r={4} fill={l.team.color} />
              <text x={PLOT_R + 16} y={l.ly - 6} style={{ fontSize: 13, fontWeight: 600 }} fill={l.team.color} fillOpacity={0.85}>
                {l.team.abbrev}
              </text>
              <text x={PLOT_R + 16} y={l.ly + 17} style={{ fontSize: 24, fontWeight: 700 }} fill={l.team.color}>
                {Math.round(l.pct)}%
              </text>
            </g>
          ))}

          {/* x ticks */}
          {g.ticks.map((t, i) => (
            <text
              key={i}
              x={t.px}
              y={H - 8}
              textAnchor={i === 0 ? "start" : "middle"}
              className="fill-text-muted"
              style={{ fontSize: 10 }}
            >
              {t.label}
            </text>
          ))}

          {/* hover guide */}
          {hp && (
            <g>
              <line
                x1={hp.px}
                x2={hp.px}
                y1={PAD.t}
                y2={PAD.t + PLOT_H}
                stroke="var(--text-muted)"
                strokeWidth={0.75}
                strokeDasharray="3 3"
              />
              <circle cx={hp.px} cy={g.y(hp.wp)} r={3.5} fill={away.color} stroke="var(--card)" strokeWidth={1.5} />
              <circle cx={hp.px} cy={g.y(100 - hp.wp)} r={3.5} fill={home.color} stroke="var(--card)" strokeWidth={1.5} />
            </g>
          )}
        </svg>

        <figcaption className="flex items-center justify-between px-3 pb-2 pt-1 text-xs">
          {hp ? (
            <>
              <span className="text-text-muted">{fmtClock.format(new Date(hp.ms))}</span>
              <span className="font-cond font-semibold">
                <span style={{ color: away.color }}>
                  {away.abbrev} {hp.wp.toFixed(1)}%
                </span>
                <span className="mx-1.5 text-text-muted">/</span>
                <span style={{ color: home.color }}>
                  {home.abbrev} {(100 - hp.wp).toFixed(1)}%
                </span>
                <span className="ml-2 text-text-muted">
                  {hp.a.toFixed(2)} – {hp.h.toFixed(2)}
                </span>
              </span>
            </>
          ) : (
            <span className="text-text-muted">Hover the chart to scrub through the week</span>
          )}
        </figcaption>
      </figure>

      {replay.moments.length > 0 && (
        <div>
          <SectionHeader>Big Moments</SectionHeader>
          <ol className="divide-y divide-border">
            {replay.moments.map((m, i) => {
              const gained = m.swing > 0 ? away : home;
              return (
                <li key={i} className="flex items-start gap-3 px-3 py-2">
                  <span
                    className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-cond text-xs font-bold tabular-nums text-white"
                    style={{ backgroundColor: gained.color }}
                  >
                    {m.swing > 0 ? "+" : "−"}
                    {Math.abs(m.swing).toFixed(1)}%
                  </span>
                  <span className="text-sm leading-snug">{m.text}</span>
                </li>
              );
            })}
          </ol>
          <p className="px-3 pb-1 pt-2 text-xs text-text-muted">
            Swing is the change in {away.abbrev}&rsquo;s win chance on that play. Rebuilt from NFL
            play-by-play; win chance weighs each side&rsquo;s score against what its still-playing
            starters were projected to add.
          </p>
        </div>
      )}
    </div>
  );
}
