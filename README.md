# KMTY Orchid — Website

Marketing site for **Kunming Tong Yi Biotechnology · 昆明统一生物科技有限公司** — China's
largest exporter of flowering *Phalaenopsis* orchids, grown in the Yunnan highlands.

A single-page, four-language site (**English · 中文 · Русский · Tiếng Việt**) built on the
Claude Design `.dc.html` runtime, tuned to load with **zero external dependencies** so it
works reliably in mainland China.

## Files

| Path | What it is |
|------|-----------|
| `KMTY Orchid v5.dc.html` | The site (current version). |
| `support.js` | Render-once React runtime. React/ReactDOM are loaded locally from `vendor/`. |
| `i18n.js` | Translations, the Yunnan map (labels, pins, base cards, leader tendrils), the deterministic "heal" reveal sweep, and the fabric-texture lab. |
| `image-slot.js` | Design-app image-slot custom element. |
| `fonts/` | Self-hosted webfonts (`fonts.css` + `files/*.woff2`). No Google Fonts. |
| `vendor/` | Self-hosted React / ReactDOM / Babel. No unpkg / jsDelivr at runtime. |
| `images/` | All site imagery and video. |
| `terroir-geo.json` | Yunnan map geometry + production-base pin coordinates. |
| `build_fonts.py` | Regenerates the self-hosted font subset (see below). |

## Live preview

**Preferred (GitHub Pages)** — no rate limits, real CDN, auto-updates on every
push to `main`. Enable once under *Settings → Pages → Deploy from a branch →
`main` / `(root)`*, then the site lives at:

```
https://epickirov.github.io/kmty-orchid-website/
```

(`index.html` redirects to the main page, so the bare URL works.)

**Fallback (githack)** — same idea, but githack's branch endpoint throttles
multi-asset bursts, so images can drop under load; the page retries failed
images automatically, but Pages is the reliable home:

```
https://raw.githack.com/Epickirov/kmty-orchid-website/main/KMTY%20Orchid%20v5.dc.html
```

Do not swap in `rawcdn.githack.com` for a branch link — the production CDN
caches branch refs permanently and would freeze on an old version. Use
`rawcdn.githack.com/<user>/<repo>/<commit-sha>/…` only for immutable snapshots.

## Standalone: Constellation order page (WeChat)

`constellation.html` is a self-contained, WeChat-optimised order page for the
mix-your-own Constellation configurator — share this URL directly with customers:

```
https://raw.githack.com/Epickirov/kmty-orchid-website/main/constellation.html
```

(or `https://epickirov.github.io/kmty-orchid-website/constellation.html` once Pages is on.)

- **Colours** are managed in the `PALETTE` block at the top of the file: add a
  line to add a colour; set its last value to `false` to grey it out as 缺货
  (out of stock). Never delete or reorder lines — append new colours at the end,
  or old order links will point at the wrong colours.
- **Staff stock control (no code)** — the `/stock` page lets staff tap colours
  out of stock and **add brand-new colours** (name + swatch); it generates the
  order link with those changes baked in (`?oos=…&add=…`) to share on WeChat.
  Added colours ride on that link only; to make one **permanent** (on every
  link, including the bare `/order`), append it to the `PALETTE` block.
- **Quick stock override without editing**: append `?oos=4,7` to the shared link
  (0-based colour numbers) to grey extra colours for that link only.
- Fill in `WECHAT_ID` (and optionally `ORDER_NOTE`) at the top of the file to
  show your sales WeChat and terms in the order overlay.
- Customers long-press the generated card to save it (WeChat blocks downloads)
  and send it to you on WeChat; the "复制订单文字" button copies an order
  summary with a `#m=…` link that reopens their exact pour, seed and all.
- The page reuses the site's images but shares no code with the site — editing
  it cannot affect the main website.

## Deploy on Netlify (recommended — free, no throttling, auto-updates)

The repo is Netlify-ready (`netlify.toml`): static, no build step, published
from the root. Connect it once and every push to `main` redeploys.

1. Sign in at **app.netlify.com** (the *Log in with GitHub* button is easiest).
2. **Add new site → Import an existing project → GitHub**, authorise, and pick
   `Epickirov/kmty-orchid-website`.
3. Branch **`main`**; leave the build command **empty**; publish directory **`.`**
   (Netlify reads these from `netlify.toml` — just click **Deploy**).
4. **Site configuration → Change site name** → e.g. `kmty`, giving `kmty.netlify.app`.

Resulting URLs:

| Page | URL |
|------|-----|
| Full marketing site | `https://kmty.netlify.app/` |
| Constellation order page (share on WeChat) | `https://kmty.netlify.app/order` |

`/order` and `/constellation` both serve `constellation.html` (clean, no
`.html` suffix). HTML is served `must-revalidate`, so edits appear immediately —
no hard-refresh dance. A custom domain can be added later under *Domain
management*.

## Local preview

Any static file server works:

```bash
python -m http.server 8735
# then open http://127.0.0.1:8735/KMTY%20Orchid%20v5.dc.html
```

## Fonts (important)

Latin / Cyrillic / Vietnamese are mirrored faithfully; **Simplified Chinese is subset to
exactly the glyphs the site uses**, so the CJK fonts stay small and fast. After editing any
Chinese copy:

```bash
python build_fonts.py
```

then bump the `fonts/fonts.css?v=N` and `i18n.js?v=N` cache markers in the HTML so browsers
pick up the changes.

## Deployment

- Everything is self-contained — **no external network calls at runtime** (this is what lets
  it load where Google Fonts / unpkg are blocked).
- Host on any static host — Cloudflare Pages / Netlify / Vercel (overseas audience), or
  Alibaba Cloud OSS / Tencent COS + CDN with an ICP 备案 filing for fast mainland-China access.
- For a clean root URL, rename `KMTY Orchid v5.dc.html` → `index.html`; relative asset paths
  are unaffected.
