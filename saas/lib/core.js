// Shared helpers: responses, body reading, ids, validation, password hashing,
// sessions, rate limiting, audit. No dependencies beyond node built-ins.
'use strict';
const crypto = require('node:crypto');

/* ---------------- responses ---------------- */
const JH = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
function json(res, body, status) {
  res.writeHead(status || 200, JH);
  res.end(JSON.stringify(body));
}
function err(res, status, message) { json(res, { error: message }, status); }

/* ---------------- body reading ---------------- */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', (c) => {
      n += c.length;
      if (n > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req, limit) {
  const ct = String(req.headers['content-type'] || '');
  // JSON-only mutations double as CSRF protection with SameSite=Lax cookies:
  // cross-site forms cannot send application/json.
  if (ct.indexOf('application/json') !== 0) throw new Error('json required');
  const buf = await readBody(req, limit || 262144);
  return JSON.parse(buf.toString('utf8') || '{}');
}

/* ---------------- small utils ---------------- */
function id(n) { return crypto.randomBytes(n || 9).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, (n || 9) + 3) || crypto.randomBytes(12).toString('hex'); }
function hexId(n) { return crypto.randomBytes(n || 8).toString('hex'); }
function orderCode() { // human code the buyer quotes in WeChat — unambiguous alphabet
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += A[crypto.randomInt(A.length)];
  return s;
}
function now() { return Date.now(); }
function today() { return new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); } // UTC+8 business day
function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function cleanText(v, max) { // multi-line text (about, notes): keep newlines, neutralise angle brackets
  return String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/</g, '‹').replace(/>/g, '›').slice(0, max).trim();
}
function num(v, min, max, dflt) {
  let n = parseFloat(v);
  if (!isFinite(n)) return dflt;
  if (n < min) n = min;
  if (n > max) n = max;
  return n;
}
function int(v, min, max, dflt) { const n = num(v, min, max, dflt); return n == null ? n : Math.round(n); }

const SLUG_RE = /^[a-z][a-z0-9_-]{2,31}$/;
const RESERVED = new Set(['kmty', 'admin', 'api', 'www', 'order', 'mail', 'seller', 'shop', 'stock', 'app', 'help', 'static', 'assets', 'm', 's', 'r', 'test', 'demo0', 'root', 'system', 'constellation']);
function validSlug(s) { return SLUG_RE.test(s) && !RESERVED.has(s); }
function safeSlug(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32); }

/* ---------------- passwords ---------------- */
// s2:<salt_hex>:<scrypt_hex>  (current)   s1:<sha256_hex>  (imported from the old KV system)
function hashPass(pass) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(pass), salt, 32);
  return 's2:' + salt.toString('hex') + ':' + key.toString('hex');
}
function verifyPass(pass, stored) {
  try {
    if (!stored) return false;
    if (stored.startsWith('s2:')) {
      const parts = stored.split(':');
      const key = crypto.scryptSync(String(pass), Buffer.from(parts[1], 'hex'), 32);
      return crypto.timingSafeEqual(key, Buffer.from(parts[2], 'hex'));
    }
    if (stored.startsWith('s1:')) {
      const h = crypto.createHash('sha256').update(String(pass)).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(stored.slice(3)));
    }
  } catch (e) {}
  return false;
}

/* ---------------- sessions ---------------- */
const COOKIE = 'kmty_s';
const SESSION_TTL = 30 * 24 * 3600e3;   // 30 days, sliding — sellers live on phones
function tokenHash(t) { return crypto.createHash('sha256').update(t).digest('hex'); }

function createSession(db, { userId, tenantId, role, ip }) {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token_hash,user_id,tenant_id,role,ip,expires,created) VALUES (?,?,?,?,?,?,?)')
    .run(tokenHash(token), userId || null, tenantId || null, role, ip || '', now() + SESSION_TTL, now());
  return token;
}
function setSessionCookie(res, token) {
  res.setHeader('set-cookie', COOKIE + '=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + Math.floor(SESSION_TTL / 1000));
}
function clearSessionCookie(res) {
  res.setHeader('set-cookie', COOKIE + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}
function readCookie(req, name) {
  const raw = String(req.headers.cookie || '');
  const parts = raw.split(/;\s*/);
  for (const p of parts) {
    const i = p.indexOf('=');
    if (i > 0 && p.slice(0, i) === name) return p.slice(i + 1);
  }
  return '';
}
function getSession(db, req) {
  const t = readCookie(req, COOKIE);
  if (!t) return null;
  const row = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash(t));
  if (!row) return null;
  if (row.expires < now()) { db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash); return null; }
  // sliding renewal, at most once a day per session
  if (row.expires - now() < SESSION_TTL - 24 * 3600e3) {
    db.prepare('UPDATE sessions SET expires = ? WHERE token_hash = ?').run(now() + SESSION_TTL, row.token_hash);
  }
  return row;
}
function destroySession(db, req) {
  const t = readCookie(req, COOKIE);
  if (t) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(t));
}

/* ---------------- guards ---------------- */
// Seller scope. Platform-admin sessions may act as any tenant via the
// x-tenant header ("view as seller", D25) — every such write is audited
// with actor='admin' by the callers below.
function seller(db, req) {
  const s = getSession(db, req);
  if (!s) return null;
  if (s.role === 'admin') {
    const slug = safeSlug(req.headers['x-tenant']);
    if (!slug) return null;
    const t = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(slug);
    if (!t) return null;
    return { tenant: t, user: null, actor: 'admin', session: s };
  }
  const t = db.prepare('SELECT * FROM tenants WHERE id = ?').get(s.tenant_id);
  if (!t || t.status === 'closed' || t.status === 'suspended') return null;
  const u = s.user_id ? db.prepare('SELECT * FROM users WHERE id = ?').get(s.user_id) : null;
  if (!u || u.status !== 'active') return null;
  return { tenant: t, user: u, actor: 'seller', session: s };
}
function admin(db, req) {
  const s = getSession(db, req);
  return s && s.role === 'admin' ? s : null;
}

/* ---------------- rate limiting ---------------- */
// Naive in-memory sliding buckets — fine for one process on one ECS.
const buckets = new Map();
setInterval(() => {
  const t = now();
  for (const [k, v] of buckets) if (v.reset < t) buckets.delete(k);
}, 60e3).unref();
function rateLimit(bucket, key, max, windowMs) {
  const k = bucket + ':' + key;
  const t = now();
  let b = buckets.get(k);
  if (!b || b.reset < t) { b = { n: 0, reset: t + windowMs }; buckets.set(k, b); }
  b.n++;
  return b.n <= max;
}

/* ---------------- audit ---------------- */
function audit(db, o) {
  try {
    db.prepare('INSERT INTO audit (ts,tenant_id,user_id,actor,action,target,detail,ip) VALUES (?,?,?,?,?,?,?,?)')
      .run(now(), o.tenantId || null, o.userId || null, o.actor || 'seller', o.action,
        String(o.target || '').slice(0, 120), String(o.detail || '').slice(0, 500), String(o.ip || '').slice(0, 45));
  } catch (e) {}
}

function ipOf(req) {
  // Caddy/nginx sits in front on the ECS; trust its forwarded header, fall back to socket.
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || (req.socket && req.socket.remoteAddress) || '';
}

module.exports = {
  json, err, readBody, readJson,
  id, hexId, orderCode, now, today, clean, cleanText, num, int,
  validSlug, safeSlug, RESERVED,
  hashPass, verifyPass,
  createSession, setSessionCookie, clearSessionCookie, getSession, destroySession,
  seller, admin, rateLimit, audit, ipOf, COOKIE,
};
