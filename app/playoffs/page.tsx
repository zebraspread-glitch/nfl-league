import Link from "next/link";
import { Card, EmptyState, PageIntro, SectionHeader, TeamAvatar } from "@/components/ui";
import { getAllTimePlayoffStats, getPlayoffBracket, type BracketMatchup, type BracketSlot, type PlayoffTeamStat } from "@/lib/games";
import { HISTORY_SEASONS } from "@/lib/league-data";

export const revalidate = 86400;

const BOX_H = 76;
const GAP = 14;
const COL_W = 168;
const CONNECTOR_W = 28;

type StatSortKey = "gp" | "wl" | "titles" | "runnerup" | "app" | "avg";
type SortDir = "asc" | "desc";

interface StatRow extends PlayoffTeamStat {
  runnerUps: number;
}

export default async function PlayoffsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; pstat?: string; pdir?: string }>;
}) {
  const { season: seasonParam, pstat: pstatParam, pdir: pdirParam } = await searchParams;
  const seasons = [...HISTORY_SEASONS].reverse();
  const requestedSeason = Number(seasonParam);
  const season = seasons.includes(requestedSeason) ? requestedSeason : seasons[0];

  const pstat: StatSortKey = (["gp", "wl", "titles", "runnerup", "app", "avg"] as const).includes(pstatParam as StatSortKey)
    ? (pstatParam as StatSortKey)
    : "titles";
  const pdir: SortDir = pdirParam === "asc" || pdirParam === "desc" ? pdirParam : "desc";

  const [bracket, playoffStats] = await Promise.all([getPlayoffBracket(season), getAllTimePlayoffStats()]);
  const rounds = bracket
    ? [
        { title: "Quarterfinal", matchups: bracket.quarterfinal },
        { title: "Semifinal", matchups: bracket.semifinal },
        { title: "Final", matchups: bracket.final },
      ].filter((r) => r.matchups.length > 0)
    : [];

  const statRows: StatRow[] = playoffStats.map((s) => ({ ...s, runnerUps: s.finalsAppearances - s.championships }));
  const sortedStats = sortStats(statRows, pstat, pdir);

  return (
    <div className="space-y-3">
      <PageIntro title="Playoff Bracket" subtitle={`${season} postseason`} />
      <SeasonTabs seasons={seasons} active={season} />

      {rounds.length === 0 ? (
        <EmptyState>No playoff bracket is available for {season}.</EmptyState>
      ) : (
        <BracketView rounds={rounds} />
      )}

      <PlayoffStandings stats={sortedStats} season={season} pstat={pstat} pdir={pdir} />
    </div>
  );
}

function sortStats(stats: StatRow[], key: StatSortKey, dir: SortDir): StatRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...stats].sort((a, b) => {
    switch (key) {
      case "gp":
        return (a.gamesPlayed - b.gamesPlayed) * sign;
      case "wl":
        return (a.wins - b.wins) * sign || (b.losses - a.losses) * sign;
      case "titles":
        return (a.championships - b.championships) * sign;
      case "runnerup":
        return (a.runnerUps - b.runnerUps) * sign;
      case "app":
        return (a.appearances - b.appearances) * sign;
      case "avg":
        return (a.avgPoints - b.avgPoints) * sign;
    }
  });
}

function statSortHref(key: StatSortKey, current: StatSortKey, dir: SortDir, season: number): string {
  const nextDir: SortDir = current === key ? (dir === "asc" ? "desc" : "asc") : "desc";
  return `/playoffs?season=${season}&pstat=${key}&pdir=${nextDir}`;
}

function StatSortLabel({
  label,
  sortKey,
  current,
  dir,
  season,
}: {
  label: string;
  sortKey: StatSortKey;
  current: StatSortKey;
  dir: SortDir;
  season: number;
}) {
  const active = current === sortKey;
  return (
    <Link
      href={statSortHref(sortKey, current, dir, season)}
      scroll={false}
      className={`flex items-center justify-center gap-0.5 ${active ? "text-teal" : "hover:text-text"}`}
    >
      {label}
      {active && <span className="text-[9px]">{dir === "asc" ? "▲" : "▼"}</span>}
    </Link>
  );
}

function PlayoffStandings({
  stats,
  season,
  pstat,
  pdir,
}: {
  stats: StatRow[];
  season: number;
  pstat: StatSortKey;
  pdir: SortDir;
}) {
  return (
    <Card>
      <SectionHeader>All-Time Playoff Record</SectionHeader>
      <div className="flex items-center gap-1.5 border-b border-border bg-section px-3 py-2 font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted sm:gap-2 sm:text-sm">
        <span className="w-6 text-center">#</span>
        <span className="flex-1 pl-9">Team</span>
        <span className="hidden w-8 text-center sm:block">
          <StatSortLabel label="GP" sortKey="gp" current={pstat} dir={pdir} season={season} />
        </span>
        <span className="w-11 text-center">
          <StatSortLabel label="W-L" sortKey="wl" current={pstat} dir={pdir} season={season} />
        </span>
        <span className="w-7 text-center">
          <StatSortLabel label="🏆" sortKey="titles" current={pstat} dir={pdir} season={season} />
        </span>
        <span className="w-7 text-center">
          <StatSortLabel label="🥈" sortKey="runnerup" current={pstat} dir={pdir} season={season} />
        </span>
        <span className="hidden w-8 text-center sm:block">
          <StatSortLabel label="App" sortKey="app" current={pstat} dir={pdir} season={season} />
        </span>
        <span className="hidden w-14 text-right sm:block">
          <span className="flex justify-end">
            <StatSortLabel label="Avg Pts" sortKey="avg" current={pstat} dir={pdir} season={season} />
          </span>
        </span>
      </div>
      {stats.map((s, i) => (
        <div key={s.id} className={`flex items-center gap-1.5 px-3 py-2.5 sm:gap-2 ${i % 2 === 1 ? "bg-card" : "bg-row"}`}>
          <span className="w-6 text-center font-cond text-sm font-semibold text-text-muted">{i + 1}</span>
          {s.team ? <TeamAvatar team={s.team} size="sm" /> : <span className="h-8 w-8 shrink-0 rounded-full bg-section" />}
          <span className="min-w-0 flex-1 truncate pl-2 text-sm font-semibold">{s.team?.name ?? s.name}</span>
          <span className="hidden w-8 text-center font-cond text-sm tabular-nums text-text-muted sm:block">{s.gamesPlayed}</span>
          <span className="w-11 text-center font-cond text-base font-semibold tabular-nums">
            {s.wins}-{s.losses}
          </span>
          <span className="w-7 text-center font-cond text-sm font-bold tabular-nums">{s.championships || "-"}</span>
          <span className="w-7 text-center font-cond text-sm font-bold tabular-nums">{s.runnerUps || "-"}</span>
          <span className="hidden w-8 text-center font-cond text-sm tabular-nums text-text-muted sm:block">{s.appearances}</span>
          <span className="hidden w-14 text-right font-cond text-sm font-semibold tabular-nums text-text-muted sm:block">
            {s.gamesPlayed ? s.avgPoints.toFixed(1) : "—"}
          </span>
        </div>
      ))}
    </Card>
  );
}

function SeasonTabs({ seasons, active }: { seasons: number[]; active: number }) {
  return (
    <div className="mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {seasons.map((s) => (
        <Link
          key={s}
          href={`/playoffs?season=${s}`}
          className={`shrink-0 rounded-full px-3.5 py-1.5 font-cond text-sm font-semibold transition-colors ${
            s === active ? "bg-teal text-white" : "bg-card text-text-muted hover:bg-card-hover"
          }`}
        >
          {s}
        </Link>
      ))}
    </div>
  );
}

function computeTops(n: number, prevTops?: number[]): number[] {
  if (!prevTops) return Array.from({ length: n }, (_, i) => i * (BOX_H + GAP));
  const tops: number[] = [];
  for (let j = 0; j < n; j++) {
    const c0 = prevTops[2 * j] + BOX_H / 2;
    const c1 = prevTops[2 * j + 1] + BOX_H / 2;
    tops.push((c0 + c1) / 2 - BOX_H / 2);
  }
  return tops;
}

type Column =
  | { kind: "round"; title: string; matchups: BracketMatchup[]; tops: number[] }
  | { kind: "connector"; tops: number[] }
  | { kind: "champion"; slot: BracketSlot | null; top: number };

function BracketView({ rounds }: { rounds: { title: string; matchups: BracketMatchup[] }[] }) {
  const topsByRound: number[][] = [];
  rounds.forEach((r, i) => topsByRound.push(computeTops(r.matchups.length, i === 0 ? undefined : topsByRound[i - 1])));

  const lastTops = topsByRound[topsByRound.length - 1];
  const championTop = lastTops[0] ?? 0;
  const champion = rounds[rounds.length - 1].matchups[0];
  const championSlot = champion ? (champion.a.id === champion.winnerId ? champion.a : champion.b ?? champion.a) : null;

  const bodyHeight = topsByRound[0].length ? topsByRound[0][topsByRound[0].length - 1] + BOX_H : BOX_H;

  const columns: Column[] = [];
  rounds.forEach((r, ri) => {
    columns.push({ kind: "round", title: r.title, matchups: r.matchups, tops: topsByRound[ri] });
    columns.push({ kind: "connector", tops: topsByRound[ri] });
  });
  columns.push({ kind: "champion", slot: championSlot, top: championTop });

  return (
    <div className="overflow-x-auto rounded-xl bg-card pb-3 shadow-sm">
      <div style={{ width: "max-content" }}>
        <div className="flex">
          {columns.map((col, i) =>
            col.kind === "connector" ? (
              <div key={i} style={{ width: CONNECTOR_W }} className="shrink-0" />
            ) : (
              <div
                key={i}
                style={{ width: COL_W }}
                className="shrink-0 px-2 pb-2 pt-3 text-center font-cond text-xs font-semibold uppercase tracking-wide text-text-muted"
              >
                {col.kind === "round" ? col.title : "Champion"}
              </div>
            ),
          )}
        </div>

        <div className="flex" style={{ height: bodyHeight }}>
          {columns.map((col, i) => {
            if (col.kind === "connector") {
              return (
                <div key={i} className="relative shrink-0" style={{ width: CONNECTOR_W, height: bodyHeight }}>
                  {col.tops.length === 1 ? (
                    <div className="absolute bg-border-strong" style={{ left: 0, top: col.tops[0] + BOX_H / 2 - 1, width: CONNECTOR_W, height: 2 }} />
                  ) : (
                    Array.from({ length: Math.floor(col.tops.length / 2) }).map((_, j) => (
                      <Connector key={j} topA={col.tops[2 * j]} topB={col.tops[2 * j + 1]} />
                    ))
                  )}
                </div>
              );
            }
            if (col.kind === "champion") {
              return (
                <div key={i} className="relative shrink-0 px-2" style={{ width: COL_W, height: bodyHeight }}>
                  {col.slot && (
                    <div
                      className="absolute left-2 flex flex-col items-center gap-1 rounded-lg bg-amber-50 px-2 py-2 text-center ring-1 ring-amber-300"
                      style={{ top: col.top - 6, width: COL_W - 16 }}
                    >
                      {col.slot.team ? <TeamAvatar team={col.slot.team} size="md" /> : null}
                      <span className="truncate font-cond text-sm font-bold">{col.slot.team?.name ?? col.slot.name}</span>
                      <span className="text-[10px] uppercase tracking-wide text-amber-600">Champion</span>
                    </div>
                  )}
                </div>
              );
            }
            return (
              <div key={i} className="relative shrink-0 px-2" style={{ width: COL_W, height: bodyHeight }}>
                {col.matchups.map((m, mi) => (
                  <MatchupBox key={m.gameId ?? `bye-${m.a.id}-${mi}`} matchup={m} top={col.tops[mi]} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Connector({ topA, topB }: { topA: number; topB: number }) {
  const cA = topA + BOX_H / 2;
  const cB = topB + BOX_H / 2;
  const top = Math.min(cA, cB);
  const height = Math.max(Math.abs(cB - cA), 2);
  const mid = (cA + cB) / 2;
  const half = CONNECTOR_W / 2;
  return (
    <>
      <div className="absolute bg-border-strong" style={{ left: 0, top: cA - 1, width: half, height: 2 }} />
      <div className="absolute bg-border-strong" style={{ left: 0, top: cB - 1, width: half, height: 2 }} />
      <div className="absolute bg-border-strong" style={{ left: half - 1, top, width: 2, height }} />
      <div className="absolute bg-border-strong" style={{ left: half, top: mid - 1, width: half, height: 2 }} />
    </>
  );
}

function MatchupBox({ matchup, top }: { matchup: BracketMatchup; top: number }) {
  const content = (
    <div className="flex flex-col justify-center rounded-lg border border-border bg-section/60 px-2 py-1 shadow-sm" style={{ height: BOX_H }}>
      <SlotRow slot={matchup.a} win={matchup.winnerId === matchup.a.id} />
      {matchup.b ? (
        <SlotRow slot={matchup.b} win={matchup.winnerId === matchup.b.id} />
      ) : (
        <div className="flex h-1/2 items-center gap-1.5 opacity-50">
          <span className="h-5 w-5 shrink-0 rounded-full bg-card" />
          <span className="truncate text-[11px] text-text-muted">Bye</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="absolute left-2" style={{ top, width: COL_W - 16 }}>
      {matchup.gameId ? (
        <Link href={`/games/${matchup.gameId}`} className="block">
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}

function SlotRow({ slot, win }: { slot: BracketSlot; win: boolean }) {
  return (
    <div className={`flex h-1/2 items-center gap-1.5 ${win ? "" : "opacity-55"}`}>
      {slot.team ? <TeamAvatar team={slot.team} size="sm" /> : <span className="h-5 w-5 shrink-0 rounded-full bg-card" />}
      <span className={`min-w-0 flex-1 truncate text-xs ${win ? "font-bold text-text" : "font-medium text-text-muted"}`}>
        {slot.team?.name ?? slot.name}
      </span>
      {slot.score != null && (
        <span className={`shrink-0 font-cond text-xs tabular-nums ${win ? "font-bold text-text" : "text-text-muted"}`}>
          {slot.score.toFixed(1)}
        </span>
      )}
    </div>
  );
}
