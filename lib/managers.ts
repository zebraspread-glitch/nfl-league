import { getFranchiseSeasons } from "./league-data";
import { getFranchiseGames } from "./games";
import { TEAMS } from "./teams";
import type { TeamMeta } from "./types";

export interface ManagerTeamRecord {
  team: TeamMeta;
  name: string;
  seasons: number;
  wins: number;
  losses: number;
  ties: number;
  championships: number;
  runnerUps: number;
  podiums: number;
  bestFinish: number;
  titleYears: number[];
}

export interface ManagerProfile {
  id: string;
  name: string;
  teams: ManagerTeamRecord[];
  seasons: number;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  avgPointsFor: number;
  championships: number;
  runnerUps: number;
  podiums: number;
  bestFinish: number;
  playoffWins: number;
  playoffLosses: number;
  playoffWinPct: number;
  highScore: number;
  lowScore: number;
  legacyScore: number;
}

function managerId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function managerProfileId(team: TeamMeta, name: string): string {
  if (name === "Noah" && team.id === 3) return "noah-deaaron";
  if (name === "Noah" && team.id === 5) return "noah-lavar";
  return managerId(name);
}

function emptyProfile(id: string, name: string): ManagerProfile {
  return {
    id,
    name,
    teams: [],
    seasons: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    winPct: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDiff: 0,
    avgPointsFor: 0,
    championships: 0,
    runnerUps: 0,
    podiums: 0,
    bestFinish: 0,
    playoffWins: 0,
    playoffLosses: 0,
    playoffWinPct: 0,
    highScore: 0,
    lowScore: 0,
    legacyScore: 0,
  };
}

export async function getManagerProfiles(): Promise<ManagerProfile[]> {
  const profiles = new Map<string, ManagerProfile>();

  for (const team of TEAMS) {
    const games = await getFranchiseGames(team.id);
    const seasons = getFranchiseSeasons(team.id);

    if (team.id === 7) {
      addManagerSegment({
        profiles,
        profileId: "oliver",
        managerName: "Oliver",
        team,
        teamName: "Oliver / Cleveland",
        seasons: seasons.filter((season) => season.name !== "Tinkle Van Ginkel"),
        games: games.filter((game) => game.self.name !== "Tinkle Van Ginkel"),
      });
      addManagerSegment({
        profiles,
        profileId: "xavier",
        managerName: "Xavier",
        team,
        teamName: team.name,
        seasons: seasons.filter((season) => season.name === "Tinkle Van Ginkel"),
        games: games.filter((game) => game.self.name === "Tinkle Van Ginkel"),
      });
      addManagerSegment({
        profiles,
        profileId: "joseph",
        managerName: "Joseph",
        team,
        teamName: team.name,
        seasons: seasons.filter((season) => season.name === "Tinkle Van Ginkel"),
        games: games.filter((game) => game.self.name === "Tinkle Van Ginkel"),
      });
      continue;
    }

    addManagerSegment({
      profiles,
      profileId: managerProfileId(team, team.manager || "Unknown"),
      managerName: team.manager || "Unknown",
      team,
      teamName: team.name,
      seasons,
      games,
    });

    if (team.id === 6) {
      addManagerSegment({
        profiles,
        profileId: "xavier",
        managerName: "Xavier",
        team,
        teamName: "Monke Vengence",
        seasons: seasons.filter((season) => season.season === 2024),
        games: games.filter((game) => game.game.season === 2024),
      });
    }

    if (team.id === 4) {
      addManagerSegment({
        profiles,
        profileId: "joseph",
        managerName: "Joseph",
        team,
        teamName: "GinniVan Jefferson",
        seasons: seasons.filter((season) => season.season === 2024),
        games: games.filter((game) => game.game.season === 2024),
      });
    }
  }

  return [...profiles.values()]
    .map((profile) => {
      const games = profile.wins + profile.losses + profile.ties;
      const playoffGames = profile.playoffWins + profile.playoffLosses;
      const pointDiff = round(profile.pointsFor - profile.pointsAgainst);
      const winPct = games ? profile.wins / games : 0;
      const playoffWinPct = playoffGames ? profile.playoffWins / playoffGames : 0;
      const legacyScore = round(
        profile.championships * 100 +
          profile.runnerUps * 45 +
          profile.podiums * 18 +
          profile.playoffWins * 14 +
          profile.wins * 3 +
          winPct * 55 +
          profile.pointsFor / 90 +
          pointDiff / 120 -
          profile.losses * 0.75,
      );

      return {
        ...profile,
        teams: profile.teams.sort((a, b) => b.championships - a.championships || b.wins - a.wins),
        winPct: round(winPct),
        playoffWinPct: round(playoffWinPct),
        pointDiff,
        avgPointsFor: games ? round(profile.pointsFor / games) : 0,
        highScore: round(profile.highScore),
        lowScore: round(profile.lowScore),
        legacyScore,
      };
    })
    .sort((a, b) => b.legacyScore - a.legacyScore || b.championships - a.championships || b.wins - a.wins);
}

function addManagerSegment({
  profiles,
  profileId,
  managerName,
  team,
  teamName,
  seasons,
  games,
}: {
  profiles: Map<string, ManagerProfile>;
  profileId: string;
  managerName: string;
  team: TeamMeta;
  teamName: string;
  seasons: ReturnType<typeof getFranchiseSeasons>;
  games: Awaited<ReturnType<typeof getFranchiseGames>>;
}) {
  if (!seasons.length && !games.length) return;

  const profile = profiles.get(profileId) ?? emptyProfile(profileId, managerName);
  const playoffGames = games.filter((game) => game.game.week > 14);
  const pointsFor = round(games.reduce((sum, game) => sum + game.self.total, 0));
  const pointsAgainst = round(games.reduce((sum, game) => sum + game.opp.total, 0));
  const highScore = games.length ? Math.max(...games.map((game) => game.self.total)) : 0;
  const lowScore = games.length ? Math.min(...games.map((game) => game.self.total)) : 0;
  const championships = seasons.filter((season) => season.champion).length;
  const runnerUps = seasons.filter((season) => season.finalRank === 2).length;
  const podiums = seasons.filter((season) => season.finalRank <= 3).length;
  const titleYears = seasons.filter((season) => season.champion).map((season) => season.season);
  const bestFinish = seasons.length ? Math.min(...seasons.map((season) => season.finalRank)) : 0;
  const wins = games.filter((game) => game.result === "W").length;
  const losses = games.filter((game) => game.result === "L").length;
  const ties = games.filter((game) => game.result === "T").length;

  profile.teams.push({
    team,
    name: teamName,
    seasons: seasons.length,
    wins,
    losses,
    ties,
    championships,
    runnerUps,
    podiums,
    bestFinish,
    titleYears,
  });

  profile.seasons += seasons.length;
  profile.wins += wins;
  profile.losses += losses;
  profile.ties += ties;
  profile.pointsFor = round(profile.pointsFor + pointsFor);
  profile.pointsAgainst = round(profile.pointsAgainst + pointsAgainst);
  profile.championships += championships;
  profile.runnerUps += runnerUps;
  profile.podiums += podiums;
  profile.playoffWins += playoffGames.filter((game) => game.result === "W").length;
  profile.playoffLosses += playoffGames.filter((game) => game.result === "L").length;
  profile.highScore = Math.max(profile.highScore, highScore);
  profile.lowScore = profile.lowScore ? Math.min(profile.lowScore, lowScore || profile.lowScore) : lowScore;
  profile.bestFinish = profile.bestFinish && bestFinish ? Math.min(profile.bestFinish, bestFinish) : bestFinish || profile.bestFinish;
  profiles.set(profileId, profile);
}
