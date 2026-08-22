import { DraftOverlayClient } from "@/components/draft-overlay-client";
import { DraftOverlayManual } from "@/components/draft-overlay-manual";
import { buildLiveDraftOrder } from "@/lib/draft-clock";
import { tradablePlayers } from "@/lib/draft-tradables";
import { MGL_DRAFT_ID } from "@/lib/sleeper-draft";

export const metadata = {
  title: "Draft Overlay - MGL Fantasy",
  robots: { index: false, follow: false },
};

/**
 * The banner on its own, transparent, for the extension to lay over the Sleeper
 * draft room. Deliberately outside /admin: in an iframe on sleeper.com the
 * admin cookie is third-party and never sent, so a gated route would only ever
 * render the login screen there. Nothing here isn't already public — the board
 * is the same one /mock-draft shows, and there is no server state to reach.
 *
 * ?manual=1 runs the operator's own clock; without it the banner follows the
 * live Sleeper draft and there is nothing to press.
 */
export default async function DraftOverlayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const requested = Number(one("scale"));
  const scale = Number.isFinite(requested) ? Math.min(1, Math.max(0.2, requested)) : 0.62;
  const manual = one("manual") === "1";

  return (
    <>
      {/* The site chrome would otherwise show through the transparent areas and
          land on top of the draft board. */}
      <style>{`
        html, body { background: transparent !important; }
        .app-shell { background: transparent !important; min-height: 0 !important; }
        .app-shell > *:not(main) { display: none !important; }
        .app-shell > main { padding: 0 !important; }
      `}</style>
      {manual ? (
        <DraftOverlayManual
          picks={buildLiveDraftOrder()}
          players={await tradablePlayers()}
          scale={scale}
        />
      ) : (
        <DraftOverlayClient
          picks={buildLiveDraftOrder()}
          draftId={one("draft") || MGL_DRAFT_ID}
          scale={scale}
          reveal={one("reveal") !== "0"}
        />
      )}
    </>
  );
}
