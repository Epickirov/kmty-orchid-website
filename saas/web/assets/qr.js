/* QR encoder — byte mode, versions 1–10, ECC L/M/Q/H. No dependencies.
   Used by the seller tools (price sheet + shop poster) to embed storefront
   links that buyers scan in WeChat. Matrices verified bit-for-bit against a
   reference implementation across all masks; see saas/test-qr.js.

   QR.encode('https://…', {ecc:'M'}) -> { size, rows: [[0|1, …], …], version } */
var QR = (function () {
  'use strict';

  /* ---- GF(256), primitive polynomial 0x11d ---- */
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  for (var i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  function mul(a, b) { return (a && b) ? EXP[LOG[a] + LOG[b]] : 0; }

  /* generator polynomial for n error-correction codewords, descending order
     with the leading 1 dropped (classic LFSR division form) */
  function rsGen(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var next = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) { next[j] ^= mul(g[j], EXP[i]); next[j + 1] ^= g[j]; }
      g = next;
    }
    return g.reverse().slice(1);
  }
  function rsEcc(data, n) {
    var gen = rsGen(n), res = new Uint8Array(n);
    for (var k = 0; k < data.length; k++) {
      var factor = data[k] ^ res[0];
      res.copyWithin(0, 1); res[n - 1] = 0;
      for (var i = 0; i < n; i++) res[i] ^= mul(gen[i], factor);
    }
    return res;
  }

  /* ---- block structure per version (index = version-1):
         [ecPerBlock, group1Blocks, group1Data, group2Blocks, group2Data] ---- */
  var BLOCKS = {
    L: [[7,1,19,0,0],[10,1,34,0,0],[15,1,55,0,0],[20,1,80,0,0],[26,1,108,0,0],
        [18,2,68,0,0],[20,2,78,0,0],[24,2,97,0,0],[30,2,116,0,0],[18,2,68,2,69]],
    M: [[10,1,16,0,0],[16,1,28,0,0],[26,1,44,0,0],[18,2,32,0,0],[24,2,43,0,0],
        [16,4,27,0,0],[18,4,31,0,0],[22,2,38,2,39],[22,3,36,2,37],[26,4,43,1,44]],
    Q: [[13,1,13,0,0],[22,1,22,0,0],[18,2,17,0,0],[26,2,24,0,0],[18,2,15,2,16],
        [24,4,19,0,0],[18,2,14,4,15],[22,4,18,2,19],[20,4,16,4,17],[24,6,19,2,20]],
    H: [[17,1,9,0,0],[28,1,16,0,0],[22,2,13,0,0],[16,4,9,0,0],[22,2,11,2,12],
        [28,4,15,0,0],[26,4,13,1,14],[26,4,14,2,15],[24,4,12,4,13],[28,6,15,2,16]]
  };
  var ECC_BITS = { L: 1, M: 0, Q: 3, H: 2 };
  var ALIGN = [[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];

  function dataCap(ver, ecc) { var b = BLOCKS[ecc][ver - 1]; return b[1] * b[2] + b[3] * b[4]; }

  /* ---- BCH ---- */
  function bch(data, gen, genBits) {
    var d = data << (genBits - 1);
    for (var i = genBits + 4; i >= genBits; i--) if ((d >>> i) & 1) d ^= gen << (i - genBits + 1);
    return d;
  }
  function formatBits(ecc, mask) {
    var d = (ECC_BITS[ecc] << 3) | mask, rem = d;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >>> 9) & 1) * 0x537);
    return (((d << 10) | rem) ^ 0x5412) >>> 0;
  }
  function versionBits(ver) {
    var rem = ver;
    for (var i = 0; i < 12; i++) rem = (rem << 1) ^ (((rem >>> 11) & 1) * 0x1f25);
    return ((ver << 12) | rem) >>> 0;
  }

  /* ---- masks ---- */
  var MASKS = [
    function (r, c) { return (r + c) % 2 === 0; },
    function (r) { return r % 2 === 0; },
    function (r, c) { return c % 3 === 0; },
    function (r, c) { return (r + c) % 3 === 0; },
    function (r, c) { return ((r / 2 | 0) + (c / 3 | 0)) % 2 === 0; },
    function (r, c) { return (r * c) % 2 + (r * c) % 3 === 0; },
    function (r, c) { return ((r * c) % 2 + (r * c) % 3) % 2 === 0; },
    function (r, c) { return ((r + c) % 2 + (r * c) % 3) % 2 === 0; }
  ];

  function penalty(m, size) {
    var s = 0, dark = 0, i, j, k;
    var at = function (r, c) { return m[r * size + c]; };
    // rule 1 — runs of five or more
    for (var dir = 0; dir < 2; dir++) {
      for (i = 0; i < size; i++) {
        var run = 1, prev = -1;
        for (j = 0; j < size; j++) {
          var v = dir ? at(j, i) : at(i, j);
          if (v === prev) { run++; if (run === 5) s += 3; else if (run > 5) s += 1; }
          else { prev = v; run = 1; }
        }
      }
    }
    // rule 2 — 2×2 blocks of one colour
    for (i = 0; i < size - 1; i++) for (j = 0; j < size - 1; j++) {
      var a = at(i, j);
      if (a === at(i, j + 1) && a === at(i + 1, j) && a === at(i + 1, j + 1)) s += 3;
    }
    // rule 3 — finder-like patterns, either orientation, in rows and columns
    var P1 = [1,0,1,1,1,0,1,0,0,0,0], P2 = [0,0,0,0,1,0,1,1,1,0,1];
    for (dir = 0; dir < 2; dir++) {
      for (i = 0; i < size; i++) for (j = 0; j + 11 <= size; j++) {
        var m1 = true, m2 = true;
        for (k = 0; k < 11; k++) {
          var vv = dir ? at(j + k, i) : at(i, j + k);
          if (vv !== P1[k]) m1 = false;
          if (vv !== P2[k]) m2 = false;
        }
        if (m1) s += 40;
        if (m2) s += 40;
      }
    }
    // rule 4 — global dark ratio
    for (i = 0; i < m.length; i++) if (m[i]) dark++;
    s += Math.floor(Math.abs(dark * 20 - m.length * 10) / m.length) * 10;
    return s;
  }

  function encode(text, opts) {
    opts = opts || {};
    var ecc = opts.ecc || 'M';
    if (!BLOCKS[ecc]) throw new Error('bad ecc level');
    var bytes = new TextEncoder().encode(String(text));

    /* smallest version that fits (byte mode: 8-bit count ≤ v9, 16-bit ≥ v10) */
    var ver = 0;
    for (var v = Math.max(1, opts.minVersion || 1); v <= 10; v++) {
      var need = 4 + (v < 10 ? 8 : 16) + bytes.length * 8;
      if (need <= dataCap(v, ecc) * 8) { ver = v; break; }
    }
    if (!ver) throw new Error('data too long for QR v10 @ ECC ' + ecc);

    /* ---- bit stream ---- */
    var bits = [];
    var push = function (val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(4, 4);
    push(bytes.length, ver < 10 ? 8 : 16);
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);
    var cap = dataCap(ver, ecc) * 8;
    push(0, Math.min(4, cap - bits.length));
    while (bits.length % 8) bits.push(0);
    var pad = [0xEC, 0x11], p = 0;
    while (bits.length < cap) { push(pad[p++ % 2], 8); }

    var codewords = new Uint8Array(cap / 8);
    for (i = 0; i < codewords.length; i++)
      for (var b = 0; b < 8; b++) codewords[i] = (codewords[i] << 1) | bits[i * 8 + b];

    /* ---- split into blocks, add ECC, interleave ---- */
    var spec = BLOCKS[ecc][ver - 1], ecLen = spec[0];
    var dataBlocks = [], eccBlocks = [], off = 0;
    var addBlocks = function (count, len) {
      for (var k = 0; k < count; k++) {
        var blk = codewords.subarray(off, off + len); off += len;
        dataBlocks.push(blk); eccBlocks.push(rsEcc(blk, ecLen));
      }
    };
    addBlocks(spec[1], spec[2]);
    addBlocks(spec[3], spec[4]);

    var out = [];
    var maxData = Math.max(spec[2], spec[4]);
    for (i = 0; i < maxData; i++) for (var d = 0; d < dataBlocks.length; d++)
      if (i < dataBlocks[d].length) out.push(dataBlocks[d][i]);
    for (i = 0; i < ecLen; i++) for (d = 0; d < eccBlocks.length; d++) out.push(eccBlocks[d][i]);

    var stream = [];
    for (i = 0; i < out.length; i++) for (b = 7; b >= 0; b--) stream.push((out[i] >>> b) & 1);

    /* ---- module grid ---- */
    var size = ver * 4 + 17;
    var mods = new Uint8Array(size * size), used = new Uint8Array(size * size);
    var fn = function (cx, cy, val) { mods[cy * size + cx] = val ? 1 : 0; used[cy * size + cx] = 1; };

    var finder = function (cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var xx = cx + dx, yy = cy + dy, dist = Math.max(Math.abs(dx), Math.abs(dy));
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) fn(xx, yy, dist !== 2 && dist !== 4);
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

    for (i = 8; i < size - 8; i++) { fn(6, i, i % 2 === 0); fn(i, 6, i % 2 === 0); }

    var ap = ALIGN[ver - 1];
    for (i = 0; i < ap.length; i++) for (var j = 0; j < ap.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) continue;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++)
        fn(ap[j] + dx, ap[i] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }

    if (ver >= 7) {
      var vb = versionBits(ver);
      for (i = 0; i < 18; i++) {
        var bit = (vb >>> i) & 1, a = size - 11 + i % 3, bb = Math.floor(i / 3);
        fn(a, bb, bit); fn(bb, a, bit);
      }
    }
    // reserve the format-info areas so data placement skips them; index 6 is
    // the timing row/column and is already placed
    for (i = 0; i <= 8; i++) { if (i !== 6) { fn(8, i, 0); fn(i, 8, 0); } }
    for (i = 0; i < 8; i++) { fn(size - 1 - i, 8, 0); fn(8, size - 1 - i, 0); }

    /* ---- data placement (zig-zag, right to left, skipping the timing column) ---- */
    var idx = 0, upward = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (var n = 0; n < size; n++) {
        var row = upward ? size - 1 - n : n;
        for (var c = 0; c < 2; c++) {
          var cc = col - c;
          if (!used[row * size + cc]) {
            mods[row * size + cc] = idx < stream.length ? stream[idx++] : 0;
          }
        }
      }
      upward = !upward;
    }

    /* ---- masking: score all eight, keep the best ---- */
    var best = null, bestScore = Infinity, bestMask = 0;
    for (var mk = 0; mk < 8; mk++) {
      if (opts.mask != null && opts.mask !== mk) continue;
      var cand = mods.slice();
      for (var r = 0; r < size; r++) for (var cl = 0; cl < size; cl++)
        if (!used[r * size + cl] && MASKS[mk](r, cl)) cand[r * size + cl] ^= 1;
      var fb = formatBits(ecc, mk);
      var setF = function (cx, cy, val) { cand[cy * size + cx] = val ? 1 : 0; };
      for (i = 0; i <= 5; i++) setF(8, i, (fb >>> i) & 1);
      setF(8, 7, (fb >>> 6) & 1); setF(8, 8, (fb >>> 7) & 1); setF(7, 8, (fb >>> 8) & 1);
      for (i = 9; i < 15; i++) setF(14 - i, 8, (fb >>> i) & 1);
      for (i = 0; i < 8; i++) setF(size - 1 - i, 8, (fb >>> i) & 1);
      for (i = 8; i < 15; i++) setF(8, size - 15 + i, (fb >>> i) & 1);
      setF(8, size - 8, 1);
      var sc = penalty(cand, size);
      if (sc < bestScore) { bestScore = sc; best = cand; bestMask = mk; }
    }

    var rows = [];
    for (r = 0; r < size; r++) rows.push(Array.from(best.subarray(r * size, r * size + size)));
    return { size: size, rows: rows, version: ver, ecc: ecc, mask: bestMask };
  }

  /* Draws onto a 2D canvas context. `box` = module size in px, `pad` = quiet
     zone in modules (4 is the spec minimum and what scanners expect). */
  function draw(ctx, text, x, y, box, opts) {
    opts = opts || {};
    var q = opts.pad == null ? 4 : opts.pad;
    var m = encode(text, opts);
    var total = (m.size + q * 2) * box;
    ctx.fillStyle = opts.bg || '#fff';
    ctx.fillRect(x, y, total, total);
    ctx.fillStyle = opts.fg || '#000';
    for (var r = 0; r < m.size; r++) for (var c = 0; c < m.size; c++)
      if (m.rows[r][c]) ctx.fillRect(x + (c + q) * box, y + (r + q) * box, box, box);
    return total;
  }

  return { encode: encode, draw: draw };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = QR;
