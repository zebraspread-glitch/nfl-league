import Link from "next/link";
import { cookies } from "next/headers";
import { getMatchups, getRosterByFranchise, getStandings, getSnapshot } from "@/lib/sleeper";
import { getTeam } from "@/lib/teams";
import { MyTeamLineup } from "@/components/my-team-lineup";

export const revalidate = 120;

export default async function HomePage() {
  const snapshot = getSnapshot();
  const cookieTeam = Number((await cookies()).get("mgl_team")?.value) || null;
  const team = cookieTeam ? getTeam(cookieTeam) : undefined;

  if (!team) return <PickTeamPrompt />;

  const [standings, matchups, roster] = await Promise.all([
    getStandings(),
    getMatchups(snapshot.currentWeek),
    getRosterByFranchise(team.id, snapshot.currentWeek),
  ]);

  const standing = standings.find((s) => s.team.id === team.id);
  const matchup = matchups.find((m) => m.home.team.id === team.id || m.away.team.id === team.id);

  return (
    <div>
      <div className="px-1 pb-2 pt-1 font-cond text-sm uppercase tracking-widest text-text-muted">
        Mike Glennon League · {snapshot.season}
      </div>
      <MyTeamLineup team={team} roster={roster} standing={standing} matchup={matchup} week={snapshot.currentWeek} />
    </div>
  );
}

function PickTeamPrompt() {
  return (
    <div className="space-y-3">
      <div className="px-1 pb-1 pt-1 font-cond text-sm uppercase tracking-widest text-text-muted">My Team</div>
      <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-10 text-center shadow-sm">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-section text-2xl">🏈</div>
        <div>
          <div className="font-cond text-xl font-semibold">Pick your team</div>
          <p className="mx-auto mt-1 max-w-xs text-sm text-text-muted">
            Choose your franchise in Settings and this page becomes your lineup — starters, bench, matchups and all.
          </p>
        </div>
        <Link
          href="/settings"
          className="mt-1 rounded-lg bg-teal px-5 py-2.5 font-cond text-base font-semibold uppercase tracking-wide text-white hover:bg-teal-dark"
        >
          Choose team
        </Link>
      </div>
    </div>
  );
}
