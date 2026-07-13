import Link from "next/link";
import { getPlayerSummaries, type PlayerSummary } from "@/lib/players";
import { resolvePlayerImage, POS_COLOR } from "@/lib/player-images";
import { Card, PageIntro, SectionHeader } from "@/components/ui";

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

  const topScorers = players.slice(0, 25);
  const byPosition = POSITIONS.map((pos) => ({
    pos,
    leader: players.find((player) => player.pos === pos),
  }));
  const bestAverage = [...players]
    .filter((player) => player.starts >= MIN_STARTS_FOR_AVG)
    .sort((a, b) => b.avgPoints - a.avgPoints)
    .slice(0, 5);
  const mostTDs = [...players].sort((a, b) => b.totalTDs - a.totalTDs).slice(0, 5);

  return (
    <div className="space-y-3">
      <PageIntro
        title="All-Time Leaders"
        subtitle="Career fantasy points scored for MGL teams (2021–2025, started games)"
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

      <div className="grid gap-3 sm:grid-cols-2">
        <MiniBoard
          title={`Best Per-Game Avg (min ${MIN_STARTS_FOR_AVG} starts)`}
          players={bestAverage}
          value={(player) => `${player.avgPoints.toFixed(1)}`}
          caption={(player) => `${player.gamesPlayed} GP`}
        />
        <MiniBoard
          title="Most Touchdowns"
          players={mostTDs}
          value={(player) => `${player.totalTDs}`}
          caption={(player) => `${player.pos}`}
        />
      </div>

      <p className="px-1 pb-2 text-xs text-text-dim">
        Points count only weeks a player was in a starting lineup, across regular-season and championship-bracket games.
      </p>
    </div>
  );
}

function MiniBoard({
  title,
  players,
  value,
  caption,
}: {
  title: string;
  players: PlayerSummary[];
  value: (player: PlayerSummary) => string;
  caption: (player: PlayerSummary) => string;
}) {
  return (
    <Card>
      <SectionHeader>{title}</SectionHeader>
      <div>
        {players.map((player, index) => (
          <Link
            key={player.playerId}
            href={`/players/${player.playerId}`}
            className={`flex items-center gap-2 px-3 py-2 ${index % 2 ? "bg-card" : "bg-row"} hover:bg-card-hover`}
          >
            <span className="w-4 text-right font-cond text-xs font-bold text-text-dim">{index + 1}</span>
            <PlayerAvatar player={player} size={32} />
            <span className="min-w-0 flex-1 truncate font-cond text-sm font-semibold">{player.name}</span>
            <span className="font-cond text-xs text-text-dim">{caption(player)}</span>
            <span className="w-12 text-right font-cond text-lg font-bold tabular-nums">{value(player)}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
