/* 卖家中心 — seller dashboard.
   Views: 总览 home · 商品 products · 询单 orders · 店铺 shop · 设置 settings.
   Vanilla DOM via h() from /assets/ui.js; hash routing so back works. */
'use strict';

const S = { me: null, products: null, orders: null, counts: {}, tab: 'placed', stats: null };
const AS = new URLSearchParams(location.search).get('as') || '';
if (AS) API.headers['x-tenant'] = AS;

const root = $('#app');

/* ================= boot / gate ================= */

async function boot() {
  try {
    S.me = await API.get('/api/me', { quiet: true });
    appShell();
    route();
  } catch (e) {
    gate(e.status === 403 ? (e.body && e.body.error) : '');
  }
}

function gate(err) {
  document.title = '卖家中心 · KMTY 星商';
  let mode = 'login';
  root.innerHTML = '';
  const errEl = h('div', { class: 'ferr center' }, err || '');
  const loginBox = h('div', null,
    h('label', { class: 'f' }, h('span', null, '店铺代号 · ID'),
      h('input', { id: 'g-slug', autocapitalize: 'none', autocomplete: 'username', placeholder: '如 lanyuan' })),
    h('label', { class: 'f' }, h('span', null, '密码'),
      h('input', { id: 'g-pass', type: 'password', autocomplete: 'current-password', enterkeyhint: 'go' })),
    h('button', { class: 'btn solid block', style: 'margin-top:6px', onclick: doLogin }, '登 录'));
  const signupBox = h('div', { hidden: true },
    h('label', { class: 'f' }, h('span', null, '店铺代号（登录用，也是你的店铺链接）'),
      h('input', { id: 's-slug', autocapitalize: 'none', placeholder: '3–32 位小写字母/数字，如 lanyuan' }),
      h('div', { class: 'fhint' }, '店铺链接将是 order.kmtyorchid.com/s/代号')),
    h('label', { class: 'f' }, h('span', null, '店铺名称'),
      h('input', { id: 's-name', placeholder: '如 兰源花业' })),
    h('label', { class: 'f' }, h('span', null, '手机号'),
      h('input', { id: 's-phone', type: 'tel', placeholder: '用于联系与找回账号' })),
    h('label', { class: 'f' }, h('span', null, '设置密码（至少 6 位）'),
      h('input', { id: 's-pass', type: 'password', autocomplete: 'new-password', enterkeyhint: 'go' })),
    h('button', { class: 'btn solid block', style: 'margin-top:6px', onclick: doSignup }, '创建店铺'),
    h('p', { class: 'fhint center', style: 'margin-top:10px' }, '创建即开张：上传商品立即上架，把链接发给客户就能收询单。'));
  const toggle = h('button', { class: 'btn ghost block small', style: 'margin-top:12px', onclick: () => {
    mode = mode === 'login' ? 'signup' : 'login';
    loginBox.hidden = mode !== 'login';
    signupBox.hidden = mode !== 'signup';
    toggle.textContent = mode === 'login' ? '还没有店铺？免费开店 →' : '← 已有店铺，去登录';
    errEl.textContent = '';
  } }, '还没有店铺？免费开店 →');

  root.append(h('div', { class: 'gatewrap' },
    h('div', { class: 'gatebox' },
      h('div', { class: 'center' },
        h('div', { class: 'mark', style: 'font-size:24px' }, 'KMTY ', h('b', null, '星商')),
        h('div', { class: 'tag', style: 'margin-top:4px' }, 'ORCHID STOREFRONTS')),
      h('h2', { class: 'center' }, '卖家中心'),
      h('p', { class: 'lead center' }, '蝴蝶兰批发 · 你自己的线上门店'),
      loginBox, signupBox, errEl, toggle)));
  const sl = $('#g-slug'), sp = $('#g-pass');
  if (sl) { sl.addEventListener('keydown', (e) => { if (e.key === 'Enter') sp.focus(); }); }
  if (sp) { sp.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); }); }

  async function doLogin() {
    errEl.textContent = '';
    try {
      await API.post('/api/auth/login', { slug: $('#g-slug').value.trim(), pass: $('#g-pass').value }, { quiet: true });
      boot();
    } catch (e) { errEl.textContent = e.message; }
  }
  async function doSignup() {
    errEl.textContent = '';
    try {
      await API.post('/api/auth/signup', {
        slug: $('#s-slug').value.trim(), name: $('#s-name').value.trim(),
        phone: $('#s-phone').value.trim(), pass: $('#s-pass').value,
      }, { quiet: true });
      toast('店铺已创建 🎉');
      boot();
    } catch (e) { errEl.textContent = e.message; }
  }
}

/* ================= shell & router ================= */

const TABS = [
  ['home', '总览', '◐'], ['products', '商品', '❀'], ['orders', '询单', '☰'],
  ['shop', '店铺', '◧'], ['settings', '设置', '⚙'],
];
let main;

function appShell() {
  const t = S.me.tenant;
  document.title = t.name + ' · 卖家中心';
  root.innerHTML = '';
  if (S.me.actor === 'admin') {
    root.append(h('div', { class: 'banner admin', style: 'margin:0;border-radius:0;text-align:center' },
      '管理员视角 · 正在以「' + t.name + '」身份操作'));
  }
  root.append(
    h('div', { class: 'topbar' }, h('div', { class: 'in' },
      t.brand.logo ? h('img', { class: 'logo', src: t.brand.logo, alt: '' }) : null,
      h('span', { class: 'mark', style: 'font-size:18px' }, t.name),
      t.verified ? h('span', { class: 'badge ok', title: '已认证' }, '✓ 认证') : null,
      h('a', { class: 'btn small right', href: shopUrl(), target: '_blank' }, '查看店铺 ↗'))),
    h('nav', { class: 'tabbar', id: 'tabbar' },
      TABS.map(([id, label, ico]) => h('button', { dataset: { tab: id }, onclick: () => { location.hash = '#/' + id; } },
        h('span', { class: 'ico' }, ico), label,
        id === 'orders' && S.me.pending.placed > 0 ? h('span', { class: 'dot' }) : null))),
    main = h('main', { class: 'wrap' }));
  window.onhashchange = route;
}

function shopUrl() {
  const t = S.me.tenant;
  return '/s/' + t.slug + (t.status === 'active' ? '' : '?preview=1');
}

function route() {
  const view = (location.hash.replace(/^#\//, '') || 'home').split('?')[0];
  $all('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === view));
  main.innerHTML = '';
  main.append(h('div', { class: 'skel' }), h('div', { class: 'skel', style: 'height:120px' }));
  ({ home: renderHome, products: renderProducts, orders: renderOrders, shop: renderShop, settings: renderSettings }[view] || renderHome)();
}

async function refreshMe() { S.me = await API.get('/api/me', { quiet: true }); }

/* ================= 总览 home ================= */

async function renderHome() {
  const [me, stats] = await Promise.all([API.get('/api/me'), API.get('/api/stats')]);
  S.me = me; S.stats = stats;
  const t = me.tenant, ck = me.checklist;
  main.innerHTML = '';

  if (t.status === 'suspended') {
    main.append(h('div', { class: 'banner warn' }, h('b', null, '店铺已被平台暂停。'), ' 如有疑问请联系 KMTY。'));
  }

  // stats
  main.append(h('div', { class: 'stats' },
    h('div', { class: 'stat' }, h('div', { class: 'n' }, me.today.views), h('div', { class: 'l' }, '今日访问')),
    h('div', { class: 'stat' }, h('div', { class: 'n' }, me.today.orders), h('div', { class: 'l' }, '今日询单')),
    h('div', { class: 'stat hot' }, h('div', { class: 'n' }, me.pending.placed), h('div', { class: 'l' }, '待处理询单')),
    h('div', { class: 'stat' }, h('div', { class: 'n' }, me.usage.products), h('div', { class: 'l' }, '商品数'))));

  // onboarding checklist
  const steps = [
    ['product', '上传第一个商品', '#/products'],
    ['published', '发布商品（立即上架）', '#/products'],
    ['logo', '上传店铺 Logo', '#/shop'],
    ['wechat', '填写微信号 / 上传微信二维码', '#/shop'],
    ['services', '设置服务承诺（包邮、质保…）', '#/settings'],
  ];
  const undone = steps.filter(([k]) => !ck[k]);
  if (undone.length) {
    main.append(h('div', { class: 'card tint' },
      h('p', { class: 'h' }, '开店清单 · ' + (steps.length - undone.length) + '/' + steps.length),
      steps.map(([k, label, href]) => h('div', {
        class: 'ck' + (ck[k] ? ' done' : ''),
        onclick: () => { location.hash = href; },
      }, h('span', { class: 'box' }, ck[k] ? '✓' : ''), label, h('span', { class: 'right muted' }, '›')))));
  }

  // share link
  main.append(h('div', { class: 'card' },
    h('p', { class: 'h' }, '你的店铺链接（发给客户 / 发朋友圈）'),
    h('div', { class: 'code copy', onclick: () => copyText(location.origin + '/s/' + t.slug) },
      location.origin + '/s/' + t.slug),
    h('div', { class: 'row', style: 'margin-top:10px' },
      h('button', { class: 'btn solid small', onclick: () => copyText(location.origin + '/s/' + t.slug) }, '复制链接'),
      h('a', { class: 'btn small', href: shopUrl(), target: '_blank' }, '打开店铺'))));

  // 14-day chart
  const maxV = Math.max(1, ...stats.days.map((d) => d.views));
  const maxO = Math.max(1, ...stats.days.map((d) => d.orders));
  main.append(h('div', { class: 'card' },
    h('p', { class: 'h' }, '近 14 天 · 访问 ', h('span', { style: 'color:var(--acc)' }, '■'), ' / 询单 ', h('span', { style: 'color:var(--cta2)' }, '■')),
    h('div', { class: 'bars' }, stats.days.map((d) =>
      h('div', { class: 'b', style: 'height:' + Math.max(3, Math.round(d.views / maxV * 100)) + '%', title: d.day + ' 访问' + d.views },
        h('div', { class: 'b o', style: 'position:absolute;bottom:0;left:15%;right:15%;height:' + Math.round(d.orders / maxO * 60) + '%', title: '询单 ' + d.orders })))),
    h('div', { class: 'barlbl' }, h('span', null, stats.days[0].day), h('span', null, '累计访问 ' + stats.totals.views + ' · 询单 ' + stats.totals.orders), h('span', null, stats.days[13].day))));

  // recent inquiries
  const { orders } = await API.get('/api/orders?tab=placed');
  if (orders.length) {
    main.append(h('div', { class: 'card' },
      h('p', { class: 'h' }, '待处理询单'),
      orders.slice(0, 3).map(orderCard),
      h('a', { class: 'btn small block ghost', href: '#/orders' }, '查看全部 →')));
  }
}

/* ================= 商品 products ================= */

const GRADES = ['特级', 'A级', 'B级', 'C级'];
const COLORS = ['白', '粉', '玫红', '橙黄', '黄', '蓝紫', '复色'];
const SIZES = ['1.7寸', '2.0寸', '2.5寸', '2.8寸', '3.0寸', '3.5寸', '3.8寸'];
const STAGES = ['瓶苗', '中苗', '大苗', '开花株'];

async function renderProducts() {
  const { products } = await API.get('/api/products');
  S.products = products;
  main.innerHTML = '';
  main.append(h('div', { class: 'row', style: 'margin:4px 0 6px' },
    h('h1', { style: 'font-size:19px' }, '商品 ', h('span', { class: 'h-sub' }, products.length + ' 个')),
    h('button', { class: 'btn solid small right', onclick: () => editorSheet(null) }, '＋ 新增商品')));

  if (!products.length) {
    main.append(h('div', { class: 'empty' },
      h('div', { class: 'big' }, '❀'),
      '还没有商品。上传照片、填好规格和价格，', h('br'), '客户就能在你的店铺里下询单。',
      h('div', null, h('button', { class: 'btn solid', onclick: () => editorSheet(null) }, '上传第一个商品'))));
    return;
  }
  const list = h('div');
  main.append(list);
  products.forEach((p) => list.append(productRow(p)));
}

function specChips(p) {
  return [p.grade, p.sizeSpec, p.stage, p.flowerCount ? p.flowerCount + ' 梗' : '', p.variety]
    .filter(Boolean).map((x) => h('span', { class: 'chip' }, x));
}

function productRow(p) {
  const thumb = p.media.length
    ? h('img', { class: 'thumb', src: p.media[0].url, loading: 'lazy', alt: '' })
    : h('div', { class: 'thumb ph' }, '❀');
  const qtyIn = h('input', { class: 'mini', type: 'number', inputmode: 'numeric', value: p.qty, min: 0, 'aria-label': '库存' });
  const priceIn = h('input', { class: 'mini', type: 'number', inputmode: 'decimal', value: p.price != null ? p.price : '', step: '0.1', min: 0, placeholder: '价格', 'aria-label': '价格' });
  const savedTick = h('span', { class: 'ok small', style: 'opacity:0;transition:.3s' }, '✓ 已保存');
  const saveInline = debounce(async () => {
    const body = { qty: parseInt(qtyIn.value || '0', 10) };
    if (priceIn.value !== '') body.price = parseFloat(priceIn.value);
    await API.put('/api/products/' + p.id, body);
    savedTick.style.opacity = '1';
    setTimeout(() => { savedTick.style.opacity = '0'; }, 1400);
  }, 600);
  qtyIn.addEventListener('input', saveInline);
  priceIn.addEventListener('input', saveInline);

  const actions = h('div', { class: 'row', style: 'gap:6px' });
  function renderActions() {
    actions.innerHTML = '';
    actions.append(h('span', { class: 'badge ' + p.status }, STATUS_ZH[p.status] || p.status));
    if (p.status === 'draft') {
      actions.append(h('button', { class: 'btn tiny solid', onclick: () => pub('publish') }, '上架'));
    } else if (p.status === 'active') {
      actions.append(h('button', { class: 'btn tiny', onclick: () => pub('pause') }, '下架'));
    } else if (p.status === 'paused') {
      actions.append(h('button', { class: 'btn tiny solid', onclick: () => pub('publish') }, '重新上架'));
    } else if (p.status === 'rejected') {
      actions.append(h('span', { class: 'small muted' }, '如有疑问请联系平台'));
    }
    actions.append(savedTick);
  }
  async function pub(op) {
    const r = await API.post('/api/products/' + p.id + '/publish', { op });
    p.status = r.status;
    renderActions();
    toast(r.status === 'active' ? '已上架 ✓ 买家立即可见' : '已下架');
  }
  renderActions();

  return h('div', { class: 'item' },
    thumb,
    h('div', { class: 'grow', style: 'min-width:0' },
      h('div', { class: 'row', style: 'gap:8px' },
        h('span', { class: 't grow' }, (p.featured ? '★ ' : '') + p.title),
        h('button', { class: 'btn tiny ghost', onclick: () => editorSheet(p) }, '编辑')),
      h('div', { class: 'm' }, specChips(p),
        p.rating && p.rating.n > 0 ? h('span', { style: 'color:var(--warn)' }, '★' + p.rating.avg + ' (' + p.rating.n + ')') : null),
      h('div', { class: 'row', style: 'margin-top:8px;gap:8px' },
        h('span', { class: 'small muted' }, '库存'), qtyIn,
        h('span', { class: 'small muted' }, '¥'), priceIn,
        actions)));
}

/* ---------- product editor ---------- */

function editorSheet(p) {
  const isNew = !p;
  const d = p ? { ...p } : { title: '', descr: '', grade: '', sizeSpec: '', stage: '', flowerCount: 0, variety: '', colorFamily: '', spikeLen: 0, qty: 0, price: null, tiers: [], priceDisplay: 'inherit', featured: false, media: [] };
  let productId = p ? p.id : null;
  let dirty = false;

  const f = {};
  function field(label, el, hint) {
    return h('label', { class: 'f' }, h('span', null, label), el, hint ? h('div', { class: 'fhint' }, hint) : null);
  }
  function chipSelect(options, value, onpick, allowFree) {
    const wrap = h('div', { class: 'row', style: 'gap:6px' });
    const rerender = (val) => {
      wrap.innerHTML = '';
      options.forEach((o) => wrap.append(h('span', {
        class: 'chip' + (val === o ? ' on' : ''), style: 'cursor:pointer',
        onclick: () => { onpick(val === o ? '' : o); rerender(val === o ? '' : o); dirty = true; },
      }, o)));
    };
    rerender(value);
    return wrap;
  }

  f.title = h('input', { value: d.title, placeholder: '如：大辣椒 3.5寸 开花株 双梗' });
  f.variety = h('input', { value: d.variety, placeholder: '如：大辣椒 / 富乐夕阳 / V3' });
  f.spikeLen = h('input', { type: 'number', inputmode: 'numeric', value: d.spikeLen || '', min: 0, max: 300, placeholder: '如 55' });
  f.qty = h('input', { type: 'number', inputmode: 'numeric', value: d.qty || '', min: 0, placeholder: '0' });
  f.flower = h('input', { type: 'number', inputmode: 'numeric', value: d.flowerCount || '', min: 0, max: 99, placeholder: '如 2' });
  f.price = h('input', { type: 'number', inputmode: 'decimal', step: '0.1', min: 0, value: d.price != null ? d.price : '', placeholder: '单价 ¥/株' });
  f.descr = h('textarea', { value: d.descr, placeholder: '品相、花期、包装、发货说明…（选填）' });
  Object.values(f).forEach((el) => el.addEventListener('input', () => { dirty = true; }));

  /* tier editor */
  const tiersBox = h('div');
  let tiers = (d.tiers || []).map((t) => ({ ...t }));
  function renderTiers() {
    tiersBox.innerHTML = '';
    tiers.forEach((t, i) => {
      const min = h('input', { class: 'mini', type: 'number', inputmode: 'numeric', value: t.min, min: 1, placeholder: '数量≥' });
      const pr = h('input', { class: 'mini', type: 'number', inputmode: 'decimal', step: '0.1', value: t.price, min: 0, placeholder: '单价' });
      min.addEventListener('input', () => { t.min = parseInt(min.value || '0', 10); dirty = true; });
      pr.addEventListener('input', () => { t.price = parseFloat(pr.value || '0'); dirty = true; });
      tiersBox.append(h('div', { class: 'row', style: 'margin:6px 0' },
        h('span', { class: 'small muted' }, '≥'), min,
        h('span', { class: 'small muted' }, '株 → ¥'), pr,
        h('button', { class: 'btn tiny ghost danger', onclick: () => { tiers.splice(i, 1); dirty = true; renderTiers(); } }, '删')));
    });
    if (tiers.length < 6) {
      tiersBox.append(h('button', { class: 'btn tiny ghost', onclick: () => { tiers.push({ min: 100, price: 0 }); dirty = true; renderTiers(); } }, '＋ 加一档批发价'));
    }
  }
  renderTiers();

  /* price display */
  const modes = [['inherit', '跟随店铺'], ['public', '公开价格'], ['on_request', '询价可见'], ['hidden', '不显示']];
  let priceDisplay = d.priceDisplay || 'inherit';
  const segEl = h('div', { class: 'seg' }, modes.map(([v, l]) =>
    h('button', { class: priceDisplay === v ? 'on' : '', onclick: (e) => {
      priceDisplay = v; dirty = true;
      $all('button', segEl).forEach((b) => b.classList.remove('on'));
      e.target.classList.add('on');
    } }, l)));

  /* featured */
  const feat = h('input', { type: 'checkbox', checked: !!d.featured, onchange: () => { dirty = true; } });

  /* media */
  const mgrid = h('div', { class: 'mgrid' });
  let media = (d.media || []).map((m) => ({ ...m }));
  function renderMedia() {
    mgrid.innerHTML = '';
    media.forEach((m, i) => {
      mgrid.append(h('div', { class: 'mcell' },
        h('img', { src: m.url, alt: '' }),
        h('button', { class: 'x', 'aria-label': '删除', onclick: async () => {
          if (!(await confirmSheet('删除这张图片？', '删除'))) return;
          await API.del('/api/media/' + m.id);
          media.splice(i, 1); renderMedia();
        } }, '✕'),
        m.status === 'pending' ? h('div', { class: 'st' }, '待审核') : null,
        i > 0 ? h('button', { class: 'x', style: 'right:auto;left:4px;top:auto;bottom:4px', 'aria-label': '前移', onclick: async () => {
          [media[i - 1], media[i]] = [media[i], media[i - 1]];
          renderMedia();
          await API.post('/api/media/sort', { productId, ids: media.map((x) => x.id) });
        } }, '←') : null));
    });
    if (media.length < 10) {
      mgrid.append(h('div', { class: 'mcell add', role: 'button', tabindex: 0, onclick: pickFiles }, '＋'));
    }
  }
  const fileIn = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: () => uploadFiles(fileIn.files) });
  function pickFiles() { fileIn.click(); }
  async function ensureSaved() {
    if (productId) return true;
    if (!f.title.value.trim()) { toast('请先填写商品名称', true); f.title.focus(); return false; }
    const r = await API.post('/api/products', collect());
    productId = r.id;
    return true;
  }
  async function uploadFiles(files) {
    if (!(await ensureSaved())) return;
    for (const file of Array.from(files).slice(0, 10 - media.length)) {
      const cell = h('div', { class: 'mcell' }, h('div', { class: 'prog', style: 'width:30%' }));
      mgrid.insertBefore(cell, mgrid.lastChild);
      try {
        const { blob, w, h: ih } = await compressImage(file);
        cell.firstChild.style.width = '70%';
        const r = await API.post('/api/upload?for=product&product=' + productId + '&w=' + w + '&h=' + ih, blob);
        media.push(r.media);
      } catch (e) { /* toast shown by API */ }
      renderMedia();
    }
    fileIn.value = '';
  }
  renderMedia();

  function collect() {
    return {
      title: f.title.value.trim(), variety: f.variety.value.trim(),
      qty: parseInt(f.qty.value || '0', 10), flowerCount: parseInt(f.flower.value || '0', 10),
      price: f.price.value === '' ? null : parseFloat(f.price.value),
      spikeLen: parseInt(f.spikeLen.value || '0', 10),
      descr: f.descr.value, grade: d.grade, sizeSpec: d.sizeSpec, stage: d.stage, colorFamily: d.colorFamily,
      tiers: tiers.filter((t) => t.min > 0 && t.price > 0),
      priceDisplay, featured: feat.checked,
    };
  }

  const saveBtn = h('button', { class: 'btn solid grow', onclick: save }, isNew ? '保存商品' : '保存修改');
  const pubBtn = (!p || p.status === 'draft')
    ? h('button', { class: 'btn acc grow', onclick: async () => { await save(true); } }, '保存并上架')
    : null;

  async function save(publish) {
    if (!f.title.value.trim()) { toast('请填写商品名称', true); f.title.focus(); return; }
    if (productId) await API.put('/api/products/' + productId, collect());
    else { const r = await API.post('/api/products', collect()); productId = r.id; }
    if (publish) {
      await API.post('/api/products/' + productId + '/publish', { op: 'publish' });
      toast('已上架 ✓ 买家立即可见');
    } else toast('已保存 ✓');
    sh.close();
    renderProducts();
  }

  const body = h('div', null,
    h('h2', null, isNew ? '新增商品' : '编辑商品'),
    field('商品名称 *', f.title),
    h('div', { class: 'f' }, h('span', { style: 'display:block;font-size:12.5px;color:var(--muted);margin-bottom:6px' }, '商品图片（第一张为封面，最多 10 张）'), mgrid, fileIn,
      h('div', { class: 'fhint' }, '手机照片直接传即可 — 自动压缩，保存后立即可见')),
    h('div', { class: 'grid2' },
      field('等级', chipSelect(GRADES, d.grade, (v) => { d.grade = v; })),
      field('苗期', chipSelect(STAGES, d.stage, (v) => { d.stage = v; }))),
    field('盆径', chipSelect(SIZES, d.sizeSpec, (v) => { d.sizeSpec = v; })),
    h('div', { class: 'grid2' },
      field('品种', f.variety),
      field('色系', chipSelect(COLORS, d.colorFamily, (v) => { d.colorFamily = v; }))),
    h('div', { class: 'grid2' },
      field('梗数（花剑）', f.flower),
      field('梗长 cm（选填）', f.spikeLen)),
    h('div', { class: 'grid2' },
      field('现货数量（株）', f.qty),
      field('单价 ¥/株', f.price)),
    field('批发价（按量优惠，选填）', tiersBox),
    field('价格展示', segEl, '「跟随店铺」使用店铺页设置的统一方式'),
    h('label', { class: 'f row', style: 'gap:10px' }, feat, h('span', null, '设为主推（展示在店铺顶部）')),
    field('商品说明（选填）', f.descr),
    h('div', { class: 'row', style: 'margin:16px 0 4px' }, saveBtn, pubBtn),
    !isNew ? h('button', { class: 'btn ghost danger block small', style: 'margin-top:10px', onclick: async () => {
      if (!(await confirmSheet('删除商品「' + d.title + '」？相关图片一并删除，不可恢复。', '删除'))) return;
      await API.del('/api/products/' + productId);
      toast('已删除');
      sh.close();
      renderProducts();
    } }, '删除商品') : null);

  const sh = sheet(body);
}

/* ================= 询单 orders ================= */

const OTABS = [['placed', '新询单'], ['talking', '洽谈中'], ['completed', '已成交'], ['delivered', '已送达'], ['all', '全部']];

async function renderOrders() {
  main.innerHTML = '';
  const tabs = h('div', { class: 'ptabs' });
  const listEl = h('div');
  const search = h('input', { placeholder: '搜索 手机号 / 姓名 / 订单号', style: 'margin:2px 0 4px' });
  search.addEventListener('input', debounce(load, 350));
  main.append(h('h1', { style: 'font-size:19px;margin:4px 0 10px' }, '询单'), search, tabs, listEl);

  async function load() {
    listEl.innerHTML = '';
    listEl.append(h('div', { class: 'skel' }));
    const { orders, counts } = await API.get('/api/orders?tab=' + S.tab + '&q=' + encodeURIComponent(search.value.trim()));
    S.counts = counts;
    tabs.innerHTML = '';
    OTABS.forEach(([id, label]) => tabs.append(h('span', {
      class: 'chip' + (S.tab === id ? ' on' : ''),
      onclick: () => { S.tab = id; load(); },
    }, label, counts[id] != null && id !== 'all' ? ' ' + counts[id] : '')));
    listEl.innerHTML = '';
    if (!orders.length) {
      listEl.append(h('div', { class: 'empty' }, h('div', { class: 'big' }, '☰'),
        S.tab === 'placed' ? '没有待处理的询单' : '这里还没有订单'));
      return;
    }
    orders.forEach((o) => listEl.append(orderCard(o, load)));
  }
  load();
}

function orderCard(o, reload) {
  const snap = o.snap || {};
  const isRfq = o.kind === 'rfq';
  const what = isRfq ? '📋 批量求购 · ' + ((snap.rows || []).length) + ' 项' + (snap.region ? ' · 到货 ' + snap.region : '')
    : (o.kind === 'constellation' ? '星空艺术兰 · ' + (o.recipe || '定制配色') : (snap.title || '商品'));
  const priceLine = isRfq ? '合计 ' + o.qty + ' 株'
    : (snap.unit != null ? money(snap.unit) + '/株 × ' + o.qty + ' = ' + money(snap.unit * o.qty) : o.qty + ' 株');
  const actions = h('div', { class: 'row', style: 'gap:6px;margin-top:10px' });

  function btn(label, cls, to, needDate) {
    return h('button', { class: 'btn tiny ' + cls, onclick: async () => {
      if (needDate) return deliveredSheet(o, reload);
      await API.post('/api/orders/' + o.id + '/state', { to });
      toast('已更新');
      if (reload) reload(); else route();
    } }, label);
  }
  const byStatus = {
    placed: [btn('开始洽谈', 'solid', 'talking'), btn('直接成交', '', 'completed'), btn('作废', 'ghost danger', 'void')],
    talking: [btn('标记成交', 'solid', 'completed'), btn('作废', 'ghost danger', 'void')],
    completed: [btn('标记送达', 'solid', 'delivered', true), btn('退回洽谈', 'ghost', 'talking')],
    delivered: [], void: [btn('恢复', 'ghost', 'placed')],
  };
  (byStatus[o.status] || []).forEach((b) => actions.append(b));

  return h('div', { class: 'item', style: 'align-items:flex-start' },
    h('div', { class: 'grow', style: 'min-width:0' },
      h('div', { class: 'row' },
        h('span', { class: 't' }, o.name),
        h('span', { class: 'chip copy mono', title: '点击复制手机号', onclick: () => copyText(o.phone) }, o.phone),
        h('span', { class: 'badge ' + o.status + ' right' }, STATUS_ZH[o.status])),
      h('div', { class: 'm', style: 'margin-top:6px' },
        h('span', { class: 'mono chip', title: '订单号' }, o.code),
        h('span', null, what)),
      h('div', { class: 'small muted', style: 'margin-top:4px' },
        priceLine + (o.wishDate ? ' · 期望 ' + o.wishDate : '') + (o.deliveryDate ? ' · 送达 ' + o.deliveryDate : '') + ' · ' + relTime(o.created)),
      isRfq && (snap.rows || []).length ? h('div', { class: 'small', style: 'margin-top:6px;background:rgba(0,0,0,.2);border-radius:8px;padding:7px 10px' },
        snap.rows.map((r) => h('div', null, '· ' + r.what + (r.spec ? ' ' + r.spec : '') + ' × ' + r.qty.toLocaleString('zh-CN')))) : null,
      o.note ? h('div', { class: 'small', style: 'margin-top:6px;color:var(--ink);background:rgba(0,0,0,.2);border-radius:8px;padding:7px 10px' }, '留言：' + o.note) : null,
      actions));
}

function deliveredSheet(o, reload) {
  const dateIn = h('input', { type: 'date', value: localDate(), max: localDate() });
  const body = h('div', null,
    h('h2', null, '标记送达'),
    h('p', { class: 'small muted' }, '记录货物实际送达日期 — 之后的评价、售后凭证都以这一天为准。'),
    h('label', { class: 'f' }, h('span', null, '送达日期'), dateIn),
    h('button', { class: 'btn solid block', onclick: async () => {
      await API.post('/api/orders/' + o.id + '/state', { to: 'delivered', deliveryDate: dateIn.value });
      toast('已标记送达 ✓');
      sh.close();
      if (reload) reload();
    } }, '确认'));
  const sh = sheet(body);
}

/* ================= 店铺 shop ================= */

const SWATCHES = ['#E7B7CF', '#D48CB0', '#C76A41', '#9AD3A8', '#8FB7E0', '#E6C98A', '#B8A6E0', '#F3EEE4'];

async function renderShop() {
  await refreshMe();
  const t = S.me.tenant;
  const b = { ...t.brand };
  const { products } = await API.get('/api/products');
  main.innerHTML = '';

  const save = debounce(saveNow, 700);
  async function saveNow(patch) {
    await API.put('/api/tenant', patch);
    toast('已保存 ✓');
  }

  function uploader(slot, label, hint, wide) {
    const img = h('img', { src: b[slot] || '', alt: '', style: (wide ? 'width:100%;aspect-ratio:21/8' : 'width:96px;height:96px') + ';object-fit:cover;border-radius:12px;border:1px solid var(--line);background:var(--bg2);' + (b[slot] ? '' : 'display:none') });
    const fileIn = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async () => {
      const file = fileIn.files[0];
      if (!file) return;
      const { blob, w, h: ih } = await compressImage(file, slot === 'logo' ? 640 : 1800, 0.85);
      const r = await API.post('/api/upload?for=brand&slot=' + slot + '&w=' + w + '&h=' + ih, blob);
      b[slot] = r.url;
      img.src = r.url; img.style.display = '';
      toast('已上传 ✓');
    } });
    return h('div', { class: 'f' },
      h('span', { style: 'display:block;font-size:12.5px;color:var(--muted);margin-bottom:6px' }, label),
      h('div', { class: 'row' }, img,
        h('div', null,
          h('button', { class: 'btn small', onclick: () => fileIn.click() }, b[slot] ? '更换' : '上传'),
          hint ? h('div', { class: 'fhint', style: 'margin-top:6px' }, hint) : null)),
      fileIn);
  }

  const nameIn = h('input', { value: t.name, onchange: () => save({ name: nameIn.value }) });
  const companyIn = h('input', { value: t.company, placeholder: '公司全称（选填，展示在店铺页脚）', onchange: () => save({ company: companyIn.value }) });
  const tagIn = h('input', { value: t.tagline, placeholder: '一句话介绍，如：云南基地直发 · 专注蝴蝶兰 10 年', onchange: () => save({ tagline: tagIn.value }) });
  const annIn = h('input', { value: b.announcement, placeholder: '如：年宵花预订通道已开启，量大从优', onchange: () => save({ brand: { announcement: annIn.value } }) });
  const shipsIn = h('input', { value: b.shipsFrom, placeholder: '如：昆明斗南', onchange: () => save({ brand: { shipsFrom: shipsIn.value } }) });
  const aboutIn = h('textarea', { value: b.about, placeholder: '基地规模、主营品种、合作方式…', onchange: () => save({ brand: { about: aboutIn.value } }) });
  const wechatIn = h('input', { value: t.wechat, placeholder: '客户询单后引导添加的微信号', onchange: () => save({ wechat: wechatIn.value }) });

  // accent swatches
  const swWrap = h('div', { class: 'row', style: 'gap:8px' });
  SWATCHES.forEach((c) => {
    const dot = h('button', { 'aria-label': c, style: 'width:34px;height:34px;border-radius:50%;cursor:pointer;background:' + c + ';border:2px solid ' + (b.accent === c ? 'var(--ink)' : 'transparent'), onclick: () => {
      b.accent = c;
      $all('button', swWrap).forEach((x) => { x.style.borderColor = 'transparent'; });
      dot.style.borderColor = 'var(--ink)';
      saveNow({ brand: { accent: c } });
    } });
    swWrap.append(dot);
  });

  // price mode
  const pmodes = [['public', '公开价格'], ['on_request', '询价可见'], ['hidden', '不显示价格']];
  const pseg = h('div', { class: 'seg' }, pmodes.map(([v, l]) =>
    h('button', { class: b.priceMode === v ? 'on' : '', onclick: (e) => {
      b.priceMode = v;
      $all('button', pseg).forEach((x) => x.classList.remove('on'));
      e.target.classList.add('on');
      saveNow({ brand: { priceMode: v } });
    } }, l)));

  // featured picker
  const active = products.filter((p) => ['active', 'paused'].includes(p.status));
  const featBox = h('div');
  if (active.length) {
    active.forEach((p) => {
      const cb = h('input', { type: 'checkbox', checked: !!p.featured, onchange: async () => {
        await API.put('/api/products/' + p.id, { featured: cb.checked });
        toast('已更新');
      } });
      featBox.append(h('label', { class: 'ck', style: 'text-decoration:none;color:inherit' }, cb, h('span', { class: 'grow' }, p.title), h('span', { class: 'badge ' + p.status }, STATUS_ZH[p.status])));
    });
  } else featBox.append(h('p', { class: 'small muted' }, '上传商品后可在这里选择主推。'));

  // constellation module
  const constOn = h('input', { type: 'checkbox', checked: !!(b.modules && b.modules.constellation), onchange: () => saveNow({ brand: { modules: { constellation: constOn.checked } } }) });

  main.append(
    h('h1', { style: 'font-size:19px;margin:4px 0 10px' }, '店铺装修'),
    h('div', { class: 'card' },
      h('p', { class: 'h' }, '品牌'),
      uploader('logo', '店铺 Logo', '建议正方形，自动压缩'),
      uploader('banner', '店铺横幅（选填）', '展示在店铺顶部，建议横图', true),
      h('label', { class: 'f' }, h('span', null, '店铺名称'), nameIn),
      h('label', { class: 'f' }, h('span', null, '一句话介绍'), tagIn),
      h('label', { class: 'f' }, h('span', null, '公司全称'), companyIn),
      h('div', { class: 'f' }, h('span', { style: 'display:block;font-size:12.5px;color:var(--muted);margin-bottom:6px' }, '店铺主题色'), swWrap)),
    h('div', { class: 'card' },
      h('p', { class: 'h' }, '内容'),
      h('label', { class: 'f' }, h('span', null, '公告条（选填）'), annIn),
      h('label', { class: 'f' }, h('span', null, '发货地'), shipsIn),
      h('label', { class: 'f' }, h('span', null, '店铺介绍（选填）'), aboutIn)),
    h('div', { class: 'card' },
      h('p', { class: 'h' }, '联系方式（买家询单后看到）'),
      h('label', { class: 'f' }, h('span', null, '微信号'), wechatIn),
      uploader('wechatQr', '微信二维码（选填，买家可扫码加你）')),
    h('div', { class: 'card' },
      h('p', { class: 'h' }, '价格展示'),
      pseg,
      h('p', { class: 'fhint', style: 'margin-top:8px' }, '「公开价格」最利成交；「询价可见」适合价格常变的档口。单个商品可在编辑里单独设置。')),
    h('div', { class: 'card' },
      h('p', { class: 'h' }, '主推商品（展示在店铺顶部）'),
      featBox),
    h('div', { class: 'card' },
      h('p', { class: 'h' }, 'KMTY 星空艺术兰'),
      h('label', { class: 'row', style: 'gap:10px;cursor:pointer' },
        h('span', { class: 'tgl' }, constOn, h('i')),
        h('span', { class: 'grow' }, '在店铺展示「星空艺术兰」定制入口',
          h('div', { class: 'fhint' }, t.rate > 0 ? '通过你的店铺成交的星空订单，佣金比例 ' + t.rate + '%' : '佣金比例由 KMTY 设置'))),
      h('a', { class: 'btn small', style: 'margin-top:10px', href: '/r/' + t.slug, target: '_blank' }, '预览定制页 ↗')),
    h('a', { class: 'btn acc block', style: 'margin-top:16px', href: shopUrl(), target: '_blank' }, '预览我的店铺 ↗'));
}

/* ================= 设置 settings ================= */

async function renderSettings() {
  await refreshMe();
  const t = S.me.tenant, sv = { ...t.services };
  main.innerHTML = '';

  const save = debounce(async () => { await API.put('/api/tenant', { services: sv }); toast('已保存 ✓'); }, 600);
  function svcToggle(key, label, hint) {
    const cb = h('input', { type: 'checkbox', checked: !!sv[key], onchange: () => { sv[key] = cb.checked; save(); } });
    return h('label', { class: 'row', style: 'gap:10px;padding:9px 0;cursor:pointer' },
      h('span', { class: 'tgl' }, cb, h('i')),
      h('span', { class: 'grow' }, label, hint ? h('div', { class: 'fhint' }, hint) : null));
  }
  const qaIn = h('input', { class: 'mini', type: 'number', inputmode: 'numeric', min: 0, max: 100, value: sv.qaRate || '', placeholder: '95' });
  qaIn.addEventListener('input', () => { sv.qaRate = parseInt(qaIn.value || '0', 10); save(); });
  const moqIn = h('input', { class: 'mini', type: 'number', inputmode: 'numeric', min: 0, value: sv.minOrder || '', placeholder: '50' });
  moqIn.addEventListener('input', () => { sv.minOrder = parseInt(moqIn.value || '0', 10); save(); });
  const carrierIn = h('input', { value: sv.carrierNote || '', placeholder: '如：德邦物流 / 顺丰冷链', onchange: () => { sv.carrierNote = carrierIn.value; save(); } });
  const replaceIn = h('input', { value: sv.replacePolicy || '', placeholder: '如：到货破损包赔', onchange: () => { sv.replacePolicy = replaceIn.value; save(); } });

  main.append(
    h('h1', { style: 'font-size:19px;margin:4px 0 10px' }, '设置'),
    h('div', { class: 'card' },
      h('p', { class: 'h' }, '服务承诺（展示在店铺，请务实填写）'),
      svcToggle('shippingIncluded', '包邮'),
      h('div', { class: 'row', style: 'padding:9px 0' },
        h('span', { class: 'grow' }, '好苗率质保', h('div', { class: 'fhint' }, '承诺至少 X% 植株良好送达，超出损耗由你负责')),
        qaIn, h('span', { class: 'small muted' }, '%')),
      h('div', { class: 'row', style: 'padding:9px 0' },
        h('span', { class: 'grow' }, '起订量'), moqIn, h('span', { class: 'small muted' }, '株')),
      svcToggle('invoice', '可开发票'),
      h('label', { class: 'f' }, h('span', null, '破损处理'), replaceIn),
      h('label', { class: 'f' }, h('span', null, '物流说明'), carrierIn)),
    h('div', { class: 'card' },
      h('p', { class: 'h' }, '通知 · 企业微信群机器人'),
      h('p', { class: 'small muted', style: 'margin:0 0 8px' }, '在你的企业微信群里「添加群机器人」，把 Webhook 地址粘贴到这里 — 新询单会立刻推送到群里。'),
      (() => {
        const hookIn = h('input', { value: (t.brand && t.brand.wecomHook) || '', placeholder: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…' });
        hookIn.addEventListener('change', async () => {
          const v = hookIn.value.trim();
          if (v && !v.startsWith('https://qyapi.weixin.qq.com/cgi-bin/webhook/send')) { toast('地址需以 qyapi.weixin.qq.com 的 webhook 开头', true); return; }
          await API.put('/api/tenant', { brand: { wecomHook: v } });
          toast(v ? '已保存 ✓ 下一个询单开始推送' : '已关闭推送');
        });
        return h('label', { class: 'f' }, hookIn);
      })()),
    h('div', { class: 'card' },
      h('p', { class: 'h' }, '账号'),
      h('div', { class: 'row', style: 'padding:6px 0' }, h('span', { class: 'muted' }, '登录代号'), h('span', { class: 'mono right' }, t.slug)),
      S.me.user ? h('div', { class: 'row', style: 'padding:6px 0' }, h('span', { class: 'muted' }, '手机号'), h('span', { class: 'right' }, S.me.user.phone || '—')) : null,
      h('div', { class: 'row', style: 'padding:6px 0' }, h('span', { class: 'muted' }, '套餐'), h('span', { class: 'right' }, { free: '免费版', standard: '标准版', pro: '专业版' }[t.plan] || t.plan)),
      h('div', { class: 'row', style: 'padding:6px 0' }, h('span', { class: 'muted' }, '存储'), h('span', { class: 'right small' }, S.me.usage.storageMb + ' / ' + S.me.usage.storageCapMb + ' MB')),
      h('button', { class: 'btn small', style: 'margin-top:8px', onclick: passwordSheet }, '修改密码')),
    h('div', { class: 'card' },
      h('p', { class: 'h' }, '关于'),
      h('p', { class: 'small muted', style: 'margin:0' }, '你的商品与图片归你所有；平台仅作展示与询单撮合，交易在微信完成。如需帮助请联系 KMTY。')),
    h('button', { class: 'btn block ghost', style: 'margin-top:14px', onclick: async () => {
      await API.post('/api/auth/logout', {});
      location.href = '/seller';
    } }, '退出登录'));
}

function passwordSheet() {
  const cur = h('input', { type: 'password', autocomplete: 'current-password', placeholder: '当前密码' });
  const n1 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: '新密码（至少 6 位）' });
  const n2 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: '确认新密码' });
  const st = h('div', { class: 'ferr' });
  const body = h('div', null,
    h('h2', null, '修改密码'),
    h('p', { class: 'small muted' }, '改密码后只有你自己知道 — 请务必牢记。'),
    h('label', { class: 'f' }, cur), h('label', { class: 'f' }, n1), h('label', { class: 'f' }, n2), st,
    h('button', { class: 'btn solid block', onclick: async () => {
      st.textContent = '';
      if (n1.value.length < 6) { st.textContent = '新密码至少 6 位'; return; }
      if (n1.value !== n2.value) { st.textContent = '两次输入不一致'; return; }
      try {
        await API.post('/api/password', { cur: cur.value, new: n1.value }, { quiet: true });
        toast('密码已修改 ✓');
        sh.close();
      } catch (e) { st.textContent = e.message; }
    } }, '保存新密码'));
  const sh = sheet(body);
}

boot();
