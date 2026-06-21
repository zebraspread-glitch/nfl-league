import Link from "next/link";
import type { Matchup, MatchupSide } from "@/lib/types";
import { Card, Hexagon, TeamAvatar, Score, Pill, rankBadgeTone } from "./ui";

function AvatarWithRank({
  side,
  rank,
  align,
}: {
  side: MatchupSide;
  rank?: number;
  align: "left" | "right";
}) {
  return (
    <Link href={`/teams/${side.team.id}`} className="relative block shrink-0" suppressHydrationWarning>
      <TeamAvatar team={side.team} size="lg" />
      {rank ? (
        <span className={`absolute -top-1 ${align === "left" ? "-left-2" : "-right-2"}`}>
          <Hexagon value={rank} tone={rankBadgeTone(rank)} size="sm" />
        </span>
      ) : null}
    </Link>
  );
}

function ScoreBlock({ side, win, upcoming }: { side: MatchupSide; win: boolean; upcoming: boolean }) {
  return (
    <div className="leading-none">
      {upcoming ? (
        <span className="score text-text-dim">--</span>
      ) : (
        <Score value={side.score} className="text-3xl" dim={!win} />
      )}
      {side.projected !== undefined && (
        <div className="mt-1 font-cond text-sm text-text-muted">{side.projected.toFixed(2)}</div>
      )}
    </div>
  );
}

export function MatchupCard({
  matchup,
  title,
  rankOf,
}: {
  matchup: Matchup;
  title?: string;
  rankOf?: (teamId: number) => number | undefined;
}) {
  const { home, away, status } = matchup;
  const homeWin = status !== "upcoming" && home.score >= away.score;
  const awayWin = status !== "upcoming" && away.score >= home.score;

  return (
    <Card>
      <div className="flex items-center justify-between bg-section px-4 py-2">
        <span className="font-cond text-sm font-semibold uppercase tracking-wide text-text">
          {title ?? `Week ${matchup.week}`}
        </span>
        {status === "live" ? (
          <Pill tone="live">
            <span className="live-dot">●</span> Live
          </Pill>
        ) : status === "final" ? (
          <Pill>Final</Pill>
        ) : (
          <span className="font-cond text-xs uppercase text-text-muted">Upcoming</span>
        )}
      </div>

      <div className="px-4 py-4">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <AvatarWithRank side={away} rank={rankOf?.(away.team.id)} align="left" />

          <div className="flex items-center justify-center gap-4">
            <div className="text-right">
              <ScoreBlock side={away} win={awayWin} upcoming={status === "upcoming"} />
            </div>
            <div className="flex flex-col items-center gap-1 text-text-dim">
              <span className="h-3 w-px bg-border-strong" />
              <span className="font-cond text-xs font-bold">VS</span>
              <span className="h-3 w-px bg-border-strong" />
            </div>
            <div className="text-left">
              <ScoreBlock side={home} win={homeWin} upcoming={status === "upcoming"} />
            </div>
          </div>

          <AvatarWithRank side={home} rank={rankOf?.(home.team.id)} align="right" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <Link href={`/teams/${away.team.id}`} className="min-w-0 text-left" suppressHydrationWarning>
            <div className="truncate font-cond text-lg font-semibold leading-tight">{away.team.name}</div>
            <div className="truncate text-xs text-text-muted">
              {away.team.manager}
              {away.record ? ` · ${away.record.wins}-${away.record.losses}` : ""}
            </div>
          </Link>
          <Link href={`/teams/${home.team.id}`} className="min-w-0 text-right" suppressHydrationWarning>
            <div className="truncate font-cond text-lg font-semibold leading-tight">{home.team.name}</div>
            <div className="truncate text-xs text-text-muted">
              {home.record ? `${home.record.wins}-${home.record.losses} · ` : ""}
              {home.team.manager}
            </div>
          </Link>
        </div>
      </div>
    </Card>
  );
}
