import { getKeepers, getSnapshot, type KeeperPlayer } from "@/lib/sleeper";
import { Card, PageIntro, SectionHeader, TeamAvatar, TeamLink, EmptyState } from "@/components/ui";
import { SleeperPlayerAvatar } from "@/components/sleeper-player-avatar";
import { POS_COLOR } from "@/lib/player-images";

export const metadata = { title: "Keepers Board - MGL Fantasy" };

// Refresh a couple of times an hour — keepers can change until the draft locks.
export const revalidate = 900;

function PosChip({ pos }: { pos: string }) {
  return (
    <span
      className="grid h-5 min-w-[26px] place-items-center rounded px-1 font-cond text-[11px] font-bold text-white"
      style={{ background: POS_COLOR[pos] ?? "#9aa1ad" }}
    >
      {pos}
    </span>
  );
}

function KeeperRow({ p, striped }: { p: KeeperPlayer; striped: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 ${striped ? "bg-row" : "bg-card"}`}>
      <SleeperPlayerAvatar sleeperId={p.sleeperId} pos={p.position} name={p.name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-cond text-[15px] font-semibold leading-tight">{p.name}</div>
        <div className="text-xs text-text-muted">{p.proTeam ?? "FA"}</div>
      </div>
      <PosChip pos={p.position} />
    </div>
  );
}

export default function KeepersPage() {
  return <KeepersBoard />;
}

async function KeepersBoard() {
  const { season } = getSnapshot();
  const board = await getKeepers();
  const withPlayers = board.filter((t) => t.players.length > 0);

  if (withPlayers.length === 0) {
    return (
      <div>
        <PageIntro title="Keepers Board" subtitle={`Kept players heading into the ${season} draft`} />
        <Card>
          <EmptyState>No keepers are set yet. Check back closer to the draft.</EmptyState>
        </Card>
      </div>
    );
  }

  const totalKept = withPlayers.reduce((n, t) => n + t.players.length, 0);

  return (
    <div>
      <PageIntro
        title="Keepers Board"
        subtitle={`${totalKept} players kept across ${withPlayers.length} teams for the ${season} season`}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {board.map((t) => (
          <div key={t.team.id}>
            <SectionHeader>
              <div className="flex items-center gap-2.5">
                <TeamAvatar team={t.team} size="sm" />
                <div className="flex-1">
                  {t.team.id > 0 ? (
                    <TeamLink team={t.team} className="text-base">
                      {t.team.name}
                    </TeamLink>
                  ) : (
                    <span>{t.team.name}</span>
                  )}
                </div>
                <span className="font-cond text-sm font-semibold text-text-muted">
                  {t.players.length}
                </span>
              </div>
            </SectionHeader>
            <Card className="rounded-t-none">
              {t.players.length === 0 ? (
                <EmptyState>No keepers set</EmptyState>
              ) : (
                t.players.map((p, i) => <KeeperRow key={p.sleeperId} p={p} striped={i % 2 === 0} />)
              )}
            </Card>
          </div>
        ))}
      </div>
      <p className="px-1 pt-3 text-xs text-text-dim">
        Live from Sleeper. Rosters currently hold only kept players; they fill out at the {season} draft.
      </p>
    </div>
  );
}
