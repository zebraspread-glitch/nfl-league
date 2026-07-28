"use client";

import { useId, useRef, useState } from "react";
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
  awayPrimary,
  awaySecondary,
  homePrimary,
  homeSecondary,
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
  awayPrimary: string;
  awaySecondary: string;
  homePrimary: string;
  homeSecondary: string;
  status: "model" | "user";
  onTip: (homeWins: boolean, margin: number) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const bgId = `tip-bg-${useId().replace(/:/g, "")}`;
  const curveId = `tip-curve-${useId().replace(/:/g, "")}`;
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
  const winnerColor = active?.homeWins ? homePrimary : awayPrimary;
  const winnerAccent = active?.homeWins ? homeSecondary : awaySecondary;
  const markerTone = status === "user" ? "stroke-white fill-white" : "stroke-text-muted fill-text-muted";

  return (
    <div
      className="select-none overflow-hidden rounded-xl border border-border bg-card shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]"
      style={{
        background: `linear-gradient(90deg, ${awayPrimary}14 0%, var(--card) 38%, var(--card) 62%, ${homePrimary}14 100%)`,
      }}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pt-2">
        <TeamColourTag label={awayLabel} name={awayName} primary={awayPrimary} secondary={awaySecondary} />
        <div
          className="min-w-[8rem] rounded-full px-3 py-1 text-center font-cond text-sm font-semibold tabular-nums text-white shadow-sm"
          style={{
            background: active
              ? `linear-gradient(135deg, ${winnerColor}, ${winnerAccent})`
              : "linear-gradient(135deg, var(--text-dim), var(--text-muted))",
          }}
        >
          {active ? `${winnerLabel} by ${active.margin} pts` : "Tap to tip"}
        </div>
        <TeamColourTag label={homeLabel} name={homeName} primary={homePrimary} secondary={homeSecondary} align="right" />
      </div>

      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 w-full cursor-pointer touch-none"
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
        <defs>
          <linearGradient id={bgId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={awayPrimary} />
            <stop offset="48%" stopColor={awaySecondary} />
            <stop offset="52%" stopColor={homeSecondary} />
            <stop offset="100%" stopColor={homePrimary} />
          </linearGradient>
          <linearGradient id={curveId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={awaySecondary} />
            <stop offset="50%" stopColor="var(--teal)" />
            <stop offset="100%" stopColor={homeSecondary} />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={W} height={H} rx="10" fill={`url(#${bgId})`} opacity="0.12" />
        <rect x="0" y="0" width={W} height={H} rx="10" className="fill-section" opacity="0.72" />
        <path d={curvePath(mean, sd)} fill={`url(#${curveId})`} opacity="0.36" />
        <rect x="0" y={H - 16} width={MID} height="16" fill={awayPrimary} opacity="0.2" />
        <rect x={MID} y={H - 16} width={MID} height="16" fill={homePrimary} opacity="0.2" />
        <line x1={MID} y1="0" x2={MID} y2={H} className="stroke-border-strong" strokeWidth="2" />

        {ticks().map((t) => (
          <g key={t.value}>
            <line x1={t.x} y1={H - 15} x2={t.x} y2={H} className="stroke-border-strong" strokeWidth="1" opacity="0.55" />
            <text x={t.x} y={H - 20} textAnchor="middle" className="fill-text-muted text-[13px] font-semibold">
              {Math.abs(t.value)}
            </text>
          </g>
        ))}

        {markerX !== null ? (
          <g>
            <line x1={markerX} y1="0" x2={markerX} y2={H} stroke={winnerColor} strokeWidth="4" opacity="0.45" />
            <line x1={markerX} y1="0" x2={markerX} y2={H} className={markerTone} strokeWidth="1.5" />
            <path d={`M ${markerX - 8} 0 L ${markerX + 8} 0 L ${markerX} 12 Z`} className={markerTone} />
          </g>
        ) : (
          <text x={MID} y={H / 2} textAnchor="middle" className="fill-text-muted text-[22px] font-semibold">
            Tap to tip
          </text>
        )}

      </svg>
    </div>
  );
}

function TeamColourTag({
  label,
  name,
  primary,
  secondary,
  align = "left",
}: {
  label: string;
  name: string;
  primary: string;
  secondary: string;
  align?: "left" | "right";
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === "right" ? "justify-end" : ""}`}>
      <span
        className="h-2.5 w-8 shrink-0 rounded-full"
        style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})` }}
      />
      <span className="truncate font-cond text-xs font-semibold uppercase tracking-wide text-text-muted" title={name}>
        {label}
      </span>
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
