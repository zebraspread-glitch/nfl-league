import Link from "next/link";
import { TeamAvatar, Hexagon } from "@/components/ui";
import { SleeperPlayerAvatar } from "@/components/sleeper-player-avatar";
import { proTeamLogoUrl } from "@/lib/player-images";
import type { Matchup, Roster, RosterEntry, RosterSlot, Standing, TeamMeta } from "@/lib/types";

export function MyTeamLineup({
  team,
  roster,
  standing,
  matchup,
  week,
}: {
  team: TeamMeta;
  roster: Roster | null;
  standing?: Standing;
  matchup?: Matchup;
  week: number;
}) {
  const opponent =
    matchup && (matchup.home.team.id === team.id ? matchup.away.team : matchup.home.team);

  const starters = roster?.starters ?? [];
  const bench = roster?.bench ?? [];
  const ir = roster?.ir ?? [];
  const hasAnyPlayer = [...starters, ...bench, ...ir].some((s) => s.entry);

  return (
    <div className="space-y-3">
      {/* Team / matchup header */}
      <div
        className="rounded-xl px-4 py-3.5 text-white shadow-sm"
        style={{ background: `linear-gradient(180deg, ${team.primary} 0%, ${team.secondary} 175%)` }}
      >
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <TeamAvatar team={team} size="lg" />
            {standing ? (
              <span className="absolute -left-2 -top-1">
                <Hexagon value={standing.rank} tone="grey" size="sm" />
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <Link href={`/teams/${team.id}`} className="block truncate font-cond text-2xl font-bold leading-none">
              {team.name}
            </Link>
            <div className="mt-1 truncate text-sm text-white/85">
              {standing ? `${standing.wins}-${standing.losses}${standing.ties ? `-${standing.ties}` : ""} · ` : ""}
              Week {week}
              {opponent ? <> · vs {opponent.name}</> : ""}
            </div>
          </div>
          <Link
            href="/settings"
            aria-label="Change team"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15 hover:bg-white/25"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
              <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
            </svg>
          </Link>
        </div>
      </div>

      {hasAnyPlayer ? (
        <>
          <LineupSection title="Starters" slots={starters} />
          <LineupSection title="Bench" slots={bench} muted />
          <LineupSection title="Injured Reserve" slots={ir} muted />
        </>
      ) : (
        <div className="rounded-xl bg-card px-6 py-10 text-center text-sm text-text-muted shadow-sm">
          {roster
            ? `${team.name} hasn't set a lineup for Week ${week} yet.`
            : `${team.name} hasn't joined the current Sleeper season yet.`}
        </div>
      )}
    </div>
  );
}

function LineupSection({ title, slots, muted = false }: { title: string; slots: RosterSlot[]; muted?: boolean }) {
  if (!slots.length) return null;
  return (
    <div>
      <h2 className="mb-2 px-1 font-cond text-sm font-semibold uppercase tracking-widest text-text-muted">{title}</h2>
      <div className="space-y-2">
        {slots.map((slot, i) =>
          slot.entry ? (
            <PlayerRow key={i} slot={slot.label} entry={slot.entry} muted={muted} />
          ) : (
            <EmptyRow key={i} slot={slot.label} />
          ),
        )}
      </div>
    </div>
  );
}

const INJURY: Record<string, { label: string; color: string }> = {
  Questionable: { label: "Q", color: "#f5b400" },
  Doubtful: { label: "D", color: "#f08a24" },
  Out: { label: "O", color: "#e0322b" },
  IR: { label: "IR", color: "#f08a24" },
  PUP: { label: "PUP", color: "#f08a24" },
  Sus: { label: "SUS", color: "#e0322b" },
};

/** Opponent label from the player's perspective: "@ KC" / "vs. DEN". The game
 *  label is always from the player's team's perspective and may be either the
 *  pre-game form ("NYG vs DAL") or the completed form with scores embedded
 *  ("NYG 6 vs DAL 21 ((L))"), so match the separator + opponent and ignore the
 *  rest. */
function opponentLabel(gameLabel: string | undefined): string | null {
  if (!gameLabel) return null;
  const m = gameLabel.match(/\s(@|vs)\s+([A-Z]{2,4})/);
  if (!m) return null;
  const [, sep, opp] = m;
  return sep === "@" ? `@ ${opp}` : `vs. ${opp}`;
}

function PlayerRow({ slot, entry, muted }: { slot: string; entry: RosterEntry; muted: boolean }) {
  const showLogo = entry.position !== "DEF";
  const logo = showLogo ? proTeamLogoUrl(entry.proTeam) : undefined;
  const badge = entry.injuryStatus ? INJURY[entry.injuryStatus] : undefined;
  const opp = opponentLabel(entry.gameLabel);
  const onBye = !entry.gameLabel && !entry.gameWhen;

  return (
    <div className="overflow-hidden rounded-xl shadow-sm ring-1 ring-border/60">
      <div className={`flex items-center gap-2 px-2.5 py-2.5 ${muted ? "bg-section" : "bg-card"}`}>
        <span className="w-7 shrink-0 text-center font-cond text-xs font-bold uppercase text-text-muted">{slot}</span>

        {/* swap-lineup affordance (visual, mirrors NFL.com) */}
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 4v15 M8 19l-3-3 M8 19l3-3" />
            <path d="M16 20V5 M16 5l-3 3 M16 5l3 3" />
          </svg>
        </span>

        {/* headshot with rank badge + injury dot */}
        <div className="relative shrink-0">
          <SleeperPlayerAvatar sleeperId={entry.sleeperId ?? ""} pos={entry.position} name={entry.name} size="md" />
          {entry.posRank ? (
            <span className="absolute -left-1.5 -top-1.5">
              <Hexagon value={entry.posRank} tone="grey" size="sm" />
            </span>
          ) : null}
          {badge ? (
            <span
              className="absolute -bottom-1 left-1/2 grid h-4 -translate-x-1/2 place-items-center rounded-full px-1 text-[8px] font-bold text-black"
              style={{ background: badge.color }}
            >
              {badge.label}
            </span>
          ) : null}
        </div>

        {/* team logo */}
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={entry.proTeam}
            className="h-8 w-8 shrink-0 rounded-full object-contain p-0.5"
            style={{ background: "#b9bec6" }}
          />
        ) : (
          <span className="h-8 w-8 shrink-0" />
        )}

        {/* name + team-position */}
        <div className="min-w-0 flex-1 pl-0.5">
          <div className={`truncate font-cond text-lg font-semibold leading-tight ${muted ? "text-text-muted" : ""}`}>
            {entry.name}
          </div>
          <div className="truncate text-[11px] uppercase tracking-wide text-text-dim">
            {entry.proTeam ?? "FA"} · {entry.position}
          </div>
        </div>

        {/* score + projected */}
        <div className="shrink-0 pl-1 text-right">
          <div className="score text-2xl text-text">
            {entry.gameStarted ? entry.points.toFixed(2) : "—"}
          </div>
          {entry.projected !== undefined ? (
            <div className="font-cond text-sm italic tabular-nums text-text-muted">{entry.projected.toFixed(2)}</div>
          ) : null}
        </div>
      </div>

      {onBye ? (
        <div className="bg-down/15 py-1.5 text-center font-cond text-xs font-bold uppercase tracking-wide text-down">
          Bye · no game this week
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 border-t border-border bg-row px-3 py-1.5 text-[11px]">
          <span className="shrink-0 font-cond font-semibold text-text">{entry.gameWhen ?? "—"}</span>
          {opp ? (
            <span className="truncate font-cond font-semibold text-text-muted">
              {opp} <span className="text-text-dim">vs {entry.position}</span>
            </span>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}

function EmptyRow({ slot }: { slot: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-section px-2.5 py-2.5 ring-1 ring-border/60">
      <span className="w-7 shrink-0 text-center font-cond text-xs font-bold uppercase text-text-muted">{slot}</span>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal/40 text-white">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 4v15 M8 19l-3-3 M8 19l3-3" />
          <path d="M16 20V5 M16 5l-3 3 M16 5l3 3" />
        </svg>
      </span>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card font-cond text-[10px] font-bold text-text-dim">
        {slot}
      </span>
      <span className="flex-1 text-sm font-medium text-text-dim">Empty</span>
    </div>
  );
}
