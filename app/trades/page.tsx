import Link from "next/link";
import { Card, EmptyState, PageIntro, SectionHeader, TeamAvatar } from "@/components/ui";
import { PlayerBadge } from "@/components/player-badge";
import { getAllTrades, getTradeSeasons, type Trade, type TradeLeg } from "@/lib/trades";
import { weekLabel } from "@/lib/games";
import { TEAMS } from "@/lib/teams";

export const revalidate = 86400;

type View = "all" | "team";

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; view?: string; team?: string }>;
}) {
  const [{ season: seasonParam, view: viewParam, team: teamParam }, allTrades, seasons] = await Promise.all([
    searchParams,
    getAllTrades(),
    getTradeSeasons(),
  ]);

  const view: View = viewParam === "team" ? "team" : "all";
  const requestedSeason = Number(seasonParam);
  const season = seasons.includes(requestedSeason) ? requestedSeason : "all";
  const bySeason = season === "all" ? allTrades : allTrades.filter((t) => t.season === season);

  const requestedTeamId = Number(teamParam);
  const activeTeamId = view === "team" && TEAMS.some((t) => t.id === requestedTeamId) ? requestedTeamId : TEAMS[0].id;
  const trades =
    view === "team"
      ? bySeason.filter((t) => t.legs.some((l) => l.fromTeam?.id === activeTeamId || l.toTeam?.id === activeTeamId))
      : bySeason;

  return (
    <div>
      <PageIntro title="Trades" subtitle={`${allTrades.length} all-time trades, 2021-2025`} />
      <ViewToggle season={season} view={view} teamId={activeTeamId} />
      <SeasonTabs seasons={seasons} active={season} view={view} teamId={activeTeamId} />
      {view === "team" && <TeamTabs active={activeTeamId} season={season} />}

      {trades.length === 0 ? (
        <EmptyState>No trades found.</EmptyState>
      ) : (
        <div className="space-y-3">
          {trades.map((t) => (
            <TradeCard key={t.id} trade={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function ViewToggle({ season, view, teamId }: { season: number | "all"; view: View; teamId: number }) {
  const opts: { key: View; label: string }[] = [
    { key: "all", label: "All Trades" },
    { key: "team", label: "By Team" },
  ];
  const seasonQ = season === "all" ? "" : `&season=${season}`;
  return (
    <div className="mb-2 flex gap-1.5 px-1">
      {opts.map((o) => (
        <Link
          key={o.key}
          href={`/trades?view=${o.key}${o.key === "team" ? `&team=${teamId}` : ""}${seasonQ}`}
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

function SeasonTabs({
  seasons,
  active,
  view,
  teamId,
}: {
  seasons: number[];
  active: number | "all";
  view: View;
  teamId: number;
}) {
  const teamQ = view === "team" ? `&view=team&team=${teamId}` : "";
  return (
    <div className="mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link
        href={`/trades?${teamQ.replace(/^&/, "")}`}
        className={`shrink-0 rounded-full px-3.5 py-1.5 font-cond text-sm font-semibold transition-colors ${
          active === "all" ? "bg-teal text-white" : "bg-card text-text-muted hover:bg-card-hover"
        }`}
      >
        All
      </Link>
      {seasons.map((s) => (
        <Link
          key={s}
          href={`/trades?season=${s}${teamQ}`}
          className={`shrink-0 rounded-full px-3.5 py-1.5 font-cond text-sm font-semibold transition-colors ${
            s === active ? "bg-teal text-white" : "bg-card text-text-muted hover:bg-card-hover"
          }`}
        >
          {s}
        </Link>
      ))}
    </div>
  );
}

function TeamTabs({ active, season }: { active: number; season: number | "all" }) {
  const seasonQ = season === "all" ? "" : `&season=${season}`;
  return (
    <div className="mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TEAMS.map((t) => (
        <Link
          key={t.id}
          href={`/trades?view=team&team=${t.id}${seasonQ}`}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-cond text-sm font-semibold transition-colors ${
            t.id === active ? "bg-teal text-white" : "bg-card text-text-muted hover:bg-card-hover"
          }`}
        >
          <TeamAvatar team={t} size="sm" />
          {t.name}
        </Link>
      ))}
    </div>
  );
}

function TradeCard({ trade }: { trade: Trade }) {
  return (
    <Card>
      <SectionHeader>
        {trade.season} - {weekLabel(trade.week)} - {trade.date}
      </SectionHeader>
      <div className="grid gap-px bg-section/60 sm:grid-cols-2">
        {trade.legs.map((leg, i) => (
          <TradeLegBox key={i} leg={leg} />
        ))}
      </div>
    </Card>
  );
}

function TradeLegBox({ leg }: { leg: TradeLeg }) {
  return (
    <div className="bg-card px-3 py-2.5">
      <div className="mb-2 flex items-center gap-2">
        {leg.toTeam ? <TeamAvatar team={leg.toTeam} size="sm" /> : <span className="h-8 w-8 shrink-0 rounded-full bg-section" />}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{leg.toTeam?.name ?? leg.toName} receives</div>
          <div className="truncate text-[11px] text-text-muted">from {leg.fromTeam?.name ?? leg.fromName}</div>
        </div>
      </div>
      <div className="space-y-1.5">
        {leg.items.map((item, i) =>
          item.kind === "player" ? (
            <div key={i} className="flex items-center gap-2">
              <PlayerBadge playerId={item.playerId!} pos={item.pos ?? ""} name={item.name ?? ""} />
              <Link href={`/players/${item.playerId}`} className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{item.name}</div>
                <div className="truncate text-[11px] text-text-muted">
                  {item.pos}
                  {item.proTeam ? ` - ${item.proTeam}` : ""}
                </div>
              </Link>
            </div>
          ) : (
            <div key={i} className="flex items-center gap-2 pl-1">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-section text-[10px] font-bold text-text-muted">
                PK
              </span>
              <div className="truncate text-sm text-text-muted">{item.label}</div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
