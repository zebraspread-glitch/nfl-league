import Link from "next/link";
import { getAllTimeRecords, getFranchiseSeasons } from "@/lib/league-data";
import { getHeadToHead, shortWeek, type H2HMeeting } from "@/lib/games";
import { getTeam, TEAMS } from "@/lib/teams";
import { Card, SectionHeader, PageIntro, TeamAvatar, Hexagon, Pill, rankBadgeTone } from "@/components/ui";
import type { TeamMeta, AllTimeRecord } from "@/lib/types";

export const revalidate = 3600;

const blank = (team: TeamMeta): AllTimeRecord => ({
  team, seasons: 0, wins: 0, losses: 0, ties: 0, pct: 0, pointsFor: 0,
  pointsAgainst: 0, championships: 0, titleYears: [], runnerUps: 0, podiums: 0, bestFinish: 0,
});

export default async function HeadToHeadPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;
  const aId = Number(a) || TEAMS[0].id;
  let bId = Number(b) || TEAMS[1].id;
  if (bId === aId) bId = TEAMS.find((t) => t.id !== aId)!.id;

  const teamA = getTeam(aId)!;
  const teamB = getTeam(bId)!;
  const records = getAllTimeRecords();
  const recA = records.find((r) => r.team.id === aId) ?? blank(teamA);
  const recB = records.find((r) => r.team.id === bId) ?? blank(teamB);

  const seasonsA = getFranchiseSeasons(aId);
  const seasonsB = getFranchiseSeasons(bId);
  const years = [...new Set([...seasonsA, ...seasonsB].map((s) => s.season))].sort((x, y) => y - x);

  const h2h = await getHeadToHead(aId, bId);
  const aSeriesLead = h2h.aWins > h2h.bWins;

  return (
    <div className="space-y-3">
      <PageIntro title="Head to Head" subtitle="Compare two franchises across all seasons" />

      <Card className="p-3">
        <form method="GET" className="grid grid-cols-2 gap-2">
          <TeamSelect name="a" defaultValue={aId} label="Team A" />
          <TeamSelect name="b" defaultValue={bId} label="Team B" />
          <button
            type="submit"
            className="col-span-2 rounded-lg bg-teal py-2.5 font-cond text-base font-semibold uppercase tracking-wide text-white hover:bg-teal-dark"
          >
            Compare
          </button>
        </form>
      </Card>

      <Card className="px-3 py-4">
        <div className="grid grid-cols-3 items-center">
          <div className="flex flex-col items-center text-center">
            <TeamAvatar team={teamA} size="lg" />
            <div className="mt-1 truncate font-cond text-base font-semibold">{teamA.name}</div>
          </div>
          <div className="text-center font-cond text-xs uppercase tracking-widest text-text-muted">vs</div>
          <div className="flex flex-col items-center text-center">
            <TeamAvatar team={teamB} size="lg" />
            <div className="mt-1 truncate font-cond text-base font-semibold">{teamB.name}</div>
          </div>
        </div>

        <div className="mt-4 divide-y divide-border">
          <CompareRow label="Titles" a={recA.championships} b={recB.championships} />
          <CompareRow label="Best finish" a={recA.bestFinish} b={recB.bestFinish} lowerWins format={(v) => (v ? `#${v}` : "—")} />
          <CompareRow label="Seasons" a={recA.seasons} b={recB.seasons} neutral />
          <CompareRow label="All-time wins" a={recA.wins} b={recB.wins} />
          <CompareRow label="Win %" a={recA.pct} b={recB.pct} format={(v) => v.toFixed(3).replace(/^0/, "")} />
          <CompareRow label="Total points" a={recA.pointsFor} b={recB.pointsFor} format={(v) => v.toFixed(0)} />
        </div>
      </Card>

      {/* real head-to-head series */}
      <Card>
        <SectionHeader>Head-to-head series</SectionHeader>
        {h2h.meetings.length ? (
          <>
            <div className="bg-gradient-to-b from-white to-section/70 px-4 py-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <SeriesTeam team={teamA} wins={h2h.aWins} active={aSeriesLead || h2h.aWins === h2h.bWins} align="right" />
                <div className="text-center">
                  <div className="rounded-full bg-card px-3 py-1 font-cond text-xs font-semibold uppercase tracking-wide text-text-muted shadow-sm">
                    {h2h.meetings.length} {h2h.meetings.length === 1 ? "meeting" : "meetings"}
                  </div>
                  {h2h.ties ? <div className="mt-1 text-[11px] text-text-dim">{h2h.ties} tie</div> : null}
                </div>
                <SeriesTeam team={teamB} wins={h2h.bWins} active={!aSeriesLead || h2h.aWins === h2h.bWins} align="left" />
              </div>
            </div>

            <div className="space-y-2 bg-section px-2 py-2.5">
              {h2h.meetings.map((m) => (
                <SeriesMeeting key={m.gameId} meeting={m} teamA={teamA} teamB={teamB} />
              ))}
            </div>
          </>
        ) : (
          <div className="px-4 py-6 text-center text-sm text-text-muted">
            These franchises have never played each other.
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader>Season by season</SectionHeader>
        <div className="flex items-center gap-2 border-b border-border bg-section px-3 py-1.5 font-cond text-xs font-semibold uppercase tracking-wide text-text-muted">
          <span className="w-12">Year</span>
          <span className="flex-1 text-center">{teamA.abbrev}</span>
          <span className="flex-1 text-center">{teamB.abbrev}</span>
        </div>
        {years.map((yr, i) => {
          const ra = seasonsA.find((s) => s.season === yr);
          const rb = seasonsB.find((s) => s.season === yr);
          return (
            <div key={yr} className={`flex items-center gap-2 px-3 py-2 ${i % 2 ? "bg-card" : "bg-[#f7f8fa]"}`}>
              <span className="w-12 font-cond text-sm font-semibold text-text-muted">{yr}</span>
              <FinishCell row={ra} />
              <FinishCell row={rb} />
            </div>
          );
        })}
      </Card>

      <p className="px-1 text-xs text-text-muted">
        Series record is computed from every real meeting in the game logs. Career totals and season
        finishes cover each franchise&apos;s full history. Tap any meeting for its boxscore.
      </p>
    </div>
  );
}

function CompareRow({
  label,
  a,
  b,
  format = (v) => String(v),
  lowerWins = false,
  neutral = false,
}: {
  label: string;
  a: number;
  b: number;
  format?: (v: number) => string;
  lowerWins?: boolean;
  neutral?: boolean;
}) {
  const aWins = !neutral && (lowerWins ? a < b : a > b) && a !== b;
  const bWins = !neutral && (lowerWins ? b < a : b > a) && a !== b;
  return (
    <div className="grid grid-cols-3 items-center py-2 text-center">
      <span className={`font-cond text-lg tabular-nums ${aWins ? "font-bold text-text" : "text-text-muted"}`}>{format(a)}</span>
      <span className="font-cond text-[11px] uppercase tracking-wide text-text-dim">{label}</span>
      <span className={`font-cond text-lg tabular-nums ${bWins ? "font-bold text-text" : "text-text-muted"}`}>{format(b)}</span>
    </div>
  );
}

function SeriesTeam({
  team,
  wins,
  active,
  align,
}: {
  team: TeamMeta;
  wins: number;
  active: boolean;
  align: "left" | "right";
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === "right" ? "justify-end text-right" : "justify-start text-left"} ${active ? "" : "opacity-55"}`}>
      {align === "left" && <TeamAvatar team={team} size="sm" />}
      <div className="min-w-0">
        <div className="font-cond text-4xl font-bold leading-none tabular-nums">{wins}</div>
        <div className="truncate font-cond text-xs font-semibold uppercase tracking-wide text-text-muted">{team.abbrev}</div>
      </div>
      {align === "right" && <TeamAvatar team={team} size="sm" />}
    </div>
  );
}

function SeriesMeeting({ meeting, teamA, teamB }: { meeting: H2HMeeting; teamA: TeamMeta; teamB: TeamMeta }) {
  const aWin = meeting.winner === "a";
  const bWin = meeting.winner === "b";
  const winner = aWin ? teamA : bWin ? teamB : null;

  return (
    <Link
      href={`/games/${meeting.gameId}`}
      className="group block rounded-xl bg-card shadow-sm ring-1 ring-border/60 transition-all hover:shadow-md hover:ring-teal/40"
    >
      <div className="flex items-center justify-between px-3 pt-2">
        <span className="font-cond text-[11px] font-semibold uppercase tracking-wide text-text-dim">
          {meeting.season} - {shortWeek(meeting.week)}
        </span>
        <span className="text-text-dim opacity-0 transition-opacity group-hover:opacity-100">&gt;</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2.5">
        <SideScore team={teamA} score={meeting.aScore} win={aWin} align="right" />

        <div className="flex flex-col items-center gap-1 px-1">
          <Pill tone={meeting.winner === "tie" ? "default" : "win"}>{winner ? winner.abbrev : "TIE"}</Pill>
          <span className="text-[9px] uppercase tracking-wide text-text-dim">won</span>
        </div>

        <SideScore team={teamB} score={meeting.bScore} win={bWin} align="left" />
      </div>
    </Link>
  );
}

function SideScore({
  team,
  score,
  win,
  align,
}: {
  team: TeamMeta;
  score: number;
  win: boolean;
  align: "left" | "right";
}) {
  const content = (
    <div className="min-w-0">
      <div className={`truncate font-cond text-[11px] font-semibold uppercase tracking-wide ${win ? "text-text" : "text-text-dim"}`}>
        {team.abbrev}
      </div>
      <div className={`font-cond text-2xl tabular-nums leading-tight ${win ? "font-bold text-text" : "font-medium text-text-muted"}`}>
        {score.toFixed(1)}
      </div>
    </div>
  );

  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${
        align === "right" ? "flex-row-reverse justify-start text-right" : "justify-start text-left"
      } ${win ? "" : "opacity-70"}`}
    >
      <TeamAvatar team={team} size="sm" />
      {content}
    </div>
  );
}

function FinishCell({ row }: { row?: { finalRank: number; teamCount: number; wins: number; losses: number; champion: boolean } }) {
  if (!row) return <span className="flex-1 text-center text-sm text-text-dim">—</span>;
  return (
    <span className="flex flex-1 items-center justify-center gap-2">
      <Hexagon value={row.finalRank} tone={rankBadgeTone(row.finalRank)} size="sm" />
      <span className="font-cond text-sm tabular-nums text-text-muted">
        {row.wins}-{row.losses}
      </span>
    </span>
  );
}

function TeamSelect({ name, defaultValue, label }: { name: string; defaultValue: number; label: string }) {
  return (
    <label className="block">
      <span className="mb-1 block font-cond text-[11px] uppercase tracking-wide text-text-muted">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-teal"
      >
        {TEAMS.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
    </label>
  );
}
