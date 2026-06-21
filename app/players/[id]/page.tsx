import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerProfile, type PlayerGameLog } from "@/lib/players";
import { resolvePlayerImage, POS_COLOR } from "@/lib/player-images";
import { Card, EmptyState, SectionHeader, Score, TeamAvatar } from "@/components/ui";
import { weekLabel } from "@/lib/games";

export const revalidate = 86400;

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playerId = Number(id);
  const profile = playerId ? await getPlayerProfile(playerId) : null;
  if (!profile) notFound();

  const { totals } = profile;
  const img = resolvePlayerImage(profile.playerId, profile.pos, profile.name);

  return (
    <div className="space-y-3">
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-5 text-white"
        style={{ background: "linear-gradient(180deg, var(--teal) 0%, var(--teal-deep) 100%)" }}
      >
        {img.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.imageUrl}
            alt={img.displayName}
            width={68}
            height={68}
            className={`h-17 w-17 shrink-0 rounded-full ${img.isLogo ? "bg-white object-contain p-1" : "bg-white/10 object-cover"}`}
            suppressHydrationWarning
          />
        ) : (
          <span
            className="grid h-17 w-17 shrink-0 place-items-center rounded-full font-cond text-lg font-bold text-white"
            style={{ background: POS_COLOR[profile.pos] ?? "#9aa1ad" }}
          >
            {profile.pos || "-"}
          </span>
        )}
        <div className="min-w-0">
          <div className="truncate font-cond text-2xl font-bold leading-tight">{profile.name}</div>
          <div className="text-sm text-white/80">
            {profile.pos}
            {profile.proTeam ? ` - ${profile.proTeam}` : ""}
          </div>
        </div>
      </div>

      <Card>
        <SectionHeader>MGL Career</SectionHeader>
        <div className="grid grid-cols-3 gap-px bg-section/60 sm:grid-cols-4">
          <Stat label="Games" value={totals.gamesPlayed} />
          <Stat label="Total Pts" value={totals.totalPoints.toFixed(2)} />
          <Stat label="Avg Pts" value={totals.avgPoints.toFixed(2)} />
          <Stat label="Total TDs" value={totals.totalTDs} />
          {totals.passYds > 0 && <Stat label="Pass Yds" value={totals.passYds} />}
          {totals.passTD > 0 && <Stat label="Pass TD" value={totals.passTD} />}
          {totals.passInt > 0 && <Stat label="INT" value={totals.passInt} />}
          {totals.rushYds > 0 && <Stat label="Rush Yds" value={totals.rushYds} />}
          {totals.rushTD > 0 && <Stat label="Rush TD" value={totals.rushTD} />}
          {totals.recYds > 0 && <Stat label="Rec Yds" value={totals.recYds} />}
          {totals.recTD > 0 && <Stat label="Rec TD" value={totals.recTD} />}
          {totals.fum > 0 && <Stat label="Fumbles" value={totals.fum} />}
          {(totals.fgMade > 0 || totals.fgMiss > 0) && <Stat label="FG" value={`${totals.fgMade}/${totals.fgMade + totals.fgMiss}`} />}
          {totals.patMade > 0 && <Stat label="PAT" value={totals.patMade} />}
          {totals.defSack > 0 && <Stat label="Sacks" value={totals.defSack} />}
          {totals.defInt > 0 && <Stat label="Def INT" value={totals.defInt} />}
          {totals.defFumRec > 0 && <Stat label="Def Fum" value={totals.defFumRec} />}
          {totals.defSafety > 0 && <Stat label="Safeties" value={totals.defSafety} />}
        </div>
      </Card>

      {profile.teamHistory.length > 0 && (
        <Card>
          <SectionHeader>MGL Team History</SectionHeader>
          {profile.teamHistory.map((t, i) => (
            <div
              key={`${t.teamName}-${t.fromSeason}`}
              className={`flex items-center gap-2.5 px-3 py-2 ${i % 2 === 1 ? "bg-card" : "bg-[#f7f8fa]"}`}
            >
              {t.team ? <TeamAvatar team={t.team} size="sm" /> : <span className="h-8 w-8 shrink-0 rounded-full bg-section" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{t.team?.name ?? t.teamName}</div>
                {t.team && <div className="truncate text-[11px] text-text-muted">{t.team.manager}</div>}
              </div>
              <span className="shrink-0 font-cond text-sm font-semibold text-text-muted">
                {t.current
                  ? `${t.fromSeason}-present`
                  : t.fromSeason === t.toSeason
                    ? t.fromSeason
                    : `${t.fromSeason}-${t.toSeason}`}
              </span>
            </div>
          ))}
        </Card>
      )}

      <Card>
        <SectionHeader>Game Log</SectionHeader>
        {profile.log.length === 0 ? (
          <EmptyState>No games found.</EmptyState>
        ) : (
          profile.log.map((g, i) => <GameLogRow key={g.gameId} g={g} alt={i % 2 === 1} />)
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card px-2 py-2.5 text-center">
      <div className="font-cond text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
    </div>
  );
}

function statLine(g: PlayerGameLog): string {
  const s = g.stats;
  const parts: string[] = [];
  if (s.passYds || s.passTD || s.passInt) parts.push(`${s.passYds ?? 0} YDS, ${s.passTD ?? 0} TD, ${s.passInt ?? 0} INT`);
  if (s.rushYds || s.rushTD) parts.push(`${s.rushYds ?? 0} rush yds, ${s.rushTD ?? 0} rush TD`);
  if (s.recYds || s.recTD) parts.push(`${s.recYds ?? 0} rec yds, ${s.recTD ?? 0} rec TD`);
  if (s.defSack || s.defInt || s.defFumRec || s.defTD)
    parts.push(`${s.defSack ?? 0} sck, ${s.defInt ?? 0} int, ${s.defTD ?? 0} TD`);
  return parts.join(" - ");
}

function GameLogRow({ g, alt }: { g: PlayerGameLog; alt: boolean }) {
  return (
    <Link
      href={`/games/${g.gameId}`}
      className={`flex items-center gap-2.5 px-3 py-2 ${alt ? "bg-card" : "bg-[#f7f8fa]"} ${g.started ? "" : "opacity-60"}`}
    >
      <div className="w-16 shrink-0">
        <div className="font-cond text-sm font-semibold leading-tight">{g.season}</div>
        <div className="text-[11px] text-text-muted">{weekLabel(g.week)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {g.teamName} vs {g.opponent}
        </div>
        <div className="truncate text-[11px] text-text-muted">{statLine(g) || (g.started ? "" : "Bench")}</div>
      </div>
      <Score value={g.points} className="text-base" dim={g.points === 0} />
    </Link>
  );
}
