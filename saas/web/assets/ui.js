/* Shared runtime helpers for the Storefronts UIs. No framework, no build:
   h() builds DOM, api() wraps fetch with error toasts, sheet() manages the
   bottom-sheet/modal, compressImage() downsizes photos before upload. */
'use strict';

function $(sel, root) { return (root || document).querySelector(sel); }
function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;             // trusted, app-built strings only
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list' && k !== 'form') { try { el[k] = v; } catch (e) { el.setAttribute(k, v); } }
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(9)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/* ---------- toast ---------- */
let _toastEl, _toastT;
function toast(msg, isErr) {
  if (!_toastEl) { _toastEl = h('div', { class: 'toast' }); document.body.append(_toastEl); }
  _toastEl.textContent = msg;
  _toastEl.classList.toggle('err', !!isErr);
  _toastEl.classList.add('show');
  clearTimeout(_toastT);
  _toastT = setTimeout(() => _toastEl.classList.remove('show'), 2400);
}

/* ---------- api ---------- */
const API = {
  headers: {},                       // admin impersonation sets x-tenant here
  async req(method, url, body, opts) {
    const o = { method, headers: { ...API.headers }, credentials: 'same-origin' };
    if (body !== undefined && !(body instanceof Blob)) {
      o.headers['content-type'] = 'application/json';
      o.body = JSON.stringify(body);
    } else if (body instanceof Blob) {
      o.headers['content-type'] = 'application/octet-stream';
      o.body = body;
    }
    let r;
    try { r = await fetch(url, o); }
    catch (e) { if (!opts || !opts.quiet) toast('网络错误，请重试', true); throw e; }
    let j = null;
    try { j = await r.json(); } catch (e) {}
    if (!r.ok) {
      const msg = (j && j.error) || ('请求失败 (' + r.status + ')');
      if (!opts || !opts.quiet) toast(msg, true);
      const err = new Error(msg); err.status = r.status; err.body = j; throw err;
    }
    return j;
  },
  get(u, o) { return API.req('GET', u, undefined, o); },
  post(u, b, o) { return API.req('POST', u, b, o); },
  put(u, b, o) { return API.req('PUT', u, b, o); },
  del(u, o) { return API.req('DELETE', u, undefined, o); },
};

/* ---------- sheet ---------- */
function sheet(contentEl, opts) {
  const wrap = h('div', { class: 'sheetwrap' },
    h('div', { class: 'sheet' }, h('div', { class: 'grab' }), contentEl));
  wrap.addEventListener('click', (e) => { if (e.target === wrap && (!opts || opts.dismiss !== false)) close(); });
  function close() {
    wrap.classList.remove('show');
    setTimeout(() => wrap.remove(), 220);
    document.documentElement.style.overflow = '';
  }
  document.body.append(wrap);
  document.documentElement.style.overflow = 'hidden';
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('show')));
  return { close, el: wrap };
}

/* ---------- confirm ---------- */
function confirmSheet(msg, yesLabel) {
  return new Promise((resolve) => {
    const body = h('div', { class: 'center' },
      h('p', { style: 'margin:14px 0 20px;font-size:15px' }, msg),
      h('div', { class: 'row' },
        h('button', { class: 'btn grow', onclick: () => { s.close(); resolve(false); } }, '取消'),
        h('button', { class: 'btn solid grow', onclick: () => { s.close(); resolve(true); } }, yesLabel || '确定')));
    const s = sheet(body);
  });
}

/* ---------- image compression (client-side, before upload) ---------- */
async function compressImage(file, maxSide, quality) {
  maxSide = maxSide || 1600;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error('无法读取图片');
  let { width: w, height: hgt } = bmp;
  const scale = Math.min(1, maxSide / Math.max(w, hgt));
  w = Math.round(w * scale); hgt = Math.round(hgt * scale);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = hgt;
  cv.getContext('2d').drawImage(bmp, 0, 0, w, hgt);
  const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', quality || 0.82));
  if (!blob) throw new Error('压缩失败');
  return { blob, w, h: hgt };
}

/* ---------- misc ---------- */
function debounce(fn, ms) {
  let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
}
function money(n) { return n == null ? '—' : '¥' + (Math.round(n * 100) / 100).toLocaleString('zh-CN'); }
function relTime(ts) {
  const d = Date.now() - ts;
  if (d < 60e3) return '刚刚';
  if (d < 3600e3) return Math.floor(d / 60e3) + ' 分钟前';
  if (d < 86400e3) return Math.floor(d / 3600e3) + ' 小时前';
  if (d < 7 * 86400e3) return Math.floor(d / 86400e3) + ' 天前';
  return new Date(ts).toLocaleDateString('zh-CN');
}
function copyText(t) {
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => toast('已复制')).catch(() => fallbackCopy(t));
  else fallbackCopy(t);
}
function fallbackCopy(t) {
  const ta = h('textarea', { value: t, style: 'position:fixed;opacity:0' });
  document.body.append(ta); ta.select();
  try { document.execCommand('copy'); toast('已复制'); } catch (e) { toast('复制失败', true); }
  ta.remove();
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function localDate() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

const STATUS_ZH = {
  draft: '草稿', pending: '处理中', active: '在售', paused: '已下架', rejected: '平台已下架',
  placed: '新询单', talking: '洽谈中', completed: '已成交', delivered: '已送达', void: '已作废',
  suspended: '已暂停', closed: '已关闭',
};
