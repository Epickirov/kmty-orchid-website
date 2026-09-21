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
| `inventory.html` | Buyer-facing inventory inquiry page (`/inventory`). |
| `inventory-admin.html` | Staff page (`/inventory-admin`): stock, inquiries, access code. |
| `inventory-shared.js` | ISO-week maths, the four-language dictionary, API client. |
| `inventory-api.js` | The `/api/inv/*` handlers; imported by `site-worker.js`. |
| `build_deploy.py` | Assembles the `kmty-site` upload folder (see Deployment). |

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
94 MB images/ tree). `build_deploy.py` assembles exactly that folder, so the
choice does not have to be made by hand in a file picker:

```bash
python build_deploy.py                    # → dist/kmty-site  (~19 MB, 129 files)
npx wrangler pages deploy dist/kmty-site --project-name=kmty-site --branch=main
```

or drag `dist/kmty-site` into the dashboard (Direct Upload). Two files in the
repo root are named the same as files this project needs but belong to the
**order page**, and the script is what keeps them apart: the upload's
`_worker.js` must be `site-worker.js`, and `_redirects` must not be copied at
all — its /order, /admin and /stock rewrites point at files the marketing
project does not have. The script also repoints the og:image (absolute by
necessity, and pointed at githack on preview branches) to the live domain,
and copies only the images the page actually references.

Deploying needs a Cloudflare API token with **Pages: Edit** — set
`CLOUDFLARE_API_TOKEN` in the shell that runs wrangler. No token is kept in
the repo or in any agent container; create one, use it, delete it.
Step-by-step, including what to check before and after: **`docs/DEPLOY-WWW.md`**.

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

## Inventory inquiry (`/inventory`)

Buyers pick a month, see it broken into ISO weeks, and send a request that lands
in `office@kmtybio.com` — the same inbox as the catalog form. Staff confirm it
in `/inventory-admin`, and only then does stock move.

**The unit is a batch**, which is what a grower actually has: one variety, one
cup size, one quantity, ready across a window of weeks — "5,000 of TPL-411 in
2.5in, weeks 12–20". A buyer asking for week 15 draws on that batch, which is
why the customer page shows the whole window beside every week it appears in.
Quantity is the pool, not a per-week figure.

**Every batch carries two photographs and three measurements**, because that is
what a buyer judges a phalaenopsis on and no single picture or number carries
it. The *whole plant* shot (`invimg:<id>`) shows the habit — how it sits on a
bench, how the spike arches — and identifies the variety in a list. The *flower*
shot (`invimg2:<id>`) is a close-up or cut-out of one current bloom, for the
colour break and the lip. The measurements are `stem` (`SS` single / `DS` dual,
entered as SS/DS or 单梗/双梗), `ns` (natural spread, the width of one open
flower, cm) and `ht` (plant height, cm). `colour` and `pattern` are declared
rather than derived — the chart still tints itself from the photograph, which
is the true bloom, but a filter has to be right every time or a buyer silently
misses stock they would have bought. The staff page reads the uploaded cut-out
and suggests a colour; the grower confirms it. All five are optional: what the grower
has not measured is left out rather than shown as a dash, because a spec sheet
full of blanks says only that nobody measured. The specs sit on the batch, not
the variety, since the same variety is graded and sold several ways.

Weeks are ISO-8601 (week 1 contains 4 January, weeks start Monday), computed
independently in the browser and in the worker — the server never trusts a week
number that arrives from a client, and drops any line outside its batch's
window.

| | |
|---|---|
| `/inventory` | Buyers. Public landing page; the numbers need the access code. |
| `/inventory-admin` | Staff. Gated by `ADMIN_PASS`. |
| KV keys | `invcfg` (access code) · `inv:<id>` · `invimg:<id>` (plant) · `invimg2:<id>` (flower) · `inq:<ts>-<rand>` |
| Photo URLs | `/api/inv/img?id=<id>` is the plant; `&shot=flower` is the bloom |

**Two levels of access, both deliberately simple.** Staff send `x-admin-pass`;
buyers send `x-inv-code`, one shared code rotated from the admin page — buyers
should not have to register to ask what is in stock. Both are compared in
constant time. Photos are the one thing not gated: a browser cannot put a header
on an `<img src>`, and what the gate would protect is a picture behind a 48-bit
random id that maps to no code, quantity or week without the catalogue, which is
gated. The commercial information is the numbers, and the numbers stay behind the
code.

**Confirming is the only thing that moves stock**, and it is idempotent by
status — an inquiry already decided cannot be decided again, so a double-click
cannot deduct the same plants twice. Deduction floors at zero and records the
shortfall rather than going negative. Declining changes nothing.

**The buyer's view is a production calendar**, not a product grid: varieties down
the side, ISO weeks across, and a bar per batch spanning the weeks it is ready
in. That is the shape of the question a wholesale buyer actually asks — *when
can I get this* — and it answers it in one look rather than month → week → hunt.
A Gallery view sits beside it for browsing by colour, and a Cosy/Compact density
toggle serves both a buyer skimming photographs and one entering forty lines.
Search and cup-size filters narrow the rows; clicking any week on a bar opens a
quantity stepper.

**The chart is keyed to the crop.** Each variety's flower cut-out is sampled in
the browser and the dominant hue tints its availability bar and the stripe down
the sticky column. Nobody types a colour; it follows the photograph. Only the
cut-out is read — a plant shot's largest saturated region is the greenhouse
behind it — and the dominant 15° hue bucket wins, so a magenta bloom with a
yellow lip does not average to mud. A white phalaenopsis is not colourless in a
photograph (its shadows are warm and consistently hued), so a row is tinted only
when saturation clears both a mean of 0.40 and a 90th percentile of 0.62;
measured across this library, white tops out at 0.34 / 0.54 and the faintest
genuinely coloured bloom starts at 0.44 / 0.71. Rows that fail fall back to a
warm stone, never the house green — a green bar beside a magenta one reads as a
green flower. Every tint is normalised to one saturation and lightness, so hue
is the only free variable and the chart cannot become a brightness map.

**Colour tokens come in fills and inks.** `--gold` and `--rust` are brand fills
at roughly 2.4:1 and 4.3:1 on cream, which is fine behind a shape and not fine
under text. `--goldink` and `--rustink` are the same hues taken to ≥4.6:1 so the
variety code, links and warnings clear WCAG AA. A sweep over both pages in all
four languages at desktop and phone width reports no contrast failure and no
clipped label.

**It prints.** Buyers carry the availability chart into meetings, so `@media
print` drops the chrome and the photographs, unrolls the scroller, forces the
bloom colours through (`print-color-adjust: exact` — a chart whose only colour
channel the printer drops is just a grid) and sets A4 landscape.

**Quantities move in whole inner boxes, and the cup size decides how many.**
3.8in is 16 to a box, 3.5in is 20, 2.8in and 3.0in are 24 (`BOX_BY_CUP` in
`inventory-api.js`). A grower never types it for a flowering size; plugs and
young plants are packed to order, so those still take whatever is entered, and
an explicit figure always beats the table. The stepper moves a box at a time, a
typed number snaps to the nearest one and says so before you commit, and the
server enforces the same rule so a hand-made request cannot get around it.

**Every batch records what was published.** `qty0` is what the grower last
declared; confirming an inquiry lowers `qty` and never touches it, so the
calendar can show what share of the offer is still there. Saving the batch
again resets it, because a grower re-entering the figure is declaring a new
pool — which also stops a corrected typo leaving the bar at 60% for ever.

**Week numbers can be read as months.** ISO weeks are the trade's unit and the
axis the whole book is built on, but "week 37" means nothing until you know it
is the second week of September. A switch in the toolbar relabels every week on
the page — column heads, gallery chips, the order pad, the confirmation — as
`Sep W2`, or `Sep–Oct` for a week that straddles the turn of a month. The
underlying ISO week never changes; only the label does.

**One filter panel serves both views**, because both draw from the same
predicate: cup size, flower colour, marking, stem, and open-ended ranges for
flower width and plant height. Each option carries how many batches it would
leave if ticked, counted with that facet's own selection ignored — so the
number beside "Pink" means "how many if I tick this", not "how many are left
now that I have". A range excludes a batch the grower never measured rather
than treating it as zero.

**Buyers can track a request** with the reference and the email they sent it
from. The reference alone is short and dated, so it is guessable; the pair is
not, and it is exactly what the buyer has to hand.

Stock can be typed in one batch at a time or pasted/imported as CSV
(`code, nameEn, nameZh, cup, qty, from, to, year, note, box, stem, ns, ht,
colour, pattern`);
everything from `year` on may be left blank, and photos are uploaded per batch
rather than through the sheet. A row matching an
existing **code + cup + start week** updates it instead of duplicating, so a
corrected sheet can be re-imported. Export writes a BOM so Excel reads the
Chinese.

### Before it works on a fresh deploy

1. **`ADMIN_PASS` must be a secret on the `kmty-site` Pages project.** It
   currently exists on the *order page* project, which is a different project —
   without it `/inventory-admin` can never log in and every `/api/inv/admin/*`
   call returns 401.
2. **The `LEADS` KV binding must be present** (it already is — the inventory
   shares that namespace under its own key prefixes).
3. **Set the buyer access code** in `/inventory-admin → 访问码`. Until it is set,
   `/inventory` tells buyers it is not open yet. Clearing it closes the page to
   everyone.

`RESEND_API_KEY` is already configured for the catalog form and the inquiry mail
reuses it. If mail fails the inquiry is still stored — it is written to KV before
the send, so a mail outage loses nothing, and the response says `mailed: false`
with the reason.

## Deployment

- Everything is self-contained — **no external network calls at runtime** (this is what lets
  it load where Google Fonts / unpkg are blocked).
- Host on any static host — Cloudflare Pages / Netlify / Vercel (overseas audience), or
  Alibaba Cloud OSS / Tencent COS + CDN with an ICP 备案 filing for fast mainland-China access.
- For a clean root URL, rename `KMTY Orchid v5.dc.html` → `index.html`; relative asset paths
  are unaffected.
