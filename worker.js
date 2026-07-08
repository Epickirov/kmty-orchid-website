// Cloudflare Worker (Static Assets model) for the KMTY site + Constellation
// order page. It serves the static files, rewrites the clean URLs, and backs
// the /api/config colour/stock store with KV.
//
// Bindings (see wrangler.jsonc / the dashboard):
//   ASSETS       — the static files (bound automatically)
//   KMTY_CONFIG  — KV namespace holding the config JSON (added once it exists)
//   ADMIN_PASS   — secret; the password the admin page must send to save

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
};
const j = (body, status) => new Response(JSON.stringify(body), { status: status || 200, headers: JSON_HEADERS });

// clean URLs -> the file they serve (address bar keeps the short path)
const REWRITES = {
  '/order': '/constellation.html',
  '/constellation': '/constellation.html',
  '/stock': '/stock.html',
  '/admin': '/admin.html',
};

async function apiConfig(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'content-type,x-admin-pass',
        'access-control-max-age': '86400',
      },
    });
  }
  if (request.method === 'GET') {
    let raw = null;
    try { if (env.KMTY_CONFIG) raw = await env.KMTY_CONFIG.get('config'); } catch (e) {}
    return raw ? new Response(raw, { headers: JSON_HEADERS }) : j({ colors: [], updated: null });
  }
  if (request.method === 'POST') {
    // fail closed: no password configured → no writes allowed
    const pass = request.headers.get('x-admin-pass') || '';
    if (!env.ADMIN_PASS || pass !== env.ADMIN_PASS) return j({ error: 'unauthorized' }, 401);
    if (!env.KMTY_CONFIG) return j({ error: 'storage not bound' }, 500);
    let data;
    try { data = await request.json(); } catch (e) { return j({ error: 'bad json' }, 400); }
    if (!data || !Array.isArray(data.colors)) return j({ error: 'colors[] required' }, 400);
    // sanitise: cap count, clamp names, validate hex, coerce stock, drop dupes
    const seen = {};
    const colors = data.colors.slice(0, 40).map((c) => {
      c = c || {};
      let hex = String(c.hex || '').trim();
      if (!/^#?[0-9A-Fa-f]{3,8}$/.test(hex)) hex = '#CCCCCC';
      if (hex.charAt(0) !== '#') hex = '#' + hex;
      return {
        zh: String(c.zh == null ? '' : c.zh).slice(0, 20).replace(/[<>]/g, ''),
        en: String(c.en == null ? '' : c.en).slice(0, 30).replace(/[<>]/g, ''),
        hex,
        stock: c.stock !== false,
      };
    }).filter((c) => {
      if (!c.zh && !c.en) return false;
      const key = (c.zh + '|' + c.en).toLowerCase();
      if (seen[key]) return false;
      seen[key] = 1;
      return true;
    });
    if (!colors.length) return j({ error: 'no valid colours' }, 400);
    const out = JSON.stringify({ colors, updated: new Date().toISOString() });
    try { await env.KMTY_CONFIG.put('config', out); } catch (e) { return j({ error: 'save failed' }, 500); }
    return new Response(out, { headers: JSON_HEADERS });
  }
  return j({ error: 'method not allowed' }, 405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/config') return apiConfig(request, env);
    const rw = REWRITES[url.pathname];
    if (rw) {
      const target = new URL(request.url);
      target.pathname = rw;
      return env.ASSETS.fetch(new Request(target, request));
    }
    return env.ASSETS.fetch(request);
  },
};
