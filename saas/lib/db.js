// SQLite layer (node:sqlite — built into Node 22+, zero npm deps by design:
// the app deploys to a mainland ECS by copying files and running `node`,
// no npm install, no native builds, no external services).
//
// One database file under DATA_DIR. WAL mode so reads never block the writer.
// Schema is idempotent (CREATE IF NOT EXISTS) + tiny additive migrations via
// PRAGMA user_version — never destructive.
'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS kv (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS tenants (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  company     TEXT NOT NULL DEFAULT '',
  tagline     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active',    -- active|suspended|closed (no approval gate — takedown-based moderation)
  verified    INTEGER NOT NULL DEFAULT 0,
  plan        TEXT NOT NULL DEFAULT 'free',
  brand       TEXT NOT NULL DEFAULT '{}',        -- logo/banner/accent/about/announcement/priceMode/featured/modules/wechatQr/shipsFrom
  services    TEXT NOT NULL DEFAULT '{}',        -- shippingIncluded/qaRate/replacePolicy/invoice/minOrder/carrierNote
  wechat      TEXT NOT NULL DEFAULT '',
  rate        REAL NOT NULL DEFAULT 0,           -- Constellation commission % (KMTY-set)
  price       REAL NOT NULL DEFAULT 0,           -- Constellation reference price (KMTY-set)
  created     INTEGER NOT NULL,
  approved_at INTEGER
);
CREATE TABLE IF NOT EXISTS users (
  id        TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  phone     TEXT NOT NULL DEFAULT '',
  pass_hash TEXT NOT NULL,
  role      TEXT NOT NULL DEFAULT 'owner',       -- owner|staff
  status    TEXT NOT NULL DEFAULT 'active',
  created   INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT,                               -- NULL for platform-admin sessions
  tenant_id  TEXT,
  role       TEXT NOT NULL,                      -- owner|staff|admin
  ip         TEXT NOT NULL DEFAULT '',
  expires    INTEGER NOT NULL,
  created    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  title        TEXT NOT NULL,
  descr        TEXT NOT NULL DEFAULT '',
  grade        TEXT NOT NULL DEFAULT '',
  size_spec    TEXT NOT NULL DEFAULT '',
  flower_count INTEGER NOT NULL DEFAULT 0,
  stage        TEXT NOT NULL DEFAULT '',         -- 瓶苗|中苗|大苗|开花株
  variety      TEXT NOT NULL DEFAULT '',
  color_family TEXT NOT NULL DEFAULT '',
  qty          INTEGER NOT NULL DEFAULT 0,
  price        REAL,
  tiers        TEXT NOT NULL DEFAULT '[]',       -- [{min,price}]
  price_display TEXT NOT NULL DEFAULT 'inherit', -- inherit|public|on_request|hidden
  status       TEXT NOT NULL DEFAULT 'draft',    -- draft|pending|active|paused|rejected
  featured     INTEGER NOT NULL DEFAULT 0,
  sort         INTEGER NOT NULL DEFAULT 0,
  created      INTEGER NOT NULL,
  updated      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id, status);
CREATE TABLE IF NOT EXISTS media (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  product_id TEXT,                               -- NULL = brand asset (logo/banner/QR)
  kind       TEXT NOT NULL DEFAULT 'photo',
  file       TEXT NOT NULL,                      -- path under DATA_DIR/media
  bytes      INTEGER NOT NULL DEFAULT 0,
  w          INTEGER NOT NULL DEFAULT 0,
  h          INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'pending',    -- pending|approved|rejected
  sort       INTEGER NOT NULL DEFAULT 0,
  created    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_product ON media(product_id, status, sort);
CREATE INDEX IF NOT EXISTS idx_media_tenant ON media(tenant_id);
CREATE TABLE IF NOT EXISTS orders (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL,                   -- short human code the buyer quotes in WeChat
  tenant_id     TEXT NOT NULL,                   -- storefront = responsible party
  product_id    TEXT,
  kind          TEXT NOT NULL DEFAULT 'product', -- product|constellation
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL,
  qty           INTEGER NOT NULL DEFAULT 1,
  wish_date     TEXT NOT NULL DEFAULT '',
  note          TEXT NOT NULL DEFAULT '',
  recipe        TEXT NOT NULL DEFAULT '',        -- constellation colour mix (compat)
  msnap         TEXT NOT NULL DEFAULT '{}',      -- product title/spec/price snapshot at order time
  status        TEXT NOT NULL DEFAULT 'placed',  -- placed|talking|completed|delivered|void
  completed_at  INTEGER,
  delivery_date TEXT,
  delivered_at  INTEGER,
  created       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id, status, created);
CREATE TABLE IF NOT EXISTS leads (
  id      TEXT PRIMARY KEY,
  email   TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  name    TEXT NOT NULL DEFAULT '',
  tel     TEXT NOT NULL DEFAULT '',
  type    TEXT NOT NULL DEFAULT '',
  spec    TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  lang    TEXT NOT NULL DEFAULT '',
  page    TEXT NOT NULL DEFAULT '',
  ip      TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS counters (
  tenant_id TEXT NOT NULL,
  day       TEXT NOT NULL,                       -- YYYY-MM-DD (UTC+8)
  views     INTEGER NOT NULL DEFAULT 0,
  orders    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, day)
);
CREATE TABLE IF NOT EXISTS audit (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,
  tenant_id TEXT,
  user_id   TEXT,
  actor     TEXT NOT NULL DEFAULT 'seller',      -- seller|admin|system|public
  action    TEXT NOT NULL,
  target    TEXT NOT NULL DEFAULT '',
  detail    TEXT NOT NULL DEFAULT '',
  ip        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit(ts);
`;

function open(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'media'), { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'app.db'));
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(SCHEMA);
  return db;
}

module.exports = { open };
