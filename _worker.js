// Cloudflare Pages — Advanced Mode single-file Worker.
//
// Runs on dashboard Direct Upload (no functions/ build needed). Backs the order
// page with Cloudflare KV. Never rewrites to a ".html" path (that caused an
// earlier redirect loop); lets Pages' html_handling serve pretty URLs itself.
//
// KV (binding KMTY_CONFIG), one namespace, key prefixes:
//   config            → colour/stock catalogue        (admin)
//   rs:<id>           → reseller: {name,company,logo,passHash,…}   (white-label)
//   ord:<rid>:<ts>-<r>→ an order (metadata carries a compact summary for lists)
// Secret ADMIN_PASS gates KMTY-admin writes; each reseller has its own password.
//
// API:
//   GET  /api/config                 colours (public; empty ⇒ page uses baked)
//   POST /api/config                 save colours                (admin)
//   GET  /api/reseller?id=<id>       public branding for a reseller link
//   GET  /api/resellers              list resellers              (admin)
//   POST /api/resellers              upsert/delete a reseller     (admin)
//   POST /api/order                  record an order             (public)
//   GET  /api/orders                 list orders (admin=all, reseller=own)

const JH = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' };
function json(b, s) { return new Response(JSON.stringify(b), { status: s || 200, headers: JH }); }

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return Array.from(new Uint8Array(buf)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
}
function clean(v, n) { return String(v == null ? '' : v).slice(0, n).replace(/[<>]/g, ''); }
function safeId(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32); }
function fixHex(h) { h = String(h || '').trim(); if (!/^#?[0-9A-Fa-f]{3,8}$/.test(h)) h = '#CCCCCC'; return h.charAt(0) === '#' ? h : '#' + h; }

/* ---------------- colours (unchanged behaviour) ---------------- */
async function configGet(env) {
  let raw = null;
  try { if (env.KMTY_CONFIG) raw = await env.KMTY_CONFIG.get('config'); } catch (e) {}
  return raw ? new Response(raw, { headers: JH }) : json({ colors: [], updated: null });
}
async function configPost(request, env) {
  const pass = request.headers.get('x-admin-pass') || '';
  if (!env.ADMIN_PASS || pass !== env.ADMIN_PASS) return json({ error: 'unauthorized' }, 401);
  if (!env.KMTY_CONFIG) return json({ error: 'storage not bound' }, 500);
  let data; try { data = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  if (!data || !Array.isArray(data.colors)) return json({ error: 'colors[] required' }, 400);
  const seen = {};
  const colors = data.colors.slice(0, 40).map(function (c) {
    c = c || {};
    return { zh: clean(c.zh, 20), en: clean(c.en, 30), hex: fixHex(c.hex), stock: c.stock !== false };
  }).filter(function (c) {
    if (!c.zh && !c.en) return false;
    const k = (c.zh + '|' + c.en).toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true;
  });
  if (!colors.length) return json({ error: 'no valid colours' }, 400);
  const out = JSON.stringify({ colors: colors, updated: new Date().toISOString() });
  try { await env.KMTY_CONFIG.put('config', out); } catch (e) { return json({ error: 'save failed' }, 500); }
  return new Response(out, { headers: JH });
}

/* ---------------- resellers (white-label) ---------------- */
// public: branding for one reseller link (never returns the password hash)
async function resellerGet(env, url) {
  const id = safeId(url.searchParams.get('id'));
  if (!id) return json({ error: 'no id' }, 400);
  let raw = null; try { raw = await env.KMTY_CONFIG.get('rs:' + id); } catch (e) {}
  if (!raw) return json({ error: 'not found' }, 404);
  const r = JSON.parse(raw);
  return json({ id: r.id, name: r.name, company: r.company, companyEn: r.companyEn, footer: r.footer, logo: r.logo || '' });
}
// serve a reseller's logo as a real image (for <img> in the admin list)
async function resellerLogo(env, url) {
  const id = safeId(url.searchParams.get('id'));
  let raw = null; try { raw = await env.KMTY_CONFIG.get('rs:' + id); } catch (e) {}
  if (!raw) return new Response('', { status: 404 });
  const logo = (JSON.parse(raw).logo) || '';
  const mm = logo.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/);
  if (!mm) return new Response('', { status: 404 });
  let bytes; try { bytes = Uint8Array.from(atob(mm[2]), function (c) { return c.charCodeAt(0); }); } catch (e) { return new Response('', { status: 404 }); }
  return new Response(bytes, { headers: { 'content-type': mm[1], 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
}
// admin: list + upsert + delete
async function resellersAdmin(request, env) {
  const pass = request.headers.get('x-admin-pass') || '';
  if (!env.ADMIN_PASS || pass !== env.ADMIN_PASS) return json({ error: 'unauthorized' }, 401);
  if (!env.KMTY_CONFIG) return json({ error: 'storage not bound' }, 500);

  if (request.method === 'GET') {
    const out = []; let cursor;
    do {
      const l = await env.KMTY_CONFIG.list({ prefix: 'rs:', cursor: cursor, limit: 1000 });
      l.keys.forEach(function (k) { const m = k.metadata || {}; out.push({ id: k.name.slice(3), name: m.name || '', company: m.company || '', hasLogo: !!m.hasLogo, hasPass: !!m.hasPass, created: m.created || '' }); });
      cursor = l.list_complete ? null : l.cursor;
    } while (cursor);
    out.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    return json({ resellers: out });
  }

  let d; try { d = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  if (d.op === 'delete') {
    const id = safeId(d.id); if (!id) return json({ error: 'no id' }, 400);
    try { await env.KMTY_CONFIG.delete('rs:' + id); } catch (e) { return json({ error: 'delete failed' }, 500); }
    return json({ ok: true });
  }
  // upsert
  const id = safeId(d.id);
  if (!id) return json({ error: 'id must be letters/numbers/-/_' }, 400);
  const name = clean(d.name, 40); if (!name) return json({ error: 'name required' }, 400);
  let existing = null; try { const raw = await env.KMTY_CONFIG.get('rs:' + id); if (raw) existing = JSON.parse(raw); } catch (e) {}
  let passHash = existing ? existing.passHash : '';
  if (d.pass) passHash = await sha256(d.pass);
  if (!passHash) return json({ error: 'password required for a new reseller' }, 400);
  let logo = existing ? (existing.logo || '') : '';
  if (typeof d.logo === 'string') {
    if (d.logo === '') logo = '';
    else if (d.logo.slice(0, 11) === 'data:image/' && d.logo.length < 400000) logo = d.logo;
    else if (d.logo === '__keep__') logo = existing ? (existing.logo || '') : '';
  }
  const rec = {
    id: id, name: name, company: clean(d.company, 60), companyEn: clean(d.companyEn, 80),
    footer: clean(d.footer, 40) || name.toUpperCase(), logo: logo, passHash: passHash,
    created: existing ? existing.created : new Date().toISOString(),
  };
  try {
    await env.KMTY_CONFIG.put('rs:' + id, JSON.stringify(rec), {
      metadata: { name: rec.name, company: rec.company, hasLogo: !!rec.logo, hasPass: !!rec.passHash, created: rec.created },
    });
  } catch (e) { return json({ error: 'save failed' }, 500); }
  return json({ ok: true, reseller: { id: rec.id, name: rec.name, company: rec.company, companyEn: rec.companyEn, footer: rec.footer, hasLogo: !!rec.logo } });
}

/* ---------------- orders ---------------- */
async function orderPost(request, env) {
  if (!env.KMTY_CONFIG) return json({ error: 'storage not bound' }, 500);
  let d; try { d = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const name = clean(d.name, 40);
  const phone = clean(d.phone, 24).replace(/[^\d +\-]/g, '');
  if (!name) return json({ error: 'name required' }, 400);
  if (phone.replace(/\D/g, '').length < 6) return json({ error: 'phone required' }, 400);
  let qty = parseInt(d.qty, 10); if (!(qty >= 1)) qty = 1; if (qty > 9999) qty = 9999;
  let reseller = safeId(d.reseller) || '_';
  if (reseller !== '_') { let raw = null; try { raw = await env.KMTY_CONFIG.get('rs:' + reseller); } catch (e) {} if (!raw) reseller = '_'; }
  const recipe = Array.isArray(d.recipe) ? d.recipe.slice(0, 3).map(function (c) {
    return { zh: clean(c && c.zh, 20), en: clean(c && c.en, 30), pct: Math.max(0, Math.min(100, parseInt(c && c.pct, 10) || 0)) };
  }) : [];
  const mix = (d.mix && typeof d.mix === 'object') ? {
    seed: parseInt(d.mix.seed, 10) || 0,
    sel: Array.isArray(d.mix.sel) ? d.mix.sel.slice(0, 3).map(function (x) { return parseInt(x, 10) || 0; }) : [],
    weights: (d.mix.weights && typeof d.mix.weights === 'object') ? d.mix.weights : {},
  } : null;
  const m = clean(d.m, 40);                                   // #m= restore hash
  const ts = Date.now();
  const id = (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : (ts.toString(36) + Math.floor(ts % 9973).toString(36)));
  const summary = recipe.map(function (c) { return (c.zh || c.en) + ' ' + c.pct + '%'; }).join(' · ');
  const key = 'ord:' + reseller + ':' + ts + '-' + id;
  const full = { id: id, reseller: reseller, name: name, phone: phone, qty: qty, date: clean(d.date, 12), ts: ts, recipe: recipe, mix: mix, m: m };
  try {
    await env.KMTY_CONFIG.put(key, JSON.stringify(full), {
      metadata: { name: name, phone: phone, qty: qty, date: full.date, ts: ts, reseller: reseller, recipe: summary.slice(0, 120), m: m },
    });
  } catch (e) { return json({ error: 'save failed' }, 500); }
  return json({ ok: true, id: id });
}

async function ordersGet(request, env) {
  if (!env.KMTY_CONFIG) return json({ error: 'storage not bound' }, 500);
  const adminPass = request.headers.get('x-admin-pass') || '';
  const rid = safeId(request.headers.get('x-reseller-id'));
  const rpass = request.headers.get('x-reseller-pass') || '';
  let prefix, scope;
  if (env.ADMIN_PASS && adminPass === env.ADMIN_PASS) { prefix = 'ord:'; scope = 'admin'; }
  else if (rid) {
    let raw = null; try { raw = await env.KMTY_CONFIG.get('rs:' + rid); } catch (e) {}
    if (!raw) return json({ error: 'unauthorized' }, 401);
    const r = JSON.parse(raw);
    if ((await sha256(rpass)) !== r.passHash) return json({ error: 'unauthorized' }, 401);
    prefix = 'ord:' + rid + ':'; scope = rid;
  } else return json({ error: 'unauthorized' }, 401);

  const out = []; let cursor;
  do {
    const l = await env.KMTY_CONFIG.list({ prefix: prefix, cursor: cursor, limit: 1000 });
    l.keys.forEach(function (k) { const md = k.metadata || {}; md.key = k.name; out.push(md); });
    cursor = l.list_complete ? null : l.cursor;
  } while (cursor && out.length < 5000);
  out.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  return json({ orders: out, scope: scope, count: out.length });
}

function corsOptions() {
  return new Response(null, { headers: {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-admin-pass,x-reseller-id,x-reseller-pass',
    'access-control-max-age': '86400',
  } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    const m = request.method;

    if (p.slice(0, 5) === '/api/') {
      if (m === 'OPTIONS') return corsOptions();
      if (p === '/api/config') return m === 'GET' ? configGet(env) : m === 'POST' ? configPost(request, env) : json({ error: 'method' }, 405);
      if (p === '/api/reseller') return m === 'GET' ? resellerGet(env, url) : json({ error: 'method' }, 405);
      if (p === '/api/reseller-logo') return m === 'GET' ? resellerLogo(env, url) : json({ error: 'method' }, 405);
      if (p === '/api/resellers') return (m === 'GET' || m === 'POST') ? resellersAdmin(request, env) : json({ error: 'method' }, 405);
      if (p === '/api/order') return m === 'POST' ? orderPost(request, env) : json({ error: 'method' }, 405);
      if (p === '/api/orders') return m === 'GET' ? ordersGet(request, env) : json({ error: 'method' }, 405);
      return json({ error: 'not found' }, 404);
    }

    // '/order' and branded '/r/<id>' links both serve the root order page.
    // Rewrite to '/' (always 200) — never to a '.html' path (avoids the
    // html_handling extension-drop redirect loop).
    if (p === '/order' || p.slice(0, 3) === '/r/') {
      const dest = new URL(url.toString()); dest.pathname = '/';
      return env.ASSETS.fetch(new Request(dest.toString(), request));
    }

    // everything else → static (Pages serves /admin, /stock, /reseller, /constellation, files)
    return env.ASSETS.fetch(request);
  },
};
