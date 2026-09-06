#!/usr/bin/env node
/* Exhibition kiosk sync server. Zero dependencies, one file, runs anywhere
   Node does — a laptop at the booth, or the Aliyun box later.
     node kiosk/server.js            # port 8080
     PORT=9000 node kiosk/server.js
   It prints every LAN address it is reachable on, so you can point the display
   device at one and hand the other to visitors.

   Transport is Server-Sent Events, not WebSockets: one-way server→display is
   all the TV needs, it survives proxies that mangle upgrades, and it
   reconnects on its own if the hotspot blips — which matters more at a trade
   show than raw speed. Control phones POST; the display listens. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PORT = +process.env.PORT || 8080;
const DIR = __dirname;

/* Current mix, plus every connected display. Deliberately in memory: a show
   runs for a day and a restart should hand back a clean stand. */
let state = null;
let lastChange = Date.now();
const clients = new Set();

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json',
};

function send(res, code, body, type, extra) {
  res.writeHead(code, Object.assign({
    'content-type': type || 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
  }, extra || {}));
  res.end(body);
}

function serveFile(res, file) {
  const p = path.join(DIR, file);
  if (!p.startsWith(DIR) || !fs.existsSync(p)) return send(res, 404, 'not found');
  const body = fs.readFileSync(p);
  send(res, 200, body, TYPES[path.extname(p)] || 'application/octet-stream');
}

function broadcast() {
  const payload = 'data: ' + JSON.stringify({ state, ts: lastChange }) + '\n\n';
  for (const c of clients) { try { c.write(payload); } catch (e) { clients.delete(c); } }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p === '/' || p === '/tv') return serveFile(res, 'tv.html');
  if (p === '/c' || p === '/control') return serveFile(res, 'control.html');
  if (p === '/engine.js' || p === '/qr.js' || p === '/kiosk.css') return serveFile(res, p.slice(1));

  if (p === '/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',           // stop nginx buffering the stream
    });
    res.write('retry: 2000\n\n');           // reconnect fast if the hotspot blips
    if (state) res.write('data: ' + JSON.stringify({ state, ts: lastChange }) + '\n\n');
    clients.add(res);
    // A comment line every 20s keeps mobile carriers and proxies from reaping
    // an idle connection, which is how these demos silently die.
    const ka = setInterval(() => { try { res.write(': ka\n\n'); } catch (e) {} }, 20000);
    req.on('close', () => { clearInterval(ka); clients.delete(res); });
    return;
  }

  if (p === '/state' && req.method === 'POST') {
    let raw = '';
    req.on('data', (d) => { raw += d; if (raw.length > 4096) req.destroy(); });
    req.on('end', () => {
      try {
        const st = JSON.parse(raw);
        if (!st || !Array.isArray(st.sel) || !st.sel.length) return send(res, 400, '{"error":"bad state"}', TYPES['.json']);
        state = { seed: st.seed >>> 0, sel: st.sel.slice(0, 3), weights: st.weights || {} };
        lastChange = Date.now();
        broadcast();
        send(res, 200, '{"ok":true}', TYPES['.json']);
      } catch (e) { send(res, 400, '{"error":"bad json"}', TYPES['.json']); }
    });
    return;
  }

  if (p === '/state') return send(res, 200, JSON.stringify({ state, ts: lastChange }), TYPES['.json']);
  if (p === '/health') return send(res, 200, JSON.stringify({ ok: true, displays: clients.size }), TYPES['.json']);

  send(res, 404, 'not found');
});

server.listen(PORT, () => {
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === 'IPv4' && !n.internal) addrs.push(n.address);
    }
  }
  console.log('\n  KMTY kiosk running\n');
  if (!addrs.length) console.log('  no LAN address found — is wifi/hotspot connected?');
  addrs.forEach((a) => {
    console.log('  display (TV) :  http://' + a + ':' + PORT + '/tv');
    console.log('  control (phone):  http://' + a + ':' + PORT + '/c');
  });
  console.log('  local only    :  http://127.0.0.1:' + PORT + '/tv\n');
  console.log('  The TV page shows a QR of its own control URL — visitors scan that.\n');
});
