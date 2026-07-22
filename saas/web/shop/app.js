/* 店铺 — buyer-facing storefront (editorial redesign).
   Slug injected by the server as window.__SLUG__. Inquiry-only: an order
   captures name/phone/qty and hands the buyer to the seller's WeChat with a
   short order code. Fraunces (self-hosted) carries prices/numerals; CJK stays
   on the system stack. All motion respects prefers-reduced-motion. */
'use strict';

const SLUG = window.__SLUG__ || location.pathname.split('/')[2] || '';
const PREVIEW = new URLSearchParams(location.search).get('preview') === '1';
const root = $('#app');
let SHOP = null, PRODUCTS = [], ICP = '';
const F = { stage: '', size: '', sort: 'default' };

async function boot() {
  let data;
  try {
    data = await API.get('/api/shop/' + encodeURIComponent(SLUG) + (PREVIEW ? '?preview=1' : ''), { quiet: true });
  } catch (e) {
    root.innerHTML = '';
    root.append(h('div', { class: 'gatewrap' }, h('div', { class: 'gatebox center' },
      h('div', { style: 'font-size:44px;margin-bottom:12px;color:var(--acc)' }, '❀'),
      h('h2', null, '店铺不存在或未开放'),
      h('p', { class: 'lead' }, '请与卖家确认链接是否正确。'))));
    return;
  }
  SHOP = data.shop; PRODUCTS = data.products; ICP = data.icp || '';
  document.title = SHOP.name + ' · 蝴蝶兰';
  document.documentElement.style.setProperty('--acc', SHOP.brand.accent || '#E7B7CF');
  render();
  const deep = new URLSearchParams(location.search).get('p');
  if (deep) {
    const dp = PRODUCTS.find((x) => x.id === deep);
    if (dp) setTimeout(() => detailSheet(dp), 120);
  }
}

/* aggregate shop rating across products */
function shopRating() {
  let sum = 0, n = 0;
  for (const p of PRODUCTS) if (p.rating && p.rating.n) { sum += p.rating.avg * p.rating.n; n += p.rating.n; }
  return n ? { avg: Math.round(sum / n * 10) / 10, n } : null;
}

const PETAL_SVG = '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.6" xmlns="http://www.w3.org/2000/svg">' +
  [0, 72, 144, 216, 288].map((r) => '<ellipse cx="50" cy="26" rx="13" ry="24" transform="rotate(' + r + ' 50 50)"/>').join('') +
  '<circle cx="50" cy="50" r="6"/></svg>';

function render() {
  const b = SHOP.brand, sv = SHOP.services;
  root.innerHTML = '';

  if (PREVIEW && SHOP.status !== 'active') {
    root.append(h('div', { class: 'banner warn', style: 'margin:0;border-radius:0;text-align:center' }, '预览模式 — 店铺当前对买家不可见'));
  }

  /* ---------- sticky mini header ---------- */
  const sticky = h('div', { class: 'stickybar' }, h('div', { class: 'in' },
    b.logo ? h('img', { src: b.logo, alt: '' }) : null,
    h('span', { class: 'nm grow' }, SHOP.name),
    h('button', { class: 'btn acc small', onclick: contactSheet }, '联系卖家')));
  root.append(sticky);

  /* ---------- hero ---------- */
  const agg = shopRating();
  const trust = h('div', { class: 'trustrow' });
  if (SHOP.verified) trust.append(h('span', { class: 'tchip' }, h('span', { style: 'color:var(--ok)' }, '✓'), '企业认证'));
  if (agg) trust.append(h('span', { class: 'tchip' }, h('span', { class: 'st' }, '★ ' + agg.avg), agg.n + ' 条买家评价'));
  if (b.shipsFrom) trust.append(h('span', { class: 'tchip' }, '📍 ' + b.shipsFrom + ' 直发'));
  const hero = h('header', { class: 'hero' + (b.banner ? ' hasimg' : '') },
    b.banner ? h('div', { class: 'bgimg', style: 'background-image:url(' + b.banner + ')' }) : h('div', { class: 'bggen' }),
    h('div', { class: 'grain' }),
    b.banner ? null : h('div', { class: 'bloomwm', html: PETAL_SVG }),
    h('div', { class: 'in' },
      h('div', { class: 'row', style: 'gap:16px;align-items:flex-start' },
        b.logo ? h('img', { class: 'shoplogo', src: b.logo, alt: '' }) : null,
        h('div', { class: 'grow', style: 'min-width:0' },
          h('h1', { class: 'shopname' }, SHOP.name),
          SHOP.tagline ? h('p', { class: 'shoptag' }, SHOP.tagline) : null),
        h('button', { class: 'btn acc small', style: 'flex:0 0 auto', onclick: contactSheet }, '联系卖家')),
      trust.children.length ? trust : null,
      b.announcement ? h('div', null, h('span', { class: 'annopill' }, h('b', null, '公告'), b.announcement)) : null));
  root.append(hero);

  // sticky bar appears once the hero scrolls away
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      sticky.classList.toggle('show', !es[0].isIntersecting);
    }, { rootMargin: '-60px 0px 0px 0px' });
    io.observe(hero);
  }

  /* ---------- service band ---------- */
  const svcs = [];
  if (sv.shippingIncluded) svcs.push(['🚚', '包邮到家']);
  if (sv.qaRate > 0) svcs.push(['🛡', h('span', null, h('b', null, sv.qaRate + '%'), ' 好苗率质保')]);
  if (sv.replacePolicy) svcs.push(['♻', sv.replacePolicy]);
  if (sv.invoice) svcs.push(['🧾', '可开发票']);
  if (sv.minOrder > 0) svcs.push(['📦', '起订 ' + sv.minOrder + ' 株']);
  if (sv.carrierNote) svcs.push(['🚛', sv.carrierNote]);
  if (svcs.length) {
    root.append(h('div', { class: 'svcband' }, h('div', { class: 'in' },
      svcs.map(([ic, t]) => h('span', { class: 'svc' }, h('span', { class: 'ic' }, ic), t)))));
  }

  const wrap = h('div', { class: 'wrapx' });
  root.append(wrap);

  if (b.about) wrap.append(h('p', { class: 'aboutbox rv' }, b.about));

  /* ---------- constellation module ---------- */
  if (SHOP.constellation) {
    const stars = [[18, 22], [42, 70], [70, 18], [86, 55], [55, 40]].map(([x, y], i) =>
      h('i', { style: 'left:' + x + '%;top:' + y + '%;animation-delay:' + (i * 0.55) + 's' }));
    wrap.append(h('div', { class: 'constcard rv' },
      h('a', { href: '/r/' + SHOP.slug },
        stars,
        h('span', { class: 'star' }, '✨'),
        h('span', { class: 'grow' },
          h('span', { class: 't' }, 'KMTY 星空艺术兰'),
          h('div', { class: 'sub' }, '三色随机星洒 · 每一株都是孤品 · 在线定制配色')),
        h('span', { class: 'muted', style: 'font-size:20px' }, '›'))));
  }

  /* ---------- featured ---------- */
  const featured = PRODUCTS.filter((p) => p.featured);
  if (featured.length) {
    wrap.append(sect('精选'));
    wrap.append(h('div', { class: 'featrail' }, featured.map((p, i) => card(p, i))));
  }

  /* ---------- catalogue ---------- */
  wrap.append(sect('全部商品', null, PRODUCTS.length));
  const stages = [...new Set(PRODUCTS.map((p) => p.stage).filter(Boolean))];
  const sizes = [...new Set(PRODUCTS.map((p) => p.sizeSpec).filter(Boolean))];
  const anyPublic = PRODUCTS.some((p) => p.price && p.price.mode === 'public');
  if (stages.length + sizes.length > 1 || anyPublic) {
    const bar = h('div', { class: 'filters' });
    const mk = (label, key, val) => h('span', {
      class: 'chip' + (F[key] === val ? ' on' : ''),
      onclick: () => { F[key] = F[key] === val ? '' : val; render(); },
    }, label);
    stages.forEach((s) => bar.append(mk(s, 'stage', s)));
    sizes.forEach((s) => bar.append(mk(s, 'size', s)));
    if (anyPublic) bar.append(h('span', {
      class: 'chip' + (F.sort === 'price' ? ' on' : ''),
      onclick: () => { F.sort = F.sort === 'price' ? 'default' : 'price'; render(); },
    }, '价格 ↑'));
    wrap.append(bar);
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
    wrap.append(h('div', { class: 'empty' }, h('div', { class: 'big', style: 'color:var(--acc)' }, '❀'),
      PRODUCTS.length ? '没有符合筛选的商品' : '店铺正在上货中，敬请期待'));
  } else {
    wrap.append(h('div', { class: 'grid' }, list.map((p, i) => card(p, i))));
  }

  /* ---------- RFQ band ---------- */
  wrap.append(h('div', { class: 'rfqband rv', style: 'margin:26px 0 4px;border-radius:18px;padding:20px;position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--acc) 30%,transparent);background:radial-gradient(120% 160% at 100% 0%,color-mix(in srgb,var(--acc) 18%,transparent),transparent 55%),#1a1420' },
    h('div', { style: 'font-family:var(--display);font-weight:640;font-size:18px' }, '按清单批量询价'),
    h('div', { style: 'color:#b9aec4;font-size:13px;margin:4px 0 12px' }, '一次填多行需求（品种 · 规格 · 数量），' + SHOP.name + ' 统一给你报价。'),
    h('button', { class: 'btn acc', onclick: () => rfqSheet(SHOP.slug, SHOP.name) }, '立即批量询价')));

  /* ---------- footer ---------- */
  root.append(h('footer', { class: 'shopfoot' },
    h('div', { class: 'rule' }),
    h('div', { class: 'mk' }, SHOP.company || SHOP.name),
    h('div', { class: 'rowlinks' },
      h('button', { class: 'btn small ghost', onclick: () => reviewSheet() }, '📝 已购评价 · 确认收货'),
      ' ',
      h('a', { class: 'btn small ghost', href: '/market' }, '⌂ 批发市场 · 更多基地')),
    h('div', null, '下单即询价，交易在微信中完成 · 无需在线支付'),
    h('div', { style: 'margin-top:8px' },
      h('a', { href: 'https://www.kmtyorchid.com' }, '技术支持 · KMTY 星商'),
      ICP ? h('span', null, ' · ', h('a', { href: 'https://beian.miit.gov.cn', target: '_blank', rel: 'noopener' }, ICP)) : null)));

  revealInit();
}

function sect(zh, en, cnt) {
  return h('div', { class: 'sect' },
    h('span', { class: 'zh' }, zh),
    en ? h('span', { class: 'en' }, en) : null,
    h('span', { class: 'rule' }),
    cnt != null ? h('span', { class: 'cnt' }, cnt + ' 款') : null);
}

function revealInit() {
  const els = $all('.rv');
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((es) => {
    es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -6% 0px' });
  els.forEach((e) => io.observe(e));
}

/* ---------- product card ---------- */

function card(p, i) {
  const el = h('div', { class: 'pcard rv', role: 'button', tabindex: 0, style: 'transition-delay:' + ((i % 4) * 60) + 'ms', onclick: () => detailSheet(p) },
    h('div', { class: 'ph' },
      p.media.length ? h('img', { src: p.media[0], loading: 'lazy', alt: p.title }) : '❀',
      p.featured ? h('span', { class: 'ft' }, '主推') : null),
    h('div', { class: 'bd' },
      h('div', { class: 't' }, p.title),
      h('div', { class: 'specs' }, [p.grade, p.sizeSpec, p.stage, p.flowerCount ? p.flowerCount + '梗' : '', p.spikeLen ? '梗长' + p.spikeLen + 'cm' : ''].filter(Boolean).map((s) => h('span', null, s))),
      p.rating && p.rating.n > 0 ? h('div', { class: 'rating' }, '★ ' + p.rating.avg, h('span', { class: 'n' }, '(' + p.rating.n + ')')) : null,
      priceLine(p),
      p.qty > 0 ? h('div', { class: 'stock' }, '现货 ' + p.qty.toLocaleString('zh-CN') + ' 株') : null));
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') detailSheet(p); });
  return el;
}

function priceLine(p) {
  const pi = p.price || { mode: 'hidden' };
  if (pi.mode === 'public') {
    return h('div', { class: 'price' },
      h('span', { class: 'cur' }, '¥'),
      h('span', { class: 'v' }, (Math.round(pi.price * 100) / 100).toLocaleString('zh-CN')),
      h('span', { class: 'u' }, '/株'),
      pi.tiers && pi.tiers.length ? h('span', { class: 'tier' }, '≥' + pi.tiers[0].min + '株 ' + money(pi.tiers[0].price)) : null);
  }
  if (pi.mode === 'on_request') return h('div', { class: 'price' }, h('span', { class: 'ask' }, '询价 ›'));
  return h('div', { class: 'price' }, h('span', { class: 'u', style: 'font-size:12.5px' }, '详询卖家'));
}

/* ---------- lightbox ---------- */

let _lb;
function lightbox(src) {
  if (!_lb) {
    _lb = h('div', { class: 'lightbox', onclick: () => _lb.classList.remove('show') }, h('img', { alt: '' }));
    document.body.append(_lb);
  }
  _lb.querySelector('img').src = src;
  requestAnimationFrame(() => _lb.classList.add('show'));
}

/* ---------- product detail ---------- */

function detailSheet(p) {
  const pi = p.price || { mode: 'hidden' };

  const gal = p.media.length
    ? h('div', { class: 'gal' }, p.media.map((u) => h('img', { src: u, alt: p.title, onclick: () => lightbox(u) })))
    : h('div', { class: 'gal' }, h('div', { class: 'noimg' }, '❀'));
  const thumbs = p.media.length > 1
    ? h('div', { class: 'thumbs' }, p.media.map((u, i) =>
        h('img', { src: u, class: i === 0 ? 'on' : '', alt: '', onclick: () => gal.scrollTo({ left: i * gal.clientWidth, behavior: 'smooth' }) })))
    : null;
  if (thumbs) {
    gal.addEventListener('scroll', debounce(() => {
      const i = Math.round(gal.scrollLeft / gal.clientWidth);
      $all('img', thumbs).forEach((t, j) => t.classList.toggle('on', j === i));
    }, 60), { passive: true });
  }

  const specs = [
    ['品种', p.variety], ['色系', p.colorFamily], ['等级', p.grade], ['盆径', p.sizeSpec],
    ['苗期', p.stage], ['梗数', p.flowerCount ? p.flowerCount + ' 梗' : ''],
    ['梗长', p.spikeLen ? p.spikeLen + ' cm' : ''],
    ['现货', p.qty > 0 ? p.qty.toLocaleString('zh-CN') + ' 株' : ''],
  ].filter(([, v]) => v);

  const priceBlock = pi.mode === 'public'
    ? h('div', null,
        h('div', { class: 'pricehero' },
          h('span', { class: 'cur' }, '¥'),
          h('span', { class: 'v' }, (Math.round(pi.price * 100) / 100).toLocaleString('zh-CN')),
          h('span', { class: 'u' }, '/株起 · 按量优惠')),
        pi.tiers && pi.tiers.length ? h('table', { class: 'tiertable' },
          h('tr', null, h('td', null, '1 株起'), h('td', null, money(pi.price))),
          pi.tiers.map((t) => h('tr', null, h('td', null, '≥ ' + t.min.toLocaleString('zh-CN') + ' 株'), h('td', null, money(t.price))))) : null)
    : h('div', { class: 'banner info', style: 'margin:12px 0 4px' },
        pi.mode === 'on_request' ? '价格以询价为准 — 提交询单后卖家微信报价' : '规格详询卖家');

  const body = h('div', null,
    gal, thumbs,
    h('div', { class: 'pdbody' },
      h('div', { class: 'pdtitle' }, p.title),
      priceBlock,
      specs.length ? h('div', { class: 'specgrid' }, specs.map(([k, v]) =>
        h('div', { class: 'sg' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v)))) : null,
      p.descr ? h('div', { class: 'pddesc' }, p.descr) : null,
      reviewsBlock(p)),
    h('div', { class: 'stickycta' },
      h('button', { class: 'ctabtn', onclick: () => { sh.close(); orderSheet(p); } },
        pi.mode === 'public' ? '立即询单' : '询价 · 下询单')));
  const sh = sheet(body);
  sh.el.querySelector('.sheet').classList.add('pd');
}

/* ---------- reviews on the product page ---------- */

function reviewsBlock(p) {
  if (!p.rating || !p.rating.n) return null;
  const box = h('div', { style: 'margin:8px 0 4px' },
    h('div', { class: 'sect', style: 'margin:14px 0 6px' },
      h('span', { class: 'zh', style: 'font-size:16px' }, '买家评价'),
      h('span', { class: 'rule' }),
      h('span', { class: 'cnt' }, '★ ' + p.rating.avg + ' · ' + p.rating.n + ' 条')),
    h('div', { class: 'skel', style: 'height:56px' }));
  API.get('/api/reviews?product=' + p.id, { quiet: true }).then((d) => {
    box.lastChild.remove();
    d.reviews.forEach((r) => {
      box.append(h('div', { class: 'rvrow' },
        h('div', { class: 'row', style: 'gap:8px' },
          h('span', { class: 'rvstars' }, '★★★★★'.slice(0, r.stars)),
          h('span', { class: 'small' }, r.buyer),
          h('span', { class: 'badge ok', style: 'font-size:10px' }, '✓ 已购'),
          h('span', { class: 'small muted right' }, new Date(r.created).toLocaleDateString('zh-CN'))),
        r.text ? h('div', { class: 'small', style: 'margin-top:5px;line-height:1.75;color:#d9d1e0' }, r.text) : null,
        r.photos.length ? h('div', { class: 'rvphotos' },
          r.photos.map((u) => h('img', { src: u, loading: 'lazy', alt: '', onclick: (e) => { e.stopPropagation(); lightbox(u); } }))) : null));
    });
  }).catch(() => {});
  return box;
}

/* ---------- order flow ---------- */

function orderSheet(p) {
  const pi = p.price || { mode: 'hidden' };
  const min = Math.max(1, SHOP.services.minOrder || 1);
  let qty = min;

  const qtyIn = h('input', { type: 'number', inputmode: 'numeric', value: qty, min: 1 });
  const sumEl = h('div', { class: 'livesum accent' });
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
    h('button', { class: 'ctabtn', onclick: submit }, '提交询单'));
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
  const petals = [12, 30, 55, 74, 90].map((x, i) =>
    h('span', { class: 'petal', style: 'left:' + x + '%;animation-delay:' + (i * 0.8) + 's;font-size:' + (11 + (i % 3) * 4) + 'px' }, '❀'));
  const body = h('div', { class: 'center' },
    h('h2', { style: 'margin-top:6px' }, '询单已提交 🎉'),
    h('div', { class: 'ticket' },
      petals,
      h('p', { class: 'small muted', style: 'margin:0 0 4px' }, '你的订单号 · 发给卖家'),
      h('div', { class: 'codebig copy', onclick: () => copyText(code) }, code),
      h('button', { class: 'btn small', style: 'margin-top:10px', onclick: () => copyText(code) }, '复制订单号')),
    qr ? h('div', null,
      h('p', { class: 'small', style: 'margin:6px 0 0' }, '长按识别 / 截图扫码，加卖家微信'),
      h('div', { class: 'qrframe' }, h('img', { src: qr, alt: '卖家微信二维码' }))) : null,
    w ? h('div', { style: 'margin-top:6px' },
      h('p', { class: 'small muted', style: 'margin:0 0 6px' }, qr ? '或搜索微信号' : '添加卖家微信'),
      h('div', { class: 'code copy frx', style: 'display:inline-block', onclick: () => copyText(w) }, w),
      h('div', null, h('button', { class: 'btn small', style: 'margin-top:8px', onclick: () => copyText(w) }, '复制微信号'))) : null,
    (!qr && !w) ? h('p', { class: 'small muted' }, '卖家会尽快电话联系你。') : null,
    h('p', { class: 'small muted', style: 'margin-top:12px' }, '成交收货后，回到本店点「已购评价」打星晒图（收货 5 天内可传实拍图）。'),
    h('button', { class: 'btn block ghost', style: 'margin-top:10px', onclick: () => sh.close() }, '继续逛店'));
  const sh = sheet(body, { dismiss: false });
}

function contactSheet() {
  const w = SHOP.wechat, qr = SHOP.brand.wechatQr;
  const body = h('div', { class: 'center' },
    h('h2', null, '联系 ' + SHOP.name),
    qr ? h('div', { class: 'qrframe' }, h('img', { src: qr, alt: '微信二维码' })) : null,
    w ? h('div', null,
      h('p', { class: 'small muted', style: 'margin:8px 0 6px' }, '微信号'),
      h('div', { class: 'code copy frx', style: 'display:inline-block', onclick: () => copyText(w) }, w),
      h('div', null, h('button', { class: 'btn small', style: 'margin-top:10px', onclick: () => copyText(w) }, '复制微信号'))) : null,
    (!qr && !w) ? h('p', { class: 'small muted' }, '通过任意商品「询单」留下手机号，卖家会联系你。') : null);
  sheet(body);
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
    h('button', { class: 'ctabtn', onclick: lookup }, '查找我的订单'),
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
      h('button', { class: 'ctabtn', onclick: async () => {
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
    const starRow = h('div', { class: 'row', style: 'gap:8px;font-size:34px;justify-content:center;cursor:pointer;margin:6px 0' });
    for (let i = 1; i <= 5; i++) {
      const b = h('span', { role: 'button', style: 'color:var(--line2);transition:transform .15s,color .15s', onclick: () => {
        stars = i;
        Array.from(starRow.children).forEach((x, j) => {
          x.style.color = j < i ? 'var(--gold)' : 'var(--line2)';
          x.style.transform = j < i ? 'scale(1.12)' : 'none';
        });
      } }, '★');
      starRow.append(b);
    }
    const txt = h('textarea', { placeholder: '货怎么样？包装、花况、发货速度…（选填）', style: 'min-height:80px' });
    step2.append(
      h('h2', { style: 'font-size:16px;margin-top:8px' }, '评价 · ' + o.title),
      starRow,
      h('label', { class: 'f' }, txt),
      h('button', { class: 'ctabtn', onclick: async () => {
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

boot();
