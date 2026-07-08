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

- **Colour & stock control (persistent) → `/admin`.** On Cloudflare (see below)
  the `/admin` page is the live control panel: enter the admin password, then
  toggle colours in/out of stock, rename/recolour them, or add new ones — hit
  **保存并发布** and it saves to Cloudflare KV, live for **every** customer on the
  bare `/order` link within seconds. No code edit, no redeploy.
- The `PALETTE` block baked into `constellation.html` is the **offline fallback**:
  if `/api/config` is ever unreachable, the page shows this list so it never
  breaks. Keep it roughly in sync as a safety net; the live source of truth is KV.
- **One-off per-link overrides still work** on top of the live config: the
  `/stock` page generates `?oos=…&add=…` links, or append `?oos=4,7` by hand to
  grey colours for a single shared link.
- Fill in `WECHAT_ID` (and optionally `ORDER_NOTE`) at the top of the file to
  show your sales WeChat and terms in the order overlay.
- Fill in `WECHAT_ID` (and optionally `ORDER_NOTE`) at the top of the file to
  show your sales WeChat and terms in the order overlay.
- Customers long-press the generated card to save it (WeChat blocks downloads)
  and send it to you on WeChat; the "复制订单文字" button copies an order
  summary with a `#m=…` link that reopens their exact pour, seed and all.
- The page reuses the site's images but shares no code with the site — editing
  it cannot affect the main website.

## Deploy on Cloudflare Workers (persistent colour/stock settings)

Cloudflare now offers **Workers** (not classic Pages) for new projects. This
repo is set up for the Workers **Static Assets** model: `worker.js` serves the
whole static site, rewrites the clean URLs, and backs `/api/config` with
Cloudflare **KV** — so `/admin` edits stick for every customer. Config:
`worker.js` + `wrangler.jsonc` (`main` = worker, `assets` = repo root).

**Phase 1 — get it live (no persistence yet):**

1. **dash.cloudflare.com** → *Workers & Pages* → **Create** → **Workers** →
   **Import a repository** → pick `Epickirov/kmty-orchid-website`.
2. Project name **`kmty-orchid`** (must match `name` in `wrangler.jsonc`).
   Deploy command: **`npx wrangler deploy`**. Build command: empty. Deploy.
   The build reads `wrangler.jsonc`, bundles `worker.js`, and uploads the site.

At this point the site + order page work; `/admin` loads but **saving** returns
"storage not bound" until KV is added.

**Phase 2 — switch on persistence:**

3. Create the store: *Storage & Databases* → **KV** → **Create** a namespace
   (e.g. `kmty-config`). Copy its **Namespace ID**.
4. Put that ID in `wrangler.jsonc` — uncomment the `kv_namespaces` block and
   paste the ID for binding **`KMTY_CONFIG`** — then commit/push (redeploys).
5. Set the admin password: your Worker → *Settings → Variables and Secrets* →
   **Add** → **`ADMIN_PASS`** = a password you choose → type **Secret**. (Secrets
   survive redeploys; the KV binding must live in `wrangler.jsonc`.)
6. Push once more (or **Retry**) so the binding + secret are live.

Resulting URLs (`<name>.<account>.workers.dev`, or add a custom domain):

| Page | URL |
|------|-----|
| Full marketing site | `https://kmty-orchid.<account>.workers.dev/` |
| Order page (share on WeChat) | `…/order` |
| Staff control panel (private) | `…/admin` |

Notes: the order page reads `/api/config` on load and falls back to the baked
`PALETTE` if that request is ever blocked, so it never breaks. Cloudflare's
network is weaker inside mainland China, but the order customers are overseas,
so this is fine for the order tool.

## Deploy on Netlify (alternative — static only, no persistent settings)

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
