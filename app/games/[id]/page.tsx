import Link from "next/link";
import { notFound } from "next/navigation";
import { gameCounts, getGame, getGameLiveChart, weekLabel, type GameSide, type GamePlayer } from "@/lib/games";
import { Card, TeamAvatar, Score, SectionHeader } from "@/components/ui";
import { PlayerBadge } from "@/components/player-badge";
import { LiveMarginChart } from "@/components/live-margin-chart";
import { resolvePlayerImage } from "@/lib/player-images";

export const revalidate = 86400;

export default async function BoxscorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  const homeWin = game.home.total >= game.away.total;
  const counts = gameCounts(game);
  const chart = await getGameLiveChart(id);

  return (
    <div className="space-y-3">
      <Link href={`/games?season=${game.season}&week=${game.week}`} className="px-1 text-sm text-teal">
        &lt; {game.season} - {weekLabel(game.week)}
      </Link>

      <div
        className="rounded-xl px-4 py-5 text-white"
        style={{ background: "linear-gradient(180deg, var(--teal) 0%, var(--teal-deep) 100%)" }}
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <HeaderSide side={game.away} win={!homeWin} />
          <div className="text-center font-cond text-xs uppercase tracking-widest text-white/70">vs</div>
          <HeaderSide side={game.home} win={homeWin} />
        </div>
      </div>

      {chart && chart.points.length > 1 && (
        <Card>
          <SectionHeader>Live Margin</SectionHeader>
          <LiveMarginChart
            chart={chart}
            home={{ name: game.home.name, color: game.home.team?.primary ?? "#e8112d" }}
            away={{ name: game.away.name, color: game.away.team?.primary ?? "#2a6df0" }}
          />
        </Card>
      )}

      {counts ? (
        <div className="grid grid-cols-2 items-start gap-2">
          <TeamBox side={game.away} />
          <TeamBox side={game.home} />
        </div>
      ) : (
        <Card className="px-4 py-4 text-sm text-text-muted">
          Consolation matchup. This game is excluded from all team, manager, player, record, and profile stats.
        </Card>
      )}
    </div>
  );
}

function HeaderSide({ side, win }: { side: GameSide; win: boolean }) {
  return (
    <div className="flex flex-col items-center text-center" suppressHydrationWarning>
      {side.team ? <TeamAvatar team={side.team} size="lg" /> : <span className="h-15 w-15 rounded-full bg-white/20" />}
      <div className="mt-1 truncate font-cond text-sm font-semibold">{side.name}</div>
      <div className={`font-cond text-3xl font-bold tabular-nums ${win ? "" : "text-white/70"}`}>
        {side.total.toFixed(2)}
      </div>
    </div>
  );
}

function TeamBox({ side }: { side: GameSide }) {
  const starters = side.players.filter((p) => p.started);
  const bench = side.players.filter((p) => !p.started);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-1.5 bg-section px-2 py-2">
        {side.team && <TeamAvatar team={side.team} size="sm" />}
        <span className="min-w-0 flex-1 truncate font-cond text-sm font-semibold">{side.name}</span>
        <span className="shrink-0 font-cond text-sm font-bold tabular-nums">{side.total.toFixed(2)}</span>
      </div>
      {starters.map((p, i) => (
        <PlayerRow key={p.playerId + "-" + i} p={p} alt={i % 2 === 1} />
      ))}
      {bench.length > 0 && (
        <>
          <div className="bg-section px-2 py-1.5 font-cond text-xs font-semibold uppercase tracking-wide text-text-muted">
            Bench
          </div>
          {bench.map((p, i) => (
            <PlayerRow key={p.playerId + "-b" + i} p={p} alt={i % 2 === 1} muted />
          ))}
        </>
      )}
    </Card>
  );
}

function PlayerRow({ p, alt, muted = false }: { p: GamePlayer; alt: boolean; muted?: boolean }) {
  const { displayName } = resolvePlayerImage(p.playerId, p.pos, p.name);

  return (
    <div className={`flex items-center gap-1.5 px-2 py-2 ${alt ? "bg-card" : "bg-row"} ${muted ? "opacity-75" : ""}`}>
      <span className="w-5 shrink-0 text-center font-cond text-[10px] font-bold text-text-muted">{p.slot}</span>
      <PlayerBadge playerId={p.playerId} pos={p.pos} name={p.name} />
      <Link href={`/players/${p.playerId}`} className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{displayName}</div>
        <div className="truncate text-[10px] text-text-muted">
          {p.proTeam}
          {p.opponent ? ` - ${p.opponent}` : ""}
        </div>
      </Link>
      <Score value={p.points} className="shrink-0 text-xs" dim={p.points === 0} />
    </div>
  );
}
