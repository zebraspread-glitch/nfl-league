"use client";

import { useSettings, type OddsTheme } from "./settings-provider";
import {
  formatDecimal,
  formatSpread,
  getMatchupOdds,
  STANDARD_LINE_PRICE,
  type SideOdds,
} from "@/lib/odds";
import type { Matchup, MatchupSide } from "@/lib/types";

/** One row of the strip, already formatted — the three skins below differ only
 *  in how they paint this, never in what it says. */
interface Row {
  abbrev: string;
  h2h: string;
  spread: string;
  totalLine: string;
  linePrice: string;
}

/** Novelty betting lines for an upcoming matchup, hidden unless the reader has
 *  switched them on in Settings. Nothing here is a real market — see lib/odds.ts. */
export function MatchupOddsStrip({ matchup }: { matchup: Matchup }) {
  const { ready, showOdds, oddsTheme } = useSettings();

  // `ready` is false on the server and on the first client render, so the
  // markup matches until the stored preference has been read.
  if (!ready || !showOdds || matchup.status !== "upcoming") return null;

  const odds = getMatchupOdds(matchup);
  const linePrice = formatDecimal(STANDARD_LINE_PRICE);
  const total = odds.total.toFixed(1);
  const rows: Row[] = [
    row(matchup.away, odds.away, `O ${total}`, linePrice),
    row(matchup.home, odds.home, `U ${total}`, linePrice),
  ];

  return <Skin theme={oddsTheme} rows={rows} />;
}

function row(side: MatchupSide, odds: SideOdds, totalLine: string, linePrice: string): Row {
  return {
    abbrev: side.team.abbrev,
    h2h: formatDecimal(odds.decimal),
    spread: formatSpread(odds.spread),
    totalLine,
    linePrice,
  };
}

function Skin({ theme, rows }: { theme: OddsTheme; rows: Row[] }) {
  if (theme === "sportsbet") return <SportsbetSkin rows={rows} />;
  if (theme === "pointsbet") return <PointsbetSkin rows={rows} />;
  return <DefaultSkin rows={rows} />;
}

/* -------------------------------------------------------------------------- */
/* Default — the app's own look: themed tokens, no price on the line or total. */
/* -------------------------------------------------------------------------- */

function DefaultSkin({ rows }: { rows: Row[] }) {
  return (
    <div className="border-t border-border bg-section px-4 py-2.5">
      <div className="mb-1.5 font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        MGL Book
      </div>

      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-1.5 gap-y-1 text-xs">
        <span />
        <DefaultLabel>Spread</DefaultLabel>
        <DefaultLabel>Total</DefaultLabel>
        <DefaultLabel>H2H</DefaultLabel>

        {rows.map((r) => (
          <DefaultRow key={r.abbrev} row={r} />
        ))}
      </div>
    </div>
  );
}

function DefaultLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-[4.25rem] text-right font-cond text-[10px] font-semibold uppercase tracking-wide text-text-dim">
      {children}
    </span>
  );
}

function DefaultRow({ row }: { row: Row }) {
  const cell = "w-[4.25rem] rounded bg-card px-1.5 py-1 text-center font-cond text-sm font-semibold tabular-nums";
  return (
    <>
      <span className="truncate font-cond text-sm font-semibold">{row.abbrev}</span>
      <span className={cell}>{row.spread}</span>
      <span className={cell}>{row.totalLine}</span>
      <span className={cell}>{row.h2h}</span>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Sportsbet — light card, navy ink, the line printed above a pale price box.  */
/* Fixed palette on purpose: a book skin shouldn't follow the app's theme.     */
/* -------------------------------------------------------------------------- */

const SB = {
  bg: "#ffffff",
  ink: "#0b4870",
  muted: "#5b87a8",
  box: "#e9eff6",
  boxBorder: "#d3e0eb",
  divider: "#e4ebf2",
};

function SportsbetSkin({ rows }: { rows: Row[] }) {
  return (
    <div style={{ background: SB.bg, borderTop: `1px solid ${SB.divider}` }} className="px-4 py-3">
      <div
        className="grid grid-cols-[1fr_repeat(3,4.25rem)] items-center gap-x-2 pb-2"
        style={{ borderBottom: `1px solid ${SB.divider}` }}
      >
        <span className="text-sm font-semibold" style={{ color: SB.ink }}>
          MGL Book
        </span>
        {["H2H", "Line", "Total"].map((label) => (
          <span key={label} className="text-center text-[13px] font-semibold" style={{ color: SB.ink }}>
            {label}
          </span>
        ))}
      </div>

      {rows.map((r) => (
        <div key={r.abbrev} className="grid grid-cols-[1fr_repeat(3,4.25rem)] items-end gap-x-2 pt-2">
          <span className="truncate pb-2 text-[15px] font-bold" style={{ color: SB.ink }}>
            {r.abbrev}
          </span>
          <SportsbetCell price={r.h2h} />
          <SportsbetCell price={r.linePrice} above={r.spread} />
          <SportsbetCell price={r.linePrice} above={r.totalLine} />
        </div>
      ))}
    </div>
  );
}

function SportsbetCell({ price, above }: { price: string; above?: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className="pb-0.5 text-[13px] font-semibold tabular-nums" style={{ color: SB.ink }}>
        {above ?? " "}
      </span>
      <span
        className="w-full rounded-[10px] py-1.5 text-center text-[15px] font-bold tabular-nums"
        style={{ background: SB.box, border: `1px solid ${SB.boxBorder}`, color: SB.ink }}
      >
        {price}
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* PointsBet — dark card, spaced caps, the line stacked inside the price box.  */
/* -------------------------------------------------------------------------- */

const PB = {
  bg: "#121212",
  card: "#1f1f1f",
  box: "#2b2b2b",
  boxBorder: "#4a4a4a",
  ink: "#ffffff",
  muted: "#9a9a9a",
};

function PointsbetSkin({ rows }: { rows: Row[] }) {
  return (
    <div style={{ background: PB.bg }} className="px-3 py-3">
      <div style={{ background: PB.card }} className="rounded-xl px-3 py-3">
        <div className="grid grid-cols-[1fr_repeat(3,4.25rem)] items-center gap-x-2">
          <span className="text-[13px] font-semibold" style={{ color: PB.ink }}>
            MGL Book
          </span>
          {["H2H", "Line", "Total"].map((label) => (
            <span
              key={label}
              className="text-center text-[10px] font-semibold uppercase tracking-[0.15em]"
              style={{ color: PB.muted }}
            >
              {label}
            </span>
          ))}
        </div>

        {rows.map((r) => (
          <div key={r.abbrev} className="mt-2 grid grid-cols-[1fr_repeat(3,4.25rem)] items-stretch gap-x-2">
            <span className="flex items-center truncate text-[15px] font-bold" style={{ color: PB.ink }}>
              {r.abbrev}
            </span>
            <PointsbetCell price={r.h2h} />
            <PointsbetCell price={r.linePrice} above={r.spread} />
            <PointsbetCell price={r.linePrice} above={r.totalLine} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PointsbetCell({ price, above }: { price: string; above?: string }) {
  return (
    <span
      className="flex flex-col items-center justify-center rounded-lg px-1 py-1.5"
      style={{ background: PB.box, border: `1px solid ${PB.boxBorder}`, color: PB.ink }}
    >
      {above ? (
        <span className="text-[11px] tabular-nums" style={{ color: PB.muted }}>
          {above}
        </span>
      ) : null}
      <span className="text-[15px] font-bold tabular-nums" style={{ color: PB.ink }}>
        {price}
      </span>
    </span>
  );
}
