// All API endpoints. Route table at the bottom; handlers grouped:
//   auth → seller (tenant/products/media/orders/stats) → public shop/order
//   → platform admin → compat with the old Cloudflare-worker API
//   (/api/reseller, /api/config, /api/lead) so the constellation page and
//   marketing-site form keep working after cutover to this server.
'use strict';
const C = require('./core');
const M = require('./media');

/* =============================== helpers =============================== */

function parseJson(s, dflt) { try { const v = JSON.parse(s); return v == null ? dflt : v; } catch (e) { return dflt; } }

function brandOf(t) {
  const b = parseJson(t.brand, {});
  return {
    logo: b.logo || '', banner: b.banner || '', wechatQr: b.wechatQr || '',
    accent: /^#[0-9a-fA-F]{6}$/.test(b.accent || '') ? b.accent : '#E7B7CF',
    about: b.about || '', announcement: b.announcement || '', shipsFrom: b.shipsFrom || '',
    priceMode: ['public', 'on_request', 'hidden'].includes(b.priceMode) ? b.priceMode : 'public',
    featured: Array.isArray(b.featured) ? b.featured.slice(0, 8) : [],
    modules: { constellation: !!(b.modules && b.modules.constellation) },
    footer: b.footer || '',
  };
}
function servicesOf(t) {
  const s = parseJson(t.services, {});
  return {
    shippingIncluded: !!s.shippingIncluded,
    qaRate: C.int(s.qaRate, 0, 100, 0) || 0,
    replacePolicy: String(s.replacePolicy || '').slice(0, 60),
    invoice: !!s.invoice,
    minOrder: C.int(s.minOrder, 0, 999999, 0) || 0,
    carrierNote: String(s.carrierNote || '').slice(0, 60),
  };
}
function mediaUrl(file) { return '/m/' + file; }

function productMedia(db, productId, publicOnly) {
  const rows = db.prepare('SELECT * FROM media WHERE product_id = ? ' + (publicOnly ? "AND status = 'approved' " : '') + 'ORDER BY sort, created').all(productId);
  return rows.map((m) => ({ id: m.id, url: mediaUrl(m.file), status: m.status, sort: m.sort, bytes: m.bytes }));
}

// effective unit price for a quantity given tier breaks [{min,price}]
function unitPrice(base, tiers, qty) {
  let p = base;
  const ts = (tiers || []).slice().sort((a, b) => b.min - a.min);
  for (const t of ts) if (qty >= t.min) { p = t.price; break; }
  return p;
}

function priceInfo(product, tenantBrand) {
  const mode = product.price_display === 'inherit' ? tenantBrand.priceMode : product.price_display;
  if (mode === 'public' && product.price != null) {
    return { mode: 'public', price: product.price, tiers: parseJson(product.tiers, []) };
  }
  return { mode: mode === 'public' ? 'on_request' : mode };  // public without a price set behaves as on_request
}

function tenantBySlug(db, slug) {
  return db.prepare('SELECT * FROM tenants WHERE slug = ?').get(C.safeSlug(slug));
}

/* =============================== auth =============================== */

async function signup(req, res, ctx) {
  if (!C.rateLimit('signup', C.ipOf(req), 5, 3600e3)) return C.err(res, 429, '尝试太频繁，请稍后再试');
  const d = await C.readJson(req);
  const slug = C.safeSlug(d.slug);
  const name = C.clean(d.name, 40);
  const phone = C.clean(d.phone, 24).replace(/[^\d +\-]/g, '');
  const pass = String(d.pass || '');
  if (!C.validSlug(slug)) return C.err(res, 400, '店铺代号需 3–32 位小写字母/数字，且不能是保留字');
  if (!name) return C.err(res, 400, '请填写店铺名称');
  if (phone.replace(/\D/g, '').length < 6) return C.err(res, 400, '请填写有效手机号');
  if (pass.length < 6) return C.err(res, 400, '密码至少 6 位');
  if (ctx.db.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug)) return C.err(res, 409, '该代号已被使用');
  const tid = 't_' + C.hexId(8), uid = 'u_' + C.hexId(8);
  ctx.db.prepare('INSERT INTO tenants (id,slug,name,wechat,created) VALUES (?,?,?,?,?)')
    .run(tid, slug, name, C.clean(d.wechat, 60), C.now());
  ctx.db.prepare('INSERT INTO users (id,tenant_id,phone,pass_hash,created) VALUES (?,?,?,?,?)')
    .run(uid, tid, phone, C.hashPass(pass), C.now());
  const token = C.createSession(ctx.db, { userId: uid, tenantId: tid, role: 'owner', ip: C.ipOf(req) });
  C.setSessionCookie(res, token);
  C.audit(ctx.db, { tenantId: tid, userId: uid, action: 'signup', target: slug, ip: C.ipOf(req) });
  C.json(res, { ok: true, slug });
}

async function login(req, res, ctx) {
  if (!C.rateLimit('login', C.ipOf(req), 10, 300e3)) return C.err(res, 429, '尝试太频繁，请 5 分钟后再试');
  const d = await C.readJson(req);
  const slug = C.safeSlug(d.slug);
  const t = tenantBySlug(ctx.db, slug);
  const u = t ? ctx.db.prepare("SELECT * FROM users WHERE tenant_id = ? AND role = 'owner'").get(t.id) : null;
  if (!t || !u || !C.verifyPass(d.pass, u.pass_hash)) {
    C.audit(ctx.db, { tenantId: t && t.id, actor: 'public', action: 'login_fail', target: slug, ip: C.ipOf(req) });
    return C.err(res, 401, '代号或密码不正确');
  }
  if (t.status === 'closed' || u.status !== 'active') return C.err(res, 401, '账号不可用');
  if (t.status === 'suspended') return C.err(res, 403, '店铺已被暂停，请联系平台');
  if (u.pass_hash.startsWith('s1:')) { // imported legacy hash → upgrade in place
    ctx.db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(C.hashPass(d.pass), u.id);
  }
  const token = C.createSession(ctx.db, { userId: u.id, tenantId: t.id, role: u.role, ip: C.ipOf(req) });
  C.setSessionCookie(res, token);
  C.json(res, { ok: true, slug: t.slug });
}

function logout(req, res, ctx) {
  C.destroySession(ctx.db, req);
  C.clearSessionCookie(res);
  C.json(res, { ok: true });
}

async function changePassword(req, res, ctx) {
  const S = C.seller(ctx.db, req);
  if (!S || !S.user) return C.err(res, 401, '需要登录');
  const d = await C.readJson(req);
  if (!C.verifyPass(d.cur, S.user.pass_hash)) return C.err(res, 401, '当前密码不正确');
  if (String(d.new || '').length < 6) return C.err(res, 400, '新密码至少 6 位');
  ctx.db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(C.hashPass(d.new), S.user.id);
  C.audit(ctx.db, { tenantId: S.tenant.id, userId: S.user.id, action: 'password_change', ip: C.ipOf(req) });
  C.json(res, { ok: true });
}

/* =============================== seller =============================== */

function me(req, res, ctx) {
  const S = C.seller(ctx.db, req);
  if (!S) return C.err(res, 401, '需要登录');
  const t = S.tenant, db = ctx.db;
  const brand = brandOf(t), services = servicesOf(t);
  const products = db.prepare('SELECT COUNT(*) AS n FROM products WHERE tenant_id = ?').get(t.id).n;
  const published = db.prepare("SELECT COUNT(*) AS n FROM products WHERE tenant_id = ? AND status = 'active'").get(t.id).n;
  const placed = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE tenant_id = ? AND status = 'placed'").get(t.id).n;
  const pendingReview = db.prepare("SELECT COUNT(*) AS n FROM products WHERE tenant_id = ? AND status = 'pending'").get(t.id).n;
  const day = db.prepare('SELECT views, orders FROM counters WHERE tenant_id = ? AND day = ?').get(t.id, C.today()) || { views: 0, orders: 0 };
  const storage = M.tenantBytes(db, t.id);
  C.json(res, {
    tenant: {
      id: t.id, slug: t.slug, name: t.name, company: t.company, tagline: t.tagline,
      status: t.status, verified: !!t.verified, plan: t.plan, wechat: t.wechat,
      brand, services, rate: t.rate, price: t.price,
    },
    user: S.user ? { phone: S.user.phone, role: S.user.role } : null,
    actor: S.actor,
    usage: { products, storageMb: Math.round(storage / 1048576 * 10) / 10, storageCapMb: M.LIMITS.perTenantMb },
    checklist: {
      logo: !!brand.logo, wechat: !!(t.wechat || brand.wechatQr),
      services: !!(services.shippingIncluded || services.qaRate || services.replacePolicy || services.invoice),
      product: products > 0, published: published > 0,
    },
    today: { views: day.views, orders: day.orders },
    pending: { placed, review: pendingReview },
    link: '/s/' + t.slug,
  });
}

async function updateTenant(req, res, ctx) {
  const S = C.seller(ctx.db, req);
  if (!S) return C.err(res, 401, '需要登录');
  const d = await C.readJson(req);
  const t = S.tenant;
  const name = d.name !== undefined ? C.clean(d.name, 40) : t.name;
  if (!name) return C.err(res, 400, '店铺名称不能为空');
  const company = d.company !== undefined ? C.clean(d.company, 60) : t.company;
  const tagline = d.tagline !== undefined ? C.clean(d.tagline, 60) : t.tagline;
  const wechat = d.wechat !== undefined ? C.clean(d.wechat, 60) : t.wechat;
  let brand = brandOf(t);
  if (d.brand && typeof d.brand === 'object') {
    const b = d.brand;
    brand = {
      logo: b.logo !== undefined ? String(b.logo).slice(0, 200) : brand.logo,
      banner: b.banner !== undefined ? String(b.banner).slice(0, 200) : brand.banner,
      wechatQr: b.wechatQr !== undefined ? String(b.wechatQr).slice(0, 200) : brand.wechatQr,
      accent: b.accent !== undefined && /^#[0-9a-fA-F]{6}$/.test(b.accent) ? b.accent : brand.accent,
      about: b.about !== undefined ? C.cleanText(b.about, 1200) : brand.about,
      announcement: b.announcement !== undefined ? C.clean(b.announcement, 120) : brand.announcement,
      shipsFrom: b.shipsFrom !== undefined ? C.clean(b.shipsFrom, 40) : brand.shipsFrom,
      priceMode: b.priceMode !== undefined && ['public', 'on_request', 'hidden'].includes(b.priceMode) ? b.priceMode : brand.priceMode,
      featured: Array.isArray(b.featured) ? b.featured.map(String).slice(0, 8) : brand.featured,
      modules: b.modules !== undefined ? { constellation: !!(b.modules && b.modules.constellation) } : brand.modules,
      footer: b.footer !== undefined ? C.clean(b.footer, 40) : brand.footer,
    };
    // brand media URLs must be this tenant's own files or empty
    for (const k of ['logo', 'banner', 'wechatQr']) {
      if (brand[k] && !brand[k].startsWith('/m/' + t.id + '/')) brand[k] = '';
    }
  }
  let services = servicesOf(t);
  if (d.services && typeof d.services === 'object') {
    const s = d.services;
    services = {
      shippingIncluded: s.shippingIncluded !== undefined ? !!s.shippingIncluded : services.shippingIncluded,
      qaRate: s.qaRate !== undefined ? (C.int(s.qaRate, 0, 100, 0) || 0) : services.qaRate,
      replacePolicy: s.replacePolicy !== undefined ? C.clean(s.replacePolicy, 60) : services.replacePolicy,
      invoice: s.invoice !== undefined ? !!s.invoice : services.invoice,
      minOrder: s.minOrder !== undefined ? (C.int(s.minOrder, 0, 999999, 0) || 0) : services.minOrder,
      carrierNote: s.carrierNote !== undefined ? C.clean(s.carrierNote, 60) : services.carrierNote,
    };
  }
  ctx.db.prepare('UPDATE tenants SET name=?, company=?, tagline=?, wechat=?, brand=?, services=? WHERE id = ?')
    .run(name, company, tagline, wechat, JSON.stringify(brand), JSON.stringify(services), t.id);
  C.audit(ctx.db, { tenantId: t.id, userId: S.user && S.user.id, actor: S.actor, action: 'tenant_update', ip: C.ipOf(req) });
  C.json(res, { ok: true });
}

const GRADES = ['特级', 'A级', 'B级', 'C级'];
const SIZES = ['1.7寸', '2.0寸', '2.5寸', '2.8寸', '3.0寸', '3.5寸', '3.8寸'];
const STAGES = ['瓶苗', '中苗', '大苗', '开花株'];

function readProductFields(d, existing) {
  const p = existing || {};
  const tiersIn = Array.isArray(d.tiers) ? d.tiers : parseJson(p.tiers, []);
  const tiers = tiersIn
    .map((t) => ({ min: C.int(t && t.min, 1, 999999, null), price: C.num(t && t.price, 0, 999999, null) }))
    .filter((t) => t.min != null && t.price != null)
    .sort((a, b) => a.min - b.min)
    .slice(0, 6);
  return {
    title: d.title !== undefined ? C.clean(d.title, 60) : p.title,
    descr: d.descr !== undefined ? C.cleanText(d.descr, 2000) : (p.descr || ''),
    grade: d.grade !== undefined ? (GRADES.includes(d.grade) ? d.grade : C.clean(d.grade, 12)) : (p.grade || ''),
    size_spec: d.sizeSpec !== undefined ? (SIZES.includes(d.sizeSpec) ? d.sizeSpec : C.clean(d.sizeSpec, 12)) : (p.size_spec || ''),
    flower_count: d.flowerCount !== undefined ? (C.int(d.flowerCount, 0, 99, 0) || 0) : (p.flower_count || 0),
    stage: d.stage !== undefined ? (STAGES.includes(d.stage) ? d.stage : C.clean(d.stage, 12)) : (p.stage || ''),
    variety: d.variety !== undefined ? C.clean(d.variety, 40) : (p.variety || ''),
    color_family: d.colorFamily !== undefined ? C.clean(d.colorFamily, 20) : (p.color_family || ''),
    qty: d.qty !== undefined ? (C.int(d.qty, 0, 9999999, 0) || 0) : (p.qty || 0),
    price: d.price !== undefined ? C.num(d.price, 0, 9999999, null) : (p.price != null ? p.price : null),
    tiers: JSON.stringify(tiers),
    price_display: d.priceDisplay !== undefined && ['inherit', 'public', 'on_request', 'hidden'].includes(d.priceDisplay) ? d.priceDisplay : (p.price_display || 'inherit'),
    featured: d.featured !== undefined ? (d.featured ? 1 : 0) : (p.featured || 0),
  };
}

function listProducts(req, res, ctx) {
  const S = C.seller(ctx.db, req);
  if (!S) return C.err(res, 401, '需要登录');
  const rows = ctx.db.prepare("SELECT * FROM products WHERE tenant_id = ? AND status != 'deleted' ORDER BY sort, created DESC").all(S.tenant.id);
  C.json(res, {
    products: rows.map((p) => ({
      id: p.id, title: p.title, descr: p.descr, grade: p.grade, sizeSpec: p.size_spec,
      flowerCount: p.flower_count, stage: p.stage, variety: p.variety, colorFamily: p.color_family,
      qty: p.qty, price: p.price, tiers: parseJson(p.tiers, []), priceDisplay: p.price_display,
      status: p.status, featured: !!p.featured, created: p.created, updated: p.updated,
      media: productMedia(ctx.db, p.id, false),
    })),
  });
}

async function createProduct(req, res, ctx) {
  const S = C.seller(ctx.db, req);
  if (!S) return C.err(res, 401, '需要登录');
  const count = ctx.db.prepare('SELECT COUNT(*) AS n FROM products WHERE tenant_id = ?').get(S.tenant.id).n;
  if (count >= 500) return C.err(res, 400, '已达商品数量上限');
  const d = await C.readJson(req);
  const f = readProductFields(d, null);
  if (!f.title) return C.err(res, 400, '请填写商品名称');
  const id = 'p_' + C.hexId(8);
  ctx.db.prepare(`INSERT INTO products (id,tenant_id,title,descr,grade,size_spec,flower_count,stage,variety,color_family,qty,price,tiers,price_display,featured,created,updated)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, S.tenant.id, f.title, f.descr, f.grade, f.size_spec, f.flower_count, f.stage, f.variety, f.color_family, f.qty, f.price, f.tiers, f.price_display, f.featured, C.now(), C.now());
  C.audit(ctx.db, { tenantId: S.tenant.id, userId: S.user && S.user.id, actor: S.actor, action: 'product_create', target: id, detail: f.title, ip: C.ipOf(req) });
  C.json(res, { ok: true, id });
}

async function updateProduct(req, res, ctx, m) {
  const S = C.seller(ctx.db, req);
  if (!S) return C.err(res, 401, '需要登录');
  const p = ctx.db.prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?').get(m[1], S.tenant.id);
  if (!p) return C.err(res, 404, '商品不存在');
  const d = await C.readJson(req);
  const f = readProductFields(d, p);
  if (!f.title) return C.err(res, 400, '请填写商品名称');
  ctx.db.prepare(`UPDATE products SET title=?,descr=?,grade=?,size_spec=?,flower_count=?,stage=?,variety=?,color_family=?,qty=?,price=?,tiers=?,price_display=?,featured=?,updated=? WHERE id = ?`)
    .run(f.title, f.descr, f.grade, f.size_spec, f.flower_count, f.stage, f.variety, f.color_family, f.qty, f.price, f.tiers, f.price_display, f.featured, C.now(), p.id);
  C.audit(ctx.db, { tenantId: S.tenant.id, userId: S.user && S.user.id, actor: S.actor, action: 'product_update', target: p.id, detail: JSON.stringify({ qty: f.qty, price: f.price }).slice(0, 200), ip: C.ipOf(req) });
  C.json(res, { ok: true });
}

async function publishProduct(req, res, ctx, m) {
  const S = C.seller(ctx.db, req);
  if (!S) return C.err(res, 401, '需要登录');
  const p = ctx.db.prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?').get(m[1], S.tenant.id);
  if (!p) return C.err(res, 404, '商品不存在');
  const d = await C.readJson(req);
  let to = null;
  const auto = (ctx.db.prepare("SELECT value FROM kv WHERE key = 'autoApprove'").get() || {}).value === '1';
  if (d.op === 'publish' && (p.status === 'draft' || p.status === 'rejected' || p.status === 'paused')) to = p.status === 'paused' ? 'active' : (auto ? 'active' : 'pending');
  if (d.op === 'pause' && (p.status === 'active' || p.status === 'pending')) to = 'paused';
  if (!to) return C.err(res, 400, '当前状态不支持该操作');
  ctx.db.prepare('UPDATE products SET status = ?, updated = ? WHERE id = ?').run(to, C.now(), p.id);
  if (to === 'active') ctx.db.prepare("UPDATE media SET status = 'approved' WHERE product_id = ? AND status = 'pending'").run(p.id);
  C.audit(ctx.db, { tenantId: S.tenant.id, userId: S.user && S.user.id, actor: S.actor, action: 'product_' + d.op, target: p.id, ip: C.ipOf(req) });
  C.json(res, { ok: true, status: to });
}

function deleteProduct(req, res, ctx, m) {
  const S = C.seller(ctx.db, req);
  if (!S) return C.err(res, 401, '需要登录');
  const p = ctx.db.prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?').get(m[1], S.tenant.id);
  if (!p) return C.err(res, 404, '商品不存在');
  const files = ctx.db.prepare('SELECT file FROM media WHERE product_id = ?').all(p.id);
  ctx.db.prepare('DELETE FROM media WHERE product_id = ?').run(p.id);
  ctx.db.prepare('DELETE FROM products WHERE id = ?').run(p.id);
  for (const f of files) M.removeFile(ctx.dataDir, f.file);
  C.audit(ctx.db, { tenantId: S.tenant.id, userId: S.user && S.user.id, actor: S.actor, action: 'product_delete', target: p.id, detail: p.title, ip: C.ipOf(req) });
  C.json(res, { ok: true });
}

/* ------------- uploads ------------- */

async function upload(req, res, ctx, m, q) {
  const S = C.seller(ctx.db, req);
  if (!S) return C.err(res, 401, '需要登录');
  if (!C.rateLimit('upload', S.tenant.id, 120, 3600e3)) return C.err(res, 429, '上传太频繁');
  if (M.tenantBytes(ctx.db, S.tenant.id) > M.LIMITS.perTenantMb * 1048576) return C.err(res, 400, '存储空间已满（' + M.LIMITS.perTenantMb + 'MB）');
  let buf;
  try { buf = await C.readBody(req, M.LIMITS.photo); } catch (e) { return C.err(res, 413, '图片过大（压缩后需 ≤3MB）'); }
  const saved = M.saveBuffer(ctx.dataDir, S.tenant.id, buf);
  if (saved.error) return C.err(res, 400, saved.error);
  const forWhat = q.get('for') || 'product';
  const w = C.int(q.get('w'), 0, 20000, 0) || 0, h = C.int(q.get('h'), 0, 20000, 0) || 0;

  if (forWhat === 'brand') {
    const slot = ['logo', 'banner', 'wechatQr'].includes(q.get('slot')) ? q.get('slot') : null;
    if (!slot) return C.err(res, 400, 'bad slot');
    const id = 'm_' + C.hexId(8);
    // brand assets are auto-approved: the tenant-approval gate is the human
    // check for storefront identity; per-item review is for catalog volume.
    ctx.db.prepare('INSERT INTO media (id,tenant_id,product_id,file,bytes,w,h,status,created) VALUES (?,?,NULL,?,?,?,?,?,?)')
      .run(id, S.tenant.id, saved.file, saved.bytes, w, h, 'approved', C.now());
    const brand = brandOf(S.tenant);
    const old = brand[slot];
    brand[slot] = mediaUrl(saved.file);
    ctx.db.prepare('UPDATE tenants SET brand = ? WHERE id = ?').run(JSON.stringify(brand), S.tenant.id);
    if (old && old.startsWith('/m/')) {
      const oldRow = ctx.db.prepare('SELECT * FROM media WHERE tenant_id = ? AND file = ?').get(S.tenant.id, old.slice(3));
      if (oldRow) { ctx.db.prepare('DELETE FROM media WHERE id = ?').run(oldRow.id); M.removeFile(ctx.dataDir, oldRow.file); }
    }
    C.audit(ctx.db, { tenantId: S.tenant.id, userId: S.user && S.user.id, actor: S.actor, action: 'brand_media', target: slot, ip: C.ipOf(req) });
    return C.json(res, { ok: true, url: brand[slot] });
  }

  const p = ctx.db.prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?').get(String(q.get('product') || ''), S.tenant.id);
  if (!p) { M.removeFile(ctx.dataDir, saved.file); return C.err(res, 404, '商品不存在'); }
  const nMedia = ctx.db.prepare('SELECT COUNT(*) AS n FROM media WHERE product_id = ?').get(p.id).n;
  if (nMedia >= 10) { M.removeFile(ctx.dataDir, saved.file); return C.err(res, 400, '每个商品最多 10 张图'); }
  const id = 'm_' + C.hexId(8);
  // photos added to an already-live product go straight to review (先审后发);
  // photos on drafts ride along with the product's own review at publish time.
  const status = p.status === 'active' ? 'pending' : 'pending';
  ctx.db.prepare('INSERT INTO media (id,tenant_id,product_id,file,bytes,w,h,status,sort,created) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(id, S.tenant.id, p.id, saved.file, saved.bytes, w, h, status, nMedia, C.now());
  C.audit(ctx.db, { tenantId: S.tenant.id, userId: S.user && S.user.id, actor: S.actor, action: 'media_upload', target: p.id, ip: C.ipOf(req) });
  C.json(res, { ok: true, media: { id, url: mediaUrl(saved.file), status, sort: nMedia } });
}

function deleteMedia(req, res, ctx, m) {
  const S = C.seller(ctx.db, req);
  if (!S) return C.err(res, 401, '需要登录');
  const row = ctx.db.prepare('SELECT * FROM media WHERE id = ? AND tenant_id = ?').get(m[1], S.tenant.id);
  if (!row) return C.err(res, 404, '不存在');
  ctx.db.prepare('DELETE FROM media WHERE id = ?').run(row.id);
  M.removeFile(ctx.dataDir, row.file);
  C.json(res, { ok: true });
}

async function sortMedia(req, res, ctx) {
  const S = C.seller(ctx.db, req);
  if (!S) return C.err(res, 401, '需要登录');
  const d = await C.readJson(req);
  const ids = Array.isArray(d.ids) ? d.ids.map(String).slice(0, 20) : [];
  const upd = ctx.db.prepare('UPDATE media SET sort = ? WHERE id = ? AND tenant_id = ? AND product_id = ?');
  ids.forEach((mid, i) => upd.run(i, mid, S.tenant.id, String(d.productId || '')));
  C.json(res, { ok: true });
}

/* ------------- orders (seller pipeline) ------------- */

function listOrders(req, res, ctx, m, q) {
  const S = C.seller(ctx.db, req);
  if (!S) return C.err(res, 401, '需要登录');
  const tab = String(q.get('tab') || 'all');
  const query = C.clean(q.get('q') || '', 40);
  let sql = 'SELECT * FROM orders WHERE tenant_id = ?';
  const args = [S.tenant.id];
  if (['placed', 'talking', 'completed', 'delivered', 'void'].includes(tab)) { sql += ' AND status = ?'; args.push(tab); }
  if (query) { sql += ' AND (phone LIKE ? OR name LIKE ? OR code LIKE ?)'; args.push('%' + query + '%', '%' + query + '%', '%' + query.toUpperCase() + '%'); }
  sql += ' ORDER BY created DESC LIMIT 500';
  const rows = ctx.db.prepare(sql).all(...args);
  const counts = {};
  for (const s of ['placed', 'talking', 'completed', 'delivered']) {
    counts[s] = ctx.db.prepare('SELECT COUNT(*) AS n FROM orders WHERE tenant_id = ? AND status = ?').get(S.tenant.id, s).n;
  }
  C.json(res, {
    orders: rows.map((o) => ({
      id: o.id, code: o.code, kind: o.kind, name: o.name, phone: o.phone, qty: o.qty,
      wishDate: o.wish_date, note: o.note, recipe: o.recipe, snap: parseJson(o.msnap, {}),
      status: o.status, deliveryDate: o.delivery_date, created: o.created,
    })),
    counts,
  });
}

async function orderState(req, res, ctx, m) {
  const S = C.seller(ctx.db, req);
  if (!S) return C.err(res, 401, '需要登录');
  const o = ctx.db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(m[1], S.tenant.id);
  if (!o) return C.err(res, 404, '订单不存在');
  const d = await C.readJson(req);
  const to = String(d.to || '');
  const allowed = {
    placed: ['talking', 'completed', 'void'],
    talking: ['placed', 'completed', 'void'],
    completed: ['talking', 'delivered', 'void'],
    delivered: ['completed'],
    void: ['placed'],
  };
  if (!(allowed[o.status] || []).includes(to)) return C.err(res, 400, '不允许从「' + o.status + '」变为「' + to + '」');
  const sets = { status: to };
  if (to === 'completed' && !o.completed_at) sets.completed_at = C.now();
  if (to === 'delivered') {
    const dd = String(d.deliveryDate || C.today()).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dd) || dd > C.today()) return C.err(res, 400, '送达日期无效（不能晚于今天）');
    sets.delivery_date = dd; sets.delivered_at = C.now();
  }
  const keys = Object.keys(sets);
  ctx.db.prepare('UPDATE orders SET ' + keys.map((k) => k + ' = ?').join(', ') + ' WHERE id = ?')
    .run(...keys.map((k) => sets[k]), o.id);
  C.audit(ctx.db, { tenantId: S.tenant.id, userId: S.user && S.user.id, actor: S.actor, action: 'order_' + to, target: o.code, ip: C.ipOf(req) });
  C.json(res, { ok: true });
}

function stats(req, res, ctx) {
  const S = C.seller(ctx.db, req);
  if (!S) return C.err(res, 401, '需要登录');
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(Date.now() + 8 * 3600e3 - i * 86400e3).toISOString().slice(0, 10);
    const r = ctx.db.prepare('SELECT views, orders FROM counters WHERE tenant_id = ? AND day = ?').get(S.tenant.id, day) || { views: 0, orders: 0 };
    days.push({ day: day.slice(5), views: r.views, orders: r.orders });
  }
  const totals = ctx.db.prepare('SELECT COALESCE(SUM(views),0) AS v, COALESCE(SUM(orders),0) AS o FROM counters WHERE tenant_id = ?').get(S.tenant.id);
  C.json(res, { days, totals: { views: totals.v, orders: totals.o } });
}

/* =============================== public shop =============================== */

function shop(req, res, ctx, m, q) {
  const t = tenantBySlug(ctx.db, m[1]);
  if (!t) return C.err(res, 404, '店铺不存在');
  const preview = q.get('preview') === '1';
  if (t.status !== 'active') {
    // owners and platform admin can preview a not-yet-approved shop
    const s = C.getSession(ctx.db, req);
    const own = s && (s.role === 'admin' || s.tenant_id === t.id);
    if (!(preview && own)) return C.err(res, 404, '店铺不存在或未开放');
  }
  const brand = brandOf(t), services = servicesOf(t);
  const rows = ctx.db.prepare("SELECT * FROM products WHERE tenant_id = ? AND status = 'active' ORDER BY featured DESC, sort, created DESC").all(t.id);
  const products = rows.map((p) => {
    const pm = productMedia(ctx.db, p.id, true);
    return {
      id: p.id, title: p.title, descr: p.descr, grade: p.grade, sizeSpec: p.size_spec,
      flowerCount: p.flower_count, stage: p.stage, variety: p.variety, colorFamily: p.color_family,
      qty: p.qty, featured: !!p.featured,
      price: priceInfo(p, brand),
      media: pm.map((x) => x.url),
    };
  });
  if (!preview) {
    ctx.db.prepare(`INSERT INTO counters (tenant_id, day, views, orders) VALUES (?,?,1,0)
      ON CONFLICT(tenant_id, day) DO UPDATE SET views = views + 1`).run(t.id, C.today());
  }
  C.json(res, {
    shop: {
      slug: t.slug, name: t.name, company: t.company, tagline: t.tagline, verified: !!t.verified,
      wechat: t.wechat, status: t.status,
      brand: { logo: brand.logo, banner: brand.banner, accent: brand.accent, about: brand.about, announcement: brand.announcement, shipsFrom: brand.shipsFrom, wechatQr: brand.wechatQr },
      services,
      constellation: brand.modules.constellation,
    },
    products,
  });
}

async function placeOrder(req, res, ctx) {
  if (!C.rateLimit('order', C.ipOf(req), 15, 600e3)) return C.err(res, 429, '提交太频繁，请稍后再试');
  const d = await C.readJson(req);
  // slug for new storefront orders; `reseller` for the legacy constellation page
  let slug = C.safeSlug(d.slug || d.reseller);
  if (!slug || slug === '_') slug = 'kmty';
  const t = tenantBySlug(ctx.db, slug);
  if (!t || t.status !== 'active') return C.err(res, 404, '店铺不存在或未开放');
  const name = C.clean(d.name, 40);
  const phone = C.clean(d.phone, 24).replace(/[^\d +\-]/g, '');
  if (!name) return C.err(res, 400, '请填写称呼');
  if (phone.replace(/\D/g, '').length < 6) return C.err(res, 400, '请填写有效手机号');
  const qty = C.int(d.qty, 1, 999999, 1) || 1;

  let kind = 'constellation', productId = null, msnap = {}, recipe = '';
  if (d.productId) {
    const p = ctx.db.prepare("SELECT * FROM products WHERE id = ? AND tenant_id = ? AND status = 'active'").get(String(d.productId), t.id);
    if (!p) return C.err(res, 404, '商品不存在或已下架');
    kind = 'product'; productId = p.id;
    const brand = brandOf(t);
    const pi = priceInfo(p, brand);
    msnap = {
      title: p.title, grade: p.grade, sizeSpec: p.size_spec, stage: p.stage,
      flowerCount: p.flower_count,
      priceMode: pi.mode,
      unit: pi.mode === 'public' ? unitPrice(p.price, parseJson(p.tiers, []), qty) : null,
    };
  } else if (Array.isArray(d.recipe)) {
    recipe = d.recipe.slice(0, 3).map((c) => (C.clean(c && c.zh, 20) || C.clean(c && c.en, 30)) + ' ' + (C.int(c && c.pct, 0, 100, 0) || 0) + '%').join(' · ');
  }
  const id = 'o_' + C.hexId(8);
  const code = C.orderCode();
  ctx.db.prepare(`INSERT INTO orders (id,code,tenant_id,product_id,kind,name,phone,qty,wish_date,note,recipe,msnap,created)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, code, t.id, productId, kind, name, phone, qty, C.clean(d.wishDate || d.date, 12), C.cleanText(d.note, 500), recipe, JSON.stringify(msnap), C.now());
  ctx.db.prepare(`INSERT INTO counters (tenant_id, day, views, orders) VALUES (?,?,0,1)
    ON CONFLICT(tenant_id, day) DO UPDATE SET orders = orders + 1`).run(t.id, C.today());
  C.json(res, { ok: true, id, code });
}

/* =============================== platform admin =============================== */

async function adminLogin(req, res, ctx) {
  if (!C.rateLimit('alogin', C.ipOf(req), 8, 300e3)) return C.err(res, 429, 'too many attempts');
  const d = await C.readJson(req);
  if (!ctx.env.ADMIN_PASS || String(d.pass || '') !== ctx.env.ADMIN_PASS) {
    C.audit(ctx.db, { actor: 'public', action: 'admin_login_fail', ip: C.ipOf(req) });
    return C.err(res, 401, '密码不正确');
  }
  const token = C.createSession(ctx.db, { role: 'admin', ip: C.ipOf(req) });
  C.setSessionCookie(res, token);
  C.json(res, { ok: true });
}

function adminOverview(req, res, ctx) {
  if (!C.admin(ctx.db, req)) return C.err(res, 401, '需要登录');
  const db = ctx.db;
  const day = C.today();
  C.json(res, {
    pendingTenants: db.prepare("SELECT COUNT(*) AS n FROM tenants WHERE status = 'pending'").get().n,
    pendingProducts: db.prepare("SELECT COUNT(*) AS n FROM products WHERE status = 'pending'").get().n,
    pendingMedia: db.prepare("SELECT COUNT(*) AS n FROM media WHERE status = 'pending' AND product_id IN (SELECT id FROM products WHERE status = 'active')").get().n,
    tenants: db.prepare('SELECT COUNT(*) AS n FROM tenants').get().n,
    activeTenants: db.prepare("SELECT COUNT(*) AS n FROM tenants WHERE status = 'active'").get().n,
    ordersToday: db.prepare('SELECT COALESCE(SUM(orders),0) AS n FROM counters WHERE day = ?').get(day).n,
    viewsToday: db.prepare('SELECT COALESCE(SUM(views),0) AS n FROM counters WHERE day = ?').get(day).n,
  });
}

function adminTenants(req, res, ctx, m, q) {
  if (!C.admin(ctx.db, req)) return C.err(res, 401, '需要登录');
  const status = String(q.get('status') || '');
  let rows;
  if (['pending', 'active', 'suspended', 'closed'].includes(status)) {
    rows = ctx.db.prepare('SELECT * FROM tenants WHERE status = ? ORDER BY created DESC').all(status);
  } else rows = ctx.db.prepare('SELECT * FROM tenants ORDER BY created DESC').all();
  C.json(res, {
    tenants: rows.map((t) => {
      const u = ctx.db.prepare("SELECT phone FROM users WHERE tenant_id = ? AND role = 'owner'").get(t.id);
      const brand = brandOf(t);
      return {
        id: t.id, slug: t.slug, name: t.name, company: t.company, status: t.status,
        verified: !!t.verified, plan: t.plan, phone: (u && u.phone) || '', wechat: t.wechat,
        logo: brand.logo, rate: t.rate, price: t.price, created: t.created, approved_at: t.approved_at,
        products: ctx.db.prepare('SELECT COUNT(*) AS n FROM products WHERE tenant_id = ?').get(t.id).n,
        orders: ctx.db.prepare('SELECT COUNT(*) AS n FROM orders WHERE tenant_id = ?').get(t.id).n,
      };
    }),
  });
}

async function adminTenantOp(req, res, ctx, m) {
  const s = C.admin(ctx.db, req);
  if (!s) return C.err(res, 401, '需要登录');
  const t = ctx.db.prepare('SELECT * FROM tenants WHERE id = ?').get(m[1]);
  if (!t) return C.err(res, 404, 'not found');
  const d = await C.readJson(req);
  const op = String(d.op || '');
  if (op === 'approve' && t.status === 'pending') {
    ctx.db.prepare("UPDATE tenants SET status = 'active', approved_at = ? WHERE id = ?").run(C.now(), t.id);
  } else if (op === 'suspend') {
    ctx.db.prepare("UPDATE tenants SET status = 'suspended' WHERE id = ?").run(t.id);
  } else if (op === 'activate') {
    ctx.db.prepare("UPDATE tenants SET status = 'active', approved_at = COALESCE(approved_at, ?) WHERE id = ?").run(C.now(), t.id);
  } else if (op === 'verify' || op === 'unverify') {
    ctx.db.prepare('UPDATE tenants SET verified = ? WHERE id = ?').run(op === 'verify' ? 1 : 0, t.id);
  } else if (op === 'plan') {
    if (!['free', 'standard', 'pro'].includes(d.plan)) return C.err(res, 400, 'bad plan');
    ctx.db.prepare('UPDATE tenants SET plan = ? WHERE id = ?').run(d.plan, t.id);
  } else if (op === 'rate') {
    ctx.db.prepare('UPDATE tenants SET rate = ?, price = ? WHERE id = ?')
      .run(C.num(d.rate, 0, 100, t.rate), C.num(d.price, 0, 999999, t.price), t.id);
  } else return C.err(res, 400, 'bad op');
  C.audit(ctx.db, { tenantId: t.id, actor: 'admin', action: 'admin_' + op, target: t.slug, ip: C.ipOf(req) });
  C.json(res, { ok: true });
}

function adminQueue(req, res, ctx) {
  if (!C.admin(ctx.db, req)) return C.err(res, 401, '需要登录');
  const prods = ctx.db.prepare("SELECT p.*, t.slug AS tslug, t.name AS tname FROM products p JOIN tenants t ON t.id = p.tenant_id WHERE p.status = 'pending' ORDER BY p.updated").all();
  const media = ctx.db.prepare(`SELECT m.*, p.title AS ptitle, t.slug AS tslug FROM media m
    JOIN products p ON p.id = m.product_id JOIN tenants t ON t.id = m.tenant_id
    WHERE m.status = 'pending' AND p.status = 'active' ORDER BY m.created`).all();
  C.json(res, {
    products: prods.map((p) => ({
      id: p.id, title: p.title, grade: p.grade, sizeSpec: p.size_spec, stage: p.stage,
      qty: p.qty, price: p.price, descr: p.descr, tenant: p.tname, slug: p.tslug,
      media: productMedia(ctx.db, p.id, false),
    })),
    media: media.map((x) => ({ id: x.id, url: mediaUrl(x.file), product: x.ptitle, slug: x.tslug })),
  });
}

async function adminProductOp(req, res, ctx, m) {
  if (!C.admin(ctx.db, req)) return C.err(res, 401, '需要登录');
  const p = ctx.db.prepare('SELECT * FROM products WHERE id = ?').get(m[1]);
  if (!p) return C.err(res, 404, 'not found');
  const d = await C.readJson(req);
  if (d.op === 'approve') {
    ctx.db.prepare("UPDATE products SET status = 'active', updated = ? WHERE id = ?").run(C.now(), p.id);
    ctx.db.prepare("UPDATE media SET status = 'approved' WHERE product_id = ? AND status = 'pending'").run(p.id);
  } else if (d.op === 'reject') {
    ctx.db.prepare("UPDATE products SET status = 'rejected', updated = ? WHERE id = ?").run(C.now(), p.id);
  } else return C.err(res, 400, 'bad op');
  C.audit(ctx.db, { tenantId: p.tenant_id, actor: 'admin', action: 'moderate_product_' + d.op, target: p.id, detail: C.clean(d.reason, 200), ip: C.ipOf(req) });
  C.json(res, { ok: true });
}

async function adminMediaOp(req, res, ctx, m) {
  if (!C.admin(ctx.db, req)) return C.err(res, 401, '需要登录');
  const row = ctx.db.prepare('SELECT * FROM media WHERE id = ?').get(m[1]);
  if (!row) return C.err(res, 404, 'not found');
  const d = await C.readJson(req);
  if (d.op === 'approve') ctx.db.prepare("UPDATE media SET status = 'approved' WHERE id = ?").run(row.id);
  else if (d.op === 'reject') ctx.db.prepare("UPDATE media SET status = 'rejected' WHERE id = ?").run(row.id);
  else return C.err(res, 400, 'bad op');
  C.audit(ctx.db, { tenantId: row.tenant_id, actor: 'admin', action: 'moderate_media_' + d.op, target: row.id, ip: C.ipOf(req) });
  C.json(res, { ok: true });
}

function adminOrders(req, res, ctx, m, q) {
  if (!C.admin(ctx.db, req)) return C.err(res, 401, '需要登录');
  const rows = ctx.db.prepare(`SELECT o.*, t.slug AS tslug FROM orders o JOIN tenants t ON t.id = o.tenant_id
    ORDER BY o.created DESC LIMIT ?`).all(C.int(q.get('limit'), 1, 2000, 300) || 300);
  C.json(res, {
    orders: rows.map((o) => ({
      id: o.id, code: o.code, slug: o.tslug, kind: o.kind, name: o.name, phone: o.phone,
      qty: o.qty, status: o.status, snap: parseJson(o.msnap, {}), recipe: o.recipe, created: o.created,
    })),
  });
}

function adminLeads(req, res, ctx) {
  if (!C.admin(ctx.db, req)) return C.err(res, 401, '需要登录');
  const rows = ctx.db.prepare('SELECT * FROM leads ORDER BY created DESC LIMIT 500').all();
  C.json(res, { leads: rows });
}

function adminAudit(req, res, ctx, m, q) {
  if (!C.admin(ctx.db, req)) return C.err(res, 401, '需要登录');
  const rows = ctx.db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT ?').all(C.int(q.get('limit'), 1, 1000, 200) || 200);
  C.json(res, { audit: rows });
}

/* ================= compat with the old worker API ================= */

function compatReseller(req, res, ctx, m, q) {
  const t = tenantBySlug(ctx.db, q.get('id'));
  if (!t || (t.status !== 'active')) return C.err(res, 404, 'not found');
  const brand = brandOf(t);
  C.json(res, {
    id: t.slug, name: t.name, company: t.company, companyEn: '',
    footer: brand.footer || t.name.toUpperCase(), logo: brand.logo || '',
  });
}
function compatResellerLogo(req, res, ctx, m, q) {
  const t = tenantBySlug(ctx.db, q.get('id'));
  const brand = t ? brandOf(t) : null;
  if (!brand || !brand.logo) { res.writeHead(404); return res.end(); }
  res.writeHead(302, { location: brand.logo });
  res.end();
}
function configGet(req, res, ctx) {
  const row = ctx.db.prepare("SELECT value FROM kv WHERE key = 'config'").get();
  if (row && row.value) { res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); return res.end(row.value); }
  C.json(res, { colors: [], updated: null });
}
async function configPost(req, res, ctx) {
  const legacyPass = String(req.headers['x-admin-pass'] || '');
  const ok = C.admin(ctx.db, req) || (ctx.env.ADMIN_PASS && legacyPass === ctx.env.ADMIN_PASS);
  if (!ok) return C.err(res, 401, 'unauthorized');
  const d = await C.readJson(req);
  if (!d || !Array.isArray(d.colors)) return C.err(res, 400, 'colors[] required');
  const seen = {};
  const colors = d.colors.slice(0, 40).map((c) => ({
    zh: C.clean(c && c.zh, 20), en: C.clean(c && c.en, 30),
    hex: /^#?[0-9A-Fa-f]{3,8}$/.test(String((c && c.hex) || '').trim()) ? (String(c.hex).trim()[0] === '#' ? String(c.hex).trim() : '#' + String(c.hex).trim()) : '#CCCCCC',
    stock: !(c && c.stock === false),
  })).filter((c) => {
    if (!c.zh && !c.en) return false;
    const k = (c.zh + '|' + c.en).toLowerCase();
    if (seen[k]) return false; seen[k] = 1; return true;
  });
  const out = JSON.stringify({ colors, updated: new Date().toISOString() });
  ctx.db.prepare('INSERT INTO kv (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('config', out);
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(out);
}
const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,24}$/;
async function leadPost(req, res, ctx) {
  const d = await C.readJson(req);
  if (d && typeof d.hp === 'string' && d.hp !== '') return C.json(res, { ok: true }); // honeypot
  const email = String((d && d.email) || '').trim();
  if (!EMAIL_RE.test(email)) return C.err(res, 400, 'invalid email');
  if (!C.rateLimit('lead', C.ipOf(req), 5, 300e3)) return C.err(res, 429, 'too many requests');
  ctx.db.prepare('INSERT INTO leads (id,email,company,name,tel,type,spec,message,lang,page,ip,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run('l_' + C.hexId(8), email, C.clean(d.company, 120), C.clean(d.name, 80), C.clean(d.tel, 40),
      C.clean(d.type, 40), C.clean(d.spec, 20), C.cleanText(d.message, 4000),
      C.clean(d.lang, 5) || 'en', String(d.page || '').slice(0, 200).replace(/[\r\n<>]/g, ''), C.ipOf(req), C.now());
  // Outbound mail: DirectMail hook lands here after the Aliyun move (the
  // Resend path stays on the Cloudflare worker until cutover). Lead is safe
  // in the DB either way — the admin 留言 tab reads from there.
  C.json(res, { ok: true });
}

/* =============================== routes =============================== */

const ROUTES = [
  ['GET', /^\/api\/health$/, (req, res) => C.json(res, { ok: true, ts: Date.now() })],

  ['POST', /^\/api\/auth\/signup$/, signup],
  ['POST', /^\/api\/auth\/login$/, login],
  ['POST', /^\/api\/auth\/logout$/, logout],
  ['POST', /^\/api\/password$/, changePassword],

  ['GET', /^\/api\/me$/, me],
  ['PUT', /^\/api\/tenant$/, updateTenant],
  ['GET', /^\/api\/products$/, listProducts],
  ['POST', /^\/api\/products$/, createProduct],
  ['PUT', /^\/api\/products\/([a-zA-Z0-9_]+)$/, updateProduct],
  ['POST', /^\/api\/products\/([a-zA-Z0-9_]+)\/publish$/, publishProduct],
  ['DELETE', /^\/api\/products\/([a-zA-Z0-9_]+)$/, deleteProduct],
  ['POST', /^\/api\/upload$/, upload],
  ['DELETE', /^\/api\/media\/([a-zA-Z0-9_]+)$/, deleteMedia],
  ['POST', /^\/api\/media\/sort$/, sortMedia],
  ['GET', /^\/api\/orders$/, listOrders],
  ['POST', /^\/api\/orders\/([a-zA-Z0-9_]+)\/state$/, orderState],
  ['GET', /^\/api\/stats$/, stats],

  ['GET', /^\/api\/shop\/([a-z0-9_-]+)$/, shop],
  ['POST', /^\/api\/order$/, placeOrder],

  ['POST', /^\/api\/admin\/login$/, adminLogin],
  ['GET', /^\/api\/admin\/overview$/, adminOverview],
  ['GET', /^\/api\/admin\/tenants$/, adminTenants],
  ['POST', /^\/api\/admin\/tenants\/([a-zA-Z0-9_]+)$/, adminTenantOp],
  ['GET', /^\/api\/admin\/queue$/, adminQueue],
  ['POST', /^\/api\/admin\/product\/([a-zA-Z0-9_]+)$/, adminProductOp],
  ['POST', /^\/api\/admin\/media\/([a-zA-Z0-9_]+)$/, adminMediaOp],
  ['GET', /^\/api\/admin\/orders$/, adminOrders],
  ['GET', /^\/api\/admin\/leads$/, adminLeads],
  ['GET', /^\/api\/admin\/audit$/, adminAudit],

  ['GET', /^\/api\/reseller$/, compatReseller],
  ['GET', /^\/api\/reseller-logo$/, compatResellerLogo],
  ['GET', /^\/api\/config$/, configGet],
  ['POST', /^\/api\/config$/, configPost],
  ['POST', /^\/api\/lead$/, leadPost],
];

async function handle(req, res, ctx) {
  const u = new URL(req.url, 'http://x');
  for (const [method, re, fn] of ROUTES) {
    if (req.method !== method) continue;
    const m = re.exec(u.pathname);
    if (!m) continue;
    try {
      await fn(req, res, ctx, m, u.searchParams);
    } catch (e) {
      if (!res.headersSent) C.err(res, e.message === 'json required' ? 415 : (e.message === 'too large' ? 413 : 500), String(e.message || 'server error').slice(0, 200));
    }
    return true;
  }
  return false;
}

module.exports = { handle };
