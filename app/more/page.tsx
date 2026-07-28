import Link from "next/link";
import { Card, PageIntro, SectionTitle } from "@/components/ui";
import { getPowerRankings } from "@/lib/power-rankings";
import { PowerRankingsUnreadDot } from "@/components/power-rankings-seen";

export const metadata = { title: "More - MGL Fantasy" };

type MoreLink = {
  href: string;
  label: string;
  desc: string;
  icon: string;
  badge?: string;
  unreadVersion?: string;
};

const FEATURED_LINKS: MoreLink[] = [
  { href: "/predictor", label: "Season Predictor", desc: "Pick a margin on all 84 games, then play out the finals", icon: "PRD", badge: "NEW" },
  { href: "/power-rankings", label: "Power Rankings", desc: "TP's personal ranking of every team", icon: "🏆" },
  { href: "/keepers", label: "Keepers Board", desc: "Every team's kept players for 2026", icon: "🔒" },
  { href: "/mock-draft", label: "Mock Draft", desc: "Simulate the 2026 draft board pick by pick", icon: "MD" },
  { href: "/history", label: "History", desc: "Champions and final standings, 2021-2025", icon: "HY" },
  { href: "/head-to-head", label: "Head to Head", desc: "Compare any two franchises", icon: "HH" },
];

const OTHER_LINKS: MoreLink[] = [
  { href: "/playoff-simulator", label: "Playoff Simulator", desc: "Project the 2026 ladder by picking every remaining game", icon: "SIM" },
  { href: "/newspaper", label: "League Newspaper", desc: "MGL Gazette headlines, matchup wire and league gossip", icon: "NEWS" },
  { href: "/games", label: "Every Game", desc: "445 games with full player boxscores", icon: "GM" },
  { href: "/players", label: "Players", desc: "Search NFL players, profiles and MGL records", icon: "PL" },
  { href: "/drafts", label: "Draft Results", desc: "Every historical MGL draft pick", icon: "DR" },
  { href: "/trades", label: "Trades", desc: "Every all-time trade, 2021-2025", icon: "TR" },
  { href: "/transactions", label: "Transactions", desc: "Every add & drop, 2021-2025", icon: "TX" },
  { href: "/playoffs", label: "Playoff Bracket", desc: "Full postseason bracket, 2021-2025", icon: "PO" },
  { href: "/scoregami", label: "Scoregami", desc: "Every integer matchup score and all-time scoregamis", icon: "SG" },
  { href: "/managers", label: "Managers", desc: "All-time managers, stats and legacy scores", icon: "MG" },
  { href: "/records", label: "Records", desc: "All-time wins, points and titles", icon: "RC" },
  { href: "/leaders", label: "All-Time Leaders", desc: "Career fantasy scoring leaders by player", icon: "🏅" },
  { href: "/luck", label: "Luck & All-Play", desc: "All-play records vs actual — who the schedule blessed", icon: "🍀" },
  { href: "/positions", label: "Positional Firepower", desc: "Where each franchise's points come from", icon: "📊" },
  { href: "/consistency", label: "Boom or Bust", desc: "Which franchises are steady vs volatile", icon: "📈" },
  { href: "/settings", label: "Settings", desc: "Theme (light/dark) and your team", icon: "⚙" },
];

function LinkList({ links }: { links: MoreLink[] }) {
  return (
    <Card>
      {links.map((l, i) => (
        <Link
          key={l.href}
          href={l.href}
          className={`flex items-center gap-3 px-4 py-3.5 ${i % 2 ? "bg-card" : "bg-row"} hover:bg-card-hover`}
        >
          <span className="relative grid h-9 w-9 place-items-center rounded-lg bg-section font-cond text-sm font-bold text-text-muted">
            {l.icon}
            {l.unreadVersion && <PowerRankingsUnreadDot version={l.unreadVersion} className="absolute -right-0.5 -top-0.5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2 font-cond text-lg font-semibold leading-tight">
              <span className="truncate">{l.label}</span>
              {l.badge ? (
                <span className="shrink-0 rounded bg-[#ef4444] px-1.5 py-0.5 font-cond text-[10px] font-bold uppercase leading-none tracking-wide text-white shadow-sm">
                  {l.badge}
                </span>
              ) : null}
            </div>
            <div className="text-xs text-text-muted">{l.desc}</div>
          </div>
          <span className="text-text-dim">&gt;</span>
        </Link>
      ))}
    </Card>
  );
}

export default function MorePage() {
  const powerRankingsVersion = getPowerRankings().version;
  const featuredLinks = FEATURED_LINKS.map((link) =>
    link.href === "/power-rankings" ? { ...link, unreadVersion: powerRankingsVersion } : link
  );

  return (
    <div>
      <PageIntro title="More" subtitle="League info and history" />

      <SectionTitle>Featured</SectionTitle>
      <LinkList links={featuredLinks} />

      <div className="mt-5">
        <SectionTitle>Other</SectionTitle>
        <LinkList links={OTHER_LINKS} />
      </div>
    </div>
  );
}
