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
  void standing;
  void matchup;

  const starters = roster?.starters ?? [];
  const bench = roster?.bench ?? [];
  const ir = roster?.ir ?? [];
  const hasAnyPlayer = [...starters, ...bench, ...ir].some((s) => s.entry);

  if (!hasAnyPlayer) {
    return (
      <div className="px-2 pt-5">
        <LineupTitle>Starters</LineupTitle>
        <div className="rounded-[14px] bg-white px-6 py-10 text-center text-sm text-[#5f6369] shadow-[0_3px_0_rgba(0,0,0,0.16)]">
          {roster
            ? `${team.name} hasn't set a lineup for Week ${week} yet.`
            : `${team.name} hasn't joined the current Sleeper season yet.`}
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-3 bg-[#deddd8] px-3 pb-6">
      <LineupSection title="Starters" slots={starters} />
      <LineupSection title="Bench" slots={bench} muted />
      <LineupSection title="Injured Reserve" slots={ir} muted />
    </div>
  );
}

function LineupSection({ title, slots, muted = false }: { title: string; slots: RosterSlot[]; muted?: boolean }) {
  const filled = slots.filter((slot) => slot.entry);
  if (!filled.length) return null;
  return (
    <section className="pt-5">
      <LineupTitle>{title}</LineupTitle>
      <div className="space-y-3">
        {filled.map((slot, i) => (
          <PlayerRow key={`${slot.label}-${slot.entry?.sleeperId ?? i}`} slot={slot.label} entry={slot.entry!} muted={muted} />
        ))}
      </div>
    </section>
  );
}

function LineupTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-5 px-2 font-cond text-[25px] font-bold uppercase leading-none tracking-wide text-[#66686d]">
      {children}
    </h2>
  );
}

const INJURY: Record<string, { label: string; color: string }> = {
  Questionable: { label: "Q", color: "#f5b400" },
  Doubtful: { label: "D", color: "#f08a24" },
  Out: { label: "O", color: "#ff4a00" },
  IR: { label: "IA", color: "#ff4a00" },
  PUP: { label: "IA", color: "#ff4a00" },
  Sus: { label: "SUS", color: "#e0322b" },
};

function PlayerRow({ slot, entry, muted }: { slot: string; entry: RosterEntry; muted: boolean }) {
  const logo = entry.position !== "DEF" ? proTeamLogoUrl(entry.proTeam) : proTeamLogoUrl(entry.sleeperId);
  const badge = entry.injuryStatus ? INJURY[entry.injuryStatus] : undefined;
  const started = Boolean(entry.gameStarted);
  const projected = entry.projected;

  return (
    <article
      className={`overflow-hidden rounded-[14px] shadow-[0_3px_0_rgba(0,0,0,0.18)] ${
        started || muted ? "bg-[#d7d5cf]" : "bg-white"
      }`}
    >
      <div
        className={`grid min-h-[104px] items-center gap-2 px-3 py-4 ${
          started
            ? "grid-cols-[2.15rem_2.2rem_4.55rem_3.25rem_minmax(0,1fr)_4.65rem]"
            : "grid-cols-[2.15rem_4.55rem_3.25rem_minmax(0,1fr)_4.65rem]"
        }`}
      >
        <div className="font-cond text-[20px] font-bold uppercase leading-none text-[#35383d]">{slot}</div>
        {started ? <LockCell /> : null}
        <div className="relative h-16 w-16">
          <SleeperPlayerAvatar sleeperId={entry.sleeperId ?? ""} pos={entry.position} name={entry.name} size="lg" />
          {entry.posRank ? <RankBadge value={entry.posRank} /> : null}
          {badge ? (
            <span
              className="absolute -bottom-2 left-1/2 grid h-6 min-w-8 -translate-x-1/2 place-items-center rounded-full px-2 font-cond text-[13px] font-bold leading-none text-black"
              style={{ background: badge.color }}
            >
              {badge.label}
            </span>
          ) : null}
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-full bg-[#efefed]">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={entry.proTeam ?? entry.position} className="h-8 w-8 object-contain" />
          ) : (
            <span className="font-cond text-xs font-bold text-[#6a6d72]">{entry.position}</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate font-cond text-[28px] font-bold leading-[1.05] tracking-wide text-[#383a3f]">
            {entry.name}
          </div>
          <div className="mt-1 truncate font-cond text-[20px] font-bold uppercase leading-none tracking-wide text-[#6a6d72]">
            {entry.proTeam ?? "FA"} - {entry.position}
          </div>
        </div>
        <div className="text-right">
          <div className={`score text-[28px] ${started ? "text-[#25282d]" : "text-[#33363b]"}`}>
            {started ? entry.points.toFixed(2) : "-"}
          </div>
          {projected !== undefined ? (
            <div className="mt-2 font-cond text-[18px] font-bold italic leading-none text-[#6a6d72]">
              {projected.toFixed(2)}
            </div>
          ) : null}
        </div>
      </div>
      {started ? <StartedFooter entry={entry} /> : <PregameFooter entry={entry} />}
    </article>
  );
}

function LockCell() {
  return (
    <div className="grid place-items-center text-[#aeb0b3]" aria-label="Locked">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="10" width="14" height="10" rx="1.8" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <path d="M12 14v2.5" />
      </svg>
    </div>
  );
}

function RankBadge({ value }: { value: number }) {
  return (
    <span className="hexagon absolute -left-2 -top-2 grid h-8 w-8 place-items-center border border-[#cfd1d4] bg-white font-cond text-[15px] font-bold leading-none text-black shadow-sm">
      {value}
    </span>
  );
}

function PregameFooter({ entry }: { entry: RosterEntry }) {
  const matchup = pregameMatchupText(entry);
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_4.35rem] items-center gap-2 bg-[#f6f6f5] px-4 py-1.5 font-cond text-[18px] leading-none">
      <span className="truncate font-bold text-[#3d4045]">{entry.gameWhen ?? "Bye"}</span>
      <span className={`truncate text-center font-bold ${matchup.tone}`}>{matchup.text}</span>
      <span className="text-right font-bold italic text-[#62656b]">
        {entry.projected !== undefined ? entry.projected.toFixed(2) : "-"}
      </span>
    </div>
  );
}

function StartedFooter({ entry }: { entry: RosterEntry }) {
  return (
    <div className="bg-[#cccac4] px-4 py-2 text-center font-cond text-[20px] font-bold uppercase leading-none text-[#3f4247]">
      {startedGameText(entry.gameLabel)}
    </div>
  );
}

function pregameMatchupText(entry: RosterEntry): { text: string; tone: string } {
  if (!entry.gameLabel) return { text: "Bye - no game this week", tone: "text-[#e0322b]" };
  const label = entry.gameLabel.replace(/\s+/g, " ").trim();
  const m = label.match(/^([A-Z]{2,4})\s+(@|vs)\s+([A-Z]{2,4})/);
  if (!m) return { text: label, tone: "text-[#3d4045]" };
  const [, team, sep, opp] = m;
  const text = sep === "@" ? `${team} @ ${opp} vs ${entry.position}` : `${team} vs ${opp} vs ${entry.position}`;
  const rank = entry.posRank ? ` #${entry.posRank}` : "";
  const isGreen = entry.posRank !== undefined && entry.posRank >= 12;
  const isRed = entry.posRank !== undefined && entry.posRank <= 6;
  return {
    text: text.replace(`vs ${entry.position}`, `${rank} vs ${entry.position}`),
    tone: isGreen ? "text-[#36ad55]" : isRed ? "text-[#f24812]" : "text-[#3d4045]",
  };
}

function startedGameText(label: string | undefined): string {
  if (!label) return "In progress";
  return label
    .replace(/\s+/g, " ")
    .replace(/\(\(([WLT])\)\)/, "FINAL ($1)")
    .replace(/\sFINAL/, "  FINAL")
    .trim();
}
