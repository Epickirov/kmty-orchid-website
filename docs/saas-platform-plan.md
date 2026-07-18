# KMTY Orchid — SaaS Platform Plan

**Status:** Draft v1 for review · **Supersedes the phasing in** `reseller-marketplace-spec.md`
(that document remains the detailed feature spec for catalog/consignment/reviews and is
referenced throughout as **[MKT]**) · **Last updated:** 2026-07-15

> Planning document — no code yet. Decision items continue the existing numbering
> (**D17+**; D1–D16 live in [MKT] §17). Each has a recommended default; silence = default.

---

## 0. TL;DR

Turn `order.kmtyorchid.com` from a single-vendor order tool with white-label links into a
**multi-tenant SaaS**: every seller gets a self-service **backend (dashboard)** where they
manage their own storefront end-to-end — inventory with photos/video, quantities, **prices**,
branding, service terms, orders, reviews, consignment, marketing tools — with zero KMTY
involvement in day-to-day operation. KMTY becomes the **platform operator** (approval,
moderation, plans/quotas, platform analytics) *and* remains the anchor seller (the
Constellation configurator stays, as KMTY's own product plus an opt-in commission module on
every seller storefront).

The six pillars of the change:

1. **Tenancy & accounts** — self-serve signup, phone+OTP login, sessions, staff seats later.
2. **The Seller Backend** — a full dashboard (11 areas, §4) replacing today's read-only portal.
3. **Storefront customization** — safe, token/section-based theming; no KMTY hand-holding.
4. **Prices become seller-managed and displayable** (revises D6): per-product prices,
   wholesale tiers, per-seller display mode.
5. **Plans & monetization** — entitlement system from day 1; free at launch, paid tiers when
   there's traction; billing offline (contract + transfer + 发票) so the site stays
   non-transactional.
6. **Multi-tenant architecture on Aliyun** — the [MKT] §9 stack hardened for tenancy: RDS,
   per-tenant OSS prefixes and quotas, audit log, wildcard subdomains.

Ordering stays **inquiry-only** (no online payment; deals close in WeChat). That constraint —
plus 先审后发 moderation — is what keeps the beian posture simple while sellers publish content
under our domain.

---

## 1. Current-state audit (what exists today)

Read against the live code (`_worker.js`, `constellation.html`, `reseller.html`,
`admin.html`, `stock.html`; Pages project "constellation" + KV):

| Surface | What it does today | Seller can… | Seller cannot… |
|---|---|---|---|
| `/` + `/r/<id>` (constellation.html as index) | Customer-facing Constellation configurator; name/phone/qty capture; save-card → WeChat. `/r/<id>` swaps in the reseller's name/logo (page + card). | — | change anything about the page |
| `/reseller` (reseller.html, 205 lines) | Portal: login (id + password in sessionStorage), shows their share link, self-service password change, commission summary (`rate% × qty × refPrice`), customers grouped by phone. | copy link, change password, view commission | manage products, media, prices, branding, services, orders' state — none of it exists |
| `/admin` (admin.html, 5 tabs) | KMTY console: 颜色与库存 colour/stock config · 经销商 reseller CRUD (KMTY uploads the seller's logo, sets rate & reference price) · 订单 all orders · 佣金 commissions · 目录索取 leads. | — | — |
| `/stock` (stock.html) | Internal "which colours are out today" tool + link generator. | — | — |
| Backend | Single-file worker + KV. Shared admin password; reseller SHA-256 password re-sent on every request. No sessions, no salt, no accounts, no media storage, no order lifecycle. | | |

**The gap in one sentence:** today a seller is a *row KMTY creates*, with a link and a
commission read-out; a SaaS seller is an *account that creates itself* and owns a storefront,
a catalog, prices, and an order pipeline. Nothing about the current data model, auth, or
portal survives that jump unchanged — but all of it maps cleanly onto the [MKT] architecture,
which is why this plan builds on that spec instead of restarting.

Also relevant: the repo already vendors React + Babel standalone (`vendor/`) used by the
configurator — the dashboard can be built the same self-contained, no-build, no-external-CDN
way (mainland constraint).

---

## 2. Vision & positioning

**Working name:** 星商 / "KMTY Orchid Storefronts" (placeholder — pick later).

- **For sellers** (phalaenopsis wholesalers, base operators, brokers): a WeChat-shareable,
  professional storefront + order inbox in 10 minutes, with trust features (certified
  reviews, arrival photos, verified-business badge) they can't get from a WeChat Moments
  post or a price-sheet screenshot.
- **For buyers** (flower shops, event companies, secondary wholesalers): browsable, filterable
  supply with real photos, real reviews, and clear service terms — order by inquiry, close in
  WeChat as they already do.
- **For KMTY:** the platform flywheel (more sellers → more supply → more buyers → more
  sellers), platform-level oversight, commission on Constellation sales through every
  storefront, and — once traction is real — subscription revenue (§7).

KMTY runs as **tenant #0**: its own storefront on the same rails (dogfooding), plus the
platform-operator console (§11).

---

## 3. Tenancy, accounts & onboarding

### 3.1 Model

- **Tenant** = one seller organisation. Owns: storefront, catalog, media, orders (as
  responsible party), service profile, plan/entitlements, ledger position.
- **User** = a person logging into a tenant. MVP: exactly one owner-user per tenant.
  **Staff seats** (sales clerk role: read orders, update stock, no pricing/branding rights)
  arrive with paid plans (⟡ D24).
- **Buyers stay account-less** (phone-verified per order/review, per [MKT] §7) — B2B buyers
  won't create accounts to send an inquiry, and the trade lives in WeChat.

### 3.2 Identity & auth (mandatory overhaul)

- Login = **mobile number + SMS OTP** (Aliyun SMS; the China-native pattern) with password as
  secondary. Salted password hashing (scrypt/argon2), server-side **sessions** (signed token,
  TTL + refresh), rate-limited login, self-serve password/phone reset via OTP.
- Every privileged action writes an **audit log** row (who, what, when, from where).
- Kill today's re-send-the-password-on-every-request scheme during the port (D9 already says
  yes; the SaaS makes it non-optional).

### 3.3 Self-serve signup & verification

```
visitor → 注册 (phone + OTP) → claim storefront id (/r/<id>) → guided onboarding wizard
        → [KMTY approval gate ⟡ D18] → storefront live (draft products still 先审后发)
```

- **Onboarding wizard** (the "10 minutes to live" promise): ① business name + logo upload →
  ② WeChat contact (QR upload) → ③ service commitments (3 toggles) → ④ first product
  (photos, spec, qty, price) → ⑤ preview → publish. Each step skippable; checklist persists
  on the dashboard home until done.
- **Approval gate (⟡ D18):** new tenants go live only after KMTY one-tap approval (identity
  sanity, not a full audit). Keeps squatters/spam off the domain that carries our beian.
- **Verification (企业认证):** optional upload of business licence → KMTY check → verified
  badge ([MKT] F-7). Verified status can gate higher quotas.
- Reserved/blocked id list (kmty, admin, api, www, order, obscenities…).

---

## 4. The Seller Backend (the centerpiece)

One dashboard at `/seller` (today's `/reseller` URL 301s to it). Mobile-first — sellers run
their business from a phone at the greenhouse or the 斗南 market stall. Built with the
vendored-React no-build pattern. Eleven areas:

### 4.1 Home / overview
- KPIs: visits, card-saves, new inquiries, orders awaiting action, low-stock count, rating.
- **Action queue** ("needs you"): new inquiry-orders to confirm, consignment requests,
  reviews to reply to, delivery confirmations pending, onboarding checklist remainder.
- Announcement from platform (release notes, policy changes).

### 4.2 Inventory & products
The heart of the ask. Per [MKT] §4 product model (grade, size, flower count, quantity, media)
plus what a real backend needs:
- **List view = worksheet:** thumbnails, status, qty, price, sortable/filterable; **inline
  quick-edit for qty and price** (the two fields sellers touch daily); bulk select →
  publish/pause/adjust.
- **Product editor:** specs, taxonomy fields ([MKT] F-2: variety, colour family, spike count,
  stage 瓶苗/中苗/大苗/开花株), description, media manager (drag-drop reorder, poster pick,
  progress, quota meter), per-product visibility.
- **Batches/lots (Phase 2+):** a product can carry dated batches ("ready week 50 × 3000
  units") — feeds pre-order/futures ([MKT] F-1).
- **Stock:** manual adjust always; optional **auto-decrement on order completion** (⟡ D22,
  revises D7) with low-stock and auto-`out_of_stock` thresholds; stock history log.
- **CSV import/export** for sellers with hundreds of SKUs (template + validation report).
- Media pipeline, quotas, moderation exactly per [MKT] §4.2/§11 (OSS policy-signed uploads,
  先审后发).

### 4.3 Pricing (revises D6 — ⟡ D17)
- **Per-product price** (¥/株), optional **wholesale tiers** (price breaks at qty thresholds:
  "≥100 ¥18 · ≥500 ¥16 · ≥1000 ¥14.5" — how this trade actually quotes).
- **Display mode, per seller with per-product override:**
  `public` (price on storefront) · `on_request` ("询价" button, price revealed in the reply
  the seller sends) · `hidden` (spec-only listing).
- Recommended default **public** — visible prices are what makes storefronts genuinely useful
  and is the biggest differentiator vs a static catalog; sellers who quote dynamically pick
  `on_request`. If shown, prices must be real (明码标价 — no fake slash-through games; §13).
- Price changes are versioned; an order snapshots the price list in force (dispute-proofing,
  same pattern as service-terms snapshots in [MKT] §6).
- The **price-sheet generator** ([MKT] F-3) reads the same data: sellers with `hidden` mode
  still get their daily WeChat 报价单 workflow from the platform.

### 4.4 Orders / inquiry pipeline
- Order lifecycle per [MKT] §7.1 (`placed → completed → delivered`, `void`), presented as a
  pipeline: **New / In talk / Completed / Delivered**, with one-tap state moves and WeCom
  pings ([MKT] F-10) on arrivals.
- Order detail: buyer contact (tap-to-copy for WeChat), product line, qty, price snapshot,
  service-terms snapshot, notes field, actual-amount recording ([MKT] F-12).
- Consignment orders appear in both parties' pipelines in their respective roles
  (storefront = responsible party; owner = supplier) per [MKT] §5.5.
- Filters, search by phone/name, CSV export.

### 4.5 Storefront designer ("fully customize themselves")
Bounded customization — **theme tokens + section registry, not free-form code** (⟡ D20):
- **Brand kit:** logo, banner image, accent colour (curated palette + custom with contrast
  check), storefront display name, tagline, about text, WeChat QR, location/ships-from.
- **Sections (toggle + reorder):** announcement bar · featured products (hand-picked) ·
  full catalog (with filter bar) · seasonal/pre-order block · reviews & arrival-photo gallery
  · services strip · about/contact. Constellation module (KMTY cross-sell, earns their
  first-touch rate) is opt-in per seller.
- **Layout presets:** 2–3 storefront templates (photo-forward grid / dense wholesale list /
  minimal card).
- **Live preview → publish** with version history and one-tap rollback; all uploaded assets
  pass moderation before public display.
- Why not custom HTML/CSS: China content compliance on our beian, XSS surface, performance
  budget on rural mobile, and design floor (every storefront reflects on the platform).
  Escape hatch for big accounts later: "concierge theme" KMTY builds by hand.

### 4.6 Services & policies
[MKT] §6 profile (shipping included, X% QA guarantee with the fixed-template maths, replace
policy, MOQ, invoice, ships-from, carrier) edited here; versioned; snapshot per order.

### 4.7 Consignment centre
[MKT] §5 in dashboard form: browse other sellers' consignable catalogs → request; incoming
requests inbox → accept (set % + scope)/decline; active agreements list with per-agreement
performance (sales, commission accrued); pause/revoke.

### 4.8 Reviews & reputation
[MKT] §7: product ratings (theirs as owner), service reputation (as storefront, once D13
ships), reply-once ([MKT] F-6), request-review nudge (WeChat-ready message + QR), flag abuse
to platform. Arrival-photo gallery stats ([MKT] F-8).

### 4.9 Marketing tools
- Share-link manager (per-campaign suffixes `?c=` for source tracking).
- **QR poster generator** ([MKT] F-14) and **price-sheet image generator** ([MKT] F-3).
- Product share cards (reuse the existing save-card tech per product).

### 4.10 Analytics
[MKT] F-15 funnel per seller: storefront visits → card saves → inquiries → completed →
delivered; top products; consignment performance both directions; review velocity. Simple
daily rollups, no real-time pretensions.

### 4.11 Settings
Account (phone, password, OTP), business profile & verification, notification prefs (WeCom
webhook URL, SMS), staff seats (⟡ D24), **plan & usage meters** (products, storage, seats vs
entitlements), data export, close storefront.

---

## 5. The buyer-facing storefront

[MKT] §4.4 display plus the customization output of §4.5: seller branding everywhere
(page + saved cards), filter bar driven by taxonomy (F-2), price display per D17 mode,
reviews/arrival gallery, services strip, Constellation module when enabled. Same
inquiry-order → save-card → WeChat close. Storefront URLs: `/r/<id>` today, plus
**`<id>.kmtyorchid.com`** wildcard subdomains as a plan perk (⟡ D21 — one beian covers all
subdomains; external custom domains are Phase 4+ and need that seller's own beian, so
de-scope for now).

---

## 6. Plans & monetization — ⟡ D19

Entitlement checks built from day 1 (they're trivial then, painful to retrofit); **everyone
free** while we build liquidity; switch on paid tiers when sellers demonstrably get orders.

| | **Free** | **Standard** (~¥N/mo) | **Pro** (~¥3N/mo) |
|---|---|---|---|
| Products | 10 | 100 | 500 |
| Photos/product · storage | 3 · 200 MB | 6 · 2 GB | 10 + video · 10 GB |
| Wholesale price tiers | — | ✓ | ✓ |
| Consignment (offer/carry) | — | ✓ | ✓ |
| Subdomain `<id>.kmtyorchid.com` | — | — | ✓ |
| Storefront templates | 1 | all | all + concierge |
| Analytics | basic | full | full + export |
| Staff seats | 1 | 2 | 5 |
| Verified badge fast-track | — | — | ✓ |

- **Billing is offline** for MVP: annual/quarterly contract, bank transfer, KMTY issues 发票;
  admin flips the tenant's plan. No online payment on the site (keeps the non-transactional
  beian posture; revisit EDI/经营性 licensing before ever automating payments — §13).
- Platform-fee lever on consignment sales stays as built-but-0% (D3).
- Grandfather the existing hand-created resellers onto Standard free for a year (goodwill +
  migration lubricant).

---

## 7. Pricing-display compliance note

Public prices + inquiry ordering is fine and common (it's a catalog, not a checkout). Two
rules to bake in: **明码标价** (displayed prices must be genuine; if we ever show
strike-through "original" prices, they must be real historical prices — safest: never build
fake-discount UI), and price-related claims ("cheapest in Yunnan") are seller content →
moderation list. Nothing here requires payments infrastructure.

---

## 8. Architecture — multi-tenant on Aliyun

Everything in [MKT] §9 stands (post-ICP Aliyun move, OSS+CDN, DirectMail, migration
choreography, 备案号 footer, 公安备案). SaaS deltas:

- **Database (⟡ D23):** go **RDS MySQL (smallest HA tier or Serverless)** from Phase 1 instead
  of SQLite-then-migrate. Rationale: tenancy multiplies write concurrency and makes
  point-in-time recovery + managed backups worth ~¥100–200/mo from the start; schema is the
  same either way. (Fallback if budget-pinched: SQLite + hourly OSS snapshots, migrate at
  ~50 active tenants.)
- **Tenancy enforcement:** single app, single DB, `tenant_id` on every tenant-owned row;
  one data-access layer that *requires* tenant scope (no raw table access from handlers);
  cross-tenant reads only through explicit marketplace queries (consignment browse, admin).
  OSS prefixes `media/<tenantId>/…` with per-tenant quota counters checked at policy-sign
  time. Per-tenant rate limits.
- **Sessions/auth** per §3.2; admin console on a separate auth realm + IP allowlist option.
- **Wildcard `*.kmtyorchid.com`:** one wildcard DNS record + wildcard cert; app resolves
  tenant from host header, else from `/r/<id>` path. (DNS stays at 凡科; the `@` MX records
  are never touched.)
- **Caching:** storefront JSON cacheable 60s at CDN; dashboard never cached; media immutable
  with hashed keys.
- **Observability:** request logs with tenant tag, error alerting to KMTY's own WeCom robot,
  daily backup-restore drill note in the runbook.
- **Backups/DR:** RDS automated backups + weekly logical dump to OSS; OSS versioning on;
  documented restore runbook. Audit log append-only.

---

## 9. Data model (delta over [MKT] §10)

```
tenants        (id, storefront_id/slug, display_name, status[pending|active|suspended|closed],
                plan_id, verified, brand_json, storefront_config_json, services_json,
                contact_wechat, created, approved_at)
users          (id, tenant_id, phone, pass_hash, role[owner|staff], status, created)
sessions       (id, user_id, token_hash, expires, created, ip)
plans          (id, name, entitlements_json, price_note)          ← rows, not code
plan_grants    (tenant_id, plan_id, source[default|contract|grandfather], starts, ends)
products      += price, price_tiers_json, price_display[inherit|public|on_request|hidden],
                taxonomy fields (variety, colour_family, spikes, stage), visibility
price_history  (id, product_id, snapshot_json, changed_by, created)
stock_moves    (id, product_id, delta, reason[manual|order|import], order_id?, by, created)
storefront_versions (id, tenant_id, config_json, published_by, created)   ← rollback
audit_log      (id, tenant_id?, user_id?, actor[seller|admin|system], action, target,
                detail_json, ip, created)
usage_counters (tenant_id, metric[products|storage_mb|seats], value, updated)
```

`resellers` from [MKT] becomes `tenants`+`users` (migration §12). Orders/reviews/offers/
ledger/claims tables carry over from [MKT] §10 unchanged, keyed by tenant ids.

---

## 10. API surface (grouped; sessions everywhere; admin realm separate)

- **Auth:** `POST /api/auth/otp` · `POST /api/auth/login` · `POST /api/auth/logout` ·
  `POST /api/auth/reset`
- **Tenant:** `GET/PUT /api/tenant` (profile, brand, services, notification prefs) ·
  `POST /api/tenant/signup` · `GET /api/tenant/usage`
- **Storefront config:** `GET/PUT /api/storefront` · `POST /api/storefront/publish` ·
  `GET /api/storefront/versions` · `POST /api/storefront/rollback`
- **Products:** CRUD + `POST /api/products/bulk` (CSV) + `POST /api/products/:id/stock`
- **Media:** `POST /api/media/policy` (scoped signed upload) · `POST /api/media/attach` ·
  `DELETE /api/media/:id`
- **Orders:** `GET /api/orders` (pipeline) · `POST /api/orders/:id/state` ·
  `POST /api/orders/:id/amount` · public `POST /api/order`, `POST /api/order/delivered`
- **Pricing:** covered by products; `GET /api/pricesheet` (generator data)
- **Offers/consignment, reviews, ledger, claims:** per [MKT] §8
- **Public storefront:** `GET /api/storefront/:slug` (branding+config+catalog, CDN-cached) ·
  `GET /api/reviews?product=`
- **Platform admin:** tenants (list/approve/suspend/plan), moderation queues (media, reviews,
  storefront publishes), ledger, policy, impersonate (⟡ D25), audit search

---

## 11. Platform admin (KMTY ops console)

Evolves `/admin` from "the backend" into "the operator's console":
- **Tenants:** pipeline (pending approvals with signup info), search, plan assignment,
  quota overrides, suspend/close (storefront → "temporarily unavailable"), verification
  (licence review → badge).
- **Moderation queues:** product media · review text/photos · storefront publishes
  (brand assets, about text) — one unified queue with per-type SLAs; 内容安全 auto-screen
  in front of it from Phase 2 ([MKT] D14).
- **Marketplace:** consignments overview, full ledger, first-touch registry.
- **Colour/stock + Constellation config:** unchanged (KMTY-as-seller tooling).
- **Platform analytics:** tenant activation funnel (signed up → published → first inquiry →
  first completed), GMV-proxy (completed qty × snapshot price), review volume, media storage.
- **Ops:** impersonation with per-use audit + visible banner (⟡ D25), announcement composer,
  kill switches (tenant, media object, storefront), audit-log search.

---

## 12. Migration & compatibility

1. **Resellers → tenants:** each `rs:<id>` becomes a tenant (slug = id, so every existing
   `/r/<id>` link keeps working) + an owner user (existing password hash carried over,
   re-hashed to salted scheme on first login; phone collected at first login for OTP).
2. **Base64 logos → OSS** objects; `rate`/`price` stay as the Constellation-commission
   settings on the tenant.
3. **Orders/ref/leads:** KV export → SQL import per [MKT] §9.3, tagged to tenants.
4. **URLs:** `/r/<id>` permanent; `/reseller` → `/seller` 301; `/admin` stays; Constellation
   page unchanged for buyers.
5. **Sequencing:** this rides the Phase 0 Aliyun port — one migration, not two. Cloudflare
   stays warm for instant DNS rollback throughout.

---

## 13. Compliance & trust (China SaaS specifics)

- **Beian:** one ICP filing covers apex + all subdomains incl. wildcard tenant subdomains;
  备案号 in every footer; 公安备案 within 30 days. Hosting *sellers'* content under our
  domain = our responsibility → approval gate (D18), 先审后发 moderation, audit trail,
  kill switches. Keep the filing 非经营性 by staying payment-free; before ever charging
  subscriptions **online** or processing marketplace payments, do the 经营性ICP/EDI
  licence analysis ([MKT] §9.1). Offline contracts + transfers avoid the question for now.
- **PIPL (buyer PII):** collect minimum (name, phone, region); purpose-limited to the
  inquiry; masked everywhere public; full contact visible only to the responsible party
  (+ supplier when drop-shipping); retention policy (e.g., purge voided orders after 12
  months); simple privacy notice on the order form; PII access is audited.
- **Platform ToS + seller agreement:** content responsibility, takedown rights, commission
  and consignment terms, data ownership (sellers can export their catalog/orders), the
  responsible-party rule ([MKT] §3) in writing.
- **明码标价** per §7; UGC/content obligations per [MKT] §11.

---

## 14. Roadmap (merges and supersedes [MKT] §13 phasing)

| Phase | Ships | Gate / effort feel |
|---|---|---|
| **0 — Aliyun port** | [MKT] Phase 0 unchanged (ECS+RDS+OSS/CDN port, KV→SQL, DirectMail, DNS cutover, beian chores) **+ auth overhaul** (accounts, OTP, sessions, salted hashes, audit log) and the resellers→tenants migration | ICP approval; ~2–3 wks |
| **1 — Seller Backend core** | Dashboard shell + Home; Inventory/products with photos (OSS pipeline, moderation queue v1); **pricing incl. tiers + display modes**; order pipeline with lifecycle states + delivery date; basic brand kit (logo/banner/colour/about/WeChat QR); public storefront rendering catalog + prices; signup + onboarding wizard + approval gate; admin tenant management | Phase 0; the big one, ~4–6 wks |
| **2 — Trust & polish** | Reviews end-to-end ([MKT] §7 incl. 5-day photo window), services profiles + snapshots, storefront designer (sections/templates/preview/versions), video, 内容安全 auto-moderation, SMS OTP hardening, WeCom notifications, CSV import, analytics v1, QR poster + price-sheet generators | ~3–4 wks |
| **3 — Marketplace & plans** | Consignment centre ([MKT] §5), line-item ledger ([MKT] §8), dual-axis rating (D13), actual-amount recording, plans/entitlements enforcement + admin billing tools, staff seats, subdomains | ~3–4 wks |
| **4 — Growth** | Pre-order/futures batches, RFQ board, privacy numbers, concierge themes, settlement statements, deeper analytics | demand-driven |

After Phase 1 the pitch already works: *"sign up, upload your plants with prices, share your
link, take orders."* Phases 2–3 make it defensible (trust loop + marketplace network).

---

## 15. Risks

- **Liquidity chicken-and-egg** — storefronts without buyers churn. Counter: KMTY as anchor
  seller, the price-sheet/QR tools that are useful *without* platform traffic (they pull
  sellers in for their existing WeChat workflow), grandfathered free plans, 斗南-market
  ground game.
- **Moderation load scales with tenants** — approval gate + 内容安全 (Phase 2) + trusted-
  seller fast-track; budget real admin time in Phase 1.
- **Scope explosion** — the dashboard is 11 areas; the phasing cuts it so Phase 1 is only
  the four that match the user promise (inventory, prices, orders, basic brand). Hold that
  line.
- **Price display backfiring** (sellers refuse public prices) — D17's per-seller mode is the
  hedge; watch the metric, don't force it.
- **Single-operator platform** — KMTY both operates the platform and competes as a seller;
  publish the neutrality rule (same moderation SLAs, no ranking boosts for tenant #0) in the
  seller agreement to pre-empt distrust.
- **Compliance drift** — payments creep is the main trap; §13 draws the line.

---

## 16. Decisions — ⟡ D17–D25

| # | Decision | Recommended default |
|---|---|---|
| **D17** | Price display (revises D6) | Seller-managed prices with per-seller mode (`public` / `on_request` / `hidden`) + per-product override; default **public**; wholesale tiers supported. |
| **D18** | Self-serve signup | **Yes, with KMTY one-tap approval gate** before a storefront goes public. |
| **D19** | Monetization | Entitlement system from day 1; **free at launch**, paid tiers (≈ §6 table) once sellers get orders; billing **offline** (contract + transfer + 发票). |
| **D20** | Customization depth | **Token/section/template system, no custom code**; concierge themes later for big accounts. |
| **D21** | Tenant subdomains | **Yes** (`<id>.kmtyorchid.com`, wildcard cert) as a paid-tier perk in Phase 3; external custom domains deferred (need per-seller beian). |
| **D22** | Stock behaviour (revises D7) | Manual always + **optional auto-decrement on `completed`** with low-stock/auto-out thresholds, per seller. |
| **D23** | Database | **RDS MySQL from Phase 1** (managed backups/PITR beat SQLite once tenants multiply); SQLite fallback only if budget forces it. |
| **D24** | Staff seats | Owner-only MVP; staff role (orders+stock, no pricing/brand) in **Phase 3** as a paid-tier feature. |
| **D25** | Support impersonation | **Yes** — admin "view as seller", read-write,每次 audited + banner shown; huge for supporting non-technical sellers. |

Give me your calls on D17–D25 (plus any overrides on D1–D16 in [MKT] §17), and I'll produce
the Phase 0 + Phase 1 build plan (task-level, with the data schema and API contracts frozen).
