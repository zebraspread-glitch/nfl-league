import Link from "next/link";
import type { Standing } from "@/lib/types";
import { Card, Hexagon, TeamAvatar, ChangeArrow, rankBadgeTone } from "./ui";

export function StandingsTable({
  standings,
  playoffCutoff = 6,
}: {
  standings: Standing[];
  playoffCutoff?: number;
}) {
  return (
    <Card>
      {/* header row */}
      <div className="flex items-center gap-3 border-b border-border bg-section px-3 py-2 font-cond text-sm font-semibold uppercase tracking-wide text-text-muted">
        <span className="w-9 text-center">Rank</span>
        <span className="flex-1 pl-11">Team</span>
        <span className="w-12 text-center">W-L</span>
        <span className="w-16 text-right">Pts</span>
      </div>

      <div>
        {standings.map((s, i) => (
            <Link
              key={s.team.id}
              href={`/teams/${s.team.id}`}
              className={`flex items-center gap-3 px-3 py-2.5 ${i % 2 ? "bg-card" : "bg-[#f7f8fa]"} hover:bg-card-hover`}
            >
              {/* change arrow + hexagon */}
              <div className="flex w-9 flex-col items-center gap-0.5">
                <Hexagon value={s.rank} tone={rankBadgeTone(s.rank)} />
                <ChangeArrow change={s.change} />
              </div>

              <TeamAvatar team={s.team} size="md" />

              <div className="min-w-0 flex-1">
                <div className="truncate font-cond text-lg font-semibold leading-tight">{s.team.name}</div>
                <div className="truncate text-xs text-text-muted">{s.team.manager}</div>
              </div>

              <div className="w-12 text-center font-cond text-lg font-semibold tabular-nums">
                {s.wins}-{s.losses}
                {s.ties ? `-${s.ties}` : ""}
              </div>
              <div className="w-16 text-right font-cond text-lg font-semibold tabular-nums">
                {s.pointsFor.toFixed(1)}
              </div>
            </Link>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-xs text-text-muted">
        <span className="hexagon inline-block h-3.5 w-3 bg-teal" /> Top {playoffCutoff} make the playoffs
      </div>
    </Card>
  );
}
