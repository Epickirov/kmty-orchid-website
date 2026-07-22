/* 蝴蝶兰批发市场 — the cross-seller platform home.
   Search (server LIKE) + client-side spec filters over the full active
   catalogue; product cards deep-link into the seller storefront
   (/s/<slug>?p=<id> auto-opens the product); RFQ goes to the platform. */
'use strict';

const root = $('#app');
let DATA = null;
const F = { q: '', stage: '', size: '', color: '', sort: 'default' };

async function boot(q) {
  try {
    DATA = await API.get('/api/market' + (q ? '?q=' + encodeURIComponent(q) : ''), { quiet: true });
  } catch (e) {
    root.innerHTML = '';
    root.append(h('div', { class: 'empty', style: 'padding-top:120px' }, '市场暂时不可用，请稍后再试'));
    return;
  }
  render();
}

function render() {
  const { products, sellers, stats } = DATA;
  root.innerHTML = '';

  /* ---------- hero ---------- */
  const searchIn = h('input', { type: 'search', value: F.q, placeholder: '搜品种 / 颜色 / 关键词，如 大辣椒', enterkeyhint: 'search' });
  searchIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
  function doSearch() { F.q = searchIn.value.trim(); boot(F.q); }
  root.append(h('header', { class: 'mhero' },
    h('div', { class: 'bg' }),
    h('div', { class: 'in' },
      h('div', { class: 'plat' }, 'KMTY 星商 · 蝴蝶兰批发平台'),
      h('h1', null, '云南基地直发的', h('b', null, '蝴蝶兰批发市场')),
      h('p', { class: 'sub' }, '规格透明 · 阶梯批发价 · 在线询价，微信成交 — 花店、婚庆、批发商的一站式货源。'),
      h('div', { class: 'searchbar' }, searchIn,
        h('button', { class: 'go', onclick: doSearch }, '搜索')),
      h('div', { class: 'statband' },
        h('div', { class: 'st' }, h('div', { class: 'n' }, stats.sellers), h('div', { class: 'l' }, '入驻基地')),
        h('div', { class: 'st' }, h('div', { class: 'n' }, stats.products), h('div', { class: 'l' }, '在售规格')),
        h('div', { class: 'st' }, h('div', { class: 'n' }, (stats.stock / 10000 >= 1 ? (Math.round(stats.stock / 1000) / 10) + ' 万' : stats.stock.toLocaleString('zh-CN'))), h('div', { class: 'l' }, '现货存量(株)'))))));

  // compact sticky search once the hero scrolls away
  const stickyIn = h('input', { type: 'search', value: F.q, placeholder: '搜品种 / 颜色…', enterkeyhint: 'search' });
  stickyIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { F.q = stickyIn.value.trim(); boot(F.q); } });
  const msticky = h('div', { class: 'msticky' }, h('div', { class: 'in' },
    h('span', { class: 'mk' }, 'KMTY ', h('b', { style: 'color:var(--acc)' }, '星商')), stickyIn));
  root.append(msticky);
  if ('IntersectionObserver' in window) {
    const hero = root.querySelector('.mhero');
    const io = new IntersectionObserver((es) => msticky.classList.toggle('show', !es[0].isIntersecting), { rootMargin: '-60px 0px 0px 0px' });
    io.observe(hero);
  }

  const wrap = h('div', { class: 'mwrap' });
  root.append(wrap);

  /* ---------- sellers rail ---------- */
  if (sellers.length) {
    wrap.append(sect('入驻基地'));
    wrap.append(h('div', { class: 'sellerrail' }, sellers.map((s) =>
      h('a', { class: 'scard rv', href: '/s/' + s.slug },
        h('div', { class: 'bn', style: s.banner ? 'background-image:url(' + s.banner + ')' : 'background:linear-gradient(120deg,color-mix(in srgb,' + s.accent + ' 30%,#221a2c),#221a2c)' }),
        h('div', { class: 'bd' },
          s.logo ? h('img', { class: 'lg', src: s.logo, alt: '' }) : h('span', { class: 'lg ph' }, s.name[0]),
          h('div', { class: 'nm' }, s.name, ' ', s.verified ? h('span', { class: 'badge ok', style: 'font-size:9px' }, '✓ 认证') : null),
          s.tagline ? h('div', { class: 'tg' }, s.tagline) : null,
          h('div', { class: 'mt' },
            h('span', null, s.products + ' 款在售'),
            s.stock ? h('span', null, '现货 ' + s.stock.toLocaleString('zh-CN') + ' 株') : null,
            s.shipsFrom ? h('span', null, s.shipsFrom) : null))))));
  }

  /* ---------- RFQ band ---------- */
  wrap.append(h('div', { class: 'rfqband rv' },
    h('div', { class: 't' }, '按清单采购？发布求购单'),
    h('div', { class: 's' }, '填一张需求清单（品种 · 规格 · 数量），平台对接匹配的基地来报价 — 适合婚庆项目与批量采购。'),
    h('button', { class: 'btn acc', onclick: () => rfqSheet('kmty', '') }, '发布求购')));

  /* ---------- catalogue ---------- */
  wrap.append(sect('全部现货', null, products.length));
  const stages = [...new Set(products.map((p) => p.stage).filter(Boolean))];
  const sizes = [...new Set(products.map((p) => p.sizeSpec).filter(Boolean))];
  const colors = [...new Set(products.map((p) => p.colorFamily).filter(Boolean))];
  const bar = h('div', { class: 'filters colorchips' });
  const mk = (label, key, val, dot) => h('span', {
    class: 'chip' + (F[key] === val ? ' on' : ''),
    onclick: () => { F[key] = F[key] === val ? '' : val; render(); },
  }, dot ? colorDot(val, 11) : null, label);
  colors.forEach((c) => bar.append(mk(c, 'color', c, true)));
  stages.forEach((s) => bar.append(mk(s, 'stage', s)));
  sizes.forEach((s) => bar.append(mk(s, 'size', s)));
  bar.append(h('span', {
    class: 'chip' + (F.sort === 'price' ? ' on' : ''),
    onclick: () => { F.sort = F.sort === 'price' ? 'default' : 'price'; render(); },
  }, '价格 ↑'));
  wrap.append(bar);

  let list = products.filter((p) =>
    (!F.stage || p.stage === F.stage) && (!F.size || p.sizeSpec === F.size) && (!F.color || p.colorFamily === F.color));
  if (F.sort === 'price') {
    list = list.slice().sort((a, b) => {
      const pa = a.price && a.price.mode === 'public' ? a.price.price : Infinity;
      const pb = b.price && b.price.mode === 'public' ? b.price.price : Infinity;
      return pa - pb;
    });
  }
  if (!list.length) {
    wrap.append(h('div', { class: 'empty' }, h('div', { class: 'big', style: 'color:var(--acc)' }, '❀'),
      F.q ? '没有找到「' + F.q + '」相关现货 — 试试发布求购？' : '没有符合筛选的现货',
      h('div', null, h('button', { class: 'btn solid', onclick: () => rfqSheet('kmty', '') }, '发布求购'))));
  } else {
    wrap.append(h('div', { class: 'grid' }, list.map((p, i) => card(p, i))));
  }

  /* ---------- footer ---------- */
  root.append(h('footer', { class: 'shopfoot' },
    h('div', { class: 'rule' }),
    h('div', { class: 'mk' }, 'KMTY 星商 · 蝴蝶兰批发市场'),
    h('div', { class: 'rowlinks' },
      h('a', { class: 'btn small ghost', href: '/seller' }, '我是基地 · 免费开店'),
      ' ',
      h('button', { class: 'btn small ghost', onclick: () => rfqSheet('kmty', '') }, '我要求购')),
    h('div', null, '下单即询价，交易在微信中完成 · 无需在线支付'),
    h('div', { style: 'margin-top:8px' },
      h('a', { href: 'https://www.kmtyorchid.com' }, '关于 KMTY'),
      DATA.icp ? h('span', null, ' · ', h('a', { href: 'https://beian.miit.gov.cn', target: '_blank', rel: 'noopener' }, DATA.icp)) : null)));

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

function card(p, i) {
  const url = '/s/' + p.seller.slug + '?p=' + p.id;
  const el = h('a', { class: 'pcard rv', href: url, style: 'transition-delay:' + ((i % 4) * 60) + 'ms;display:block;color:inherit;text-decoration:none' },
    h('div', { class: 'ph' },
      p.media.length ? h('img', { src: p.media[0], loading: 'lazy', alt: p.title }) : '❀',
      p.featured ? h('span', { class: 'ft' }, '主推') : null),
    h('div', { class: 'bd' },
      h('div', { class: 't' }, p.title),
      h('div', { class: 'specs' },
        [p.grade, p.sizeSpec, p.stage, p.flowerCount ? p.flowerCount + '梗' : '', p.spikeLen ? '梗长' + p.spikeLen + 'cm' : '']
          .filter(Boolean).map((s) => h('span', null, s))),
      p.rating && p.rating.n > 0 ? h('div', { class: 'rating' }, '★ ' + p.rating.avg, h('span', { class: 'n' }, '(' + p.rating.n + ')')) : null,
      priceLine(p),
      h('div', { class: 'mcardseller' },
        p.colorFamily ? colorDot(p.colorFamily, 10) : null,
        h('span', null, p.seller.name),
        p.seller.verified ? h('span', { class: 'vv' }, '✓') : null,
        p.qty > 0 ? h('span', { class: 'right', style: 'color:#7d7389' }, '现货 ' + p.qty.toLocaleString('zh-CN') + ' 株') : null)));
  return el;
}

function priceLine(p) {
  const pi = p.price || { mode: 'hidden' };
  if (pi.mode === 'public') {
    return h('div', { class: 'price' },
      h('span', { class: 'cur' }, '¥'),
      h('span', { class: 'v' }, (Math.round(pi.price * 100) / 100).toLocaleString('zh-CN')),
      h('span', { class: 'u' }, '/株'),
      pi.tiers && pi.tiers.length ? h('span', { class: 'tier' }, '≥' + pi.tiers[0].min + ' ' + money(pi.tiers[0].price)) : null);
  }
  if (pi.mode === 'on_request') return h('div', { class: 'price' }, h('span', { class: 'ask' }, '询价 ›'));
  return h('div', { class: 'price' }, h('span', { class: 'u', style: 'font-size:12.5px' }, '详询卖家'));
}

boot('');
