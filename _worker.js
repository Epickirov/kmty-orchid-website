// Cloudflare Pages — Advanced Mode single-file Worker.
//
// Why this file exists: the dashboard "Upload assets" (Direct Upload) flow does
// NOT compile a functions/ directory, but it DOES run a root _worker.js. So the
// persistent colour/stock backend lives here instead of functions/api/config.js.
//
// It intercepts ONLY /api/config and a few clean-URL aliases; every other
// request (including "/", the customer order page) is passed straight through to
// the uploaded static files via env.ASSETS.fetch — so the live order page cannot
// be affected by anything in here.
//
// Dashboard bindings to switch on persistence (Settings → the project):
//   • KV namespace binding  KMTY_CONFIG  — stores the config JSON
//   • secret / variable     ADMIN_PASS   — password the /admin page must send
// Until those exist, GET returns an empty config (order page uses its baked
// palette) and POST returns a clear error — nothing breaks.

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
};

function json(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: JSON_HEADERS });
}

async function handleConfigGet(env) {
  let raw = null;
  try { if (env.KMTY_CONFIG) raw = await env.KMTY_CONFIG.get('config'); } catch (e) {}
  if (raw) return new Response(raw, { headers: JSON_HEADERS });
  return json({ colors: [], updated: null });
}

async function handleConfigPost(request, env) {
  // fail closed: no password configured → no writes allowed
  const pass = request.headers.get('x-admin-pass') || '';
  if (!env.ADMIN_PASS || pass !== env.ADMIN_PASS) return json({ error: 'unauthorized' }, 401);
  if (!env.KMTY_CONFIG) return json({ error: 'storage not bound' }, 500);

  let data;
  try { data = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  if (!data || !Array.isArray(data.colors)) return json({ error: 'colors[] required' }, 400);

  // sanitise: cap count, clamp names, validate hex, coerce stock, drop dupes
  const seen = {};
  const colors = data.colors.slice(0, 40).map(function (c) {
    c = c || {};
    let hex = String(c.hex || '').trim();
    if (!/^#?[0-9A-Fa-f]{3,8}$/.test(hex)) hex = '#CCCCCC';
    if (hex.charAt(0) !== '#') hex = '#' + hex;
    return {
      zh: String(c.zh == null ? '' : c.zh).slice(0, 20).replace(/[<>]/g, ''),
      en: String(c.en == null ? '' : c.en).slice(0, 30).replace(/[<>]/g, ''),
      hex: hex,
      stock: c.stock !== false,
    };
  }).filter(function (c) {
    if (!c.zh && !c.en) return false;
    const key = (c.zh + '|' + c.en).toLowerCase();
    if (seen[key]) return false;
    seen[key] = 1;
    return true;
  });
  if (!colors.length) return json({ error: 'no valid colours' }, 400);

  const out = JSON.stringify({ colors: colors, updated: new Date().toISOString() });
  try { await env.KMTY_CONFIG.put('config', out); }
  catch (e) { return json({ error: 'save failed' }, 500); }
  return new Response(out, { headers: JSON_HEADERS });
}

function corsOptions() {
  return new Response(null, {
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,x-admin-pass',
      'access-control-max-age': '86400',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;

    // ---- the only dynamic route ----
    if (p === '/api/config') {
      if (request.method === 'GET') return handleConfigGet(env);
      if (request.method === 'POST') return handleConfigPost(request, env);
      if (request.method === 'OPTIONS') return corsOptions();
      return json({ error: 'method not allowed' }, 405);
    }

    // ---- clean-URL aliases → serve the matching .html static asset ----
    // (these never include "/", so the bare order-page URL is untouched)
    let rewrite = null;
    if (p === '/order' || p === '/constellation') rewrite = '/constellation.html';
    else if (p === '/admin') rewrite = '/admin.html';
    else if (p === '/stock') rewrite = '/stock.html';

    if (rewrite) {
      const dest = new URL(url.toString());
      dest.pathname = rewrite;
      return env.ASSETS.fetch(new Request(dest.toString(), request));
    }

    // ---- everything else (/, /index.html, /*.html, /images/…) → static ----
    return env.ASSETS.fetch(request);
  },
};
