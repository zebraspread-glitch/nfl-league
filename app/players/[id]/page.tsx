import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerProfile, type PlayerGameLog } from "@/lib/players";
import { proTeamLogoUrl, resolvePlayerImage, POS_COLOR } from "@/lib/player-images";
import { Card, EmptyState, SectionHeader, Score, TeamAvatar } from "@/components/ui";
import { weekLabel } from "@/lib/games";
import { getCurrentPlayerProfile, PLAYER_DATA_SEASON } from "../player-data";
import type { PlayerBrowserItem, PlayerStats, SparseStats } from "../player-browser";

export const revalidate = 86400;

export default async function PlayerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { id } = await params;
  const { season } = await searchParams;
  const wantsCurrentProfile = season === String(PLAYER_DATA_SEASON);

  if (wantsCurrentProfile) {
    const currentProfile = await getCurrentPlayerProfile(id);
    if (currentProfile) return <CurrentPlayerProfile player={currentProfile} />;
  }

  const playerId = Number(id);
  const profile = playerId ? await getPlayerProfile(playerId) : null;
  if (!profile) {
    const currentProfile = await getCurrentPlayerProfile(id);
    if (currentProfile) return <CurrentPlayerProfile player={currentProfile} />;
    notFound();
  }

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
              className={`flex items-center gap-2.5 px-3 py-2 ${i % 2 === 1 ? "bg-card" : "bg-row"}`}
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

const EMPTY_CURRENT_STATS: PlayerStats = {
  passAtt: 0,
  passCmp: 0,
  passYds: 0,
  passTD: 0,
  passInt: 0,
  passSack: 0,
  rushAtt: 0,
  rushYds: 0,
  rushTD: 0,
  targets: 0,
  rec: 0,
  recYds: 0,
  recTD: 0,
  retTD: 0,
  fumTD: 0,
  twoPt: 0,
  fumLost: 0,
  fgMade: 0,
  fgAtt: 0,
  xpMade: 0,
  defSack: 0,
  defInt: 0,
  defTD: 0,
  points: 0,
  projected: 0,
  gp: 0,
};

function expandCurrentStats(stats: SparseStats): PlayerStats {
  return { ...EMPTY_CURRENT_STATS, ...stats };
}

function CurrentPlayerProfile({ player }: { player: PlayerBrowserItem }) {
  const actual = expandCurrentStats(player.stats);
  const projection = expandCurrentStats(player.projection);
  const logo = proTeamLogoUrl(player.proTeam);

  return (
    <div className="space-y-3">
      <div
        className="overflow-hidden rounded-xl bg-card shadow-sm"
        style={{ background: `linear-gradient(180deg, ${player.ownerTeamPrimary ?? "var(--teal)"} 0%, ${player.ownerTeamSecondary ?? "var(--teal-deep)"} 180%)` }}
      >
        <div className="flex items-center gap-3 px-4 py-5 text-white">
          {player.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.imageUrl}
              alt={player.fullName}
              width={72}
              height={72}
              className={`h-18 w-18 shrink-0 rounded-full ${player.isLogo ? "bg-white object-contain p-1" : "bg-white/10 object-cover"}`}
              suppressHydrationWarning
            />
          ) : (
            <span
              className="grid h-18 w-18 shrink-0 place-items-center rounded-full font-cond text-lg font-bold text-white"
              style={{ background: POS_COLOR[player.pos] ?? "#9aa1ad" }}
            >
              {player.pos || "-"}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="truncate font-cond text-3xl font-bold leading-none">{player.fullName}</div>
            <div className="mt-1 flex items-center gap-2 text-sm text-white/85">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt={player.proTeam} className="h-6 w-6 rounded-full bg-white/90 object-contain p-0.5" />
              ) : null}
              <span>
                {player.proTeam || "FA"} - {player.pos}
              </span>
            </div>
            <div className="mt-2 text-sm font-semibold text-white/85">{player.manager}</div>
          </div>
        </div>
      </div>

      <Card>
        <SectionHeader>{PLAYER_DATA_SEASON} Profile</SectionHeader>
        <div className="grid grid-cols-3 gap-px bg-section/60 sm:grid-cols-4">
          <Stat label="Points" value={actual.points.toFixed(2)} />
          <Stat label="Projected" value={projection.projected.toFixed(2)} />
          <Stat label={`${player.pos} Rank`} value={player.projectionRank > 999 ? "-" : player.projectionRank} />
          <Stat label="Status" value={statusLabel(player)} />
          {player.age ? <Stat label="Age" value={player.age} /> : null}
          {player.yearsExp != null ? <Stat label="Exp" value={player.yearsExp} /> : null}
          <Stat label="Adds" value={player.rosterAdds} />
          <Stat label="Drops" value={player.rosterDrops} />
        </div>
      </Card>

      <Card>
        <SectionHeader>Week 1 Matchup</SectionHeader>
        <div className="grid grid-cols-3 gap-px bg-section/60">
          <Stat label="Opp" value={player.matchup} />
          <Stat label="FPA Rank" value={player.fantasyAgainst?.rank ?? "-"} />
          <Stat label="FPA Avg" value={player.fantasyAgainst?.avg?.toFixed(2) ?? "-"} />
        </div>
      </Card>

      <CurrentStatSection title="Passing" rows={[
        ["Att", actual.passAtt, projection.passAtt],
        ["Cmp", actual.passCmp, projection.passCmp],
        ["Yds", actual.passYds, projection.passYds],
        ["TD", actual.passTD, projection.passTD],
        ["Int", actual.passInt, projection.passInt],
      ]} />
      <CurrentStatSection title="Rushing" rows={[
        ["Att", actual.rushAtt, projection.rushAtt],
        ["Yds", actual.rushYds, projection.rushYds],
        ["TD", actual.rushTD, projection.rushTD],
      ]} />
      <CurrentStatSection title="Receiving" rows={[
        ["Tgt", actual.targets, projection.targets],
        ["Rec", actual.rec, projection.rec],
        ["Yds", actual.recYds, projection.recYds],
        ["TD", actual.recTD, projection.recTD],
      ]} />
      <CurrentStatSection title="Kicking / Defense" rows={[
        ["FG", actual.fgMade, projection.fgMade],
        ["XP", actual.xpMade, projection.xpMade],
        ["Sack", actual.defSack, projection.defSack],
        ["Int", actual.defInt, projection.defInt],
        ["TD", actual.defTD, projection.defTD],
      ]} />
    </div>
  );
}

function statusLabel(player: PlayerBrowserItem): string {
  if (player.injuryStatus) return player.injuryStatus;
  if (player.sleeperStatus) return player.sleeperStatus;
  return player.status;
}

function CurrentStatSection({
  title,
  rows,
}: {
  title: string;
  rows: [string, number, number][];
}) {
  const visible = rows.filter(([, actual, projection]) => actual || projection);
  if (!visible.length) return null;

  return (
    <Card>
      <SectionHeader>{title}</SectionHeader>
      <div className="grid grid-cols-3 gap-px bg-section/60">
        {visible.map(([label, actual, projection]) => (
          <div key={label} className="bg-card px-2 py-2.5 text-center">
            <div className="font-cond text-lg font-bold tabular-nums">{actual ? actual.toFixed(actual % 1 ? 2 : 0) : "-"}</div>
            <div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
            {projection ? <div className="mt-0.5 font-cond text-xs italic text-text-muted">{projection.toFixed(2)}</div> : null}
          </div>
        ))}
      </div>
    </Card>
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
      className={`flex items-center gap-2.5 px-3 py-2 ${alt ? "bg-card" : "bg-row"} ${g.started ? "" : "opacity-60"}`}
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
