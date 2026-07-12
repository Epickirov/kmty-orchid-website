// kmty-site advanced-mode worker.
// Static passthrough for the whole site (never rewrites .html — that pattern
// caused a redirect loop once; everything except /api/* goes straight to
// env.ASSETS), plus POST /api/lead: the catalog-request form endpoint.
//
// /api/lead writes every lead into KV first (never lose one), then emails it to
// office@kmtybio.com. Primary sender is the Resend HTTP API — shared Worker
// egress IPs get tarpitted by Netease's SMTP, so raw SMTP (below) is kept only
// as a dormant fallback. Config on the Pages project:
//   RESEND_API_KEY (secret)  Resend sending key            — primary path
//   MAIL_FROM      (plain)   KMTY Website <website@kmtyorchid.com>
//   MAIL_TO        (plain)   office@kmtybio.com
//   LEADS          (KV)      lead ledger + soft per-IP rate limit
// Dormant SMTP fallback (only if RESEND_API_KEY unset and SMTP_ENABLED='1'):
//   SMTP_HOST (plain)  smtp.qiye.163.com
//   SMTP_USER (plain)  office@kmtybio.com     — auth user AND From AND To
//   SMTP_PASS (secret) Netease client authorization code (授权码)
import { connect } from 'cloudflare:sockets';

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
      'Buyer email:  ' + lead.email + '\r\n' +
      'Language:     ' + lead.lang + '\r\n' +
      'Page:         ' + lead.page + '\r\n' +
      'Time (UTC):   ' + new Date().toISOString() + '\r\n' +
      'Visitor IP:   ' + lead.ip + '\r\n\r\n' +
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
    'Wholesale catalog request from the website.\n\n' +
    'Buyer email:  ' + lead.email + '\n' +
    'Language:     ' + lead.lang + '\n' +
    'Page:         ' + lead.page + '\n' +
    'Time (UTC):   ' + new Date().toISOString() + '\n' +
    'Visitor IP:   ' + lead.ip + '\n\n' +
    'Reply to this mail to answer the buyer directly (Reply-To is set).\n';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'authorization': 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ from: from, to: [to], reply_to: lead.email, subject: 'Catalog request - ' + lead.email, text: text }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) { let t = ''; try { t = await r.text(); } catch (e) {} throw new Error('resend ' + r.status + ': ' + t.slice(0, 140)); }
}

/* ---------- /api/lead ---------- */
const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,24}$/;

async function handleLead(request, env) {
  let d; try { d = await request.json(); } catch (e) { return json({ ok: false, error: 'bad json' }, 400); }
  if (d && typeof d.hp === 'string' && d.hp !== '') return json({ ok: true });   // honeypot: swallow silently
  const email = String((d && d.email) || '').trim();
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: 'invalid email' }, 400);
  const lang = String((d && d.lang) || 'en').toLowerCase().replace(/[^a-z]/g, '').slice(0, 5) || 'en';
  const page = String((d && d.page) || '').slice(0, 200).replace(/[\r\n<>]/g, '');
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

  const lead = { email: email, lang: lang, page: page, ip: ip, ts: Date.now() };
  // ledger first (never lose a lead even if SMTP hiccups)
  if (env.LEADS) {
    try {
      await env.LEADS.put('lead:' + lead.ts + '-' + Math.floor(Math.random() * 1e6).toString(36),
        JSON.stringify(lead), { metadata: { email: email, lang: lang, ts: lead.ts } });
    } catch (e) {}
  }
  try {
    if (env.RESEND_API_KEY) await sendViaResend(env, lead);
    else if (env.SMTP_ENABLED === '1') await sendLeadMail(env, lead);
    else return json({ ok: false, error: 'sender disabled (lead recorded)' }, 502);
  } catch (e) { return json({ ok: false, error: 'mail send failed: ' + String(e && e.message || e).slice(0, 120) }, 502); }
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/lead') {
      if (request.method === 'POST') return handleLead(request, env);
      return json({ ok: false, error: 'method' }, 405);
    }
    return env.ASSETS.fetch(request);
  },
};
