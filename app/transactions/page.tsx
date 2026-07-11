import Link from "next/link";
import { Card, EmptyState, PageIntro, TeamAvatar } from "@/components/ui";
import { PlayerBadge } from "@/components/player-badge";
import { getAllTransactions, getTransactionSeasons, type Transaction } from "@/lib/transactions";
import { weekLabel } from "@/lib/games";
import { TEAMS } from "@/lib/teams";

export const revalidate = 86400;

type View = "all" | "team";
const PAGE_SIZE = 50;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; view?: string; team?: string; page?: string }>;
}) {
  const [{ season: seasonParam, view: viewParam, team: teamParam, page: pageParam }, allTx, seasons] =
    await Promise.all([searchParams, getAllTransactions(), getTransactionSeasons()]);

  const view: View = viewParam === "team" ? "team" : "all";
  const requestedSeason = Number(seasonParam);
  const season = seasons.includes(requestedSeason) ? requestedSeason : "all";
  const bySeason = season === "all" ? allTx : allTx.filter((t) => t.season === season);

  const requestedTeamId = Number(teamParam);
  const activeTeamId = view === "team" && TEAMS.some((t) => t.id === requestedTeamId) ? requestedTeamId : TEAMS[0].id;
  const filtered =
    view === "team" ? bySeason.filter((t) => t.fromTeam?.id === activeTeamId || t.toTeam?.id === activeTeamId) : bySeason;

  const page = Math.max(1, Number(pageParam) || 1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <PageIntro title="Transactions" subtitle={`${allTx.length} all-time adds & drops, 2021-2025`} />
      <ViewToggle season={season} view={view} teamId={activeTeamId} />
      <SeasonTabs seasons={seasons} active={season} view={view} teamId={activeTeamId} />
      {view === "team" && <TeamTabs active={activeTeamId} season={season} />}

      {pageItems.length === 0 ? (
        <EmptyState>No transactions found.</EmptyState>
      ) : (
        <Card>
          {pageItems.map((t, i) => (
            <TransactionRow key={t.id} t={t} alt={i % 2 === 1} />
          ))}
        </Card>
      )}

      <Pagination page={page} totalPages={totalPages} season={season} view={view} teamId={activeTeamId} />
    </div>
  );
}

function ViewToggle({ season, view, teamId }: { season: number | "all"; view: View; teamId: number }) {
  const opts: { key: View; label: string }[] = [
    { key: "all", label: "All Transactions" },
    { key: "team", label: "By Team" },
  ];
  const seasonQ = season === "all" ? "" : `&season=${season}`;
  return (
    <div className="mb-2 flex gap-1.5 px-1">
      {opts.map((o) => (
        <Link
          key={o.key}
          href={`/transactions?view=${o.key}${o.key === "team" ? `&team=${teamId}` : ""}${seasonQ}`}
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
        href={`/transactions?${teamQ.replace(/^&/, "")}`}
        className={`shrink-0 rounded-full px-3.5 py-1.5 font-cond text-sm font-semibold transition-colors ${
          active === "all" ? "bg-teal text-white" : "bg-card text-text-muted hover:bg-card-hover"
        }`}
      >
        All
      </Link>
      {seasons.map((s) => (
        <Link
          key={s}
          href={`/transactions?season=${s}${teamQ}`}
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
          href={`/transactions?view=team&team=${t.id}${seasonQ}`}
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

function TransactionRow({ t, alt }: { t: Transaction; alt: boolean }) {
  const team = t.type === "add" ? t.toTeam : t.fromTeam;
  const teamName = t.type === "add" ? t.toName : t.fromName;
  const source = t.type === "add" ? t.fromName : t.toName;

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 ${alt ? "bg-card" : "bg-row"}`}>
      <span
        className={`w-11 shrink-0 rounded px-1.5 py-0.5 text-center font-cond text-[11px] font-bold uppercase ${
          t.type === "add" ? "bg-teal/15 text-teal" : "bg-red-100 text-red-600"
        }`}
      >
        {t.type}
      </span>
      {t.player ? (
        <>
          <PlayerBadge playerId={t.player.playerId} pos={t.player.pos} name={t.player.name} />
          <Link href={`/players/${t.player.playerId}`} className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{t.player.name}</div>
            <div className="truncate text-[11px] text-text-muted">
              {t.player.pos}
              {t.player.proTeam ? ` - ${t.player.proTeam}` : ""}
            </div>
          </Link>
        </>
      ) : (
        <div className="min-w-0 flex-1 text-sm text-text-muted">Unknown player</div>
      )}
      <div className="w-28 shrink-0 text-right sm:w-36">
        <div className="flex items-center justify-end gap-1.5">
          {team ? <TeamAvatar team={team} size="sm" /> : null}
          <div className="min-w-0">
            <div className="truncate font-cond text-xs font-semibold leading-tight">{team?.name ?? teamName}</div>
            <div className="truncate text-[10px] text-text-dim">
              {t.type === "add" ? "from " : "to "}
              {source}
            </div>
          </div>
        </div>
        <div className="mt-0.5 text-[10px] text-text-dim">
          {weekLabel(t.week)} - {t.date}
        </div>
      </div>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  season,
  view,
  teamId,
}: {
  page: number;
  totalPages: number;
  season: number | "all";
  view: View;
  teamId: number;
}) {
  if (totalPages <= 1) return null;
  const seasonQ = season === "all" ? "" : `&season=${season}`;
  const teamQ = view === "team" ? `&view=team&team=${teamId}` : "";
  const href = (p: number) => `/transactions?page=${p}${seasonQ}${teamQ}`;

  return (
    <div className="mt-3 flex items-center justify-between px-1">
      {page > 1 ? (
        <Link href={href(page - 1)} className="rounded-lg bg-card px-3 py-1.5 font-cond text-sm font-semibold text-text-muted hover:bg-card-hover">
          &lt; Prev
        </Link>
      ) : (
        <span />
      )}
      <span className="font-cond text-sm text-text-muted">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} className="rounded-lg bg-card px-3 py-1.5 font-cond text-sm font-semibold text-text-muted hover:bg-card-hover">
          Next &gt;
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
