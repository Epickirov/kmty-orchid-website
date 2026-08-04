#!/usr/bin/env node
/* e2e suite (growth kit). Spawns the server on a random port with a fresh
   DATA_DIR and drives the real UIs with Playwright.
     node saas/test-e2e-growth.js
   Requires Playwright. The require path below is absolute for the container it
   was written in — change it to just 'playwright' if installed via npm locally. */
'use strict';
const { spawn, execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const REPO = '/home/user/kmty-orchid-website';
const DATA = path.join(__dirname, 'growth-data');
const SHOTS = path.join(__dirname, 'growth-shots');
const PORT = 9000 + Math.floor(Math.random() * 800);
const BASE = 'http://127.0.0.1:' + PORT;
const results = [];

function ok(name, cond, extra) {
  results.push([cond ? 'PASS' : 'FAIL', name, extra || '']);
  console.log((cond ? '✅' : '❌') + ' ' + name + (extra ? '  — ' + extra : ''));
  if (!cond) process.exitCode = 1;
}

const CSV = [
  '商品名称,品种,等级,盆径,苗期,色系,花朵数,花梗(cm),库存,价格,阶梯价,描述',
  '导入测试 红花,大辣椒,特级,2.5寸,开花株,玫红,12,55,800,26,50:25;200:23,双杆齐开',
  '导入测试 白花,V3,A级,2.0寸,开花株,白,10,48,1500,¥22,100:21;500:19,基地直发',
  '导入测试 中苗,,B级,1.7寸,中苗,复色,,,3000,6.5,,当年苗',
  ',缺名字的行,B级,1.7寸,,,,,10,5,,应被跳过',
  '导入测试 坏价格,,A级,2.0寸,开花株,粉,,,20,约二十块,,价格无法解析',
].join('\n');

(async () => {
  fs.rmSync(DATA, { recursive: true, force: true });
  fs.rmSync(SHOTS, { recursive: true, force: true });
  fs.mkdirSync(SHOTS, { recursive: true });
  execSync('node --no-warnings ' + path.join(REPO, 'saas/seed.js') + ' --demo',
    { env: { ...process.env, DATA_DIR: DATA }, stdio: 'pipe' });

  const server = spawn('node', ['--no-warnings', path.join(REPO, 'saas/server.js')], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, ADMIN_PASS: 'e2e-admin' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => console.error('[server]', String(d).trim()));
  process.on('exit', () => { try { server.kill(); } catch (e) {} });
  await new Promise((r) => setTimeout(r, 900));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 430, height: 940 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message)));
  // the gate probes /api/me before login, so an expected 401 is not a failure
  page.on('console', (m) => { if (m.type() === 'error' && !/401/.test(m.text())) errs.push('console: ' + m.text()); });

  /* ---------- login ---------- */
  await page.goto(BASE + '/seller', { waitUntil: 'networkidle' });
  await page.fill('#g-slug', 'lanyuan');
  await page.fill('#g-pass', 'demo888');
  await page.click('button:has-text("登 录")');
  await page.waitForSelector('#tabbar', { timeout: 8000 });
  ok('seller login', true);

  const before = (await (await fetch(BASE + '/api/shop/lanyuan')).json()).products.length;

  /* ---------- QR encoder is live in the page ---------- */
  const qrLive = await page.evaluate(() => {
    const m = QR.encode('https://kmtyorchid.com/s/lanyuan', { ecc: 'M' });
    return { size: m.size, version: m.version, dark: m.rows.flat().filter(Boolean).length };
  });
  ok('qr.js loaded in seller page', qrLive.size === 29 && qrLive.version === 3, 'v' + qrLive.version + ' ' + qrLive.size + 'px, ' + qrLive.dark + ' dark modules');

  /* ---------- bulk import ---------- */
  await page.click('button[data-tab="products"]');
  await page.waitForSelector('button:has-text("批量导入")');
  await page.click('button:has-text("批量导入")');
  await page.waitForSelector('.sheet textarea');
  await page.fill('.sheet textarea', CSV);
  await page.waitForSelector('.improw');

  const badge = await page.textContent('.sheet .badge.ok');
  ok('preview counts importable rows', /可导入 4/.test(badge), badge);
  const skipBadge = await page.$$eval('.sheet .badge', (els) => els.map((e) => e.textContent));
  ok('preview flags skipped row', skipBadge.some((t) => /跳过 1/.test(t)), skipBadge.join(' | '));
  ok('preview flags unparsable price', skipBadge.some((t) => /价格不是数字/.test(t)), skipBadge.filter((t) => /不是数字/.test(t)).join());
  const mapped = await page.textContent('.sheet .small.muted');
  ok('header mapping recognised', /名称/.test(mapped) && /阶梯价/.test(mapped) && /花梗/.test(mapped), mapped);

  await page.screenshot({ path: path.join(SHOTS, '01-import.png'), fullPage: false });

  // publish straight away
  await page.click('.sheet .tgl input');
  await page.click('.sheet button:has-text("导入 4 个商品")');
  await page.waitForSelector('.sheetwrap', { state: 'detached', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);

  const shop = await (await fetch(BASE + '/api/shop/lanyuan')).json();
  ok('imported products are live on the storefront', shop.products.length === before + 4,
    before + ' → ' + shop.products.length);

  const cookie = (await ctx.cookies()).find((c) => c.name === 'kmty_s');
  const authGet = async (p) => (await fetch(BASE + p, { headers: { cookie: cookie.name + '=' + cookie.value } })).json();
  const mine = (await authGet('/api/products')).products;
  const red = mine.find((p) => p.title === '导入测试 红花');
  ok('specs survived the round trip', !!red && red.grade === '特级' && red.sizeSpec === '2.5寸' && red.spikeLen === 55 && red.flowerCount === 12,
    red ? [red.grade, red.sizeSpec, red.spikeLen, red.flowerCount].join('/') : 'missing');
  ok('tier prices parsed', !!red && red.tiers.length === 2 && red.tiers[0].min === 50 && red.tiers[0].price === 25,
    red ? JSON.stringify(red.tiers) : '—');
  const white = mine.find((p) => p.title === '导入测试 白花');
  ok('¥ prefix stripped from price', !!white && white.price === 22, white ? String(white.price) : '—');
  const badPrice = mine.find((p) => p.title === '导入测试 坏价格');
  ok('unparsable price imported as 询价, row kept', !!badPrice && badPrice.price == null, badPrice ? String(badPrice.price) : 'missing');
  ok('publish toggle put them straight on sale', !!red && red.status === 'active', red ? red.status : '—');

  /* ---------- server rejects what the client would not send ---------- */
  const post = (body) => fetch(BASE + '/api/products/bulk', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookie.name + '=' + cookie.value },
    body: JSON.stringify(body),
  });
  const r1 = await post({ rows: [{ title: '' }, { title: '直接调用' }] });
  const j1 = await r1.json();
  ok('server re-validates titles', r1.ok && j1.created === 1 && j1.skipped.length === 1, JSON.stringify(j1).slice(0, 90));
  const r2 = await post({ rows: [] });
  ok('server rejects an empty import', r2.status === 400, 'HTTP ' + r2.status);
  const r3 = await fetch(BASE + '/api/products/bulk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"rows":[{"title":"无票"}]}' });
  ok('bulk import requires a session', r3.status === 401, 'HTTP ' + r3.status);
  const r4 = await post({ rows: [{ title: 'x', qty: 99999999999, price: -5, spikeLen: 9999 }] });
  ok('out-of-range numbers are clamped, not stored raw', r4.ok, 'HTTP ' + r4.status);
  const clamped = (await authGet('/api/products')).products.find((p) => p.title === 'x');
  ok('clamped values are sane', !!clamped && clamped.qty <= 9999999 && clamped.spikeLen <= 300 && (clamped.price == null || clamped.price >= 0),
    clamped ? 'qty=' + clamped.qty + ' spike=' + clamped.spikeLen + ' price=' + clamped.price : 'missing');

  /* ---------- poster ---------- */
  await page.click('button[data-tab="shop"]');
  await page.waitForSelector('button:has-text("门店海报")');
  await page.click('button:has-text("门店海报")');
  await page.waitForSelector('.sheet img[src^="blob:"]', { timeout: 10000 });

  const poster = await page.evaluate(async () => {
    const cv = document.createElement('canvas');
    return await (async () => {
      const c = await renderPoster();
      const ctx = c.getContext('2d');
      // sample the QR area: compare drawn pixels with a fresh encode
      const link = location.origin + '/s/' + S.me.tenant.slug;
      const m = QR.encode(link, { ecc: 'M' });
      const box = Math.floor(560 / (m.size + 8));
      // poster geometry: card x = (1080-660)/2, qr starts at cardX + (660-560)/2
      const cardX = (1080 - 660) / 2;
      const qx = cardX + (660 - 560) / 2, qy0 = 0;
      // find the card's y: first run of 40 solid-white pixels down the middle
      let cardY = -1;
      const col = ctx.getImageData(540, 0, 1, 1620).data;
      const white = (y) => col[y * 4] > 245 && col[y * 4 + 1] > 245 && col[y * 4 + 2] > 245;
      for (let y = 200; y < 1580; y++) {
        if (white(y)) {
          let run = 0;
          while (run < 40 && white(y + run)) run++;
          if (run === 40) { cardY = y; break; }
        }
      }
      const qy = cardY + 46;
      let match = 0, total = 0;
      for (let r = 0; r < m.size; r += 2) {
        for (let cc = 0; cc < m.size; cc += 2) {
          const px = ctx.getImageData(Math.round(qx + (cc + 4) * box + box / 2), Math.round(qy + (r + 4) * box + box / 2), 1, 1).data;
          const isDark = px[0] < 128;
          if (isDark === !!m.rows[r][cc]) match++;
          total++;
        }
      }
      return { w: c.width, h: c.height, cardY, match, total, box, size: m.size, link };
    })();
  });
  ok('poster canvas is 1080×1620', poster.w === 1080 && poster.h === 1620, poster.w + '×' + poster.h);
  ok('poster QR renders the storefront link exactly', poster.match === poster.total,
    poster.match + '/' + poster.total + ' modules @ ' + poster.box + 'px, link ' + poster.link);
  await page.screenshot({ path: path.join(SHOTS, '02-poster.png') });

  /* ---------- price sheet ---------- */
  await page.click('.sheet button:has-text("关闭")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("报价单")');
  await page.waitForSelector('.sheet .imp .ck');
  const picked = await page.$$eval('.sheet .imp input[type=checkbox]', (els) => els.filter((e) => e.checked).length);
  ok('price sheet preselects live products', picked > 0, picked + ' selected');
  await page.click('.sheet button:has-text("生成报价单")');
  await page.waitForSelector('.sheet img[src^="blob:"]', { timeout: 12000 });
  const sheetGeom = await page.evaluate(async () => {
    const { products } = await API.get('/api/products');
    const rows = products.filter((p) => ['active', 'paused', 'draft'].includes(p.status)).slice(0, 24);
    const cvs = await renderPriceSheet(rows, { withPrice: true });
    return { pages: cvs.length, w: cvs[0].width, h: cvs[0].height, rows: rows.length };
  });
  ok('price sheet height tracks row count', sheetGeom.h === 300 + sheetGeom.rows * 104 + 300,
    sheetGeom.rows + ' rows → ' + sheetGeom.w + '×' + sheetGeom.h);
  const paging = await page.evaluate(async () => {
    const fake = Array.from({ length: 30 }, (_, i) => ({ title: 'P' + i, qty: 10, price: 9, tiers: [] }));
    const cvs = await renderPriceSheet(fake, { withPrice: true });
    return cvs.length;
  });
  ok('long lists paginate at 24 rows', paging === 2, paging + ' pages for 30 rows');
  await page.screenshot({ path: path.join(SHOTS, '03-pricesheet.png') });

  /* ---------- no page errors ---------- */
  ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  await browser.close();
  server.kill();
  const fail = results.filter((r) => r[0] === 'FAIL');
  console.log('\n' + (results.length - fail.length) + '/' + results.length + ' checks passed');
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(1); });
