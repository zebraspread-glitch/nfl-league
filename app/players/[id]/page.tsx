import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerProfile, type PlayerGameLog } from "@/lib/players";
import { proTeamLogoUrl, resolvePlayerImage, POS_COLOR } from "@/lib/player-images";
import { Card, EmptyState, SectionHeader, Score, TeamAvatar } from "@/components/ui";
import { weekLabel } from "@/lib/games";
import { getCurrentPlayerProfile, PLAYER_DATA_SEASON, PLAYER_PROFILE_WEEK } from "../player-data";
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
    if (currentProfile) return <CurrentPlayerProfile player={currentProfile} game={await getCurrentGame(currentProfile)} />;
  }

  const playerId = Number(id);
  const profile = playerId ? await getPlayerProfile(playerId) : null;
  if (!profile) {
    const currentProfile = await getCurrentPlayerProfile(id);
    if (currentProfile) return <CurrentPlayerProfile player={currentProfile} game={await getCurrentGame(currentProfile)} />;
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

const SLEEPER_SCORE_API = "https://api.sleeper.app/scores/nfl/regular";

interface SleeperScoreGame {
  status?: string;
  date?: string;
  game_id?: string;
  week?: number;
  metadata?: {
    away_score?: number;
    away_team?: string;
    closed?: boolean;
    has_started?: boolean;
    home_score?: number;
    home_team?: string;
    is_in_progress?: boolean;
    is_over?: boolean;
    status?: string;
  };
}

interface CurrentGame {
  awayTeam: string;
  homeTeam: string;
  awayScore?: number;
  homeScore?: number;
  status: string;
  started: boolean;
  complete: boolean;
  date?: string;
}

const NFL_TEAM_NAMES: Record<string, string> = {
  ARI: "Arizona Cardinals",
  ATL: "Atlanta Falcons",
  BAL: "Baltimore Ravens",
  BUF: "Buffalo Bills",
  CAR: "Carolina Panthers",
  CHI: "Chicago Bears",
  CIN: "Cincinnati Bengals",
  CLE: "Cleveland Browns",
  DAL: "Dallas Cowboys",
  DEN: "Denver Broncos",
  DET: "Detroit Lions",
  GB: "Green Bay Packers",
  HOU: "Houston Texans",
  IND: "Indianapolis Colts",
  JAC: "Jacksonville Jaguars",
  JAX: "Jacksonville Jaguars",
  KC: "Kansas City Chiefs",
  LAC: "Los Angeles Chargers",
  LAR: "Los Angeles Rams",
  LV: "Las Vegas Raiders",
  MIA: "Miami Dolphins",
  MIN: "Minnesota Vikings",
  NE: "New England Patriots",
  NO: "New Orleans Saints",
  NYG: "New York Giants",
  NYJ: "New York Jets",
  PHI: "Philadelphia Eagles",
  PIT: "Pittsburgh Steelers",
  SEA: "Seattle Seahawks",
  SF: "San Francisco 49ers",
  TB: "Tampa Bay Buccaneers",
  TEN: "Tennessee Titans",
  WAS: "Washington Commanders",
};

async function getCurrentGame(player: PlayerBrowserItem): Promise<CurrentGame | null> {
  const week = player.gameWeek ?? PLAYER_PROFILE_WEEK;
  try {
    const res = await fetch(`${SLEEPER_SCORE_API}/${PLAYER_DATA_SEASON}/${week}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;

    const games = (await res.json()) as SleeperScoreGame[];
    const row = games.find((game) => game.game_id === player.gameId) ?? games.find((game) => {
      const meta = game.metadata;
      return meta?.away_team === player.proTeam || meta?.home_team === player.proTeam;
    });
    if (!row) return null;

    const meta = row.metadata ?? {};
    const awayTeam = meta.away_team ?? "";
    const homeTeam = meta.home_team ?? "";
    const started = Boolean(meta.has_started) || !["", "pre_game", "scheduled"].includes(row.status ?? "");
    const complete = Boolean(meta.is_over || meta.closed || row.status === "complete");

    return {
      awayTeam,
      homeTeam,
      awayScore: meta.away_score,
      homeScore: meta.home_score,
      status: row.status ?? meta.status ?? "",
      started,
      complete,
      date: row.date,
    };
  } catch (err) {
    console.warn("[players] Sleeper score fetch failed", err);
    return null;
  }
}

function CurrentPlayerProfile({ player, game }: { player: PlayerBrowserItem; game: CurrentGame | null }) {
  const projectionSeason = expandCurrentStats(player.projection);
  const weekKey = String(player.gameWeek ?? PLAYER_PROFILE_WEEK);
  const actualWeek = expandCurrentStats(player.statsByPeriod[weekKey] ?? {});
  const projectionWeek = expandCurrentStats(player.projectionsByPeriod[weekKey] ?? {});
  const gameStarted = Boolean(game?.started);
  const displayStats = gameStarted ? actualWeek : projectionWeek;
  const teamLogo = proTeamLogoUrl(player.proTeam);
  const firstName = player.firstName || player.fullName.split(" ")[0] || player.fullName;
  const lastName = player.lastName || player.fullName.split(" ").slice(1).join(" ");
  const teamName = nflTeamName(player.proTeam);
  const opponentTeam = player.opponent || (player.proTeam === game?.awayTeam ? game?.homeTeam : game?.awayTeam) || "";
  const projectedPoints = projectionWeek.projected || projectionSeason.projected;
  const avgProjected = averagePoints(projectionSeason.projected, projectionSeason.gp);
  const rank = player.projectionRank > 999 ? "-" : player.projectionRank;

  return (
    <div className="-mx-3 -mt-3 min-h-[calc(100dvh-4rem)] bg-[#d9d6cf] pb-10 text-[#303236] sm:mx-auto sm:max-w-xl sm:overflow-hidden sm:rounded-2xl">
      <section className="relative overflow-hidden bg-[#eeeeef] shadow-[0_4px_10px_rgba(0,0,0,0.22)]">
        {teamLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={teamLogo}
            alt=""
            className="pointer-events-none absolute -left-10 top-0 h-[360px] w-[360px] object-contain opacity-[0.045] grayscale"
            aria-hidden="true"
          />
        ) : null}

        <Link
          href="/players"
          aria-label="Close player profile"
          className="absolute right-3 top-3 z-20 grid h-[74px] w-[74px] place-items-center rounded-2xl bg-[#dfdfdf]/90 text-[54px] font-light leading-none text-[#5f6062] shadow-sm"
        >
          &times;
        </Link>

        <div className="relative min-h-[322px] px-6 pt-16">
          <div className="relative z-10 max-w-[54%]">
            <h1 className="font-cond text-[54px] font-bold leading-[0.96] tracking-normal text-[#343537]">
              {firstName}
              {lastName ? (
                <>
                  <br />
                  {lastName}
                </>
              ) : null}
            </h1>

            <div className="mt-7 flex items-center gap-4">
              <TeamLogo abbr={player.proTeam} size="lg" />
              <div className="min-w-0 font-cond text-[25px] font-bold leading-tight text-[#3d3f42]">
                <div className="truncate">{teamName}</div>
                <div>
                  {player.pos} - #{player.jerseyNumber ?? "-"}
                </div>
              </div>
            </div>
            <div className="mt-7 font-cond text-[25px] font-bold text-[#3d3f42]">{player.manager}</div>
          </div>

          <PlayerHeroImage player={player} />
        </div>

        <div className="grid grid-cols-5 items-center bg-white px-3 py-6 text-center">
          <ProfileMetric label="BYE WK" value={player.byeWeek ?? "-"} />
          <ProfileMetric label="AVG PTS" value={formatDecimal(avgProjected, 2)} />
          <div className="relative grid min-h-[96px] place-items-center">
            <div className="absolute h-[104px] w-[98px] bg-[#f5f5f5] [clip-path:polygon(50%_0,94%_25%,94%_75%,50%_100%,6%_75%,6%_25%)]" />
            <div className="absolute h-[92px] w-[86px] bg-white [clip-path:polygon(50%_0,94%_25%,94%_75%,50%_100%,6%_75%,6%_25%)]" />
            <div className="relative z-10">
              <div className="font-cond text-[23px] font-medium leading-none text-[#747579]">{player.pos} RNK</div>
              <div className="font-cond text-[58px] font-bold italic leading-none text-[#333436]">{rank}</div>
            </div>
          </div>
          <ProfileMetric label="ROST %" value="-" />
          <ProfileMetric label="START %" value="-" />
        </div>

        <nav className="grid grid-cols-3 bg-white font-cond text-[31px] font-normal text-[#606164] shadow-[0_3px_9px_rgba(0,0,0,0.2)]">
          <div className="border-b-[6px] border-[#0fb5cf] py-5 text-center">Overview</div>
          <div className="py-5 text-center">Stats</div>
          <div className="py-5 text-center">Film Room</div>
        </nav>
      </section>

      <main className="pt-72">
        <section className="mx-5 overflow-hidden rounded-2xl bg-white shadow-[0_4px_0_rgba(0,0,0,0.18)]">
          <div className="p-7">
            <h2 className="font-cond text-[34px] font-bold uppercase tracking-normal text-[#303236]">
              Week {player.gameWeek ?? PLAYER_PROFILE_WEEK} Matchup
            </h2>

            <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <TeamScore team={game?.awayTeam || (player.proTeam === opponentTeam ? opponentTeam : player.proTeam)} score={game?.awayScore} />
              <div className="grid min-w-[98px] justify-items-center text-center font-cond uppercase text-[#d1d1d1]">
                <div className="h-7 border-l border-[#e2e2e2]" />
                <div className="text-[24px] font-bold leading-none">{gameStatusLabel(game)}</div>
                <div className="h-7 border-l border-[#e2e2e2]" />
              </div>
              <TeamScore team={game?.homeTeam || opponentTeam || player.opponent || player.proTeam} score={game?.homeScore} align="right" />
            </div>

            <div className="mt-6 grid grid-cols-[1fr_auto] gap-3 font-cond">
              <div>
                <div className="text-[27px] font-bold text-[#3d3f42]">Points Scored</div>
                <div className="mt-5 text-[26px] font-normal text-[#707174]">Projected</div>
              </div>
              <div className="text-right">
                <div className="text-[46px] font-bold italic leading-none text-[#303236]">
                  {gameStarted ? formatDecimal(actualWeek.points, 2) : "-"}
                </div>
                <div className="mt-3 text-[27px] font-bold italic leading-none text-[#6a6b6e]">{formatDecimal(projectedPoints, 2)}</div>
              </div>
            </div>
          </div>

          <div className="bg-[#f6f6f6] px-7 py-8">
            <CurrentStatSection
              title="Rushing"
              rows={[
                ["ATT", displayStats.rushAtt],
                ["RUSH YDS", displayStats.rushYds],
                ["RUSH TD", displayStats.rushTD],
                ["FUM", 0],
                ["FUM LST", displayStats.fumLost],
              ]}
            />
            <CurrentStatSection
              title="Receiving"
              rows={[
                ["TGT", displayStats.targets],
                ["REC", displayStats.rec],
                ["REC YDS", displayStats.recYds],
                ["REC TD", displayStats.recTD],
              ]}
            />
            <CurrentStatSection
              title="Passing"
              rows={[
                ["ATT", displayStats.passAtt],
                ["CMP", displayStats.passCmp],
                ["PASS YDS", displayStats.passYds],
                ["PASS TD", displayStats.passTD],
                ["INT", displayStats.passInt],
              ]}
            />
            <CurrentStatSection
              title="Kicking"
              rows={[
                ["FG", displayStats.fgMade],
                ["FGA", displayStats.fgAtt],
                ["XP", displayStats.xpMade],
              ]}
            />
            <CurrentStatSection
              title="Defense"
              rows={[
                ["SACK", displayStats.defSack],
                ["INT", displayStats.defInt],
                ["TD", displayStats.defTD],
              ]}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function PlayerHeroImage({ player }: { player: PlayerBrowserItem }) {
  if (player.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={player.imageUrl}
        alt={player.fullName}
        width={320}
        height={320}
        className={`absolute bottom-0 right-0 z-0 h-[256px] max-w-[58%] object-contain object-bottom ${
          player.isLogo ? "p-10 opacity-40" : ""
        }`}
        suppressHydrationWarning
      />
    );
  }

  return (
    <span
      className="absolute bottom-8 right-7 grid h-32 w-32 place-items-center rounded-full font-cond text-3xl font-bold text-white"
      style={{ background: POS_COLOR[player.pos] ?? "#9aa1ad" }}
    >
      {player.pos || "-"}
    </span>
  );
}

function TeamLogo({ abbr, size = "md" }: { abbr?: string; size?: "md" | "lg" }) {
  const logo = proTeamLogoUrl(abbr);
  const classes = size === "lg" ? "h-[62px] w-[62px] p-2" : "h-[76px] w-[76px] p-3";
  if (!logo) {
    return (
      <span className={`${classes} grid shrink-0 place-items-center rounded-full bg-[#f2f2f2] font-cond text-sm font-bold text-[#777]`}>
        {abbr || "-"}
      </span>
    );
  }

  return (
    <span className={`${classes} grid shrink-0 place-items-center rounded-full bg-[#f2f2f2]`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt={abbr ?? "NFL team"} className="h-full w-full object-contain" />
    </span>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="font-cond">
      <div className="text-[22px] font-medium leading-none text-[#747579]">{label}</div>
      <div className="mt-3 text-[37px] font-bold leading-none text-[#333436]">{value}</div>
    </div>
  );
}

function TeamScore({ team, score, align = "left" }: { team?: string; score?: number; align?: "left" | "right" }) {
  const right = align === "right";
  return (
    <div className={`flex items-center gap-5 ${right ? "justify-end" : ""}`}>
      {!right ? <TeamLogo abbr={team} /> : null}
      <div className="font-cond text-[47px] font-bold italic leading-none text-[#303236]">{typeof score === "number" ? score : "-"}</div>
      {right ? <TeamLogo abbr={team} /> : null}
    </div>
  );
}

function CurrentStatSection({ title, rows }: { title: string; rows: [string, number][] }) {
  if (!rows.some(([, value]) => value)) return null;

  return (
    <div className="mb-10 last:mb-0">
      <h3 className="font-cond text-[29px] font-bold uppercase tracking-wider text-[#303236]">{title}</h3>
      <div className="mt-4 grid grid-cols-4 gap-x-6 gap-y-8 sm:grid-cols-5">
        {rows.map(([label, value]) => (
          <div key={label} className="font-cond">
            <div className="text-[22px] font-medium uppercase leading-none text-[#747579]">{label}</div>
            <div className="mt-2 text-[35px] font-bold leading-none text-[#303236]">{formatStat(value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function nflTeamName(abbr?: string): string {
  if (!abbr) return "Free Agent";
  return NFL_TEAM_NAMES[abbr] ?? abbr;
}

function gameStatusLabel(game: CurrentGame | null): string {
  if (!game?.started) return "Scheduled";
  if (game.complete) return "Final";
  return game.status ? game.status.replace(/_/g, " ") : "Live";
}

function averagePoints(total: number, games?: number): number {
  return games ? total / games : total;
}

function formatDecimal(value: number, decimals = 2): string {
  if (!Number.isFinite(value) || value === 0) return "-";
  return value.toFixed(decimals);
}

function formatStat(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "-";
  if (Math.abs(value) >= 10) return String(Math.round(value));
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
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
