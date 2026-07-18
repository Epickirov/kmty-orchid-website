#!/usr/bin/env node
// Demo/bootstrap seed: creates the KMTY platform tenant (tenant #0 — receives
// direct constellation orders) and, with --demo, a three-seller marketplace
// with a spec-complete catalogue (variety, colour, spike length, tiers).
//   node seed.js [--demo]   (env: DATA_DIR, KMTY_PASS for the kmty owner login)
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const os = require('node:os');

// keep demo media light: downscale/compress via ffmpeg when present
function compressed(src) {
  try {
    const out = path.join(os.tmpdir(), 'kmty-seed-' + path.basename(src).replace(/\.[a-z]+$/i, '') + '.jpg');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', "scale='min(1100,iw)':-2", '-q:v', '7', out]);
    if (fs.statSync(out).size < fs.statSync(src).size) return out;
  } catch (e) {}
  return src;
}
const { open } = require('./lib/db');
const C = require('./lib/core');
const M = require('./lib/media');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const db = open(DATA_DIR);

function ensureTenant(slug, name, o) {
  const ex = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(slug);
  if (ex) return ex.id;
  const id = 't_' + C.hexId(8);
  db.prepare('INSERT INTO tenants (id,slug,name,company,tagline,status,verified,brand,services,wechat,created,approved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, slug, name, o.company || '', o.tagline || '', 'active', o.verified ? 1 : 0,
      JSON.stringify(o.brand || {}), JSON.stringify(o.services || {}), o.wechat || '', C.now(), C.now());
  db.prepare('INSERT INTO users (id,tenant_id,phone,pass_hash,created) VALUES (?,?,?,?,?)')
    .run('u_' + C.hexId(8), id, o.phone || '', C.hashPass(o.pass || C.hexId(8)), C.now());
  console.log('tenant', slug, 'created');
  return id;
}

function addMedia(tid, pid, img, sort) {
  let src = path.join(__dirname, '..', img);
  if (!fs.existsSync(src)) return;
  src = compressed(src);
  const saved = M.saveBuffer(DATA_DIR, tid, fs.readFileSync(src));
  if (saved.error) return;
  db.prepare('INSERT INTO media (id,tenant_id,product_id,file,bytes,status,sort,created) VALUES (?,?,?,?,?,?,?,?)')
    .run('m_' + C.hexId(8), tid, pid, saved.file, saved.bytes, 'approved', sort || 0, C.now());
}
function brandAsset(tid, img) {
  let src = path.join(__dirname, '..', img);
  if (!fs.existsSync(src)) return '';
  src = compressed(src);
  const saved = M.saveBuffer(DATA_DIR, tid, fs.readFileSync(src));
  if (saved.error) return '';
  db.prepare('INSERT INTO media (id,tenant_id,file,bytes,status,created) VALUES (?,?,?,?,?,?)')
    .run('m_' + C.hexId(8), tid, saved.file, saved.bytes, 'approved', C.now());
  return '/m/' + saved.file;
}

function addProducts(tid, list) {
  for (const d of list) {
    if (db.prepare('SELECT id FROM products WHERE tenant_id = ? AND title = ?').get(tid, d.t)) continue;
    const pid = 'p_' + C.hexId(8);
    db.prepare(`INSERT INTO products (id,tenant_id,title,descr,grade,size_spec,flower_count,stage,variety,color_family,spike_len,qty,price,tiers,price_display,status,featured,created,updated)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(pid, tid, d.t, d.descr || '', d.g || '', d.sz || '', d.fc || 0, d.st || '', d.v || '', d.c || '',
        d.sl || 0, d.q || 0, d.p != null ? d.p : null, JSON.stringify(d.tiers || []), d.pd || 'inherit', 'active', d.feat ? 1 : 0, C.now(), C.now());
    (d.imgs || []).forEach((img, i) => addMedia(tid, pid, img, i));
    console.log('product', d.t);
  }
}

// KMTY platform tenant — owns direct constellation orders ('_' → 'kmty')
ensureTenant('kmty', 'KMTY 星空', {
  company: '昆明统一生物科技有限公司',
  tagline: '中国最大蝴蝶兰出口商 · 星空艺术兰创始',
  verified: 1,
  pass: process.env.KMTY_PASS || 'kmty' + C.hexId(4),
  brand: { modules: { constellation: true }, priceMode: 'on_request' },
});

if (process.argv.includes('--demo')) {
  /* ---- 兰源花业: pink-accent flagship shop ---- */
  const t1 = ensureTenant('lanyuan', '兰源花业', {
    company: '昆明兰源花业有限公司', tagline: '斗南基地直发 · 专注蝴蝶兰 12 年',
    phone: '13800001111', pass: 'demo888', wechat: 'lanyuan-km', verified: 1,
    brand: { accent: '#E7B7CF', announcement: '年宵花预订通道已开启，量大从优', shipsFrom: '昆明斗南', priceMode: 'public', modules: { constellation: true } },
    services: { shippingIncluded: true, qaRate: 95, invoice: true, minOrder: 50, carrierNote: '德邦物流 / 顺丰冷链', replacePolicy: '到货破损包赔' },
  });
  db.prepare("UPDATE tenants SET brand = json_set(brand, '$.banner', ?) WHERE id = ? AND json_extract(brand, '$.banner') IS NULL")
    .run(brandAsset(t1, 'images/greenhouse-1.jpg'), t1);
  addProducts(t1, [
    { t: '大辣椒 3.5寸 开花株 双梗', g: 'A级', sz: '3.5寸', st: '开花株', fc: 2, v: '大辣椒', c: '玫红', sl: 55, q: 5000, p: 18.5,
      tiers: [{ min: 500, price: 17 }, { min: 1000, price: 15.8 }], imgs: ['images/art-06-peach.jpg', 'images/pot-magenta.jpg'], feat: 1,
      descr: '基地现货，梗长 55cm 以上，花苞 8+，年宵主力品种。' },
    { t: '富乐夕阳 2.5寸 中苗', g: 'A级', sz: '2.5寸', st: '中苗', v: '富乐夕阳', c: '橙黄', sl: 0, q: 12000, p: 6.8,
      tiers: [{ min: 1000, price: 6.2 }], imgs: ['images/art-07-aurora.jpg'] },
    { t: '大辣椒 组培瓶苗', g: '特级', st: '瓶苗', v: '大辣椒', c: '玫红', q: 30000, pd: 'on_request',
      imgs: ['images/bottles.jpg', 'images/bottles-cut.webp'], descr: '组培实验室直供，可按合同分批出瓶。' },
    { t: '粉色系混拼 3.0寸 大苗', g: 'B级', sz: '3.0寸', st: '大苗', c: '粉', sl: 40, q: 8000, p: 9.9,
      tiers: [{ min: 2000, price: 8.8 }], imgs: ['images/rack-white-pink.jpg'] },
  ]);

  /* ---- 云岭兰业: blue-accent, whites & yellows ---- */
  const t2 = ensureTenant('yunling', '云岭兰业', {
    company: '云南云岭兰业科技有限公司', tagline: '高山冷凉气候 · 白花黄花专家',
    phone: '13700002222', pass: 'demo888', wechat: 'yunling-orchid', verified: 1,
    brand: { accent: '#8FB7E0', shipsFrom: '玉溪', priceMode: 'public' },
    services: { shippingIncluded: false, qaRate: 96, invoice: true, minOrder: 100, carrierNote: '顺丰冷链 / 专车' },
  });
  db.prepare("UPDATE tenants SET brand = json_set(brand, '$.banner', ?) WHERE id = ? AND json_extract(brand, '$.banner') IS NULL")
    .run(brandAsset(t2, 'images/greenhouse-2.jpg'), t2);
  addProducts(t2, [
    { t: 'V3 大白花 3.5寸 开花株', g: '特级', sz: '3.5寸', st: '开花株', fc: 2, v: 'V3', c: '白', sl: 60, q: 6000, p: 21,
      tiers: [{ min: 500, price: 19.5 }, { min: 2000, price: 18 }], imgs: ['images/art-05-white.webp', 'images/field-cream.jpg'], feat: 1,
      descr: '经典 V3，梗直花正，婚庆与高端礼盒首选。' },
    { t: '黄金甲 3.0寸 开花株', g: 'A级', sz: '3.0寸', st: '开花株', fc: 1, v: '黄金甲', c: '黄', sl: 50, q: 3500, p: 16,
      tiers: [{ min: 500, price: 15 }], imgs: ['images/field-yellow.jpg', 'images/art-02-yellow.webp'] },
    { t: '蓝色妖姬 染色成品 3.5寸', g: 'A级', sz: '3.5寸', st: '开花株', fc: 2, v: '染色系列', c: '蓝紫', sl: 55, q: 1200, p: 32,
      imgs: ['images/art-03-blue.webp'], descr: '专利染色工艺，色泽均匀持久，节日爆款。' },
    { t: '白花中苗 2.8寸', g: 'A级', sz: '2.8寸', st: '中苗', v: 'V3', c: '白', q: 15000, p: 7.5,
      tiers: [{ min: 1000, price: 7 }, { min: 5000, price: 6.5 }], imgs: ['images/seedling-white.webp'] },
  ]);

  /* ---- 斗南花仓: gold-accent, bicolor & cut ---- */
  const t3 = ensureTenant('dounan', '斗南花仓', {
    company: '昆明斗南花仓贸易有限公司', tagline: '亚洲花都档口 · 当天配货当天发',
    phone: '13600003333', pass: 'demo888', wechat: 'dounan-hc',
    brand: { accent: '#E6C98A', announcement: '档口自提 9 折，昆明市区当日达', shipsFrom: '昆明斗南', priceMode: 'public' },
    services: { shippingIncluded: false, invoice: false, minOrder: 20, carrierNote: '档口自提 / 落地配' },
  });
  db.prepare("UPDATE tenants SET brand = json_set(brand, '$.banner', ?) WHERE id = ? AND json_extract(brand, '$.banner') IS NULL")
    .run(brandAsset(t3, 'images/rack-multicolor.jpg'), t3);
  addProducts(t3, [
    { t: '双色蝴蝶兰 3.5寸 开花株', g: 'A级', sz: '3.5寸', st: '开花株', fc: 2, v: '双色系列', c: '复色', sl: 52, q: 2000, p: 24,
      tiers: [{ min: 200, price: 22 }], imgs: ['images/bicolor.jpg'], feat: 1 },
    { t: '切花蝴蝶兰 白 10支/扎', g: 'A级', st: '切花', v: '切花白', c: '白', sl: 70, q: 900, p: 45,
      tiers: [{ min: 50, price: 42 }], imgs: ['images/cut-flower.jpg'], descr: '梗长 70cm 切花，婚庆布展常备，按扎报价。' },
    { t: '玫红蝴蝶兰 3.0寸 开花株', g: 'B级', sz: '3.0寸', st: '开花株', fc: 1, v: '大辣椒', c: '玫红', sl: 45, q: 4200, p: 12.8,
      tiers: [{ min: 500, price: 11.5 }], imgs: ['images/field-magenta.jpg', 'images/pack-magenta.jpg'] },
  ]);

  /* seeded certified reviews on flagship products */
  const seedReviews = [
    ['lanyuan', '大辣椒 3.5寸 开花株 双梗', [[5, '王女士', '13811112222', '苗壮梗直，年宵档期到货准时，包装很专业。'], [5, '刘先生', '13733334444', '第二次订了，好苗率确实在 95% 以上。'], [4, '周店长', '13655557777', '花色正，个别盆土有点散，总体满意。']]],
    ['yunling', 'V3 大白花 3.5寸 开花株', [[5, '陈总', '13911118888', '婚庆用的大白花，客户很满意，梗长给力。'], [5, '林小姐', '13544446666', '白得干净，损耗几乎没有。']]],
    ['dounan', '双色蝴蝶兰 3.5寸 开花株', [[4, '赵老板', '13322225555', '档口自提方便，双色很出片。']]],
  ];
  for (const [slug, title, revs] of seedReviews) {
    const t = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug);
    const pr = t && db.prepare('SELECT id FROM products WHERE tenant_id = ? AND title = ?').get(t.id, title);
    if (!pr) continue;
    for (const [stars, nm, ph, txt] of revs) {
      if (db.prepare('SELECT r.id FROM reviews r JOIN orders o ON o.id = r.order_id WHERE r.product_id = ? AND o.phone = ?').get(pr.id, ph)) continue;
      const oid = 'o_' + C.hexId(8);
      const dd = new Date(Date.now() + 8 * 3600e3 - 6 * 86400e3).toISOString().slice(0, 10);
      db.prepare(`INSERT INTO orders (id,code,tenant_id,product_id,kind,name,phone,qty,msnap,status,completed_at,delivery_date,delivered_at,created)
        VALUES (?,?,?,?, 'product', ?,?,?, '{}', 'delivered', ?, ?, ?, ?)`)
        .run(oid, C.orderCode(), t.id, pr.id, nm, ph, 200 + Math.floor(Math.random() * 0), C.now() - 9 * 86400e3, dd, C.now() - 6 * 86400e3, C.now() - 12 * 86400e3);
      db.prepare('INSERT INTO reviews (id,order_id,tenant_id,owner_id,product_id,stars,text,buyer_name,buyer_phone,created) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run('rv_' + C.hexId(8), oid, t.id, t.id, pr.id, stars, txt, nm, ph, C.now() - 5 * 86400e3);
    }
  }
  console.log('demo marketplace ready: /market · sellers lanyuan/yunling/dounan · 密码 demo888');
}
console.log('seed done');
