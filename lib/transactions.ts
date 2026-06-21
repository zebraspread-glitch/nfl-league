import { franchiseForName } from "./franchises";
import type { TeamMeta } from "./types";

// Every add/drop (waiver & free-agent) transaction scraped from the NFL.com
// Fantasy transaction log (see scripts/scrape-transactions.mjs).

export interface TransactionPlayer {
  playerId: number;
  name: string;
  pos: string;
  proTeam: string;
}

export interface Transaction {
  id: string;
  season: number;
  week: number;
  date: string;
  type: "add" | "drop";
  player: TransactionPlayer | null;
  fromTeamId: number | null;
  fromName: string;
  toTeamId: number | null;
  toName: string;
  fromTeam?: TeamMeta;
  toTeam?: TeamMeta;
}

interface RawTransaction extends Omit<Transaction, "fromTeam" | "toTeam"> {}

let cache: Transaction[] | null = null;

export async function getAllTransactions(): Promise<Transaction[]> {
  if (cache) return cache;
  const mod = await import("@/data/transactions.json");
  const raw = mod.default as RawTransaction[];
  cache = raw.map((t) => ({
    ...t,
    fromTeam: franchiseForName(t.fromName),
    toTeam: franchiseForName(t.toName),
  }));
  return cache;
}

export async function getTransactionSeasons(): Promise<number[]> {
  const all = await getAllTransactions();
  return [...new Set(all.map((t) => t.season))].sort((a, b) => b - a);
}
