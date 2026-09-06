# 星空艺术兰 · exhibition kiosk

Two screens off one shared mix: a **display** for the 98" TV (bloom + colour
panel, nothing else) and a **control** page visitors drive from a phone.

Both draw with the *same* engine, lifted verbatim out of `constellation.html`
by `build-engine.js`. The bloom is deterministic from `{seed, colours,
weights}`, so the two screens never need to share pixels — only that tiny
state. Verified: identical state produces byte-identical canvases on both.

```
kiosk/
  tv.html          display  → /tv
  control.html     phone    → /c   (the TV shows a QR of this URL)
  engine.js        GENERATED — rebuild with `node kiosk/build-engine.js`
  qr.js            dependency-free QR encoder (shared with the seller tools)
  server.js        sync server, zero dependencies
  build-plant.py   builds the whole-plant assets → ../plants/
```

Two things live at the repo root because the order page uses them too, and the
kiosk server serves both from there: **`plant.js`** (the whole-plant compositor,
canvas 2D — see the 整株 section of the main README) and **`plants/`** (the
plant cut-out, its petal mask and luminance layer, and the environment plates).
Rebuild them with `python3 kiosk/build-plant.py`.

## Run it

```bash
node kiosk/server.js          # prints every LAN address it's reachable on
```

Open `http://<lan-ip>:8080/tv` on the device feeding the TV, and visitors hit
`http://<lan-ip>:8080/c` — or just scan the QR already on screen.

## ⚠ Where does the server actually run?

This is the one thing to settle before the show. The two screens show
*different* views, so they can't be the same screen mirrored — they need a
sync point both can reach. Options, best first:

**1. A laptop at the booth (recommended).** Joins your hotspot, runs
`node kiosk/server.js`. The casting phone and every visitor phone talk to it
over the local network. Instant, and **works with no internet at all** — which
matters, because exhibition halls are where mobile signal goes to die. If you
can bring any laptop, bring one.

**2. No laptop.** Then the sync has to live on the internet and every phone
reaches it through the hotspot's cellular data. That works, but a signal drop
takes the centrepiece down mid-conversation. I can build a Cloudflare Durable
Object version of `server.js` (needs the $5/mo Workers Paid plan) — ask, and
allow a day to test it.

**3. Fallback with no server at all.** `tv.html` still renders a fixed mix
from a URL hash — `/tv#m=20260101.0-40.3-25.7-35` — so the screen shows a
beautiful bloom and the QR, just not live control. Worth knowing as a
break-glass option.

## Booth checklist

- **Rotate the casting phone to landscape and lock rotation.** Mirroring a
  portrait phone to a landscape TV pillarboxes the picture and wastes most of
  the panel. The display page shows a reminder if it detects a portrait phone.
- **Screen sleep.** `tv.html` takes a Wake Lock and re-takes it whenever the
  tab comes back to the foreground, but also set the phone's auto-lock to
  Never and keep the browser in front. A sleeping phone is a black 98" TV.
- **Cast quality.** Phone mirroring is 1080p, so the page is designed for
  1920×1080 rather than 4K. Don't expect 4K sharpness — the artwork is soft
  and organic, which hides it.
- **Test the whole chain before doors open**: hotspot up → laptop on it →
  TV page cast → scan the QR from a *visitor's* phone, not yours.
- If the display loses the server it says so on screen (大屏未连接) rather than
  silently freezing on a stale bloom.

## Behaviour worth knowing

- **Attract mode.** After 45s untouched the display re-swirls itself every 20s
  and publishes that state, so an unattended stand keeps moving and a phone
  picked up mid-show adopts what's on screen instead of resetting it.
- **Last writer wins.** Several visitors can hold the control page at once;
  there's no locking. At a busy stand that reads as collaborative rather than
  broken, but it does mean two people fighting over the palette will see it.
- **Keepsake card.** 保存图片 renders a 900×1300 card — bloom, colour names and
  percentages, mix number, brand and URL — shown full-screen to long-press and
  save. That's the takeaway that carries kmtyorchid.com home.
- **Mix numbers and hashes match the real product.** The `#m=` format is
  identical to the live configurator, so a mix made at the show reopens there.

## Changing the palette

Colours come from `PALETTE` in `constellation.html`. Edit there, then
`node kiosk/build-engine.js`. Never hand-edit `engine.js` — it is generated,
and hand edits are how the display and the product drift apart.
