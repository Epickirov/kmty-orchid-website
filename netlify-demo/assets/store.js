/* Shared storefront/marketplace pieces on top of ui.js.
   rfqSheet(slug, sellerName): 批量询价/求购 — the B2B "request for quote"
   flow. Structured requirement rows post as one kind:'rfq' inquiry to the
   given shop ('kmty' = the platform, routed by KMTY as broker). */
'use strict';

const COLOR_DOTS = {
  '白': '#F3EEE4', '粉': '#E7B7CF', '玫红': '#C2447E', '橙黄': '#E0A34C',
  '黄': '#E4C95B', '蓝紫': '#7A6FD0', '紫红': '#B04E8E',
  '复色': 'linear-gradient(135deg,#E7B7CF 50%,#E4C95B 50%)',
};
function colorDot(name, size) {
  const v = COLOR_DOTS[name];
  if (!v) return null;
  return h('i', { title: name, style: 'display:inline-block;width:' + (size || 12) + 'px;height:' + (size || 12) + 'px;border-radius:50%;' +
    (v.startsWith('linear') ? 'background:' + v : 'background:' + v) + ';border:1px solid rgba(255,255,255,.25);vertical-align:-1px' });
}

function rfqSheet(slug, sellerName) {
  const rows = [{ what: '', spec: '', qty: '' }];
  const rowsBox = h('div');
  function draw() {
    rowsBox.innerHTML = '';
    rows.forEach((r, i) => {
      const what = h('input', { value: r.what, placeholder: '品种/颜色，如 大辣椒 玫红', style: 'flex:2;min-width:0' });
      const spec = h('input', { value: r.spec, placeholder: '规格，如 3.5寸 双梗', style: 'flex:1.4;min-width:0' });
      const qty = h('input', { value: r.qty, type: 'number', inputmode: 'numeric', placeholder: '数量', style: 'flex:1;min-width:64px' });
      what.oninput = () => { r.what = what.value; };
      spec.oninput = () => { r.spec = spec.value; };
      qty.oninput = () => { r.qty = qty.value; };
      rowsBox.append(h('div', { class: 'row', style: 'gap:7px;margin:7px 0;flex-wrap:nowrap' },
        what, spec, qty,
        rows.length > 1 ? h('button', { class: 'btn tiny ghost danger', style: 'flex:0 0 auto', onclick: () => { rows.splice(i, 1); draw(); } }, '✕') : null));
    });
    if (rows.length < 8) {
      rowsBox.append(h('button', { class: 'btn tiny ghost', style: 'margin-top:4px', onclick: () => { rows.push({ what: '', spec: '', qty: '' }); draw(); } }, '＋ 加一行需求'));
    }
  }
  draw();
  const nameIn = h('input', { placeholder: '怎么称呼你', autocomplete: 'name' });
  const phoneIn = h('input', { type: 'tel', placeholder: '手机号', autocomplete: 'tel' });
  const regionIn = h('input', { placeholder: '到货城市，如 成都' });
  const noteIn = h('textarea', { placeholder: '用途、到货时间、品质要求…（选填）', style: 'min-height:56px' });
  const errEl = h('div', { class: 'ferr' });

  const body = h('div', null,
    h('h2', null, '批量询价 · 求购'),
    h('p', { class: 'small muted', style: 'margin:4px 0 10px' },
      (sellerName ? '把需求清单发给「' + sellerName + '」' : '把需求清单发给平台，由 KMTY 对接合适的基地') + ' — 无需在线付款，微信里对接报价。'),
    h('div', { class: 'f' }, h('span', { style: 'display:block;font-size:12.5px;color:var(--muted);margin-bottom:4px' }, '需求清单'), rowsBox),
    h('div', { class: 'grid2' },
      h('label', { class: 'f' }, h('span', null, '称呼 *'), nameIn),
      h('label', { class: 'f' }, h('span', null, '手机号 *'), phoneIn)),
    h('label', { class: 'f' }, h('span', null, '到货城市'), regionIn),
    h('label', { class: 'f' }, h('span', null, '备注（选填）'), noteIn),
    errEl,
    h('button', { class: 'ctabtn', onclick: submit }, '提交求购单'));
  const sh = sheet(body);

  async function submit() {
    errEl.textContent = '';
    const clean = rows.map((r) => ({ what: r.what.trim(), spec: r.spec.trim(), qty: parseInt(r.qty || '0', 10) }))
      .filter((r) => r.what && r.qty > 0);
    if (!clean.length) { errEl.textContent = '请至少填写一行需求（品种 + 数量）'; return; }
    if (!nameIn.value.trim()) { errEl.textContent = '请填写称呼'; return; }
    if (phoneIn.value.replace(/\D/g, '').length < 6) { errEl.textContent = '请填写有效手机号'; return; }
    let r;
    try {
      r = await API.post('/api/order', {
        slug, kind: 'rfq', rows: clean, region: regionIn.value.trim(),
        name: nameIn.value.trim(), phone: phoneIn.value.trim(), note: noteIn.value.trim(),
        qty: clean.reduce((a, b) => a + b.qty, 0),
      }, { quiet: true });
    } catch (e) { errEl.textContent = e.message; return; }
    sh.close();
    const done = h('div', { class: 'center' },
      h('h2', { style: 'margin-top:6px' }, '求购单已提交 🎉'),
      h('div', { class: 'ticket' },
        h('p', { class: 'small muted', style: 'margin:0 0 4px' }, '求购单号'),
        h('div', { class: 'codebig copy', onclick: () => copyText(r.code) }, r.code)),
      h('p', { class: 'small muted' }, (sellerName || '平台') + '会尽快联系你报价；也可以在微信里报上单号跟进。'),
      h('button', { class: 'btn block ghost', style: 'margin-top:8px', onclick: () => d2.close() }, '好的'));
    const d2 = sheet(done, { dismiss: false });
  }
}
