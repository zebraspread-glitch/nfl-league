# MGL Draft Overlay

Lays the MGL broadcast banner over the Sleeper draft room at
`sleeper.com/draft/nfl/*`.

## Install (once, on the laptop driving the TV)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → pick this `extension` folder

Then open the draft room. The banner appears across the bottom; the board
underneath stays fully clickable.

## On the night

| key | does |
|---|---|
| `Alt` + `O` | hide / show the banner |
| `Alt` + `]` | bigger |
| `Alt` + `[` | smaller |

The size is remembered per browser, so set it once on the TV screen.

## What drives it

Nothing — it reads the live draft from Sleeper's public API (the same data the
room itself shows) and follows along: who is on the clock, the pick countdown,
and the selection reveal when a pick lands. There is no operator window and
nothing to press.

The banner itself is served from `/draft/overlay` on the MGL site. To point the
overlay at a different deployment or a local dev server, change
`OVERLAY_ORIGIN` at the top of `content.js`.
