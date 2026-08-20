import Link from "next/link";
import type { Standing } from "@/lib/types";
import { Card, Hexagon, TeamAvatar, ChangeArrow } from "./ui";

/** Ladder styled like the NFL.com app: tinted rank rail, zebra rows and a
 *  "missing the playoffs" divider dropped in at the cutoff. */
export function StandingsTable({
  standings,
  playoffCutoff = 8,
  highlightTeamId,
}: {
  standings: Standing[];
  playoffCutoff?: number;
  highlightTeamId?: number | null;
}) {
  return (
    <Card>
      {/* header row */}
      <div className="flex items-stretch border-b border-border bg-section font-cond text-sm font-semibold uppercase tracking-wide text-text-muted">
        <span className="flex w-16 items-center justify-center gap-1 bg-teal/12 py-2.5 text-text">
          <span aria-hidden className="text-xs">▲</span> Rank
        </span>
        <span className="flex-1 py-2.5 pl-16">Team</span>
        <span className="w-14 py-2.5 text-center">W-L</span>
        <span className="w-20 py-2.5 pr-3 text-right">Pts For</span>
      </div>

      <div>
        {standings.map((s, i) => {
          const inPlayoffs = s.rank <= playoffCutoff;
          const isMe = highlightTeamId != null && s.team.id === highlightTeamId;
          const linkable = s.team.id > 0;

          const bg = isMe ? "bg-teal/10" : i % 2 ? "bg-row" : "bg-card";
          const rowClass = `flex items-stretch border-b border-border/60 ${bg} ${
            linkable ? "hover:bg-card-hover" : ""
          }`;

          const inner = (
            <>
              {/* rank rail — tinted for playoff spots, muted once you're out */}
              <div
                className={`flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 py-3 ${
                  inPlayoffs ? "bg-teal/12" : "bg-section"
                }`}
              >
                <Hexagon value={s.rank} tone={inPlayoffs ? "teal" : "grey"} />
                <ChangeArrow change={s.change} />
              </div>

              <div className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3">
                <TeamAvatar team={s.team} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-cond text-lg font-semibold leading-tight">
                    {s.team.name}
                  </div>
                  <div className="truncate text-xs text-text-muted">{s.team.manager || "—"}</div>
                </div>
              </div>

              <div className="flex w-14 items-center justify-center font-cond text-lg font-semibold tabular-nums">
                {s.wins}-{s.losses}
                {s.ties ? `-${s.ties}` : ""}
              </div>
              <div className="flex w-20 items-center justify-end pr-3 font-cond text-lg font-semibold tabular-nums">
                {s.pointsFor.toFixed(2)}
              </div>
            </>
          );

          const row = linkable ? (
            <Link key={s.team.id} href={`/teams/${s.team.id}`} className={rowClass}>
              {inner}
            </Link>
          ) : (
            <div key={`ph-${s.rank}`} className={rowClass}>
              {inner}
            </div>
          );

          // The cutoff band sits above the first team that misses out.
          const showCutoff = s.rank === playoffCutoff + 1;
          return showCutoff ? (
            <div key={`cut-${s.rank}`}>
              <div className="bg-bg px-4 py-3 font-cond text-base font-semibold text-text-muted">
                Out of playoffs if season ended today
              </div>
              {row}
            </div>
          ) : (
            row
          );
        })}
      </div>
    </Card>
  );
}
