# KMTY Orchid — project handoff

## 0. Read this first

The zip you have is **only the deployed marketing site** (`index.html`, `i18n.js`,
`support.js`, images, fonts, `_worker.js`). It contains **none** of the SaaS
platform, the migration script, or the deploy kit — which is what the server
move actually needs.

**First command in the new session:**

```bash
git clone https://github.com/Epickirov/kmty-orchid-website
cd kmty-orchid-website
git checkout claude/githack-preview-link-9nykre
```

Everything below assumes that repo. Latest commit at handoff: `0c62366`.
The work is on the branch above, **not** on `main`.

---

## 1. The business and the two systems

KMTY (昆明同一生物科技 / Kunming Tong Yi) is a Yunnan Phalaenopsis orchid grower
and exporter. Public contact `office@kmtybio.com`. Cloudflare account is
`Kmtybio@gmail.com`.

There are two separate systems:

**A — The live marketing + order system (Cloudflare, in production today)**
- `www.kmtyorchid.com` + apex — the marketing site. Single-page, 4 languages
  (en/zh/ru/vi) via `i18n.js`. Cloudflare Pages project **`kmty-site`**.
- `order.kmtyorchid.com` — the "Constellation" custom-dyed orchid order page,
  plus `/admin`, `/reseller`, `/stock`. Cloudflare Pages project
  **`constellation`**. Data lives in Cloudflare **KV** (`KMTY_CONFIG`).

**B — The new SaaS platform (`saas/` in the repo, never deployed anywhere)**
A multi-tenant marketplace ("KMTY 星商") where orchid sellers get their own
storefront. Built but **only ever run inside a dev container**. This is what
moves to Aliyun.

---

## 2. Current live state (verified at handoff)

| Domain | Cloudflare project | Notes |
|---|---|---|
| www.kmtyorchid.com + apex | `kmty-site` | **No Git connection** — deploys are manual folder uploads only |
| order.kmtyorchid.com | `constellation` | Also manual upload. KV-backed |
| kmty-orchid.kmtybio.workers.dev | `kmty-orchid` | Workers project, Git-connected, **build currently failing**. NOT customer-facing — ignore or delete |

`kmty-financial-forecaster` and `global-ledger` are unrelated projects.

**Critical:** pushing to GitHub does **not** deploy www or order. Both are
manual uploads via dash.cloudflare.com → Workers & Pages → project →
Create deployment → drag folder → Production. This surprised us once already.

DNS is at **凡科 (fkw.com)**, not Cloudflare.

---

## 3. THE JOB: move `order.kmtyorchid.com` to Aliyun

**The ICP filing just passed** — this was the blocker for everything.

The authoritative runbook is **`saas/deploy/CUTOVER.md`** in the repo. Read it.
Summary:

**Prep (safe any time):**
1. Buy an Aliyun ECS: 2 vCPU / 2–4GB, Ubuntu 22.04, any mainland region,
   public IP, security group open on **80, 443, 22**.
2. `rsync` the repo to `/opt/kmty/` on the box.
3. `bash /opt/kmty/saas/deploy/bootstrap.sh part1` — installs Node from
   npmmirror to `/opt/node22`, the systemd service, nginx (HTTP only),
   acme.sh from gitee. Sets `ADMIN_PASS`.
4. **Seed and smoke-test over the raw IP before touching DNS.** The platform
   has never run outside a dev container. Do not let the first real request
   be a seller's.
5. While waiting: activate Aliyun **内容安全** (image moderation — the hook
   is stubbed at `saas/lib/notify.js` → `scanImageHook`), and set up
   **DirectMail** for `mail.kmtyorchid.com`.

**Cutover day:**
6. Export Cloudflare KV (`KMTY_CONFIG` namespace on the `constellation`
   project) into `{entries:[{key,value}]}` shape. Needs a Cloudflare API
   token scoped **KV: Read**.
7. `node saas/migrate.js dump.json --dry` → review counts → run without
   `--dry` → `systemctl restart kmty`.
8. **DNS at 凡科:** change the `order` record from CNAME →
   `constellation-aso.pages.dev` to an **A record → ECS IP**.
9. `bash saas/deploy/bootstrap.sh part2` for TLS once DNS resolves.
10. Set the 备案号 in the footer (command printed by part2).
11. Verify: old `/r/<reseller-id>` links, a login with a migrated password,
    a test order end-to-end, the WeCom ping.
12. **File 公安备案 at beian.gov.cn within 30 days.**

**Rollback at any point:** revert that one DNS record at 凡科. Cloudflare stays
deployed and untouched; the migration only ever *reads* KV.

---

## 4. ⚠ Hard rules — do not violate

- **At 凡科, only ever touch the `order` record.** Never modify or delete the
  `@` **MX rows** — company email runs on them.
- **Never upload the marketing-site folder to the `constellation` project**
  (or vice versa). That would replace the order page with the marketing site
  and take ordering down. Identify projects by their **custom domain**, not
  their name.
- **Do not merge this branch to `main` without reverting `netlify.toml`.** It
  carries a branch override (`publish = "netlify-demo"`) that must become
  `"."` on main. There is a comment in the file saying so.
- Secrets are **never** committed. Cloudflare project secrets (Resend API key,
  `ADMIN_PASS`) live in the dashboard and persist across deployments.

---

## 5. The SaaS platform — architecture

- **`saas/server.js`** — single Node process, **zero npm dependencies**.
  Requires **Node ≥ 22.5** for built-in `node:sqlite`.
- **`saas/lib/`** — `db.js` (schema + additive migrations), `core.js` (auth,
  sessions, rate limits, audit), `api.js` (all endpoints), `media.js`
  (magic-byte sniffing, 3MB cap, 500MB/tenant), `notify.js` (WeCom webhook,
  content-scan stub).
- **`saas/web/`** — `seller/` (dashboard), `shop/` (storefront), `market/`
  (marketplace), `admin/`, `assets/` (shared UI + dependency-free QR encoder).
- Storage: SQLite (WAL) at `$DATA_DIR/app.db`, media on local disk, nightly
  `VACUUM INTO` backups.
- Auth: scrypt (`s2:`), legacy sha256 (`s1:`) auto-upgrades on first login.
  30-day sliding httpOnly session cookie.
- **Moderation is takedown-based, not approval-based** — a deliberate owner
  decision. Sellers publish instantly; admin gets a feed with one-tap takedown.

**Run locally:**
```bash
cd saas
DATA_DIR=data node --no-warnings seed.js --demo   # demo shops + products
DATA_DIR=data PORT=8080 ADMIN_PASS=x node --no-warnings server.js
```
Demo seller logins: `lanyuan` / `yunling` / `dounan`, password `demo888`.
Routes: `/seller`, `/market`, `/s/<slug>`, `/admin`, `/` (constellation page).

**Tests (all should pass):**
```bash
node saas/test-qr.js          # QR encoder golden vectors
node saas/test-e2e.js         # 33 checks, needs Playwright
node saas/test-e2e-growth.js  # 23 checks, needs Playwright
```
The Playwright `require()` path in the e2e files is absolute for the container
they were written in — change it to `'playwright'` for a local npm install.

---

## 6. `migrate.js` — read this before running it

Three data-loss bugs were found and fixed **just before handoff** by testing
against a synthetic dump shaped like the real KV export:

1. `--dry` reported `orders: 0` regardless of reality (dry runs write no
   tenants, so every order's tenant lookup missed).
2. Orders with `reseller: "_"` — **KMTY's own direct orders, likely the
   majority** — were silently dropped when the `kmty` house tenant didn't
   exist. It is now created on demand.
3. Orders and leads have no id of their own, so re-running duplicated
   everything. Ids are now derived from the stable KV key.

Verified: dry run matches the real import exactly; a second run adds nothing;
base64 logos migrate into media files; commission rates and original order
codes survive; **migrated resellers log in with their existing passwords**
(wrong passwords still rejected).

The live worker stores reseller passwords as `passHash` = sha256(password) —
that is the field `migrate.js` reads. Confirm the real export uses it.

---

## 7. Secrets and credentials status

- **No Cloudflare API token exists in any session.** One was pasted in chat
  earlier and used with `wrangler pages deploy`; it was never written to disk
  and is gone. Create a fresh one when needed (Pages: Edit to deploy, KV: Read
  to export), set a short TTL, and delete it after the Aliyun cutover.
- Cloudflare account: **Kmtybio@gmail.com**. Account ID begins
  `957f0193c7de3a589a39ccb2a7ca…`.
- Resend API key and `ADMIN_PASS` are Cloudflare **project secrets** — they
  survive deployments, don't re-enter them.
- **Revoke the old Netease SMTP 授权码** — unused since the Resend switch.

---

## 8. Recent work (for context on what changed lately)

- Hero on www is now a **30-second bloom film** (`images/hero-bloom.mp4`,
  1.2MB / `-m.mp4` 603KB mobile) layered over the still photo so the JPG stays
  the LCP paint. Gated on `prefers-reduced-motion`, `Save-Data` and 2g.
  Plays once, holds on the bloomed frame. `muted` must be set as a **property**
  — the attribute alone left autoplay blocked and the video invisible.
- The "how we grow" opening orchid is now **red** (`images/web/bloom-red.webp`,
  80 frames, alpha). `bloom-alpha.webp` is the original pink one — swap the
  `src` back to revert.
- **Strict language separation** — no page mixes English and Chinese. Keep-list:
  brand marks, the registered English company name, the language switcher's own
  label, PCR/ELISA/ISO, units, domains, emails.
- After editing `i18n.js`, **bump the `i18n.js?v=N` marker** in the HTML.
  Currently `v=30`.
- Seller growth kit shipped: bulk CSV import (handles GBK, Excel paste),
  branded price-sheet and shop-poster PNG generators with QR codes.

---

## 9. Known outstanding items

- `order.kmtyorchid.com` still serves the **old** build — the reseller-portal
  language cleanup is committed but never uploaded. Cosmetic; can wait.
- `images/greenhouse.mp4` is **19.8MB and referenced by nothing** — the largest
  file in the repo, safe to delete.
- The `kmty-orchid` Workers project's build fails on every push. Not
  customer-facing. Either fix it, disconnect the Git integration, or delete it.
- `netlify.toml` branch override (see §4).
- Phase 3 of the platform (consignment centre, commission ledger) is designed
  in `docs/saas-platform-plan.md` but not built.

---

## 10. Useful docs in the repo

- `saas/deploy/CUTOVER.md` — the migration runbook (authoritative)
- `docs/saas-platform-plan.md` — full platform plan and decision log
- `docs/reseller-marketplace-spec.md` — marketplace spec, loopholes, features
- `CLAUDE.md` — project conventions, incl. screenshot-hygiene rules
- `saas/README.md` — platform notes
