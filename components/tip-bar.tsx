"use client";

import { useRef, useState } from "react";
import { clampMargin, MAX_MARGIN } from "@/lib/predictor";

const W = 600;
const H = 96;
const MID = W / 2;
const PX_PER_POINT = MID / MAX_MARGIN;

/** Squiggle-style tipping bar: tap a side to pick the winner, and the further
 *  from the middle you tap, the bigger the margin. The shaded curve behind it
 *  is the model's own distribution for this game — its peak is the line. */
export function TipBar({
  mean,
  sd,
  margin,
  homeWins,
  awayName,
  homeName,
  awayLabel,
  homeLabel,
  status,
  onTip,
}: {
  mean: number;
  sd: number;
  margin?: number;
  homeWins?: boolean;
  awayName: string;
  homeName: string;
  awayLabel: string;
  homeLabel: string;
  status: "model" | "user";
  onTip: (homeWins: boolean, margin: number) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ homeWins: boolean; margin: number } | null>(null);

  const pickFromClientX = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return null;
    const x = ((clientX - box.left) / box.width) * W;
    const points = (x - MID) / PX_PER_POINT;
    return { homeWins: points >= 0, margin: clampMargin(Math.round(Math.abs(points))) };
  };

  const active = drag ?? (margin !== undefined && homeWins !== undefined ? { homeWins, margin } : null);
  const markerX = active ? MID + (active.homeWins ? 1 : -1) * active.margin * PX_PER_POINT : null;
  const winnerLabel = active ? (active.homeWins ? homeLabel : awayLabel) : "";
  const resultTone = status === "user" ? "fill-text" : "fill-text-muted";
  const markerTone = status === "user" ? "stroke-teal fill-teal" : "stroke-text-dim fill-text-dim";

  return (
    <div className="select-none">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-pointer touch-none"
        role="slider"
        tabIndex={0}
        aria-label={`Tip ${awayName} versus ${homeName}`}
        aria-valuemin={MAX_MARGIN * -1}
        aria-valuemax={MAX_MARGIN}
        aria-valuenow={active ? (active.homeWins ? active.margin : -active.margin) : 0}
        onPointerDown={(e) => {
          const next = pickFromClientX(e.clientX);
          if (!next) return;
          ref.current?.setPointerCapture(e.pointerId);
          setDrag(next);
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          const next = pickFromClientX(e.clientX);
          if (next) setDrag(next);
        }}
        onPointerUp={(e) => {
          const next = pickFromClientX(e.clientX) ?? drag;
          setDrag(null);
          if (next) onTip(next.homeWins, next.margin);
        }}
        onPointerCancel={() => setDrag(null)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          const current = active ? (active.homeWins ? active.margin : -active.margin) : 0;
          const moved = current + (e.key === "ArrowRight" ? 1 : -1);
          onTip(moved >= 0, clampMargin(Math.abs(moved) || 1));
        }}
      >
        <rect x="0" y="0" width={W} height={H} rx="8" className="fill-section" />
        <path d={curvePath(mean, sd)} className="fill-teal/20" />
        <line x1={MID} y1="0" x2={MID} y2={H} className="stroke-border-strong" strokeWidth="1" />

        {ticks().map((t) => (
          <g key={t.value}>
            <line x1={t.x} y1={H - 12} x2={t.x} y2={H} className="stroke-border-strong" strokeWidth="1" />
            <text x={t.x} y={H - 16} textAnchor="middle" className="fill-text-dim text-[13px] font-semibold">
              {Math.abs(t.value)}
            </text>
          </g>
        ))}

        {markerX !== null ? (
          <g>
            <line x1={markerX} y1="0" x2={markerX} y2={H} className={markerTone} strokeWidth="2" />
            <path d={`M ${markerX - 8} 0 L ${markerX + 8} 0 L ${markerX} 12 Z`} className={markerTone} />
          </g>
        ) : (
          <text x={MID} y={H / 2} textAnchor="middle" className="fill-text-muted text-[22px] font-semibold">
            Tap to tip
          </text>
        )}

        {active ? (
          <text x={MID} y="34" textAnchor="middle" className={`${resultTone} text-[22px] font-semibold`}>
            <tspan>{winnerLabel}</tspan>
            <tspan className="fill-text-muted"> by </tspan>
            <tspan>{active.margin}</tspan>
            <tspan className="fill-text-muted"> pts</tspan>
          </text>
        ) : null}
      </svg>
    </div>
  );
}

function curvePath(mean: number, sd: number): string {
  const points: string[] = [];
  for (let x = 0; x <= W; x += 6) {
    const m = (x - MID) / PX_PER_POINT;
    const density = Math.exp(-((m - mean) ** 2) / (2 * sd * sd));
    points.push(`${x} ${H - 14 - density * (H - 30)}`);
  }
  return `M 0 ${H - 14} L ${points.join(" L ")} L ${W} ${H - 14} Z`;
}

function ticks() {
  const out: { value: number; x: number }[] = [];
  for (let v = -MAX_MARGIN; v <= MAX_MARGIN; v += 10) {
    out.push({ value: v, x: MID + v * PX_PER_POINT });
  }
  return out;
}
