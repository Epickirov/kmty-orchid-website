// Cloudflare Pages Function — persistent colour/stock config for the
// Constellation order page. Route: /api/config
//
// Bindings on the Pages project (set once in the dashboard):
//   • KV namespace binding  KMTY_CONFIG   — stores the config JSON
//   • environment secret    ADMIN_PASS    — password the admin page must send
//
// GET  /api/config  → the stored config (or an empty one on first run)
// POST /api/config  → validate password, save the config (admin only)

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
};

function json(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: JSON_HEADERS });
}

export async function onRequestGet({ env }) {
  let raw = null;
  try { if (env.KMTY_CONFIG) raw = await env.KMTY_CONFIG.get('config'); } catch (e) {}
  if (raw) return new Response(raw, { headers: JSON_HEADERS });
  return json({ colors: [], updated: null });
}

export async function onRequestPost({ request, env }) {
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

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,x-admin-pass',
      'access-control-max-age': '86400',
    },
  });
}
