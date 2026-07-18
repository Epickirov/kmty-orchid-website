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

const TABS = [['feed', '动态'], ['tenants', '租户'], ['orders', '订单'], ['colours', '颜色'], ['leads', '留言'], ['audit', '日志']];

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
  const n = id === 'feed' ? OV.newProducts24h : 0;
  return n > 0 ? h('span', { class: 'badge active', style: 'margin-left:4px' }, n) : null;
}

function route() {
  const view = (location.hash.replace(/^#\//, '') || 'feed').split('?')[0];
  $all('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === view));
  main.innerHTML = '';
  main.append(h('div', { class: 'skel' }));
  ({ feed: renderFeed, tenants: renderTenants, orders: renderOrders, colours: renderColours, leads: renderLeads, audit: renderAudit }[view] || renderFeed)();
}

async function refreshOverview() {
  OV = await API.get('/api/admin/overview', { quiet: true });
  $all('#tabbar button').forEach((b) => {
    const old = b.querySelector('.badge'); if (old) old.remove();
    const bd = badgeFor(b.dataset.tab); if (bd) b.append(bd);
  });
}

/* ================= 动态 feed (post-publication watch + takedown) ================= */
// Nothing waits for approval — this feed shows what just went live so the
// operator can spot-check and take down anything bad after the fact.

async function renderFeed() {
  const q = await API.get('/api/admin/feed');
  main.innerHTML = '';
  main.append(h('p', { class: 'small muted', style: 'margin:4px 0 10px' },
    '所有店铺与商品发布即上线，无需审核。这里按时间倒序展示最新动态，发现问题可一键下架 / 暂停（可恢复，全部记入日志）。'));

  if (!q.tenants.length && !q.products.length) {
    main.append(h('div', { class: 'empty' }, h('div', { class: 'big' }, '❀'), '还没有动态'));
    return;
  }

  if (q.tenants.length) {
    main.append(h('h2', { style: 'font-size:16px;margin:8px 0' }, '最新店铺'));
    q.tenants.forEach((t) => {
      main.append(h('div', { class: 'trow' },
        h('div', null,
          h('div', { class: 'row' },
            t.logo ? h('img', { src: t.logo, style: 'width:38px;height:38px;border-radius:9px;object-fit:cover' }) : null,
            h('b', null, t.name), h('span', { class: 'mono small muted' }, '/' + t.slug),
            t.status !== 'active' ? h('span', { class: 'badge ' + t.status }, STATUS_ZH[t.status] || t.status) : null),
          h('div', { class: 'small muted', style: 'margin-top:4px' },
            '手机 ' + (t.phone || '—') + (t.wechat ? ' · 微信 ' + t.wechat : '') + ' · ' + relTime(t.created) + ' 开店 · 商品 ' + t.products)),
        h('div', { class: 'row' },
          h('a', { class: 'btn tiny', href: '/s/' + t.slug, target: '_blank' }, '查看'),
          t.status === 'active'
            ? h('button', { class: 'btn tiny ghost danger', onclick: async () => {
                if (await confirmSheet('暂停「' + t.name + '」？买家将无法访问其店铺。', '暂停')) {
                  await API.post('/api/admin/tenants/' + t.id, { op: 'suspend' }); toast('已暂停'); renderFeed();
                }
              } }, '暂停')
            : h('button', { class: 'btn tiny solid', onclick: async () => {
                await API.post('/api/admin/tenants/' + t.id, { op: 'activate' }); toast('已恢复'); renderFeed();
              } }, '恢复'))));
    });
  }

  if (q.products.length) {
    main.append(h('h2', { style: 'font-size:16px;margin:16px 0 8px' }, '最新商品'));
    q.products.forEach((p) => {
      main.append(h('div', { class: 'trow' },
        h('div', { style: 'min-width:0' },
          h('div', null, h('b', null, p.title), ' ', h('span', { class: 'small muted' }, p.tenant + ' /' + p.slug),
            p.status === 'rejected' ? h('span', { class: 'badge rejected', style: 'margin-left:6px' }, '已下架') : null),
          h('div', { class: 'small muted' }, [p.grade, p.sizeSpec, p.stage, p.qty ? '现货' + p.qty : '', p.price != null ? money(p.price) + '/株' : ''].filter(Boolean).join(' · ') + ' · ' + relTime(p.updated)),
          p.media.length ? h('div', { class: 'qmedia' }, p.media.map((m) => h('img', { src: m.url, loading: 'lazy' }))) : null),
        h('div', { class: 'row' },
          p.status === 'active'
            ? h('button', { class: 'btn tiny ghost danger', onclick: async () => {
                if (await confirmSheet('下架「' + p.title + '」？卖家将无法自行重新上架。', '下架')) {
                  await API.post('/api/admin/product/' + p.id, { op: 'reject' }); toast('已下架'); renderFeed();
                }
              } }, '下架')
            : h('button', { class: 'btn tiny solid', onclick: async () => {
                await API.post('/api/admin/product/' + p.id, { op: 'approve' }); toast('已恢复上架'); renderFeed();
              } }, '恢复'))));
    });
  }

  if (q.flagged && q.flagged.length) {
    main.append(h('h2', { style: 'font-size:16px;margin:16px 0 8px;color:var(--err)' }, '⚠ 内容安全标记 · ' + q.flagged.length));
    const fg = h('div', { class: 'qmedia', style: 'flex-wrap:wrap' });
    q.flagged.forEach((m) => {
      fg.append(h('div', { style: 'position:relative;flex:0 0 auto' },
        h('img', { src: m.url, title: '/' + m.slug, style: 'width:76px;height:76px;border-radius:9px;object-fit:cover;border:2px solid var(--err)' }),
        h('button', { class: 'btn tiny ghost danger', style: 'position:absolute;right:2px;top:2px;padding:1px 7px;background:rgba(0,0,0,.6)', onclick: async (e) => {
          await API.post('/api/admin/media/' + m.id, { op: 'reject' }); e.target.closest('div').remove(); toast('已移除');
        } }, '✕')));
    });
    main.append(fg);
  }

  if (q.reviews && q.reviews.length) {
    main.append(h('h2', { style: 'font-size:16px;margin:16px 0 8px' }, '最新评价'));
    q.reviews.forEach((r) => {
      main.append(h('div', { class: 'trow' },
        h('div', { style: 'min-width:0' },
          h('div', { class: 'row' },
            h('span', { style: 'color:var(--warn);letter-spacing:2px' }, '★★★★★'.slice(0, r.stars)),
            h('span', { class: 'small' }, r.buyer),
            h('span', { class: 'small muted' }, r.product + ' · /' + r.slug + ' · ' + relTime(r.created)),
            r.status === 'rejected' ? h('span', { class: 'badge rejected' }, '已移除') : null),
          r.text ? h('div', { class: 'small', style: 'margin-top:4px' }, r.text.slice(0, 140)) : null,
          r.photos.length ? h('div', { class: 'qmedia' }, r.photos.map((u) => h('img', { src: u, loading: 'lazy' }))) : null),
        h('div', { class: 'row' },
          r.status === 'published'
            ? h('button', { class: 'btn tiny ghost danger', onclick: async () => {
                if (await confirmSheet('移除这条评价？', '移除')) { await API.post('/api/admin/review/' + r.id, { op: 'reject' }); toast('已移除'); renderFeed(); }
              } }, '移除')
            : h('button', { class: 'btn tiny solid', onclick: async () => {
                await API.post('/api/admin/review/' + r.id, { op: 'approve' }); toast('已恢复'); renderFeed();
              } }, '恢复'))));
    });
  }

  if (q.media.length) {
    main.append(h('h2', { style: 'font-size:16px;margin:16px 0 8px' }, '最新图片'));
    const grid = h('div', { class: 'qmedia', style: 'flex-wrap:wrap' });
    q.media.forEach((m) => {
      const cell = h('div', { style: 'position:relative;flex:0 0 auto' },
        h('img', { src: m.url, title: m.product + ' /' + m.slug, style: 'width:76px;height:76px;border-radius:9px;object-fit:cover;border:1px solid var(--line)' }),
        h('button', { class: 'btn tiny ghost danger', style: 'position:absolute;right:2px;top:2px;padding:1px 7px;background:rgba(0,0,0,.6)', title: '移除该图片', onclick: async () => {
          if (await confirmSheet('移除这张图片？', '移除')) {
            await API.post('/api/admin/media/' + m.id, { op: 'reject' }); cell.remove(); toast('已移除');
          }
        } }, '✕'));
      grid.append(cell);
    });
    main.append(grid);
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
