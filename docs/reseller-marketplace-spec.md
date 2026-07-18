# Reseller Marketplace & Consignment — Product & Design Spec

**Status:** Draft v2 for review · **Scope:** `order.kmtyorchid.com` (+ hosting move to Aliyun)
**Author:** engineering · **Last updated:** 2026-07-15

> Planning document. No code yet. Sections marked **⟡ DECISION** need your input —
> each has a recommended default, and silence = we proceed with the default.
>
> **v2 adds:** Aliyun-first hosting (post-ICP), seller service commitments &
> the "responsible party" rule, star ratings routed to the actual goods owner,
> certified-buyer photo reviews (5-day window), buyer-entered delivery date,
> a loophole/abuse analysis (§14), and a "go-to app" feature roadmap (§15).

---

## 0. TL;DR

Four new capabilities on the reseller order system:

- **A. Reseller product catalog.** Each reseller lists their *own* products — optional
  photos/videos plus structured specs (grade, size, flower count, quantity) — shown on their
  branded `/r/<id>` page alongside the existing KMTY Constellation flow.
- **B. Inter-reseller consignment.** A reseller requests to carry another reseller's products.
  The owner accepts/declines and sets a commission % for sales through the requestor's page.
- **C. Service commitments & responsibility.** Sellers publish service terms (shipping
  included, X% quality-assurance guarantee, …). **The responsible party for an order is always
  the reseller the buyer ordered from** (the storefront) — even for consigned goods.
- **D. Ratings & certified-buyer reviews.** Buyers star-rate products — **ratings always
  attach to the actual owner of the goods**, never an intermediary storefront. Certified
  buyers can post comments and photos of received goods (photos only within **5 days of the
  delivery date**, which the buyer enters when confirming receipt).

**Hosting changes (post-ICP):** resellers and their customers are 100% in mainland China, so
once the `kmtyorchid.com` ICP filing passes at Aliyun, the whole system moves to Aliyun
(ECS/OSS/CDN). That replaces the Cloudflare-specific picks from v1: **OSS instead of R2,
SQLite/RDS instead of D1, Node on ECS instead of Workers, DirectMail instead of Resend**, and
unlocks China-native services (SMS OTP, content moderation, privacy numbers).

Everything stays **inquiry-only** (no online payments; deals close offline over WeChat).

---

## 1. Where we're starting from (current system)

Grounding so the spec is concrete. Today the worker (`_worker.js`, KV namespace `KMTY_CONFIG`)
has:

| Thing | How it works today |
|---|---|
| **Hostnames** | Only two hostnames exist: `www`/apex (marketing site) and `order.kmtyorchid.com` (order system). `/r/<id>`, `/admin`, `/reseller`, `/stock` are **paths** on `order.`, not subdomains. |
| **Products** | Exactly one "product": the Constellation mix-your-own configurator. No catalog. |
| **Resellers** | `rs:<id>` = `{ name, company, companyEn, footer, logo, passHash, rate, price, created }`. Logo is base64 (≤400 KB) inside the KV value. |
| **Auth** | Admin: shared `x-admin-pass`. Reseller: `x-reseller-id` + `x-reseller-pass`, SHA-256 compared on every request (no sessions, no salt). |
| **Orders** | `ord:<credited>:<ts>-<id>` = `{ id, reseller, credited, name, phone, qty, date, ts, recipe, mix, m }`. Inquiry-only: buyer saves a card and sends it to WeChat to close the deal offline. No further order states exist. |
| **Commission** | First-touch by phone (`ref:<phone>`), bound **at order placement**: the first reseller to refer a phone keeps credit for that customer forever. Payout = `rate% × qty × price`. |
| **Branding** | `/r/<id>` and `/order` serve the root page; branding fetched client-side from `/api/reseller?id=`. |
| **Hosting** | Cloudflare Pages Advanced Mode, single-file worker, KV. China-reachable but served from overseas edge. |

Assumptions that break with this feature set: media-in-KV, one-credit-per-order commission,
no order lifecycle after placement, and no buyer identity at all.

---

## 2. Goals / non-goals

**Goals**
- Resellers self-manage a catalog with optional rich media.
- Resellers extend their catalog via consignment with owner-controlled commission.
- Clear, systematic responsibility: the buyer always knows who they're dealing with, and
  service promises bind that party.
- Trust loop: verified-purchase ratings, photo reviews, and service terms that make the
  platform the credible place to buy phalaenopsis.
- Orders route correctly; every sale's commission is tracked and settleable.
- KMTY retains oversight (moderation + full ledger).
- Mainland-first performance (Aliyun hosting) once ICP passes.

**Non-goals (for now)**
- Online checkout / payment processing / escrow.
- Public pricing or a price-comparison marketplace.
- Logistics *integration* (structured logistics fields are in scope; carrier APIs are not).
- Auto-translation of reseller-entered content.

---

## 3. Roles & the responsibility rule

| Role | Abilities |
|---|---|
| **KMTY admin** | Moderate products/reviews/photos; view all agreements + full ledger; set platform policy; force-unlist; void fraudulent orders/reviews. |
| **Reseller (owner)** | CRUD own products + media; receive/accept/decline consignment requests and set commission %; see who carries their products; supply goods for consigned sales. Receives the **product ratings** for their goods. |
| **Reseller (storefront)** | Sell own + consigned products on `/r/<id>`; publish a **service profile**; is the **responsible party** for every order placed on their page. |
| **Buyer** | Browse catalog; place inquiry-orders; confirm delivery (enters **delivery date**); star-rate products; post comments; upload photos of received goods within 5 days of delivery. |

**⟛ The responsibility rule (decided):** for any order, the **responsible party is the
reseller the buyer placed the order with** — the storefront whose page (and WeChat) took the
order — *not* the goods owner, if they differ. Service commitments, quality guarantees, and
dispute handling bind the storefront. The goods owner's obligations (supplying/drop-shipping
per the consignment agreement) run to the storefront, not to the buyer.

**⟛ The rating rule (decided):** product star ratings and reviews always attach to the
**product and its actual owner**, aggregated across every storefront that sold it. An
intermediary storefront neither inherits nor dilutes the owner's product score. (The
storefront's *service* quality is a different axis — see D13.)

---

## 4. Feature A — Reseller product catalog

### 4.1 Product model

A **Product** belongs to one reseller (`ownerId`). Fields:

| Field | Type | Notes |
|---|---|---|
| `id` | string | short unique id |
| `ownerId` | string | FK → reseller |
| `title` | string | reseller-entered |
| `description` | text, optional | free text |
| `grade` | enum + custom | presets Special / A / B / C; custom label allowed |
| `sizeSpec` | enum | cup sizes 1.7″ / 2.0″ / 2.5″ / 2.8″ / 3.0″ / 3.5″ / 3.8″ |
| `flowerCount` | integer | spikes/blooms per plant |
| `quantity` | integer | advisory stock (no auto-decrement in MVP — D7) |
| `refPrice` | number, optional | internal; never shown to buyers; commission basis |
| `media[]` | array | ordered photo/video refs (§4.2); may be empty |
| `status` | enum | `draft → pending_review → active → paused / out_of_stock / rejected` |
| `rating` | derived | avg stars + count, aggregated across all storefronts (§7) |
| `created`, `updated` | ts | |

See §15 for richer phalaenopsis taxonomy (variety, colour, stage) — recommended Phase 1 if
cheap, else Phase 2.

### 4.2 Media — storage, upload, serving

- **Storage: Aliyun OSS** (was R2 in v1). Objects keyed
  `media/<resellerId>/<productId>/<uuid>.<ext>`. Served through **Aliyun CDN** with mainland
  edge nodes — fast for the actual audience.
- **Upload: policy-signed direct-to-OSS POST.** Browser uploads straight to OSS using a
  short-lived signed policy that hard-caps `content-length-range` and content-type — the app
  server never proxies file bytes. Flow: portal asks server → server validates reseller +
  quota, returns signed policy scoped to that reseller's prefix → browser POSTs file → browser
  tells server "attach object X to product Y".
- **Photos:** client-side downscale (≤2000 px, ~85%, target <400 KB). Thumbnails via **OSS
  image processing** URL params (`?x-oss-process=image/resize,w_480`) — no separate image
  service needed.
- **Video (⟡ D2):** OSS + strict caps for MVP — length ≤ ~30 s, size ≤ ~20 MB, client-captured
  poster frame, `Range` streaming via CDN. (Aliyun VOD/媒体处理 is the Stream-equivalent
  upgrade if video becomes central.)
- **Quotas per reseller:** max products, max media/product, total storage cap, per-file caps —
  enforced at policy-sign time.

### 4.3 Reseller portal — product management

Extend `/reseller` with a **"My products"** tab: list with status badges; create/edit form
(specs + media uploader with drag-drop, reorder, delete, poster capture); publish →
`pending_review` (moderation on, D4) → `active`; quota meter.

### 4.4 Storefront display (`/r/<id>`)

- Responsive product grid → detail view; swipeable gallery, lazy-loaded; poster-first video.
- Shows grade · size · flower count · availability · **star rating** · the storefront's
  **service strip** (§6). **No prices** (D6).
- "Order this" feeds the existing save-card → WeChat flow, tagged with the product.
- Constellation configurator remains a featured item.

### 4.5 Order routing (updated for the responsibility rule)

Every order records `storefrontId` (= **responsible party**) and, per line, `ownerId`
(goods owner). The save-card "send to WeChat" step always points at the **storefront's**
WeChat/contact — the buyer's counterparty is the page they bought from. Resellers therefore
need new `contact` / `wechatId` fields. For consigned lines the owner is notified as
supplier (drop-ship by default — D1); their duty runs to the storefront. KMTY-product
(Constellation) orders keep routing to KMTY as today.

---

## 5. Feature B — Inter-reseller consignment

### 5.1 Concept

Reseller **A** (storefront) requests to display reseller **B**'s (owner's) products. B
accepts/declines; on accept B sets the **commission %** A earns on each sale of B's goods
through A's page. B supplies the goods; A is the buyer-facing responsible party (§3).

### 5.2 Offer lifecycle

```
A creates request ─▶ pending ─▶ B accepts (sets commission %, scope) ─▶ active
                            └─▶ B declines ─▶ rejected
active ─▶ paused (either party) ─▶ active
active ─▶ revoked (either party)   [B's products vanish from A's page]
```

Fields: `id, requestorId (A), ownerId (B), status, commissionPct, scope, message, created,
decidedAt`. New requests appear in an in-portal **Requests inbox** + WeCom/WeChat ping (§15).

### 5.3 Scope & commission granularity — ⟡ D5

On accept, B picks **scope** (all current+future products, or a selected set) and a **default
commission %**, with optional per-product overrides. The simple case (everything, one %) is
one tap.

### 5.4 Cross-display

Active + in-scope products of B appear in A's catalog. The buyer-facing view does **not** name
B (A's page, A's brand, A's service terms) — but the product's **rating is B's product rating**
(the aggregate travels with the product; the owner's identity is not printed on it). Internal
records always carry `ownerId`. Guardrails: no re-consignment (A can't consign B's goods to C);
pausing a product or the offer removes it from A's page promptly.

### 5.5 Consignment order flow

Buyer orders B's product on A's page →
- Buyer's counterparty: **A** (card → A's WeChat; A's service terms govern).
- Supply notification → **B** (drop-ships per agreement; obligation to A).
- Ledger: A earns `commissionPct × refPrice × qty`; B keeps the remainder (minus optional
  platform fee, D3). A sees consignment income; B sees a supply order + their product rating
  accrues from the eventual review.

---

## 6. Feature C — Service commitments (seller services)

Each reseller publishes a **service profile** displayed on their storefront header and on
every product detail page they sell (own or consigned — the profile is the storefront's,
because the storefront is the responsible party):

| Field | Type | Display example |
|---|---|---|
| `shippingIncluded` | bool + note | "包邮 Shipping included (Yunnan cold-chain)" |
| `qaRate` | percent X | "95% quality-assurance guarantee" |
| `replacePolicy` | short text | "Transit-damage units replaced/credited" |
| `invoice` | bool | "可开发票 Invoice available" |
| `minOrder` | integer | "MOQ 50 units" |
| `shipsFrom` | region | "Ships from Kunming" |
| `carrierNote` | short text | "德邦物流 / SF cold chain" |
| `terms` | text, moderated | anything else |

**QA guarantee semantics (formalised — flag if you meant it differently):** `qaRate = X%`
means the responsible party guarantees at least X% of units arrive in good condition. The
defect/death **allowance** is `floor((100−X)% × qty)`; the responsible party
compensates/replaces the defective quantity **beyond** that allowance. Claims require photo
evidence uploaded within the same 5-day post-delivery window as reviews (§7.4), which keeps
one evidence pipeline. The guarantee text is rendered from a **fixed template** (four
languages) so wording is uniform and unambiguous — free-text guarantees invite disputes.

Structured badges (not free text) are searchable/filterable and translatable. The profile is
versioned: an order snapshots the service terms in force at order time, so later edits don't
rewrite past promises.

---

## 7. Feature D — Ratings, reviews & certified buyers

### 7.1 Order lifecycle (new)

The current system ends at "order placed". Ratings need truth about whether a deal actually
happened, so orders gain states:

```
placed ──(storefront confirms the deal closed offline)──▶ completed
completed ──(buyer confirms receipt + enters DELIVERY DATE)──▶ delivered
placed/completed ──(admin/storefront, e.g. spam)──▶ void
```

- **`completed`** is set by the responsible reseller in their portal ("deal done"). They're
  motivated: only completed orders can ever produce a review.
- **`delivered`** is set by the **buyer**, who enters the **delivery date** (the new buyer
  field). Constraints: `orderDate ≤ deliveryDate ≤ today`, set once; the storefront can flag a
  wrong date for admin correction. (The existing order `date` field — the desired/pickup date
  chosen at order time — is unrelated and stays.)
- **Certified buyer** = the buyer on an order that is both `completed` and `delivered`.
  Verification MVP: phone match against the order (enter the phone that placed it);
  upgrade: Aliyun SMS OTP (⟡ D12).

### 7.2 Star ratings

- 1–5 stars, one review per order (MVP has one product per order — D7).
- Only certified buyers, within **60 days** of delivery (stars/text window — ⟡ D15; the
  requirement fixes only the photo window).
- **Routing:** the rating attaches to `(productId, ownerId)` — the actual goods owner —
  regardless of which storefront sold it (§3 rating rule). Aggregates shown: per product
  (avg + count, everywhere the product appears) and per owner (weighted across their
  products, on their own storefront).

### 7.3 Comments (text reviews)

Optional text (≤1000 chars) with the stars. Moderated **before publication** (§11). Displayed
on the product detail page: masked buyer (`王**`, `138****1234`), "certified buyer ✓" badge,
date, stars, text, photos. The selling storefront is not named on other storefronts' pages.

### 7.4 Photo uploads — the 5-day rule

- Certified buyers may attach photos of the received goods **only while
  `now ≤ deliveryDate + 5 days`** (server-enforced; also capped at 5 days from the moment
  delivery was confirmed, so a back-dated entry can't extend the window — §14 L2).
- Caps: ≤6 photos, client-compressed like product media, same OSS policy-signed upload with
  a buyer-scoped prefix `reviews/<orderId>/…`.
- Photos are moderated before publication and double as **claim evidence** for the QA
  guarantee (§6) — one window, one pipeline, and it matches the trade norm of photographing
  problems immediately on arrival.

### 7.5 Entry point

The save-card already in the flow gains a short review URL + QR
(`order.kmtyorchid.com/review?o=<orderId>`); the storefront page also gets a "rate your
order" link (enter phone → list that phone's completed orders). Seller can nudge from their
portal ("request review" → copies a WeChat-ready message with the link).

---

## 8. Commission & settlement

Unchanged in principle from v1: move from one-credit-per-order to a **line-item ledger**
`{ orderId, lineId, fromParty, toParty, basis, pct, amount, type, status }`.

| # | Sale | Responsible party | Supplier | Commission |
|---|---|---|---|---|
| 1 | Constellation via a reseller page | KMTY | KMTY | KMTY → first-touch reseller (`rate% × qty × price`) — unchanged |
| 2 | B's own product via B's page | B | B | none (minus optional platform fee, D3) |
| 3 | B's product via A's page | **A** | B | B → A (`commissionPct × qty × refPrice`), minus optional platform fee |
| 4 | Mixed order | per line | per line | computed per line item |

- First-touch (customer-level) applies only to KMTY products; consignment (product-level)
  applies to reseller products. Different axes; never stacked on one line.
- **⟡ D16 (new):** bind first-touch credit at **`completed`** rather than at placement, and
  expire it after 12 months of inactivity — closes the phone-squatting loophole (§14 L6).
- Settlement stays **offline / ledger-only** (D10). Because deals close in WeChat, the ledger
  is based on `refPrice` unless a party records the **actual deal amount** on the order
  (optional field, two-party confirm — §15 F-12) which then re-bases that entry.

---

## 9. Hosting & architecture — Aliyun (post-ICP)

### 9.1 The question, answered

Once the ICP filing for `kmtyorchid.com` passes, **yes — everything can and should move to
Aliyun**: the filing covers the registered domain and *all* its subdomains, so `www`, apex,
`order.` (and any future subdomain) are covered by the one 备案 — no separate filing per
subdomain. `/r/…` and `/admin` are just paths and move with `order.`. Only **two hostnames**
actually migrate.

Post-approval obligations: display the 备案号 in the site footer (linked to
`beian.miit.gov.cn`), file 公安备案 within 30 days of going live on Aliyun, and keep the
site's nature consistent with a non-commercial (非经营性) filing — which inquiry-only,
no-online-payment operation supports. If online payments ever come in, revisit the
EDI/经营性 licence question first.

### 9.2 Target stack — ⟡ D11

| Concern | v1 (Cloudflare) | v2 target (Aliyun) |
|---|---|---|
| Static pages | Pages | OSS static hosting behind CDN (or Caddy on the ECS) |
| API runtime | Workers | **Node (Hono) on one small ECS** (2 vCPU/2–4 GB) — recommended; alt: Function Compute serverless |
| Key-value / relational | KV + D1 | **SQLite on the ECS** (same schema as the v1 D1 sketch), nightly backup to OSS; alt: RDS Serverless MySQL |
| Media | R2 | **OSS + CDN**, policy-signed direct uploads, image-processing URLs |
| Outbound email | Resend | **DirectMail** (发信域名 e.g. `mail.kmtyorchid.com` — additive DNS records only; the `@` MX for Netease mail is untouched). Resend kept as fallback until cutover; cross-border API calls from mainland are unreliable, so don't keep Resend as the primary from Aliyun. |
| TLS | CF auto | Caddy auto-ACME or free Aliyun DV certs |
| New unlocks | — | SMS OTP (短信服务), content moderation (内容安全), privacy numbers (隐私号), WeCom webhooks |

Recommendation: the **single-ECS + SQLite + OSS** shape. It preserves the "deliberately
simple, one file, no build" ethos (one Node process), SQLite maps 1:1 onto the relational
schema, and B2B volumes are nowhere near its limits. Serverless (FC + RDS) trades ops-free
for more moving parts — fine alternative if you prefer zero server maintenance.

### 9.3 Migration plan (Phase 0)

1. Stand up ECS + OSS + CDN; port the two workers (`_worker.js` order system, `site-worker.js`
   lead endpoint) to one Node app — the fetch-handler code moves almost verbatim; KV calls
   become SQLite reads/writes.
2. Export KV (`config`, `rs:*`, `ord:*`, `ref:*`, `lead:*`) via wrangler → import to SQLite;
   decode base64 logos → OSS objects.
3. Verify against the ECS IP directly (pre-DNS), including the lead-mail path via DirectMail.
4. DNS stays at 凡科 (**the `@` MX records are never touched**): repoint `www`, apex and
   `order` CNAMEs to the Aliyun CDN domains one host at a time. Cloudflare stays live
   throughout = instant rollback by re-pointing.
5. Add 备案号 footer; file 公安备案; then decommission the Cloudflare projects and delete the
   API token (standing housekeeping).

China performance concerns from v1 (§10, overseas-edge media) largely disappear: media now
serves from mainland CDN edges. Client-side compression and video caps stay anyway — rural
bandwidth and cost.

---

## 10. Data model (SQLite / RDS)

```
resellers      (id, name, company, company_en, footer, logo_key, pass_hash, rate, price,
                contact_wechat, services_json, verified, created)          ← ported from KV rs:*
products       (id, owner_id, title, desc, grade, size_spec, flower_count, qty,
                ref_price, status, created, updated)
product_media  (id, product_id, kind[photo|video], oss_key, poster_key, sort, status)
offers         (id, requestor_id, owner_id, status, commission_pct, scope_json,
                message, created, decided_at)
orders         (id, storefront_id, owner_id*, product_id*, name, phone, qty, wish_date,
                recipe_json, status[placed|completed|delivered|void],
                completed_at, delivery_date, delivered_at, services_snapshot_json,
                actual_amount, created)                      *per line if carts arrive later
reviews        (id, order_id, product_id, owner_id, storefront_id, stars, text,
                status[pending|published|rejected], created)
review_media   (id, review_id, oss_key, status, sort, created)
claims         (id, order_id, storefront_id, qty_defective, photos→review_media,
                status[open|resolved|rejected], resolution, created)      ← Phase 2
ledger         (id, order_id, line_id, from_party, to_party, type, pct, basis,
                amount, status, created)
ref_touch      (phone_key, reseller_id, bound_at, expires_at)             ← ported from ref:*
```

`config` (colour catalogue) and rate-limit counters stay as a small `kv(key, value)` table.

---

## 11. Security, moderation, compliance

- **Authorization:** every write verifies ownership (A can't edit B's products or answer B's
  offers). Signed upload policies are scoped to the caller's own prefix, short-lived, and
  size/type-capped.
- **Sessions (⟡ D9):** issue a short-TTL signed session token at portal login instead of
  re-sending passwords per request; move SHA-256 → salted hash at the same time (cheap now
  that auth code is being touched in the port).
- **Buyer verification (⟡ D12):** phone-match for MVP → **Aliyun SMS OTP** once the SMS
  signature/template approval (requires the beian) is through. OTP also protects the
  delivery-confirmation step, not just reviews.
- **UGC moderation — 先审后发 (⟡ D4/D14):** all reseller media, review text and review photos
  are held until approved. Phase 1: manual admin queue. Phase 2: **Aliyun 内容安全** (text +
  image moderation API) auto-screens, humans handle flags only. This is not just brand
  safety — UGC on a China-served, beian'd domain carries real content-compliance obligations;
  keep the audit trail (who uploaded what, when, who approved) and an admin kill switch.
- **Anti-abuse:** per-reseller quotas at policy-sign time; rate limits on orders, reviews,
  offer spam; velocity flags (§14).
- **PII:** buyer names/phones masked in all public display; full contact visible only to the
  responsible party (and the supplier where drop-shipping requires it — see §14 L5).

---

## 12. KMTY admin additions

- **Products tab:** all products; approve/reject/unlist; flags.
- **Reviews & claims queue:** pending text/photos with one-tap approve/reject; velocity/fraud
  flags surfaced (same-phone patterns, §14).
- **Consignments tab:** every A↔B agreement, status, %.
- **Ledger tab:** full ledger; filter by reseller/type/period; export.
- **Policy:** platform fee %, quotas, moderation toggles, first-touch expiry.
- **Order tools:** void order, correct delivery date, void review (all audited).

---

## 13. Phasing

| Phase | Delivers | Gate |
|---|---|---|
| **0 — Aliyun port** | ECS+SQLite+OSS/CDN port of the current two workers, KV data migration, DirectMail lead mail, DNS cutover, 备案号 footer + 公安备案 | **ICP approval** (days away) |
| **1 — Catalog + trust groundwork** | Product CRUD + photo pipeline, service profiles (§6), order lifecycle (`completed`/`delivered` + delivery date), reviews with stars/text/photos (manual moderation), storefront catalog, responsible-party routing, review entry QR on save-card | Phase 0 |
| **2 — Media & automation** | Video, 内容安全 auto-moderation, SMS OTP, claims mini-flow, quotas UI, WeCom notifications, seller analytics v1 | Phase 1 |
| **3 — Consignment** | Offers + accept/decline + %, cross-display, line-item ledger, dual-axis service rating (D13), actual-amount recording | Phase 1 (2 helpful) |
| **4 — Growth** | Pre-order/futures batches, price-sheet generator, RFQ board, verification badges, privacy numbers, settlement statements | Phase 3 |

Phase 0+1 together are the shippable core. Building Phase 1 directly on Aliyun avoids writing
R2/D1 code that would be thrown away weeks later.

---

## 14. Loopholes & abuse analysis

What I'd try if I wanted to game this system, and the counter built into the design:

| # | Loophole | Mitigation |
|---|---|---|
| **L1** | **Self-boosting:** a seller places fake orders (own/friends' phones), marks them completed, "confirms delivery", posts 5★ reviews of their own goods. | Reviews require the two-sided gate (seller-completed **and** buyer-delivered) so fakes need deliberate collusion; velocity flags (same phone reviewing one seller repeatedly, bursts of first-time phones, reviewer phone matching a reseller's contact); admin void with audit; reviews show "certified buyer" only — no anonymous ratings at all. Residual risk accepted (even Taobao has this). |
| **L2** | **Window gaming:** buyer back- or forward-dates the delivery date to open/extend the 5-day photo window. | `orderDate ≤ deliveryDate ≤ today`, set once; window = `min(deliveryDate, confirmedAt) + 5d` so lying never *extends* it; storefront can dispute the date → admin corrects. |
| **L3** | **Rating misdirection:** in consignment, storefront A's bad service (slow reply, botched shipping arrangement) tanks owner B's product score — B is punished for A's failure. | The requirement routes product stars to B by design; the counter is the **dual-axis rating** (D13): product stars → owner, service stars → responsible party. Review form asks about each separately. Until D13 ships, moderation guidance: reviews that are purely service complaints on consigned goods can be reassigned/annotated by admin. |
| **L4** | **Identity leakage:** review text/photos on A's page reveal B (owner) — "bought these, box said Kunming XX Ltd" — buyer bypasses A next time. | Moderation guideline (redact identifying text), masked buyer identity, owner never printed on consignment listings. Residual risk accepted — B2B relationships always leak eventually; the commission agreement is the real protection. |
| **L5** | **Customer poaching via drop-ship:** B (supplier) sees A's customer PII on the shipping label and contacts them directly next season. | MVP: accepted risk, stated in the consignment terms (first-touch ledger still credits A for that customer's KMTY products; product-level repeat sales are B's win). Upgrade path: Aliyun **privacy numbers (隐私号)** so B gets a relay number, and/or an agreement mode where A re-ships (bad for live plants — not default). |
| **L6** | **First-touch squatting** (exists today): a reseller feeds phone numbers through fake orders to permanently claim commission on those customers. | D16: bind `ref_touch` at `completed` (not placement) and expire after 12 months of inactivity; admin visibility into bind events. |
| **L7** | **QA-guarantee ambiguity:** "95% guarantee" disputes — per order? which evidence? rounding? | Fixed template wording + explicit math (`allowance = floor((100−X)%×qty)`), evidence = photos inside the 5-day window (same pipeline), claims recorded with outcomes (Phase 2) and visible to admin; service-terms snapshot frozen per order so edits can't rewrite past promises. |
| **L8** | **Hostile photo uploads:** competitor-damaging, unrelated or illegal images in reviews. | 先审后发 (nothing publishes unmoderated), 内容安全 auto-screen in Phase 2, report button, full audit trail, buyer upload prefix scoped per order. |
| **L9** | **Phantom stock:** advisory quantities let sellers list inventory they don't have to farm inquiries. | Inquiry-only makes harm low (buyer finds out in WeChat); repeated complaints → service rating (D13) + admin unlist. Auto-decrement stays off (D7) because offline deals make true stock unknowable anyway. |
| **L10** | **Photo plagiarism:** seller C copies seller B's product photos to fake inventory quality. | Perceptual-hash near-duplicate flag at upload (cheap), report button, moderation; optional auto-watermark of uploads with the seller id (§15). |
| **L11** | **Review impersonation:** anyone who knows a buyer's phone + order id can post "their" review under phone-match MVP. | Order ids are unguessable (random), phones are semi-private; SMS OTP (D12) closes it properly — prioritise once SMS templates approve. |
| **L12** | **Ledger vs reality drift:** commissions computed on `refPrice`, but the real WeChat deal price differs → settlement disputes. | Optional actual-amount recording with two-party confirmation re-bases the ledger entry (§8, F-12); ledger entries carry a `basis` marker (`ref` vs `actual`) so everyone knows which numbers are estimates. |

---

## 15. Additional features — what makes it the go-to phalaenopsis app

Grouped; ⭐ = highest leverage for "go-to" status in this trade, cheap relative to impact.

**Trade-native (how phalaenopsis wholesale actually works)**
- **F-1 ⭐ Pre-order / futures batches (期货 · 年宵花):** the trade's rhythm is booking Spring
  Festival stock months ahead. Let owners list *future* batches — ready-week window, quantity,
  spec — and buyers place reserve inquiries. Nothing else in this niche does this well online.
- **F-2 ⭐ Phalaenopsis taxonomy + filters:** variety name, colour family, spike count (梗数),
  pot diameter (already have), stage (瓶苗/中苗/大苗/开花株 — the site's contact form already
  distinguishes seedling/potted/cut), ships-from region. Buyers filter the way the trade
  talks; also powers search and future RFQ matching.
- **F-3 ⭐ Price-sheet (报价单) generator:** the trade runs on WeChat-shared price sheets.
  Sellers keep prices private on-platform but generate a branded, dated price-sheet image
  (their products + prices they type in) to share in WeChat groups. Platform stays
  inquiry-only; sellers get their daily workflow tool — and a reason to keep the catalog
  current. Reuses the existing save-card image tech.
- **F-4 RFQ / wanted board (求购):** buyers post needs ("5000 × 3.5″ big-lip white, week 50,
  Chengdu"), matching sellers respond. Inverts liquidity; Phase 4+.

**Trust (compounding moat)**
- **F-5 ⭐ Dual-axis ratings** (D13): product stars → owner; service stars → responsible party.
  Directly resolves the consignment conflation (L3) and gives storefronts a reason to
  compete on service.
- **F-6 Seller replies:** one public, moderated reply per review — standard practice,
  humanises disputes, cheap.
- **F-7 Verified-business badge (企业认证):** reseller uploads business licence → admin
  check → badge. Chinese B2B buyers expect it; near-zero build cost.
- **F-8 Arrival-photo culture (到货实拍):** certified-buyer photos aggregate into an "arrival
  gallery" per product/seller with a count badge ("32 arrival photo sets this season") — turns
  the 5-day photo rule into a marketing asset and the strongest possible trust signal for
  live-plant quality.
- **F-9 Structured claims** (Phase 2, §6): claim → evidence photos → resolution recorded;
  outcomes feed service metrics. Turns the QA guarantee from words into a track record.

**China ops (all unlocked by the Aliyun move)**
- **F-10 ⭐ WeCom robot notifications:** new order / offer / claim / review pings straight
  into each seller's 企业微信 group via webhook — free, instant, no app needed. This is the
  single biggest daily-stickiness feature for sellers.
- **F-11 Aliyun 内容安全 auto-moderation** (D14): shrinks the manual queue to flagged items.
- **F-12 Actual-amount recording:** either party records the real deal price; the other
  confirms; ledger re-bases (closes L12).
- **F-13 Privacy numbers (隐私号)** for drop-ship labels (closes L5) — later, if poaching
  becomes real.
- **F-14 Storefront QR poster generator:** print-ready poster (logo + QR + top products) for
  market stalls (斗南 flower market culture) and WeChat Moments — reuses save-card tech.

**Analytics**
- **F-15 Seller dashboard:** views → card-saves → inquiries → completed funnel; top products;
  consignment performance (which storefronts move my goods; which suppliers convert on my
  page). Retention driver and the data backbone for D3 (platform fee) decisions later.

Recommended insertion: F-2, F-5…F-8, F-10 land in Phases 1–3 as marked; F-1, F-3, F-4,
F-13, F-14 are Phase 4 candidates; F-15 grows incrementally from Phase 2.

---

## 16. Risks

- **ICP timing/scope** — Phase 0 is gated on approval; if approval stalls, Phases 1+ can
  still be *built* against the Aliyun stack and launched on cutover day.
- **Moderation load** — 先审后发 on all UGC is real daily work until 内容安全 (Phase 2)
  automates the bulk; consider trusted-reseller fast-track later.
- **Commission complexity** — multi-party splits + first-touch interaction; mitigated by the
  per-line ledger, the §8 table, and heavy test coverage.
- **Two-sided gate friction** — reviews require seller-confirm + buyer-confirm; some sellers
  won't bother. Counter: reviews are the seller's own marketing asset (F-8), portal nudges,
  WeCom pings (F-10).
- **Scope creep toward a payments marketplace** — explicitly out; inquiry + offline
  settlement only (also keeps the beian 非经营性).

---

## 17. Decisions — status

**Carried from v1** (defaults stand unless you say otherwise):

| # | Decision | Default |
|---|---|---|
| D1 | Fulfilment/responsibility | **Revised & settled by you:** responsible party = the storefront the buyer ordered from; owner drop-ships as supplier (consignment). |
| D2 | Video hosting | OSS + strict caps (≤30 s, ≤20 MB, poster) for MVP |
| D3 | KMTY platform fee | Build the lever, default **0%** |
| D4 | Moderate products before live | **OVERRIDDEN (owner, 2026-07): no — instant publish everywhere; takedown-based moderation via the admin published-feed.** Buyer reviews (Phase 2) may still warrant 先审后发 — reconfirm then. |
| D5 | Consignment scope/commission | All-or-selected + default %, per-product override |
| D6 | Show prices to customers | **No** (inquiry-only; see F-3 price sheets) |
| D7 | Cart & stock decrement | One product/order; quantity advisory |
| D8 | Relational store | **Revised:** same schema, now SQLite-on-ECS (or RDS) instead of D1 |
| D9 | Session tokens + salted hashing | **Yes**, both, during the Phase 0 port |
| D10 | Settlement offline, ledger-only | **Yes** |

**New in v2:**

| # | Decision | Recommended default |
|---|---|---|
| **D11** | Aliyun runtime shape | **Single ECS + Node + SQLite + OSS/CDN**; DirectMail for outbound mail. (Alt: Function Compute + RDS if you want zero server ops.) |
| **D12** | Certified-buyer verification strength | **Phone-match at MVP → Aliyun SMS OTP** as soon as SMS signature/template approval (needs the beian) clears. |
| **D13** | Dual-axis rating (product ↔ service) | **Yes**, ship with Phase 3 (consignment) — product stars → owner, service stars → responsible party. |
| **D14** | Automated UGC screening (Aliyun 内容安全) | **Yes**, Phase 2; Phase 1 is a manual approve queue. |
| **D15** | Stars/text review window (photos are fixed at 5 days) | **60 days** from delivery. |
| **D16** | First-touch binding & expiry | Bind at **`completed`** (not placement) + **12-month** inactivity expiry. |

Tell me your calls (or just the ones you disagree with) and the answers to the QA-guarantee
formalisation in §6, and I'll turn this into the Phase 0 + Phase 1 build plan.
