import Link from "next/link";
import { Card, Hexagon, PageIntro, SectionHeader, TeamAvatar, rankBadgeTone } from "@/components/ui";
import { getManagerProfiles, type ManagerProfile } from "@/lib/managers";

export const revalidate = 3600;

export const metadata = { title: "Managers - MGL Fantasy" };

export default async function ManagersPage() {
  const managers = await getManagerProfiles();
  const leaders = {
    legacy: managers[0],
    titles: top(managers, (manager) => manager.championships),
    playoffWins: top(managers, (manager) => manager.playoffWins),
    wins: top(managers, (manager) => manager.wins),
    points: top(managers, (manager) => manager.pointsFor),
  };

  return (
    <div className="space-y-3">
      <PageIntro title="Managers" subtitle={`${managers.length} all-time managers ranked by MGL legacy score`} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <LeaderTile label="Legacy King" manager={leaders.legacy} value={leaders.legacy.legacyScore.toFixed(1)} />
        <LeaderTile label="Super Bowls" manager={leaders.titles} value={String(leaders.titles.championships)} />
        <LeaderTile label="Playoff Wins" manager={leaders.playoffWins} value={String(leaders.playoffWins.playoffWins)} />
        <LeaderTile label="All-Time Wins" manager={leaders.wins} value={String(leaders.wins.wins)} />
        <LeaderTile label="Points For" manager={leaders.points} value={leaders.points.pointsFor.toFixed(0)} />
        <LeaderTile label="Best Win %" manager={top(managers, (m) => m.winPct)} value={top(managers, (m) => m.winPct).winPct.toFixed(3).replace(/^0/, "")} />
      </div>

      <Card>
        <SectionHeader>Legacy Rankings</SectionHeader>
        <div className="flex items-center gap-2 border-b border-border bg-section px-3 py-1.5 font-cond text-xs font-semibold uppercase tracking-wide text-text-muted">
          <span className="w-9 text-center">Rank</span>
          <span className="flex-1">Manager</span>
          <span className="w-14 text-center">W-L</span>
          <span className="w-10 text-center">SB</span>
          <span className="w-12 text-center">POW</span>
          <span className="w-16 text-right">Legacy</span>
        </div>
        {managers.map((manager, index) => (
          <ManagerRow key={manager.id} manager={manager} rank={index + 1} alt={index % 2 === 1} />
        ))}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {managers.map((manager, index) => (
          <ManagerCard key={manager.id} manager={manager} rank={index + 1} />
        ))}
      </div>

      <Card className="p-3">
        <div className="font-cond text-base font-semibold">Legacy Score Formula</div>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          Legacy score = Super Bowls x100, runner-ups x45, podiums x18, playoff wins x14, wins x3,
          win percentage x55, points for divided by 90, point differential divided by 120, minus losses x0.75.
          It rewards titles first, then playoff success, sustained winning and scoring power.
        </p>
      </Card>
    </div>
  );
}

function top(managers: ManagerProfile[], by: (manager: ManagerProfile) => number): ManagerProfile {
  return [...managers].sort((a, b) => by(b) - by(a) || b.legacyScore - a.legacyScore)[0];
}

function LeaderTile({ label, manager, value }: { label: string; manager: ManagerProfile; value: string }) {
  return (
    <Card className="p-3">
      <div className="font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{manager.name}</div>
      <div className="font-cond text-2xl font-bold tabular-nums">{value}</div>
    </Card>
  );
}

function ManagerRow({ manager, rank, alt }: { manager: ManagerProfile; rank: number; alt: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 ${alt ? "bg-card" : "bg-row"}`}>
      <span className="flex w-9 justify-center">
        <Hexagon value={rank} tone={rankBadgeTone(rank)} size="sm" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-cond text-base font-semibold leading-tight">{manager.name}</div>
        <div className="truncate text-[11px] text-text-muted">{manager.teams.map((item) => item.name).join(", ")}</div>
      </div>
      <span className="w-14 text-center font-cond text-sm tabular-nums">
        {manager.wins}-{manager.losses}
      </span>
      <span className="w-10 text-center font-cond text-sm font-semibold tabular-nums">{manager.championships}</span>
      <span className="w-12 text-center font-cond text-sm tabular-nums">{manager.playoffWins}</span>
      <span className="w-16 text-right font-cond text-lg font-bold tabular-nums">{manager.legacyScore.toFixed(1)}</span>
    </div>
  );
}

function ManagerCard({ manager, rank }: { manager: ManagerProfile; rank: number }) {
  return (
    <Card>
      <div
        className="px-3 py-3 text-white"
        style={{ background: "linear-gradient(180deg, var(--teal) 0%, var(--teal-deep) 100%)" }}
      >
        <div className="flex items-center gap-2">
          <Hexagon value={rank} tone={rankBadgeTone(rank)} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-cond text-xl font-bold leading-tight">{manager.name}</div>
            <div className="font-cond text-sm text-white/80">Legacy {manager.legacyScore.toFixed(1)}</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px bg-section/70">
        <MiniStat label="Record" value={`${manager.wins}-${manager.losses}`} />
        <MiniStat label="Win %" value={manager.winPct.toFixed(3).replace(/^0/, "")} />
        <MiniStat label="SB" value={String(manager.championships)} />
        <MiniStat label="Playoffs" value={`${manager.playoffWins}-${manager.playoffLosses}`} />
        <MiniStat label="PF" value={manager.pointsFor.toFixed(0)} />
        <MiniStat label="High" value={manager.highScore.toFixed(1)} />
      </div>
      <div className="border-t border-border">
        {manager.teams.map((item, index) => (
          <Link
            key={item.team.id}
            href={`/teams/${item.team.id}`}
            className={`flex items-center gap-2 px-3 py-2 ${index % 2 ? "bg-card" : "bg-row"} hover:bg-card-hover`}
          >
            <TeamAvatar team={item.team} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{item.name}</div>
              <div className="text-[11px] text-text-muted">
                {item.seasons} seasons - {item.wins}-{item.losses}
                {item.titleYears.length ? ` - SB ${item.titleYears.join(", ")}` : ""}
              </div>
            </div>
            <span className="font-cond text-sm font-bold text-text-muted">#{item.bestFinish || "-"}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-2 py-2 text-center">
      <div className="font-cond text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
    </div>
  );
}
