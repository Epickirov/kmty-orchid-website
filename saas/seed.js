#!/usr/bin/env node
// Demo/bootstrap seed: creates the KMTY platform tenant (tenant #0 — receives
// direct constellation orders) and, with --demo, a demo seller with products.
//   node seed.js [--demo]   (env: DATA_DIR, KMTY_PASS for the kmty owner login)
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { open } = require('./lib/db');
const C = require('./lib/core');

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

// KMTY platform tenant — owns direct constellation orders ('_' → 'kmty')
ensureTenant('kmty', 'KMTY 星空', {
  company: '昆明统一生物科技有限公司',
  tagline: '中国最大蝴蝶兰出口商 · 星空艺术兰创始',
  verified: 1,
  pass: process.env.KMTY_PASS || 'kmty' + C.hexId(4),
  brand: { modules: { constellation: true }, priceMode: 'on_request' },
});

if (process.argv.includes('--demo')) {
  const tid = ensureTenant('lanyuan', '兰源花业', {
    company: '昆明兰源花业有限公司', tagline: '斗南基地直发 · 专注蝴蝶兰 12 年',
    phone: '13800001111', pass: 'demo888', wechat: 'lanyuan-km', verified: 1,
    brand: { accent: '#E7B7CF', announcement: '年宵花预订通道已开启，量大从优', shipsFrom: '昆明斗南', priceMode: 'public', modules: { constellation: true } },
    services: { shippingIncluded: true, qaRate: 95, invoice: true, minOrder: 50, carrierNote: '德邦物流 / 顺丰冷链', replacePolicy: '到货破损包赔' },
  });
  const demos = [
    { title: '大辣椒 3.5寸 开花株 双梗', grade: 'A级', size: '3.5寸', stage: '开花株', fc: 2, qty: 5000, price: 18.5, tiers: [{ min: 500, price: 17 }, { min: 1000, price: 15.8 }], img: 'images/art-06-peach.jpg', feat: 1 },
    { title: '富乐夕阳 2.5寸 中苗', grade: 'A级', size: '2.5寸', stage: '中苗', fc: 0, qty: 12000, price: 6.8, tiers: [{ min: 1000, price: 6.2 }], img: 'images/art-05-fuchsia.jpg', feat: 0 },
    { title: '大辣椒 组培瓶苗', grade: '特级', size: '', stage: '瓶苗', fc: 0, qty: 30000, price: null, tiers: [], img: 'images/art-03-purple.jpg', feat: 0, pd: 'on_request' },
  ];
  for (const d of demos) {
    if (db.prepare('SELECT id FROM products WHERE tenant_id = ? AND title = ?').get(tid, d.title)) continue;
    const pid = 'p_' + C.hexId(8);
    db.prepare(`INSERT INTO products (id,tenant_id,title,grade,size_spec,flower_count,stage,qty,price,tiers,price_display,status,featured,created,updated)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(pid, tid, d.title, d.grade, d.size, d.fc, d.stage, d.qty, d.price, JSON.stringify(d.tiers), d.pd || 'inherit', 'active', d.feat, C.now(), C.now());
    const src = path.join(__dirname, '..', d.img);
    if (fs.existsSync(src)) {
      const buf = fs.readFileSync(src);
      const M = require('./lib/media');
      const saved = M.saveBuffer(DATA_DIR, tid, buf);
      if (!saved.error) {
        db.prepare('INSERT INTO media (id,tenant_id,product_id,file,bytes,status,sort,created) VALUES (?,?,?,?,?,?,?,?)')
          .run('m_' + C.hexId(8), tid, pid, saved.file, saved.bytes, 'approved', 0, C.now());
      }
    }
    console.log('product', d.title);
  }
  console.log('demo seller ready: /seller  代号 lanyuan · 密码 demo888');
}
console.log('seed done');
