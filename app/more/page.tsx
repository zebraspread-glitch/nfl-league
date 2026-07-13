import Link from "next/link";
import { Card, PageIntro } from "@/components/ui";

export const metadata = { title: "More - MGL Fantasy" };

const LINKS = [
  { href: "/mock-draft", label: "Mock Draft", desc: "Simulate the 2026 draft board pick by pick", icon: "MD" },
  { href: "/games", label: "Every Game", desc: "445 games with full player boxscores", icon: "GM" },
  { href: "/players", label: "Players", desc: "Search NFL players, profiles and MGL records", icon: "PL" },
  { href: "/drafts", label: "Draft Results", desc: "Every historical MGL draft pick", icon: "DR" },
  { href: "/trades", label: "Trades", desc: "Every all-time trade, 2021-2025", icon: "TR" },
  { href: "/transactions", label: "Transactions", desc: "Every add & drop, 2021-2025", icon: "TX" },
  { href: "/playoffs", label: "Playoff Bracket", desc: "Full postseason bracket, 2021-2025", icon: "PO" },
  { href: "/history", label: "History", desc: "Champions and final standings, 2021-2025", icon: "HY" },
  { href: "/managers", label: "Managers", desc: "All-time managers, stats and legacy scores", icon: "MG" },
  { href: "/records", label: "Records", desc: "All-time wins, points and titles", icon: "RC" },
  { href: "/luck", label: "Luck & All-Play", desc: "All-play records vs actual — who the schedule blessed", icon: "🍀" },
  { href: "/positions", label: "Positional Firepower", desc: "Where each franchise's points come from", icon: "📊" },
  { href: "/head-to-head", label: "Head to Head", desc: "Compare any two franchises", icon: "HH" },
  { href: "/settings", label: "Settings", desc: "Theme (light/dark) and your team", icon: "⚙" },
];

export default function MorePage() {
  return (
    <div>
      <PageIntro title="More" subtitle="League info and history" />
      <Card>
        {LINKS.map((l, i) => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-3 px-4 py-3.5 ${i % 2 ? "bg-card" : "bg-row"} hover:bg-card-hover`}
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-section font-cond text-sm font-bold text-text-muted">
              {l.icon}
            </span>
            <div className="flex-1">
              <div className="font-cond text-lg font-semibold leading-tight">{l.label}</div>
              <div className="text-xs text-text-muted">{l.desc}</div>
            </div>
            <span className="text-text-dim">&gt;</span>
          </Link>
        ))}
      </Card>
    </div>
  );
}
