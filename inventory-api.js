// Inventory inquiry — the API behind /inventory and /inventory-admin.
//
// Imported by site-worker.js, which owns routing and the Resend sender. Kept in
// its own file because it is most of the worker's logic and none of its
// plumbing.
//
// Storage is the Pages project's KV namespace, keyed by prefix so it can share
// the namespace the leads ledger already uses:
//   invcfg            → { code, updatedAt }        the buyers' access code
//   inv:<id>          → a batch (see below); no image, so lists stay small
//   invimg:<id>       → that batch's photo, as a data URL
//   inq:<ts>-<rand>   → an inquiry and its status
//
// A batch is what a grower actually has: a quantity of one variety in one cup
// size, ready across a window of ISO weeks — "5,000 of TPL-411 in 2.5in, weeks
// 12 to 20". A buyer asking for week 15 draws from that batch. Quantity is the
// pool, not a per-week figure, which is why the customer page shows the whole
// window next to every week it appears in.
//
// Two levels of access, both deliberately simple:
//   x-admin-pass  === env.ADMIN_PASS   staff: everything
//   x-inv-code    === the stored code  buyers: read the catalogue, send an
//                                      inquiry. One shared code, rotated from
//                                      the admin page — not an account system,
//                                      because buyers should not have to
//                                      register to ask what is in stock.
// The code is compared in constant time so the endpoint cannot be used to
// guess it a character at a time.

const JH = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
export function json(b, s) { return new Response(JSON.stringify(b), { status: s || 200, headers: JH }); }

function kv(env) { return env.INVENTORY || env.LEADS || env.KMTY_CONFIG || null; }

function str(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[<>]/g, '').trim().slice(0, n); }
function int(v, lo, hi, dflt) {
  const n = Math.round(Number(v));
  if (!isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
}
function id6() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6))).map(x => x.toString(16).padStart(2, '0')).join('');
}

/* Constant-time compare: a plain === leaks how many characters matched through
   timing, which is exactly how you brute-force a shared secret. */
function sameSecret(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!b) return false;                       // an unset code unlocks nothing
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

async function isAdmin(request, env) {
  return !!env.ADMIN_PASS && sameSecret(request.headers.get('x-admin-pass'), env.ADMIN_PASS);
}
async function settings(env) {
  const K = kv(env); if (!K) return { code: '' };
  try { return JSON.parse(await K.get('invcfg') || '{}'); } catch (e) { return { code: '' }; }
}
async function isBuyer(request, env) {
  if (await isAdmin(request, env)) return true;
  const s = await settings(env);
  return sameSecret(request.headers.get('x-inv-code'), s.code);
}

/* ---------------- ISO weeks ----------------
   Week 1 is the week containing 4 January, weeks start on Monday — the
   convention the trade already prices and books shipping in. Kept here as well
   as in the page so the server never trusts a week number the client made up. */
export function isoWeeksInYear(y) {
  const jan1 = new Date(Date.UTC(y, 0, 1)).getUTCDay();
  const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return (jan1 === 4 || (isLeap && jan1 === 3)) ? 53 : 52;
}
export function isoWeekOf(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));       // to that week's Thursday
  const yStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { year: d.getUTCFullYear(), week: Math.ceil(((d - yStart) / 86400000 + 1) / 7) };
}

/* ---------------- batches ---------------- */
function cleanItem(b, prev) {
  const weeks = [int(b.from, 1, 53, 1), int(b.to, 1, 53, 53)];
  if (weeks[1] < weeks[0]) weeks.reverse();
  return {
    id: prev ? prev.id : id6(),
    code: str(b.code, 24).toUpperCase(),
    nameEn: str(b.nameEn, 60),
    nameZh: str(b.nameZh, 60),
    cup: str(b.cup, 24),
    qty: int(b.qty, 0, 9999999, 0),
    tray: int(b.tray, 0, 10000, 0),        // units per tray; 0 = no multiple enforced
    from: weeks[0],
    to: weeks[1],
    year: int(b.year, 2000, 2100, new Date().getUTCFullYear()),
    note: str(b.note, 140),
    img: prev ? !!prev.img : false,
    updatedAt: Date.now(),
  };
}

async function listItems(env) {
  const K = kv(env); if (!K) return [];
  const out = [];
  let cursor;
  do {
    const page = await K.list({ prefix: 'inv:', cursor, limit: 1000 });
    for (const k of page.keys) {
      try { const v = await K.get(k.name); if (v) out.push(JSON.parse(v)); } catch (e) {}
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  out.sort((a, b) => a.from - b.from || String(a.code).localeCompare(String(b.code)) || String(a.cup).localeCompare(String(b.cup)));
  return out;
}

async function saveItem(request, env) {
  const K = kv(env); if (!K) return json({ error: 'no kv binding' }, 500);
  let b; try { b = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }

  if (b.delete) {
    const del = str(b.id, 16);
    if (!del) return json({ error: 'id' }, 400);
    await K.delete('inv:' + del); await K.delete('invimg:' + del);
    return json({ ok: true, deleted: del });
  }

  let prev = null;
  if (b.id) { try { const raw = await K.get('inv:' + str(b.id, 16)); if (raw) prev = JSON.parse(raw); } catch (e) {} }
  const item = cleanItem(b, prev);
  if (!item.code || !item.nameEn) return json({ error: 'code and English name are required' }, 400);

  // '__keep__' leaves the stored photo alone, '' removes it, anything else is a
  // new data URL — the same three-way the reseller logos use
  if (typeof b.img === 'string' && b.img !== '__keep__') {
    if (b.img === '') { await K.delete('invimg:' + item.id); item.img = false; }
    else if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(b.img) && b.img.length < 3_000_000) {
      await K.put('invimg:' + item.id, b.img); item.img = true;
    } else return json({ error: 'image must be a png/jpeg/webp data URL under 3MB' }, 400);
  }

  await K.put('inv:' + item.id, JSON.stringify(item));
  return json({ ok: true, item });
}

async function serveImage(url, env) {
  const K = kv(env); if (!K) return new Response('', { status: 404 });
  const raw = await K.get('invimg:' + str(url.searchParams.get('id'), 16));
  if (!raw) return new Response('', { status: 404 });
  const m = /^data:(image\/[a-z]+);base64,(.*)$/.exec(raw);
  if (!m) return new Response('', { status: 404 });
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  // the id changes whenever the photo does, so this can cache hard
  return new Response(bytes, { headers: { 'content-type': m[1], 'cache-control': 'public, max-age=86400' } });
}

/* ---------------- inquiries ---------------- */
const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,24}$/;

async function submitInquiry(request, env, sendMail) {
  const K = kv(env); if (!K) return json({ error: 'no kv binding' }, 500);
  let b; try { b = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  if (b.hp) return json({ ok: true });                       // honeypot, same as /api/lead

  const buyer = {
    company: str(b.company, 80), name: str(b.name, 80),
    email: str(b.email, 120), tel: str(b.tel, 40),
    country: str(b.country, 60), note: str(b.note, 600),
  };
  if (!EMAIL_RE.test(buyer.email)) return json({ error: 'a valid email is required' }, 400);

  const items = await listItems(env);
  const byId = new Map(items.map(i => [i.id, i]));
  const lines = [];
  for (const raw of (Array.isArray(b.lines) ? b.lines.slice(0, 60) : [])) {
    const item = byId.get(str(raw.id, 16));
    let qty = int(raw.qty, 1, 9999999, 0);
    const week = int(raw.week, 1, 53, 0);
    if (!item || !qty || !week) continue;
    if (week < item.from || week > item.to) continue;         // never trust the client's week
    if (item.tray > 1) qty = Math.max(item.tray, Math.round(qty / item.tray) * item.tray);
    lines.push({
      id: item.id, code: item.code, nameEn: item.nameEn, nameZh: item.nameZh,
      cup: item.cup, week, qty, year: item.year, tray: item.tray,
      stockAtRequest: item.qty,                                // what staff should sanity-check against
    });
  }
  if (!lines.length) return json({ error: 'no valid lines' }, 400);

  const rec = {
    ts: Date.now(), ref: 'INQ-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + id6().slice(0, 4).toUpperCase(),
    buyer, lines, status: 'pending', lang: str(b.lang, 5) || 'en',
    ip: request.headers.get('cf-connecting-ip') || '',
  };
  // stored before the mail goes out, so an inquiry is never lost to a mail failure
  await K.put('inq:' + rec.ts + '-' + id6().slice(0, 6), JSON.stringify(rec));

  let mailed = true, mailError = '';
  try { await sendMail(env, rec); } catch (e) { mailed = false; mailError = String(e && e.message || e).slice(0, 140); }
  return json({ ok: true, ref: rec.ref, mailed, mailError });
}

async function listInquiries(env) {
  const K = kv(env); if (!K) return [];
  const out = []; let cursor;
  do {
    const page = await K.list({ prefix: 'inq:', cursor, limit: 1000 });
    for (const k of page.keys) {
      try { const v = await K.get(k.name); if (v) out.push(Object.assign(JSON.parse(v), { key: k.name })); } catch (e) {}
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  out.sort((a, b) => b.ts - a.ts);
  return out;
}

/* Confirming is the only thing that moves stock. It is idempotent by status:
   an inquiry already decided cannot be decided again, so a double-click or a
   retried request cannot deduct the same plants twice. */
async function decide(request, env) {
  const K = kv(env); if (!K) return json({ error: 'no kv binding' }, 500);
  let b; try { b = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const key = String(b.key || '');
  if (!key.startsWith('inq:')) return json({ error: 'key' }, 400);
  const action = b.action === 'confirm' ? 'confirmed' : b.action === 'decline' ? 'declined' : null;
  if (!action) return json({ error: 'action' }, 400);

  let rec; try { rec = JSON.parse(await K.get(key) || 'null'); } catch (e) { rec = null; }
  if (!rec) return json({ error: 'not found' }, 404);
  if (rec.status !== 'pending') return json({ error: 'already ' + rec.status, status: rec.status }, 409);

  const applied = [];
  if (action === 'confirmed') {
    for (const line of rec.lines) {
      let item; try { item = JSON.parse(await K.get('inv:' + line.id) || 'null'); } catch (e) { item = null; }
      if (!item) { applied.push({ id: line.id, code: line.code, taken: 0, missing: true }); continue; }
      const taken = Math.min(item.qty, line.qty);              // never below zero
      item.qty -= taken; item.updatedAt = Date.now();
      await K.put('inv:' + item.id, JSON.stringify(item));
      applied.push({ id: item.id, code: item.code, cup: item.cup, asked: line.qty, taken, left: item.qty, short: line.qty - taken });
    }
  }
  rec.status = action; rec.decidedAt = Date.now(); rec.applied = applied;
  await K.put(key, JSON.stringify(rec));
  return json({ ok: true, status: rec.status, applied });
}

/* ---------------- routing ---------------- */
export async function handleInventory(request, env, url, sendMail) {
  const p = url.pathname;
  const method = request.method;
  const admin = await isAdmin(request, env);

  if (p === '/api/inv/unlock' && method === 'POST') {
    let b; try { b = await request.json(); } catch (e) { b = {}; }
    const s = await settings(env);
    if (!s.code) return json({ ok: false, error: 'no-code' }, 503);
    return sameSecret(b.code, s.code) ? json({ ok: true }) : json({ ok: false }, 401);
  }

  if (p === '/api/inv/items' && method === 'GET') {
    if (!(await isBuyer(request, env))) return json({ error: 'locked' }, 401);
    const items = (await listItems(env)).filter(i => admin || i.qty > 0);
    return json({ ok: true, admin, year: new Date().getUTCFullYear(), items });
  }

  /* Photos are the one thing here that is not gated, because a browser cannot
     put a header on an <img src> — the gate would have to move into the URL or
     into a cookie, and neither buys anything. What it would protect is a
     picture of an orchid behind a 48-bit random id: without the catalogue,
     which IS gated, that id maps to no code, no quantity and no week, and the
     ids cannot be enumerated. The commercial information is the numbers, and
     the numbers stay behind the code. */
  if (p === '/api/inv/img' && method === 'GET') return serveImage(url, env);

  /* A buyer who has sent a request should not have to email and ask what
     happened to it. The reference alone is not enough to look one up — it is
     short and dated, so it is guessable — but reference plus the email it was
     sent from is not, and it is exactly what the buyer has to hand. */
  if (p === '/api/inv/status' && method === 'POST') {
    if (!(await isBuyer(request, env))) return json({ error: 'locked' }, 401);
    let b; try { b = await request.json(); } catch (e) { b = {}; }
    const ref = str(b.ref, 40).toUpperCase(), email = str(b.email, 120).toLowerCase();
    if (!ref || !email) return json({ error: 'ref and email' }, 400);
    const all = await listInquiries(env);
    const hit = all.find(q => String(q.ref).toUpperCase() === ref &&
                              String(q.buyer.email).toLowerCase() === email);
    if (!hit) return json({ ok: false, error: 'not-found' }, 404);
    return json({
      ok: true,
      ref: hit.ref, status: hit.status, ts: hit.ts, decidedAt: hit.decidedAt || null,
      lines: hit.lines.map(l => ({ code: l.code, nameEn: l.nameEn, nameZh: l.nameZh, cup: l.cup, week: l.week, qty: l.qty })),
      // what was actually set aside, once staff have decided
      applied: hit.status === 'confirmed' ? (hit.applied || []).map(a => ({ code: a.code, taken: a.taken, short: a.short })) : null,
    });
  }

  if (p === '/api/inv/inquire' && method === 'POST') {
    if (!(await isBuyer(request, env))) return json({ error: 'locked' }, 401);
    return submitInquiry(request, env, sendMail);
  }

  // ---- staff only ----
  if (p.startsWith('/api/inv/admin/')) {
    if (!admin) return json({ error: 'unauthorized' }, 401);
    const K = kv(env);
    if (p === '/api/inv/admin/item' && method === 'POST') return saveItem(request, env);
    if (p === '/api/inv/admin/inquiries' && method === 'GET') return json({ ok: true, inquiries: await listInquiries(env) });
    if (p === '/api/inv/admin/decide' && method === 'POST') return decide(request, env);
    if (p === '/api/inv/admin/settings') {
      if (method === 'GET') return json({ ok: true, settings: await settings(env) });
      if (method === 'POST') {
        let b; try { b = await request.json(); } catch (e) { b = {}; }
        const code = str(b.code, 40);
        if (code && code.length < 4) return json({ error: 'code must be at least 4 characters' }, 400);
        await K.put('invcfg', JSON.stringify({ code, updatedAt: Date.now() }));
        return json({ ok: true });
      }
    }
    return json({ error: 'not found' }, 404);
  }

  return null;     // not an inventory route; let the caller fall through
}
