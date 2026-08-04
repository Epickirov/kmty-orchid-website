#!/usr/bin/env node
/* e2e suite (full platform). Spawns the server on a random port with a fresh
   DATA_DIR and drives the real UIs with Playwright.
     node saas/test-e2e.js
   Requires Playwright. The require path below is absolute for the container it
   was written in — change it to just 'playwright' if installed via npm locally. */
'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { DatabaseSync } = require('node:sqlite');

const REPO = '/home/user/kmty-orchid-website';
const DATA = path.join(__dirname, 'e2e-data');
const SHOTS = path.join(__dirname, 'shots');
const PORT = 9000 + Math.floor(Math.random() * 800);
const BASE = 'http://127.0.0.1:' + PORT;
const results = [];
const pageErrors = [];

function ok(name, cond, extra) {
  results.push([cond ? 'PASS' : 'FAIL', name, extra || '']);
  console.log((cond ? '✅' : '❌') + ' ' + name + (extra ? '  — ' + extra : ''));
  if (!cond) process.exitCode = 1;
}

(async () => {
  fs.rmSync(DATA, { recursive: true, force: true });
  fs.rmSync(SHOTS, { recursive: true, force: true });
  fs.mkdirSync(SHOTS, { recursive: true });

  const server = spawn('node', ['--no-warnings', path.join(REPO, 'saas/server.js')], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, ADMIN_PASS: 'e2e-admin-pass' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => console.error('[server]', String(d).trim()));
  process.on('exit', () => { try { server.kill(); } catch (e) {} });
  await new Promise((r) => setTimeout(r, 900));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'zh-CN' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => pageErrors.push('seller/shop: ' + e.message));

  /* ---------- 1. signup ---------- */
  await page.goto(BASE + '/seller');
  await page.getByText('还没有店铺？免费开店').click();
  await page.getByPlaceholder('3–32 位小写字母/数字，如 lanyuan').fill('e2eshop');
  await page.getByPlaceholder('如 兰源花业').fill('测试兰园');
  await page.getByPlaceholder('用于联系与找回账号').fill('13900001111');
  await page.locator('#s-pass').fill('pass8888');
  await page.getByText('创建店铺', { exact: true }).click();
  await page.waitForSelector('text=开店清单', { timeout: 8000 });
  ok('signup → live dashboard immediately (no approval gate)', true);

  /* ---------- 2. brand: wechat ---------- */
  await page.goto(BASE + '/seller#/shop');
  const wxIn = page.getByPlaceholder('客户询单后引导添加的微信号');
  await wxIn.fill('testlan-wx');
  await wxIn.blur();
  await page.waitForSelector('text=已保存', { timeout: 5000 });
  ok('brand kit saves (wechat id)', true);

  /* ---------- 3. product create + photo + tiers + publish ---------- */
  await page.goto(BASE + '/seller#/products');
  await page.getByText('上传第一个商品').click();
  await page.getByPlaceholder('如：大辣椒 3.5寸 开花株 双梗').fill('大辣椒 3.5寸 开花株 双梗');
  const sheetEl = page.locator('.sheet');
  await sheetEl.getByText('A级', { exact: true }).click();
  await sheetEl.getByText('开花株', { exact: true }).click();
  await sheetEl.getByText('3.5寸', { exact: true }).click();
  await page.getByPlaceholder('如：大辣椒 / 富乐夕阳 / V3').fill('大辣椒');
  await sheetEl.getByPlaceholder('如 2').fill('2');
  await sheetEl.getByPlaceholder('0').fill('5000');
  await sheetEl.getByPlaceholder('单价 ¥/株').fill('18.5');
  await sheetEl.getByText('＋ 加一档批发价').click();
  await sheetEl.getByPlaceholder('数量≥').fill('500');
  await sheetEl.getByPlaceholder('单价', { exact: true }).fill('17');
  // photo upload (auto-saves draft first)
  await sheetEl.locator('input[type=file]').setInputFiles(path.join(REPO, 'images/art-06-peach.jpg'));
  await page.waitForSelector('.mcell img', { timeout: 15000 });
  ok('photo uploads through editor (client compression)', true);
  await sheetEl.getByText('保存并上架').click();
  await page.waitForSelector('text=已上架', { timeout: 8000 });
  await page.waitForSelector('.badge.active', { timeout: 8000 });
  ok('product published → live instantly (在售, no review)', true);
  await page.screenshot({ path: path.join(SHOTS, '4-seller-products.png') });

  /* ---------- 4. storefront live with NO admin involvement ---------- */
  const preShop = await (await page.request.get(BASE + '/api/shop/e2eshop')).json();
  ok('storefront public immediately, product live, no admin step', preShop.shop && preShop.products.length === 1, 'products=' + (preShop.products || []).length);

  /* ---------- 4b. admin feed + takedown/restore ---------- */
  const actx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'zh-CN' });
  const ap = await actx.newPage();
  ap.on('pageerror', (e) => pageErrors.push('admin: ' + e.message));
  await ap.goto(BASE + '/admin');
  await ap.getByPlaceholder('平台管理密码').fill('e2e-admin-pass');
  await ap.getByText('进入', { exact: true }).click();
  await ap.waitForSelector('text=最新店铺', { timeout: 8000 });
  await ap.waitForSelector('text=最新商品', { timeout: 8000 });
  ok('admin feed shows new shop + new product', true);
  await ap.screenshot({ path: path.join(SHOTS, '6-admin-queue.png') });
  await ap.locator('.trow', { hasText: '大辣椒' }).getByText('下架', { exact: true }).click();
  await ap.locator('.sheet').getByText('下架', { exact: true }).click();
  await ap.waitForSelector('text=已下架', { timeout: 6000 });
  const downShop = await (await ap.request.get(BASE + '/api/shop/e2eshop')).json();
  ok('takedown removes product from storefront', downShop.products.length === 0, 'products=' + downShop.products.length);
  await ap.locator('.trow', { hasText: '大辣椒' }).getByText('恢复', { exact: true }).click();
  await ap.waitForSelector('text=已恢复上架', { timeout: 6000 });
  const upShop = await (await ap.request.get(BASE + '/api/shop/e2eshop')).json();
  ok('restore puts product back', upShop.products.length === 1, 'products=' + upShop.products.length);

  /* ---------- 5. storefront ---------- */
  await page.goto(BASE + '/s/e2eshop');
  await page.waitForSelector('.shopname', { timeout: 8000 });
  const shopName = await page.locator('.shopname').innerText();
  ok('storefront renders shop name', shopName.includes('测试兰园'), shopName.trim());
  const priceTxt = await page.locator('.pcard .price .v').first().innerText();
  ok('public price shown on card', priceTxt.includes('18.5'), priceTxt);
  await page.screenshot({ path: path.join(SHOTS, '1-shop-top.png') });
  await page.locator('.pcard').first().click();
  await page.waitForSelector('text=立即询单', { timeout: 6000 });
  const tierRows = await page.locator('.tiertable tr').count();
  ok('detail sheet shows tier table (base + 1 tier)', tierRows === 2, String(tierRows));
  await page.screenshot({ path: path.join(SHOTS, '2-shop-detail.png') });
  await page.getByText('立即询单').click();
  await page.getByPlaceholder('怎么称呼你').fill('王先生');
  await page.getByPlaceholder('手机号（卖家联系你用）').fill('13711112222');
  // qty via stepper input
  await page.locator('.qty input').fill('800');
  const sum = await page.locator('.sheet .accent').innerText();
  ok('tier price auto-applies at qty 800 (¥17/株)', sum.includes('17') && sum.includes('800'), sum.slice(0, 60));
  await page.getByText('提交询单').click();
  await page.waitForSelector('.codebig', { timeout: 8000 });
  const code = (await page.locator('.codebig').innerText()).trim();
  ok('order success panel with code + wechat', /^[A-Z2-9]{6}$/.test(code), code);
  const wxShown = await page.locator('text=testlan-wx').count();
  ok('seller wechat surfaced to buyer', wxShown > 0);
  await page.screenshot({ path: path.join(SHOTS, '3-shop-success.png') });

  /* ---------- 6. seller pipeline ---------- */
  await page.goto(BASE + '/seller#/orders');
  await page.waitForSelector('text=王先生', { timeout: 8000 });
  await page.getByText('开始洽谈').click();
  await page.waitForSelector('text=已更新', { timeout: 6000 });
  await page.locator('.ptabs .chip', { hasText: '洽谈中' }).click();
  await page.waitForSelector('text=王先生', { timeout: 6000 });
  await page.getByText('标记成交').click();
  await page.waitForSelector('text=已更新', { timeout: 6000 });
  await page.locator('.ptabs .chip', { hasText: '已成交' }).click();
  await page.waitForSelector('text=标记送达', { timeout: 6000 });
  await page.getByText('标记送达').click();
  await page.waitForSelector('text=送达日期', { timeout: 6000 });
  await page.locator('.sheet').getByText('确认', { exact: true }).click();
  await page.waitForSelector('text=已标记送达', { timeout: 6000 });
  await page.locator('.ptabs .chip', { hasText: '已送达' }).click();
  await page.waitForSelector('.badge.delivered', { timeout: 6000 });
  ok('order lifecycle placed→talking→completed→delivered', true);
  await page.screenshot({ path: path.join(SHOTS, '5-seller-orders.png') });

  /* ---------- 6b. buyer review flow (stars + text + photo) ---------- */
  await page.goto(BASE + '/s/e2eshop');
  await page.waitForSelector('.shopname', { timeout: 8000 });
  await page.getByText('已购评价').click();
  await page.getByPlaceholder('下单时填写的手机号').fill('13711112222');
  await page.getByText('查找我的订单').click();
  await page.waitForSelector('.sheet .item', { timeout: 6000 });
  await page.locator('.sheet .item').first().click();
  // order already delivered by the seller → straight to the star form
  await page.waitForSelector('text=发布评价', { timeout: 6000 });
  await page.locator('.sheet span[role=button]').nth(4).click();   // 5th star
  await page.locator('.sheet textarea').fill('苗很壮，包装到位，年宵还会再订');
  await page.getByText('发布评价').click();
  await page.waitForSelector('text=收货 5 天内可上传实拍图', { timeout: 6000 });
  await page.locator('.sheet input[type=file]').setInputFiles(path.join(REPO, 'images/art-07-aurora.jpg'));
  await page.waitForSelector('.sheet .mcell img', { timeout: 15000 });
  ok('buyer review posted with photo through UI', true);
  await page.getByText('完成', { exact: true }).click();
  await page.goto(BASE + '/s/e2eshop');
  await page.waitForSelector('.pcard', { timeout: 8000 });
  const starTxt = await page.locator('.pcard .bd').first().innerText();
  ok('storefront card shows ★5 aggregate', starTxt.includes('★ 5'), starTxt.replace(/\n/g, ' ').slice(0, 60));
  await page.locator('.pcard').first().click();
  await page.waitForSelector('text=买家评价', { timeout: 6000 });
  await page.waitForSelector('text=✓ 已购', { timeout: 6000 });
  ok('detail sheet shows certified review with photo', (await page.locator('.sheet img[loading=lazy]').count()) >= 1);
  await page.screenshot({ path: path.join(SHOTS, '8-shop-review.png') });
  await page.keyboard.press('Escape');

  /* ---------- 6c. buyer-confirm-delivery API path + photo window ---------- */
  const o2 = await (await page.request.post(BASE + '/api/order', {
    headers: { 'content-type': 'application/json' },
    data: { slug: 'e2eshop', productId: preShop.products[0].id, name: '李女士', phone: '13655556666', qty: 120 },
  })).json();
  // seller confirms the deal (seller session lives in this context's cookies)
  const myOrders = await (await page.request.get(BASE + '/api/orders?tab=placed')).json();
  const o2row = myOrders.orders.find((o) => o.code === o2.code);
  await page.request.post(BASE + '/api/orders/' + o2row.id + '/state', {
    headers: { 'content-type': 'application/json' }, data: { to: 'completed' },
  });
  const dl = await (await page.request.post(BASE + '/api/review/deliver', {
    headers: { 'content-type': 'application/json' },
    data: { orderId: o2row.id, phone: '13655556666', deliveryDate: new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10) },
  })).json();
  ok('buyer confirms delivery via API (sets date)', dl.ok === true, JSON.stringify(dl));
  const rv2 = await (await page.request.post(BASE + '/api/review/create', {
    headers: { 'content-type': 'application/json' },
    data: { orderId: o2row.id, phone: '13655556666', stars: 4, text: 'ok' },
  })).json();
  ok('second review created', rv2.ok === true, JSON.stringify(rv2));
  // age the delivery 10 days back directly in SQLite → photo window must be shut
  const edb = new DatabaseSync(path.join(DATA, 'app.db'));
  edb.prepare('UPDATE orders SET delivered_at = ?, delivery_date = ? WHERE id = ?')
    .run(Date.now() - 10 * 86400e3, new Date(Date.now() - 10 * 86400e3 + 8 * 3600e3).toISOString().slice(0, 10), o2row.id);
  edb.close();
  const late = await page.request.post(BASE + '/api/review/photo?order=' + o2row.id + '&phone=13655556666', {
    headers: { 'content-type': 'application/octet-stream' },
    data: fs.readFileSync(path.join(REPO, 'images/art-06-peach.jpg')),
  });
  ok('photo blocked after 5-day window', late.status() === 403, 'status=' + late.status());

  /* ---------- 6d. admin takedown of a review ---------- */
  await ap.goto(BASE + '/admin#/feed');
  await ap.waitForSelector('text=最新评价', { timeout: 8000 });
  await ap.locator('.trow', { hasText: '年宵还会再订' }).getByText('移除', { exact: true }).click();
  await ap.locator('.sheet').getByText('移除', { exact: true }).click();
  await ap.waitForSelector('text=已移除', { timeout: 6000 });
  const rvList = await (await ap.request.get(BASE + '/api/reviews?product=' + preShop.products[0].id)).json();
  ok('review takedown hides it from storefront', rvList.reviews.length === 1 && rvList.rating.n === 1, 'left=' + rvList.reviews.length);

  /* ---------- 6e. marketplace: search → deep-link → detail in ≤3 clicks ---------- */
  await page.goto(BASE + '/market');
  await page.waitForSelector('.mhero', { timeout: 8000 });
  await page.waitForSelector('.pcard', { timeout: 8000 });
  ok('market home renders with product grid', true);
  const sellerChip = await page.locator('.mcardseller').first().innerText();
  ok('market card carries seller identity', sellerChip.includes('测试兰园'), sellerChip.trim().slice(0, 40));
  await page.locator('.searchbar input').fill('大辣椒');
  await page.locator('.searchbar .go').click();
  await page.waitForSelector('.pcard', { timeout: 8000 });
  ok('market search finds by variety keyword', (await page.locator('.pcard').count()) >= 1);
  await page.locator('.pcard').first().click();                       // click 1
  await page.waitForSelector('text=立即询单', { timeout: 8000 });      // deep-link opened detail on storefront
  ok('market card deep-links into storefront product detail (1 click to CTA)', page.url().includes('/s/e2eshop?p='));

  /* ---------- 6f. storefront RFQ (批量询价) ---------- */
  await page.goto(BASE + '/s/e2eshop');
  await page.waitForSelector('text=按清单批量询价', { timeout: 8000 });
  await page.locator('.rfqband button').click();
  const rfqSh = page.locator('.sheet');
  await rfqSh.getByPlaceholder('品种/颜色，如 大辣椒 玫红').fill('大辣椒 玫红');
  await rfqSh.getByPlaceholder('规格，如 3.5寸 双梗').fill('3.5寸 双梗');
  await rfqSh.getByPlaceholder('数量').fill('2000');
  await rfqSh.getByText('＋ 加一行需求').click();
  await rfqSh.getByPlaceholder('品种/颜色，如 大辣椒 玫红').nth(1).fill('V3 白花');
  await rfqSh.getByPlaceholder('数量').nth(1).fill('800');
  await rfqSh.getByPlaceholder('怎么称呼你').fill('陈总');
  await rfqSh.getByPlaceholder('手机号').first().fill('13511113333');
  await rfqSh.getByPlaceholder('到货城市，如 成都').fill('重庆');
  await rfqSh.getByText('提交求购单').click();
  await page.waitForSelector('text=求购单已提交', { timeout: 8000 });
  const rfqCode = (await page.locator('.codebig').innerText()).trim();
  ok('RFQ submits with structured rows', /^[A-Z2-9]{6}$/.test(rfqCode), rfqCode);
  // seller sees the RFQ card with rows
  await page.goto(BASE + '/seller#/orders');
  await page.waitForSelector('text=批量求购', { timeout: 8000 });
  const rfqCard = await page.locator('.item', { hasText: '批量求购' }).innerText();
  ok('seller pipeline renders RFQ rows', rfqCard.includes('大辣椒 玫红') && rfqCard.includes('2,000') && rfqCard.includes('重庆'), rfqCard.replace(/\n/g, ' ').slice(0, 80));

  /* ---------- 7. legacy compat ---------- */
  const legacy = await page.request.get(BASE + '/');
  const legacyHtml = await legacy.text();
  ok('legacy constellation page served at /', legacyHtml.includes('星空艺术兰'));
  const rs = await (await page.request.get(BASE + '/api/reseller?id=e2eshop')).json();
  ok('compat /api/reseller returns branding', rs.name === '测试兰园', JSON.stringify(rs).slice(0, 80));
  const shopHtml = await (await page.request.get(BASE + '/s/e2eshop')).text();
  ok('shop shell injects slug', shopHtml.includes('__SLUG__="e2eshop"'));

  /* ---------- 8. seller home stats ---------- */
  await page.goto(BASE + '/seller#/home');
  await page.waitForSelector('.stats', { timeout: 8000 });
  const orderStat = await page.locator('.stat').nth(1).locator('.n').innerText();
  ok('home stats count all test inquiries (2 orders + 1 RFQ)', orderStat.trim() === '3', orderStat.trim());

  /* ---------- 9. desktop designer shot ---------- */
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' });
  const dp = await dctx.newPage();
  dp.on('pageerror', (e) => pageErrors.push('desktop: ' + e.message));
  // reuse session by copying cookies
  const cookies = await ctx.cookies(BASE);
  await dctx.addCookies(cookies);
  await dp.goto(BASE + '/seller#/shop');
  await dp.waitForSelector('text=店铺装修', { timeout: 8000 });
  await dp.screenshot({ path: path.join(SHOTS, '7-seller-designer-desktop.png') });

  ok('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));

  await browser.close();
  server.kill();
  const fails = results.filter(([s]) => s === 'FAIL').length;
  console.log('\n===== ' + (fails ? fails + ' FAILURES' : 'ALL ' + results.length + ' CHECKS PASSED') + ' =====');
})().catch((e) => { console.error('E2E CRASH:', e); process.exit(1); });
