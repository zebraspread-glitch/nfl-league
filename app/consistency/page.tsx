import { getScoringConsistency, type ConsistencyRow } from "@/lib/insights";
import { Card, PageIntro, SectionHeader, TeamAvatar, TeamLink } from "@/components/ui";

export const revalidate = 3600;

export const metadata = { title: "Boom or Bust - MGL Fantasy" };

export default async function ConsistencyPage() {
  const rows = await getScoringConsistency();

  const steadiest = rows[0];
  const wildest = rows[rows.length - 1];
  const highestFloor = [...rows].sort((a, b) => b.floor - a.floor)[0];
  const highestCeiling = [...rows].sort((a, b) => b.ceiling - a.ceiling)[0];

  // Scale the floor–ceiling bars against the widest span in the league.
  const globalFloor = Math.min(...rows.map((row) => row.floor));
  const globalCeiling = Math.max(...rows.map((row) => row.ceiling));
  const span = Math.max(1, globalCeiling - globalFloor);

  return (
    <div className="space-y-3">
      <PageIntro
        title="Boom or Bust"
        subtitle="Which franchises are steady, which swing wildly (2021–2025 regular season)"
      />

      <Card className="p-4 text-sm text-text-muted">
        Two teams can average the same points very differently — one metronomic, one bouncing between duds and
        explosions. <span className="font-semibold text-text">Volatility</span> is each team&apos;s weekly standard
        deviation as a share of its average; lower means steadier.
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <HighlightCard label="Steadiest" row={steadiest} value={`${Math.round(steadiest.cv * 100)}% vol`} tone="up" />
        <HighlightCard label="Most boom-or-bust" row={wildest} value={`${Math.round(wildest.cv * 100)}% vol`} tone="down" />
        <HighlightCard label="Highest floor" row={highestFloor} value={highestFloor.floor.toFixed(1)} />
        <HighlightCard label="Highest ceiling" row={highestCeiling} value={highestCeiling.ceiling.toFixed(1)} />
      </div>

      <Card>
        <SectionHeader>Scoring Range</SectionHeader>
        <div className="space-y-2 p-4">
          {rows.map((row) => {
            const leftPct = ((row.floor - globalFloor) / span) * 100;
            const widthPct = (row.range / span) * 100;
            const avgPct = ((row.avg - globalFloor) / span) * 100;
            return (
              <div key={row.team.id} className="flex items-center gap-2">
                <TeamLink team={row.team} className="flex w-28 shrink-0 items-center gap-1.5 hover:opacity-80">
                  <TeamAvatar team={row.team} size="sm" />
                  <span className="truncate font-cond text-sm font-semibold">{row.team.abbrev}</span>
                </TeamLink>
                <div className="relative h-6 flex-1 rounded bg-section">
                  <div
                    className="absolute top-0 h-6 rounded"
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      background: `linear-gradient(90deg, ${row.team.primary}66, ${row.team.secondary})`,
                    }}
                    title={`${row.floor.toFixed(1)} – ${row.ceiling.toFixed(1)}`}
                  />
                  <div className="absolute top-0 h-6 w-0.5 bg-text" style={{ left: `${avgPct}%` }} title={`avg ${row.avg.toFixed(1)}`} />
                </div>
                <span className="w-10 shrink-0 text-right font-cond text-xs tabular-nums text-text-muted">
                  {row.avg.toFixed(0)}
                </span>
              </div>
            );
          })}
          <div className="pt-1 text-center text-[11px] text-text-dim">Bar spans weekly floor → ceiling; the tick marks the average.</div>
        </div>
      </Card>

      <Card>
        <SectionHeader>Volatility Table</SectionHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="bg-section font-cond text-xs uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2 text-left">Franchise</th>
                <th className="px-2 py-2 text-center">Avg</th>
                <th className="px-2 py-2 text-center">Std Dev</th>
                <th className="px-2 py-2 text-center">Vol</th>
                <th className="px-2 py-2 text-center">Floor</th>
                <th className="px-2 py-2 text-center">Ceiling</th>
                <th className="px-2 py-2 text-center" title="Weeks 1+ std dev above own average">
                  💥
                </th>
                <th className="px-2 py-2 text-center" title="Weeks 1+ std dev below own average">
                  🧊
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.team.id} className={`border-t border-border ${index % 2 ? "bg-card" : "bg-row"}`}>
                  <td className="px-3 py-2">
                    <TeamLink team={row.team} className="flex items-center gap-2 hover:opacity-80">
                      <TeamAvatar team={row.team} size="sm" />
                      <span className="truncate font-cond text-base font-semibold">{row.team.name}</span>
                    </TeamLink>
                  </td>
                  <td className="px-2 py-2 text-center font-cond font-bold tabular-nums">{row.avg.toFixed(1)}</td>
                  <td className="px-2 py-2 text-center font-cond tabular-nums text-text-muted">{row.stdDev.toFixed(1)}</td>
                  <td className="px-2 py-2 text-center font-cond font-bold tabular-nums">{Math.round(row.cv * 100)}%</td>
                  <td className="px-2 py-2 text-center font-cond tabular-nums text-text-muted">{row.floor.toFixed(1)}</td>
                  <td className="px-2 py-2 text-center font-cond tabular-nums text-text-muted">{row.ceiling.toFixed(1)}</td>
                  <td className="px-2 py-2 text-center font-cond tabular-nums text-text-muted">{row.boomWeeks}</td>
                  <td className="px-2 py-2 text-center font-cond tabular-nums text-text-muted">{row.bustWeeks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function HighlightCard({
  label,
  row,
  value,
  tone = "neutral",
}: {
  label: string;
  row: ConsistencyRow;
  value: string;
  tone?: "up" | "down" | "neutral";
}) {
  const valueClass = tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-text";
  return (
    <Card className="p-3">
      <div className="font-cond text-xs uppercase tracking-wide text-text-muted">{label}</div>
      <TeamLink team={row.team} className="mt-1.5 flex items-center gap-2 hover:opacity-80">
        <TeamAvatar team={row.team} size="sm" />
        <span className="min-w-0 flex-1 truncate font-cond text-base font-semibold">{row.team.name}</span>
      </TeamLink>
      <div className={`mt-1 font-cond text-2xl font-bold tabular-nums ${valueClass}`}>{value}</div>
    </Card>
  );
}
