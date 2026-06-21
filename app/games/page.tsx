import Link from "next/link";
import {
  getSeasonGames,
  weekLabel,
  isPlayoffBracketGame,
  isConsolationGame,
  type Game,
} from "@/lib/games";
import { HISTORY_SEASONS } from "@/lib/league-data";
import { Card, PageIntro, TeamAvatar, Score } from "@/components/ui";
import { RoundSelect } from "./round-select";

export const revalidate = 3600;

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; week?: string }>;
}) {
  const { season: sParam, week: wParam } = await searchParams;
  const season = HISTORY_SEASONS.includes(Number(sParam))
    ? Number(sParam)
    : HISTORY_SEASONS[HISTORY_SEASONS.length - 1];

  const games = await getSeasonGames(season);
  const weeks = [...new Set(games.map((g) => g.week))].sort((a, b) => a - b);
  const week = weeks.includes(Number(wParam)) ? Number(wParam) : weeks[0];
  const rounds = weeks.map((w) => ({ week: w, label: weekLabel(w) }));
  const weekGames = games.filter((g) => g.week === week);
  const sections = gameSections(week, weekGames);

  return (
    <div>
      <PageIntro title="Every Game" subtitle={`${games.length} games - ${season} - tap a game for the full boxscore`} />

      <div className="mb-2 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {HISTORY_SEASONS.map((s) => (
          <Link
            key={s}
            href={`/games?season=${s}`}
            className={`shrink-0 rounded-full px-3.5 py-1.5 font-cond text-sm font-semibold transition-colors ${
              s === season ? "bg-teal text-white" : "bg-card text-text-muted hover:bg-card-hover"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <RoundSelect season={season} selectedWeek={week} rounds={rounds} />

      <div className="space-y-5">
        {sections.map((section) => (
          <GameSection key={section.title} title={section.title} games={section.games} />
        ))}
      </div>
    </div>
  );
}

function gameSections(week: number, games: Game[]): { title: string; games: Game[] }[] {
  if (week <= 14) return [{ title: weekLabel(week), games }];

  const playoffGames = games.filter(isPlayoffBracketGame);
  const consolationGames = games.filter(isConsolationGame);
  const sections: { title: string; games: Game[] }[] = [];

  if (playoffGames.length) sections.push({ title: playoffSectionTitle(week), games: playoffGames });
  if (consolationGames.length) sections.push({ title: "Consolation (doesn't count)", games: consolationGames });

  return sections.length ? sections : [{ title: weekLabel(week), games }];
}

function playoffSectionTitle(week: number): string {
  if (week === 17) return "Championship Bracket";
  if (week === 16) return "Semifinal Bracket";
  return "Playoff Bracket";
}

function GameSection({ title, games }: { title: string; games: Game[] }) {
  return (
    <section>
      <div className="mb-2 px-1 font-cond text-sm font-semibold uppercase tracking-wide text-text-muted">{title}</div>
      <div className="space-y-2">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </section>
  );
}

function GameCard({ game }: { game: Game }) {
  const homeWin = game.home.total >= game.away.total;

  return (
    <Link href={`/games/${game.id}`}>
      <Card className="flex items-center gap-3 px-3 py-3 hover:bg-card-hover">
        <div className="flex flex-1 flex-col gap-2">
          <Side name={game.away.name} team={game.away.team} total={game.away.total} win={!homeWin} />
          <Side name={game.home.name} team={game.home.team} total={game.home.total} win={homeWin} />
        </div>
        <span className="text-text-dim">&gt;</span>
      </Card>
    </Link>
  );
}

function Side({
  name,
  team,
  total,
  win,
}: {
  name: string;
  team?: { id: number; abbrev: string; primary: string; secondary: string; logo?: string };
  total: number;
  win: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${win ? "" : "opacity-60"}`}>
      {team ? <TeamAvatar team={team as never} size="sm" /> : <span className="h-7 w-7 rounded-full bg-section" />}
      <span className="flex-1 truncate font-cond text-base font-semibold">{name}</span>
      <Score value={total} className="text-lg" dim={!win} />
    </div>
  );
}
