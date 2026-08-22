// Lays the MGL banner over the Sleeper draft room.
//
// Sleeper sends `x-frame-options: SAMEORIGIN`, so the board can't be pulled
// into our page — the overlay has to go the other way, injected into theirs.
//
// The banner is the operator's own clock, run by hand. It normally ignores the
// mouse so the draft room underneath stays usable; Alt+C hands it the mouse and
// keyboard to work the controls, and Alt+C again gives them back.

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
  return `${OVERLAY_ORIGIN}/draft/overlay?manual=1&scale=${readScale()}`;
}

function frameEl() {
  return document.getElementById(FRAME_ID);
}

function mount() {
  if (frameEl()) return;

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
    // Clicks, scrolls and drags belong to the draft room until Alt+C.
    pointerEvents: "none",
    zIndex: "2147483647",
  });
  document.body.appendChild(frame);
}

/** True while the overlay holds the mouse and keyboard. */
function isLive() {
  const frame = frameEl();
  return !!frame && frame.style.pointerEvents === "auto";
}

function setLive(live) {
  const frame = frameEl();
  if (!frame) return;
  frame.style.pointerEvents = live ? "auto" : "none";
  if (live) frame.focus();
  else document.body.focus();
}

function setScale(next) {
  localStorage.setItem(SCALE_KEY, String(clampScale(next)));
  const frame = frameEl();
  if (frame) frame.src = overlayUrl();
}

document.addEventListener("keydown", (event) => {
  if (!event.altKey) return;

  if (event.key === "c" || event.key === "C") {
    // Taking the controls also takes the keyboard, so from here on the keys are
    // handled inside the frame — including the Alt+C that hands them back.
    event.preventDefault();
    setLive(!isLive());
  } else if (event.key === "o" || event.key === "O") {
    const frame = frameEl();
    if (frame) frame.remove();
    else mount();
  } else if (event.key === "[") {
    setScale(readScale() - 0.04);
  } else if (event.key === "]") {
    setScale(readScale() + 0.04);
  }
});

// The frame has the keyboard while it is live, so its own Alt+C arrives here.
window.addEventListener("message", (event) => {
  if (event.origin !== OVERLAY_ORIGIN) return;
  if (event.data && event.data.source === "mgl-overlay" && event.data.type === "release") {
    setLive(false);
  }
});

mount();
// Sleeper is a single-page app: leaving and re-entering the draft room can tear
// the node out, so put it back if it goes missing.
setInterval(mount, 2000);
