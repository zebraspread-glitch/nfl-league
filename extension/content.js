// Lays the MGL banner over the Sleeper draft room.
//
// Sleeper sends `x-frame-options: SAMEORIGIN`, so the board can't be pulled
// into our page — the overlay has to go the other way, injected into theirs.
// The banner is a full-viewport transparent iframe that ignores the mouse, so
// the draft room underneath stays completely usable.

const OVERLAY_ORIGIN = "https://nfl-league-mgl.vercel.app";
const FRAME_ID = "mgl-draft-overlay";
const SCALE_KEY = "mgl-overlay-scale";
const DEFAULT_SCALE = 0.62;

function clampScale(value) {
  return Math.min(1, Math.max(0.2, Math.round(value * 100) / 100));
}

function readScale() {
  const saved = Number(localStorage.getItem(SCALE_KEY));
  return Number.isFinite(saved) && saved > 0 ? clampScale(saved) : DEFAULT_SCALE;
}

function overlayUrl() {
  return `${OVERLAY_ORIGIN}/draft/overlay?scale=${readScale()}`;
}

function mount() {
  if (document.getElementById(FRAME_ID)) return;

  const frame = document.createElement("iframe");
  frame.id = FRAME_ID;
  frame.src = overlayUrl();
  frame.allowTransparency = "true";
  Object.assign(frame.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    border: "0",
    background: "transparent",
    // Clicks, scrolls and drags all belong to the draft room.
    pointerEvents: "none",
    zIndex: "2147483647",
  });
  document.body.appendChild(frame);
}

function setScale(next) {
  localStorage.setItem(SCALE_KEY, String(clampScale(next)));
  const frame = document.getElementById(FRAME_ID);
  if (frame) frame.src = overlayUrl();
}

// Alt+O hides the banner (someone needs to read the row behind it), Alt+[ and
// Alt+] size it to the screen it ends up on — no reinstall to tune it.
document.addEventListener("keydown", (event) => {
  if (!event.altKey) return;
  const frame = document.getElementById(FRAME_ID);

  if (event.key === "o" || event.key === "O") {
    if (frame) frame.remove();
    else mount();
  } else if (event.key === "[") {
    setScale(readScale() - 0.04);
  } else if (event.key === "]") {
    setScale(readScale() + 0.04);
  }
});

mount();
// Sleeper is a single-page app: leaving and re-entering the draft room can tear
// the node out, so put it back if it goes missing.
setInterval(mount, 2000);
