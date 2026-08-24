import Link from "next/link";
import { Card, Hexagon, PageIntro, SectionHeader, TeamAvatar, TeamLink, rankBadgeTone } from "@/components/ui";
import { PLAYOFF_CUTOFF, REGULAR_SEASON_WEEKS } from "@/lib/playoff-simulator";
import {
  boardFor,
  formatChance,
  formatPrice,
  formatRecord,
  getFuturesBoard,
  getMarket,
  MARKETS,
  type FuturesBoard,
  type FuturesEntry,
  type Market,
} from "@/lib/superbowl-odds";

export const revalidate = 300;

export const metadata = { title: "Superbowl Odds - MGL Fantasy" };

export default async function SuperbowlOddsPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string }>;
}) {
  const { market: marketParam } = await searchParams;
  const market = getMarket(marketParam);
  const board = await getFuturesBoard();
  const rows = boardFor(board, market.key);
  const longest = rows[rows.length - 1];

  return (
    <div className="space-y-3">
      <PageIntro
        title="Superbowl Odds"
        subtitle={`${board.season} futures — ${
          board.completedWeeks ? `after Week ${board.completedWeeks}` : "pre-season"
        }`}
      />

      <MarketTabs active={market} />

      <div className="grid grid-cols-2 gap-2">
        <PriceTile label="Shortest" entry={rows[0]} market={market} tone="fav" />
        <PriceTile label="Longest" entry={longest} market={market} tone="dog" />
      </div>

      <Card>
        <SectionHeader>{market.title}</SectionHeader>
        <div className="flex items-center gap-2 border-b border-border bg-section px-3 py-2 font-cond text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          <span className="w-6 text-center">#</span>
          <span className="flex-1 pl-10">{market.blurb}</span>
          <span className="w-[4.25rem] shrink-0 text-center">Price</span>
        </div>

        {rows.map((entry, i) => (
          <BoardRow
            key={entry.team.id}
            entry={entry}
            rank={i + 1}
            market={market}
            best={rows[0].probability[market.key]}
            striped={i % 2 === 1}
          />
        ))}
      </Card>

      <Explainer board={board} />
    </div>
  );
}

function MarketTabs({ active }: { active: Market }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {MARKETS.map((m) => (
        <Link
          key={m.key}
          href={`/superbowl-odds?market=${m.key}`}
          scroll={false}
          className={`shrink-0 rounded-full px-3.5 py-1.5 font-cond text-sm font-semibold transition-colors ${
            m.key === active.key ? "bg-teal text-white" : "bg-card text-text-muted hover:bg-card-hover"
          }`}
        >
          {m.tab}
        </Link>
      ))}
    </div>
  );
}

/** The two ends of the board — who the book likes and who it has written off. */
function PriceTile({
  label,
  entry,
  market,
  tone,
}: {
  label: string;
  entry: FuturesEntry;
  market: Market;
  tone: "fav" | "dog";
}) {
  return (
    <Card className="p-3">
      <div className="mb-2 font-cond text-[10px] font-semibold uppercase tracking-widest text-text-dim">{label}</div>
      <div className="flex items-center gap-2">
        <TeamAvatar team={entry.team} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-cond text-sm font-semibold leading-tight">{entry.team.name}</div>
          <div className="truncate text-[11px] text-text-muted">{formatChance(entry.probability[market.key])}</div>
        </div>
      </div>
      <div className={`mt-2 font-cond text-3xl font-bold tabular-nums ${tone === "fav" ? "text-teal" : "text-text-muted"}`}>
        {formatPrice(entry.price[market.key])}
      </div>
    </Card>
  );
}

function BoardRow({
  entry,
  rank,
  market,
  best,
  striped,
}: {
  entry: FuturesEntry;
  rank: number;
  market: Market;
  best: number;
  striped: boolean;
}) {
  const chance = entry.probability[market.key];
  // Bars are scaled against the top of the board, not against 100% — on a
  // twelve-horse title market everything would otherwise be a stub.
  const width = best > 0 ? Math.max(2, (chance / best) * 100) : 0;
  // Medals for the markets worth topping; nobody earns gold for being the
  // shortest price on the spoon.
  const tone = market.key === "spoon" ? "grey" : rankBadgeTone(rank);

  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 ${striped ? "bg-row" : "bg-card"}`}>
      <Hexagon value={rank} tone={tone} size="sm" />
      <TeamLink team={entry.team} className="flex min-w-0 flex-1 items-center gap-2">
        <TeamAvatar team={entry.team} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-cond text-base font-semibold leading-tight">{entry.team.name}</span>
            {entry.championships > 0 && (
              <span
                className="shrink-0 font-cond text-[11px] font-semibold tabular-nums text-gold"
                title={`${entry.championships} MGL ${entry.championships === 1 ? "title" : "titles"}`}
              >
                ★{entry.championships}
              </span>
            )}
          </span>
          <span className="block truncate text-[11px] text-text-muted">
            {meta(entry).join(" · ")}
          </span>
          <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-section">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${width}%`,
                background: `linear-gradient(90deg, ${entry.team.primary}, ${entry.team.secondary})`,
              }}
            />
          </span>
        </span>
      </TeamLink>
      <span className="w-[4.25rem] shrink-0">
        <span className="block rounded bg-section py-1 text-center font-cond text-base font-bold tabular-nums">
          {formatPrice(entry.price[market.key])}
        </span>
        <span className="mt-0.5 block text-center text-[10px] tabular-nums text-text-dim">{formatChance(chance)}</span>
      </span>
    </div>
  );
}

/** Second line of a row — the record only appears once there are games in it. */
function meta(entry: FuturesEntry): string[] {
  const parts = [entry.team.manager];
  if (entry.wins + entry.losses + entry.ties > 0) parts.push(formatRecord(entry));
  parts.push(`${entry.projectedWins} proj wins`);
  return parts;
}

function Explainer({ board }: { board: FuturesBoard }) {
  const lines = [
    `${board.simulations.toLocaleString()} seasons simulated, ${board.remainingGames} fixtures still to play.`,
    `Each franchise is rated on its all-time points per game — regressed toward the league average, since the roster gets redrawn every draft — then blended with this season's scoring and nudged by the AI power ranking.`,
    `Every remaining week is played out, the ladder is cut at ${PLAYOFF_CUTOFF} after Week ${REGULAR_SEASON_WEEKS}, and the bracket runs to a champion.`,
    `Prices are decimal and carry a book's margin, so they add up to more than 100% — exactly like the real thing.`,
  ];

  return (
    <Card>
      <SectionHeader>How the book is built</SectionHeader>
      <ul className="space-y-2 px-4 py-3 text-xs leading-relaxed text-text-muted">
        {lines.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="text-teal">•</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-border bg-section px-4 py-2.5 text-[11px] leading-relaxed text-text-dim">
        Novelty odds only. Nothing here is a real market and no money changes hands — it is the same MGL Book that prints
        the weekly lines on the scoreboard.
      </div>
    </Card>
  );
}
