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

## Main marketing site on Cloudflare Pages (project `kmty-site`)

The full site is deployed as Pages project **`kmty-site`** → `kmty-site.pages.dev`,
custom domain **www.kmtyorchid.com** (CNAME `www` → `kmty-site.pages.dev` in 凡科
DNS; apex/email stay at 凡科 — never touch MX). Upload folder = `index.html`
(renamed from `KMTY Orchid v5.dc.html`, og:image pointed at www.kmtyorchid.com)
+ `i18n.js` `support.js` `image-slot.js` `terroir-geo.json` `_headers` + `fonts/`
`vendor/` + only the ~76 images the page references (17 MB total, not the full
94 MB images/ tree). Deploys are Direct Upload (dashboard drag-and-drop) or:

```bash
npx wrangler pages deploy <folder> --project-name=kmty-site --branch=main
```

`site-worker.js` (deployed as `_worker.js` in the kmty-site folder) adds
POST `/api/lead` for the catalog-request form: honeypot + per-IP rate limit,
every lead stored in the shared KV namespace (`lead:<ts>` keys, binding
`LEADS`), then an email to office@kmtybio.com. The lead is written to KV
*before* the send, so a lead is never lost even if mail fails; the `/admin`
留言 tab lists every captured lead regardless.

Sender: **Resend HTTP API** is primary (secret `RESEND_API_KEY`, plus plain
`MAIL_FROM`/`MAIL_TO`), sending from `website@kmtyorchid.com`. Raw SMTP over
`cloudflare:sockets` to the company's Netease mailbox is kept in the file as a
dormant fallback but is OFF — Netease tarpits Cloudflare's shared egress IPs
(greets, then goes silent at AUTH), which is structural and unfixable from a
Worker. A controlled test confirmed Gmail SMTP answers those same IPs in ~34ms
while Netease stalls, so this is IP-reputation blocking, not a config bug.
The dormant SMTP path only runs if `RESEND_API_KEY` is unset *and*
`SMTP_ENABLED=1`; otherwise the page falls back to a prefilled mailto and the
KV ledger still captures the lead. Resend requires the sending domain to be
verified (DKIM `resend._domainkey`, SPF `send` TXT, MX `send` — all added at
the domain's DNS).

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
admin.html           ← KMTY control panel: colours · resellers · orders → /admin
reseller.html        ← reseller portal (each reseller sees only their orders) → /reseller
stock.html           ← per-batch link generator → /stock
_worker.js           ← Pages "advanced mode" Worker: all /api/* + clean URLs
bloom-fallback.png   ← full-quality bloom for old iOS (the inlined bloom is WebP)
```

### White-label resellers & order capture

The same KV namespace + `ADMIN_PASS` (no new bindings) also power a multi-tenant
layer:

- **`/admin` → 经销商 (Resellers):** KMTY adds each wholesale customer (name,
  company, logo upload, a login password). Each gets a branded link
  **`/r/<id>`** — opened by *their* customers it shows *their* name + logo (page
  **and** saved card), while orders still flow to KMTY. Data: `rs:<id>` in KV.
- **Order capture:** the order page POSTs each order to `/api/order`
  (`ord:<reseller>:<ts>` in KV) — customer, phone, qty, date, recipe, reseller.
  The WeChat card flow is unchanged; this just records it too.
- **`/admin` → 订单 (Orders):** KMTY sees every order, filterable by reseller.
- **`/reseller`:** a reseller logs in with their id + password and sees **only
  their own** customers/orders. Isolation is enforced server-side in `_worker.js`
  (per-reseller KV prefix + SHA-256 password check). They can change their own
  password (`/api/reseller-password`), so KMTY can't sign in as them.
- **First-touch referral + commissions.** Each customer (by phone) is recorded
  in `ref:<phone>` the first time they order through a reseller link; that
  reseller keeps commission credit for that customer **forever** — later direct
  orders included. Orders are keyed by the *credited* reseller. Each reseller
  has a **commission %** and a **reference price/plant**; commission =
  qty × price × rate%. `/admin → 佣金` shows a per-reseller payout tally plus a
  phone-grouped **customer database**; `/reseller` shows the same for that one
  reseller. Rates/prices are internal — never sent to the public order page.
- **Shareable links** (`/r/<id>`, portal) are pinned to `SHARE_ORIGIN`
  (the WeChat-safe custom domain) in `admin.html`/`reseller.html`, so they never
  come out as `*.pages.dev` regardless of which host the panel is opened on.

The bloom is inlined as **WebP** (small + smooth); browsers without WebP support
(iOS < 14) hit `bloom.onerror` and load `/bloom-fallback.png` instead, so every
device renders a clean flower.

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
