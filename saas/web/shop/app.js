/* 店铺 — buyer-facing storefront. Slug injected by the server as
   window.__SLUG__ (path /s/<slug> or tenant subdomain). Inquiry-only:
   an order captures name/phone/qty and hands the buyer to the seller's
   WeChat with a short order code. */
'use strict';

const SLUG = window.__SLUG__ || location.pathname.split('/')[2] || '';
const PREVIEW = new URLSearchParams(location.search).get('preview') === '1';
const root = $('#app');
let SHOP = null, PRODUCTS = [];
const F = { stage: '', size: '', sort: 'default' };
let ICP = '';

async function boot() {
  let data;
  try {
    data = await API.get('/api/shop/' + encodeURIComponent(SLUG) + (PREVIEW ? '?preview=1' : ''), { quiet: true });
  } catch (e) {
    root.innerHTML = '';
    root.append(h('div', { class: 'gatewrap' }, h('div', { class: 'gatebox center' },
      h('div', { style: 'font-size:40px;margin-bottom:12px' }, '❀'),
      h('h2', null, '店铺不存在或未开放'),
      h('p', { class: 'lead' }, '请与卖家确认链接是否正确。'))));
    return;
  }
  SHOP = data.shop; PRODUCTS = data.products; ICP = data.icp || '';
  document.title = SHOP.name + ' · 蝴蝶兰批发';
  document.documentElement.style.setProperty('--acc', SHOP.brand.accent || '#E7B7CF');
  render();
}

function render() {
  const b = SHOP.brand, sv = SHOP.services;
  root.innerHTML = '';

  if (PREVIEW && SHOP.status !== 'active') {
    root.append(h('div', { class: 'banner warn', style: 'margin:0;border-radius:0;text-align:center' }, '预览模式 — 店铺当前对买家不可见'));
  }
  if (b.announcement) root.append(h('div', { class: 'anno' }, '📢 ' + b.announcement));

  // header
  root.append(h('div', { class: 'shophead' },
    h('div', { class: 'row', style: 'gap:14px' },
      b.logo ? h('img', { class: 'logo', src: b.logo, alt: '' }) : null,
      h('div', { class: 'grow' },
        h('div', { class: 'shopname' }, SHOP.name, ' ',
          SHOP.verified ? h('span', { class: 'badge ok', style: 'vertical-align:3px' }, '✓ 认证') : null),
        SHOP.tagline ? h('div', { class: 'h-sub', style: 'margin-top:3px' }, SHOP.tagline) : null),
      h('button', { class: 'btn acc small', onclick: contactSheet }, '联系卖家'))));

  if (b.banner) root.append(h('div', { class: 'bannerimg' }, h('img', { src: b.banner, alt: '' })));

  // services strip
  const chips = [];
  if (sv.shippingIncluded) chips.push(['🚚', '包邮']);
  if (sv.qaRate > 0) chips.push(['🛡', h('span', null, h('b', null, sv.qaRate + '%'), ' 好苗率质保')]);
  if (sv.replacePolicy) chips.push(['♻', sv.replacePolicy]);
  if (sv.invoice) chips.push(['🧾', '可开发票']);
  if (sv.minOrder > 0) chips.push(['📦', '起订 ' + sv.minOrder + ' 株']);
  if (b.shipsFrom) chips.push(['📍', b.shipsFrom + ' 发货']);
  if (sv.carrierNote) chips.push(['🚛', sv.carrierNote]);
  if (chips.length) root.append(h('div', { class: 'svcstrip' }, chips.map(([i, t]) => h('span', { class: 'chip' }, i + ' ', t))));

  if (b.about) root.append(h('div', { class: 'aboutbox' }, b.about));

  // constellation module
  if (SHOP.constellation) {
    root.append(h('div', { class: 'constcard' },
      h('a', { href: '/r/' + SHOP.slug },
        h('span', { class: 'star' }, '✨'),
        h('span', { class: 'grow' },
          h('b', { class: 'serif', style: 'font-size:16px' }, 'KMTY 星空艺术兰'),
          h('div', { class: 'small muted' }, '三色随机星洒 · 每一株都是孤品 · 在线定制配色')),
        h('span', { class: 'muted' }, '›'))));
  }

  // featured rail
  const featured = PRODUCTS.filter((p) => p.featured);
  if (featured.length) {
    root.append(h('div', { class: 'secttl' }, '主推 · FEATURED'));
    root.append(h('div', { class: 'featrail' }, featured.map(card)));
  }

  // filters + grid
  const stages = [...new Set(PRODUCTS.map((p) => p.stage).filter(Boolean))];
  const sizes = [...new Set(PRODUCTS.map((p) => p.sizeSpec).filter(Boolean))];
  const anyPublic = PRODUCTS.some((p) => p.price && p.price.mode === 'public');
  root.append(h('div', { class: 'secttl' }, '全部商品 · ' + PRODUCTS.length));
  if (stages.length + sizes.length > 1 || anyPublic) {
    const bar = h('div', { class: 'filters' });
    const mk = (label, key, val) => h('span', {
      class: 'chip' + (F[key] === val ? ' on' : ''),
      onclick: () => { F[key] = F[key] === val ? '' : val; render(); window.scrollTo(0, document.body.scrollHeight * 0); },
    }, label);
    stages.forEach((s) => bar.append(mk(s, 'stage', s)));
    sizes.forEach((s) => bar.append(mk(s, 'size', s)));
    if (anyPublic) bar.append(h('span', {
      class: 'chip' + (F.sort === 'price' ? ' on' : ''),
      onclick: () => { F.sort = F.sort === 'price' ? 'default' : 'price'; render(); },
    }, '价格 ↑'));
    root.append(bar);
  }

  let list = PRODUCTS.filter((p) => (!F.stage || p.stage === F.stage) && (!F.size || p.sizeSpec === F.size));
  if (F.sort === 'price') {
    list = list.slice().sort((a, b) => {
      const pa = a.price && a.price.mode === 'public' ? a.price.price : Infinity;
      const pb = b.price && b.price.mode === 'public' ? b.price.price : Infinity;
      return pa - pb;
    });
  }
  if (!list.length) {
    root.append(h('div', { class: 'empty' }, h('div', { class: 'big' }, '❀'), PRODUCTS.length ? '没有符合筛选的商品' : '店铺正在上货中，敬请期待'));
  } else {
    root.append(h('div', { class: 'grid' }, list.map(card)));
  }

  // footer
  root.append(h('div', { class: 'shopfoot' },
    h('button', { class: 'btn small', style: 'margin-bottom:14px', onclick: () => reviewSheet() }, '📝 已购评价 · 确认收货'),
    h('br'),
    (SHOP.company || SHOP.name),
    h('br'),
    h('span', null, '交易在微信中完成 · 下单即询价，无需在线支付'),
    h('br'),
    h('a', { href: 'https://www.kmtyorchid.com', style: 'color:var(--faint)' }, 'Powered by KMTY 星商'),
    ICP ? h('div', null, h('a', { href: 'https://beian.miit.gov.cn', target: '_blank', rel: 'noopener', style: 'color:var(--faint)' }, ICP)) : null));
}

function card(p) {
  const el = h('div', { class: 'pcard', role: 'button', tabindex: 0, onclick: () => detailSheet(p) },
    h('div', { class: 'ph' },
      p.media.length ? h('img', { src: p.media[0], loading: 'lazy', alt: p.title }) : '❀',
      p.featured ? h('span', { class: 'ft' }, '主推') : null),
    h('div', { class: 'bd' },
      h('div', { class: 't' }, p.title),
      h('div', { class: 'specs' }, [p.grade, p.sizeSpec, p.stage, p.flowerCount ? p.flowerCount + '梗' : ''].filter(Boolean).map((s) => h('span', null, s))),
      p.rating && p.rating.n > 0 ? h('div', { class: 'small', style: 'margin-top:5px;color:var(--warn)' }, '★ ' + p.rating.avg + ' ', h('span', { class: 'muted' }, '(' + p.rating.n + ')')) : null,
      priceLine(p),
      p.qty > 0 ? h('div', { class: 'stock' }, '现货 ' + p.qty.toLocaleString('zh-CN') + ' 株') : null));
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') detailSheet(p); });
  return el;
}

function priceLine(p) {
  const pi = p.price || { mode: 'hidden' };
  if (pi.mode === 'public') {
    const tierHint = pi.tiers && pi.tiers.length ? h('span', { class: 'u' }, '≥' + pi.tiers[0].min + '株 ' + money(pi.tiers[0].price)) : null;
    return h('div', { class: 'price' }, h('span', { class: 'v' }, money(pi.price)), h('span', { class: 'u' }, '/株'), tierHint);
  }
  if (pi.mode === 'on_request') return h('div', { class: 'price' }, h('span', { class: 'ask' }, '询价 ›'));
  return h('div', { class: 'price' }, h('span', { class: 'u', style: 'font-size:12.5px' }, '详询卖家'));
}

/* ---------- product detail ---------- */

function detailSheet(p) {
  const pi = p.price || { mode: 'hidden' };
  const gal = p.media.length
    ? h('div', { class: 'gal' }, p.media.map((u) => h('img', { src: u, alt: p.title })))
    : h('div', { class: 'gal' }, h('div', { style: 'width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:52px;color:var(--faint)' }, '❀'));
  const dots = p.media.length > 1 ? h('div', { class: 'dots' }, p.media.map((_, i) => h('i', { class: i === 0 ? 'on' : '' }))) : null;
  if (dots) {
    gal.addEventListener('scroll', debounce(() => {
      const i = Math.round(gal.scrollLeft / gal.clientWidth);
      $all('i', dots).forEach((d, j) => d.classList.toggle('on', j === i));
    }, 60), { passive: true });
  }

  const rows = [
    ['品种', p.variety], ['等级', p.grade], ['盆径', p.sizeSpec], ['苗期', p.stage],
    ['梗数', p.flowerCount ? p.flowerCount + ' 梗' : ''], ['现货', p.qty > 0 ? p.qty.toLocaleString('zh-CN') + ' 株' : ''],
  ].filter(([, v]) => v);

  const priceBlock = pi.mode === 'public'
    ? h('div', null,
        h('div', { class: 'row', style: 'align-items:baseline;gap:8px' },
          h('span', { class: 'bigprice' }, money(pi.price)), h('span', { class: 'muted small' }, '/株起')),
        pi.tiers && pi.tiers.length ? h('table', { class: 'tiertable' },
          h('tr', null, h('td', { class: 'muted' }, '1 株起'), h('td', null, money(pi.price))),
          pi.tiers.map((t) => h('tr', null, h('td', { class: 'muted' }, '≥ ' + t.min + ' 株'), h('td', null, money(t.price))))) : null)
    : h('div', { class: 'banner info', style: 'margin:8px 0' }, pi.mode === 'on_request' ? '价格以询价为准 — 提交询单后卖家微信报价' : '规格详询卖家');

  const body = h('div', null,
    gal, dots,
    h('h2', { style: 'font-size:19px;margin-top:14px' }, p.title),
    priceBlock,
    rows.length ? h('table', { class: 'spectable' }, rows.map(([k, v]) => h('tr', null, h('td', null, k), h('td', null, v)))) : null,
    p.descr ? h('div', { class: 'small', style: 'color:var(--muted);white-space:pre-line;line-height:1.8' }, p.descr) : null,
    reviewsBlock(p),
    h('div', { class: 'stickycta' },
      h('button', { class: 'btn acc block', style: 'font-size:16px;padding:14px', onclick: () => { sh.close(); orderSheet(p); } },
        pi.mode === 'public' ? '立即询单' : '询价 · 下询单')));
  const sh = sheet(body);
}

/* ---------- order flow ---------- */

function orderSheet(p) {
  const pi = p.price || { mode: 'hidden' };
  const min = Math.max(1, SHOP.services.minOrder || 1);
  let qty = min;

  const qtyIn = h('input', { type: 'number', inputmode: 'numeric', value: qty, min: 1 });
  const sumEl = h('div', { class: 'small accent', style: 'min-height:20px;font-weight:600' });
  function updateSum() {
    qty = Math.max(1, parseInt(qtyIn.value || '1', 10));
    if (pi.mode === 'public') {
      let unit = pi.price;
      for (const t of (pi.tiers || []).slice().sort((a, b) => b.min - a.min)) if (qty >= t.min) { unit = t.price; break; }
      sumEl.textContent = money(unit) + '/株 × ' + qty.toLocaleString('zh-CN') + ' ≈ ' + money(unit * qty) + '（以卖家确认为准）';
    } else sumEl.textContent = '';
  }
  qtyIn.addEventListener('input', updateSum);
  const stepper = h('div', { class: 'qty' },
    h('button', { type: 'button', onclick: () => { qtyIn.value = Math.max(1, (parseInt(qtyIn.value || '1', 10) - (qty >= 100 ? 50 : 10))); updateSum(); } }, '−'),
    qtyIn,
    h('button', { type: 'button', onclick: () => { qtyIn.value = (parseInt(qtyIn.value || '0', 10) + (qty >= 100 ? 50 : 10)); updateSum(); } }, '＋'));
  updateSum();

  const nameIn = h('input', { placeholder: '怎么称呼你', autocomplete: 'name' });
  const phoneIn = h('input', { type: 'tel', placeholder: '手机号（卖家联系你用）', autocomplete: 'tel' });
  const dateIn = h('input', { type: 'date', min: localDate() });
  const noteIn = h('textarea', { placeholder: '颜色偏好、到货城市、用途…（选填）', style: 'min-height:64px' });
  const errEl = h('div', { class: 'ferr' });

  const body = h('div', null,
    h('h2', null, '询单 · ' + p.title),
    h('p', { class: 'small muted', style: 'margin:4px 0 12px' }, '无需在线付款：提交后加卖家微信，报上订单号即可对接。'),
    h('label', { class: 'f' }, h('span', null, '数量（株）' + (SHOP.services.minOrder ? ' · 起订 ' + SHOP.services.minOrder : '')), stepper, sumEl),
    h('label', { class: 'f' }, h('span', null, '称呼 *'), nameIn),
    h('label', { class: 'f' }, h('span', null, '手机号 *'), phoneIn),
    h('label', { class: 'f' }, h('span', null, '期望到货日期（选填）'), dateIn),
    h('label', { class: 'f' }, h('span', null, '留言（选填）'), noteIn),
    errEl,
    h('button', { class: 'btn acc block', style: 'font-size:16px;padding:14px', onclick: submit }, '提交询单'));
  const sh = sheet(body);

  async function submit() {
    errEl.textContent = '';
    if (!nameIn.value.trim()) { errEl.textContent = '请填写称呼'; return; }
    if (phoneIn.value.replace(/\D/g, '').length < 6) { errEl.textContent = '请填写有效手机号'; return; }
    let r;
    try {
      r = await API.post('/api/order', {
        slug: SHOP.slug, productId: p.id, name: nameIn.value.trim(), phone: phoneIn.value.trim(),
        qty: parseInt(qtyIn.value || '1', 10), wishDate: dateIn.value, note: noteIn.value.trim(),
      }, { quiet: true });
    } catch (e) { errEl.textContent = e.message; return; }
    sh.close();
    successSheet(r.code, p);
  }
}

function successSheet(code, p) {
  const w = SHOP.wechat, qr = SHOP.brand.wechatQr;
  const body = h('div', { class: 'center' },
    h('div', { style: 'font-size:40px;margin-top:8px' }, '🎉'),
    h('h2', null, '询单已提交'),
    h('p', { class: 'small muted' }, '你的订单号（截图或复制，发给卖家）'),
    h('div', { class: 'codebig copy', onclick: () => copyText(code) }, code),
    h('button', { class: 'btn small', onclick: () => copyText(code) }, '复制订单号'),
    h('div', { class: 'divider' }),
    qr ? h('div', null,
      h('p', { class: 'small', style: 'margin:0' }, '长按识别 / 截图扫码，加卖家微信'),
      h('img', { class: 'qrimg', src: qr, alt: '卖家微信二维码' })) : null,
    w ? h('div', { style: 'margin-top:6px' },
      h('p', { class: 'small muted', style: 'margin:0 0 6px' }, '或搜索微信号'),
      h('div', { class: 'code copy', style: 'display:inline-block', onclick: () => copyText(w) }, w),
      h('div', null, h('button', { class: 'btn small', style: 'margin-top:8px', onclick: () => copyText(w) }, '复制微信号'))) : null,
    (!qr && !w) ? h('p', { class: 'small muted' }, '卖家会尽快电话联系你。') : null,
    h('p', { class: 'small muted', style: 'margin-top:12px' }, '成交收货后，回到本店点「已购评价」打星晒图（收货 5 天内可传实拍图）。'),
    h('button', { class: 'btn block ghost', style: 'margin-top:10px', onclick: () => sh.close() }, '继续逛店'));
  const sh = sheet(body, { dismiss: false });
}

function reviewsBlock(p) {
  if (!p.rating || !p.rating.n) return null;
  const box = h('div', { style: 'margin:14px 0 4px' },
    h('div', { class: 'secttl', style: 'padding:0;margin:0 0 8px' }, '买家评价 · ' + p.rating.n + ' 条 · ★ ' + p.rating.avg),
    h('div', { class: 'skel', style: 'height:60px' }));
  API.get('/api/reviews?product=' + p.id, { quiet: true }).then((d) => {
    box.lastChild.remove();
    d.reviews.forEach((r) => {
      box.append(h('div', { style: 'border-top:1px solid var(--line);padding:10px 0' },
        h('div', { class: 'row', style: 'gap:8px' },
          h('span', { style: 'color:var(--warn);letter-spacing:2px' }, '★★★★★'.slice(0, r.stars) ),
          h('span', { class: 'small' }, r.buyer),
          h('span', { class: 'badge ok', style: 'font-size:10px' }, '✓ 已购'),
          h('span', { class: 'small muted right' }, new Date(r.created).toLocaleDateString('zh-CN'))),
        r.text ? h('div', { class: 'small', style: 'margin-top:5px;line-height:1.7' }, r.text) : null,
        r.photos.length ? h('div', { style: 'display:flex;gap:6px;overflow-x:auto;margin-top:8px' },
          r.photos.map((u) => h('img', { src: u, loading: 'lazy', style: 'width:84px;height:84px;border-radius:9px;object-fit:cover;border:1px solid var(--line);flex:0 0 auto' }))) : null));
    });
  }).catch(() => {});
  return box;
}

/* ---------- buyer review flow (确认收货 + 评价 + 晒图) ---------- */

function reviewSheet() {
  const phoneIn = h('input', { type: 'tel', placeholder: '下单时填写的手机号', autocomplete: 'tel' });
  const errEl = h('div', { class: 'ferr' });
  const step2 = h('div');
  const body = h('div', null,
    h('h2', null, '已购评价'),
    h('p', { class: 'small muted' }, '输入下单手机号找到你的订单：确认收货、打星评价，收货 5 天内还可上传实拍图。'),
    h('label', { class: 'f' }, phoneIn), errEl,
    h('button', { class: 'btn acc block', onclick: lookup }, '查找我的订单'),
    step2);
  const sh = sheet(body);

  async function lookup() {
    errEl.textContent = '';
    let d;
    try { d = await API.post('/api/review/lookup', { slug: SHOP.slug, phone: phoneIn.value.trim() }, { quiet: true }); }
    catch (e) { errEl.textContent = e.message; return; }
    step2.innerHTML = '';
    if (!d.orders.length) { errEl.textContent = '没有找到已成交的订单（需卖家先确认成交）'; return; }
    d.orders.forEach((o) => {
      const line = h('div', { class: 'item', style: 'cursor:pointer', onclick: () => pick(o) },
        h('div', { class: 'grow' },
          h('div', { class: 't' }, o.title),
          h('div', { class: 'm' }, h('span', { class: 'mono chip' }, o.code), o.qty + ' 株',
            o.status === 'delivered' ? '已收货 ' + o.deliveryDate : '待确认收货',
            o.reviewed ? h('span', { class: 'badge ok' }, '已评价') : null)),
        h('span', { class: 'muted' }, '›'));
      step2.append(line);
    });
  }

  function pick(o) {
    step2.innerHTML = '';
    if (o.reviewed) {
      step2.append(h('p', { class: 'small muted center', style: 'padding:12px' },
        o.photoOpen ? '该订单已评价。仍在晒图期内，可继续传图：' : '该订单已评价，感谢！'));
      if (o.photoOpen) step2.append(photoBox(o));
      return;
    }
    if (o.status !== 'delivered') { confirmDeliver(o); return; }
    if (!o.canReview) { step2.append(h('p', { class: 'small muted center' }, '该订单已超过评价期（收货后 60 天）')); return; }
    rateForm(o);
  }

  function confirmDeliver(o) {
    const dateIn = h('input', { type: 'date', value: localDate(), max: localDate() });
    step2.append(
      h('h2', { style: 'font-size:16px;margin-top:8px' }, '确认收货 · ' + o.code),
      h('p', { class: 'small muted' }, '货收到了？选择实际到货日期（评价与晒图期从这天起算）。'),
      h('label', { class: 'f' }, h('span', null, '到货日期'), dateIn),
      h('button', { class: 'btn acc block', onclick: async () => {
        try {
          await API.post('/api/review/deliver', { orderId: o.id, phone: phoneIn.value.trim(), deliveryDate: dateIn.value }, { quiet: true });
        } catch (e) { errEl.textContent = e.message; return; }
        toast('已确认收货 ✓');
        o.status = 'delivered'; o.deliveryDate = dateIn.value; o.canReview = true; o.photoOpen = true;
        step2.innerHTML = '';
        rateForm(o);
      } }, '确认收货'));
  }

  function rateForm(o) {
    let stars = 0;
    const starRow = h('div', { class: 'row', style: 'gap:6px;font-size:30px;justify-content:center;cursor:pointer' });
    for (let i = 1; i <= 5; i++) {
      const b = h('span', { role: 'button', style: 'color:var(--line2)', onclick: () => {
        stars = i;
        Array.from(starRow.children).forEach((x, j) => { x.style.color = j < i ? 'var(--warn)' : 'var(--line2)'; });
      } }, '★');
      starRow.append(b);
    }
    const txt = h('textarea', { placeholder: '货怎么样？包装、花况、发货速度…（选填）', style: 'min-height:80px' });
    step2.append(
      h('h2', { style: 'font-size:16px;margin-top:8px' }, '评价 · ' + o.title),
      starRow,
      h('label', { class: 'f' }, txt),
      h('button', { class: 'btn acc block', onclick: async () => {
        if (!stars) { errEl.textContent = '请点星打分'; return; }
        errEl.textContent = '';
        try { await API.post('/api/review/create', { orderId: o.id, phone: phoneIn.value.trim(), stars, text: txt.value }, { quiet: true }); }
        catch (e) { errEl.textContent = e.message; return; }
        toast('评价已发布 ✓');
        step2.innerHTML = '';
        step2.append(h('p', { class: 'small ok center', style: 'padding:8px' }, '评价已发布！收货 5 天内可上传实拍图：'));
        step2.append(photoBox(o));
      } }, '发布评价'));
  }

  function photoBox(o) {
    const grid = h('div', { class: 'mgrid' });
    const fileIn = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: async () => {
      for (const file of Array.from(fileIn.files).slice(0, 6)) {
        const cell = h('div', { class: 'mcell' }, h('div', { class: 'prog', style: 'width:40%' }));
        grid.insertBefore(cell, grid.lastChild);
        try {
          const { blob } = await compressImage(file);
          const r = await API.post('/api/review/photo?order=' + o.id + '&phone=' + encodeURIComponent(phoneIn.value.trim()), blob, { quiet: true });
          cell.innerHTML = ''; cell.append(h('img', { src: r.url }));
        } catch (e) { cell.remove(); errEl.textContent = e.message; }
      }
      fileIn.value = '';
    } });
    grid.append(h('div', { class: 'mcell add', role: 'button', onclick: () => fileIn.click() }, '＋'));
    return h('div', null, grid, fileIn,
      h('button', { class: 'btn block ghost small', style: 'margin-top:10px', onclick: () => sh.close() }, '完成'));
  }
}

function contactSheet() {
  const w = SHOP.wechat, qr = SHOP.brand.wechatQr;
  const body = h('div', { class: 'center' },
    h('h2', null, '联系 ' + SHOP.name),
    qr ? h('img', { class: 'qrimg', src: qr, alt: '微信二维码' }) : null,
    w ? h('div', null,
      h('p', { class: 'small muted', style: 'margin:8px 0 6px' }, '微信号'),
      h('div', { class: 'code copy', style: 'display:inline-block', onclick: () => copyText(w) }, w),
      h('div', null, h('button', { class: 'btn small', style: 'margin-top:10px', onclick: () => copyText(w) }, '复制微信号'))) : null,
    (!qr && !w) ? h('p', { class: 'small muted' }, '通过任意商品「询单」留下手机号，卖家会联系你。') : null);
  sheet(body);
}

boot();
