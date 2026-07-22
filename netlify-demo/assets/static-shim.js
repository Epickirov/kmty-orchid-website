/* Static demo shim: replays pre-dumped GET APIs, stubs writes. */
'use strict';
window.__STATIC__ = true;
(function () {
  const san = (u) => u.replace(/^\//, '').replace(/[^a-zA-Z0-9]/g, '_');
  const orig = API.req;
  API.req = async function (method, url, body, opts) {
    if (method === 'GET') {
      // demo search: serve the base market dump, filter client-side
      const mq = /^\/api\/market\?q=(.*)$/.exec(url);
      if (mq) {
        const base = await (await fetch('/demo-data/' + san('/api/market') + '.json')).json();
        const q = decodeURIComponent(mq[1]).toLowerCase();
        return { ...base, products: base.products.filter((p) => (p.title + p.variety).toLowerCase().includes(q)) };
      }
      const r = await fetch('/demo-data/' + san(url) + '.json');
      if (!r.ok) { const e = new Error('演示数据缺失'); e.status = 404; throw e; }
      return r.json();
    }
    if (url === '/api/order') {
      await new Promise((res) => setTimeout(res, 350));
      return { ok: true, id: 'demo', code: 'DEMO88' };
    }
    toast('演示模式 — 此操作在正式版开放', true);
    const e = new Error('演示模式'); e.status = 400; throw e;
  };
  // constellation configurator is not part of the static demo
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest && ev.target.closest('a[href^="/r/"], a[href="/seller"]');
    if (a) { ev.preventDefault(); toast('演示模式 — 该页面在正式版开放'); }
  }, true);
  // demo badge
  addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div');
    b.textContent = '演示数据';
    b.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99;font-size:11px;letter-spacing:.12em;color:#F3EEE4;background:rgba(20,15,26,.85);border:1px solid rgba(231,183,207,.4);border-radius:999px;padding:6px 13px;backdrop-filter:blur(8px);pointer-events:none';
    document.body.append(b);
  });
})();
