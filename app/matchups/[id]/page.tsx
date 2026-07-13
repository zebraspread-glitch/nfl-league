import { Fragment } from "react";
import { notFound } from "next/navigation";
import { getMatchups, getRoster } from "@/lib/sleeper";
import { Card, TeamAvatar, Score, SectionTitle, EmptyState } from "@/components/ui";
import { SleeperPlayerAvatar } from "@/components/sleeper-player-avatar";
import { proTeamLogoUrl } from "@/lib/player-images";
import type { MatchupSide, Roster, RosterEntry, RosterSlot } from "@/lib/types";

export const revalidate = 60;

export default async function MatchupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const week = Number(id.split("-")[0]);
  if (!week) notFound();

  const matchups = await getMatchups(week);
  const matchup = matchups.find((m) => m.id === id);
  if (!matchup) notFound();

  const [awayRoster, homeRoster] = await Promise.all([
    matchup.away.rosterId != null ? getRoster(matchup.away.rosterId, week) : null,
    matchup.home.rosterId != null ? getRoster(matchup.home.rosterId, week) : null,
  ]);

  const statusLabel = matchup.status === "final" ? "Final" : matchup.status === "live" ? "Live" : "";
  const awayProj = projectedTotal(awayRoster);
  const homeProj = projectedTotal(homeRoster);

  const starterRows = pairSlots(awayRoster?.starters, homeRoster?.starters);
  const benchRows = pairSlots(awayRoster?.bench, homeRoster?.bench);
  const irRows = pairSlots(awayRoster?.ir, homeRoster?.ir);
  const hasLineup = starterRows.length > 0 || benchRows.length > 0;

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

      {hasLineup ? (
        <>
          <SlotSection title="Starters" rows={starterRows} status={statusLabel} />
          <SlotSection title="Bench" rows={benchRows} status={statusLabel} muted />
          <SlotSection title="Injured Reserve" rows={irRows} status={statusLabel} muted />
        </>
      ) : (
        <div className="mt-3">
          <EmptyState>No lineups are set for this matchup yet.</EmptyState>
        </div>
      )}
    </div>
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

  return (
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
}
