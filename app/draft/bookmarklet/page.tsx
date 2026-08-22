import { BookmarkletLink } from "@/components/bookmarklet-link";
import { OVERLAY_BOOKMARKLET } from "@/lib/draft-bookmarklet";

export const metadata = {
  title: "Draft Overlay Bookmarklet - MGL Fantasy",
  robots: { index: false, follow: false },
};

/**
 * The no-extension way in. Chrome can refuse to load an unpacked extension for
 * reasons that have nothing to do with the code — policy, a locked-down
 * profile, developer mode unavailable — and draft day is no time to fight it.
 * A bookmarklet does the same job from the bookmarks bar.
 */
export default function DraftBookmarkletPage() {
  return (
    <div className="space-y-5 py-4">
      <div>
        <h1 className="font-cond text-2xl font-extrabold uppercase tracking-wide">Draft overlay</h1>
        <p className="mt-1 text-sm text-text-muted">
          No extension needed. Drag the button onto your bookmarks bar, open the Sleeper draft room,
          then click it.
        </p>
      </div>

      <div className="rounded-lg bg-section p-4">
        <BookmarkletLink href={OVERLAY_BOOKMARKLET}>MGL Draft Overlay</BookmarkletLink>
        <p className="mt-3 text-xs text-text-muted">Drag it — clicking it here does nothing.</p>
      </div>

      <div className="space-y-2 text-sm">
        <p className="font-cond text-base font-bold uppercase tracking-wide">Once it&apos;s on the board</p>
        <ul className="space-y-1 text-text-muted">
          <li>
            <b className="text-text">Alt + C</b> — take the controls / give them back to Sleeper
          </li>
          <li>
            <b className="text-text">Alt + O</b> — hide or show the banner
          </li>
          <li>
            <b className="text-text">Alt + ]</b> / <b className="text-text">Alt + [</b> — bigger / smaller
          </li>
          <li>
            With the controls: <b className="text-text">Space</b> next, <b className="text-text">P</b> pause,{" "}
            <b className="text-text">T</b> trades, <b className="text-text">R</b> reset,{" "}
            <b className="text-text">←</b> back
          </li>
        </ul>
      </div>

      <p className="text-xs text-text-muted">
        Click it again after a page reload — a bookmarklet doesn&apos;t stick the way an extension does.
      </p>
    </div>
  );
}
