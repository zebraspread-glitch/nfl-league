import Link from "next/link";
import {
  getRecordBook,
  shortWeek,
  type TeamGameRecord,
  type MatchupRecord,
  type StreakRecord,
  type RivalryRecord,
  type RivalryStreakRecord,
  type PairRivalryRecord,
  type ChartGameRecord,
} from "@/lib/games";
import { getPlayerRecords, type PlayerGameRecord, type LabeledPlayerRecord } from "@/lib/player-records";
import type { TeamMeta } from "@/lib/types";
import { Card, SectionHeader, SectionTitle, PageIntro, TeamAvatar, Score } from "@/components/ui";
import { PlayerBadge } from "@/components/player-badge";

export const revalidate = 3600;

export default async function GameRecordsPage() {
  const rb = await getRecordBook();
  const pr = await getPlayerRecords();

  return (
    <div className="space-y-3">
      <PageIntro title="Record Book" subtitle={`Single-game extremes · ${rb.totalGames} games (consolation excluded)`} />

      <div className="grid grid-cols-2 gap-3">
        <StreakCard label="Longest win streak" s={rb.longestWinStreak} tone="win" />
        <StreakCard label="Longest losing streak" s={rb.longestLoseStreak} tone="loss" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <RivalryStreakCard label="Longest H2H streak" row={rb.longestH2HWinStreaks[0]} />
        <PairSpotlightCard label="Most-played rivalry" row={rb.mostPlayedRivalries[0]} value={`${rb.mostPlayedRivalries[0]?.games ?? 0}`} />
        <RivalrySpotlightCard label="Most wins over one team" row={rb.mostWinsOverOpponent[0]} value={`${rb.mostWinsOverOpponent[0]?.wins ?? 0}`} />
      </div>

      <RivalryStreakList title="Longest streaks against one team" rows={rb.longestH2HWinStreaks} />
      <RivalryList title="Most wins over another team" rows={rb.mostWinsOverOpponent} metric="wins" />
      <RivalryList title="Best head-to-head win %" rows={rb.bestH2HWinPct} metric="pct" />
      <PairRivalryList title="Teams that played each other the most" rows={rb.mostPlayedRivalries} metric="games" />
      <PairRivalryList title="Closest rivalries by total points" rows={rb.closestRivalries} metric="pointDiff" />
      <PairRivalryList title="Highest-scoring rivalries" rows={rb.highestScoringRivalries} metric="avgCombined" />
      <RivalryList title="Most points scored on average against an opponent" rows={rb.bestAvgVsOpponent} metric="avgFor" />
      <RivalryList title="Fewest points scored on average against an opponent" rows={rb.worstAvgVsOpponent} metric="avgFor" />

      <TeamGameList title="Highest scores ever" rows={rb.highestScores} />
      <TeamGameList title="Most points in a loss" rows={rb.mostInLoss} subtitle="heartbreak" />
      <TeamGameList title="Lowest scores ever" rows={rb.lowestScores} />
      <MatchupList title="Biggest blowouts" rows={rb.blowouts} metric="margin" />
      <MatchupList title="Closest games" rows={rb.nailbiters} metric="margin" />
      <MatchupList title="Highest-scoring shootouts" rows={rb.shootouts} metric="combined" />

      <ChartRecordList title="Biggest comebacks" rows={rb.comebacks} unit="down" format={(v) => v.toFixed(1)} tone="up" />
      <ChartRecordList title="Tightest games" rows={rb.tightest} unit="max lead" format={(v) => v.toFixed(1)} />
      <ChartRecordList title="Most back-and-forth (lead changes)" rows={rb.mostLeadChanges} unit="lead changes" format={(v) => `${v}`} />
      <ChartRecordList title="Won leading the least" rows={rb.wonLeadingLeast} unit="of game led" format={(v) => `${v}%`} />
      <ChartRecordList title="Most comfortable wins" rows={rb.mostComfortable} unit="avg lead" format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`} />
      <ChartRecordList title="Biggest momentum swings" rows={rb.biggestSwings} unit="pt swing" format={(v) => v.toFixed(1)} />

      <SectionTitle>Player single-game records</SectionTitle>
      <PlayerGameList title="Highest-scoring games" rows={pr.highestGames} unit="pts" format={(v) => v.toFixed(1)} />
      <LabeledPlayerList title="Best game by position" rows={pr.bestByPosition} unit="pts" format={(v) => v.toFixed(1)} />
      <PlayerGameList title="Most points in a loss" rows={pr.mostInLoss} unit="pts" format={(v) => v.toFixed(1)} />
      <PlayerGameList title="One-man shows (most of a team's score)" rows={pr.oneManShows} unit="of team" format={(v) => `${v}%`} />
      <PlayerGameList title="Biggest points left on the bench" rows={pr.benchMistakes} unit="pts" format={(v) => v.toFixed(1)} />
      <LabeledPlayerList title="Biggest stat lines" rows={pr.statLines} format={(v) => `${v}`} />
    </div>
  );
}

function TeamPair({
  left,
  leftName,
  right,
  rightName,
}: {
  left?: TeamMeta;
  leftName: string;
  right?: TeamMeta;
  rightName: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex shrink-0 -space-x-2">
        {left ? <TeamAvatar team={left} size="sm" /> : <span className="h-8 w-8 rounded-full bg-section" />}
        {right ? <TeamAvatar team={right} size="sm" /> : <span className="h-8 w-8 rounded-full bg-section" />}
      </div>
      <div className="min-w-0">
        <div className="truncate font-cond text-base font-semibold leading-tight">{leftName}</div>
        <div className="truncate text-[11px] text-text-muted">vs {rightName}</div>
      </div>
    </div>
  );
}

function RivalryStreakCard({ label, row }: { label: string; row?: RivalryStreakRecord }) {
  return (
    <Card className="p-3">
      <div className="font-cond text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
      {row ? (
        <>
          <div className="mt-1.5">
            <TeamPair left={row.team} leftName={row.teamName} right={row.opponent} rightName={row.opponentName} />
          </div>
          <div className="mt-1 font-cond text-3xl font-bold tabular-nums text-up">{row.length}</div>
          <div className="text-[11px] text-text-muted">{row.from} - {row.to}</div>
        </>
      ) : (
        <div className="mt-2 text-sm text-text-muted">No record yet.</div>
      )}
    </Card>
  );
}

function RivalrySpotlightCard({ label, row, value }: { label: string; row?: RivalryRecord; value: string }) {
  return (
    <Card className="p-3">
      <div className="font-cond text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
      {row ? (
        <>
          <div className="mt-1.5">
            <TeamPair left={row.team} leftName={row.teamName} right={row.opponent} rightName={row.opponentName} />
          </div>
          <div className="mt-1 font-cond text-3xl font-bold tabular-nums">{value}</div>
          <div className="text-[11px] text-text-muted">{row.wins}-{row.losses}{row.ties ? `-${row.ties}` : ""} all time</div>
        </>
      ) : (
        <div className="mt-2 text-sm text-text-muted">No record yet.</div>
      )}
    </Card>
  );
}

function PairSpotlightCard({ label, row, value }: { label: string; row?: PairRivalryRecord; value: string }) {
  return (
    <Card className="p-3">
      <div className="font-cond text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
      {row ? (
        <>
          <div className="mt-1.5">
            <TeamPair left={row.a} leftName={row.aName} right={row.b} rightName={row.bName} />
          </div>
          <div className="mt-1 font-cond text-3xl font-bold tabular-nums">{value}</div>
          <div className="text-[11px] text-text-muted">{row.aWins}-{row.bWins}{row.ties ? `-${row.ties}` : ""} series</div>
        </>
      ) : (
        <div className="mt-2 text-sm text-text-muted">No record yet.</div>
      )}
    </Card>
  );
}

function StreakCard({ label, s, tone }: { label: string; s: StreakRecord; tone: "win" | "loss" }) {
  return (
    <Card className="p-3">
      <div className="font-cond text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-1.5 flex items-center gap-2">
        {s.team && <TeamAvatar team={s.team} size="sm" />}
        <span className="truncate font-cond text-base font-semibold">{s.teamName}</span>
      </div>
      <div className={`mt-1 font-cond text-3xl font-bold tabular-nums ${tone === "win" ? "text-up" : "text-down"}`}>
        {s.length}
      </div>
      <div className="text-[11px] text-text-muted">{s.from} → {s.to}</div>
    </Card>
  );
}

function RivalryStreakList({ title, rows }: { title: string; rows: RivalryStreakRecord[] }) {
  return (
    <Card>
      <SectionHeader>{title}</SectionHeader>
      {rows.map((r, i) => (
        <div key={`${r.teamName}-${r.opponentName}-${r.from}-${r.to}`} className={`flex items-center gap-3 px-3 py-2.5 ${i % 2 ? "bg-card" : "bg-row"}`}>
          <span className="w-5 text-center font-cond text-sm font-bold text-text-muted">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <TeamPair left={r.team} leftName={r.teamName} right={r.opponent} rightName={r.opponentName} />
          </div>
          <div className="text-right">
            <div className="font-cond text-lg font-bold tabular-nums">{r.length}</div>
            <div className="text-[11px] text-text-muted">{r.from} - {r.to}</div>
          </div>
        </div>
      ))}
    </Card>
  );
}

function RivalryList({ title, rows, metric }: { title: string; rows: RivalryRecord[]; metric: "wins" | "pct" | "avgFor" }) {
  return (
    <Card>
      <SectionHeader>{title}</SectionHeader>
      {rows.map((r, i) => (
        <div key={`${title}-${r.teamName}-${r.opponentName}`} className={`flex items-center gap-3 px-3 py-2.5 ${i % 2 ? "bg-card" : "bg-row"}`}>
          <span className="w-5 text-center font-cond text-sm font-bold text-text-muted">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <TeamPair left={r.team} leftName={r.teamName} right={r.opponent} rightName={r.opponentName} />
          </div>
          <div className="shrink-0 text-right">
            <div className="font-cond text-lg font-bold tabular-nums">
              {metric === "wins" ? r.wins : metric === "pct" ? r.winPct.toFixed(3).replace(/^0/, "") : r.avgFor.toFixed(1)}
            </div>
            <div className="text-[11px] text-text-muted">
              {metric === "avgFor" ? `avg pts / ${r.games} games` : `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ""} / ${r.games}`}
            </div>
          </div>
        </div>
      ))}
    </Card>
  );
}

function PairRivalryList({
  title,
  rows,
  metric,
}: {
  title: string;
  rows: PairRivalryRecord[];
  metric: "games" | "pointDiff" | "avgCombined";
}) {
  return (
    <Card>
      <SectionHeader>{title}</SectionHeader>
      {rows.map((r, i) => (
        <div key={`${title}-${r.aName}-${r.bName}`} className={`flex items-center gap-3 px-3 py-2.5 ${i % 2 ? "bg-card" : "bg-row"}`}>
          <span className="w-5 text-center font-cond text-sm font-bold text-text-muted">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <TeamPair left={r.a} leftName={r.aName} right={r.b} rightName={r.bName} />
            <div className="ml-14 text-[11px] text-text-muted">
              Series {r.aWins}-{r.bWins}{r.ties ? `-${r.ties}` : ""} - total points {r.aPoints.toFixed(1)} to {r.bPoints.toFixed(1)}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-cond text-lg font-bold tabular-nums">
              {metric === "games" ? r.games : metric === "pointDiff" ? r.pointDiff.toFixed(1) : r.avgCombined.toFixed(1)}
            </div>
            <div className="text-[11px] text-text-muted">
              {metric === "games" ? "games" : metric === "pointDiff" ? "pt diff" : "avg total"}
            </div>
          </div>
        </div>
      ))}
    </Card>
  );
}

function TeamGameList({ title, rows, subtitle }: { title: string; rows: TeamGameRecord[]; subtitle?: string }) {
  return (
    <Card>
      <SectionHeader>{title}</SectionHeader>
      {rows.map((r, i) => (
        <Link
          key={r.gameId + r.teamName}
          href={`/games/${r.gameId}`}
          className={`flex items-center gap-3 px-3 py-2.5 ${i % 2 ? "bg-card" : "bg-row"} hover:bg-card-hover`}
        >
          <span className="w-5 text-center font-cond text-sm font-bold text-text-muted">{i + 1}</span>
          {r.team ? <TeamAvatar team={r.team} size="sm" /> : <span className="h-7 w-7 rounded-full bg-section" />}
          <div className="min-w-0 flex-1">
            <div className="truncate font-cond text-base font-semibold leading-tight">{r.teamName}</div>
            <div className="truncate text-[11px] text-text-muted">
              {r.win ? "def." : "lost to"} {r.oppName} · {r.season} {shortWeek(r.week)}
              {subtitle ? ` · ${r.oppScore.toFixed(1)} ag.` : ""}
            </div>
          </div>
          <Score value={r.score} className="text-lg" />
        </Link>
      ))}
    </Card>
  );
}

function PlayerGameList({
  title,
  rows,
  unit,
  format,
}: {
  title: string;
  rows: PlayerGameRecord[];
  unit: string;
  format: (value: number) => string;
}) {
  return (
    <Card>
      <SectionHeader>{title}</SectionHeader>
      {rows.map((r, i) => (
        <div
          key={`${r.gameId}-${r.playerId}-${i}`}
          className={`flex items-center gap-3 px-3 py-2.5 ${i % 2 ? "bg-card" : "bg-row"}`}
        >
          <span className="w-5 shrink-0 text-center font-cond text-sm font-bold text-text-muted">{i + 1}</span>
          <PlayerBadge playerId={r.playerId} pos={r.pos} name={r.playerName} />
          <Link href={`/games/${r.gameId}`} className="min-w-0 flex-1 hover:underline">
            <div className="truncate font-cond text-sm font-semibold leading-tight">{r.playerName}</div>
            <div className="truncate text-[11px] text-text-muted">
              {r.pos} · {r.teamName} · {r.season} {shortWeek(r.week)}
              {r.detail ? ` · ${r.detail}` : ""}
            </div>
          </Link>
          <div className="shrink-0 text-right">
            <div className="font-cond text-lg font-bold tabular-nums">{format(r.value)}</div>
            <div className="text-[11px] text-text-muted">{unit}</div>
          </div>
        </div>
      ))}
    </Card>
  );
}

function LabeledPlayerList({
  title,
  rows,
  unit,
  format,
}: {
  title: string;
  rows: LabeledPlayerRecord[];
  unit?: string;
  format: (value: number) => string;
}) {
  return (
    <Card>
      <SectionHeader>{title}</SectionHeader>
      {rows.map((r, i) => (
        <div key={r.label} className={`flex items-center gap-3 px-3 py-2.5 ${i % 2 ? "bg-card" : "bg-row"}`}>
          <span className="w-9 shrink-0 font-cond text-xs font-bold uppercase tracking-wide text-text-muted">{r.label}</span>
          {r.rec ? (
            <>
              <PlayerBadge playerId={r.rec.playerId} pos={r.rec.pos} name={r.rec.playerName} />
              <Link href={`/games/${r.rec.gameId}`} className="min-w-0 flex-1 hover:underline">
                <div className="truncate font-cond text-sm font-semibold leading-tight">{r.rec.playerName}</div>
                <div className="truncate text-[11px] text-text-muted">
                  {r.rec.teamName} · {r.rec.season} {shortWeek(r.rec.week)}
                  {r.rec.detail ? ` · ${r.rec.detail}` : ""}
                </div>
              </Link>
              <div className="shrink-0 text-right">
                <div className="font-cond text-lg font-bold tabular-nums">{format(r.rec.value)}</div>
                {unit && <div className="text-[11px] text-text-muted">{unit}</div>}
              </div>
            </>
          ) : (
            <span className="flex-1 text-sm text-text-muted">—</span>
          )}
        </div>
      ))}
    </Card>
  );
}

function ChartRecordList({
  title,
  rows,
  unit,
  format,
  tone,
}: {
  title: string;
  rows: ChartGameRecord[];
  unit: string;
  format: (value: number) => string;
  tone?: "up";
}) {
  return (
    <Card>
      <SectionHeader>{title}</SectionHeader>
      {rows.map((r, i) => (
        <Link
          key={r.gameId}
          href={`/games/${r.gameId}`}
          className={`flex items-center gap-3 px-3 py-2.5 ${i % 2 ? "bg-card" : "bg-row"} hover:bg-card-hover`}
        >
          <span className="w-5 text-center font-cond text-sm font-bold text-text-muted">{i + 1}</span>
          {r.winnerTeam ? <TeamAvatar team={r.winnerTeam} size="sm" /> : <span className="h-7 w-7 rounded-full bg-section" />}
          <div className="min-w-0 flex-1">
            <div className="truncate font-cond text-sm font-semibold leading-tight">
              {r.winnerName} <span className="text-text-muted">def.</span> {r.loserName}
            </div>
            <div className="truncate text-[11px] text-text-muted">
              won {r.winnerScore.toFixed(1)} – {r.loserScore.toFixed(1)} · {r.season} {shortWeek(r.week)}
              {r.detail ? ` · ${r.detail}` : ""}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className={`font-cond text-lg font-bold tabular-nums ${tone === "up" ? "text-up" : ""}`}>{format(r.value)}</div>
            <div className="text-[11px] text-text-muted">{unit}</div>
          </div>
        </Link>
      ))}
    </Card>
  );
}

function MatchupList({ title, rows, metric }: { title: string; rows: MatchupRecord[]; metric: "margin" | "combined" }) {
  return (
    <Card>
      <SectionHeader>{title}</SectionHeader>
      {rows.map((r, i) => (
        <Link
          key={r.gameId}
          href={`/games/${r.gameId}`}
          className={`flex items-center gap-3 px-3 py-2.5 ${i % 2 ? "bg-card" : "bg-row"} hover:bg-card-hover`}
        >
          <span className="w-5 text-center font-cond text-sm font-bold text-text-muted">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-cond text-sm font-semibold leading-tight">
              {r.winnerName} <span className="text-text-muted">def.</span> {r.loserName}
            </div>
            <div className="text-[11px] text-text-muted">
              {r.winnerScore.toFixed(1)} – {r.loserScore.toFixed(1)} · {r.season} {shortWeek(r.week)}
            </div>
          </div>
          <span className="font-cond text-lg font-bold tabular-nums">
            {metric === "margin" ? `+${r.margin.toFixed(1)}` : r.combined.toFixed(1)}
          </span>
        </Link>
      ))}
    </Card>
  );
}
