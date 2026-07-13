import { getAllPlayStandings, type AllPlayRow } from "@/lib/insights";
import { Card, PageIntro, SectionHeader, TeamAvatar, TeamLink } from "@/components/ui";

export const revalidate = 3600;

export const metadata = { title: "Luck & All-Play - MGL Fantasy" };

function pct(value: number): string {
  return value.toFixed(3).replace(/^0/, "");
}

function signed(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}`;
}

export default async function LuckPage() {
  const rows = await getAllPlayStandings();

  const luckiest = [...rows].sort((a, b) => b.luckWins - a.luckWins)[0];
  const unluckiest = [...rows].sort((a, b) => a.luckWins - b.luckWins)[0];
  const bestAllPlay = rows[0];
  const mostCrowns = [...rows].sort((a, b) => b.crowns - a.crowns)[0];

  return (
    <div className="space-y-3">
      <PageIntro
        title="Luck & All-Play"
        subtitle="If everyone played everyone, every week (2021–2025 regular season)"
      />

      <Card className="p-4 text-sm text-text-muted">
        Each week, we score every franchise against the <span className="font-semibold text-text">whole league</span>,
        not just its one opponent. That all-play record is how good you really were; the gap between it and your{" "}
        <span className="font-semibold text-text">actual</span> record is schedule luck — who you happened to draw.
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <HighlightCard label="Luckiest" row={luckiest} value={`${signed(luckiest.luckWins)} wins`} tone="up" />
        <HighlightCard label="Unluckiest" row={unluckiest} value={`${signed(unluckiest.luckWins)} wins`} tone="down" />
        <HighlightCard label="Best all-play" row={bestAllPlay} value={pct(bestAllPlay.allPlayPct)} />
        <HighlightCard label="Most weekly crowns" row={mostCrowns} value={`${mostCrowns.crowns}`} />
      </div>

      <Card>
        <SectionHeader>All-Play Standings</SectionHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="bg-section font-cond text-xs uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2 text-left">Franchise</th>
                <th className="px-2 py-2 text-center">All-Play</th>
                <th className="px-2 py-2 text-center">AP%</th>
                <th className="px-2 py-2 text-center">Actual</th>
                <th className="px-2 py-2 text-center">Luck</th>
                <th className="px-2 py-2 text-center" title="Weeks as the league's top scorer">
                  👑
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.team.id} className={`border-t border-border ${index % 2 ? "bg-card" : "bg-row"}`}>
                  <td className="px-3 py-2">
                    <TeamLink team={row.team} className="flex items-center gap-2 hover:opacity-80">
                      <span className="w-4 text-right font-cond text-xs font-bold text-text-dim">{index + 1}</span>
                      <TeamAvatar team={row.team} size="sm" />
                      <span className="truncate font-cond text-base font-semibold">{row.team.name}</span>
                    </TeamLink>
                  </td>
                  <td className="px-2 py-2 text-center font-cond tabular-nums text-text-muted">
                    {row.allPlayWins}-{row.allPlayLosses}
                    {row.allPlayTies ? `-${row.allPlayTies}` : ""}
                  </td>
                  <td className="px-2 py-2 text-center font-cond font-bold tabular-nums">{pct(row.allPlayPct)}</td>
                  <td className="px-2 py-2 text-center font-cond tabular-nums text-text-muted">
                    {row.actualWins}-{row.actualLosses}
                    {row.actualTies ? `-${row.actualTies}` : ""}
                  </td>
                  <td
                    className={`px-2 py-2 text-center font-cond font-bold tabular-nums ${
                      row.luckWins > 0.05 ? "text-up" : row.luckWins < -0.05 ? "text-down" : "text-text-dim"
                    }`}
                  >
                    {signed(row.luckWins)}
                  </td>
                  <td className="px-2 py-2 text-center font-cond tabular-nums text-text-muted">{row.crowns}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="px-1 pb-2 text-xs text-text-dim">
        Luck = actual wins minus the wins a neutral, play-everyone schedule would have produced (all-play win % × weeks).
        A positive number means the schedule was kind.
      </p>
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
  row: AllPlayRow;
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
