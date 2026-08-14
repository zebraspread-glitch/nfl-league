"use client";

import { useEffect, useMemo, useState } from "react";
import type { LivePick, LiveTrade, TradePlayer, TradeSide } from "@/lib/draft-clock";
import { isDark, sampleLogoColor } from "@/lib/draft-colors";
import { POS_COLOR, sleeperPlayerImage } from "@/lib/player-images";
import type { TeamMeta } from "@/lib/types";

/** Reference-pixel helper, matching the banner's scale (see draft-clock.tsx). */
const px = (n: number) => `${(n * 100) / 419}vw`;

const ASSET_STAGGER_MS = 170;
/** First half reveals behind the box drop; the second is triggered by a button,
 *  so its rows follow straight after its own wipe. */
const FIRST_HALF_ASSET_DELAY_MS = 950;
const SECOND_HALF_ASSET_DELAY_MS = 420;

interface Half {
  team: TeamMeta;
  /** What this team receives — i.e. the other side's assets. */
  picks: LivePick[];
  players: TradePlayer[];
}

/** Sleeper headshot with a coloured position chip as the fallback, mirroring
 *  SleeperPlayerAvatar but sized in banner units rather than fixed pixels. */
function PlayerFace({ player, ink }: { player: TradePlayer; ink: string }) {
  const [failed, setFailed] = useState(false);
  const size = px(26);

  if (player.sleeperId && !failed) {
    const { url, isLogo } = sleeperPlayerImage(player.sleeperId);
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={player.name}
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full border border-black/20 ${isLogo ? "bg-white object-contain p-1" : "object-cover"}`}
        style={{ width: size, height: size, background: isLogo ? "#fff" : "rgba(0,0,0,0.15)" }}
      />
    );
  }

  return (
    <div
      className="grid shrink-0 place-items-center rounded-full font-cond font-bold text-white"
      style={{ width: size, height: size, background: POS_COLOR[player.pos] ?? "#9aa1ad", fontSize: px(9), color: ink }}
    >
      {player.pos}
    </div>
  );
}

function HalfPanel({
  half,
  side,
  background,
  revealed,
  assetBaseDelay,
}: {
  half: Half;
  side: "left" | "right";
  background: string;
  revealed: boolean;
  assetBaseDelay: number;
}) {
  const onDark = isDark(background);
  const ink = onDark ? "#ffffff" : "#0b1220";

  const rows = [
    ...half.picks.map((p) => ({
      key: `p${p.overall}`,
      main: `Pick ${p.overall}`,
      sub: `Round ${p.round}, Pick ${p.slot}`,
      player: undefined as TradePlayer | undefined,
    })),
    ...half.players.map((player) => ({
      key: `n${player.name}`,
      main: player.name,
      sub: [player.pos, player.proTeam].filter(Boolean).join(" · "),
      player,
    })),
  ];

  return (
    <div
      className={`flex-1 ${revealed ? (side === "left" ? "trade-side-left" : "trade-side-right") : ""}`}
      style={{
        background: revealed ? background : "#05070c",
        color: ink,
        padding: `${px(5)} ${px(11)}`,
      }}
    >
      <div style={{ opacity: revealed ? 1 : 0 }}>
        <div className="flex items-center" style={{ gap: px(5) }}>
          {half.team.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={half.team.logo}
              alt=""
              aria-hidden
              className="shrink-0 object-contain"
              style={{ width: px(18), height: px(18) }}
            />
          )}
          <div
            className="font-cond font-bold uppercase"
            style={{ fontSize: px(8), letterSpacing: "0.22em", opacity: 0.72 }}
          >
            {half.team.name} receive
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="font-cond font-extrabold uppercase" style={{ fontSize: px(12), opacity: 0.5 }}>
            Nothing
          </div>
        ) : (
          <div style={{ marginTop: px(2) }}>
            {rows.map((row, i) => (
              <div
                key={row.key}
                className={revealed ? "trade-asset flex items-center" : "flex items-center"}
                style={{ gap: px(5), animationDelay: `${assetBaseDelay + i * ASSET_STAGGER_MS}ms` }}
              >
                {row.player && <PlayerFace player={row.player} ink={ink} />}
                <div className="min-w-0">
                  <div
                    className="truncate font-cond font-extrabold uppercase leading-tight"
                    style={{ fontSize: px(12) }}
                  >
                    {row.main}
                  </div>
                  <div className="font-cond uppercase" style={{ fontSize: px(7), opacity: 0.6 }}>
                    {row.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function DraftTradeAlert({
  trade,
  picks,
  teams,
  players,
  accent,
  stage,
}: {
  trade: LiveTrade;
  /** The pre-trade order, so pick labels show who is giving what up. */
  picks: LivePick[];
  teams: TeamMeta[];
  players: TradePlayer[];
  accent: string;
  /** 0 = first team only, 1 = both teams. Advanced by the operator. */
  stage: number;
}) {
  const teamOf = (id: number) => teams.find((t) => t.id === id);
  const teamA = teamOf(trade.a.teamId);
  const teamB = teamOf(trade.b.teamId);

  const byName = useMemo(() => new Map(players.map((p) => [p.name, p])), [players]);

  // Match each half to its team's artwork, the same way the banner does.
  const [colors, setColors] = useState<Record<string, string>>({});
  const logoA = teamA?.logo;
  const logoB = teamB?.logo;
  useEffect(() => {
    let cancelled = false;
    for (const src of [logoA, logoB]) {
      if (!src) continue;
      void sampleLogoColor(src).then((hex) => {
        if (!cancelled && hex) setColors((c) => (c[src] === hex ? c : { ...c, [src]: hex }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [logoA, logoB]);

  if (!teamA || !teamB) return null;

  const pickList = (side: TradeSide) =>
    side.picks
      .map((overall) => picks.find((p) => p.overall === overall))
      .filter((p): p is LivePick => Boolean(p));

  const playerList = (side: TradeSide) =>
    side.players.map((name) => byName.get(name) ?? { name, pos: "FA" });

  // Each side receives what the *other* side gave up.
  const left: Half = { team: teamA, picks: pickList(trade.b), players: playerList(trade.b) };
  const right: Half = { team: teamB, picks: pickList(trade.a), players: playerList(trade.a) };

  const bgA = (logoA && colors[logoA]) || teamA.primary;
  const bgB = (logoB && colors[logoB]) || teamB.primary;

  return (
    <div className="trade-box relative w-screen overflow-hidden" style={{ marginTop: px(4) }}>
      <div
        className="flex items-center justify-center bg-black"
        style={{ paddingTop: px(4), paddingBottom: px(4) }}
      >
        <div className="trade-header font-cond font-extrabold italic uppercase" style={{ color: accent }}>
          <span className="trade-glow inline-block" style={{ fontSize: px(13) }}>
            Trade Alert
          </span>
        </div>
      </div>

      <div className="flex items-stretch" style={{ gap: px(1) }}>
        <HalfPanel
          half={left}
          side="left"
          background={bgA}
          revealed
          assetBaseDelay={FIRST_HALF_ASSET_DELAY_MS}
        />
        <HalfPanel
          half={right}
          side="right"
          background={bgB}
          revealed={stage >= 1}
          assetBaseDelay={SECOND_HALF_ASSET_DELAY_MS}
        />
      </div>

      <div
        aria-hidden
        className="trade-shine pointer-events-none absolute inset-y-0 left-0"
        style={{
          width: "18%",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)",
        }}
      />
    </div>
  );
}
