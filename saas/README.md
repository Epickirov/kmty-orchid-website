# KMTY 星商 — Orchid Storefronts (SaaS)

The multi-tenant seller platform for `order.kmtyorchid.com`. One Node process,
**zero npm dependencies** (Node ≥ 22.5 — uses built-in `node:sqlite`), state is
one SQLite file + a media directory. Designed for a single mainland-China ECS:
copy files, run `node`, done — no npm install, no build step, no external
services at runtime.

```
saas/
  server.js        HTTP entry: API + media + UIs + legacy order pages
  lib/db.js        SQLite schema (WAL)          lib/core.js  auth/sessions/rate/audit
  lib/api.js       every endpoint               lib/media.js uploads on local disk
  web/assets/      shared design system (ui.css / ui.js)
  web/seller/      卖家中心 seller dashboard     (/seller)
  web/shop/        buyer storefront             (/s/<slug>, <slug>.kmtyorchid.com)
  web/admin/       平台控制台 operator console   (/admin)
  seed.js          bootstrap (kmty tenant #0; --demo adds a demo seller)
  migrate.js       one-time Cloudflare-KV → SQLite import
  data/            runtime state (gitignored): app.db, media/, backups/
```

## Run locally

```bash
ADMIN_PASS=devpass node saas/server.js          # http://localhost:8787
node saas/seed.js --demo                         # demo seller: lanyuan / demo888
```

- `/seller` seller dashboard · `/admin` operator console · `/s/lanyuan` storefront
- `/` and `/r/<slug>` serve the legacy constellation page from the repo root;
  its `/api/reseller`, `/api/config`, `/api/order`, `/api/lead` calls are handled
  by this server (compat layer), so the whole Cloudflare worker is replaced.

Env: `PORT` (8787) · `DATA_DIR` (saas/data) · `ADMIN_PASS` (required for /admin)
· `BASE_URL` (link rendering, default https://order.kmtyorchid.com).

## Deploy on Aliyun ECS (after the ICP filing passes)

Target shape (plan §D11): one small ECS (2 vCPU / 2–4 GB), Caddy in front for
TLS, this app behind it. Ubuntu 22.04+ or Alibaba Cloud Linux.

1. **Node 22**: `curl -fsSL https://npmmirror.com/mirrors/node/v22.12.0/node-v22.12.0-linux-x64.tar.xz`
   → unpack to `/opt/node22`, add to PATH. (npmmirror is the mainland mirror —
   no npm packages are needed, only the runtime.)
2. **App**: `rsync` the `saas/` folder plus the legacy page files
   (`constellation.html`, `stock.html`, and the image/font assets they use) to
   `/opt/kmty/` preserving the repo layout (`saas/` next to the page files).
3. **systemd** `/etc/systemd/system/kmty.service`:

   ```ini
   [Unit]
   Description=KMTY Orchid Storefronts
   After=network.target
   [Service]
   WorkingDirectory=/opt/kmty/saas
   Environment=PORT=8787 DATA_DIR=/opt/kmty/saas/data ADMIN_PASS=<strong-secret>
   ExecStart=/opt/node22/bin/node server.js
   Restart=always
   [Install]
   WantedBy=multi-user.target
   ```

4. **Caddy** (auto-TLS via Let's Encrypt, works from mainland; or install an
   Aliyun free DV cert into nginx if preferred):

   ```
   order.kmtyorchid.com, *.kmtyorchid.com {
     reverse_proxy 127.0.0.1:8787
   }
   ```

   The wildcard needs a DNS challenge (or list tenant subdomains later — the
   app already resolves `<slug>.kmtyorchid.com` from the Host header).
5. **Bootstrap**: `node seed.js` (creates the `kmty` platform tenant), then the
   KV import below. Add the **备案号 footer** requirement to the storefront
   config once the number is issued, and file 公安备案 within 30 days.

### Cutover from Cloudflare

1. Dump the KV namespace (`config`, `rs:*`, `ord:*`, `lead:*`) with wrangler
   into `{ "entries": [ { "key", "value" } ] }` and run
   `node migrate.js dump.json --dry` → review → run without `--dry`.
   Legacy resellers keep their ids (`/r/<id>` links unchanged) **and their
   passwords** (old sha256 hashes are honoured and upgraded to salted scrypt on
   first login).
2. Verify against the ECS public IP (hosts-file override for the domain).
3. At 凡科 DNS, repoint **only** the `order` CNAME/A record to the ECS
   (⚠ never touch the `@` MX records — company email lives on them).
   Cloudflare stays deployed = instant rollback by re-pointing.
4. Watch `journalctl -u kmty -f` + the admin 审核/日志 tabs for a day, then
   decommission the Cloudflare order project (and later `www` if the marketing
   site also moves — Caddy can serve it as a static site from another folder).

### Backups

- SQLite: the server writes a nightly `VACUUM INTO data/backups/app-<date>.db`
  (keeps 14). Copy `data/` off-box daily (`ossutil cp -r data oss://…` or rsync).
- Restore = stop service, replace `data/app.db`, start.

## Security model (MVP)

- Sessions: httpOnly SameSite=Lax cookie, 30-day sliding, sha256-stored tokens.
  Mutations require `application/json` (CSRF: cross-site forms can't send it);
  uploads are validated by magic bytes and size caps, stored under the tenant's
  own prefix only.
- Passwords: salted scrypt (`s2:`), legacy imports `s1:` upgraded on login.
- Tenancy: every seller query is scoped by the session's tenant id; platform
  admin may act as a tenant via `x-tenant` (view-as) — every such write is
  audited with `actor=admin`.
- Moderation is **takedown-based, not approval-based** (owner's decision,
  2026-07): signup, product publishes and photo uploads all go live instantly —
  nothing ever waits on the platform. The admin 动态 feed shows everything just
  published with one-tap 下架/暂停/移除 (all reversible, all audited); a
  platform takedown ('rejected') cannot be self-republished by the seller.
  Consider adding Aliyun 内容安全 auto-screening post-publish in Phase 2 to
  keep this hands-off as volume grows.
- SMS OTP, WeCom notifications, OSS media offload: deliberate Phase-2 hooks —
  the storage layer (lib/media.js) and login path are the two contained swap
  points.

## What this implements (vs the plans in ../docs)

Phase 0+1 of `saas-platform-plan.md`: tenancy + fully self-serve signup with
**no approval gate** (D18 overridden by the owner — instant everywhere,
takedown-net moderation), the seller backend core (inventory with photos,
**prices incl. wholesale tiers + display modes** — D17, order pipeline with
the completed/delivered lifecycle + buyer-relevant delivery date), storefront
rendering with per-tenant accent, platform admin (published-feed with
takedown/restore, tenants, plans as data, constellation colour config, leads,
audit), the old system's compat API, and the migration path. Reviews/ratings,
consignment, plans enforcement, WeCom/SMS are Phases 2–3 per the plan.
