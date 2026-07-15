# Reseller Marketplace & Consignment — Product & Design Spec

**Status:** Draft for review · **Scope:** `order.kmtyorchid.com` (the "constellation" Cloudflare Pages project)
**Author:** engineering · **Last updated:** 2026-07-14

> This is a planning document. No code is written yet. Sections marked **⟡ DECISION**
> need your input before build — each has a recommended default so we can move fast.

---

## 0. TL;DR

Two new capabilities on the reseller order system:

- **A. Reseller product catalog.** Each reseller can list their *own* products — optional
  photos/videos plus structured specs (grade, size, flower count, quantity) — and show them
  on their branded `/r/<id>` page, alongside the existing KMTY Constellation flow.
- **B. Inter-reseller consignment.** A reseller who wants a bigger catalog can *request* to
  carry another reseller's products. The owner accepts or declines and sets a commission %
  for sales made through the requestor's page. Sales route to the owner for fulfilment; the
  requestor earns the agreed cut.

The build needs three things the current system doesn't have: **real media storage**
(Cloudflare R2 — base64-in-KV won't hold photos/videos), a **relational data layer**
(Cloudflare D1) for products/offers/commission, and a **generalised commission ledger** that
tracks multi-party splits per line item instead of one credit per order.

Everything stays **inquiry-only** (no online payments) and **China-accessible**, consistent
with the rest of the site.

---

## 1. Where we're starting from (current system)

Grounding so the spec is concrete, not hypothetical. Today the worker (`_worker.js`, KV
namespace `KMTY_CONFIG`) has:

| Thing | How it works today |
|---|---|
| **Products** | There is exactly one "product": the Constellation *mix-your-own* configurator. Every order is one mix (colours + seed) × quantity. No catalog. |
| **Resellers** | `rs:<id>` = `{ name, company, companyEn, footer, logo, passHash, rate, price, created }`. `logo` is a base64 data-URI capped at ~400 KB stored **inside the KV value**, served by decoding it in `/api/reseller-logo`. |
| **Auth** | Admin: shared `x-admin-pass` secret. Reseller: `x-reseller-id` + `x-reseller-pass` headers, SHA-256'd and compared **on every request** (no sessions, no salt). |
| **Orders** | `ord:<credited>:<ts>-<id>` = `{ name, phone, qty, recipe, mix, reseller, credited }`. No prices shown to customers — the flow captures name/phone/qty, renders a card, and tells the buyer to **send it to a WeChat** to complete offline. |
| **Commission** | Single axis: **first-touch by phone** (`ref:<phone>`). The first reseller to refer a phone number keeps commission credit for that customer forever. Payout = `rate% × qty × price` (a per-reseller reference price). |
| **Branding** | `/r/<id>` and `/order` both serve the root page; branding is fetched client-side from `/api/reseller?id=`. |
| **Hosting** | Cloudflare Pages Advanced Mode, Direct Upload, single-file worker. Deliberately simple. China-reachable via `order.kmtyorchid.com`. |

Two facts shape most of the design below: **(1) media today is tiny and lives in KV**, and
**(2) commission is one credit per order, per customer.** Both assumptions break with this
feature.

---

## 2. Goals / non-goals

**Goals**
- Resellers self-manage a catalog of their own products with optional rich media.
- Resellers can extend their catalog by consigning other resellers' products, with
  owner-controlled commission and explicit accept/decline.
- Orders route to the correct fulfiller; every sale's commission is tracked and settleable.
- KMTY retains oversight (moderation + full ledger visibility).
- Preserve the current model: no online payment, offline WeChat settlement, works in China.

**Non-goals (for now)**
- Online checkout / payment processing / escrow.
- Public pricing or a price-comparison marketplace.
- Auto-translation of reseller-entered content.
- Logistics/shipping integration.

---

## 3. Roles

| Role | New abilities |
|---|---|
| **KMTY admin** | Moderate/approve reseller products; view all products, consignment agreements, and the full commission ledger; set platform-fee policy; force-unlist/takedown. |
| **Reseller (owner)** | CRUD their own products + media; receive/accept/decline consignment requests; set commission % for accepted requests; see who is carrying their products; fulfil orders for their products. |
| **Reseller (requestor / storefront)** | Request to carry another reseller's products; display owned + consigned products on their `/r/<id>` page; earn commission on consigned sales. |
| **Customer** | Browse a reseller page's catalog (photos/videos/specs), pick a product, place an inquiry-order (same save-card → WeChat flow). |

A single reseller is both an owner and a potential storefront simultaneously.

---

## 4. Feature A — Reseller product catalog

### 4.1 Product model

A **Product** belongs to one reseller (`ownerResellerId`). Proposed fields:

| Field | Type | Notes |
|---|---|---|
| `id` | string | short unique id |
| `ownerResellerId` | string | FK → reseller |
| `title` | string | reseller-entered, single language |
| `description` | text (optional) | free text |
| `grade` | enum + custom | reuse KMTY's grade set (Special / A / B / C) as presets; allow custom label. **⟡ DECISION D5a** |
| `sizeSpec` | enum | reuse the cup-size list already added to the contact form: 1.7″/2.0″/2.5″/2.8″/3.0″/3.5″/3.8″ (+ "large/small flower" if needed) |
| `flowerCount` | integer | "flower number" — spikes/blooms per plant |
| `quantity` | integer | available stock (decremented or advisory — **⟡ DECISION D7b**) |
| `refPrice` | number (optional) | internal reference price per unit; **not shown to customers**; drives commission math |
| `media[]` | array | ordered list of photo/video refs (see 4.2); may be empty |
| `status` | enum | `draft` → `pending_review` → `active` → `paused` / `out_of_stock` / `rejected` |
| `created`, `updated` | timestamp | |

Media is **optional** — a product can be specs-only, photos-only, or photos + video.

### 4.2 Media — storage, upload, serving (the hard part)

Base64-in-KV (how logos work today) does **not** scale to multiple photos and especially
videos. Recommended architecture:

- **Storage: Cloudflare R2** (S3-compatible object store, no egress fees, native Worker
  binding). Objects keyed `media/<resellerId>/<productId>/<uuid>.<ext>`. This is effectively
  required for the media requirement; KV is the wrong tool.
- **Upload: presigned direct-to-R2 PUT URLs.** The browser uploads the file straight to R2,
  not through the Worker (Workers have body-size + CPU limits; a 30 MB video through a Worker
  is a bad idea). Flow: portal asks Worker → Worker validates the reseller + returns a
  short-lived scoped presigned URL → browser PUTs the file → browser tells the Worker "attach
  object X to product Y."
- **Photos:** client-side downscale/compress before upload (e.g. ≤ 2000 px, ~85% quality,
  target < 400 KB). Optionally run through **Cloudflare Images** for automatic resizing/format
  negotiation later.
- **Video: ⟡ DECISION D2.** Two options:
  - *R2 + strict caps* (recommended for MVP): cap length (~30 s) and size (~20 MB), require a
    client-generated poster frame, serve the raw file with range requests. Cheapest, simplest,
    but no transcoding → a heavy phone video plays as-is (rough on mobile/China).
  - *Cloudflare Stream*: purpose-built (transcoding, adaptive HLS, thumbnails). Best UX, but
    per-minute-stored + per-minute-delivered cost.
- **Quotas per reseller** (abuse/cost control): max N products, max M media per product, total
  storage cap, per-file size/length caps. Enforced at presign time.

### 4.3 Reseller portal — product management

Extend `/reseller` (currently: login, commission summary, customers, password change) with a
**"My products"** tab:
- Product list with status badges (draft / pending / live / paused / out of stock).
- Create/edit form: title, description, grade, size, flower count, quantity, ref price, media
  uploader (drag-drop, reorder, delete; progress bars; poster capture for video).
- Publish action → moves `draft` → `pending_review` (if moderation on) or `active`.
- Inline validation + quota meter ("3 of 20 products, 40 MB of 500 MB used").

### 4.4 Customer-facing display (`/r/<id>`)

Add a **catalog section** to the branded page:
- Responsive product grid → product detail view.
- Media gallery per product (swipeable photos + inline video with poster; lazy-loaded).
- Show grade · size · flower count · availability. **No price** (inquiry model). **⟡ DECISION D6.**
- "Order this" feeds the existing save-card → WeChat order flow, tagged with the product.
- The Constellation configurator remains as its own featured item.

### 4.5 Ordering & fulfilment routing

- A product order records `productId`, `ownerResellerId` (fulfiller), `storefrontResellerId`
  (whose page it sold on), plus the usual name/phone/qty.
- The "send this to WeChat …" hint must point at the **owning reseller's** WeChat/contact, not
  KMTY's. → **resellers need a new `contact`/`wechatId` field** (they have none today).
- KMTY-product (Constellation) orders keep routing exactly as they do now.

---

## 5. Feature B — Inter-reseller consignment

### 5.1 Concept

Reseller **A** (requestor / storefront) wants more inventory. A requests reseller **B** (owner)
to let A display B's products on A's page. B accepts/declines; on accept B sets a **commission
%** = the cut A earns on each sale of B's products through A's page. B fulfils; B keeps the
remainder.

### 5.2 Offer lifecycle

An **Offer** (consignment agreement) entity:

```
A creates request ─▶ pending ─▶ B accepts (sets commission %, scope) ─▶ active
                            └─▶ B declines ─▶ rejected
active ─▶ paused (either party) ─▶ active
active ─▶ revoked (either party)   [B's products stop showing on A's page]
```

Fields: `id, requestorId (A), ownerId (B), status, commissionPct, scope, message, created,
decidedAt`. B is notified of new requests via an in-portal **"Requests" inbox** (+ optional
WeChat/email ping).

### 5.3 Scope & commission granularity — **⟡ DECISION D5**

Recommended: on accept, B chooses **scope** (all current+future products, or a selected set /
by grade) and a **default commission %**, with optional **per-product overrides**. Simple case
(all products, one %) must be one tap.

### 5.4 Cross-display

When an Offer is `active`, B's in-scope, `active` products appear in A's catalog. Customer view
need not reveal it's B's product; internal records always carry `ownerResellerId` for routing.
Guardrails: no double-consignment (A can't re-consign B's product to C) for MVP; if B pauses a
product or the offer, it disappears from A's page within the KV/D1 refresh window.

### 5.5 Consignment order routing

A customer buys B's product on A's page →
- Fulfilment notification → **B** (owner/fulfiller).
- Commission ledger entry → **A** earns `commissionPct × refPrice × qty`; B keeps the rest
  (minus optional KMTY platform fee, **⟡ DECISION D3**).
- A sees the sale in their dashboard (as consignment income); B sees it as a sale to fulfil.

---

## 6. Commission & settlement — the money

Move from *one credit per order* to a **line-item ledger**. Every sale line produces one or
more ledger entries `{ orderId, lineId, fromParty, toParty, basis, pct, amount, type, status }`.

Sale types and who-gets-what:

| # | Sale | Fulfiller | Commission |
|---|---|---|---|
| 1 | KMTY Constellation via a reseller page | KMTY | KMTY → first-touch reseller (`rate% × qty × price`) — **unchanged** |
| 2 | Reseller B's own product via **B's own** page | B | none (B keeps all, minus optional platform fee) |
| 3 | Reseller B's product via **A's** page (consignment) | B | B → A (`commissionPct × qty × refPrice`), minus optional platform fee |
| 4 | Mixed order (e.g. a Constellation + a reseller product) | per line | computed **per line item**, not per order |

Notes:
- **First-touch (customer-level)** applies only to KMTY products (type 1). **Consignment
  (product-level)** applies to reseller products (type 3). They live on different axes and
  don't stack on the same line.
- **Settlement is offline (ledger-only).** KMTY is not a payment processor; the ledger records
  who owes whom so parties reconcile off-platform. **⟡ DECISION D10** (confirm).
- **Platform fee:** add a configurable KMTY fee (default 0%) applied to type-2/type-3 sales so
  the lever exists if you ever want it. **⟡ DECISION D3.**

---

## 7. Data & storage architecture

| Layer | Store | Holds |
|---|---|---|
| Config / hot auth | **KV** (existing) | `config`, `rs:<id>` (reseller record + auth), `ref:<phone>` first-touch, rate-limit |
| Structured data | **D1** (new, SQLite) | `products`, `product_media`, `offers`, `orders`, `order_items`, `commission_ledger` |
| Media blobs | **R2** (new) | photos & videos, keyed by reseller/product |

**Why D1 (⟡ DECISION D8):** the new queries are relational — "B's active products in-scope for
offer X," "ledger entries owed to A this month," "orders to fulfil for B." KV's prefix-list
model gets painful and denormalised for this. D1 gives SQL, joins, and transactions. *Fallback:*
stay KV-only with heavy denormalisation — possible but materially more code and more bug
surface for the commission logic. Recommendation: adopt D1 for the new entities; keep resellers
in KV (mirror the few fields D1 needs) to avoid touching the working auth path.

Rough D1 sketch:

```
products(id, owner_id, title, desc, grade, size_spec, flower_count, qty, ref_price, status, created, updated)
product_media(id, product_id, kind[photo|video], r2_key, poster_key, sort)
offers(id, requestor_id, owner_id, status, commission_pct, scope_json, created, decided_at)
order_items(id, order_id, product_id, owner_id, storefront_id, qty, ref_price, kind)
commission_ledger(id, order_id, line_id, from_party, to_party, type, pct, amount, status, created)
```

---

## 8. API surface (new / changed)

New endpoints (auth as noted). All under the same worker.

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/products` | GET | public (by `?reseller=`) / reseller (own, incl. drafts) | list catalog |
| `/api/products` | POST | reseller | create/update/delete own product |
| `/api/media/presign` | POST | reseller | get a scoped presigned R2 upload URL |
| `/api/media/attach` | POST | reseller | attach uploaded object to a product |
| `/api/offers` | GET | reseller | my incoming + outgoing consignment offers |
| `/api/offers` | POST | reseller | create request / accept (+ %/scope) / decline / pause / revoke |
| `/api/order` | POST | public | **extended** to accept product line items + storefront/owner tags |
| `/api/ledger` | GET | admin / reseller (own) | commission ledger |
| `/api/products/moderate` | POST | admin | approve / reject / unlist |
| `/api/reseller` | — | — | **extended** record: add `contact`/`wechatId`, quotas |

Auth headers stay as today (`x-reseller-id` / `x-reseller-pass`) unless we adopt sessions (D9).

---

## 9. Security, authorization, moderation, compliance

- **Authorization:** every write must verify the acting reseller **owns** the target (A can't
  edit B's products or accept offers on B's behalf). Presigned upload URLs scoped to the
  reseller's own `media/<id>/…` prefix and short-lived.
- **Auth hardening (⟡ DECISION D9):** the portal now does uploads + multi-step actions —
  recommend a lightweight signed **session token** (issued on login, short TTL) rather than
  re-sending the password on every request. Separately, SHA-256-without-salt should move to a
  salted KDF; low urgency (few B2B accounts) but note it.
- **Moderation (⟡ DECISION D4):** reseller media shows on the KMTY-branded domain. Recommend a
  **KMTY approval step** (`pending_review` → `active`) for MVP — brand safety + China content
  compliance. Alternative: trust + fast takedown.
- **Compliance:** user-generated media on a China-served domain carries content-rule/ICP
  responsibility. Keep an audit trail (who uploaded what, when) and an admin kill switch.
- **Abuse/cost:** per-reseller quotas enforced at presign; rate-limit uploads and offer spam.

---

## 10. China performance (media)

The recurring constraint. Cloudflare has no mainland edge on this plan, so media (especially
video) loads from an overseas edge for Chinese buyers.

- Keep media light: client-side compression, hard caps on video length/size, poster frames,
  lazy-load, and never autoplay heavy video.
- If media becomes central, revisit the **China-hosted mirror** discussed for the marketing
  site (Aliyun/Tencent OSS+CDN) for media specifically — same ICP prerequisite.
- Measure real China load with itdog.cn / boce.com once media is live.

---

## 11. KMTY admin additions

- **Products tab:** all resellers' products; approve/reject/unlist; flag content.
- **Consignments tab:** every A↔B agreement, status, commission %.
- **Ledger tab:** full multi-party commission ledger; filter by reseller/type/period; export.
- **Policy:** platform-fee %, per-reseller quotas, moderation on/off.

---

## 12. Phasing

| Phase | Delivers | New infra |
|---|---|---|
| **1 — Catalog (photos)** | Product model + specs, reseller portal CRUD, `/r/<id>` display, order routing to owner (add reseller `contact`/WeChat), KMTY moderation | R2 (photos), D1 |
| **2 — Rich media** | Video upload/serve, galleries, quotas UI | R2 video (or Stream) |
| **3 — Consignment** | Offers + accept/decline + commission %, cross-display, consignment routing, line-item ledger | — |
| **4 — Polish** | Settlement statements, analytics, notifications (WeChat/email), session-token auth | — |

Feature B (Phase 3) depends on Feature A existing. Phase 1 alone is already a shippable,
valuable increment.

---

## 13. Risks & open questions

- **Media cost/perf in China** — the biggest UX risk; mitigated by caps + possible mirror.
- **Commission complexity** — multi-party splits + first-touch interaction; mitigated by the
  per-line ledger and the explicit table in §6. Needs careful test coverage.
- **Moderation load** — approving every product is manual work for KMTY; consider trusted-
  reseller fast-track later.
- **Scope creep toward a real marketplace** — payments/escrow/disputes are explicitly out of
  scope; keep it inquiry + offline settlement.
- **KV → D1 migration** — additive (new tables), existing flows untouched; low risk if resellers
  stay in KV.

---

## 14. Decisions needed from you

Each has a recommended default so silence = we proceed with the default.

| # | Decision | Recommended default |
|---|---|---|
| **D1** | Who fulfils reseller-owned products? | The **reseller** fulfils their own; KMTY fulfils only Constellation/KMTY products. |
| **D2** | Video hosting | **R2 + strict caps** (length/size + poster) for MVP; consider Stream later. |
| **D3** | KMTY platform fee on reseller/consignment sales | Build the lever, **default 0%**. |
| **D4** | Moderate reseller products before they go live? | **Yes**, approval step for MVP. |
| **D5** | Consignment scope + commission granularity | Owner picks **all-or-selected** + one default %, optional per-product override. |
| **D6** | Show product prices to customers? | **No** — keep inquiry-only; ref price internal. |
| **D7** | Multi-item cart, and does stock auto-decrement? | **One product per order** for MVP; quantity **advisory** (no auto-decrement) at first. |
| **D8** | Adopt Cloudflare D1? | **Yes** for the new relational entities; resellers stay in KV. |
| **D9** | Introduce session-token auth + salted hashing? | **Session token yes** (needed for uploads); salted hashing later. |
| **D10** | Settlement stays offline (ledger only, no payments)? | **Yes** — confirm. |

Tell me your calls on D1–D10 (or just the ones you disagree with) and I'll turn this into a
build plan for Phase 1.
