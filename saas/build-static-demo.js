#!/usr/bin/env node
// Builds a fully static, read-only snapshot of the marketplace + storefronts
// into ../netlify-demo/ — hostable on any static host (Netlify) with zero
// backend. GET APIs are pre-dumped to JSON; a small shim replays them and
// stubs writes with a demo notice. Used to show the platform publicly while
// the real server waits for the ICP verdict (netlify.app domain — no
// interaction with kmtyorchid.com or the filing).
//   node build-static-demo.js
'use strict';
const { spawn, execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = __dirname;
const OUT = path.join(ROOT, '..', 'netlify-demo');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'kmty-static-'));
const PORT = 9800 + Math.floor(Math.random() * 150);
const B = 'http://127.0.0.1:' + PORT;
const SLUGS = ['lanyuan', 'yunling', 'dounan'];

const san = (u) => u.replace(/^\//, '').replace(/[^a-zA-Z0-9]/g, '_');

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'demo-data'), { recursive: true });

  execSync('node --no-warnings ' + path.join(ROOT, 'seed.js') + ' --demo', { env: { ...process.env, DATA_DIR: DATA }, stdio: 'pipe' });
  const srv = spawn('node', ['--no-warnings', path.join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, ADMIN_PASS: 'x' } });
  process.on('exit', () => { try { srv.kill(); } catch (e) {} });
  await new Promise((r) => setTimeout(r, 900));

  const getText = async (p) => await (await fetch(B + p)).text();
  const getJson = async (p) => await (await fetch(B + p)).json();

  /* ---- shells (inject the static shim right after ui.js) ---- */
  const SHIM = '<script src="/assets/ui.js"></script>\n<script src="/assets/static-shim.js"></script>';
  const putShell = (dir, html) => {
    fs.mkdirSync(path.join(OUT, dir), { recursive: true });
    fs.writeFileSync(path.join(OUT, dir, 'index.html'),
      html.replace('<script src="/assets/ui.js"></script>', SHIM));
  };
  putShell('market', await getText('/market'));
  for (const s of SLUGS) putShell('s/' + s, await getText('/s/' + s));

  /* ---- API dumps ---- */
  const dump = async (p) => {
    const j = await getJson(p);
    fs.writeFileSync(path.join(OUT, 'demo-data', san(p) + '.json'), JSON.stringify(j));
    return j;
  };
  const mkt = await dump('/api/market');
  const pids = new Set();
  for (const s of SLUGS) {
    const shop = await dump('/api/shop/' + s);
    shop.products.forEach((p) => { if (p.rating && p.rating.n) pids.add(p.id); });
  }
  mkt.products.forEach((p) => { if (p.rating && p.rating.n) pids.add(p.id); });
  for (const id of pids) await dump('/api/reviews?product=' + id);

  /* ---- static assets ---- */
  const cp = (from, to) => { fs.mkdirSync(path.dirname(path.join(OUT, to)), { recursive: true }); fs.copyFileSync(from, path.join(OUT, to)); };
  const W = path.join(ROOT, 'web');
  for (const f of ['ui.css', 'store.css', 'ui.js', 'store.js']) cp(path.join(W, 'assets', f), 'assets/' + f);
  cp(path.join(W, 'assets/fonts/fraunces.woff2'), 'assets/fonts/fraunces.woff2');
  for (const f of ['app.js', 'hero.jpg', 'hero-m.jpg']) cp(path.join(W, 'market', f), 'market/' + f);
  cp(path.join(W, 'shop/app.js'), 'shop/app.js');
  // uploaded media tree
  const mediaRoot = path.join(DATA, 'media');
  for (const dir of fs.readdirSync(mediaRoot)) {
    for (const f of fs.readdirSync(path.join(mediaRoot, dir))) cp(path.join(mediaRoot, dir, f), 'm/' + dir + '/' + f);
  }

  /* ---- the shim ---- */
  fs.writeFileSync(path.join(OUT, 'assets/static-shim.js'), `/* Static demo shim: replays pre-dumped GET APIs, stubs writes. */
'use strict';
window.__STATIC__ = true;
(function () {
  const san = (u) => u.replace(/^\\//, '').replace(/[^a-zA-Z0-9]/g, '_');
  const orig = API.req;
  API.req = async function (method, url, body, opts) {
    if (method === 'GET') {
      // demo search: serve the base market dump, filter client-side
      const mq = /^\\/api\\/market\\?q=(.*)$/.exec(url);
      if (mq) {
        const base = await (await fetch('/demo-data/' + san('/api/market') + '.json')).json();
        const q = decodeURIComponent(mq[1]).toLowerCase();
        return { ...base, products: base.products.filter((p) => (p.title + p.variety).toLowerCase().includes(q)) };
      }
      const r = await fetch('/demo-data/' + san(url) + '.json');
      if (!r.ok) { const e = new Error('演示数据缺失'); e.status = 404; throw e; }
      return r.json();
    }
    if (url === '/api/order') {
      await new Promise((res) => setTimeout(res, 350));
      return { ok: true, id: 'demo', code: 'DEMO88' };
    }
    toast('演示模式 — 此操作在正式版开放', true);
    const e = new Error('演示模式'); e.status = 400; throw e;
  };
  // constellation configurator is not part of the static demo
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest && ev.target.closest('a[href^="/r/"], a[href="/seller"]');
    if (a) { ev.preventDefault(); toast('演示模式 — 该页面在正式版开放'); }
  }, true);
  // demo badge
  addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div');
    b.textContent = '演示数据';
    b.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99;font-size:11px;letter-spacing:.12em;color:#F3EEE4;background:rgba(20,15,26,.85);border:1px solid rgba(231,183,207,.4);border-radius:999px;padding:6px 13px;backdrop-filter:blur(8px);pointer-events:none';
    document.body.append(b);
  });
})();
`);

  /* ---- netlify plumbing ---- */
  fs.writeFileSync(path.join(OUT, '_redirects'),
    '/            /market/   302\n/seller      /market/   302\n/admin       /market/   302\n/r/*         /market/   302\n');
  fs.writeFileSync(path.join(OUT, '_headers'),
    '/assets/*\n  Cache-Control: public, max-age=3600\n/m/*\n  Cache-Control: public, max-age=86400\n/market/hero*.jpg\n  Cache-Control: public, max-age=86400\n');
  fs.writeFileSync(path.join(OUT, 'README.md'),
    '# KMTY 星商 — static marketplace demo\n\nBuilt by `saas/build-static-demo.js`. Read-only snapshot: browse /market and\nthe three demo storefronts; search and filters work; order submission returns\na stubbed code. Host anywhere static (Netlify: drag this folder into\nhttps://app.netlify.com/drop, or point a site\'s publish dir here).\n');

  srv.kill();
  const size = execSync('du -sk ' + OUT).toString().split('\t')[0];
  console.log('static demo built → netlify-demo/ (' + Math.round(size / 1024 * 10) / 10 + ' MB)');
  process.exit(0);
})().catch((e) => { console.error('BUILD FAILED', e); process.exit(1); });
