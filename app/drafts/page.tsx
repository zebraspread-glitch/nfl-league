import Link from "next/link";
import { Card, EmptyState, PageIntro, SectionHeader, TeamAvatar } from "@/components/ui";
import { PlayerBadge } from "@/components/player-badge";
import { getDraftIndex, getSeasonDraft, type DraftPick } from "@/lib/drafts";

export const revalidate = 86400;

type View = "round" | "team";

export default async function DraftsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; view?: string }>;
}) {
  const [{ season: seasonParam, view: viewParam }, index] = await Promise.all([
    searchParams,
    getDraftIndex(),
  ]);
  const seasons = index.map((entry) => entry.season);
  const requestedSeason = Number(seasonParam);
  const season = seasons.includes(requestedSeason) ? requestedSeason : seasons[0];
  const view: View = viewParam === "team" ? "team" : "round";

  const draft = season ? await getSeasonDraft(season) : null;
  const meta = index.find((entry) => entry.season === season);
  const rounds = draft ? groupByRound(draft.picks) : [];
  const teams = draft ? groupByTeam(draft.picks) : [];

  return (
    <div>
      <PageIntro
        title="Draft Results"
        subtitle={meta ? `${season} draft - ${meta.picks} picks, ${meta.rounds} rounds` : "Historical draft boards"}
      />

      <SeasonTabs seasons={seasons} active={season} view={view} />
      <ViewToggle season={season} view={view} />

      {!draft ? (
        <EmptyState>No draft results are available.</EmptyState>
      ) : view === "round" ? (
        <div className="space-y-3">
          {rounds.map(([round, picks]) => (
            <Card key={round}>
              <SectionHeader>Round {round}</SectionHeader>
              {picks.map((pick, i) => (
                <DraftRow key={`${pick.season}-${pick.pick}-${pick.playerId}`} pick={pick} alt={i % 2 === 1} />
              ))}
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map((t) => (
            <Card key={t.id}>
              <div className="flex items-center gap-2 bg-section px-3 py-2.5">
                {t.team ? <TeamAvatar team={t.team} size="sm" /> : <span className="h-8 w-8 rounded-full bg-card" />}
                <div className="min-w-0">
                  <div className="truncate font-cond text-base font-semibold leading-tight">{t.name}</div>
                  <div className="truncate text-[11px] text-text-muted">{t.managers}</div>
                </div>
                <span className="ml-auto font-cond text-xs uppercase tracking-wide text-text-muted">
                  {t.picks.length} picks
                </span>
              </div>
              {t.picks.map((pick, i) => (
                <TeamPickRow key={`${pick.pick}-${pick.playerId}`} pick={pick} alt={i % 2 === 1} />
              ))}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SeasonTabs({ seasons, active, view }: { seasons: number[]; active: number; view: View }) {
  return (
    <div className="mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {seasons.map((season) => (
        <Link
          key={season}
          href={`/drafts?season=${season}&view=${view}`}
          className={`shrink-0 rounded-full px-3.5 py-1.5 font-cond text-sm font-semibold transition-colors ${
            season === active ? "bg-teal text-white" : "bg-card text-text-muted hover:bg-card-hover"
          }`}
        >
          {season}
        </Link>
      ))}
    </div>
  );
}

function ViewToggle({ season, view }: { season: number; view: View }) {
  const opts: { key: View; label: string }[] = [
    { key: "round", label: "Draft Board" },
    { key: "team", label: "By Team" },
  ];
  return (
    <div className="mb-3 flex gap-1.5 px-1">
      {opts.map((o) => (
        <Link
          key={o.key}
          href={`/drafts?season=${season}&view=${o.key}`}
          className={`rounded-lg px-3 py-1.5 font-cond text-sm font-semibold transition-colors ${
            view === o.key ? "bg-text text-white" : "bg-card text-text-muted hover:bg-card-hover"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

function groupByRound(picks: DraftPick[]): Array<[number, DraftPick[]]> {
  const rounds = new Map<number, DraftPick[]>();
  for (const pick of picks) {
    const group = rounds.get(pick.round) ?? [];
    group.push(pick);
    rounds.set(pick.round, group);
  }
  return [...rounds.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, roundPicks]) => [round, roundPicks.sort((a, b) => a.pick - b.pick)]);
}

interface TeamGroup {
  id: number;
  name: string;
  managers: string;
  team: DraftPick["team"];
  picks: DraftPick[];
}

function groupByTeam(picks: DraftPick[]): TeamGroup[] {
  const groups = new Map<number, TeamGroup>();
  for (const pick of picks) {
    const id = pick.fantasyTeamId;
    const group =
      groups.get(id) ??
      ({
        id,
        name: pick.fantasyTeamName,
        managers: pick.managers.length ? pick.managers.join(", ") : "Unknown manager",
        team: pick.team,
        picks: [],
      } satisfies TeamGroup);
    group.picks.push(pick);
    groups.set(id, group);
  }
  for (const group of groups.values()) group.picks.sort((a, b) => a.pick - b.pick);
  // order teams by their first (earliest) pick
  return [...groups.values()].sort((a, b) => a.picks[0].pick - b.picks[0].pick);
}

function DraftRow({ pick, alt }: { pick: DraftPick; alt: boolean }) {
  const managers = pick.managers.length ? pick.managers.join(", ") : "Unknown manager";
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 ${alt ? "bg-card" : "bg-row"}`}>
      <div className="w-7 shrink-0 text-center font-cond text-lg font-bold tabular-nums text-text-muted">
        {pick.pick}
      </div>

      <PlayerBadge playerId={pick.playerId} pos={pick.position} name={pick.playerName} />

      <Link href={`/players/${pick.playerId}`} className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{pick.playerName}</div>
        <div className="truncate text-xs text-text-muted">{pick.proTeam || "FA"}</div>
      </Link>

      {/* fixed-width team column so every logo lines up on the right edge */}
      <div className="w-24 shrink-0 text-right sm:w-32">
        <div className="truncate font-cond text-sm font-semibold leading-tight">{pick.fantasyTeamName}</div>
        <div className="truncate text-[11px] text-text-muted">{managers}</div>
      </div>
      {pick.team ? (
        <TeamAvatar team={pick.team} size="sm" />
      ) : (
        <span className="h-8 w-8 shrink-0 rounded-full bg-section" />
      )}
    </div>
  );
}

function TeamPickRow({ pick, alt }: { pick: DraftPick; alt: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 ${alt ? "bg-card" : "bg-row"}`}>
      <div className="w-7 shrink-0 text-center font-cond text-base font-bold tabular-nums text-text-muted">
        {pick.pick}
      </div>
      <PlayerBadge playerId={pick.playerId} pos={pick.position} name={pick.playerName} />
      <Link href={`/players/${pick.playerId}`} className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{pick.playerName}</div>
        <div className="truncate text-xs text-text-muted">
          {pick.position}
          {pick.proTeam ? ` - ${pick.proTeam}` : ""}
        </div>
      </Link>
      <span className="shrink-0 font-cond text-xs font-semibold uppercase tracking-wide text-text-dim">
        Rd {pick.round}
      </span>
    </div>
  );
}
