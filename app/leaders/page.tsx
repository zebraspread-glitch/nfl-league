import Link from "next/link";
import { getPlayerSummaries, type PlayerSummary } from "@/lib/players";
import { resolvePlayerImage, POS_COLOR } from "@/lib/player-images";
import { Card, PageIntro, SectionHeader, SectionTitle } from "@/components/ui";

export const revalidate = 3600;

export const metadata = { title: "All-Time Leaders - MGL Fantasy" };

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
const MIN_STARTS_FOR_AVG = 20;

function seasonRange(player: PlayerSummary): string {
  return player.firstSeason === player.lastSeason
    ? `${player.firstSeason}`
    : `${player.firstSeason}–${player.lastSeason}`;
}

function PlayerAvatar({ player, size = 40 }: { player: PlayerSummary; size?: number }) {
  const img = resolvePlayerImage(player.playerId, player.pos, player.name);
  if (img.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={img.imageUrl}
        alt={player.name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-full bg-section ${img.isLogo ? "object-contain p-1" : "object-cover"}`}
        suppressHydrationWarning
      />
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-cond text-xs font-bold text-white"
      style={{ width: size, height: size, background: POS_COLOR[player.pos] ?? "#9aa1ad" }}
    >
      {player.pos || "-"}
    </span>
  );
}

export default async function LeadersPage() {
  const players = await getPlayerSummaries();

  const topN = (
    metric: (player: PlayerSummary) => number,
    options: { n?: number; filter?: (player: PlayerSummary) => boolean } = {},
  ): PlayerSummary[] => {
    const { n = 5, filter } = options;
    return (filter ? players.filter(filter) : players)
      .filter((player) => metric(player) > 0)
      .sort((a, b) => metric(b) - metric(a) || b.totalPoints - a.totalPoints)
      .slice(0, n);
  };

  const topScorers = players.slice(0, 25);
  const byPosition = POSITIONS.map((pos) => ({ pos, leader: players.find((player) => player.pos === pos) }));

  return (
    <div className="space-y-3">
      <PageIntro
        title="All-Time Leaders"
        subtitle="Career fantasy production for MGL teams (2021–2025, started games)"
      />

      <Card>
        <SectionHeader>Top Scorers by Position</SectionHeader>
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
          {byPosition.map(({ pos, leader }) => (
            <div key={pos} className="bg-card p-3">
              <div className="font-cond text-xs uppercase tracking-wide text-text-muted">{pos}</div>
              {leader ? (
                <Link href={`/players/${leader.playerId}`} className="mt-1.5 flex items-center gap-2 hover:opacity-80">
                  <PlayerAvatar player={leader} size={34} />
                  <div className="min-w-0">
                    <div className="truncate font-cond text-sm font-semibold leading-tight">{leader.name}</div>
                    <div className="font-cond text-lg font-bold tabular-nums leading-tight">
                      {leader.totalPoints.toFixed(0)}
                      <span className="ml-1 text-xs font-medium text-text-muted">pts</span>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="mt-2 text-sm text-text-dim">—</div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeader>Career Scoring Leaders</SectionHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="bg-section font-cond text-xs uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2 text-left">Player</th>
                <th className="px-2 py-2 text-center">Yrs</th>
                <th className="px-2 py-2 text-center">GP</th>
                <th className="px-2 py-2 text-center">Avg</th>
                <th className="px-2 py-2 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {topScorers.map((player, index) => (
                <tr key={player.playerId} className={`border-t border-border ${index % 2 ? "bg-card" : "bg-row"}`}>
                  <td className="px-3 py-2">
                    <Link href={`/players/${player.playerId}`} className="flex items-center gap-2 hover:opacity-80">
                      <span className="w-5 text-right font-cond text-xs font-bold text-text-dim">{index + 1}</span>
                      <PlayerAvatar player={player} size={38} />
                      <div className="min-w-0">
                        <div className="truncate font-cond text-base font-semibold leading-tight">{player.name}</div>
                        <div className="font-cond text-xs text-text-muted">
                          {player.pos}
                          {player.proTeam ? ` · ${player.proTeam}` : ""}
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-center font-cond text-xs tabular-nums text-text-muted">{seasonRange(player)}</td>
                  <td className="px-2 py-2 text-center font-cond tabular-nums text-text-muted">{player.gamesPlayed}</td>
                  <td className="px-2 py-2 text-center font-cond tabular-nums text-text-muted">{player.avgPoints.toFixed(1)}</td>
                  <td className="px-2 py-2 text-right font-cond text-lg font-bold tabular-nums">{player.totalPoints.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <SectionTitle>Games & Longevity</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <MiniBoard
          title="Most Games Played"
          players={topN((p) => p.gamesPlayed)}
          value={(p) => `${p.gamesPlayed}`}
          caption={(p) => seasonRange(p)}
        />
        <MiniBoard
          title="Most Games for One Team"
          players={topN((p) => p.oneTeamGames)}
          value={(p) => `${p.oneTeamGames}`}
          caption={(p) => p.oneTeamGamesTeamName}
        />
        <MiniBoard
          title="Most Seasons"
          players={topN((p) => p.seasons.length)}
          value={(p) => `${p.seasons.length}`}
          caption={(p) => seasonRange(p)}
        />
        <MiniBoard
          title="Most Franchises Played For"
          players={topN((p) => p.teamCount, { filter: (p) => p.teamCount > 1 })}
          value={(p) => `${p.teamCount}`}
          caption={(p) => `${p.pos} · ${p.gamesPlayed} GP`}
        />
      </div>

      <SectionTitle>Loyalty & Peaks</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <MiniBoard
          title="Most Points for One Team"
          players={topN((p) => p.oneTeamPoints)}
          value={(p) => p.oneTeamPoints.toFixed(0)}
          caption={(p) => p.oneTeamPointsTeamName}
        />
        <MiniBoard
          title={`Best Per-Game Avg (min ${MIN_STARTS_FOR_AVG} G)`}
          players={topN((p) => p.avgPoints, { filter: (p) => p.starts >= MIN_STARTS_FOR_AVG })}
          value={(p) => p.avgPoints.toFixed(1)}
          caption={(p) => `${p.gamesPlayed} GP`}
        />
        <MiniBoard
          title="Biggest Single Game"
          players={topN((p) => p.bestGamePoints)}
          value={(p) => p.bestGamePoints.toFixed(1)}
          caption={(p) => p.pos}
          href={(p) => (p.bestGameId ? `/games/${p.bestGameId}` : `/players/${p.playerId}`)}
        />
        <MiniBoard
          title="Most Touchdowns"
          players={topN((p) => p.totalTDs)}
          value={(p) => `${p.totalTDs}`}
          caption={(p) => p.pos}
        />
      </div>

      <SectionTitle>Yards & Scores</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MiniBoard title="Passing Yards" players={topN((p) => p.passYds)} value={(p) => p.passYds.toLocaleString()} caption={(p) => p.proTeam || p.pos} />
        <MiniBoard title="Passing TDs" players={topN((p) => p.passTD)} value={(p) => `${p.passTD}`} caption={(p) => p.proTeam || p.pos} />
        <MiniBoard title="Rushing Yards" players={topN((p) => p.rushYds)} value={(p) => p.rushYds.toLocaleString()} caption={(p) => `${p.pos} · ${p.proTeam}`} />
        <MiniBoard title="Rushing TDs" players={topN((p) => p.rushTD)} value={(p) => `${p.rushTD}`} caption={(p) => `${p.pos} · ${p.proTeam}`} />
        <MiniBoard title="Receiving Yards" players={topN((p) => p.recYds)} value={(p) => p.recYds.toLocaleString()} caption={(p) => `${p.pos} · ${p.proTeam}`} />
        <MiniBoard title="Receiving TDs" players={topN((p) => p.recTD)} value={(p) => `${p.recTD}`} caption={(p) => `${p.pos} · ${p.proTeam}`} />
      </div>

      <SectionTitle>Specialists & Defense</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniBoard title="Field Goals Made" players={topN((p) => p.fgMade)} value={(p) => `${p.fgMade}`} caption={(p) => p.proTeam || "K"} />
        <MiniBoard title="Sacks (D/ST)" players={topN((p) => p.defSack)} value={(p) => `${p.defSack}`} caption={(p) => p.name} />
        <MiniBoard title="Interceptions (D/ST)" players={topN((p) => p.defInt)} value={(p) => `${p.defInt}`} caption={(p) => p.name} />
        <MiniBoard title="Defensive TDs" players={topN((p) => p.defTD)} value={(p) => `${p.defTD}`} caption={(p) => p.name} />
      </div>

      <p className="px-1 pb-2 text-xs text-text-dim">
        Totals count only weeks a player was in a starting lineup, across regular-season and championship-bracket games.
        &ldquo;For one team&rdquo; leaders reflect the single MGL franchise a player produced most for.
      </p>
    </div>
  );
}

function MiniBoard({
  title,
  players,
  value,
  caption,
  href = (player) => `/players/${player.playerId}`,
}: {
  title: string;
  players: PlayerSummary[];
  value: (player: PlayerSummary) => string;
  caption: (player: PlayerSummary) => string;
  href?: (player: PlayerSummary) => string;
}) {
  return (
    <Card>
      <SectionHeader>{title}</SectionHeader>
      <div>
        {players.length === 0 ? (
          <div className="px-3 py-4 text-sm text-text-dim">No data.</div>
        ) : (
          players.map((player, index) => (
            <Link
              key={player.playerId}
              href={href(player)}
              className={`flex items-center gap-2 px-3 py-2 ${index % 2 ? "bg-card" : "bg-row"} hover:bg-card-hover`}
            >
              <span className="w-4 text-right font-cond text-xs font-bold text-text-dim">{index + 1}</span>
              <PlayerAvatar player={player} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-cond text-sm font-semibold leading-tight">{player.name}</div>
                <div className="truncate font-cond text-[11px] text-text-muted leading-tight">{caption(player)}</div>
              </div>
              <span className="w-14 text-right font-cond text-lg font-bold tabular-nums">{value(player)}</span>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}
