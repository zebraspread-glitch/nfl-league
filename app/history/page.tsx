import { getSeasonResults } from "@/lib/league-data";
import { Card, PageIntro, TeamAvatar, Hexagon, Pill, rankBadgeTone } from "@/components/ui";

export const revalidate = 3600;

export default function HistoryPage() {
  const seasons = [...getSeasonResults()].sort((a, b) => b.season - a.season);

  return (
    <div>
      <PageIntro title="League History" subtitle="Champions & final standings, 2021–2025 (live from NFL.com)" />
      <div className="space-y-3">
        {seasons.map((s) => (
          <Card key={s.season}>
            <div className="flex items-center justify-between bg-section px-4 py-2.5">
              <span className="font-cond text-xl font-bold">
                {s.season} <span className="text-sm font-medium text-text-muted">· {s.teamCount} teams</span>
              </span>
              <Pill tone="gold">🏆 {s.champion}</Pill>
            </div>

            <div className="flex items-center gap-3 px-4 py-3">
              {s.championTeam && <TeamAvatar team={s.championTeam} size="lg" />}
              <div className="min-w-0">
                <div className="font-cond text-sm uppercase tracking-wide text-text-muted">Champion</div>
                <div className="font-cond text-2xl font-bold leading-none">{s.champion}</div>
                <div className="text-xs text-text-muted">def. {s.runnerUp} in the final</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px bg-border">
              <Info label="Regular-season #1" value={s.regularSeasonLeader} />
              <Info label="Most points" value={`${s.highestPointsFor.team} · ${s.highestPointsFor.points.toFixed(0)}`} />
            </div>

            <details className="group">
              <summary className="cursor-pointer list-none px-4 py-2.5 font-cond text-sm font-semibold uppercase tracking-wide text-text-muted hover:text-text">
                Final standings
                <span className="ml-1 inline-block transition-transform group-open:rotate-90">›</span>
              </summary>
              <div className="flex items-center gap-3 border-y border-border bg-section px-4 py-1.5 font-cond text-xs font-semibold uppercase tracking-wide text-text-muted">
                <span className="w-6 text-center">#</span>
                <span className="flex-1">Team</span>
                <span className="w-12 text-center">W-L</span>
                <span className="w-14 text-right">PF</span>
                <span className="hidden w-14 text-right sm:inline">PA</span>
              </div>
              <div>
                {s.finalStandings.map((row, i) => (
                  <div key={row.rank} className={`flex items-center gap-3 px-4 py-2 ${i % 2 ? "bg-card" : "bg-[#f7f8fa]"}`}>
                    <span className="flex w-6 justify-center">
                      <Hexagon value={row.rank} tone={rankBadgeTone(row.rank)} size="sm" />
                    </span>
                    {row.team ? (
                      <TeamAvatar team={row.team} size="sm" />
                    ) : (
                      <span className="h-7 w-7 shrink-0 rounded-full bg-section" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {row.name}
                      {row.team && row.team.name !== row.name && (
                        <span className="ml-1 text-xs font-normal text-text-dim">→ {row.team.name}</span>
                      )}
                    </span>
                    <span className="w-12 text-center font-cond text-sm tabular-nums">{row.wins}-{row.losses}</span>
                    <span className="w-14 text-right font-cond text-sm font-semibold tabular-nums">{row.pointsFor.toFixed(0)}</span>
                    <span className="hidden w-14 text-right font-cond text-sm tabular-nums text-text-muted sm:inline">{row.pointsAgainst.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </details>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="font-cond text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className="truncate font-semibold">{value}</div>
    </div>
  );
}
