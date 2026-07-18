/* 平台控制台 — KMTY operator console.
   审核 (tenant approvals + product/media moderation) · 租户 · 订单 · 颜色 · 留言 · 日志 */
'use strict';

const root = $('#app');
let main, OV = null;

async function boot() {
  try {
    OV = await API.get('/api/admin/overview', { quiet: true });
    shell(); route();
  } catch (e) { gate(); }
}

function gate() {
  root.innerHTML = '';
  const pass = h('input', { type: 'password', placeholder: '平台管理密码', enterkeyhint: 'go' });
  const errEl = h('div', { class: 'ferr center' });
  pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  async function go() {
    try {
      await API.post('/api/admin/login', { pass: pass.value }, { quiet: true });
      boot();
    } catch (e) { errEl.textContent = e.message; }
  }
  root.append(h('div', { class: 'gatewrap' }, h('div', { class: 'gatebox' },
    h('div', { class: 'center' },
      h('div', { class: 'mark', style: 'font-size:24px' }, 'KMTY ', h('b', null, '星商')),
      h('div', { class: 'tag', style: 'margin-top:4px' }, 'PLATFORM CONSOLE')),
    h('h2', { class: 'center' }, '平台控制台'),
    h('label', { class: 'f', style: 'margin-top:16px' }, pass),
    h('button', { class: 'btn solid block', onclick: go }, '进入'),
    errEl)));
}

const TABS = [['queue', '审核'], ['tenants', '租户'], ['orders', '订单'], ['colours', '颜色'], ['leads', '留言'], ['audit', '日志']];

function shell() {
  document.title = '平台控制台 · KMTY 星商';
  root.innerHTML = '';
  root.append(
    h('div', { class: 'topbar' }, h('div', { class: 'in' },
      h('span', { class: 'mark', style: 'font-size:18px' }, 'KMTY ', h('b', null, '星商')),
      h('span', { class: 'tag' }, '控制台'),
      h('span', { class: 'right small muted' }, OV.activeTenants + '/' + OV.tenants + ' 家在营 · 今日询单 ' + OV.ordersToday))),
    h('nav', { class: 'tabbar', id: 'tabbar', style: 'position:sticky;top:0' },
      TABS.map(([id, label]) => h('button', { dataset: { tab: id }, onclick: () => { location.hash = '#/' + id; } },
        label, badgeFor(id)))),
    main = h('main', { class: 'wrap' }));
  window.onhashchange = route;
}
function badgeFor(id) {
  const n = id === 'queue' ? (OV.pendingTenants + OV.pendingProducts + OV.pendingMedia) : 0;
  return n > 0 ? h('span', { class: 'badge pending', style: 'margin-left:4px' }, n) : null;
}

function route() {
  const view = (location.hash.replace(/^#\//, '') || 'queue').split('?')[0];
  $all('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === view));
  main.innerHTML = '';
  main.append(h('div', { class: 'skel' }));
  ({ queue: renderQueue, tenants: renderTenants, orders: renderOrders, colours: renderColours, leads: renderLeads, audit: renderAudit }[view] || renderQueue)();
}

async function refreshOverview() {
  OV = await API.get('/api/admin/overview', { quiet: true });
  $all('#tabbar button').forEach((b) => {
    const old = b.querySelector('.badge'); if (old) old.remove();
    const bd = badgeFor(b.dataset.tab); if (bd) b.append(bd);
  });
}

/* ================= 审核 queue ================= */

async function renderQueue() {
  const [{ tenants }, q] = await Promise.all([
    API.get('/api/admin/tenants?status=pending'),
    API.get('/api/admin/queue'),
  ]);
  main.innerHTML = '';
  if (!tenants.length && !q.products.length && !q.media.length) {
    main.append(h('div', { class: 'empty' }, h('div', { class: 'big' }, '✓'), '审核队列已清空'));
    return;
  }

  if (tenants.length) {
    main.append(h('h2', { style: 'font-size:16px;margin:8px 0' }, '待审核店铺 · ' + tenants.length));
    tenants.forEach((t) => {
      main.append(h('div', { class: 'trow' },
        h('div', null,
          h('div', { class: 'row' },
            t.logo ? h('img', { src: t.logo, style: 'width:38px;height:38px;border-radius:9px;object-fit:cover' }) : null,
            h('b', null, t.name), h('span', { class: 'mono small muted' }, '/' + t.slug)),
          h('div', { class: 'small muted', style: 'margin-top:4px' },
            '手机 ' + (t.phone || '—') + (t.wechat ? ' · 微信 ' + t.wechat : '') + ' · ' + relTime(t.created) + ' 注册 · 商品 ' + t.products)),
        h('div', { class: 'row' },
          h('a', { class: 'btn tiny', href: '/s/' + t.slug + '?preview=1', target: '_blank' }, '预览'),
          h('button', { class: 'btn tiny solid', onclick: async () => { await op(t.id, 'approve'); } }, '通过'),
          h('button', { class: 'btn tiny ghost danger', onclick: async () => {
            if (await confirmSheet('暂停「' + t.name + '」？', '暂停')) await op(t.id, 'suspend');
          } }, '拒绝'))));
    });
  }

  if (q.products.length) {
    main.append(h('h2', { style: 'font-size:16px;margin:16px 0 8px' }, '待审核商品 · ' + q.products.length,
      h('button', { class: 'btn tiny solid', style: 'margin-left:10px', onclick: async () => {
        for (const p of q.products) await API.post('/api/admin/product/' + p.id, { op: 'approve' });
        toast('已全部通过'); refreshOverview(); renderQueue();
      } }, '一键全部通过')));
    q.products.forEach((p) => {
      main.append(h('div', { class: 'trow' },
        h('div', { style: 'min-width:0' },
          h('div', null, h('b', null, p.title), ' ', h('span', { class: 'small muted' }, p.tenant + ' /' + p.slug)),
          h('div', { class: 'small muted' }, [p.grade, p.sizeSpec, p.stage, p.qty ? '现货' + p.qty : '', p.price != null ? money(p.price) + '/株' : ''].filter(Boolean).join(' · ')),
          p.descr ? h('div', { class: 'small muted', style: 'margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, p.descr) : null,
          p.media.length ? h('div', { class: 'qmedia' }, p.media.map((m) => h('img', { src: m.url, loading: 'lazy' }))) : h('div', { class: 'small muted' }, '（无图片）')),
        h('div', { class: 'row' },
          h('button', { class: 'btn tiny solid', onclick: async () => { await API.post('/api/admin/product/' + p.id, { op: 'approve' }); toast('已通过'); refreshOverview(); renderQueue(); } }, '通过'),
          h('button', { class: 'btn tiny ghost danger', onclick: async () => { await API.post('/api/admin/product/' + p.id, { op: 'reject' }); toast('已驳回'); refreshOverview(); renderQueue(); } }, '驳回'))));
    });
  }

  if (q.media.length) {
    main.append(h('h2', { style: 'font-size:16px;margin:16px 0 8px' }, '在售商品新增图片 · ' + q.media.length));
    q.media.forEach((m) => {
      main.append(h('div', { class: 'trow' },
        h('div', { class: 'row' }, h('img', { src: m.url, style: 'width:76px;height:76px;border-radius:9px;object-fit:cover' }),
          h('div', { class: 'small' }, m.product, h('div', { class: 'muted' }, '/' + m.slug))),
        h('div', { class: 'row' },
          h('button', { class: 'btn tiny solid', onclick: async () => { await API.post('/api/admin/media/' + m.id, { op: 'approve' }); refreshOverview(); renderQueue(); } }, '通过'),
          h('button', { class: 'btn tiny ghost danger', onclick: async () => { await API.post('/api/admin/media/' + m.id, { op: 'reject' }); refreshOverview(); renderQueue(); } }, '驳回'))));
    });
  }

  async function op(id, o) {
    await API.post('/api/admin/tenants/' + id, { op: o });
    toast('完成');
    refreshOverview(); renderQueue();
  }
}

/* ================= 租户 tenants ================= */

async function renderTenants() {
  const { tenants } = await API.get('/api/admin/tenants');
  main.innerHTML = '';
  const search = h('input', { placeholder: '搜索名称 / 代号 / 手机', style: 'margin-bottom:6px' });
  const list = h('div');
  main.append(search, list);
  function draw() {
    const kw = search.value.trim().toLowerCase();
    list.innerHTML = '';
    tenants.filter((t) => !kw || (t.name + t.slug + t.phone).toLowerCase().includes(kw)).forEach((t) => {
      list.append(h('div', { class: 'trow' },
        h('div', { style: 'min-width:0' },
          h('div', { class: 'row' },
            t.logo ? h('img', { src: t.logo, style: 'width:34px;height:34px;border-radius:8px;object-fit:cover' }) : null,
            h('b', null, t.name),
            h('span', { class: 'mono small muted' }, '/' + t.slug),
            h('span', { class: 'badge ' + (t.status === 'active' ? 'active' : t.status) }, STATUS_ZH[t.status] || t.status),
            t.verified ? h('span', { class: 'badge ok' }, '✓') : null),
          h('div', { class: 'small muted', style: 'margin-top:4px' },
            (t.phone || '—') + ' · 商品 ' + t.products + ' · 询单 ' + t.orders + ' · ' +
            ({ free: '免费版', standard: '标准版', pro: '专业版' }[t.plan] || t.plan) +
            (t.rate ? ' · 星空佣金 ' + t.rate + '%' : ''))),
        h('div', { class: 'row' },
          h('a', { class: 'btn tiny', href: '/s/' + t.slug + '?preview=1', target: '_blank' }, '店铺'),
          h('a', { class: 'btn tiny', href: '/seller?as=' + t.slug, target: '_blank', title: '以卖家身份查看（操作会记入日志）' }, '代管'),
          h('button', { class: 'btn tiny ghost', onclick: () => tenantSheet(t) }, '管理'))));
    });
    if (!list.children.length) list.append(h('div', { class: 'empty' }, '没有匹配的租户'));
  }
  search.addEventListener('input', debounce(draw, 250));
  draw();
}

function tenantSheet(t) {
  const planSel = h('select', null,
    ['free', 'standard', 'pro'].map((p) => h('option', { value: p, selected: t.plan === p }, { free: '免费版', standard: '标准版', pro: '专业版' }[p])));
  const rateIn = h('input', { class: 'mini', type: 'number', step: '0.5', min: 0, max: 100, value: t.rate || '' });
  const priceIn = h('input', { class: 'mini', type: 'number', step: '0.5', min: 0, value: t.price || '' });
  const body = h('div', null,
    h('h2', null, t.name, ' ', h('span', { class: 'mono small muted' }, '/' + t.slug)),
    h('div', { class: 'card' },
      h('p', { class: 'h' }, '状态'),
      h('div', { class: 'row' },
        t.status !== 'active' ? h('button', { class: 'btn small solid', onclick: () => op(t.status === 'pending' ? 'approve' : 'activate') }, '开通 / 恢复') : null,
        t.status === 'active' ? h('button', { class: 'btn small danger', onclick: async () => { if (await confirmSheet('暂停该店铺？买家将无法访问。', '暂停')) op('suspend'); } }, '暂停店铺') : null,
        h('button', { class: 'btn small', onclick: () => op(t.verified ? 'unverify' : 'verify') }, t.verified ? '取消认证' : '标记 ✓ 认证'))),
    h('div', { class: 'card' },
      h('p', { class: 'h' }, '套餐'),
      h('div', { class: 'row' }, planSel,
        h('button', { class: 'btn small', onclick: async () => { await API.post('/api/admin/tenants/' + t.id, { op: 'plan', plan: planSel.value }); toast('已更新'); } }, '保存'))),
    h('div', { class: 'card' },
      h('p', { class: 'h' }, '星空艺术兰佣金（该店成交的星空订单）'),
      h('div', { class: 'row' },
        h('span', { class: 'small muted' }, '比例'), rateIn, h('span', { class: 'small muted' }, '% · 参考价 ¥'), priceIn,
        h('button', { class: 'btn small', onclick: async () => {
          await API.post('/api/admin/tenants/' + t.id, { op: 'rate', rate: parseFloat(rateIn.value || '0'), price: parseFloat(priceIn.value || '0') });
          toast('已更新');
        } }, '保存'))));
  const sh = sheet(body);
  async function op(o) {
    await API.post('/api/admin/tenants/' + t.id, { op: o });
    toast('完成'); sh.close(); refreshOverview(); renderTenants();
  }
}

/* ================= 订单 orders ================= */

async function renderOrders() {
  const { orders } = await API.get('/api/admin/orders?limit=300');
  main.innerHTML = '';
  if (!orders.length) return main.append(h('div', { class: 'empty' }, '还没有订单'));
  const tb = h('table', { class: 'plain' },
    h('tr', null, ['时间', '店铺', '买家', '内容', '状态'].map((x) => h('th', null, x))),
    orders.map((o) => h('tr', null,
      h('td', { class: 'small muted' }, relTime(o.created)),
      h('td', { class: 'mono small' }, o.slug),
      h('td', null, o.name, h('div', { class: 'small muted mono' }, o.phone)),
      h('td', { class: 'small' }, (o.kind === 'constellation' ? '星空 · ' + (o.recipe || '定制') : (o.snap.title || '商品')) + ' × ' + o.qty,
        h('div', { class: 'muted mono' }, o.code)),
      h('td', null, h('span', { class: 'badge ' + o.status }, STATUS_ZH[o.status] || o.status)))));
  main.append(h('div', { style: 'overflow-x:auto' }, tb));
}

/* ================= 颜色 colours (Constellation config) ================= */

async function renderColours() {
  const cfg = await API.get('/api/config');
  main.innerHTML = '';
  const rows = (cfg.colors || []).map((c) => ({ ...c }));
  const list = h('div');
  function draw() {
    list.innerHTML = '';
    rows.forEach((c, i) => {
      const zh = h('input', { value: c.zh, placeholder: '中文名', style: 'width:110px' });
      const en = h('input', { value: c.en, placeholder: 'EN', style: 'width:120px' });
      const hex = h('input', { value: c.hex, style: 'width:92px', class: 'mono' });
      const sw = h('span', { style: 'width:22px;height:22px;border-radius:6px;background:' + c.hex + ';border:1px solid var(--line2);flex:0 0 auto' });
      const stock = h('input', { type: 'checkbox', checked: c.stock !== false });
      zh.oninput = () => { c.zh = zh.value; }; en.oninput = () => { c.en = en.value; };
      hex.oninput = () => { c.hex = hex.value; sw.style.background = hex.value; };
      stock.onchange = () => { c.stock = stock.checked; };
      list.append(h('div', { class: 'row', style: 'margin:8px 0' }, sw, zh, en, hex,
        h('label', { class: 'row small muted', style: 'gap:4px' }, stock, '有货'),
        h('button', { class: 'btn tiny ghost danger', onclick: () => { rows.splice(i, 1); draw(); } }, '删')));
    });
  }
  draw();
  main.append(
    h('p', { class: 'small muted' }, '星空艺术兰定制页的颜色与库存（对所有店铺的定制入口生效）。'),
    list,
    h('div', { class: 'row', style: 'margin-top:10px' },
      h('button', { class: 'btn small', onclick: () => { rows.push({ zh: '', en: '', hex: '#CCCCCC', stock: true }); draw(); } }, '＋ 加颜色'),
      h('button', { class: 'btn small solid', onclick: async () => {
        await API.post('/api/config', { colors: rows });
        toast('已保存并生效');
      } }, '保存')),
    cfg.updated ? h('p', { class: 'fhint' }, '上次更新 ' + new Date(cfg.updated).toLocaleString('zh-CN')) : null);
}

/* ================= 留言 leads ================= */

async function renderLeads() {
  const { leads } = await API.get('/api/admin/leads');
  main.innerHTML = '';
  if (!leads.length) return main.append(h('div', { class: 'empty' }, '还没有官网留言'));
  leads.forEach((l) => {
    main.append(h('div', { class: 'trow' },
      h('div', { style: 'min-width:0' },
        h('div', null, h('b', null, l.company || l.name || l.email), ' ', h('span', { class: 'small muted' }, relTime(l.created))),
        h('div', { class: 'small muted' }, [l.name, l.email, l.tel, l.type && (l.type + ' ' + l.spec)].filter(Boolean).join(' · ')),
        l.message ? h('div', { class: 'small', style: 'margin-top:4px;white-space:pre-line' }, l.message) : null),
      h('a', { class: 'btn tiny', href: 'mailto:' + l.email }, '回复')));
  });
}

/* ================= 日志 audit ================= */

async function renderAudit() {
  const { audit } = await API.get('/api/admin/audit?limit=300');
  main.innerHTML = '';
  const tb = h('table', { class: 'plain' },
    h('tr', null, ['时间', '角色', '动作', '对象', '详情'].map((x) => h('th', null, x))),
    audit.map((a) => h('tr', null,
      h('td', { class: 'small muted' }, relTime(a.ts)),
      h('td', null, h('span', { class: 'kpill' }, a.actor)),
      h('td', { class: 'mono small' }, a.action),
      h('td', { class: 'mono small muted' }, a.target || ''),
      h('td', { class: 'small muted' }, (a.detail || '').slice(0, 60)))));
  main.append(h('div', { style: 'overflow-x:auto' }, tb));
}

boot();
