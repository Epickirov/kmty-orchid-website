#!/usr/bin/env node
/* Regression test for web/assets/qr.js.
   The golden hashes below were produced from matrices verified bit-for-bit
   against a reference QR implementation (python `qrcode`) across versions
   1–10, ECC L/M/Q/H and all eight masks — 234 matrices, zero mismatches.
   They pin that behaviour without adding a dependency.
     node saas/test-qr.js  */
'use strict';
const QR = require('./web/assets/qr.js');
const crypto = require('node:crypto');

const CN = '云南斗南 蝴蝶兰批发 · 兰园';
const LONG = 'x'.repeat(200);
const SHOP = 'https://kmtyorchid.com/s/lanyuan';
const DEEP = 'https://kmtyorchid.com/s/dounan?p=p_112233&ref=poster';

// [text, ecc, mask (null = auto), version, size, sha256-16 of the module grid]
const GOLDEN = [
  [SHOP, 'M', null, 3, 29, '024501e216ae33e7'],
  [SHOP, 'M', 0, 3, 29, '569f96e61e4d9101'],
  [SHOP, 'M', 3, 3, 29, '68b9101821508a08'],
  [SHOP, 'M', 7, 3, 29, 'b505aaf1af2bf29b'],
  ['a', 'L', null, 1, 21, '2a29499fa66525ef'],
  ['a', 'L', 0, 1, 21, 'c8b94007197ad57d'],
  ['a', 'L', 7, 1, 21, '94b395feca9defed'],
  [CN, 'Q', null, 4, 33, 'b2ad4ceae6ded849'],
  [CN, 'Q', 3, 4, 33, '9e08ae893fc38c51'],
  [CN, 'Q', 7, 4, 33, '94f2a9e9929305f9'],
  [LONG, 'L', null, 9, 53, 'cfe4fcc3cbfb75ba'],
  [LONG, 'L', 3, 9, 53, '69be927e22918f6f'],
  [LONG, 'L', 7, 9, 53, 'ae9a3e44ba7e5ed4'],
  [DEEP, 'H', null, 6, 41, '225355498e7b8400'],
  [DEEP, 'H', 0, 6, 41, 'f74748f6c51de51b'],
  [DEEP, 'H', 7, 6, 41, '3ea03c7b05aee1fe']
];

let fail = 0;
const hash = (m) => crypto.createHash('sha256').update(m.rows.map((r) => r.join('')).join('')).digest('hex').slice(0, 16);

for (const [text, ecc, mask, ver, size, want] of GOLDEN) {
  const m = QR.encode(text, mask === null ? { ecc } : { ecc, mask });
  const got = hash(m);
  const ok = got === want && m.version === ver && m.size === size;
  if (!ok) {
    fail++;
    console.log(`FAIL ecc=${ecc} mask=${mask} — v${m.version}/${m.size} ${got} (want v${ver}/${size} ${want})`);
  }
}

// structural invariants that hold for every code
const m = QR.encode(SHOP, { ecc: 'M' });
const at = (r, c) => m.rows[r][c];
const check = (name, cond) => { if (!cond) { fail++; console.log('FAIL ' + name); } };
check('finder top-left', at(0, 0) && at(0, 6) && !at(1, 1) && at(2, 2) && !at(7, 7));
check('finder top-right', at(0, m.size - 1) && at(6, m.size - 7));
check('finder bottom-left', at(m.size - 1, 0) && at(m.size - 7, 6));
check('timing row', [8, 10, 12].every((i) => at(6, i) === (i % 2 === 0 ? 1 : 0)));
check('timing col', [8, 10, 12].every((i) => at(i, 6) === (i % 2 === 0 ? 1 : 0)));
check('dark module', at(m.size - 8, 8) === 1);
check('version scales with payload', QR.encode('x'.repeat(120), { ecc: 'M' }).version > m.version);
let threw = false;
try { QR.encode('x'.repeat(400), { ecc: 'H' }); } catch (e) { threw = true; }
check('rejects oversized payload', threw);

console.log(fail ? `qr: ${fail} failure(s)` : `qr: ${GOLDEN.length} golden matrices + 8 invariants OK`);
process.exit(fail ? 1 : 0);
