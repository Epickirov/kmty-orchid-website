#!/usr/bin/env node
// One-time import of the Cloudflare KV data into SQLite for the Aliyun cutover.
//
//   1) Dump KV with wrangler (per prefix) into one JSON file:
//        npx wrangler kv key list --namespace-id=<ID> > keys.json
//        # then for each key: npx wrangler kv key get --namespace-id=<ID> "<key>"
//        # assemble: { "entries": [ { "key": "rs:acme", "value": "<raw string>" }, … ] }
//      (any script/loop that produces that shape is fine)
//   2) node migrate.js dump.json --dry     # inspect what would happen
//      node migrate.js dump.json           # import (idempotent by natural keys)
//
// Mapping:
//   config      → kv('config')                     (colour catalogue, verbatim)
//   rs:<id>     → tenants (status active) + users  (legacy sha256 → 's1:' hash,
//                 auto-upgraded to scrypt on the owner's first login)
//                 base64 logo → data/media file + brand.logo
//   ord:<c>:*   → orders (kind constellation, status placed)
//   lead:*      → leads
//   ref:<phone> → skipped for now (first-touch ledger returns in Phase 3, D16)
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { open } = require('./lib/db');
const C = require('./lib/core');
const M = require('./lib/media');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const file = process.argv[2];
const DRY = process.argv.includes('--dry');
if (!file) { console.error('usage: node migrate.js dump.json [--dry]'); process.exit(1); }
const dump = JSON.parse(fs.readFileSync(file, 'utf8'));
const entries = dump.entries || [];
const db = open(DATA_DIR);
const stats = { tenants: 0, orders: 0, leads: 0, config: 0, skipped: 0 };

/* Slugs this run creates. A dry run writes nothing, so without tracking them
   here every order would look tenant-less and be reported as skipped — the
   preview would claim 0 orders no matter how many exist. */
const pending = new Set();
const tenantExists = (slug) => pending.has(slug) || !!db.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug);

/* Orders whose reseller is '_' belong to KMTY itself and map to the 'kmty'
   house tenant. On a database that was never seeded that tenant is absent and
   those orders — normally the largest share — would be dropped in silence.
   Create it rather than lose them. */
function houseTenant() {
  const row = db.prepare("SELECT id FROM tenants WHERE slug = 'kmty'").get();
  if (row) return row;
  if (DRY) { pending.add('kmty'); return { id: 't_kmty_pending' }; }
  const tid = 't_' + C.hexId(8);
  db.prepare('INSERT INTO tenants (id,slug,name,company,status,brand,rate,price,created,approved_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(tid, 'kmty', 'KMTY', '', 'active', '{}', 0, 0, C.now(), C.now());
  console.log("created the 'kmty' house tenant for direct (reseller '_') orders");
  return { id: tid };
}

for (const e of entries) {
  const k = e.key || '';
  try {
    if (k === 'config') {
      stats.config++;
      if (!DRY) db.prepare('INSERT INTO kv (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('config', String(e.value));
    } else if (k.startsWith('rs:')) {
      const r = JSON.parse(e.value);
      const slug = C.safeSlug(r.id || k.slice(3));
      if (!slug || tenantExists(slug)) { stats.skipped++; continue; }
      stats.tenants++;
      pending.add(slug);
      if (DRY) continue;
      const tid = 't_' + C.hexId(8);
      const brand = { footer: r.footer || '' };
      if (r.logo && /^data:image\//.test(r.logo)) {
        const mm = r.logo.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/);
        if (mm) {
          const saved = M.saveBuffer(DATA_DIR, tid, Buffer.from(mm[2], 'base64'));
          if (!saved.error) {
            brand.logo = '/m/' + saved.file;
            db.prepare('INSERT INTO media (id,tenant_id,file,bytes,status,created) VALUES (?,?,?,?,?,?)')
              .run('m_' + C.hexId(8), tid, saved.file, saved.bytes, 'approved', C.now());
          }
        }
      }
      db.prepare('INSERT INTO tenants (id,slug,name,company,status,brand,rate,price,created,approved_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(tid, slug, r.name || slug, r.company || '', 'active', JSON.stringify(brand),
          +r.rate || 0, +r.price || 0, Date.parse(r.created) || C.now(), C.now());
      db.prepare('INSERT INTO users (id,tenant_id,phone,pass_hash,created) VALUES (?,?,?,?,?)')
        .run('u_' + C.hexId(8), tid, '', r.passHash ? 's1:' + r.passHash : C.hashPass(C.hexId(8)), C.now());
    } else if (k.startsWith('ord:')) {
      const o = JSON.parse(e.value);
      /* Derive the id from the KV key, not a random one: these records carry no
         id of their own, so a random id made re-running the import duplicate
         every order instead of skipping the ones already in. */
      const oid = 'o_' + (o.id || C.safeSlug(k.slice(4).replace(/:/g, '_')) || C.hexId(6));
      if (db.prepare('SELECT id FROM orders WHERE id = ?').get(oid)) { stats.skipped++; continue; }
      const slug = C.safeSlug(o.reseller === '_' ? 'kmty' : o.reseller) || 'kmty';
      const t = (tenantExists(slug) ? db.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug) : null) || houseTenant();
      stats.orders++;
      if (DRY) continue;
      const recipe = Array.isArray(o.recipe) ? o.recipe.map((c) => (c.zh || c.en) + ' ' + c.pct + '%').join(' · ') : '';
      db.prepare('INSERT INTO orders (id,code,tenant_id,kind,name,phone,qty,wish_date,recipe,msnap,status,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(oid, o.code || C.orderCode(), t.id, 'constellation',
          o.name || '', o.phone || '', +o.qty || 1, o.date || '', recipe, '{}', 'placed', o.ts || C.now());
    } else if (k.startsWith('lead:')) {
      const l = JSON.parse(e.value);
      // Same reasoning as orders: key-derived id so a re-run skips rather than duplicates.
      const lid = 'l_' + (C.safeSlug(k.slice(5).replace(/:/g, '_')) || C.hexId(8));
      if (db.prepare('SELECT id FROM leads WHERE id = ?').get(lid)) { stats.skipped++; continue; }
      stats.leads++;
      if (DRY) continue;
      db.prepare('INSERT INTO leads (id,email,company,name,tel,type,spec,message,lang,page,ip,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(lid, l.email || '', l.company || '', l.name || '', l.tel || '',
          l.type || '', l.spec || '', l.message || '', l.lang || '', l.page || '', l.ip || '', l.ts || C.now());
    } else stats.skipped++;
  } catch (err) { console.error('entry failed:', k, err.message); stats.skipped++; }
}
console.log((DRY ? '[dry-run] ' : '') + 'imported:', JSON.stringify(stats));
if (DRY) console.log('re-run without --dry to write');
