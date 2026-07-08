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

## Deploy the order page on Cloudflare Pages (Direct Upload — works in China)

This is the path that's actually in production. **Direct Upload** (dashboard
drag-and-drop) — no Git, no build, no API tokens — onto a `*.pages.dev` project,
which is reachable inside mainland China (and inside WeChat's browser). Git-built
Pages/Workers were repeatedly blocked by token/permission issues; workers.dev is
GFW-blocked in China. Direct Upload sidesteps all of it.

**What to upload:** a folder containing the order page as `index.html` (so the
bare project URL *is* the order page), plus the staff pages and the backend:

```
index.html          ← copy of constellation.html (served at /)
constellation.html   ← same file again (admin/stock read its PALETTE)
admin.html           ← password control panel  → /admin
stock.html           ← per-batch link generator → /stock
_worker.js           ← Pages "advanced mode" Worker: /api/config + clean URLs
```

**Phase 1 — get it live (no persistence yet):**

1. **dash.cloudflare.com** → *Workers & Pages* → **Create** → **Pages** tab →
   **Upload assets** (Direct Upload — NOT "Connect to Git"). If it routes you to
   "Create a Worker", use the small **"Looking to deploy Pages? Get started"**
   link at the bottom.
2. Name the project (e.g. `constellation`), **drag the folder in**, **Deploy**.
   You get `https://<project>.pages.dev`. That bare URL is the order page.

At this point the order page + `/stock` (link generator, no backend) work fully.
`/admin` loads but **saving** returns "storage not bound" until KV is added.

**Why `_worker.js` and not `functions/`:** dashboard Direct Upload does **not**
compile a `functions/` directory — only Git builds / `wrangler pages deploy` do.
It **does** run a root `_worker.js` (Pages "advanced mode"). So the same
`/api/config` logic lives in `_worker.js`; it intercepts only `/api/config` and
the `/order` `/admin` `/stock` aliases and passes everything else (including `/`)
straight to `env.ASSETS`, so the live order page can't be affected.
(`functions/api/config.js` is kept as the equivalent for a Git-built deploy; when
both exist, `_worker.js` wins.)

**Phase 2 — switch on persistence (all in the dashboard, do in this order):**

3. *Storage & Databases* → **KV** → **Create a namespace** (e.g. `kmty-config`).
4. Project → *Settings → Bindings* → **Add → KV namespace**: variable
   **`KMTY_CONFIG`** → the `kmty-config` namespace → Save.
5. Project → *Settings → Variables and Secrets* → **Add** → **`ADMIN_PASS`** =
   a password you choose → type **Secret**.
6. **Redeploy** (Create deployment → drag the folder again, or Deployments → ⋯ →
   Retry) so the binding + secret attach to a live deployment.

Resulting URLs (`<project>.pages.dev`, or CNAME a subdomain like
`order.kmtyorchid.com` to it under *Custom domains*):

| Page | URL |
|------|-----|
| Order page (share on WeChat) | `https://<project>.pages.dev/` |
| Staff control panel (password) | `…/admin` |
| Staff per-batch link generator | `…/stock` |

Notes: the order page reads `/api/config` on load and falls back to the baked
`PALETTE` if that request is ever unreachable, so it never breaks. To change the
baked fallback (or before KV is on), edit the `PALETTE` block and re-upload the
folder.

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
