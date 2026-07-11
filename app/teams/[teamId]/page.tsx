import Link from "next/link";
import { notFound } from "next/navigation";
import { getStandings, getSnapshot } from "@/lib/sleeper";
import { getTeam } from "@/lib/teams";
import { getAllTimeRecords, getFranchiseSeasons } from "@/lib/league-data";
import { getFranchiseGames, shortWeek, type FranchiseGame, type GamePlayer } from "@/lib/games";
import { Card, SectionHeader, Hexagon, TeamAvatar, Pill, rankBadgeTone } from "@/components/ui";
import { PlayerBadge } from "@/components/player-badge";
import type { FranchiseSeason, TeamMeta } from "@/lib/types";

export const revalidate = 3600;

interface OpponentTeamRecord {
  key: string;
  name: string;
  team?: TeamMeta;
  games: number;
  pointsAgainst: number;
  avgAgainst: number;
}

interface TeamPlayerRecord {
  playerId: number;
  name: string;
  pos: string;
  proTeam: string;
  games: number;
  points: number;
  avg: number;
  best: number;
  bestGameId?: string;
  totalTDs: number;
  passYds: number;
  rushYds: number;
  recYds: number;
}

export default async function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const id = Number(teamId);
  const team = getTeam(id);
  if (!team) notFound();

  const snapshot = getSnapshot();
  const [standings, franchiseGames, seasons, allTimeRecords] = await Promise.all([
    getStandings(),
    getFranchiseGames(id),
    Promise.resolve(getFranchiseSeasons(id)),
    Promise.resolve(getAllTimeRecords()),
  ]);
  const standing = standings.find((s) => s.team.id === id);
  const record = allTimeRecords.find((r) => r.team.id === id);
  const rank = standing?.rank;
  const recent = franchiseGames.slice(0, 8);
  const gameStats = buildGameStats(franchiseGames);
  const teamPlayers = buildTeamPlayers(franchiseGames);
  const playerBoards = buildPlayerBoards(teamPlayers);
  const opponentPlayers = buildOpponentPlayers(franchiseGames);
  const nemesisBoards = buildNemesisBoards(opponentPlayers);
  const opponentTeams = buildOpponentTeams(franchiseGames);
  const opponentTeamBoards = buildOpponentTeamBoards(opponentTeams);

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl px-4 py-5 text-white"
        style={{ background: `linear-gradient(180deg, ${team.primary} 0%, ${team.secondary} 160%)` }}
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <TeamAvatar team={team} size="xl" />
            {rank ? (
              <span className="absolute -left-2 -top-1">
                <Hexagon value={rank} tone={rankBadgeTone(rank)} size="md" />
              </span>
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="font-cond text-3xl font-bold leading-none">{team.name}</div>
            <div className="mt-1.5 font-cond text-base text-white/90">
              {team.manager}
              {standing ? (
                <>
                  {" "}
                  - {snapshot.season}: {standing.wins}-{standing.losses}
                  {standing.ties ? `-${standing.ties}` : ""} - {standing.streak}
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <HeroStat label="Games" value={String(gameStats.games)} />
          <HeroStat label="Win %" value={gameStats.pct.toFixed(3).replace(/^0/, "")} />
          <HeroStat label="Titles" value={String(record?.championships ?? 0)} />
          <HeroStat label="Best" value={record?.bestFinish ? `#${record.bestFinish}` : "-"} />
        </div>
      </div>

      <Card>
        <SectionHeader>All-Time Team Stats</SectionHeader>
        <div className="grid grid-cols-3 gap-px bg-section/70 sm:grid-cols-4">
          <Stat label="Record" value={`${gameStats.wins}-${gameStats.losses}${gameStats.ties ? `-${gameStats.ties}` : ""}`} />
          <Stat label="Points For" value={gameStats.pointsFor.toFixed(1)} />
          <Stat label="Points Against" value={gameStats.pointsAgainst.toFixed(1)} />
          <Stat label="Avg PF" value={gameStats.avgFor.toFixed(1)} />
          <Stat label="High Score" value={gameStats.highest?.self.total.toFixed(1) ?? "-"} />
          <Stat label="Low Score" value={gameStats.lowest?.self.total.toFixed(1) ?? "-"} />
          <Stat label="Biggest Win" value={gameStats.biggestWin ? `+${gameStats.biggestWin.margin.toFixed(1)}` : "-"} />
          <Stat label="Biggest Loss" value={gameStats.biggestLoss ? gameStats.biggestLoss.margin.toFixed(1) : "-"} />
          <Stat label="Seasons" value={String(record?.seasons ?? seasons.length)} />
          <Stat label="Runner Up" value={String(record?.runnerUps ?? 0)} />
          <Stat label="Podiums" value={String(record?.podiums ?? 0)} />
          <Stat label="Points Diff" value={gameStats.pointDiff.toFixed(1)} />
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <GameRecordCard title="Highest Score" item={gameStats.highest} />
        <GameRecordCard title="Lowest Score" item={gameStats.lowest} />
        <GameRecordCard title="Biggest Win" item={gameStats.biggestWin} />
        <GameRecordCard title="Biggest Loss" item={gameStats.biggestLoss} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PlayerBoard title="Most Points" players={playerBoards.points} value={(p) => p.points.toFixed(1)} sub={(p) => `${p.games} GP - ${p.avg.toFixed(1)} avg`} />
        <PlayerBoard title="Most Games" players={playerBoards.games} value={(p) => String(p.games)} sub={(p) => `${p.points.toFixed(1)} pts`} />
        <PlayerBoard title="Best Average" players={playerBoards.avg} value={(p) => p.avg.toFixed(1)} sub={(p) => `${p.games} GP minimum 5 starts`} />
        <PlayerBoard title="Best Single Game" players={playerBoards.best} value={(p) => p.best.toFixed(1)} sub={(p) => `${p.points.toFixed(1)} career pts`} />
        <PlayerBoard title="Most TDs" players={playerBoards.tds} value={(p) => String(p.totalTDs)} sub={(p) => `${p.pos} - ${p.games} GP`} />
        <PlayerBoard title="Yardage Kings" players={playerBoards.yards} value={(p) => formatNumber(p.passYds + p.rushYds + p.recYds)} sub={(p) => `${p.passYds} pass, ${p.rushYds} rush, ${p.recYds} rec`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PlayerBoard
          title="Biggest Nemeses"
          players={nemesisBoards.best}
          value={(p) => p.avg.toFixed(1)}
          sub={(p) => `${p.games} GP vs this team`}
        />
        <PlayerBoard
          title="Easy Outs"
          players={nemesisBoards.worst}
          value={(p) => p.avg.toFixed(1)}
          sub={(p) => `${p.games} GP vs this team`}
        />
      </div>

      <TeamBoard title="Opponents (by avg points scored against you)" teams={opponentTeamBoards.all} />

      {recent.length > 0 && (
        <Card>
          <SectionHeader>Recent Games</SectionHeader>
          {recent.map((fg, i) => (
            <GameRow key={fg.game.id} fg={fg} alt={i % 2 === 1} />
          ))}
        </Card>
      )}

      {seasons.length > 0 && (
        <Card>
          <SectionHeader>Season by Season</SectionHeader>
          <div className="flex items-center gap-3 border-b border-border bg-section px-4 py-1.5 font-cond text-xs font-semibold uppercase tracking-wide text-text-muted">
            <span className="w-12">Year</span>
            <span className="w-8 text-center">Fin</span>
            <span className="flex-1">As</span>
            <span className="w-12 text-center">W-L</span>
            <span className="w-14 text-right">PF</span>
          </div>
          {seasons.map((s, i) => (
            <SeasonRow key={s.season} season={s} alt={i % 2 === 1} />
          ))}
        </Card>
      )}

      <p className="px-1 text-xs text-text-muted">
        Team profiles count regular season and real championship-bracket playoff games. Consolation matches are excluded from all-time records.
      </p>
    </div>
  );
}

function buildGameStats(franchiseGames: FranchiseGame[]) {
  const wins = franchiseGames.filter((fg) => fg.result === "W").length;
  const losses = franchiseGames.filter((fg) => fg.result === "L").length;
  const ties = franchiseGames.filter((fg) => fg.result === "T").length;
  const pointsFor = round(franchiseGames.reduce((sum, fg) => sum + fg.self.total, 0));
  const pointsAgainst = round(franchiseGames.reduce((sum, fg) => sum + fg.opp.total, 0));
  const withMargin = franchiseGames.map((fg) => ({ ...fg, margin: round(fg.self.total - fg.opp.total) }));
  const highest = [...withMargin].sort((a, b) => b.self.total - a.self.total)[0];
  const lowest = [...withMargin].sort((a, b) => a.self.total - b.self.total)[0];
  const biggestWin = [...withMargin].filter((fg) => fg.margin > 0).sort((a, b) => b.margin - a.margin)[0];
  const biggestLoss = [...withMargin].filter((fg) => fg.margin < 0).sort((a, b) => a.margin - b.margin)[0];

  return {
    games: franchiseGames.length,
    wins,
    losses,
    ties,
    pct: franchiseGames.length ? wins / franchiseGames.length : 0,
    pointsFor,
    pointsAgainst,
    pointDiff: round(pointsFor - pointsAgainst),
    avgFor: franchiseGames.length ? pointsFor / franchiseGames.length : 0,
    highest,
    lowest,
    biggestWin,
    biggestLoss,
  };
}

function buildTeamPlayers(franchiseGames: FranchiseGame[]): TeamPlayerRecord[] {
  const map = new Map<number, TeamPlayerRecord>();

  for (const fg of franchiseGames) {
    for (const player of fg.self.players) {
      if (!player.started) continue;
      const rec =
        map.get(player.playerId) ??
        ({
          playerId: player.playerId,
          name: player.name,
          pos: player.pos,
          proTeam: player.proTeam,
          games: 0,
          points: 0,
          avg: 0,
          best: 0,
          totalTDs: 0,
          passYds: 0,
          rushYds: 0,
          recYds: 0,
        } satisfies TeamPlayerRecord);
      addPlayerGame(rec, player, fg.game.id);
      map.set(player.playerId, rec);
    }
  }

  return [...map.values()]
    .map((player) => ({ ...player, points: round(player.points), avg: player.games ? round(player.points / player.games) : 0 }))
    .sort((a, b) => b.points - a.points);
}

function addPlayerGame(rec: TeamPlayerRecord, player: GamePlayer, gameId: string) {
  rec.name = player.name;
  rec.pos = player.pos;
  rec.proTeam = player.proTeam;
  rec.games += 1;
  rec.points += player.points;
  if (player.points > rec.best) {
    rec.best = player.points;
    rec.bestGameId = gameId;
  }
  rec.passYds += player.stats.passYds ?? 0;
  rec.rushYds += player.stats.rushYds ?? 0;
  rec.recYds += player.stats.recYds ?? 0;
  rec.totalTDs +=
    (player.stats.passTD ?? 0) +
    (player.stats.rushTD ?? 0) +
    (player.stats.recTD ?? 0) +
    (player.stats.defTD ?? 0) +
    (player.stats.defRetTD ?? 0);
}

function buildOpponentPlayers(franchiseGames: FranchiseGame[]): TeamPlayerRecord[] {
  const map = new Map<number, TeamPlayerRecord>();

  for (const fg of franchiseGames) {
    for (const player of fg.opp.players) {
      if (!player.started) continue;
      const rec =
        map.get(player.playerId) ??
        ({
          playerId: player.playerId,
          name: player.name,
          pos: player.pos,
          proTeam: player.proTeam,
          games: 0,
          points: 0,
          avg: 0,
          best: 0,
          totalTDs: 0,
          passYds: 0,
          rushYds: 0,
          recYds: 0,
        } satisfies TeamPlayerRecord);
      addPlayerGame(rec, player, fg.game.id);
      map.set(player.playerId, rec);
    }
  }

  return [...map.values()]
    .map((player) => ({ ...player, points: round(player.points), avg: player.games ? round(player.points / player.games) : 0 }))
    .sort((a, b) => b.avg - a.avg);
}

function buildNemesisBoards(opponentPlayers: TeamPlayerRecord[]) {
  const eligible = opponentPlayers.filter((p) => p.games >= 2);
  const skillOnly = eligible.filter((p) => p.pos !== "K" && p.pos !== "DEF");
  return {
    best: eligible.slice(0, 5).sort((a, b) => b.avg - a.avg),
    worst: [...skillOnly].sort((a, b) => a.avg - b.avg).slice(0, 5),
  };
}

function buildOpponentTeams(franchiseGames: FranchiseGame[]): OpponentTeamRecord[] {
  const map = new Map<string, OpponentTeamRecord>();

  for (const fg of franchiseGames) {
    const key = fg.opp.team ? String(fg.opp.team.id) : fg.opp.name;
    const rec =
      map.get(key) ??
      ({
        key,
        name: fg.opp.name,
        team: fg.opp.team,
        games: 0,
        pointsAgainst: 0,
        avgAgainst: 0,
      } satisfies OpponentTeamRecord);
    rec.name = fg.opp.name;
    rec.team = fg.opp.team;
    rec.games += 1;
    rec.pointsAgainst += fg.opp.total;
    map.set(key, rec);
  }

  return [...map.values()].map((r) => ({ ...r, pointsAgainst: round(r.pointsAgainst), avgAgainst: r.games ? round(r.pointsAgainst / r.games) : 0 }));
}

function buildOpponentTeamBoards(teams: OpponentTeamRecord[]) {
  const eligible = teams.filter((t) => t.games >= 2);
  return {
    all: [...eligible].sort((a, b) => b.avgAgainst - a.avgAgainst),
  };
}

function buildPlayerBoards(players: TeamPlayerRecord[]) {
  const top = (list: TeamPlayerRecord[]) => list.slice(0, 5);
  return {
    points: top([...players].sort((a, b) => b.points - a.points)),
    games: top([...players].sort((a, b) => b.games - a.games || b.points - a.points)),
    avg: top([...players].filter((p) => p.games >= 5).sort((a, b) => b.avg - a.avg || b.games - a.games)),
    best: top([...players].sort((a, b) => b.best - a.best)),
    tds: top([...players].filter((p) => p.totalTDs > 0).sort((a, b) => b.totalTDs - a.totalTDs || b.points - a.points)),
    yards: top([...players].filter((p) => p.passYds + p.rushYds + p.recYds > 0).sort((a, b) => b.passYds + b.rushYds + b.recYds - (a.passYds + a.rushYds + a.recYds))),
  };
}

function GameRow({ fg, alt }: { fg: FranchiseGame; alt: boolean }) {
  return (
    <Link
      href={`/games/${fg.game.id}`}
      className={`flex items-center gap-3 px-4 py-2.5 ${alt ? "bg-card" : "bg-row"} hover:bg-card-hover`}
    >
      <span className="w-16 shrink-0 font-cond text-xs text-text-muted">
        {fg.game.season} {shortWeek(fg.game.week)}
      </span>
      <Pill tone={fg.result === "W" ? "win" : fg.result === "L" ? "loss" : "default"}>{fg.result}</Pill>
      {fg.opp.team ? <TeamAvatar team={fg.opp.team} size="sm" /> : <span className="h-8 w-8 shrink-0 rounded-full bg-section" />}
      <span className="min-w-0 flex-1 truncate text-sm">
        vs <span className="font-semibold">{fg.opp.name}</span>
      </span>
      <span className="font-cond text-base font-semibold tabular-nums">
        {fg.self.total.toFixed(1)} - {fg.opp.total.toFixed(1)}
      </span>
      <span className="text-text-dim">&gt;</span>
    </Link>
  );
}

function SeasonRow({ season, alt }: { season: FranchiseSeason; alt: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2 ${alt ? "bg-card" : "bg-row"}`}>
      <span className="w-12 font-cond text-sm font-semibold">{season.season}</span>
      <span className="flex w-8 justify-center">
        <Hexagon value={season.finalRank} tone={rankBadgeTone(season.finalRank)} size="sm" />
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-text-muted">{season.name}</span>
      <span className="w-12 text-center font-cond text-sm tabular-nums">
        {season.wins}-{season.losses}
      </span>
      <span className="w-14 text-right font-cond text-sm font-semibold tabular-nums">{season.pointsFor.toFixed(0)}</span>
    </div>
  );
}

function GameRecordCard({ title, item }: { title: string; item?: FranchiseGame & { margin: number } }) {
  return (
    <Card className="p-3">
      <div className="font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted">{title}</div>
      {item ? (
        <Link href={`/games/${item.game.id}`} className="mt-1 block hover:text-teal">
          <div className="font-cond text-2xl font-bold tabular-nums">
            {item.self.total.toFixed(1)} - {item.opp.total.toFixed(1)}
          </div>
          <div className="truncate text-xs text-text-muted">
            {item.game.season} {shortWeek(item.game.week)} vs {item.opp.name}
          </div>
        </Link>
      ) : (
        <div className="mt-1 text-sm text-text-muted">No game yet</div>
      )}
    </Card>
  );
}

function PlayerBoard({
  title,
  players,
  value,
  sub,
}: {
  title: string;
  players: TeamPlayerRecord[];
  value: (player: TeamPlayerRecord) => string;
  sub: (player: TeamPlayerRecord) => string;
}) {
  return (
    <Card>
      <div className="border-b border-border bg-section px-3 py-2 font-cond text-base font-semibold">{title}</div>
      {players.length ? (
        players.map((player, index) => (
          <div
            key={`${title}-${player.playerId}`}
            className={`flex items-center gap-2 px-3 py-2 ${index % 2 ? "bg-card" : "bg-row"} hover:bg-card-hover`}
          >
            <div className="w-5 shrink-0 text-center font-cond text-sm font-bold text-text-muted">{index + 1}</div>
            <PlayerBadge playerId={player.playerId} pos={player.pos} name={player.name} />
            <Link href={`/players/${player.playerId}`} className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{player.name}</div>
              <div className="truncate text-[11px] text-text-muted">{sub(player)}</div>
            </Link>
            <div className="shrink-0 text-right font-cond text-lg font-bold tabular-nums">{value(player)}</div>
          </div>
        ))
      ) : (
        <div className="px-3 py-4 text-sm text-text-muted">No players yet.</div>
      )}
    </Card>
  );
}

function TeamBoard({ title, teams }: { title: string; teams: OpponentTeamRecord[] }) {
  return (
    <Card>
      <div className="border-b border-border bg-section px-3 py-2 font-cond text-base font-semibold">{title}</div>
      {teams.length ? (
        teams.map((t, index) => (
          <div
            key={`${title}-${t.key}`}
            className={`flex items-center gap-2 px-3 py-2 ${index % 2 ? "bg-card" : "bg-row"} hover:bg-card-hover`}
          >
            <div className="w-5 shrink-0 text-center font-cond text-sm font-bold text-text-muted">{index + 1}</div>
            {t.team ? <TeamAvatar team={t.team} size="md" /> : <span className="h-11 w-11 shrink-0 rounded-full bg-section" />}
            {t.team ? (
              <Link href={`/teams/${t.team.id}`} className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{t.name}</div>
                <div className="truncate text-[11px] text-text-muted">{t.games} GP vs this team</div>
              </Link>
            ) : (
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{t.name}</div>
                <div className="truncate text-[11px] text-text-muted">{t.games} GP vs this team</div>
              </div>
            )}
            <div className="shrink-0 text-right font-cond text-lg font-bold tabular-nums">{t.avgAgainst.toFixed(1)}</div>
          </div>
        ))
      ) : (
        <div className="px-3 py-4 text-sm text-text-muted">No data yet.</div>
      )}
    </Card>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/15 py-2">
      <div className="font-cond text-xl font-bold tabular-nums">{value}</div>
      <div className="font-cond text-[11px] uppercase tracking-wide text-white/80">{label}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-2 py-2.5 text-center">
      <div className="font-cond text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
    </div>
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
