import Link from "next/link";
import { getAllTimeRecords } from "@/lib/league-data";
import { Card, SectionHeader, PageIntro, TeamAvatar } from "@/components/ui";
import type { AllTimeRecord } from "@/lib/types";

export const revalidate = 3600;

export default function RecordsPage() {
  const records = getAllTimeRecords();

  const leaders = {
    titles: top(records, (r) => r.championships),
    wins: top(records, (r) => r.wins),
    pct: top(records, (r) => r.pct),
    pointsFor: top(records, (r) => r.pointsFor),
  };

  return (
    <div className="space-y-3">
      <PageIntro title="All-Time Records" subtitle="Career totals across 2021–2025 (by franchise)" />

      <Link href="/records/games">
        <Card className="flex items-center gap-3 px-4 py-3 hover:bg-card-hover">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-section text-lg">📒</span>
          <div className="flex-1">
            <div className="font-cond text-lg font-semibold leading-tight">Record Book</div>
            <div className="text-xs text-text-muted">Highest scores, blowouts, shootouts, streaks</div>
          </div>
          <span className="text-text-dim">›</span>
        </Card>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <LeaderCard label="Most titles" rec={leaders.titles} value={`${leaders.titles.championships}`} />
        <LeaderCard label="Most wins" rec={leaders.wins} value={`${leaders.wins.wins}`} />
        <LeaderCard label="Best win %" rec={leaders.pct} value={leaders.pct.pct.toFixed(3).replace(/^0/, "")} />
        <LeaderCard label="Most points" rec={leaders.pointsFor} value={leaders.pointsFor.pointsFor.toFixed(0)} />
      </div>

      <Card>
        <SectionHeader>Career table</SectionHeader>
        <div className="flex items-center gap-2 border-b border-border bg-section px-3 py-1.5 font-cond text-xs font-semibold uppercase tracking-wide text-text-muted">
          <span className="flex-1">Team</span>
          <span className="w-12 text-center">W-L</span>
          <span className="w-10 text-center">Pct</span>
          <span className="w-7 text-center">🏆</span>
          <span className="w-14 text-right">PF</span>
        </div>
        {records.map((r, i) => (
          <div key={r.team.id} className={`flex items-center gap-2 px-3 py-2 ${i % 2 ? "bg-card" : "bg-[#f7f8fa]"}`}>
            <TeamAvatar team={r.team} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-cond text-base font-semibold leading-tight">{r.team.name}</div>
              <div className="text-[11px] text-text-muted">
                {r.seasons} {r.seasons === 1 ? "season" : "seasons"}
                {r.titleYears.length ? ` · 🏆 ${r.titleYears.join(", ")}` : ""}
              </div>
            </div>
            <span className="w-12 text-center font-cond text-sm tabular-nums">{r.wins}-{r.losses}</span>
            <span className="w-10 text-center font-cond text-sm tabular-nums text-text-muted">{r.pct.toFixed(3).replace(/^0/, "")}</span>
            <span className="w-7 text-center font-cond text-sm tabular-nums">{r.championships || "–"}</span>
            <span className="w-14 text-right font-cond text-sm font-semibold tabular-nums">{r.pointsFor.toFixed(0)}</span>
          </div>
        ))}
      </Card>

      <p className="px-1 text-xs text-text-muted">
        Aggregated by franchise across all NFL.com seasons (renamed teams merged — e.g. Garytrentjr →
        Brownlowrowbottom). Win %, points and titles are real; ties broken by championships then win %.
      </p>
    </div>
  );
}

function top(records: AllTimeRecord[], by: (r: AllTimeRecord) => number): AllTimeRecord {
  return [...records].sort((a, b) => by(b) - by(a))[0];
}

function LeaderCard({ label, rec, value }: { label: string; rec: AllTimeRecord; value: string }) {
  return (
    <Card className="p-3">
      <div className="font-cond text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-1.5 flex items-center gap-2">
        <TeamAvatar team={rec.team} size="sm" />
        <span className="truncate font-cond text-base font-semibold">{rec.team.name}</span>
      </div>
      <div className="mt-1 font-cond text-3xl font-bold tabular-nums">{value}</div>
    </Card>
  );
}
