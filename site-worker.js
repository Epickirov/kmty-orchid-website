// kmty-site advanced-mode worker.
// Static passthrough for the whole site (never rewrites .html — that pattern
// caused a redirect loop once; everything except /api/* goes straight to
// env.ASSETS), plus POST /api/lead: the catalog-request form endpoint, and
// /api/inv/* — the inventory inquiry API, which lives in inventory-api.js.
//
// /api/lead writes every lead into KV first (never lose one), then emails it to
// office@kmtybio.com. Primary sender is the Resend HTTP API — shared Worker
// egress IPs get tarpitted by Netease's SMTP, so raw SMTP (below) is kept only
// as a dormant fallback. Config on the Pages project:
//   RESEND_API_KEY (secret)  Resend sending key            — primary path
//   MAIL_FROM      (plain)   KMTY Website <website@kmtyorchid.com>
//   MAIL_TO        (plain)   office@kmtybio.com
//   LEADS          (KV)      lead ledger + soft per-IP rate limit, and the
//                            inventory catalogue (see inventory-api.js)
//   ADMIN_PASS     (secret)  gates /inventory-admin and /api/inv/admin/*
// Dormant SMTP fallback (only if RESEND_API_KEY unset and SMTP_ENABLED='1'):
//   SMTP_HOST (plain)  smtp.qiye.163.com
//   SMTP_USER (plain)  office@kmtybio.com     — auth user AND From AND To
//   SMTP_PASS (secret) Netease client authorization code (授权码)
import { connect } from 'cloudflare:sockets';
import { handleInventory } from './inventory-api.js';

const JH = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (b, s) => new Response(JSON.stringify(b), { status: s || 200, headers: JH });

/* ---------- minimal SMTP client over cloudflare:sockets ---------- */
class Smtp {
  constructor(sock, deadline) {
    this.sock = sock; this.deadline = deadline;
    this.reader = sock.readable.getReader();
    this.writer = sock.writable.getWriter();
    this.buf = ''; this.dec = new TextDecoder();
  }
  async resp() {
    for (;;) {
      const end = this.buf.lastIndexOf('\r\n');
      if (end >= 0) {
        const full = this.buf.slice(0, end);
        const last = full.slice(full.lastIndexOf('\r\n') + 2);
        if (/^\d{3}( |$)/.test(last)) { this.buf = this.buf.slice(end + 2); return { code: parseInt(last, 10), text: full.slice(0, 400) }; }
      }
      const left = this.deadline - Date.now();
      if (left <= 0) throw new Error('smtp timeout');
      const t = new Promise((_, rej) => setTimeout(() => rej(new Error('smtp timeout')), left));
      const { value, done } = await Promise.race([this.reader.read(), t]);
      if (done) throw new Error('smtp connection closed');
      this.buf += this.dec.decode(value, { stream: true });
    }
  }
  async cmd(line, okClass, label) {
    await this.writer.write(new TextEncoder().encode(line + '\r\n'));
    const r = await this.resp();
    if (okClass && Math.floor(r.code / 100) !== okClass) throw new Error('SMTP ' + r.code + ' at ' + label + ': ' + r.text.slice(-160));
    return r;
  }
}

async function sendLeadMail(env, lead, trace, hostOverride, portOverride) {
  const host = hostOverride || env.SMTP_HOST || 'smtp.qiye.163.com';
  const port = portOverride || env.SMTP_PORT || '465';
  const user = env.SMTP_USER, pass = env.SMTP_PASS;
  if (!user || !pass) throw new Error('smtp not configured');
  const t0 = Date.now();
  const tr = (step, r) => { if (trace) trace.push({ step: step, ms: Date.now() - t0, code: r && r.code, text: r && String(r.text).slice(0, 90) }); };
  const sock = connect(host + ':' + port, { secureTransport: 'on', allowHalfOpen: false });
  const s = new Smtp(sock, Date.now() + 12000);
  try {
    tr('connect');
    let r = await s.resp(); tr('greeting', r);                   // 220 greeting
    r = await s.cmd('EHLO kmtyorchid.com', 2, 'EHLO'); tr('EHLO', r);
    r = await s.cmd('AUTH LOGIN', 3, 'AUTH'); tr('AUTH', r);
    r = await s.cmd(btoa(user), 3, 'AUTH user'); tr('AUTH user', r);
    r = await s.cmd(btoa(pass), 2, 'AUTH pass'); tr('AUTH pass', r);
    r = await s.cmd('MAIL FROM:<' + user + '>', 2, 'MAIL FROM'); tr('MAIL FROM', r);
    r = await s.cmd('RCPT TO:<' + user + '>', 2, 'RCPT TO'); tr('RCPT TO', r);
    r = await s.cmd('DATA', 3, 'DATA'); tr('DATA', r);
    const body =
      'Wholesale catalog request from the website.\r\n\r\n' +
      'Company:      ' + (lead.company || '-') + '\r\n' +
      'Contact:      ' + (lead.name || '-') + '\r\n' +
      'Buyer email:  ' + lead.email + '\r\n' +
      'Phone:        ' + (lead.tel || '-') + '\r\n' +
      'Language:     ' + lead.lang + '\r\n' +
      'Page:         ' + lead.page + '\r\n' +
      'Time (UTC):   ' + new Date().toISOString() + '\r\n' +
      'Visitor IP:   ' + lead.ip + '\r\n\r\n' +
      'Message:\r\n' + (lead.message || '(none)').replace(/\n/g, '\r\n') + '\r\n\r\n' +
      'Reply to this mail to answer the buyer directly (Reply-To is set).\r\n';
    const msg =
      'From: KMTY Website <' + user + '>\r\n' +
      'To: <' + user + '>\r\n' +
      'Reply-To: <' + lead.email + '>\r\n' +
      'Subject: Catalog request - ' + lead.email + '\r\n' +
      'Date: ' + new Date().toUTCString() + '\r\n' +
      'MIME-Version: 1.0\r\n' +
      'Content-Type: text/plain; charset=utf-8\r\n' +
      'Content-Transfer-Encoding: 7bit\r\n' +
      '\r\n' + body.replace(/\r\n\./g, '\r\n..');
    r = await s.cmd(msg + '\r\n.', 2, 'message'); tr('message', r);
    try { await s.cmd('QUIT', 2, 'QUIT'); } catch (e) {}
  } finally {
    try { await s.sock.close(); } catch (e) {}
  }
}

/* ---------- Resend HTTP sender (primary) ---------- */
async function sendViaResend(env, lead) {
  const from = env.MAIL_FROM || 'KMTY Website <website@kmtyorchid.com>';
  const to = env.MAIL_TO || 'office@kmtybio.com';
  const text =
    'Wholesale inquiry from the website.\n\n' +
    'Company:       ' + (lead.company || '—') + '\n' +
    'Contact:       ' + (lead.name || '—') + '\n' +
    'Buyer email:   ' + lead.email + '\n' +
    'Phone:         ' + (lead.tel || '—') + '\n' +
    'Type:          ' + (lead.type || '—') + '\n' +
    'Specification: ' + (lead.spec || '—') + '\n' +
    'Language:      ' + lead.lang + '\n' +
    'Page:          ' + lead.page + '\n' +
    'Time (UTC):    ' + new Date().toISOString() + '\n' +
    'Visitor IP:    ' + lead.ip + '\n\n' +
    'Message:\n' + (lead.message || '(none)') + '\n\n' +
    'Reply to this mail to answer the buyer directly (Reply-To is set).\n';
  const subject = 'Inquiry: ' + (lead.company || lead.email) +
    (lead.type ? ' · ' + lead.type + (lead.spec ? ' ' + lead.spec : '') : '');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'authorization': 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ from: from, to: [to], reply_to: lead.email, subject: subject, text: text }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) { let t = ''; try { t = await r.text(); } catch (e) {} throw new Error('resend ' + r.status + ': ' + t.slice(0, 140)); }
}

/* ---------- /api/lead ---------- */
const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,24}$/;

// single-line field: fold CR/LF/tab to space, drop angle brackets, collapse whitespace, cap length
function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}
// message: normalize newlines, neutralize angle brackets, cap length (kept for the email body)
function cleanMsg(v, max) {
  return String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/</g, '‹').replace(/>/g, '›').slice(0, max).trim();
}

async function handleLead(request, env) {
  let d; try { d = await request.json(); } catch (e) { return json({ ok: false, error: 'bad json' }, 400); }
  if (d && typeof d.hp === 'string' && d.hp !== '') return json({ ok: true });   // honeypot: swallow silently
  const email = String((d && d.email) || '').trim();
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: 'invalid email' }, 400);
  const lang = String((d && d.lang) || 'en').toLowerCase().replace(/[^a-z]/g, '').slice(0, 5) || 'en';
  const page = String((d && d.page) || '').slice(0, 200).replace(/[\r\n<>]/g, '');
  const company = clean(d && d.company, 120);
  const name = clean(d && d.name, 80);
  const tel = clean(d && d.tel, 40);
  const type = clean(d && d.type, 40);
  const spec = clean(d && d.spec, 20);
  const message = cleanMsg(d && d.message, 4000);
  const ip = request.headers.get('cf-connecting-ip') || '';

  // soft per-IP rate limit (KV is eventually consistent — good enough here)
  if (env.LEADS && ip) {
    const rk = 'rl:' + ip;
    try {
      const n = parseInt((await env.LEADS.get(rk)) || '0', 10);
      if (n >= 5) return json({ ok: false, error: 'too many requests' }, 429);
      await env.LEADS.put(rk, String(n + 1), { expirationTtl: 300 });
    } catch (e) {}
  }

  const lead = { email: email, company: company, name: name, tel: tel, type: type, spec: spec, message: message, lang: lang, page: page, ip: ip, ts: Date.now() };
  // ledger first (never lose a lead even if the mail send hiccups). Short fields
  // (+ a message preview) go into metadata so the admin 留言 list can show them
  // from a single list() call; the full message stays in the stored value.
  if (env.LEADS) {
    try {
      const meta = { email: email, lang: lang, ts: lead.ts };
      if (company) meta.company = company.slice(0, 60);
      if (name) meta.name = name.slice(0, 40);
      if (tel) meta.tel = tel.slice(0, 30);
      if (type) meta.type = type;
      if (spec) meta.spec = spec;
      if (message) meta.msg = message.replace(/\n/g, ' ').slice(0, 160);
      await env.LEADS.put('lead:' + lead.ts + '-' + Math.floor(Math.random() * 1e6).toString(36),
        JSON.stringify(lead), { metadata: meta });
    } catch (e) {}
  }
  try {
    if (env.RESEND_API_KEY) await sendViaResend(env, lead);
    else if (env.SMTP_ENABLED === '1') await sendLeadMail(env, lead);
    else return json({ ok: false, error: 'sender disabled (lead recorded)' }, 502);
  } catch (e) { return json({ ok: false, error: 'mail send failed: ' + String(e && e.message || e).slice(0, 120) }, 502); }
  return json({ ok: true });
}

/* ---------- inventory inquiry mail ----------
   This one is read by sales staff standing next to a production schedule, so
   it is laid out the way they check it: grouped by ISO week, because that is
   the unit production plans in, with the stock figure at the time of asking
   beside every line and anything that exceeds it called out. A plain-text part
   goes alongside, for phones and for whoever forwards it into WeChat. */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function groupByWeek(lines) {
  const weeks = new Map();
  for (const l of lines) { if (!weeks.has(l.week)) weeks.set(l.week, []); weeks.get(l.week).push(l); }
  return [...weeks.entries()].sort((a, b) => a[0] - b[0]);
}
/* The grade the buyer was looking at when they asked. Production checks the
   order against this, not against the variety name, so it travels with every
   line: cup, single or dual stem, and the two measurements. Bilingual on the
   stem because the sales desk reads English and the greenhouse reads 单梗. */
const STEM_LABEL = { SS: 'SS 单梗', DS: 'DS 双梗' };
function specHtml(l) {
  const top = [esc(l.cup) || '—', l.stem ? STEM_LABEL[l.stem] : ''].filter(Boolean).join(' · ');
  const meas = [l.ns ? 'N.S. ' + l.ns : '', l.ht ? 'H ' + l.ht : ''].filter(Boolean).join(' · ');
  return top + (meas ? `<br><span style="color:#7A7264;font-size:11px;">${meas} cm</span>` : '');
}
function specText(l) {
  const bits = [l.cup || '—'];
  if (l.stem) bits.push(l.stem);
  if (l.ns) bits.push('NS' + l.ns);
  if (l.ht) bits.push('H' + l.ht);
  return bits.join('/');
}

function inquiryHtml(rec) {
  const G = groupByWeek(rec.lines);
  const total = rec.lines.reduce((n, l) => n + l.qty, 0);
  const short = rec.lines.filter(l => l.qty > l.stockAtRequest);
  const cell = 'padding:9px 12px;border-bottom:1px solid #E6DFD1;font-size:13px;';
  const head = 'padding:7px 12px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#7A7264;text-align:left;font-weight:600;';

  let rows = '';
  for (const [week, ls] of G) {
    rows += `<tr><td colspan="5" style="padding:16px 12px 6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#4C8C57;font-weight:700;border-bottom:2px solid #4C8C57;">
      Week ${week} · 第 ${week} 周 <span style="color:#7A7264;font-weight:400;letter-spacing:0;text-transform:none;">— ${ls.reduce((n, l) => n + l.qty, 0).toLocaleString('en-US')} plants</span></td></tr>`;
    for (const l of ls) {
      const over = l.qty > l.stockAtRequest;
      rows += `<tr>
        <td style="${cell}font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:600;">${esc(l.code)}</td>
        <td style="${cell}">${esc(l.nameEn)}${l.nameZh ? `<br><span style="color:#7A7264;">${esc(l.nameZh)}</span>` : ''}</td>
        <td style="${cell}white-space:nowrap;">${specHtml(l)}</td>
        <td style="${cell}text-align:right;font-weight:700;font-size:15px;">${l.qty.toLocaleString('en-US')}</td>
        <td style="${cell}text-align:right;color:${over ? '#B0552F' : '#7A7264'};white-space:nowrap;">
          ${l.stockAtRequest.toLocaleString('en-US')}${over ? '<br><b>short ' + (l.qty - l.stockAtRequest).toLocaleString('en-US') + '</b>' : ''}</td>
      </tr>`;
    }
  }

  return `<div style="background:#F3EEE4;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif;color:#1A1E17;">
  <div style="max-width:660px;margin:0 auto;background:#FFF;border-radius:14px;overflow:hidden;box-shadow:0 2px 18px rgba(26,30,23,.09);">
    <div style="background:#1A1E17;color:#F3EEE4;padding:20px 24px;">
      <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.72;">Inventory inquiry · 库存询价</div>
      <div style="font-size:21px;font-weight:700;margin-top:5px;">${esc(rec.buyer.company || rec.buyer.name || rec.buyer.email)}</div>
      <div style="font-size:12px;opacity:.72;margin-top:5px;font-family:ui-monospace,Menlo,Consolas,monospace;">${esc(rec.ref)}</div>
    </div>
    ${short.length ? `<div style="background:#FBEEE7;color:#8E3F1F;padding:11px 24px;font-size:13px;">
      <b>${short.length} line${short.length > 1 ? 's' : ''} ${short.length > 1 ? 'exceed' : 'exceeds'} the stock we were showing.</b> Check with production before confirming.</div>` : ''}
    <table style="width:100%;border-collapse:collapse;">
      <tr><th style="${head}">Code</th><th style="${head}">Variety</th><th style="${head}">Spec · 规格</th>
          <th style="${head}text-align:right;">Wanted</th><th style="${head}text-align:right;">In stock</th></tr>
      ${rows}
      <tr><td colspan="3" style="${cell}border-bottom:none;padding-top:14px;font-weight:700;">Total</td>
          <td style="${cell}border-bottom:none;padding-top:14px;text-align:right;font-weight:700;font-size:16px;">${total.toLocaleString('en-US')}</td>
          <td style="${cell}border-bottom:none;"></td></tr>
    </table>
    <div style="padding:6px 24px 20px;font-size:13px;line-height:1.65;">
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid #E6DFD1;">
        <b>${esc(rec.buyer.name) || '—'}</b>${rec.buyer.country ? ' · ' + esc(rec.buyer.country) : ''}<br>
        <a href="mailto:${esc(rec.buyer.email)}" style="color:#B0552F;">${esc(rec.buyer.email)}</a>${rec.buyer.tel ? ' · ' + esc(rec.buyer.tel) : ''}
      </div>
      ${rec.buyer.note ? `<div style="margin-top:12px;padding:12px 14px;background:#F7F3EA;border-radius:9px;white-space:pre-wrap;">${esc(rec.buyer.note)}</div>` : ''}
      <div style="margin-top:16px;padding-top:14px;border-top:1px solid #E6DFD1;color:#55564A;font-size:12px;line-height:1.7;">
        Reply to this mail to answer the buyer directly.<br>
        Stock is <b>not</b> reserved yet — open <b>/inventory-admin → 询价</b> and confirm this inquiry to take the plants out of the system, or decline it to leave stock untouched.
      </div>
    </div>
  </div>
</div>`;
}

function inquiryText(rec) {
  let t = 'INVENTORY INQUIRY  ' + rec.ref + '\n\n' +
    'Company:  ' + (rec.buyer.company || '—') + '\nContact:  ' + (rec.buyer.name || '—') +
    '\nEmail:    ' + rec.buyer.email + '\nPhone:    ' + (rec.buyer.tel || '—') +
    '\nCountry:  ' + (rec.buyer.country || '—') + '\n\n';
  for (const [week, ls] of groupByWeek(rec.lines)) {
    t += 'WEEK ' + week + '\n';
    for (const l of ls) {
      t += '  ' + l.code.padEnd(10) + specText(l).padEnd(22) +
        String(l.qty).padStart(7) + '   (in stock ' + l.stockAtRequest + ')' +
        (l.qty > l.stockAtRequest ? '  ** SHORT ' + (l.qty - l.stockAtRequest) + ' **' : '') + '\n';
    }
  }
  t += '\nTotal: ' + rec.lines.reduce((n, l) => n + l.qty, 0) + ' plants\n';
  if (rec.buyer.note) t += '\nNote from buyer:\n' + rec.buyer.note + '\n';
  t += '\nStock is not reserved yet — confirm in /inventory-admin to deduct it.\n';
  return t;
}

async function sendInquiryMail(env, rec) {
  if (!env.RESEND_API_KEY) throw new Error('no mail sender configured');
  const total = rec.lines.reduce((n, l) => n + l.qty, 0);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'authorization': 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'KMTY Website <website@kmtyorchid.com>',
      to: [env.MAIL_TO || 'office@kmtybio.com'],
      reply_to: rec.buyer.email,
      subject: 'Inventory inquiry: ' + (rec.buyer.company || rec.buyer.email) + ' · ' + total.toLocaleString('en-US') + ' plants · ' + rec.ref,
      text: inquiryText(rec),
      html: inquiryHtml(rec),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) { let t = ''; try { t = await r.text(); } catch (e) {} throw new Error('resend ' + r.status + ': ' + t.slice(0, 140)); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/lead') {
      if (request.method === 'POST') return handleLead(request, env);
      return json({ ok: false, error: 'method' }, 405);
    }
    if (url.pathname.startsWith('/api/inv/')) {
      const r = await handleInventory(request, env, url, sendInquiryMail);
      if (r) return r;
      return json({ ok: false, error: 'not found' }, 404);
    }
    return env.ASSETS.fetch(request);
  },
};
