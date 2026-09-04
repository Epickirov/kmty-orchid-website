#!/usr/bin/env node
/* Regenerates kiosk/engine.js by lifting the swirl engine out of
   constellation.html verbatim, so the exhibition screens draw exactly what the
   real product draws. Re-run this after any change to the engine upstream:
     node kiosk/build-engine.js
   Never hand-edit kiosk/engine.js. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'constellation.html'), 'utf8').split('\n');

const palStart = src.findIndex((l) => l.trim().startsWith('var PALETTE'));
let palEnd = palStart;
while (!src[palEnd].trimEnd().endsWith('];')) palEnd++;
const palette = src.slice(palStart, palEnd + 1).join('\n');

const engStart = src.findIndex((l) => l.includes('engine (same maths'));
let engEnd = src.findIndex((l, i) => i > engStart && l.trim() === 'transRAF = requestAnimationFrame(step);') + 1;
let body = src.slice(engStart, engEnd + 1).join('\n');

// The only DOM coupling in the engine is the mix number readout; hand it to a callback.
const before = body;
body = body.replace(
  /document\.getElementById\('mixno'\)\.textContent\s*=\s*([^;]+);/,
  'onNumber($1);'
);
if (body === before) throw new Error('mixno hook not found — engine changed upstream, check the extraction');

const out = `/* GENERATED — do not edit. Source: constellation.html (engine block).
   Rebuild: node kiosk/build-engine.js
   The maths below is lifted verbatim from the production configurator so the
   98" display and the phone render byte-identical blooms from the same state. */
'use strict';
var KMTY_PALETTE = (function () {
  ${palette.trim()}
  return PALETTE.map(function (p) { return { en: p[0], zh: p[1], hex: p[2], stock: !!p[3] }; });
})();

function KMTYEngine(canvas, opts) {
  opts = opts || {};
  var SIZE = 560, FIELD = 320;
  var mctx = canvas.getContext('2d');
  var COLORS = opts.colors || KMTY_PALETTE;
  var sel = [], weights = {}, seed = 1;
  var reduceMotion = { matches: !!opts.reduceMotion };
  var onNumber = opts.onNumber || function () {};

${body}

  var api = {
    SIZE: SIZE,
    colors: function () { return COLORS; },
    setColors: function (c) { if (c && c.length) COLORS = c; },
    state: function () { return { seed: seed, sel: sel.slice(), weights: JSON.parse(JSON.stringify(weights)) }; },
    /* The opening mix, mirroring resetSelection() upstream: first three colours
       in stock, weighted 40/25/35. The seed is fixed rather than random so an
       untouched display and an untouched phone show the same bloom before any
       sync has happened. */
    reset: function () {
      sel = []; weights = {};
      COLORS.forEach(function (c, k) { if (c.stock && sel.length < 3) sel.push(k); });
      var defW = [40, 25, 35];
      sel.forEach(function (k, i) { weights[k] = defW[i] || 30; });
      seed = 20260101;
    },
    /* Adopt a state wholesale. animate:true runs the fluid re-swirl between the
       old and new mix; the TV uses it so a visitor's change arrives as motion
       rather than a jump cut. */
    apply: function (st, animate) {
      var changed = st.seed !== seed;
      seed = st.seed >>> 0;
      sel = (st.sel || []).slice(0, 3);
      weights = {};
      sel.forEach(function (k) { weights[k] = Math.max(5, Math.min(90, (st.weights || {})[k] || 30)); });
      if (animate && changed && api.ready()) swirlTransition(); else render();
    },
    reswirl: function () { seed = (Math.random() * 1e9) >>> 0; if (api.ready()) swirlTransition(); else render(); },
    render: render,
    ready: function () { return !!(bloom.complete && bloom.naturalWidth); },
    onReady: function (cb) { if (api.ready()) cb(); else bloom.addEventListener('load', cb, { once: true }); },
    /* #m=seed.k-w.k-w — the same restore format the product already uses, so a
       mix made at the show reopens correctly in the real configurator. */
    hash: function () {
      return '#m=' + seed + sel.map(function (k) { return '.' + k + '-' + Math.round(weights[k] || 30); }).join('');
    },
    parseHash: function (h) {
      var m = String(h || '').match(/#m=(\\d+)((?:\\.\\d+-\\d+){1,3})/);
      if (!m) return null;
      var s = [], w = {};
      m[2].slice(1).split('.').forEach(function (p) {
        var kv = p.split('-'), k = +kv[0];
        if (COLORS[k] && s.length < 3 && s.indexOf(k) < 0) { s.push(k); w[k] = Math.max(5, Math.min(90, +kv[1] || 30)); }
      });
      return s.length ? { seed: (+m[1]) >>> 0, sel: s, weights: w } : null;
    }
  };
  api.reset();
  return api;
}
`;

fs.mkdirSync(path.join(ROOT, 'kiosk'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'kiosk', 'engine.js'), out);
console.log('kiosk/engine.js written — %d KB (palette %d colours, engine lines %d-%d)',
  Math.round(out.length / 1024), (palette.match(/\[/g) || []).length - 1, engStart + 1, engEnd + 1);
