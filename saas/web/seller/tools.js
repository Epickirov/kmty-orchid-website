/* Seller growth tools — bulk import + the two things a seller can use on day
   one, before the platform sends them any traffic: a branded price sheet and
   a shop poster, both rendered to PNG so they drop straight into WeChat.
   Loaded by /seller after app.js; depends on ui.js and qr.js. */
'use strict';

/* ==================== CSV / TSV import ==================== */

/* Excel on Windows pastes TSV and saves GBK CSV; both are handled. */
function parseTable(text) {
  text = String(text).replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const delim = first.split('\t').length > first.split(',').length ? '\t' : ',';
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
}

/* More specific aliases first — 阶梯价 must win before 价格 sees it. */
const COLMAP = [
  ['title', ['商品名称', '名称', '品名', '标题', '商品']],
  ['variety', ['品种']],
  ['grade', ['等级', '级别']],
  ['sizeSpec', ['盆径', '规格', '尺寸']],
  ['stage', ['苗期', '阶段']],
  ['colorFamily', ['色系', '花色', '颜色']],
  ['flowerCount', ['花朵数', '朵数', '花朵']],
  ['spikeLen', ['花梗', '梗长']],
  ['qty', ['库存', '可售', '数量']],
  ['tiers', ['阶梯价', '批发价', '阶梯']],
  ['price', ['单价', '售价', '价格']],
  ['descr', ['描述', '说明', '备注', '详情']],
];

function mapHeaders(head) {
  return head.map((raw) => {
    const hh = String(raw).trim().replace(/[（(].*?[)）]/g, '').replace(/\s/g, '');
    for (const [key, aliases] of COLMAP) if (aliases.includes(hh)) return key;
    for (const [key, aliases] of COLMAP) if (aliases.some((a) => hh.includes(a))) return key;
    return null;
  });
}

function numCell(v) {
  const s = String(v == null ? '' : v).replace(/[¥￥,，\s]/g, '').replace(/[元株个支盆]/g, '');
  if (s === '') return null;
  const n = parseFloat(s);
  return isFinite(n) ? n : NaN;
}

function parseTiers(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return [];
  return s.split(/[;；、,，]+/).map((part) => {
    const m = /^\s*([0-9.]+)\s*[:：=／/]\s*([0-9.]+)\s*$/.exec(part.replace(/[支株个盆元¥￥]/g, ''));
    if (!m) return null;
    return { min: Math.round(parseFloat(m[1])), price: parseFloat(m[2]) };
  }).filter(Boolean).slice(0, 6);
}

function rowsToProducts(table) {
  const keys = mapHeaders(table[0]);
  const known = keys.filter(Boolean).length;
  // If the first line maps to nothing it is probably data, not a header.
  const hasHeader = known >= 2;
  const cols = hasHeader ? keys : ['title', 'variety', 'grade', 'sizeSpec', 'stage', 'colorFamily', 'flowerCount', 'spikeLen', 'qty', 'price', 'tiers', 'descr'];
  const body = hasHeader ? table.slice(1) : table;
  const out = [];
  body.forEach((r, i) => {
    const d = {}, warn = [];
    cols.forEach((key, ci) => {
      if (!key) return;
      const raw = r[ci];
      if (raw == null || String(raw).trim() === '') return;
      if (key === 'tiers') {
        const t = parseTiers(raw);
        if (t.length) d.tiers = t; else warn.push('阶梯价格式无法识别');
      } else if (['flowerCount', 'spikeLen', 'qty', 'price'].includes(key)) {
        const n = numCell(raw);
        if (n == null) return;
        if (isNaN(n)) { warn.push(({ flowerCount: '花朵数', spikeLen: '花梗', qty: '库存', price: '价格' })[key] + '不是数字'); return; }
        d[key] = n;
      } else d[key] = String(raw).trim();
    });
    out.push({ line: i + (hasHeader ? 2 : 1), data: d, warn, ok: !!d.title });
  });
  return { rows: out, hasHeader, mapped: cols.filter(Boolean) };
}

const TEMPLATE_CSV = '﻿' + [
  '商品名称,品种,等级,盆径,苗期,色系,花朵数,花梗(cm),库存,价格,阶梯价,描述',
  '大辣椒 红花,大辣椒,特级,2.5寸,开花株,玫红,12,55,800,26,50:25;200:23,双杆齐开 花型饱满',
  '白花 V3,V3,A级,2.0寸,开花株,白,10,48,1500,22,100:21;500:19,基地直发',
  '中苗 混色,,B级,1.7寸,中苗,复色,,,3000,6.5,,当年苗 长势好',
].join('\n');

async function readTextFile(file) {
  const buf = await file.arrayBuffer();
  let t = new TextDecoder('utf-8').decode(buf);
  if (t.indexOf('�') >= 0) {           // Excel 中文版默认存 GBK
    try { t = new TextDecoder('gbk').decode(buf); } catch (e) { /* keep utf-8 */ }
  }
  return t;
}

function importSheet(onDone) {
  const ta = h('textarea', { rows: 6, placeholder: '从 Excel / WPS 复制整块表格，直接粘贴到这里', style: 'font-family:ui-monospace,Menlo,monospace;font-size:12.5px' });
  const fileIn = h('input', { type: 'file', accept: '.csv,.txt,.tsv,text/csv,text/plain', hidden: true });
  const preview = h('div');
  const pubCb = h('input', { type: 'checkbox' });
  const goBtn = h('button', { class: 'btn solid grow', disabled: true }, '导入');
  let parsed = null;

  function render() {
    preview.innerHTML = '';
    if (!parsed) { goBtn.disabled = true; return; }
    const good = parsed.rows.filter((r) => r.ok);
    const bad = parsed.rows.filter((r) => !r.ok);
    const warned = parsed.rows.filter((r) => r.ok && r.warn.length);
    goBtn.disabled = !good.length;
    goBtn.textContent = good.length ? '导入 ' + good.length + ' 个商品' : '没有可导入的行';

    preview.append(h('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap;margin:10px 0 8px' },
      h('span', { class: 'badge ok' }, '可导入 ' + good.length),
      bad.length ? h('span', { class: 'badge' }, '跳过 ' + bad.length) : null,
      warned.length ? h('span', { class: 'badge warn' }, '有提示 ' + warned.length) : null,
      h('span', { class: 'small muted' }, '识别到列：' + parsed.mapped.map((k) => ({
        title: '名称', variety: '品种', grade: '等级', sizeSpec: '盆径', stage: '苗期', colorFamily: '色系',
        flowerCount: '花朵数', spikeLen: '花梗', qty: '库存', price: '价格', tiers: '阶梯价', descr: '描述',
      }[k])).join(' · '))));

    if (!parsed.hasHeader) {
      preview.append(h('p', { class: 'fhint' }, '没找到表头，已按模板列顺序读取。建议先下载模板。'));
    }
    const tbl = h('div', { class: 'imp' });
    parsed.rows.slice(0, 8).forEach((r) => {
      const d = r.data;
      tbl.append(h('div', { class: 'improw' + (r.ok ? '' : ' bad') },
        h('span', { class: 'ln' }, r.line),
        h('span', { class: 'grow' },
          h('b', null, d.title || '（缺少名称）'),
          h('div', { class: 'fhint' }, [
            d.variety, d.grade, d.sizeSpec, d.stage, d.colorFamily,
            d.qty != null ? '库存 ' + d.qty : null,
            d.price != null ? money(d.price) : null,
            d.tiers ? d.tiers.length + ' 档阶梯价' : null,
          ].filter(Boolean).join(' · ') || '—')),
        r.warn.length ? h('span', { class: 'badge warn' }, r.warn[0]) : null));
    });
    if (parsed.rows.length > 8) tbl.append(h('p', { class: 'fhint', style: 'padding:8px 2px 0' }, '…共 ' + parsed.rows.length + ' 行'));
    preview.append(tbl);
  }

  function ingest(text) {
    const table = parseTable(text);
    if (!table.length) { toast('没读到内容', true); parsed = null; render(); return; }
    if (table.length > 200) toast('一次最多 200 行，已截取前 200 行');
    parsed = rowsToProducts(table.slice(0, 201));
    render();
  }

  ta.addEventListener('input', () => ingest(ta.value));
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0];
    if (!f) return;
    ingest(await readTextFile(f));
  });

  goBtn.addEventListener('click', async () => {
    const rows = parsed.rows.filter((r) => r.ok).map((r) => r.data);
    goBtn.disabled = true; goBtn.textContent = '导入中…';
    try {
      const r = await API.post('/api/products/bulk', { rows, publish: pubCb.checked });
      s.close();
      toast('已导入 ' + r.created + ' 个商品' + (r.status === 'active' ? '，已上架' : '，在草稿里'));
      if (onDone) onDone();
    } catch (e) { goBtn.disabled = false; goBtn.textContent = '导入'; }
  });

  const body = h('div', null,
    h('p', { class: 'h' }, '批量导入商品'),
    h('p', { class: 'fhint' }, '从 Excel / WPS 里复制粘贴，或上传 CSV。名称必填，其余留空即可，导入后还能逐个补图片。'),
    h('div', { class: 'row', style: 'gap:8px;margin:10px 0' },
      h('button', { class: 'btn small', onclick: () => downloadText(TEMPLATE_CSV, '商品导入模板.csv', 'text/csv') }, '↓ 下载模板'),
      h('button', { class: 'btn small', onclick: () => fileIn.click() }, '选择 CSV 文件')),
    ta, fileIn, preview,
    h('label', { class: 'row', style: 'gap:10px;margin:12px 0;cursor:pointer' },
      h('span', { class: 'tgl' }, pubCb, h('i')),
      h('span', { class: 'grow' }, '导入后直接上架',
        h('div', { class: 'fhint' }, '不勾选则存为草稿，补好图片再上架'))),
    h('div', { class: 'row', style: 'gap:8px' },
      h('button', { class: 'btn grow', onclick: () => s.close() }, '取消'), goBtn));
  const s = sheet(body);
  return s;
}

function downloadText(text, name, mime) {
  const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
  downloadBlob(blob, name);
}
function downloadBlob(blob, name) {
  const u = URL.createObjectURL(blob);
  const a = h('a', { href: u, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
}

/* ==================== shared canvas helpers ==================== */

const SANS = '-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif';
const SERIF = 'Georgia,"Songti SC","Noto Serif SC",serif';
const INK = '#F3EEE4', MUTED = '#9b93a4', BG = '#141018';

function rrect(ctx, x, y, w, hh, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + hh, r);
  ctx.arcTo(x + w, y + hh, x, y + hh, r);
  ctx.arcTo(x, y + hh, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx, text, max) {
  text = String(text == null ? '' : text);
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}

function loadImg(src) {
  return new Promise((res) => {
    if (!src) return res(null);
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

function saveOrShare(cv, name) {
  const dl = h('button', { class: 'btn solid grow', onclick: () => cv.toBlob((b) => b && downloadBlob(b, name), 'image/png') }, '↓ 保存图片');
  const row = h('div', { class: 'row', style: 'gap:8px;margin-top:12px' }, dl);
  if (navigator.canShare) {
    row.append(h('button', { class: 'btn grow', onclick: async () => {
      const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
      const file = new File([blob], name, { type: 'image/png' });
      if (!navigator.canShare({ files: [file] })) return toast('此浏览器不支持直接分享', true);
      try { await navigator.share({ files: [file] }); } catch (e) { /* user cancelled */ }
    } }, '分享'));
  }
  return row;
}

/* Shows the rendered canvas as an <img> — on phones a long-press then gives
   the native “保存图片”, which is how sellers actually get it into WeChat. */
function canvasPreview(cv) {
  const img = h('img', { alt: '', style: 'width:100%;border-radius:12px;border:1px solid var(--line)' });
  cv.toBlob((b) => { if (b) img.src = URL.createObjectURL(b); }, 'image/png');
  return img;
}

function tenantAccent() {
  const b = (S.me.tenant.brand) || {};
  return b.accent || '#E7B7CF';
}
function shopLink() { return location.origin + '/s/' + S.me.tenant.slug; }

function svcLines() {
  const sv = S.me.tenant.services || {};
  const out = [];
  if (sv.shippingIncluded) out.push('包邮');
  if (sv.qaRate) out.push('品质保证 ' + sv.qaRate + '%');
  if (sv.minOrder) out.push('起订 ' + sv.minOrder + ' 株');
  if (sv.replacePolicy) out.push(sv.replacePolicy);
  if (sv.carrierNote) out.push(sv.carrierNote);
  if (sv.invoice) out.push('可开发票');
  return out;
}

/* ==================== 门店海报 ==================== */

async function renderPoster() {
  const t = S.me.tenant, acc = tenantAccent();
  const W = 1080, H = 1620;
  const cv = h('canvas', { width: W, height: H });
  const ctx = cv.getContext('2d');

  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  let g = ctx.createRadialGradient(W * 0.85, -60, 0, W * 0.85, -60, 760);
  g.addColorStop(0, hexA(acc, 0.22)); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(60, H * 0.78, 0, 60, H * 0.78, 700);
  g.addColorStop(0, 'rgba(46,78,158,.20)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(243,238,228,.16)'; ctx.lineWidth = 2;
  rrect(ctx, 40, 40, W - 80, H - 80, 26); ctx.stroke();

  let y = 150;
  const logo = await loadImg(t.brand && t.brand.logo);
  if (logo) {
    ctx.save();
    ctx.beginPath(); ctx.arc(W / 2, y + 60, 60, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    ctx.drawImage(logo, W / 2 - 60, y, 120, 120);
    ctx.restore();
    ctx.strokeStyle = hexA(acc, 0.5); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W / 2, y + 60, 61, 0, Math.PI * 2); ctx.stroke();
    y += 165;
  } else y += 40;

  ctx.textAlign = 'center';
  ctx.fillStyle = INK; ctx.font = '600 68px ' + SERIF;
  ctx.fillText(fit(ctx, t.name, W - 200), W / 2, y);
  y += 56;
  if (t.tagline) {
    ctx.fillStyle = MUTED; ctx.font = '28px ' + SANS;
    ctx.fillText(fit(ctx, t.tagline, W - 220), W / 2, y);
    y += 46;
  }

  ctx.fillStyle = hexA(acc, 0.85); ctx.font = '600 22px ' + SANS;
  ctx.letterSpacing = '6px';
  ctx.fillText('蝴 蝶 兰 · 基 地 直 供', W / 2, y + 24);
  ctx.letterSpacing = '0px';
  y += 90;

  // QR card
  const cardW = 660, cardH = 760, cx = (W - cardW) / 2;
  ctx.fillStyle = '#fff';
  rrect(ctx, cx, y, cardW, cardH, 32); ctx.fill();
  const qrBox = 560;
  QR.draw(ctx, shopLink(), cx + (cardW - qrBox) / 2, y + 46, Math.floor(qrBox / (QR.encode(shopLink(), { ecc: 'M' }).size + 8)), { ecc: 'M', pad: 4 });
  ctx.fillStyle = '#2b1420'; ctx.font = '600 34px ' + SANS;
  ctx.fillText('微 信 扫 码 · 进 店 看 货', W / 2, y + cardH - 52);
  y += cardH + 66;

  // services
  const chips = svcLines().slice(0, 4);
  if (chips.length) {
    ctx.font = '26px ' + SANS;
    const gap = 16, hgt = 54;
    const widths = chips.map((c) => ctx.measureText(c).width + 44);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1);
    // wrap to two rows if the single row would overflow
    if (total > W - 120) {
      const half = Math.ceil(chips.length / 2);
      drawChipRow(ctx, chips.slice(0, half), y, W, acc, hgt, gap);
      drawChipRow(ctx, chips.slice(half), y + hgt + 14, W, acc, hgt, gap);
      y += hgt * 2 + 14 + 30;
    } else {
      drawChipRow(ctx, chips, y, W, acc, hgt, gap);
      y += hgt + 30;
    }
  }

  ctx.textAlign = 'center';
  if (t.wechat) {
    ctx.fillStyle = INK; ctx.font = '28px ' + SANS;
    ctx.fillText('微信 ' + t.wechat, W / 2, y + 30);
    y += 46;
  }
  ctx.fillStyle = MUTED; ctx.font = '22px ' + SANS;
  ctx.fillText(shopLink().replace(/^https?:\/\//, ''), W / 2, H - 96);
  ctx.fillStyle = 'rgba(243,238,228,.45)'; ctx.font = '20px ' + SERIF;
  ctx.fillText('KMTY 星商 · 蝴蝶兰批发平台', W / 2, H - 62);
  return cv;
}

function drawChipRow(ctx, chips, y, W, acc, hgt, gap) {
  const widths = chips.map((c) => ctx.measureText(c).width + 44);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1);
  let x = (W - total) / 2;
  chips.forEach((c, i) => {
    ctx.fillStyle = hexA(acc, 0.14); rrect(ctx, x, y, widths[i], hgt, 27); ctx.fill();
    ctx.strokeStyle = hexA(acc, 0.4); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center';
    ctx.fillText(c, x + widths[i] / 2, y + 36);
    x += widths[i] + gap;
  });
}

function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return 'rgba(231,183,207,' + a + ')';
  const n = parseInt(m[1], 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

/* ==================== 报价单 ==================== */

const SHEET_ROWS = 24;

async function renderPriceSheet(products, opts) {
  const t = S.me.tenant, acc = tenantAccent();
  const withPrice = opts.withPrice !== false;
  const pages = [];
  for (let i = 0; i < products.length; i += SHEET_ROWS) pages.push(products.slice(i, i + SHEET_ROWS));
  const logo = await loadImg(t.brand && t.brand.logo);
  return pages.map((rows, pi) => onePriceSheet(rows, pi, pages.length, t, acc, withPrice, logo));
}

function onePriceSheet(rows, pageIdx, pageCount, t, acc, withPrice, logo) {
  const W = 1080, HEAD = 300, FOOT = 300, RH = 104;
  const H = HEAD + rows.length * RH + FOOT;
  const cv = h('canvas', { width: W, height: H });
  const ctx = cv.getContext('2d');

  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W, 0, 0, W, 0, 620);
  g.addColorStop(0, hexA(acc, 0.16)); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 620);

  // header
  ctx.textAlign = 'left';
  ctx.fillStyle = INK; ctx.font = '600 46px ' + SERIF;
  ctx.fillText(fit(ctx, t.name, 640), 56, 100);
  ctx.fillStyle = MUTED; ctx.font = '24px ' + SANS;
  ctx.fillText(fit(ctx, t.tagline || (t.brand && t.brand.shipsFrom) || '', 640), 56, 142);

  ctx.textAlign = 'right';
  ctx.fillStyle = hexA(acc, 0.95); ctx.font = '600 30px ' + SANS;
  ctx.letterSpacing = '8px';
  ctx.fillText('报 价 单', W - 56, 92);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = MUTED; ctx.font = '22px ' + SANS;
  ctx.fillText(localDate() + (pageCount > 1 ? '  ·  第 ' + (pageIdx + 1) + '/' + pageCount + ' 页' : ''), W - 56, 132);
  if (logo) { ctx.drawImage(logo, W - 56 - 64, 156, 64, 64); }

  // column headers
  const Y0 = HEAD - 46;
  ctx.strokeStyle = 'rgba(243,238,228,.18)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(56, Y0 + 14); ctx.lineTo(W - 56, Y0 + 14); ctx.stroke();
  ctx.font = '600 22px ' + SANS; ctx.fillStyle = MUTED;
  ctx.textAlign = 'left'; ctx.fillText('商品', 56, Y0);
  ctx.fillText('规格', 560, Y0);
  ctx.textAlign = 'right';
  ctx.fillText('库存', 856, Y0);
  if (withPrice) ctx.fillText('单价', W - 56, Y0);

  rows.forEach((p, i) => {
    const y = HEAD + i * RH;
    if (i % 2 === 0) { ctx.fillStyle = 'rgba(243,238,228,.035)'; ctx.fillRect(56, y - 26, W - 112, RH - 8); }
    ctx.textAlign = 'left';
    ctx.fillStyle = INK; ctx.font = '600 28px ' + SANS;
    ctx.fillText(fit(ctx, p.title, 470), 56, y + 6);
    const sub = [p.variety, p.colorFamily].filter(Boolean).join(' · ');
    if (sub) {
      ctx.fillStyle = MUTED; ctx.font = '21px ' + SANS;
      ctx.fillText(fit(ctx, sub, 470), 56, y + 38);
    }
    ctx.fillStyle = 'rgba(243,238,228,.78)'; ctx.font = '22px ' + SANS;
    const spec = [p.grade, p.sizeSpec, p.stage].filter(Boolean).join(' / ');
    ctx.fillText(fit(ctx, spec || '—', 280), 560, y + 6);
    const spec2 = [p.flowerCount ? p.flowerCount + ' 朵' : null, p.spikeLen ? '梗 ' + p.spikeLen + 'cm' : null].filter(Boolean).join(' · ');
    if (spec2) { ctx.fillStyle = MUTED; ctx.font = '20px ' + SANS; ctx.fillText(spec2, 560, y + 38); }

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(243,238,228,.78)'; ctx.font = '24px ' + SANS;
    ctx.fillText(p.qty ? String(p.qty) : '—', 856, y + 6);

    if (withPrice) {
      const tiers = (p.tiers || []).slice().sort((a, b) => a.min - b.min);
      if (p.price != null) {
        ctx.fillStyle = INK; ctx.font = '600 30px ' + SANS;
        ctx.fillText(money(p.price), W - 56, y + 6);
      } else {
        ctx.fillStyle = hexA(acc, 0.9); ctx.font = '600 24px ' + SANS;
        ctx.fillText('询价', W - 56, y + 6);
      }
      if (tiers.length) {
        ctx.fillStyle = MUTED; ctx.font = '20px ' + SANS;
        ctx.fillText(fit(ctx, tiers.map((x) => x.min + '+ ' + money(x.price)).join('  '), 460), W - 56, y + 38);
      }
    }
  });

  // footer
  const fy = HEAD + rows.length * RH + 20;
  ctx.strokeStyle = 'rgba(243,238,228,.18)';
  ctx.beginPath(); ctx.moveTo(56, fy); ctx.lineTo(W - 56, fy); ctx.stroke();

  ctx.fillStyle = '#fff';
  rrect(ctx, 56, fy + 34, 180, 180, 14); ctx.fill();
  const link = shopLink();
  QR.draw(ctx, link, 64, fy + 42, Math.floor(164 / (QR.encode(link, { ecc: 'M' }).size + 8)), { ecc: 'M', pad: 4 });

  ctx.textAlign = 'left';
  ctx.fillStyle = INK; ctx.font = '600 26px ' + SANS;
  ctx.fillText('扫码进店 · 在线下单', 262, fy + 76);
  ctx.fillStyle = MUTED; ctx.font = '22px ' + SANS;
  const svc = svcLines().slice(0, 3).join(' · ');
  ctx.fillText(fit(ctx, svc || link.replace(/^https?:\/\//, ''), 700), 262, fy + 114);
  if (t.wechat) ctx.fillText(fit(ctx, '微信 ' + t.wechat, 700), 262, fy + 150);
  ctx.fillStyle = 'rgba(243,238,228,.45)'; ctx.font = '20px ' + SANS;
  ctx.fillText('报价以实际沟通为准 · ' + localDate() + ' 生成', 262, fy + 190);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(243,238,228,.45)'; ctx.font = '20px ' + SERIF;
  ctx.fillText('KMTY 星商', W - 56, fy + 190);
  return cv;
}

/* ==================== sheets ==================== */

async function posterSheet() {
  const body = h('div', null, h('p', { class: 'h' }, '门店海报'), h('div', { class: 'skel', style: 'height:200px' }));
  const s = sheet(body);
  const cv = await renderPoster();
  body.innerHTML = '';
  body.append(
    h('p', { class: 'h' }, '门店海报'),
    h('p', { class: 'fhint' }, '发朋友圈、印出来贴在档口。买家扫码直接进店。'),
    canvasPreview(cv),
    saveOrShare(cv, S.me.tenant.name + '-门店海报.png'),
    h('button', { class: 'btn block', style: 'margin-top:8px', onclick: () => s.close() }, '关闭'));
}

async function priceSheetSheet() {
  const { products } = await API.get('/api/products');
  const sellable = products.filter((p) => ['active', 'paused', 'draft'].includes(p.status));
  if (!sellable.length) return toast('先添加商品，再生成报价单', true);

  const pick = new Set(sellable.filter((p) => p.status === 'active').map((p) => p.id));
  if (!pick.size) sellable.forEach((p) => pick.add(p.id));
  const priceCb = h('input', { type: 'checkbox', checked: true });
  const out = h('div');
  const s = sheet(h('div', null,
    h('p', { class: 'h' }, '报价单'),
    h('p', { class: 'fhint' }, '生成一张带你店铺信息和二维码的报价图，直接发微信群。'),
    h('div', { class: 'imp', style: 'max-height:230px;overflow:auto;margin:10px 0' },
      sellable.map((p) => {
        const cb = h('input', { type: 'checkbox', checked: pick.has(p.id), onchange: () => { cb.checked ? pick.add(p.id) : pick.delete(p.id); } });
        return h('label', { class: 'ck', style: 'text-decoration:none;color:inherit' }, cb,
          h('span', { class: 'grow' }, p.title,
            h('span', { class: 'fhint' }, [p.grade, p.sizeSpec, p.price != null ? money(p.price) : '询价'].filter(Boolean).join(' · '))),
          p.status !== 'active' ? h('span', { class: 'badge' }, STATUS_ZH[p.status]) : null);
      })),
    h('label', { class: 'row', style: 'gap:10px;margin:4px 0 12px;cursor:pointer' },
      h('span', { class: 'tgl' }, priceCb, h('i')),
      h('span', { class: 'grow' }, '包含价格', h('div', { class: 'fhint' }, '关掉就是一张只有规格和库存的货单'))),
    h('button', { class: 'btn solid block', onclick: async () => {
      const rows = sellable.filter((p) => pick.has(p.id));
      if (!rows.length) return toast('至少选一个商品', true);
      out.innerHTML = '';
      out.append(h('div', { class: 'skel', style: 'height:160px' }));
      const cvs = await renderPriceSheet(rows, { withPrice: priceCb.checked });
      out.innerHTML = '';
      cvs.forEach((cv, i) => {
        out.append(canvasPreview(cv),
          saveOrShare(cv, S.me.tenant.name + '-报价单-' + localDate() + (cvs.length > 1 ? '-' + (i + 1) : '') + '.png'));
      });
      out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } }, '生成报价单'),
    out,
    h('button', { class: 'btn block', style: 'margin-top:10px', onclick: () => s.close() }, '关闭')));
}
