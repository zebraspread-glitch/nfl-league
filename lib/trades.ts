import { franchiseForName } from "./franchises";
import type { TeamMeta } from "./types";

// Every all-time trade scraped from the NFL.com Fantasy transaction log
// (see scripts/scrape-trades.mjs). Each trade has one "leg" per team
// involved, describing what that team sent and to whom.

export interface TradeItem {
  kind: "player" | "pick";
  playerId?: number;
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

export async function getAllTrades(): Promise<Trade[]> {
  if (cache) return cache;
  const mod = await import("@/data/trades.json");
  const raw = mod.default as RawTrade[];
  cache = raw.map((t) => ({
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
