# MGL Draft Overlay

Lays the MGL broadcast banner over the Sleeper draft room at
`sleeper.com/draft/nfl/*`.

## Install (once, on the laptop driving the TV)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → pick this `extension` folder

Then open the draft room. The banner appears across the bottom and the board
underneath stays fully clickable.

## Running the draft

The banner is your own clock — it does not read Sleeper. It starts out
ignoring the mouse so the draft room works normally; **Alt+C** hands it the
mouse and keyboard, and **Alt+C** again gives them back to Sleeper.

| key | does |
|---|---|
| `Alt` + `C` | take / release the controls |
| `Alt` + `O` | hide / show the banner |
| `Alt` + `]` / `Alt` + `[` | bigger / smaller |

With the controls taken (Alt+C), every key from the TV clock works:

| key | does |
|---|---|
| `Space` / `Enter` | start clock → pick is in → next pick |
| `P` | pause / resume |
| `↑` | +30 seconds |
| `R` | reset clock |
| `←` / `Backspace` | back a step |
| `T` | trade panel |
| `Esc` | close trade panel / clear a trade alert |
| `H` | hide the control bar (keys still work) |

The size is remembered per browser, so set it once on the TV. The draft state
is remembered too, so a reload mid-draft picks up where it left off.

## Notes

The banner is served from `/draft/overlay?manual=1` on the MGL site. Drop the
`manual=1` and it follows the live Sleeper draft instead, running the clock and
the pick reveals off Sleeper's public API with nothing to operate — kept
working, in case it's ever wanted.

To point at a different deployment, change `OVERLAY_ORIGIN` at the top of
`content.js`.
