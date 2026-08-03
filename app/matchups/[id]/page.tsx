import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchups, getRoster, getStandings, getWeekKickoff } from "@/lib/sleeper";
import { Card, TeamAvatar, Score, EmptyState, Hexagon, Pill } from "@/components/ui";
import { SleeperPlayerAvatar } from "@/components/sleeper-player-avatar";
import { MatchupTabs } from "@/components/matchup-tabs";
import { MatchupCountdown } from "@/components/matchup-countdown";
import { proTeamLogoUrl } from "@/lib/player-images";
import { getHeadToHead, shortWeek } from "@/lib/games";
import type { MatchupSide, Roster, RosterEntry, RosterSlot, Standing, TeamMeta } from "@/lib/types";

export const revalidate = 60;

export default async function MatchupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const week = Number(id.split("-")[0]);
  if (!week) notFound();

  const matchups = await getMatchups(week);
  const matchup = matchups.find((m) => m.id === id);
  if (!matchup) notFound();

  const [awayRoster, homeRoster, kickoff] = await Promise.all([
    matchup.away.rosterId != null ? getRoster(matchup.away.rosterId, week) : null,
    matchup.home.rosterId != null ? getRoster(matchup.home.rosterId, week) : null,
    getWeekKickoff(week),
  ]);

  const statusLabel = matchup.status === "final" ? "Final" : matchup.status === "live" ? "Live" : "";
  const awayProj = projectedTotal(awayRoster);
  const homeProj = projectedTotal(homeRoster);

  const starterRows = pairSlots(awayRoster?.starters, homeRoster?.starters);
  const benchRows = pairSlots(awayRoster?.bench, homeRoster?.bench);
  const irRows = pairSlots(awayRoster?.ir, homeRoster?.ir);
  const hasLineup = starterRows.length > 0 || benchRows.length > 0;

  const awayId = matchup.away.team.id;
  const homeId = matchup.home.team.id;
  const [h2h, standings] = await Promise.all([
    getHeadToHead(awayId, homeId),
    getStandings(),
  ]);
  const awayStanding = standings.find((standing) => standing.team.id === awayId);
  const homeStanding = standings.find((standing) => standing.team.id === homeId);

  const teamsPanel = hasLineup ? (
    <>
      <SlotSection title="Starters" rows={starterRows} status={statusLabel} />
      <SlotSection title="Bench" rows={benchRows} status={statusLabel} muted />
      <SlotSection title="Injured Reserve" rows={irRows} status={statusLabel} muted />
    </>
  ) : (
    <div className="mt-3">
      <EmptyState>No lineups are set for this matchup yet.</EmptyState>
    </div>
  );

  const previewPanel = (
    <MatchupPreview
      away={matchup.away.team}
      home={matchup.home.team}
      awaySide={matchup.away}
      homeSide={matchup.home}
      awayRoster={awayRoster}
      homeRoster={homeRoster}
      awayProjected={awayProj}
      homeProjected={homeProj}
      awayStanding={awayStanding}
      homeStanding={homeStanding}
      week={week}
      status={matchup.status}
      kickoff={kickoff}
      h2h={h2h}
    />
  );

  // Scores drive the leader once they exist; before kickoff the projections do.
  const hasScores = matchup.away.score > 0 || matchup.home.score > 0;
  const awayValue = hasScores ? matchup.away.score : awayProj;
  const homeValue = hasScores ? matchup.home.score : homeProj;
  const awayRecord = matchup.away.record ?? standingRecord(awayStanding);
  const homeRecord = matchup.home.record ?? standingRecord(homeStanding);

  return (
    <div>
      <div className="-mx-3 bg-card px-4 pb-4 pt-4 shadow-sm">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <HeaderAvatar side={matchup.away} rank={awayStanding?.rank} />

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3">
            <HeaderScore value={matchup.away.score} leading={awayValue >= homeValue} align="right" />
            <span className="h-9 w-px bg-border" />
            <HeaderScore value={matchup.home.score} leading={homeValue >= awayValue} align="left" />

            <div className="text-right font-cond text-base tabular-nums text-text-muted">
              {awayProj > 0 ? awayProj.toFixed(2) : ""}
            </div>
            <span className="font-cond text-sm font-bold uppercase tracking-wide text-text-dim">vs</span>
            <div className="text-left font-cond text-base tabular-nums text-text-muted">
              {homeProj > 0 ? homeProj.toFixed(2) : ""}
            </div>
          </div>

          <HeaderAvatar side={matchup.home} rank={homeStanding?.rank} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="min-w-0 text-left">
            <div className="truncate font-cond text-xl font-bold leading-tight sm:text-2xl">{matchup.away.team.name}</div>
            <div className="truncate font-cond text-sm text-text-muted">
              {matchup.away.team.manager}
              {awayRecord ? ` | ${formatRecord(awayRecord)}` : ""}
            </div>
          </div>
          <div className="min-w-0 text-right">
            <div className="truncate font-cond text-xl font-bold leading-tight sm:text-2xl">{matchup.home.team.name}</div>
            <div className="truncate font-cond text-sm text-text-muted">
              {homeRecord ? `${formatRecord(homeRecord)} | ` : ""}
              {matchup.home.team.manager}
            </div>
          </div>
        </div>
      </div>

      <MatchupTabs teams={teamsPanel} preview={previewPanel} />
    </div>
  );
}

// --- Preview tab -------------------------------------------------------------

function MatchupPreview({
  away,
  home,
  awaySide,
  homeSide,
  awayRoster,
  homeRoster,
  awayProjected,
  homeProjected,
  awayStanding,
  homeStanding,
  week,
  status,
  kickoff,
  h2h,
}: {
  away: TeamMeta;
  home: TeamMeta;
  awaySide: MatchupSide;
  homeSide: MatchupSide;
  awayRoster: Roster | null;
  homeRoster: Roster | null;
  awayProjected: number;
  homeProjected: number;
  awayStanding?: Standing;
  homeStanding?: Standing;
  week: number;
  status: "upcoming" | "live" | "final";
  kickoff: Awaited<ReturnType<typeof getWeekKickoff>>;
  h2h: Awaited<ReturnType<typeof getHeadToHead>>;
}) {
  return (
    <div className="mt-3 space-y-3">
      {kickoff ? <MatchupCountdown kickoffIso={kickoff.iso} week={kickoff.week} /> : null}
      <CurrentMatchupCard
        away={away}
        home={home}
        awaySide={awaySide}
        homeSide={homeSide}
        awayRoster={awayRoster}
        homeRoster={homeRoster}
        awayProjected={awayProjected}
        homeProjected={homeProjected}
        awayStanding={awayStanding}
        homeStanding={homeStanding}
        week={week}
        status={status}
      />
      <SeriesCard away={away} home={home} h2h={h2h} />
      <PlayersToWatch away={away} home={home} awayRoster={awayRoster} homeRoster={homeRoster} />
    </div>
  );
}

function CurrentMatchupCard({
  away,
  home,
  awaySide,
  homeSide,
  awayRoster,
  homeRoster,
  awayProjected,
  homeProjected,
  awayStanding,
  homeStanding,
  week,
  status,
}: {
  away: TeamMeta;
  home: TeamMeta;
  awaySide: MatchupSide;
  homeSide: MatchupSide;
  awayRoster: Roster | null;
  homeRoster: Roster | null;
  awayProjected: number;
  homeProjected: number;
  awayStanding?: Standing;
  homeStanding?: Standing;
  week: number;
  status: "upcoming" | "live" | "final";
}) {
  const showScore = status !== "upcoming" && (awaySide.score > 0 || homeSide.score > 0);
  const awayValue = showScore ? awaySide.score : awayProjected;
  const homeValue = showScore ? homeSide.score : homeProjected;
  const hasValue = awayValue > 0 || homeValue > 0;
  const leader =
    hasValue && awayValue !== homeValue
      ? awayValue > homeValue
        ? away
        : home
      : null;
  const edge = hasValue ? Math.abs(awayValue - homeValue) : 0;
  const awayRecord = awaySide.record ?? standingRecord(awayStanding);
  const homeRecord = homeSide.record ?? standingRecord(homeStanding);
  const awayLineup = lineupSummary(awayRoster);
  const homeLineup = lineupSummary(homeRoster);
  const awayInjuries = injuryCount(awayRoster);
  const homeInjuries = injuryCount(homeRoster);

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <TeamMini team={away} standing={awayStanding} record={awayRecord} align="left" />
        <div className="shrink-0 text-center">
          <Pill tone={status === "live" ? "live" : status === "final" ? "default" : "gold"}>{statusLabel(status)}</Pill>
          <div className="mt-1 font-cond text-[11px] font-bold uppercase tracking-wide text-text-dim">Week {week}</div>
        </div>
        <TeamMini team={home} standing={homeStanding} record={homeRecord} align="right" />
      </div>

      <div className="rounded-lg bg-section px-3 py-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <ValueBlock value={awayValue} hasValue={hasValue} leading={!!leader && leader.id === away.id} align="right" />
          <div className="text-center">
            <div className="font-cond text-[11px] font-bold uppercase tracking-wide text-text-dim">
              {showScore ? "Score" : "Projected"}
            </div>
            <div className="mt-1 h-px w-10 bg-border" />
          </div>
          <ValueBlock value={homeValue} hasValue={hasValue} leading={!!leader && leader.id === home.id} align="left" />
        </div>
        <div className="mt-2 text-center font-cond text-sm font-semibold text-text-muted">
          {leader ? `${leader.abbrev} by ${edge.toFixed(1)}` : hasValue ? "Even matchup" : "Lineup data pending"}
        </div>
      </div>

      <div className="mt-3">
        <PreviewMetricRow label="Record" away={formatRecord(awayRecord)} home={formatRecord(homeRecord)} />
        <PreviewMetricRow
          label="Rank"
          away={awayStanding ? `#${awayStanding.rank}` : "-"}
          home={homeStanding ? `#${homeStanding.rank}` : "-"}
          awayBetter={rankBetter(awayStanding, homeStanding)}
          homeBetter={rankBetter(homeStanding, awayStanding)}
        />
        <PreviewMetricRow
          label="PF"
          away={awayStanding ? awayStanding.pointsFor.toFixed(1) : "-"}
          home={homeStanding ? homeStanding.pointsFor.toFixed(1) : "-"}
          awayBetter={pointsBetter(awayStanding, homeStanding)}
          homeBetter={pointsBetter(homeStanding, awayStanding)}
        />
        <PreviewMetricRow
          label="Lineup"
          away={awayLineup}
          home={homeLineup}
          awayBetter={lineupFilled(awayRoster) > lineupFilled(homeRoster)}
          homeBetter={lineupFilled(homeRoster) > lineupFilled(awayRoster)}
        />
        <PreviewMetricRow
          label="Injuries"
          away={awayInjuries == null ? "-" : `${awayInjuries}`}
          home={homeInjuries == null ? "-" : `${homeInjuries}`}
          awayBetter={awayInjuries != null && homeInjuries != null && awayInjuries < homeInjuries}
          homeBetter={awayInjuries != null && homeInjuries != null && homeInjuries < awayInjuries}
        />
      </div>
    </Card>
  );
}

function SeriesCard({
  away,
  home,
  h2h,
}: {
  away: TeamMeta;
  home: TeamMeta;
  h2h: Awaited<ReturnType<typeof getHeadToHead>>;
}) {
  const lastMeeting = h2h.meetings[0];
  const totalGames = h2h.meetings.length;
  const awayShare = totalGames ? Math.max(8, (h2h.aWins / totalGames) * 100) : 50;
  const homeShare = totalGames ? Math.max(8, (h2h.bWins / totalGames) * 100) : 50;
  const tieShare = totalGames && h2h.ties ? Math.max(6, (h2h.ties / totalGames) * 100) : 0;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <TeamAvatar team={away} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-cond text-sm font-semibold">{away.abbrev}</div>
            <div className="score text-2xl leading-none text-text">{h2h.aWins}</div>
          </div>
        </div>
        <div className="text-center">
          <div className="font-cond text-sm font-bold uppercase tracking-wide text-text-muted">All-Time H2H</div>
          <div className="font-cond text-xs text-text-dim">
            {totalGames} {totalGames === 1 ? "game" : "games"}
            {h2h.ties ? `, ${h2h.ties} tie${h2h.ties > 1 ? "s" : ""}` : ""}
          </div>
        </div>
        <div className="flex min-w-0 flex-row-reverse items-center gap-2 text-right">
          <TeamAvatar team={home} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-cond text-sm font-semibold">{home.abbrev}</div>
            <div className="score text-2xl leading-none text-text">{h2h.bWins}</div>
          </div>
        </div>
      </div>

      <div className="flex h-2 overflow-hidden rounded-full bg-section">
        <span style={{ width: `${awayShare}%`, background: away.primary }} />
        <span className="bg-border" style={{ width: `${tieShare}%` }} />
        <span style={{ width: `${homeShare}%`, background: home.primary }} />
      </div>

      <div className="mt-3 border-t border-border pt-2 text-center text-xs text-text-muted">
        {lastMeeting ? (
          <>
            Last met {lastMeeting.season} {shortWeek(lastMeeting.week)} -{" "}
            <Link href={`/games/${lastMeeting.gameId}`} className="font-semibold text-text hover:text-teal">
              {away.abbrev} {lastMeeting.aScore.toFixed(1)}-{lastMeeting.bScore.toFixed(1)} {home.abbrev}
            </Link>
          </>
        ) : (
          "First-ever meeting."
        )}
      </div>
    </Card>
  );
}

function PlayersToWatch({
  away,
  home,
  awayRoster,
  homeRoster,
}: {
  away: TeamMeta;
  home: TeamMeta;
  awayRoster: Roster | null;
  homeRoster: Roster | null;
}) {
  const awayPlayers = topProjectedStarters(awayRoster);
  const homePlayers = topProjectedStarters(homeRoster);

  return (
    <Card className="p-4">
      <div className="mb-3 text-center font-cond text-sm font-semibold uppercase tracking-wide text-text-muted">
        Starter Watch
      </div>
      <div className="grid grid-cols-2 gap-3">
        <WatchColumn team={away} players={awayPlayers} align="left" />
        <WatchColumn team={home} players={homePlayers} align="right" />
      </div>
    </Card>
  );
}

function TeamMini({
  team,
  standing,
  record,
  align,
}: {
  team: TeamMeta;
  standing?: Standing;
  record?: MatchupSide["record"];
  align: "left" | "right";
}) {
  const right = align === "right";
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${right ? "flex-row-reverse text-right" : ""}`}>
      <TeamAvatar team={team} size="sm" />
      <div className="min-w-0">
        <div className="truncate font-cond text-sm font-semibold leading-tight">{team.name}</div>
        <div className="truncate text-xs text-text-muted">
          {formatRecord(record)}
          {standing ? ` | #${standing.rank}` : ""}
        </div>
      </div>
    </div>
  );
}

function ValueBlock({
  value,
  hasValue,
  leading,
  align,
}: {
  value: number;
  hasValue: boolean;
  leading: boolean;
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      {hasValue ? (
        <Score value={value} className={`text-3xl ${leading ? "text-teal" : ""}`} dim={!leading} />
      ) : (
        <span className="score text-3xl text-text-dim">-</span>
      )}
    </div>
  );
}

function PreviewMetricRow({
  label,
  away,
  home,
  awayBetter = false,
  homeBetter = false,
}: {
  label: string;
  away: string;
  home: string;
  awayBetter?: boolean;
  homeBetter?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-border py-1.5">
      <div className={`text-left font-cond text-base tabular-nums ${awayBetter ? "font-bold text-text" : "text-text-muted"}`}>{away}</div>
      <div className="text-center font-cond text-[11px] uppercase tracking-wide text-text-dim">{label}</div>
      <div className={`text-right font-cond text-base tabular-nums ${homeBetter ? "font-bold text-text" : "text-text-muted"}`}>{home}</div>
    </div>
  );
}

function WatchColumn({
  team,
  players,
  align,
}: {
  team: TeamMeta;
  players: RosterEntry[];
  align: "left" | "right";
}) {
  const right = align === "right";
  return (
    <div className={right ? "text-right" : "text-left"}>
      <div className={`mb-2 flex items-center gap-1.5 ${right ? "flex-row-reverse" : ""}`}>
        <TeamAvatar team={team} size="sm" />
        <span className="truncate font-cond text-sm font-semibold">{team.abbrev}</span>
      </div>
      {players.length ? (
        <div className="space-y-2">
          {players.map((entry) => (
            <WatchPlayer key={`${entry.slot}-${entry.playerId}`} entry={entry} align={align} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-section px-3 py-4 text-xs text-text-dim">Lineup pending.</div>
      )}
    </div>
  );
}

function WatchPlayer({ entry, align }: { entry: RosterEntry; align: "left" | "right" }) {
  const right = align === "right";
  const content = (
    <div className={`flex items-center gap-2 rounded-lg bg-section px-2 py-2 ${right ? "flex-row-reverse" : ""}`}>
      <SleeperPlayerAvatar sleeperId={entry.sleeperId ?? ""} pos={entry.position} name={entry.name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className={`truncate font-cond text-sm font-semibold leading-tight ${right ? "text-right" : ""}`}>{entry.name}</div>
        <div className={`truncate font-cond text-[11px] text-text-muted ${right ? "text-right" : ""}`}>
          {entry.position}
          {entry.proTeam ? ` | ${entry.proTeam}` : ""}
          {entry.injuryStatus ? ` | ${entry.injuryStatus}` : ""}
        </div>
      </div>
      <div className={`shrink-0 font-cond text-base font-bold tabular-nums ${entry.injuryStatus ? "text-down" : "text-text"}`}>
        {entry.projected != null ? entry.projected.toFixed(1) : "-"}
      </div>
    </div>
  );

  if (!entry.sleeperId) return content;

  return (
    <Link href={`/players/${encodeURIComponent(entry.sleeperId)}?season=2026`} className="block hover:opacity-85">
      {content}
    </Link>
  );
}

function standingRecord(standing?: Standing): MatchupSide["record"] | undefined {
  if (!standing) return undefined;
  return { wins: standing.wins, losses: standing.losses, ties: standing.ties };
}

function statusLabel(status: "upcoming" | "live" | "final"): string {
  if (status === "live") return "Live";
  if (status === "final") return "Final";
  return "Upcoming";
}

function formatRecord(record?: MatchupSide["record"]): string {
  if (!record) return "-";
  return `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ""}`;
}

function rankBetter(a?: Standing, b?: Standing): boolean {
  return !!a && !!b && a.rank < b.rank;
}

function pointsBetter(a?: Standing, b?: Standing): boolean {
  return !!a && !!b && a.pointsFor > b.pointsFor;
}

function lineupFilled(roster: Roster | null): number {
  return roster?.starters.filter((slot) => Boolean(slot.entry)).length ?? 0;
}

function lineupSummary(roster: Roster | null): string {
  if (!roster?.starters.length) return "-";
  return `${lineupFilled(roster)}/${roster.starters.length}`;
}

function injuryCount(roster: Roster | null): number | null {
  if (!roster) return null;
  return roster.entries.filter((entry) => Boolean(entry.injuryStatus)).length;
}

function topProjectedStarters(roster: Roster | null): RosterEntry[] {
  if (!roster) return [];
  return roster.starters
    .map((slot) => slot.entry)
    .filter((entry): entry is RosterEntry => Boolean(entry))
    .sort((a, b) => (b.projected ?? 0) - (a.projected ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 3);
}

interface SlotPair {
  label: string;
  away?: RosterEntry;
  home?: RosterEntry;
}

function pairSlots(away?: RosterSlot[], home?: RosterSlot[]): SlotPair[] {
  const length = Math.max(away?.length ?? 0, home?.length ?? 0);
  return Array.from({ length }, (_, i) => ({
    label: away?.[i]?.label ?? home?.[i]?.label ?? "",
    away: away?.[i]?.entry,
    home: home?.[i]?.entry,
  }));
}

function SlotSection({
  title,
  rows,
  status,
  muted = false,
}: {
  title: string;
  rows: SlotPair[];
  status: string;
  muted?: boolean;
}) {
  if (!rows.length) return null;
  return (
    <>
      <div className="-mx-3 mt-3 bg-section px-4 py-3">
        <h2 className="font-cond text-xl font-semibold uppercase tracking-[0.12em] text-text-muted">{title}</h2>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {rows.map((row, i) => (
          <Fragment key={i}>
            {row.away ? (
              <StarterCell entry={row.away} align="left" status={status} muted={muted} />
            ) : (
              <EmptyCell slot={row.label} align="left" muted={muted} />
            )}
            {row.home ? (
              <StarterCell entry={row.home} align="right" status={status} muted={muted} />
            ) : (
              <EmptyCell slot={row.label} align="right" muted={muted} />
            )}
          </Fragment>
        ))}
      </div>
    </>
  );
}

function injuryBadge(status?: string): { label: string; color: string } | null {
  switch (status) {
    case "Questionable":
      return { label: "Q", color: "#f5b400" };
    case "Doubtful":
      return { label: "D", color: "#f08a24" };
    case "Out":
      return { label: "O", color: "#e0322b" };
    case "IR":
    case "PUP":
    case "NA":
      return { label: "IA", color: "#f08a24" };
    case "Sus":
      return { label: "SUS", color: "#e0322b" };
    default:
      return null;
  }
}

function projectedTotal(roster: Roster | null): number {
  if (!roster) return 0;
  const sum = roster.starters.reduce((acc, s) => acc + (s.entry?.projected ?? 0), 0);
  return Math.round(sum * 100) / 100;
}

function HeaderAvatar({ side, rank }: { side: MatchupSide; rank?: number }) {
  return (
    <div className="relative shrink-0">
      <TeamAvatar team={side.team} size="lg" />
      {rank ? (
        <span className="absolute -left-1 -top-1">
          <Hexagon value={rank} tone="teal" size="sm" />
        </span>
      ) : null}
    </div>
  );
}

function HeaderScore({ value, leading, align }: { value: number; leading: boolean; align: "left" | "right" }) {
  const [whole, dec] = value.toFixed(2).split(".");
  return (
    <div className={align === "left" ? "text-left" : "text-right"}>
      <span className={`score text-4xl ${leading ? "text-text" : "text-text-muted"}`}>
        {value > 0 ? (
          <>
            {whole}
            <span className="score-dec">.{dec}</span>
          </>
        ) : (
          "—"
        )}
      </span>
    </div>
  );
}

/** Every lineup cell is the same box, filled or not, so rows never collapse. */
const CELL_BOX = "flex h-full min-h-[140px] flex-col sm:min-h-[148px]";

function EmptyCell({ slot, align, muted = false }: { slot: string; align: "left" | "right"; muted?: boolean }) {
  const left = align === "left";
  return (
    <Card className={`${CELL_BOX} justify-center px-3 py-2.5 ${muted ? "bg-section" : ""}`}>
      <div className={`flex w-full items-center gap-2 ${left ? "" : "flex-row-reverse"}`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card font-cond text-[10px] font-bold text-text-dim">
          {slot}
        </span>
        <span className="text-sm font-medium text-text-dim">Empty</span>
      </div>
    </Card>
  );
}

function StarterCell({
  entry,
  align,
  status,
  muted = false,
}: {
  entry: RosterEntry;
  align: "left" | "right";
  status: string;
  muted?: boolean;
}) {
  const left = align === "left";
  const showLogo = entry.position !== "DEF";
  const logo = showLogo ? proTeamLogoUrl(entry.proTeam) : undefined;
  const when = entry.gameStarted ? status || "Final" : entry.gameWhen ?? "";

  const badge = injuryBadge(entry.injuryStatus);

  const head = (
    <div className={`flex items-center gap-1.5 ${left ? "" : "flex-row-reverse"}`}>
      <div className="relative shrink-0">
        <SleeperPlayerAvatar sleeperId={entry.sleeperId ?? ""} pos={entry.position} name={entry.name} size="lg" />
        {badge && (
          <span
            className="absolute -bottom-1 left-0 grid h-4 w-4 place-items-center rounded-full text-[8px] font-bold text-black sm:h-5 sm:w-5 sm:text-[10px]"
            style={{ background: badge.color }}
          >
            {badge.label}
          </span>
        )}
      </div>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={entry.proTeam}
          className="h-8 w-8 shrink-0 rounded-full bg-section object-contain p-1 sm:h-11 sm:w-11"
        />
      )}
    </div>
  );

  const score = (
    <div className={left ? "text-right" : "text-left"}>
      {entry.gameStarted ? (
        <Score value={entry.points} className="text-2xl sm:text-3xl" />
      ) : (
        <span className="score text-2xl text-text sm:text-3xl">—</span>
      )}
      {entry.projected !== undefined && (
        <div className="font-cond text-sm italic text-text-muted sm:text-base">{entry.projected.toFixed(2)}</div>
      )}
    </div>
  );

  const content = (
    <Card className={`${CELL_BOX} ${muted ? "bg-section" : ""}`}>
      <div className="px-3 pb-2.5 pt-3">
        <div className={`flex items-center ${left ? "" : "flex-row-reverse"}`}>
          {head}
          <div className={`flex-1 ${left ? "pl-2" : "pr-2"}`}>{score}</div>
        </div>

        <div className={`mt-2 truncate text-base font-semibold sm:text-lg ${left ? "text-left" : "text-right"}`}>
          {left ? (
            <>
              {entry.name} <span className="text-sm font-normal text-text-muted">{entry.position}</span>
            </>
          ) : (
            <>
              <span className="text-sm font-normal text-text-muted">{entry.position}</span> {entry.name}
            </>
          )}
        </div>
      </div>

      <div
        className={`mt-auto flex items-center justify-between gap-2 px-3 py-2 text-[11px] ${
          muted ? "bg-row" : "bg-section"
        } ${left ? "" : "flex-row-reverse"}`}
      >
        <span className="truncate text-text-muted">{entry.gameLabel ?? entry.proTeam ?? "—"}</span>
        {when && <span className="shrink-0 font-semibold text-text">{when}</span>}
      </div>
    </Card>
  );

  if (!entry.sleeperId) return content;

  return (
    <Link href={`/players/${encodeURIComponent(entry.sleeperId)}?season=2026`} className="block h-full">
      {content}
    </Link>
  );
}
