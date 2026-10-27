import Link from "next/link";
import {
  OddsHistoryChart,
  type ChartScale,
  type ChartSeries,
  type Granularity,
} from "@/components/odds-history-chart";
import { Card, PageIntro, SectionHeader, TeamAvatar } from "@/components/ui";
import { biggestMover, getOddsHistory, type OddsSeries } from "@/lib/odds-history";
import { PLAYOFF_CUTOFF, REGULAR_SEASON_WEEKS } from "@/lib/playoff-simulator";
import { getMarket, MARKETS, type Market } from "@/lib/superbowl-odds";

export const revalidate = 300;

export const metadata = { title: "Odds - MGL Fantasy" };

export default async function OddsPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string }>;
}) {
  const { market: marketParam } = await searchParams;
  const market = getMarket(marketParam);
  const history = getOddsHistory();
  const series = history.series.week[market.key];
  const mover = biggestMover(series, series[0]?.team.id);

  const flatten = (rows: typeof series): ChartSeries[] =>
    rows.map((s) => ({ team: s.team, values: s.points.map((p) => p.p) }));
  const axis = (rows: typeof series): ChartScale => ({
    ticks: rows[0].points.map((p) => p.tick),
    labels: rows[0].points.map((p) => p.label),
  });

  const chartSeries: Record<Granularity, ChartSeries[]> = {
    week: flatten(series),
    day: flatten(history.series.day[market.key]),
  };
  const chartScale: Record<Granularity, ChartScale> = {
    week: axis(series),
    day: axis(history.series.day[market.key]),
  };

  return (
    <div className="space-y-3">
      <PageIntro
        title="Odds"
        subtitle={`${history.season} markets, week by week — ${
          history.completedWeeks ? `through Week ${history.completedWeeks}` : "pre-season"
        }`}
      />

      <MarketTabs active={market} />

      <div className="grid grid-cols-2 gap-2">
        <MoverTile label="Favourite" series={series[0]} tone="fav" />
        {mover ? (
          <MoverTile
            label="Biggest mover"
            series={series.find((s) => s.team.id === mover.team.id)!}
            tone="move"
          />
        ) : (
          <MoverTile label="Longest" series={series[series.length - 1]} tone="dog" />
        )}
      </div>

      <Card>
        <SectionHeader>{market.title}</SectionHeader>
        <p className="px-3 pb-1 pt-2 text-xs text-text-muted">{market.blurb}</p>
        <OddsHistoryChart
          series={chartSeries}
          scale={chartScale}
          caption={`${market.title}: every franchise's chance over the season`}
        />
      </Card>

      <Explainer
        completedWeeks={history.completedWeeks}
        simulations={history.simulations}
        market={market}
      />
    </div>
  );
}

function MarketTabs({ active }: { active: Market }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {MARKETS.map((m) => (
        <Link
          key={m.key}
          href={`/odds?market=${m.key}`}
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

/** Either end of the market, or the line that has moved furthest since the
 *  opening board — the number worth looking at before the chart itself. */
function MoverTile({
  label,
  series,
  tone,
}: {
  label: string;
  series: OddsSeries;
  tone: "fav" | "dog" | "move";
}) {
  const change = series.current - series.opening;
  const colour =
    tone === "fav" ? "text-teal" : tone === "dog" ? "text-text-muted" : change >= 0 ? "text-up" : "text-down";

  return (
    <Card className="p-3">
      <div className="mb-2 font-cond text-[10px] font-semibold uppercase tracking-widest text-text-dim">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <TeamAvatar team={series.team} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-cond text-sm font-semibold leading-tight">
            {series.team.name}
          </div>
          <div className="truncate text-[11px] text-text-muted">
            opened {(series.opening * 100).toFixed(1)}%
          </div>
        </div>
      </div>
      <div className={`mt-2 font-cond text-3xl font-bold tabular-nums ${colour}`}>
        {tone === "move"
          ? `${change >= 0 ? "+" : "−"}${(Math.abs(change) * 100).toFixed(1)}`
          : (series.current * 100).toFixed(1)}
        <span className="text-xl">%</span>
      </div>
    </Card>
  );
}

function Explainer({
  completedWeeks,
  simulations,
  market,
}: {
  completedWeeks: number;
  simulations: number;
  market: Market;
}) {
  const lines = [
    `Each point is the board as it stood that week: the ladder at the time, then ${simulations.toLocaleString()} seasons played out from there.`,
    `Week 0 is the opening board — pure projection, before a ball was kicked. ${
      completedWeeks
        ? `Everything after it is ${completedWeeks} ${completedWeeks === 1 ? "week" : "weeks"} of real results feeding back into the ratings.`
        : "Nothing has been played yet."
    }`,
    `The ladder is cut at ${PLAYOFF_CUTOFF} after Week ${REGULAR_SEASON_WEEKS}, then the bracket runs to a champion — the same model the Superbowl Odds board prices off.`,
    `These are chances, not prices: no book margin, so a market's twelve lines add to 100%${
      market.type === "yesno" ? " except the yes/no ones, where several franchises can land it" : ""
    }.`,
  ];

  return (
    <Card>
      <SectionHeader>How this is built</SectionHeader>
      <ul className="space-y-2 px-3 py-3 text-xs leading-relaxed text-text-muted">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <div className="border-t border-border px-3 py-2.5">
        <Link href="/superbowl-odds" className="font-cond text-sm font-semibold text-teal">
          See today&rsquo;s priced board →
        </Link>
      </div>
    </Card>
  );
}
