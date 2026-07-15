import { getPowerRankings } from "@/lib/power-rankings";
import { Card, Hexagon, PageIntro, SectionHeader, TeamAvatar, TeamLink, rankBadgeTone } from "@/components/ui";

export const metadata = { title: "Power Rankings - MGL Fantasy" };

export default function PowerRankingsPage() {
  const { updated, intro, entries } = getPowerRankings();
  const updatedLabel = new Date(updated + "T00:00:00").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // Group consecutive entries by tier, preserving order.
  const groups: { tier: string; entries: typeof entries }[] = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (last && last.tier === e.tier) last.entries.push(e);
    else groups.push({ tier: e.tier, entries: [e] });
  }

  return (
    <div>
      <PageIntro title="TP's Power Rankings" subtitle={intro} />
      <div className="mb-2 px-1 font-cond text-xs font-semibold uppercase tracking-widest text-text-muted">
        Updated {updatedLabel}
      </div>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.tier}>
            {g.tier && <SectionHeader>{g.tier}</SectionHeader>}
            <Card className={g.tier ? "rounded-t-none" : ""}>
              {g.entries.map((e, i) => (
                <div
                  key={e.team.id}
                  className={`flex items-center gap-3 px-3 py-3 ${i % 2 ? "bg-card" : "bg-row"}`}
                >
                  <Hexagon value={e.rank} tone={rankBadgeTone(e.rank)} />
                  <TeamAvatar team={e.team} size="md" />
                  <div className="min-w-0 flex-1">
                    {e.team.id > 0 ? (
                      <TeamLink team={e.team} className="font-cond text-lg font-semibold leading-tight">
                        {e.team.name}
                      </TeamLink>
                    ) : (
                      <div className="font-cond text-lg font-semibold leading-tight">{e.team.name}</div>
                    )}
                    {e.team.manager && (
                      <div className="text-xs text-text-muted">{e.team.manager}</div>
                    )}
                    {e.note && <div className="mt-0.5 text-sm text-text">{e.note}</div>}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        ))}
      </div>
      <p className="px-1 pt-3 text-xs text-text-dim">
        These are TP&apos;s personal rankings. Only TP can change the order.
      </p>
    </div>
  );
}
