#!/usr/bin/env node
/* Does the desktop navigation still work?   node tools/check_desktop_nav.mjs [url]
   (needs Playwright: `npm i -g playwright`, then it finds the browser itself.)

   The URL is a built page served over http — e.g. `python build_deploy.py dist/kmty-site`
   then `python -m http.server 8000 -d dist/kmty-site`, and pass http://127.0.0.1:8000/index.html.
   It does not need to be the live site and it changes nothing.

   What it checks, and why each is here:

   FIT     The top bar holds five languages whose words differ by half again in length, so it
           measures itself and picks the roomiest layout that fits (see fitNav in the page). This
           walks every language across every desktop width and fails on wrapped text, overflow,
           overlap, or less than 12px to spare. It runs with a CLASSIC SCROLLBAR, because that is
           what a Windows or Linux desktop browser has and it costs ~15px; headless Chromium hides
           it by default, which flatters every number.
   RAIL    The side rail's labels are in every language, switch with the language, and the lit one
           is the section you are reading. "How we grow" is 3.5 windows tall and once could not
           light at all.
   CLICKS  The rail's hidden labels must not swallow clicks meant for the page; its visible ones
           must pass them on to the link.
   PHONE   Below 901px none of this applies: the link row, the rail and the fitter's settings are
           all absent, and the burger is there.

   Exit code is the number of failures. */
import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://127.0.0.1:8000/index.html';
const LANGS = ['en', 'zh', 'ru', 'vi', 'ja'];
const WIDTHS = [901, 960, 1024, 1081, 1100, 1160, 1200, 1280, 1366, 1440, 1536, 1920];
const MIN_SPARE = 12;

const RAIL = {   // the six stops, in order, per language — what a visitor should read
  en: ['Our story', 'How we grow', 'Products', 'Constellation Orchid', 'How it ships', 'Contact us'],
  zh: ['关于我们', '如何种植', '产品系列', '星空', '如何发货', '联系我们'],
  ru: ['Наша история', 'Как мы выращиваем', 'Продукция', 'Орхидея «Созвездие»', 'Как мы отгружаем', 'Контакты'],
  vi: ['Câu chuyện', 'Cách chúng tôi trồng', 'Sản phẩm', 'Lan Chòm Sao', 'Cách giao hàng', 'Liên hệ'],
  ja: ['私たちについて', '栽培について', '商品', '星空シリーズの蘭', '出荷について', 'お問い合わせ'],
};
const STOP_IDS = ['story', 'grow', 'products', 'art', 'shipping', 'contact'];

let failures = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '   ' + detail : ''));
  if (!cond) failures++;
};

// a classic scrollbar, as on a Windows/Linux desktop; headless Chromium would otherwise hide it
const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
const open = async (lang, w = 1440, h = 900, extra = {}) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...extra });
  await ctx.addInitScript(l => { try { localStorage.setItem('kmty-lang', l); } catch (e) {} }, lang);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  return { ctx, page, errors };
};

/* the page scrolls smoothly, so "scrolled" is not "arrived": wait until it has stopped, then let transitions finish */
const settle = async page => {
  let last = -1, same = 0;
  while (same < 3) {
    const y = await page.evaluate(() => Math.round(scrollY));
    same = y === last ? same + 1 : 0; last = y;
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(650);
};
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;     // ONLY=rail,clicks runs just those sections
const want = name => !only || only.has(name);

/* ------------------------------------------------------------------ FIT */
if (want('fit')) {
console.log('\nFIT — one row, every language, every width (spare px, classic scrollbar)');
console.log('lang  ' + WIDTHS.map(w => String(w).padStart(8)).join(''));
const fitLines = [];
for (const lang of LANGS) {
  const { ctx, page, errors } = await open(lang);
  const cells = [];
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const nav = document.querySelector('[data-nav]');
      const cs = getComputedStyle(nav);
      const kids = [...nav.children].filter(c => c.getBoundingClientRect().width > 0);
      const rects = kids.map(c => c.getBoundingClientRect());
      const inner = nav.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const spare = inner - rects.reduce((s, r) => s + r.width, 0) - (parseFloat(cs.columnGap) || 0) * (kids.length - 1);
      let minGap = 1e9;
      for (let i = 1; i < rects.length; i++) minGap = Math.min(minGap, rects[i].left - rects[i - 1].right);
      const links = [...nav.querySelectorAll('[data-navlink]')].filter(e => e.getBoundingClientRect().width > 0);
      const wrapped = [...nav.querySelectorAll('[data-navlink],[data-navcta],[data-navinv],[data-langsw] button')]
        .filter(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 60).length;
      return { spare: Math.round(spare * 10) / 10, minGap: Math.round(minGap), wrapped,
               overflow: nav.scrollWidth > nav.clientWidth + 1, links: links.length,
               fs: links[0] ? parseFloat(getComputedStyle(links[0]).fontSize) : 0, level: nav.getAttribute('data-fit') };
    });
    const bad = r.wrapped || r.overflow || r.spare < MIN_SPARE || r.minGap < 8 || r.links !== 5;
    cells.push((bad ? '✗' : ' ') + String(r.spare).padStart(5) + '/' + String(r.fs).padStart(2));
    fitLines.push({ lang, w, r, bad });
  }
  console.log(lang.padEnd(6) + cells.join('  ').replace(/^/, ''));
  ok(`[${lang}] no page errors while resizing`, errors.length === 0, errors[0]);
  await ctx.close();
}
console.log('      (each cell: spare px / link font px)');
const badFits = fitLines.filter(x => x.bad);
ok(`every language fits at every width (${LANGS.length * WIDTHS.length} combinations)`, badFits.length === 0,
   badFits.slice(0, 3).map(x => `${x.lang}@${x.w}: spare ${x.r.spare}, wrapped ${x.r.wrapped}, overflow ${x.r.overflow}`).join('; '));
const typical = fitLines.filter(x => x.w >= 1366);
ok('at 1366px and wider every link is 15px or more (was 12px)', typical.every(x => x.r.fs >= 15),
   [...new Set(typical.map(x => x.lang + ':' + x.r.fs))].join(' '));
ok('all five links present at every width', fitLines.every(x => x.r.links === 5));
}

/* ------------------------------------------------------------------ RAIL: language */
if (want('labels')) {
console.log('\nRAIL — labels');
for (const lang of LANGS) {
  const { ctx, page } = await open(lang);
  const got = await page.evaluate(() => [...document.querySelectorAll('[data-railtx]')].map(e => e.textContent.trim()));
  ok(`[${lang}] six labels, in this language, on load`, JSON.stringify(got) === JSON.stringify(RAIL[lang]), got.join(' | '));
  await ctx.close();
}
{
  const { ctx, page } = await open('en');
  let allRight = true, last = '';
  for (const lang of ['zh', 'ru', 'vi', 'ja', 'en', 'ja', 'zh']) {
    await page.click(`[data-langsw] [data-lang="${lang}"]`);
    await page.waitForTimeout(450);
    const got = await page.evaluate(() => [...document.querySelectorAll('[data-railtx]')].map(e => e.textContent.trim()));
    if (JSON.stringify(got) !== JSON.stringify(RAIL[lang])) { allRight = false; last = lang + ': ' + got.join('|'); }
  }
  ok('switching language at runtime relabels every stop, both ways', allRight, last);
  await ctx.close();
}
{
  // a visitor in China on a slow phone-class CPU: the way a first visit really looks. Rail and top bar must agree.
  const { ctx, page } = await open('en', 1440, 900, { locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(6000);
  const s = await page.evaluate(() => ({
    nav: document.querySelector('[data-navlink]').textContent, rail: document.querySelector('[data-railtx]').textContent }));
  const han = t => /[一-鿿]/.test(t);
  ok('under a 6x-throttled CPU the rail and the top bar are in the same language', han(s.nav) === han(s.rail), `${s.nav} / ${s.rail}`);
  await ctx.close();
}
}

/* ------------------------------------------------------------------ RAIL: which section is lit */
if (want('lit')) {
console.log('\nRAIL — the lit stop follows where you are reading');
for (const [w, h] of [[1440, 900], [1366, 768], [1920, 1080]]) {
  const { ctx, page } = await open('en', w, h);
  await page.mouse.move(w / 2, h / 2);
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  let steps = 0, wrong = [], lit = new Set();
  for (let y = 0; y < total - h; y += 350) {
    await page.mouse.wheel(0, 350);
    await page.waitForTimeout(220);
    const s = await page.evaluate(ids => {
      const line = innerHeight * 0.4;
      let at = '';
      ids.forEach(id => { const e = document.getElementById(id); if (e && e.getBoundingClientRect().top <= line) at = id; });
      const on = [...document.querySelectorAll('[data-railitem][data-on]')].map(a => a.getAttribute('data-target'));
      return { at, on, y: Math.round(scrollY) };
    }, STOP_IDS);
    steps++;
    if (s.at) lit.add(s.at);
    const right = s.at ? (s.on.length === 1 && s.on[0] === s.at) : s.on.length === 0;
    if (!right) wrong.push(`y=${s.y} reading ${s.at || '—'} lit ${s.on.join(',') || '—'}`);
  }
  ok(`[${w}x${h}] the lit stop is the section being read at every one of ${steps} scroll stops`, wrong.length === 0, wrong.slice(0, 2).join('; '));
  ok(`[${w}x${h}] every one of the six stops lights at some point, "How we grow" included`, STOP_IDS.every(i => lit.has(i)),
     'missing: ' + STOP_IDS.filter(i => !lit.has(i)).join(','));
  await ctx.close();
}
}

/* ------------------------------------------------------------------ CLICKS and hover */
if (want('clicks')) {
console.log('\nRAIL — clicks and hover');
{
  const { ctx, page } = await open('en', 1440, 900);
  await page.evaluate(() => document.getElementById('grow').scrollIntoView({ block: 'start' }));
  await settle(page);
  await page.mouse.move(300, 450);                       // somewhere that is not the rail
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const dots = [...document.querySelectorAll('[data-railitem]')];
    const hiddenProbe = dots.filter(a => !a.hasAttribute('data-on')).map(a => {
      const d = a.getBoundingClientRect();
      // a point where this stop's label WOULD be if it were showing: 90px left of its dot
      const el = document.elementFromPoint(d.left - 90, d.top + d.height / 2);
      return !!(el && el.closest('[data-rail]'));
    });
    const on = document.querySelector('[data-railitem][data-on] [data-railtx]');
    const rr = on.getBoundingClientRect();
    const hit = document.elementFromPoint(rr.left + rr.width / 2, rr.top + rr.height / 2);
    return { hiddenBlocks: hiddenProbe.filter(Boolean).length, visibleIsLink: !!(hit && hit.closest('[data-railitem]')),
             visibleOpacity: +getComputedStyle(on).opacity };
  });
  ok('hidden labels do not sit over the page eating clicks', r.hiddenBlocks === 0, r.hiddenBlocks + ' of 5 intercept');
  // a hidden label must still be in the accessibility tree, or a screen reader meets five nameless links
  const names = await page.evaluate(() => [...document.querySelectorAll('[data-railitem]')].map(a => {
    const l = a.querySelector('[data-railtx]'), cs = getComputedStyle(l);
    return { stop: a.dataset.target, exposed: cs.display !== 'none' && cs.visibility !== 'hidden' && l.textContent.trim().length > 0 };
  }));
  ok('every stop keeps an accessible name while its label is hidden', names.every(n => n.exposed),
     names.filter(n => !n.exposed).map(n => n.stop).join(','));
  ok('the visible label passes a click to its link', r.visibleIsLink && r.visibleOpacity > 0.9);
  const dot = await page.$('[data-railitem][data-target="products"]');
  const before = await page.evaluate(() => Math.round(scrollY));
  await dot.click();
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({ y: Math.round(scrollY), top: Math.round(document.getElementById('products').getBoundingClientRect().top) }));
  ok('clicking a dot scrolls to its section', after.y > before && Math.abs(after.top) < 140, `now ${after.top}px from the top`);

  await page.mouse.move(1440 - 40, 450);                 // onto the rail
  await page.waitForTimeout(500);
  const allShown = await page.evaluate(() => [...document.querySelectorAll('[data-railtx]')].every(e => +getComputedStyle(e).opacity > 0.9));
  ok('hovering the rail shows every label, so the dots are not a guessing game', allShown);
  await page.mouse.move(300, 450);
  await page.waitForTimeout(500);
  const oneShown = await page.evaluate(() => [...document.querySelectorAll('[data-railtx]')].filter(e => +getComputedStyle(e).opacity > 0.9).length);
  ok('moving away leaves only the current one', oneShown === 1, oneShown + ' shown');

  // Contact us in the top bar goes to the contact section
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.click('[data-navcontact]');
  await page.waitForTimeout(1500);
  const c = await page.evaluate(() => Math.round(document.getElementById('contact').getBoundingClientRect().top));
  ok('"Contact us" in the top bar scrolls to the contact section', Math.abs(c) < 140, `${c}px from the top`);
  await ctx.close();
}
}

/* ------------------------------------------------------------------ the dot must be visible on any backdrop */
if (want('legible')) {
console.log('\nRAIL — legibility on light and dark sections');
{
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const mix = (top, a, bot) => top.map((v, i) => v * a + bot[i] * (1 - a));   // used for the label's translucent surface
  const { ctx, page } = await open('en', 1440, 900);
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  let worstRing = 99, worstLabel = 99, darkSeen = 0, lightSeen = 0, worstAt = '';
  for (let y = 0; y < total - 900; y += 600) {
    await page.evaluate(v => scrollTo(0, v), y);
    await page.waitForTimeout(450);
    const box = await page.evaluate(() => {
      const d = document.querySelector('[data-railitem] [data-raildot]').getBoundingClientRect();
      document.querySelector('[data-rail]').style.visibility = 'hidden';
      return { x: Math.round(d.left + d.width / 2) - 6, y: Math.round(d.top + d.height / 2) - 6 };
    });
    const png = await page.screenshot({ clip: { x: box.x, y: box.y, width: 12, height: 12 } });
    await page.evaluate(() => { document.querySelector('[data-rail]').style.visibility = ''; });
    const px = await page.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = c.height = 12;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, 12, 12).data; let r = 0, gr = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gr += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4; return [r / n, gr / n, b / n];
    }, png.toString('base64'));
    // two opaque rings, cream inside and ink outside: the dot reads if EITHER stands off the backdrop
    const best = Math.max(contrast([243, 238, 228], px), contrast([26, 30, 23], px));
    if (best < worstRing) { worstRing = best; worstAt = `y=${y}, backdrop rgb(${px.map(Math.round)})`; }
    if (lum(px) < .15) darkSeen++; else lightSeen++;
  }
  const label = contrast([26, 30, 23], mix([243, 238, 228], .96, [0, 0, 0]));
  const labelW = contrast([26, 30, 23], mix([243, 238, 228], .96, [255, 255, 255]));
  worstLabel = Math.min(label, labelW);
  ok(`the dot stands off the page by 3:1 or more on every section (${darkSeen} dark, ${lightSeen} light sampled)`, worstRing >= 3, `worst ${worstRing.toFixed(1)}:1 at ${worstAt}`);
  ok('the label is 4.5:1 or better on the worst possible backdrop, black or white', worstLabel >= 4.5, `${worstLabel.toFixed(1)}:1`);
  await ctx.close();
}
}

/* ------------------------------------------------------------------ PHONE: untouched */
if (want('phone')) {
console.log('\nPHONE — below 901px none of this applies');
for (const w of [390, 768, 900]) {
  const { ctx, page } = await open('en', w, 900);
  const r = await page.evaluate(() => {
    const nav = document.querySelector('[data-nav]');
    const shown = s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; };
    return { links: shown('[data-desktopnav]'), rail: shown('[data-rail]'), burger: shown('[data-burger]'),
             fitAttrs: ['data-fit', 'data-nonum', 'data-noghost', 'data-fitting'].filter(a => nav.hasAttribute(a)),
             fitVars: ['--nfs', '--nlg', '--ngap', '--npad', '--npill'].filter(v => nav.style.getPropertyValue(v)),
             hScroll: document.documentElement.scrollWidth > innerWidth };
  });
  ok(`[${w}px] no link row, no rail, burger present, no fitter state left behind`,
     !r.links && !r.rail && r.burger && !r.fitAttrs.length && !r.fitVars.length && !r.hScroll, JSON.stringify(r));
  await ctx.close();
}
// going from a desktop width down to a phone must clean up after the fitter
{
  const { ctx, page } = await open('ru', 1280, 900);
  await page.setViewportSize({ width: 600, height: 900 });
  await page.waitForTimeout(500);
  const left = await page.evaluate(() => { const n = document.querySelector('[data-nav]');
    return ['data-fit', 'data-nonum', 'data-noghost'].filter(a => n.hasAttribute(a)).concat(['--nfs', '--npad'].filter(v => n.style.getPropertyValue(v))); });
  ok('shrinking a desktop window to phone width leaves no fitter state behind', left.length === 0, left.join(','));
  await ctx.close();
}
}

await browser.close();
console.log(`\n${failures ? failures + ' FAILURE(S)' : 'all checks passed'}`);
process.exit(failures);
