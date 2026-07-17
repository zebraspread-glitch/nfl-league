import { Fragment } from "react";
import Link from "next/link";
import {
  getScoregamiBook,
  type RivalryScoregamiStat,
  type ScoreBandGrid,
  type ScoreFrequency,
  type ScoregamiGameRow,
  type ScoregamiStreak,
  type SeasonScoregamiStat,
  type TeamScoregamiStat,
} from "@/lib/scoregami";
import { Card, PageIntro, SectionHeader, TeamAvatar } from "@/components/ui";
import type { TeamMeta } from "@/lib/types";

export const revalidate = 3600;

export const metadata = { title: "Scoregami - MGL Fantasy" };

export default async function ScoregamiPage() {
  const book = await getScoregamiBook();
  const mostCommon = book.mostCommonScores[0];
  const topTeam = book.teamStats[0];
  const topRivalry = book.rivalryScoregamiLeaders[0];

  return (
    <div className="space-y-3">
      <PageIntro
        title="Scoregami"
        subtitle={`${book.uniqueScores} unique integer scorelines across ${book.totalGames} matchups, 2021-2025`}
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Scoregamis" value={book.scoregamis} sub={`${book.scoregamiRate.toFixed(1)}% of games`} tone="gold" />
        <StatCard label="Repeats" value={book.repeats} sub={`${book.oneOffScores} one-hit scores`} />
        <StatCard label="Most repeated" value={mostCommon?.scoreKey ?? "-"} sub={mostCommon ? `${mostCommon.count} times` : "No repeats"} />
        <StatCard label="Fresh-score run" value={book.longestFreshRun.length} sub={streakLabel(book.longestFreshRun)} />
      </div>

      <Card className="p-3">
        <div className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-lg border border-border bg-row">
          <Spotlight label="Top team" value={topTeam?.team.abbrev ?? "-"} sub={topTeam ? `${topTeam.scoregamis} scoregamis` : "-"} color={topTeam?.team.primary} />
          <Spotlight
            label="Top rivalry"
            value={topRivalry ? `${topRivalry.a.abbrev}-${topRivalry.b.abbrev}` : "-"}
            sub={topRivalry ? `${topRivalry.scoregamis} new scores` : "-"}
          />
          <Spotlight
            label="Latest"
            value={book.latestScoregamis[0]?.scoreKey ?? "-"}
            sub={book.latestScoregamis[0] ? `${book.latestScoregamis[0].season} ${book.latestScoregamis[0].roundLabel}` : "-"}
          />
        </div>
      </Card>

      <ScoreFrequencyList title="Most common score results" rows={book.mostCommonScores} />
      <GameList title="Newest scoregamis" rows={book.latestScoregamis} />
      <GameList title="Recent repeats" rows={book.latestRepeats} empty="No scoreline has repeated yet." />

      <SeasonTable rows={book.seasonStats} />
      <TeamLeaders rows={book.teamStats.slice(0, 10)} />
      <RivalryList title="Rivalries with the most scoregamis" rows={book.rivalryScoregamiLeaders} metric="scoregamis" />
      <RivalryList title="Rivalries with the most different scores" rows={book.rivalryStats} metric="uniqueScores" />

      <div className="grid gap-3 sm:grid-cols-2">
        <GameList title="Highest-total scoregamis" rows={book.highestScoregamis} compact />
        <GameList title="Lowest-total scoregamis" rows={book.lowestScoregamis} compact />
        <GameList title="Closest scoregamis" rows={book.closestScoregamis} compact />
        <GameList title="Biggest blowout scoregamis" rows={book.biggestBlowoutScoregamis} compact />
      </div>

      <ScoreMap grid={book.scoreGrid} />
      <EveryMatchupLog seasons={book.gamesBySeason} />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: number | string;
  sub: string;
  tone?: "default" | "gold";
}) {
  return (
    <Card className="p-3">
      <div className="font-cond text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className={`mt-1 font-cond text-3xl font-bold tabular-nums ${tone === "gold" ? "text-[#9a7100]" : "text-text"}`}>
        {value}
      </div>
      <div className="truncate text-[11px] text-text-muted">{sub}</div>
    </Card>
  );
}

function Spotlight({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="min-w-0 bg-card px-2 py-2.5 text-center">
      <div className="font-cond text-[10px] uppercase tracking-wide text-text-dim">{label}</div>
      <div className="truncate font-cond text-lg font-bold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="truncate text-[10px] text-text-muted">{sub}</div>
    </div>
  );
}

function streakLabel(streak: ScoregamiStreak): string {
  if (!streak.from || !streak.to) return "No run";
  if (streak.from.gameId === streak.to.gameId) return `${streak.from.season} ${streak.from.roundLabel}`;
  return `${streak.from.season} ${streak.from.roundLabel} to ${streak.to.season} ${streak.to.roundLabel}`;
}

function ScoreFrequencyList({ title, rows }: { title: string; rows: ScoreFrequency[] }) {
  return (
    <Card>
      <SectionHeader>{title}</SectionHeader>
      {rows.length ? (
        rows.map((row, index) => (
          <Link
            key={row.scoreKey}
            href={`/games/${row.latestGame.gameId}`}
            className={`flex items-center gap-3 px-3 py-2.5 ${index % 2 ? "bg-card" : "bg-row"} hover:bg-card-hover`}
          >
            <span className="w-5 shrink-0 text-center font-cond text-sm font-bold text-text-muted">{index + 1}</span>
            <div className="grid h-11 w-20 shrink-0 place-items-center rounded-lg bg-section font-cond text-xl font-bold tabular-nums">
              {row.scoreKey}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-cond text-sm font-semibold leading-tight">
                {row.firstGame.winnerName} def. {row.firstGame.loserName}
              </div>
              <div className="truncate text-[11px] text-text-muted">
                first {row.firstGame.season} {row.firstGame.roundLabel} - latest {row.latestGame.season} {row.latestGame.roundLabel}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-cond text-lg font-bold tabular-nums">{row.count}</div>
              <div className="text-[11px] text-text-muted">times</div>
            </div>
          </Link>
        ))
      ) : (
        <div className="px-4 py-5 text-center text-sm text-text-muted">No repeated scorelines yet.</div>
      )}
    </Card>
  );
}

function GameList({
  title,
  rows,
  empty = "No games found.",
  compact = false,
}: {
  title: string;
  rows: ScoregamiGameRow[];
  empty?: string;
  compact?: boolean;
}) {
  return (
    <Card>
      <SectionHeader>{title}</SectionHeader>
      {rows.length ? (
        rows.map((row, index) => <GameResultRow key={`${title}-${row.gameId}`} row={row} index={index} compact={compact} />)
      ) : (
        <div className="px-4 py-5 text-center text-sm text-text-muted">{empty}</div>
      )}
    </Card>
  );
}

function GameResultRow({ row, index, compact = false }: { row: ScoregamiGameRow; index: number; compact?: boolean }) {
  return (
    <Link
      href={`/games/${row.gameId}`}
      className={`flex items-center gap-3 px-3 ${compact ? "py-2" : "py-2.5"} ${index % 2 ? "bg-card" : "bg-row"} hover:bg-card-hover`}
    >
      <span className="w-5 shrink-0 text-center font-cond text-sm font-bold text-text-muted">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <ResultTeams row={row} />
        <div className="truncate text-[11px] text-text-muted">
          {row.season} {row.roundLabel} - {row.isScoregami ? "scoregami" : `repeat #${row.occurrence}`}
          {!row.isScoregami && row.firstGame ? ` - first ${row.firstGame.season} ${row.firstGame.roundLabel}` : ""}
        </div>
      </div>
      <ScoreBlock row={row} />
    </Link>
  );
}

function ResultTeams({ row }: { row: ScoregamiGameRow }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <TeamStack winner={row.winnerTeam} loser={row.loserTeam} />
      <div className="min-w-0">
        <div className="truncate font-cond text-sm font-semibold leading-tight">
          {row.winnerName} <span className="text-text-muted">def.</span> {row.loserName}
        </div>
      </div>
    </div>
  );
}

function TeamStack({ winner, loser }: { winner?: TeamMeta; loser?: TeamMeta }) {
  return (
    <div className="flex shrink-0 -space-x-2">
      {winner ? <TeamAvatar team={winner} size="sm" /> : <span className="h-8 w-8 rounded-full bg-section" />}
      {loser ? <TeamAvatar team={loser} size="sm" /> : <span className="h-8 w-8 rounded-full bg-section" />}
    </div>
  );
}

function ScoreBlock({ row }: { row: ScoregamiGameRow }) {
  return (
    <div className="shrink-0 text-right">
      <div className="font-cond text-lg font-bold tabular-nums">{row.scoreKey}</div>
      <div className="text-[11px] text-text-muted">
        {row.winnerRawScore.toFixed(1)}-{row.loserRawScore.toFixed(1)}
      </div>
    </div>
  );
}

function SeasonTable({ rows }: { rows: SeasonScoregamiStat[] }) {
  return (
    <Card>
      <SectionHeader>Season splits</SectionHeader>
      <div className="grid grid-cols-[52px_1fr_1fr_1fr_1fr] items-center border-b border-border bg-section px-3 py-1.5 font-cond text-xs font-semibold uppercase tracking-wide text-text-muted">
        <span>Year</span>
        <span className="text-center">New</span>
        <span className="text-center">Repeat</span>
        <span className="text-center">Rate</span>
        <span className="text-right">Avg total</span>
      </div>
      {rows.map((row, index) => (
        <div key={row.season} className={`grid grid-cols-[52px_1fr_1fr_1fr_1fr] items-center px-3 py-2 ${index % 2 ? "bg-card" : "bg-row"}`}>
          <span className="font-cond text-sm font-bold">{row.season}</span>
          <span className="text-center font-cond text-sm tabular-nums">{row.scoregamis}</span>
          <span className="text-center font-cond text-sm tabular-nums text-text-muted">{row.repeats}</span>
          <span className="text-center font-cond text-sm tabular-nums">{row.uniqueRate.toFixed(1)}%</span>
          <span className="text-right font-cond text-sm font-semibold tabular-nums">{row.avgTotal.toFixed(1)}</span>
        </div>
      ))}
    </Card>
  );
}

function TeamLeaders({ rows }: { rows: TeamScoregamiStat[] }) {
  return (
    <Card>
      <SectionHeader>Team scoregami leaders</SectionHeader>
      {rows.map((row, index) => (
        <Link
          key={row.team.id}
          href={`/teams/${row.team.id}`}
          className={`flex items-center gap-3 px-3 py-2.5 ${index % 2 ? "bg-card" : "bg-row"} hover:bg-card-hover`}
        >
          <span className="w-5 shrink-0 text-center font-cond text-sm font-bold text-text-muted">{index + 1}</span>
          <TeamAvatar team={row.team} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-cond text-base font-semibold leading-tight">{row.team.name}</div>
            <div className="truncate text-[11px] text-text-muted">
              {row.uniqueScores} unique scores - avg {row.avgFor.toFixed(1)} for, {row.avgAgainst.toFixed(1)} against
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-cond text-lg font-bold tabular-nums">{row.scoregamis}</div>
            <div className="text-[11px] text-text-muted">{row.scoregamiWins}-{row.scoregamiLosses}</div>
          </div>
        </Link>
      ))}
    </Card>
  );
}

function RivalryList({
  title,
  rows,
  metric,
}: {
  title: string;
  rows: RivalryScoregamiStat[];
  metric: "scoregamis" | "uniqueScores";
}) {
  return (
    <Card>
      <SectionHeader>{title}</SectionHeader>
      {rows.map((row, index) => (
        <div key={`${title}-${row.a.id}-${row.b.id}`} className={`flex items-center gap-3 px-3 py-2.5 ${index % 2 ? "bg-card" : "bg-row"}`}>
          <span className="w-5 shrink-0 text-center font-cond text-sm font-bold text-text-muted">{index + 1}</span>
          <TeamStack winner={row.a} loser={row.b} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-cond text-base font-semibold leading-tight">
              {row.a.name} vs {row.b.name}
            </div>
            <div className="truncate text-[11px] text-text-muted">
              {row.games} games - {row.repeats} repeats{row.mostCommon && row.mostCommon.count > 1 ? ` - ${row.mostCommon.scoreKey} hit ${row.mostCommon.count}x` : ""}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-cond text-lg font-bold tabular-nums">
              {metric === "scoregamis" ? row.scoregamis : row.uniqueScores}
            </div>
            <div className="text-[11px] text-text-muted">{metric === "scoregamis" ? "new" : "unique"}</div>
          </div>
        </div>
      ))}
    </Card>
  );
}

function ScoreMap({ grid }: { grid: ScoreBandGrid }) {
  return (
    <Card>
      <SectionHeader>Scoreline map</SectionHeader>
      <div className="overflow-x-auto p-3">
        <div
          className="min-w-[680px] text-center font-cond text-[10px] font-semibold uppercase tracking-wide text-text-muted"
          style={{ display: "grid", gridTemplateColumns: `54px repeat(${grid.winnerBands.length}, minmax(34px, 1fr))` }}
        >
          <div className="py-1 text-left">L/W</div>
          {grid.winnerBands.map((band) => (
            <div key={band.key} className="py-1">
              {band.label}
            </div>
          ))}
          {grid.rows.map((row) => (
            <Fragment key={row[0].loserBand.key}>
              <div className="py-1.5 text-left">{row[0].loserBand.label}</div>
              {row.map((cell) => {
                const alpha = cell.count ? 0.16 + (cell.count / grid.maxCount) * 0.72 : 0;
                return (
                  <div
                    key={`${cell.winnerBand.key}-${cell.loserBand.key}`}
                    className="m-0.5 grid h-7 place-items-center rounded border border-border/50 text-[11px] tabular-nums text-text"
                    style={{ backgroundColor: cell.count ? `rgba(22, 167, 198, ${alpha})` : "var(--section)" }}
                    title={`${cell.winnerBand.label}-${cell.loserBand.label}: ${cell.count}`}
                  >
                    {cell.count || ""}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </Card>
  );
}

function EveryMatchupLog({
  seasons,
}: {
  seasons: { season: number; games: ScoregamiGameRow[]; scoregamis: number; repeats: number }[];
}) {
  return (
    <Card>
      <SectionHeader>Every matchup score</SectionHeader>
      {seasons.map((season) => (
        <details key={season.season} open={season.season === 2025} className="group border-t border-border first:border-t-0">
          <summary className="flex cursor-pointer list-none items-center justify-between bg-section px-4 py-2.5 font-cond text-sm font-semibold uppercase tracking-wide text-text-muted hover:text-text">
            <span>{season.season}</span>
            <span className="text-xs normal-case tracking-normal">
              {season.games.length} games - {season.scoregamis} scoregamis - {season.repeats} repeats
            </span>
          </summary>
          <div>
            {season.games.map((row, index) => (
              <GameResultRow key={row.gameId} row={row} index={index} />
            ))}
          </div>
        </details>
      ))}
    </Card>
  );
}
