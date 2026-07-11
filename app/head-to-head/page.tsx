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

  // Series extras (from data already computed in getHeadToHead).
  const n = h2h.meetings.length;
  const avgA = n ? h2h.aPoints / n : 0;
  const avgB = n ? h2h.bPoints / n : 0;

  // Current streak: walk meetings newest-first until the winner changes.
  let streak: { winner: "a" | "b"; len: number } | null = null;
  for (const m of h2h.meetings) {
    if (m.winner === "tie") break;
    if (!streak) streak = { winner: m.winner, len: 1 };
    else if (streak.winner === m.winner) streak.len += 1;
    else break;
  }
  const streakTeam = streak ? (streak.winner === "a" ? teamA : teamB) : null;

  // Biggest single win in the series, either side.
  const bigCandidates = [
    h2h.biggestA && { team: teamA, margin: h2h.biggestA.aScore - h2h.biggestA.bScore, m: h2h.biggestA },
    h2h.biggestB && { team: teamB, margin: h2h.biggestB.bScore - h2h.biggestB.aScore, m: h2h.biggestB },
  ].filter(Boolean) as { team: TeamMeta; margin: number; m: H2HMeeting }[];
  const biggest = bigCandidates.sort((x, y) => y.margin - x.margin)[0];

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
          <div className="flex min-w-0 flex-col items-center text-center">
            <TeamAvatar team={teamA} size="lg" />
            <div className="mt-1 max-w-full truncate font-cond text-base font-semibold" style={{ color: teamA.primary }}>
              {teamA.name}
            </div>
          </div>
          <div className="text-center font-cond text-xs uppercase tracking-widest text-text-muted">vs</div>
          <div className="flex min-w-0 flex-col items-center text-center">
            <TeamAvatar team={teamB} size="lg" />
            <div className="mt-1 max-w-full truncate font-cond text-base font-semibold" style={{ color: teamB.primary }}>
              {teamB.name}
            </div>
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
            <div className="bg-gradient-to-b from-white to-section/70 px-4 pb-4 pt-4">
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

              <WinShareBar a={h2h.aWins} b={h2h.bWins} ties={h2h.ties} colorA={teamA.primary} colorB={teamB.primary} />
            </div>

            <div className="grid grid-cols-3 divide-x divide-border border-y border-border bg-card">
              <Fact label="Avg / game" value={`${avgA.toFixed(0)}–${avgB.toFixed(0)}`} />
              <Fact
                label="Streak"
                value={streakTeam ? `${streakTeam.abbrev} W${streak!.len}` : "—"}
                color={streakTeam?.primary}
              />
              <Fact
                label="Biggest win"
                value={biggest ? `${biggest.team.abbrev} +${biggest.margin.toFixed(1)}` : "—"}
                sub={biggest ? `${biggest.m.season} ${shortWeek(biggest.m.week)}` : undefined}
                color={biggest?.team.primary}
              />
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
            <div key={yr} className={`flex items-center gap-2 px-3 py-2 ${i % 2 ? "bg-card" : "bg-row"}`}>
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
        <div className="font-cond text-4xl font-bold leading-none tabular-nums" style={{ color: team.primary }}>
          {wins}
        </div>
        <div className="truncate font-cond text-xs font-semibold uppercase tracking-wide text-text-muted">{team.abbrev}</div>
      </div>
      {align === "right" && <TeamAvatar team={team} size="sm" />}
    </div>
  );
}

/** Slim two-tone bar showing each team's share of the series wins. */
function WinShareBar({ a, b, ties, colorA, colorB }: { a: number; b: number; ties: number; colorA: string; colorB: string }) {
  const total = a + b + ties || 1;
  const pct = (v: number) => `${(v / total) * 100}%`;
  return (
    <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-section ring-1 ring-border/60">
      <div style={{ width: pct(a), background: colorA }} />
      {ties ? <div style={{ width: pct(ties) }} className="bg-text-dim/40" /> : null}
      <div style={{ width: pct(b), background: colorB }} />
    </div>
  );
}

function Fact({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="px-2 py-2.5 text-center">
      <div className="font-cond text-[10px] uppercase tracking-wide text-text-dim">{label}</div>
      <div className="font-cond text-base font-bold leading-tight tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub ? <div className="text-[10px] text-text-muted">{sub}</div> : null}
    </div>
  );
}

function contrastText(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const bl = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * bl) / 255;
  return luminance > 0.6 ? "#000000" : "#ffffff";
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
          {winner ? (
            <span
              className="inline-flex items-center rounded px-2 py-0.5 font-cond text-xs font-bold uppercase tracking-wide"
              style={{ backgroundColor: winner.primary, color: contrastText(winner.primary) }}
            >
              {winner.abbrev}
            </span>
          ) : (
            <Pill tone="default">TIE</Pill>
          )}
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

function FinishCell({ row }: { row?: { regularRank: number; teamCount: number; wins: number; losses: number; champion: boolean } }) {
  if (!row) return <span className="flex-1 text-center text-sm text-text-dim">—</span>;
  return (
    <span className="flex flex-1 items-center justify-center gap-2">
      <Hexagon value={row.regularRank} tone={rankBadgeTone(row.regularRank)} size="sm" />
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
        className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium outline-none focus:border-teal"
      >
        {TEAMS.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
    </label>
  );
}
