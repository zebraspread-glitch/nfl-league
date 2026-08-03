// Sanity-checks the FantasyPros pool: node can't import lib/mock-draft.ts
// directly (its imports are extensionless), so keeper names are read from source.
import { readFileSync } from "node:fs";
import { FANTASYPROS_ECR_2026 as ECR } from "../lib/fantasypros-ecr.ts";

const problems = [];
if (ECR.length !== 517) problems.push(`expected 517 rows, got ${ECR.length}`);

const firstBreak = ECR.findIndex((p, i) => p.rank !== i + 1);
if (firstBreak !== -1) problems.push(`ranks not contiguous 1..517 at index ${firstBreak} (rank ${ECR[firstBreak].rank})`);

const VALID = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);
for (const p of ECR) {
  if (!VALID.has(p.pos)) problems.push(`bad pos "${p.pos}" for ${p.name}`);
  if (!p.proTeam) problems.push(`missing team for ${p.name}`);
  if (p.proTeam === "FA") {
    if (p.bye !== undefined) problems.push(`FA ${p.name} should have no bye`);
  } else if (!(p.bye >= 5 && p.bye <= 14)) {
    problems.push(`bad bye ${p.bye} for ${p.name}`);
  }
}

const dupes = ECR.map((p) => p.name).filter((n, i, a) => a.indexOf(n) !== i);
if (dupes.length) problems.push(`duplicate names: ${dupes.join(", ")}`);

// Keepers are excluded from the draftable pool by exact name match, so any
// keeper spelled differently to its pool entry would be draftable twice.
const src = readFileSync(new URL("../lib/mock-draft.ts", import.meta.url), "utf8");
const keeperBlock = src.slice(src.indexOf("const KEEPER_ROUNDS"), src.indexOf("/** Full 15-round board"));
const keepers = [...keeperBlock.matchAll(/name: "([^"]+)"/g)].map((m) => m[1]);
const poolNames = new Set(ECR.map((p) => p.name));
const unmatched = keepers.filter((n) => !poolNames.has(n));
if (keepers.length !== 48) problems.push(`expected 48 keepers, found ${keepers.length}`);
if (unmatched.length) problems.push(`keepers missing from pool (would be draftable twice): ${unmatched.join(", ")}`);

const byPos = {};
for (const p of ECR) byPos[p.pos] = (byPos[p.pos] ?? 0) + 1;

console.log(`pool: ${ECR.length} players`, byPos);
console.log(`keepers: ${keepers.length} -> draftable: ${ECR.length - keepers.length}`);
if (problems.length) {
  console.error("PROBLEMS:\n" + problems.map((p) => " - " + p).join("\n"));
  process.exit(1);
}
console.log("all checks passed");

// Keeper rows carry their own proTeam/bye, so flag any that disagree with the
// refreshed ECR (a player who changed NFL team since the keeper list was typed).
const ecrByName = new Map(ECR.map((p) => [p.name, p]));
const keeperRows = [...keeperBlock.matchAll(/name: "([^"]+)", pos: "[^"]+", proTeam: "([^"]+)", bye: (\d+)/g)];
const stale = keeperRows
  .map(([, name, team, bye]) => ({ name, team, bye: Number(bye), ecr: ecrByName.get(name) }))
  .filter((r) => r.ecr && (r.ecr.proTeam !== r.team || r.ecr.bye !== r.bye));
if (stale.length) {
  console.log("\nkeepers whose team/bye differ from the ECR board:");
  for (const r of stale) console.log(` - ${r.name}: keeper says ${r.team} bye ${r.bye}, ECR says ${r.ecr.proTeam} bye ${r.ecr.bye}`);
}
