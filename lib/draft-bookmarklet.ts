// The overlay, deliverable without an extension.
//
// Same behaviour as extension/content.js: a click-through iframe pinned over
// the draft room, with Alt+C handing it the mouse and keyboard. Written as a
// real function and collapsed to one line at the end, so it stays readable
// here rather than living as an unmaintainable blob.

const OVERLAY_ORIGIN = "https://nfl-league-mgl.vercel.app";

function overlay() {
  const O = "https://nfl-league-mgl.vercel.app";
  const ID = "mgl-draft-overlay";
  const KEY = "mgl-overlay-scale";
  const scale = () => {
    const v = Number(localStorage.getItem(KEY));
    return v > 0 ? Math.min(1, Math.max(0.2, v)) : 0.45;
  };
  const url = () => O + "/draft/overlay?manual=1&scale=" + scale();
  const el = () => document.getElementById(ID) as HTMLIFrameElement | null;
  const mount = () => {
    if (el()) return;
    const f = document.createElement("iframe");
    f.id = ID;
    f.src = url();
    f.style.cssText =
      "position:fixed;inset:0;width:100vw;height:100vh;border:0;background:transparent;pointer-events:none;z-index:2147483647";
    document.body.appendChild(f);
  };
  const live = () => {
    const f = el();
    return !!f && f.style.pointerEvents === "auto";
  };
  const setLive = (on: boolean) => {
    const f = el();
    if (!f) return;
    f.style.pointerEvents = on ? "auto" : "none";
    if (on) f.focus();
  };
  const setScale = (v: number) => {
    localStorage.setItem(KEY, String(Math.min(1, Math.max(0.2, Math.round(v * 100) / 100))));
    const f = el();
    if (f) f.src = url();
  };
  document.addEventListener("keydown", (e) => {
    if (!e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "c") {
      e.preventDefault();
      setLive(!live());
    } else if (k === "o") {
      const f = el();
      if (f) f.remove();
      else mount();
    } else if (e.key === "[") setScale(scale() - 0.04);
    else if (e.key === "]") setScale(scale() + 0.04);
    else if (e.key === "0") {
      localStorage.removeItem(KEY);
      const f = el();
      if (f) f.src = url();
    }
  });
  window.addEventListener("message", (e) => {
    if (e.origin !== O) return;
    const d = e.data;
    if (d && d.source === "mgl-overlay" && d.type === "release") setLive(false);
  });
  mount();
  setInterval(mount, 2000);
}

/** `javascript:` URL for the bookmarks bar. */
export const OVERLAY_BOOKMARKLET =
  "javascript:(" + overlay.toString().replace(/\s*\n\s*/g, " ") + ")()";

export { OVERLAY_ORIGIN };
