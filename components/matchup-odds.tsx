"use client";

import { useSettings } from "./settings-provider";
import {
  formatMoneyline,
  formatSpread,
  getMatchupOdds,
  STANDARD_JUICE,
  type SideOdds,
} from "@/lib/odds";
import type { Matchup, MatchupSide } from "@/lib/types";

/** Novelty betting lines for an upcoming matchup, hidden unless the reader has
 *  switched them on in Settings. Nothing here is a real market — see lib/odds.ts. */
export function MatchupOddsStrip({ matchup }: { matchup: Matchup }) {
  const { ready, showOdds } = useSettings();

  // `ready` is false on the server and on the first client render, so the
  // markup matches until the stored preference has been read.
  if (!ready || !showOdds || matchup.status !== "upcoming") return null;

  const odds = getMatchupOdds(matchup);

  return (
    <div className="border-t border-border bg-section px-4 py-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          MGL Book
        </span>
        <span className="rounded bg-border px-1.5 py-0.5 font-cond text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          Just for fun
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-1.5 gap-y-1 text-xs">
        <span />
        <ColumnLabel>Spread</ColumnLabel>
        <ColumnLabel>Total</ColumnLabel>
        <ColumnLabel>Money</ColumnLabel>

        <OddsRow side={matchup.away} odds={odds.away} total={`O ${odds.total.toFixed(1)}`} />
        <OddsRow side={matchup.home} odds={odds.home} total={`U ${odds.total.toFixed(1)}`} />
      </div>

      <p className="mt-1.5 text-[10px] text-text-dim">
        Spread and total priced at {STANDARD_JUICE}. Simulated lines — not a real book.
      </p>
    </div>
  );
}

function ColumnLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-[4.25rem] text-right font-cond text-[10px] font-semibold uppercase tracking-wide text-text-dim">
      {children}
    </span>
  );
}

function OddsRow({ side, odds, total }: { side: MatchupSide; odds: SideOdds; total: string }) {
  return (
    <>
      <span className="truncate font-cond text-sm font-semibold">{side.team.abbrev}</span>
      <OddsCell value={formatSpread(odds.spread)} />
      <OddsCell value={total} />
      <OddsCell value={formatMoneyline(odds.moneyline)} />
    </>
  );
}

function OddsCell({ value }: { value: string }) {
  return (
    <span className="w-[4.25rem] rounded bg-card px-1.5 py-1 text-center font-cond text-sm font-semibold tabular-nums">
      {value}
    </span>
  );
}
