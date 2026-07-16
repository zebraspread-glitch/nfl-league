import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchups, getRoster, getWeekKickoff } from "@/lib/sleeper";
import { Card, TeamAvatar, Score, SectionTitle, EmptyState } from "@/components/ui";
import { SleeperPlayerAvatar } from "@/components/sleeper-player-avatar";
import { MatchupTabs } from "@/components/matchup-tabs";
import { MatchupCountdown } from "@/components/matchup-countdown";
import { proTeamLogoUrl, resolvePlayerImage, POS_COLOR } from "@/lib/player-images";
import { getFranchiseGames, getHeadToHead, shortWeek, type FranchiseGame } from "@/lib/games";
import { getAllTimeRecords } from "@/lib/league-data";
import { getFranchiseTopPlayers, type FranchiseTopPlayer } from "@/lib/players";
import type { MatchupSide, Roster, RosterEntry, RosterSlot, TeamMeta } from "@/lib/types";

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
  const [h2h, awayGames, homeGames, awayTop, homeTop] = await Promise.all([
    getHeadToHead(awayId, homeId),
    getFranchiseGames(awayId),
    getFranchiseGames(homeId),
    getFranchiseTopPlayers(awayId, 5),
    getFranchiseTopPlayers(homeId, 5),
  ]);
  const allTime = getAllTimeRecords();
  const awaySnap = franchiseSnapshot(awayId, awayGames, allTime);
  const homeSnap = franchiseSnapshot(homeId, homeGames, allTime);

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
      kickoff={kickoff}
      h2h={h2h}
      awaySnap={awaySnap}
      homeSnap={homeSnap}
      awayForm={awayGames.slice(0, 5)}
      homeForm={homeGames.slice(0, 5)}
      awayTop={awayTop}
      homeTop={homeTop}
    />
  );

  return (
    <div>
      <div
        className="rounded-xl px-4 pb-4 pt-5 text-white"
        style={{ background: "linear-gradient(180deg, var(--teal) 0%, var(--teal-deep) 100%)" }}
      >
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <HeaderAvatar side={matchup.away} />

          <div className="flex items-stretch justify-center gap-3">
            <HeaderScore actual={matchup.away.score} projected={awayProj} leading={awayProj >= homeProj} align="right" />
            <div className="flex flex-col items-center justify-center gap-1">
              <span className="w-px flex-1 bg-white/20" />
              <span className="font-cond text-xs font-bold uppercase text-white/70">vs</span>
              <span className="w-px flex-1 bg-white/20" />
            </div>
            <HeaderScore actual={matchup.home.score} projected={homeProj} leading={homeProj > awayProj} align="left" />
          </div>

          <HeaderAvatar side={matchup.home} />
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="min-w-0 text-left">
            <div className="truncate font-cond text-lg font-semibold leading-tight">{matchup.away.team.name}</div>
            <div className="truncate text-xs text-white/80">
              {matchup.away.team.manager}
              {matchup.away.record ? ` | ${matchup.away.record.wins}-${matchup.away.record.losses}` : ""}
            </div>
          </div>
          <div className="min-w-0 text-right">
            <div className="truncate font-cond text-lg font-semibold leading-tight">{matchup.home.team.name}</div>
            <div className="truncate text-xs text-white/80">
              {matchup.home.record ? `${matchup.home.record.wins}-${matchup.home.record.losses} | ` : ""}
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

interface Snapshot {
  seasons: number;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  avgPF: number;
  championships: number;
  bestFinish: number;
}

function franchiseSnapshot(
  teamId: number,
  games: FranchiseGame[],
  allTime: ReturnType<typeof getAllTimeRecords>,
): Snapshot {
  const record = allTime.find((r) => r.team.id === teamId);
  const wins = games.filter((g) => g.result === "W").length;
  const losses = games.filter((g) => g.result === "L").length;
  const ties = games.filter((g) => g.result === "T").length;
  const played = games.length;
  const pf = games.reduce((sum, g) => sum + g.self.total, 0);
  return {
    seasons: record?.seasons ?? 0,
    wins,
    losses,
    ties,
    winPct: played ? Math.round((wins / played) * 1000) / 1000 : 0,
    avgPF: played ? Math.round((pf / played) * 10) / 10 : 0,
    championships: record?.championships ?? 0,
    bestFinish: record?.bestFinish ?? 0,
  };
}

function MatchupPreview({
  away,
  home,
  kickoff,
  h2h,
  awaySnap,
  homeSnap,
  awayForm,
  homeForm,
  awayTop,
  homeTop,
}: {
  away: TeamMeta;
  home: TeamMeta;
  kickoff: Awaited<ReturnType<typeof getWeekKickoff>>;
  h2h: Awaited<ReturnType<typeof getHeadToHead>>;
  awaySnap: Snapshot;
  homeSnap: Snapshot;
  awayForm: FranchiseGame[];
  homeForm: FranchiseGame[];
  awayTop: FranchiseTopPlayer[];
  homeTop: FranchiseTopPlayer[];
}) {
  const lastMeeting = h2h.meetings[0];
  const noHistory = awaySnap.seasons === 0 && homeSnap.seasons === 0;

  return (
    <div className="mt-3 space-y-3">
      {kickoff ? <MatchupCountdown kickoffIso={kickoff.iso} week={kickoff.week} /> : null}
      {noHistory ? (
        <EmptyState>No prior MGL history for these franchises yet — this is fresh ground.</EmptyState>
      ) : (
        <>
          <Card className="p-4">
            <div className="text-center font-cond text-sm font-semibold uppercase tracking-wide text-text-muted">
              All-Time Series
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="text-center">
                <div className="score text-3xl text-text">{h2h.aWins}</div>
                <div className="truncate font-cond text-xs text-text-muted">{away.abbrev}</div>
              </div>
              <div className="text-center font-cond text-xs font-bold text-text-dim">
                {h2h.meetings.length} {h2h.meetings.length === 1 ? "game" : "games"}
                {h2h.ties ? <div className="mt-0.5">{h2h.ties} tie{h2h.ties > 1 ? "s" : ""}</div> : null}
              </div>
              <div className="text-center">
                <div className="score text-3xl text-text">{h2h.bWins}</div>
                <div className="truncate font-cond text-xs text-text-muted">{home.abbrev}</div>
              </div>
            </div>
            {lastMeeting ? (
              <div className="mt-3 border-t border-border pt-2 text-center text-xs text-text-muted">
                Last met {lastMeeting.season} {shortWeek(lastMeeting.week)} —{" "}
                <span className="font-semibold text-text">
                  {away.abbrev} {lastMeeting.aScore.toFixed(1)}–{lastMeeting.bScore.toFixed(1)} {home.abbrev}
                </span>
              </div>
            ) : (
              <div className="mt-3 border-t border-border pt-2 text-center text-xs text-text-muted">
                First-ever meeting.
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <TeamAvatar team={away} size="sm" />
              <span className="font-cond text-xs font-bold uppercase text-text-dim">Compare</span>
              <div className="flex justify-end">
                <TeamAvatar team={home} size="sm" />
              </div>
            </div>
            <CompareRow label="Record" away={`${awaySnap.wins}-${awaySnap.losses}`} home={`${homeSnap.wins}-${homeSnap.losses}`} awayBetter={awaySnap.winPct > homeSnap.winPct} homeBetter={homeSnap.winPct > awaySnap.winPct} />
            <CompareRow label="Win %" away={pct(awaySnap.winPct)} home={pct(homeSnap.winPct)} awayBetter={awaySnap.winPct > homeSnap.winPct} homeBetter={homeSnap.winPct > awaySnap.winPct} />
            <CompareRow label="Avg PF" away={awaySnap.avgPF.toFixed(1)} home={homeSnap.avgPF.toFixed(1)} awayBetter={awaySnap.avgPF > homeSnap.avgPF} homeBetter={homeSnap.avgPF > awaySnap.avgPF} />
            <CompareRow label="Titles" away={`${awaySnap.championships}`} home={`${homeSnap.championships}`} awayBetter={awaySnap.championships > homeSnap.championships} homeBetter={homeSnap.championships > awaySnap.championships} />
            <CompareRow
              label="Best finish"
              away={awaySnap.bestFinish ? `#${awaySnap.bestFinish}` : "—"}
              home={homeSnap.bestFinish ? `#${homeSnap.bestFinish}` : "—"}
              awayBetter={!!awaySnap.bestFinish && (!homeSnap.bestFinish || awaySnap.bestFinish < homeSnap.bestFinish)}
              homeBetter={!!homeSnap.bestFinish && (!awaySnap.bestFinish || homeSnap.bestFinish < awaySnap.bestFinish)}
            />
          </Card>

          <Card className="p-4">
            <div className="mb-2 text-center font-cond text-sm font-semibold uppercase tracking-wide text-text-muted">
              Recent Form
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormColumn team={away} form={awayForm} align="left" />
              <FormColumn team={home} form={homeForm} align="right" />
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TopPlayers team={away} players={awayTop} />
            <TopPlayers team={home} players={homeTop} />
          </div>
        </>
      )}
    </div>
  );
}

function pct(value: number): string {
  return value.toFixed(3).replace(/^0/, "");
}

function CompareRow({
  label,
  away,
  home,
  awayBetter,
  homeBetter,
}: {
  label: string;
  away: string;
  home: string;
  awayBetter: boolean;
  homeBetter: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-border py-1.5">
      <div className={`text-left font-cond text-base tabular-nums ${awayBetter ? "font-bold text-text" : "text-text-muted"}`}>{away}</div>
      <div className="text-center font-cond text-[11px] uppercase tracking-wide text-text-dim">{label}</div>
      <div className={`text-right font-cond text-base tabular-nums ${homeBetter ? "font-bold text-text" : "text-text-muted"}`}>{home}</div>
    </div>
  );
}

function FormColumn({ team, form, align }: { team: TeamMeta; form: FranchiseGame[]; align: "left" | "right" }) {
  const ordered = [...form].reverse(); // oldest → newest, left to right
  const right = align === "right";
  return (
    <div className={right ? "text-right" : "text-left"}>
      <div className={`mb-1.5 flex items-center gap-1.5 ${right ? "flex-row-reverse" : ""}`}>
        <TeamAvatar team={team} size="sm" />
        <span className="truncate font-cond text-sm font-semibold">{team.abbrev}</span>
      </div>
      {ordered.length ? (
        <div className={`flex flex-wrap gap-1 ${right ? "justify-end" : ""}`}>
          {ordered.map((g) => {
            const tone = g.result === "W" ? "bg-up text-white" : g.result === "L" ? "bg-down text-white" : "bg-section text-text-muted";
            return (
              <span
                key={g.game.id}
                className={`grid h-6 w-6 place-items-center rounded font-cond text-xs font-bold ${tone}`}
                title={`${g.game.season} ${shortWeek(g.game.week)} vs ${g.opp.name}: ${g.self.total.toFixed(1)}–${g.opp.total.toFixed(1)}`}
              >
                {g.result}
              </span>
            );
          })}
        </div>
      ) : (
        <div className="text-xs text-text-dim">No games yet.</div>
      )}
    </div>
  );
}

function TopPlayers({ team, players }: { team: TeamMeta; players: FranchiseTopPlayer[] }) {
  return (
    <Card>
      <div className="flex items-center gap-2 bg-section px-3 py-2">
        <TeamAvatar team={team} size="sm" />
        <span className="truncate font-cond text-sm font-semibold uppercase tracking-wide">{team.abbrev} Legends</span>
      </div>
      {players.length ? (
        players.map((p, i) => {
          const img = resolvePlayerImage(p.playerId, p.pos, p.name);
          return (
            <Link
              key={p.playerId}
              href={`/players/${p.playerId}`}
              className={`flex items-center gap-2 px-3 py-2 ${i % 2 ? "bg-card" : "bg-row"} hover:bg-card-hover`}
            >
              <span className="w-4 text-right font-cond text-xs font-bold text-text-dim">{i + 1}</span>
              {img.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.imageUrl}
                  alt={p.name}
                  className={`h-8 w-8 shrink-0 rounded-full bg-section ${img.isLogo ? "object-contain p-0.5" : "object-cover"}`}
                  suppressHydrationWarning
                />
              ) : (
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full font-cond text-[10px] font-bold text-white" style={{ background: POS_COLOR[p.pos] ?? "#9aa1ad" }}>
                  {p.pos}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-cond text-sm font-semibold leading-tight">{p.name}</div>
                <div className="font-cond text-[11px] text-text-muted leading-tight">
                  {p.pos} · {p.games} G
                </div>
              </div>
              <span className="font-cond text-base font-bold tabular-nums">{p.points.toFixed(0)}</span>
            </Link>
          );
        })
      ) : (
        <div className="px-3 py-3 text-sm text-text-dim">No history yet.</div>
      )}
    </Card>
  );
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
      <div className="-mx-1 mt-3 bg-section px-1 pb-1 pt-3">
        <SectionTitle>{title}</SectionTitle>
      </div>
      <div className="grid grid-cols-2 gap-2">
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

function HeaderAvatar({ side }: { side: MatchupSide }) {
  return (
    <div className="relative shrink-0">
      <TeamAvatar team={side.team} size="lg" />
    </div>
  );
}

function HeaderScore({
  actual,
  projected,
  leading,
  align,
}: {
  actual: number;
  projected: number;
  leading: boolean;
  align: "left" | "right";
}) {
  const [whole, dec] = actual.toFixed(2).split(".");
  return (
    <div className={align === "left" ? "text-left" : "text-right"}>
      <span className="score text-3xl text-white">
        {actual > 0 ? (
          <>
            {whole}
            <span className="score-dec">.{dec}</span>
          </>
        ) : (
          "—"
        )}
      </span>
      {projected > 0 && (
        <div className="font-cond text-sm font-semibold italic tabular-nums" style={{ color: leading ? "#86efac" : "#fca5a5" }}>
          {projected.toFixed(2)}
        </div>
      )}
    </div>
  );
}

function EmptyCell({ slot, align, muted = false }: { slot: string; align: "left" | "right"; muted?: boolean }) {
  const left = align === "left";
  return (
    <Card className={`flex items-center px-3 py-2.5 ${muted ? "bg-section" : ""}`}>
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
        <SleeperPlayerAvatar sleeperId={entry.sleeperId ?? ""} pos={entry.position} name={entry.name} size="md" />
        {badge && (
          <span
            className="absolute left-1/2 grid h-3.5 w-3.5 place-items-center rounded-full text-[8px] font-bold text-black"
            style={{ background: badge.color, bottom: "-7px", marginLeft: "-7px" }}
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
          className="h-7 w-7 shrink-0 rounded-full object-contain p-0.5"
          style={{ background: "#b9bec6" }}
        />
      )}
    </div>
  );

  const score = (
    <div className={left ? "text-right" : "text-left"}>
      {entry.gameStarted ? (
        <Score value={entry.points} className="text-2xl" />
      ) : (
        <span className="score text-2xl text-text">—</span>
      )}
      {entry.projected !== undefined && (
        <div className="font-cond text-xs italic text-text-muted">{entry.projected.toFixed(2)}</div>
      )}
    </div>
  );

  const content = (
    <Card className={`px-3 py-2.5 ${muted ? "bg-section" : ""}`}>
      <div className={`flex items-center ${left ? "" : "flex-row-reverse"}`}>
        {head}
        <div className={`flex-1 ${left ? "pl-2" : "pr-2"}`}>{score}</div>
      </div>

      <div className={`mt-1.5 truncate text-sm font-semibold ${left ? "text-left" : "text-right"}`}>
        {left ? (
          <>
            {entry.name} <span className="font-normal text-text-muted">{entry.position}</span>
          </>
        ) : (
          <>
            <span className="font-normal text-text-muted">{entry.position}</span> {entry.name}
          </>
        )}
      </div>

      <div
        className={`mt-1.5 flex items-center justify-between gap-2 border-t border-border pt-1.5 text-[11px] ${
          left ? "" : "flex-row-reverse"
        }`}
      >
        <span className="truncate text-text-muted">{entry.gameLabel ?? entry.proTeam ?? "—"}</span>
        {when && <span className="shrink-0 font-semibold text-text">{when}</span>}
      </div>
    </Card>
  );

  if (!entry.sleeperId) return content;

  return (
    <Link href={`/players/${encodeURIComponent(entry.sleeperId)}?season=2026`} className="block">
      {content}
    </Link>
  );
}
