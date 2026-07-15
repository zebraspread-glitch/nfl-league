import { getAllPlayStandings } from "@/lib/insights";
import { getAiPowerRankings } from "@/lib/power-rankings";
import { getMatchups, getSnapshot, getStandings } from "@/lib/sleeper";
import type { Matchup, TeamMeta } from "@/lib/types";
import { Card, PageIntro, SectionHeader, TeamAvatar, TeamLink, Pill } from "@/components/ui";

export const revalidate = 600;

export const metadata = { title: "League Newspaper - MGL Fantasy" };

export default async function NewspaperPage() {
  const snapshot = getSnapshot();
  const [standings, matchups, allPlay, power] = await Promise.all([
    getStandings(),
    getMatchups(snapshot.currentWeek),
    getAllPlayStandings(),
    Promise.resolve(getAiPowerRankings()),
  ]);

  const powerRank = new Map(power.entries.map((entry) => [entry.team.id, entry.rank]));
  const leadTeam = standings[0]?.team ?? power.entries[0]?.team;
  const chaseTeam = standings[1]?.team ?? power.entries[1]?.team;
  const dangerTeam = power.entries[power.entries.length - 1]?.team;
  const luckiest = [...allPlay].sort((a, b) => b.luckWins - a.luckWins)[0];
  const unluckiest = [...allPlay].sort((a, b) => a.luckWins - b.luckWins)[0];
  const frontMatchup = matchups[0];

  return (
    <div className="space-y-3">
      <PageIntro title="League Newspaper" subtitle={`MGL Gazette - ${snapshot.season} Week ${snapshot.currentWeek}`} />

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <div className="font-cond text-4xl font-bold uppercase leading-none">MGL Gazette</div>
            <div className="mt-1 font-cond text-xs uppercase tracking-[0.18em] text-text-muted">Updated {power.updated}</div>
          </div>
          <Pill tone="gold">Edition {snapshot.currentWeek}</Pill>
        </div>

        <div className="grid gap-4 pt-4 sm:grid-cols-[1.25fr_0.75fr]">
          <LeadStory team={leadTeam} chaseTeam={chaseTeam} standingsLive={standings.length > 0} />
          <div className="space-y-2">
            {frontMatchup && <MatchupBrief matchup={frontMatchup} powerRank={powerRank} />}
            {luckiest && unluckiest && (
              <DeskNote
                title="Luck Desk"
                label="Historical schedule watch"
                body={`${luckiest.team.name} has banked the kindest historical draw at ${signed(luckiest.luckWins)} wins over neutral schedule pace. ${unluckiest.team.name} sits at ${signed(unluckiest.luckWins)}.`}
              />
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <ColumnCard
          label="Power Desk"
          title={`${power.entries[0]?.team.name ?? "The leader"} opens as the chase target`}
          body={power.entries[0]?.note || "The top tier has the league bracing for a season where every upset will matter."}
          team={power.entries[0]?.team}
        />
        <ColumnCard
          label="Draft Desk"
          title="Rookie fever reaches the first round"
          body="Jeremiyah Love remains the name circled at the top, while Carnell Tate, Jordyn Tyson and Jadarian Price are carrying enough heat to bend the board early."
          team={dangerTeam}
        />
      </div>

      <Card>
        <SectionHeader>Matchup Wire</SectionHeader>
        {matchups.map((matchup, index) => (
          <MatchupWire key={matchup.id} matchup={matchup} powerRank={powerRank} index={index} />
        ))}
      </Card>

      <Card>
        <SectionHeader>Power Tiers</SectionHeader>
        {power.entries.slice(0, 8).map((entry, index) => (
          <TeamLink
            key={entry.team.id}
            team={entry.team}
            className={`flex items-center gap-3 border-t border-border px-3 py-2.5 ${index % 2 ? "bg-card" : "bg-row"} hover:bg-card-hover`}
          >
            <span className="w-6 text-right font-cond text-sm font-bold text-text-dim">{entry.rank}</span>
            <TeamAvatar team={entry.team} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-cond text-base font-semibold">{entry.team.name}</div>
              <div className="truncate text-xs text-text-muted">{entry.tier}</div>
            </div>
          </TeamLink>
        ))}
      </Card>
    </div>
  );
}

function LeadStory({
  team,
  chaseTeam,
  standingsLive,
}: {
  team?: TeamMeta;
  chaseTeam?: TeamMeta;
  standingsLive: boolean;
}) {
  if (!team) return null;
  return (
    <article>
      <TeamLink team={team} className="flex items-center gap-3 hover:opacity-80">
        <TeamAvatar team={team} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="font-cond text-xs uppercase tracking-wide text-text-muted">{standingsLive ? "Top Story" : "Preseason Lead"}</div>
          <h2 className="font-cond text-3xl font-bold leading-[0.95]">
            {standingsLive ? `${team.name} grabs the front page` : `${team.name} installed as the team to catch`}
          </h2>
        </div>
      </TeamLink>
      <p className="mt-3 text-sm leading-relaxed text-text-muted">
        {standingsLive
          ? `${team.name} owns the headline slot on the live ladder, with every chasing manager now staring at the same target.`
          : `${team.name} enters the season with the loudest keeper profile in the league, but ${chaseTeam?.name ?? "the chasing pack"} is close enough to keep the race honest.`}
      </p>
    </article>
  );
}

function MatchupBrief({ matchup, powerRank }: { matchup: Matchup; powerRank: Map<number, number> }) {
  const favorite = favoriteFor(matchup, powerRank);
  const underdog = favorite.id === matchup.home.team.id ? matchup.away.team : matchup.home.team;
  return (
    <DeskNote
      title="Primetime"
      label={`${matchup.away.team.abbrev} at ${matchup.home.team.abbrev}`}
      body={`${favorite.name} gets the market lean, but ${underdog.name} has the cleanest chance to make the first headline messy.`}
    />
  );
}

function ColumnCard({ label, title, body, team }: { label: string; title: string; body: string; team?: TeamMeta }) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2">
        {team && <TeamAvatar team={team} size="sm" />}
        <div className="font-cond text-xs uppercase tracking-wide text-text-muted">{label}</div>
      </div>
      <h3 className="font-cond text-2xl font-bold leading-none">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">{body}</p>
    </Card>
  );
}

function DeskNote({ title, label, body }: { title: string; label: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-row p-3">
      <div className="font-cond text-xs uppercase tracking-wide text-text-muted">{title}</div>
      <div className="mt-0.5 font-cond text-lg font-semibold leading-tight">{label}</div>
      <p className="mt-1 text-xs leading-relaxed text-text-muted">{body}</p>
    </div>
  );
}

function MatchupWire({ matchup, powerRank, index }: { matchup: Matchup; powerRank: Map<number, number>; index: number }) {
  const favorite = favoriteFor(matchup, powerRank);
  const rankGap = Math.abs((powerRank.get(matchup.home.team.id) ?? 99) - (powerRank.get(matchup.away.team.id) ?? 99));
  const tag = rankGap <= 1 ? "Toss-up" : rankGap <= 4 ? "Swing Game" : "Statement Spot";

  return (
    <div className={`border-t border-border px-3 py-3 ${index % 2 ? "bg-card" : "bg-row"}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Pill>{tag}</Pill>
        <span className="font-cond text-xs font-semibold uppercase tracking-wide text-text-muted">Week {matchup.week}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <WireTeam team={matchup.away.team} favorite={favorite.id === matchup.away.team.id} />
        <span className="font-cond text-xs font-bold text-text-dim">at</span>
        <WireTeam team={matchup.home.team} favorite={favorite.id === matchup.home.team.id} align="right" />
      </div>
    </div>
  );
}

function WireTeam({ team, favorite, align = "left" }: { team: TeamMeta; favorite: boolean; align?: "left" | "right" }) {
  return (
    <TeamLink team={team} className={`flex min-w-0 items-center gap-2 hover:opacity-80 ${align === "right" ? "justify-end text-right" : ""}`}>
      {align === "left" && <TeamAvatar team={team} size="sm" />}
      <span className="min-w-0">
        <span className="block truncate font-cond text-base font-semibold">{team.name}</span>
        {favorite && <span className="block font-cond text-[10px] font-bold uppercase tracking-wide text-teal">Favorite</span>}
      </span>
      {align === "right" && <TeamAvatar team={team} size="sm" />}
    </TeamLink>
  );
}

function favoriteFor(matchup: Matchup, powerRank: Map<number, number>): TeamMeta {
  const homeRank = powerRank.get(matchup.home.team.id) ?? 99;
  const awayRank = powerRank.get(matchup.away.team.id) ?? 99;
  return homeRank <= awayRank ? matchup.home.team : matchup.away.team;
}

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}
