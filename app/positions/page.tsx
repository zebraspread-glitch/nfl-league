import { getPositionalBreakdown, type InsightPosition } from "@/lib/insights";
import { Card, PageIntro, SectionHeader, TeamAvatar, TeamLink } from "@/components/ui";

export const revalidate = 3600;

export const metadata = { title: "Positional Firepower - MGL Fantasy" };

const POS_COLOR: Record<InsightPosition, string> = {
  QB: "#29c5e6",
  RB: "#f0883e",
  WR: "#f0c33c",
  TE: "#3cb878",
  K: "#c9ccd1",
  DEF: "#aab4c1",
};

function share(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default async function PositionsPage() {
  const { rows, leagueShare, leagueAvgPerPos, positions } = await getPositionalBreakdown();

  // Franchise that leans hardest on each position relative to the league.
  const leaders = positions.map((pos) => {
    const leader = [...rows].sort((a, b) => b.shareByPos[pos] - a.shareByPos[pos])[0];
    return { pos, leader };
  });

  return (
    <div className="space-y-3">
      <PageIntro
        title="Positional Firepower"
        subtitle="Where each franchise's points come from (started players, 2021–2025)"
      />

      <Card>
        <SectionHeader>League Scoring Mix</SectionHeader>
        <div className="p-4">
          <div className="flex h-7 w-full overflow-hidden rounded-md">
            {positions.map((pos) => (
              <div
                key={pos}
                className="grid place-items-center font-cond text-[11px] font-bold text-black/70"
                style={{ width: `${leagueShare[pos] * 100}%`, background: POS_COLOR[pos] }}
                title={`${pos} - ${share(leagueShare[pos])}`}
              >
                {leagueShare[pos] >= 0.08 ? pos : ""}
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {positions.map((pos) => (
              <div key={pos} className="text-center">
                <div className="mx-auto h-2 w-2 rounded-full" style={{ background: POS_COLOR[pos] }} />
                <div className="mt-1 font-cond text-sm font-bold">{pos}</div>
                <div className="font-cond text-xs text-text-muted">{share(leagueShare[pos])}</div>
                <div className="font-cond text-[11px] text-text-dim">{leagueAvgPerPos[pos].toFixed(0)} avg</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {leaders.map(({ pos, leader }) => (
          <Card key={pos} className="p-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: POS_COLOR[pos] }} />
              <span className="font-cond text-xs uppercase tracking-wide text-text-muted">Most {pos}-reliant</span>
            </div>
            <TeamLink team={leader.team} className="mt-1.5 flex items-center gap-2 hover:opacity-80">
              <TeamAvatar team={leader.team} size="sm" />
              <span className="min-w-0 flex-1 truncate font-cond text-sm font-semibold">{leader.team.name}</span>
            </TeamLink>
            <div className="mt-1 font-cond text-xl font-bold tabular-nums">{share(leader.shareByPos[pos])}</div>
          </Card>
        ))}
      </div>

      <Card>
        <SectionHeader>By Franchise</SectionHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="bg-section font-cond text-xs uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2 text-left">Franchise</th>
                <th className="px-2 py-2 text-right">Total</th>
                {positions.map((pos) => (
                  <th key={pos} className="px-2 py-2 text-right">
                    {pos}
                  </th>
                ))}
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
                  <td className="px-2 py-2 text-right font-cond font-bold tabular-nums">{row.total.toFixed(0)}</td>
                  {positions.map((pos) => (
                    <td key={pos} className="px-2 py-2 text-right font-cond tabular-nums">
                      <span className={pos === row.topPos ? "font-bold text-text" : "text-text-muted"}>
                        {row.byPos[pos].toFixed(0)}
                      </span>
                      <span className="ml-1 text-[11px] text-text-dim">{share(row.shareByPos[pos])}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="px-1 pb-2 text-xs text-text-dim">
        Points are summed from started players only, across regular-season and championship-bracket games. Bold marks
        each franchise&apos;s biggest scoring source.
      </p>
    </div>
  );
}
