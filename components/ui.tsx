import Link from "next/link";
import type { TeamMeta } from "@/lib/types";

/** Section heading band like the NFL app ("STARTERS", "Fantasy Super Bowl"). */
export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-t-xl bg-section px-4 py-2.5 font-cond text-base font-semibold uppercase tracking-wide text-text">
      {children}
    </div>
  );
}

/** Small all-caps label, used above lists outside of cards. */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 mt-1 px-1 font-cond text-sm font-semibold uppercase tracking-widest text-text-muted">
      {children}
    </h2>
  );
}

export function PageIntro({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-1 pb-3 pt-1">
      <div className="font-cond text-2xl font-semibold tracking-wide">{title}</div>
      {subtitle && <div className="text-sm text-text-muted">{subtitle}</div>}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-xl bg-card shadow-sm ${className}`}>{children}</div>
  );
}

export type HexagonTone = "teal" | "gold" | "silver" | "bronze" | "grey";

export function rankBadgeTone(rank: number): HexagonTone {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return "teal";
}

/** Flat-top hexagon rank badge. */
export function Hexagon({
  value,
  tone = "teal",
  size = "md",
}: {
  value: number | string;
  tone?: HexagonTone;
  size?: "sm" | "md" | "lg";
}) {
  const dims = size === "lg" ? "h-11 w-10 text-lg" : size === "sm" ? "h-7 w-6 text-xs" : "h-9 w-8 text-sm";
  const bg =
    tone === "gold"
      ? "linear-gradient(180deg,#ffd34d,#f5b400)"
      : tone === "silver"
      ? "linear-gradient(180deg,#f1f5f9,#aab4c1)"
      : tone === "bronze"
      ? "linear-gradient(180deg,#e2a66f,#b76a2d)"
      : tone === "grey"
      ? "linear-gradient(180deg,#aeb6c0,#8c95a1)"
      : "linear-gradient(180deg,#22b4d2,#0e8aa6)";
  const text = tone === "gold" ? "text-[#5a4200]" : tone === "silver" ? "text-[#354052]" : "text-white";
  return (
    <span
      className={`hexagon ${dims} grid place-items-center font-cond font-bold ${text}`}
      style={{ background: bg }}
    >
      {value}
    </span>
  );
}

/** Circular team avatar — logo image when set, else coloured initials. */
export function TeamAvatar({
  team,
  size = "md",
}: {
  team: TeamMeta;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const map = { sm: 32, md: 44, lg: 60, xl: 84 } as const;
  const px = map[size];
  const cls = { sm: "h-8 w-8", md: "h-11 w-11", lg: "h-15 w-15", xl: "h-21 w-21" }[size];

  if (team.logo) {
    return (
      // Plain <img>: these are small static square logos, so next/image
      // optimisation adds nothing and only introduces the Tailwind-preflight
      // aspect-ratio warning. suppressHydrationWarning guards against browser
      // extensions (Dark Reader, Grammarly, password managers) that inject
      // attributes before React hydrates.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={team.logo}
        alt={`${team.name} logo`}
        width={px}
        height={px}
        className={`${cls} shrink-0 rounded-full object-cover`}
        suppressHydrationWarning
      />
    );
  }
  return (
    <span
      suppressHydrationWarning
      className={`grid ${cls} shrink-0 place-items-center rounded-full font-cond font-bold text-white`}
      style={{ width: px, height: px, background: `linear-gradient(135deg, ${team.primary}, ${team.secondary})` }}
    >
      {team.abbrev}
    </span>
  );
}

/** Big italic condensed score with a small superscript decimal part. */
export function Score({
  value,
  className = "",
  dim = false,
}: {
  value: number;
  className?: string;
  dim?: boolean;
}) {
  const [whole, dec] = value.toFixed(2).split(".");
  return (
    <span className={`score ${dim ? "text-text-muted" : "text-text"} ${className}`}>
      {whole}
      <span className="score-dec">.{dec}</span>
    </span>
  );
}

/** Rank movement arrow (▲ green up / ▼ red down). */
export function ChangeArrow({ change }: { change: number }) {
  if (!change) return null;
  const up = change > 0;
  return (
    <span className={`flex items-center gap-0.5 font-cond text-sm font-bold ${up ? "text-up" : "text-down"}`}>
      {up ? "↑" : "↓"} {Math.abs(change)}
    </span>
  );
}

/** Link wrapper to a team page. */
export function TeamLink({ team, children, className = "" }: { team: TeamMeta; children: React.ReactNode; className?: string }) {
  return (
    <Link href={`/teams/${team.id}`} className={className}>
      {children}
    </Link>
  );
}

export function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "live" | "win" | "loss" | "gold";
}) {
  const tones: Record<string, string> = {
    default: "bg-section text-text-muted",
    live: "bg-live/15 text-live",
    win: "bg-up/15 text-up",
    loss: "bg-down/10 text-down",
    gold: "bg-gold/20 text-[#8a6500]",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-cond text-xs font-bold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <Card className="p-8 text-center text-sm text-text-muted">{children}</Card>
  );
}
