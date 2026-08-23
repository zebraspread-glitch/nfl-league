import { franchiseForName } from "./franchises";
import type { TeamMeta } from "./types";

// Every all-time trade. 2021-2025 are scraped from the NFL.com Fantasy
// transaction log (scripts/scrape-trades.mjs -> data/trades.json); 2026 on come
// from Sleeper (scripts/fetch-sleeper-trades.mjs -> data/trades-sleeper.json).
// The two live in separate files so re-running either fetcher can't clobber the
// other's seasons. Each trade has one "leg" per team involved, describing what
// that team sent and to whom.

export interface TradeItem {
  kind: "player" | "pick" | "faab";
  /** Scraped NFL.com id — 2021-2025 only. */
  playerId?: number;
  /** Sleeper's own player id — 2026 on. The two schemes don't overlap. */
  sleeperPlayerId?: string;
  name?: string;
  pos?: string;
  proTeam?: string;
  label?: string;
}

export interface TradeLeg {
  fromTeamId: number | null;
  fromName: string;
  toTeamId: number | null;
  toName: string;
  fromTeam?: TeamMeta;
  toTeam?: TeamMeta;
  items: TradeItem[];
}

export interface Trade {
  id: string;
  season: number;
  week: number;
  date: string;
  legs: TradeLeg[];
}

interface RawTrade extends Omit<Trade, "legs"> {
  legs: Omit<TradeLeg, "fromTeam" | "toTeam">[];
}

let cache: Trade[] | null = null;

/** The player's profile page, keyed by whichever id scheme the season used. */
export function tradePlayerHref(item: TradeItem): string | undefined {
  const id = item.sleeperPlayerId ?? item.playerId;
  return id ? `/players/${id}` : undefined;
}

async function loadRaw(path: "trades" | "trades-sleeper"): Promise<RawTrade[]> {
  try {
    const mod = await import(`@/data/${path}.json`);
    return mod.default as RawTrade[];
  } catch {
    // The Sleeper file only exists once a Sleeper season has trades in it.
    return [];
  }
}

export async function getAllTrades(): Promise<Trade[]> {
  if (cache) return cache;
  const [scraped, sleeper] = await Promise.all([loadRaw("trades"), loadRaw("trades-sleeper")]);
  cache = [...sleeper, ...scraped]
    .sort((a, b) => b.season - a.season || b.week - a.week || b.id.localeCompare(a.id))
    .map((t) => ({
      ...t,
      legs: t.legs.map((l) => ({
        ...l,
        fromTeam: franchiseForName(l.fromName),
        toTeam: franchiseForName(l.toName),
      })),
    }));
  return cache;
}

export async function getTradeSeasons(): Promise<number[]> {
  const trades = await getAllTrades();
  return [...new Set(trades.map((t) => t.season))].sort((a, b) => b - a);
}
