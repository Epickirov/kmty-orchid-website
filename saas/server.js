#!/usr/bin/env node
// KMTY Orchid Storefronts — single-process app server.
//
//   node server.js          (env: PORT, DATA_DIR, ADMIN_PASS, BASE_URL)
//
// Serves: the JSON API (lib/api.js), uploaded media (/m/*), the three new
// UIs (web/seller, web/shop, web/admin), and the legacy order pages from the
// repo root (constellation page at / and /r/<id>, stock tool at /stock) so
// this one process fully replaces the Cloudflare worker at cutover.
// Zero npm dependencies; state = one SQLite file + a media directory.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { open } = require('./lib/db');
const api = require('./lib/api');
const media = require('./lib/media');

const ROOT = __dirname;                                   // saas/
const REPO = path.join(ROOT, '..');                       // repo root (legacy pages)
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const PORT = parseInt(process.env.PORT || '8787', 10);
const ENV = {
  ADMIN_PASS: process.env.ADMIN_PASS || '',
  BASE_URL: process.env.BASE_URL || 'https://order.kmtyorchid.com',
};

const db = open(DATA_DIR);
const ctx = { db, dataDir: DATA_DIR, env: ENV };

/* ---------------- static files ---------------- */
const MIME = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg',
  jpeg: 'image/jpeg', webp: 'image/webp', ico: 'image/x-icon', woff2: 'font/woff2', txt: 'text/plain; charset=utf-8',
};
function sendFile(res, abs, cache) {
  fs.readFile(abs, (e, buf) => {
    if (e) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
    const ext = abs.slice(abs.lastIndexOf('.') + 1).toLowerCase();
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': cache || 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    res.end(buf);
  });
}
function sendShell(res, abs, inject) {
  fs.readFile(abs, 'utf8', (e, html) => {
    if (e) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
    if (inject) html = html.replace('</head>', '<script>' + inject + '</script></head>');
    res.writeHead(200, { 'content-type': MIME.html, 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' });
    res.end(html);
  });
}
const SAFE_SEG = /^[a-zA-Z0-9._-]+$/;
function safeJoin(base, rel) {
  const parts = rel.split('/').filter(Boolean);
  for (const p of parts) if (!SAFE_SEG.test(p) || p === '..') return null;
  return path.join(base, ...parts);
}

/* ---------------- request routing ---------------- */
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;

  try {
    // API first
    if (p.startsWith('/api/')) {
      const handled = await api.handle(req, res, ctx);
      if (!handled) { res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"error":"not found"}'); }
      return;
    }

    // uploaded media
    if (p.startsWith('/m/')) return media.serve(DATA_DIR, p, res);

    // storefronts: /s/<slug>, and wildcard tenant subdomains <slug>.kmtyorchid.com
    const host = String(req.headers.host || '').split(':')[0];
    const sub = /^([a-z0-9_-]+)\.kmtyorchid\.com$/.exec(host);
    const hostSlug = sub && !['www', 'order', 'mail', 'admin', 'api'].includes(sub[1]) ? sub[1] : null;
    const sm = /^\/s\/([a-z0-9_-]+)\/?$/.exec(p);
    if (sm || (hostSlug && (p === '/' || p === ''))) {
      const slug = sm ? sm[1] : hostSlug;
      return sendShell(res, path.join(ROOT, 'web/shop/index.html'), 'window.__SLUG__=' + JSON.stringify(slug) + ';');
    }

    // app shells
    if (p === '/market' || p === '/market/') return sendShell(res, path.join(ROOT, 'web/market/index.html'));
    if (p === '/seller' || p === '/seller/') return sendShell(res, path.join(ROOT, 'web/seller/index.html'));
    if (p === '/reseller' || p === '/reseller/') { res.writeHead(301, { location: '/seller' }); return res.end(); }
    if (p === '/admin' || p === '/admin/') return sendShell(res, path.join(ROOT, 'web/admin/index.html'));

    // static files of the new UIs (/assets/*, /seller/app.js, /shop/*, /admin/*)
    const uiMatch = /^\/(assets|seller|shop|admin|market)\/(.+)$/.exec(p);
    if (uiMatch) {
      const abs = safeJoin(path.join(ROOT, 'web', uiMatch[1]), uiMatch[2]);
      if (!abs) { res.writeHead(400); return res.end(); }
      return sendFile(res, abs, 'public, max-age=300');
    }

    // legacy order pages (byte-identical files from the repo root) so this
    // server is a drop-in replacement for the Pages project at cutover
    if (p === '/' || p === '/order' || /^\/r\/[a-z0-9_-]+\/?$/.test(p)) {
      return sendFile(res, path.join(REPO, 'constellation.html'));
    }
    if (p === '/stock' || p === '/stock/') return sendFile(res, path.join(REPO, 'stock.html'));

    // legacy static assets referenced by those pages (images, fonts, …)
    const abs = safeJoin(REPO, p);
    if (abs && fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      return sendFile(res, abs, 'public, max-age=3600');
    }

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  } catch (e) {
    if (!res.headersSent) { res.writeHead(500, { 'content-type': 'text/plain' }); res.end('server error'); }
  }
});

server.listen(PORT, () => {
  console.log('[kmty-saas] listening on :' + PORT + '  data=' + DATA_DIR + (ENV.ADMIN_PASS ? '' : '  (ADMIN_PASS not set — admin console disabled)'));
});

// nightly SQLite backup into DATA_DIR/backups (keep 14)
function backup() {
  try {
    const dir = path.join(DATA_DIR, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, 'app-' + new Date().toISOString().slice(0, 10) + '.db');
    db.exec("VACUUM INTO '" + dest.replace(/'/g, "''") + "'");
    const all = fs.readdirSync(dir).filter((f) => f.startsWith('app-')).sort();
    while (all.length > 14) fs.unlinkSync(path.join(dir, all.shift()));
    console.log('[kmty-saas] backup ok → ' + dest);
  } catch (e) { console.error('[kmty-saas] backup failed', e.message); }
}
setInterval(backup, 24 * 3600e3).unref();
setTimeout(backup, 60e3).unref();   // one shortly after boot
