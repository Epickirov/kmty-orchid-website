/* Shared by /inventory and /inventory-admin: ISO week arithmetic, the four
   language dictionaries for the buyer-facing page, and the fetch wrappers.

   The inventory pages carry their own dictionary rather than loading the main
   site's i18n.js: that file is 87KB and half of it is the Yunnan map, whose
   render() runs on every language switch and would throw on a page with no
   map in it. What they do share is the *choice* — both read and write
   localStorage['kmty-lang'], so switching language on the main site carries
   over to here and back. */
(function () {
  'use strict';

  /* ---------------- ISO-8601 weeks ----------------
     Week 1 is the week containing 4 January and weeks start on Monday, which
     is the convention the cut-flower and young-plant trade already books
     shipping in. The server repeats this independently — it never trusts a
     week number that arrives from a browser. */
  function mondayOfWeek(year, week) {
    var jan4 = new Date(Date.UTC(year, 0, 4));
    var dow = jan4.getUTCDay() || 7;                       // 1..7, Mon..Sun
    var monday1 = new Date(jan4);
    monday1.setUTCDate(jan4.getUTCDate() - dow + 1);
    var d = new Date(monday1);
    d.setUTCDate(monday1.getUTCDate() + (week - 1) * 7);
    return d;
  }
  function weeksInYear(year) {
    var jan1 = new Date(Date.UTC(year, 0, 1)).getUTCDay();
    var leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return (jan1 === 4 || (leap && jan1 === 3)) ? 53 : 52;
  }
  /* Every ISO week that touches a calendar month. A week straddling the turn
     of a month belongs to both, which is what a grower means by "early April"
     — so it is listed under both rather than assigned to one. */
  function weeksOfMonth(year, month) {
    var first = Date.UTC(year, month, 1);
    var last = Date.UTC(year, month + 1, 0, 23, 59, 59);
    var out = [];
    for (var w = 1; w <= weeksInYear(year); w++) {
      var start = mondayOfWeek(year, w);
      var end = new Date(start); end.setUTCDate(start.getUTCDate() + 6);
      if (end.getTime() >= first && start.getTime() <= last) out.push({ week: w, start: start, end: end });
    }
    return out;
  }

  /* ---------------- copy ---------------- */
  var DICT = {
    en: {
      'back': '← Main site',
      'gate.h1': 'Live inventory, week by week',
      'gate.p': 'Our current availability — every variety, cup size and quantity, by production week. Buyers can browse it and send a request straight to our sales desk. Ask your KMTY contact for the access code.',
      'gate.ph': 'Access code', 'gate.btn': 'Unlock',
      'gate.bad': 'That code is not right. Check it with your KMTY contact.',
      'gate.none': 'Inventory is not open yet. Please check back shortly.',
      'gate.net': 'Could not reach the server. Try again in a moment.',
      'gate.ask': 'No code yet? <a href="/#contact">Ask us for one</a> — it takes a minute.',
      'app.h1': 'What we have, and when',
      'app.p': 'Pick a month to see it week by week. Quantities are what is uncommitted right now and move as orders are confirmed, so treat them as a live guide rather than a reservation.',
      'app.foot': 'Quantities update as our sales desk confirms orders. Nothing here is reserved until we reply to your request.',
      'wk': 'Week', 'varieties': 'varieties', 'plants': 'plants', 'available': 'available',
      'qty': 'Qty', 'add': 'Add', 'lines': 'lines', 'remove': 'Remove', 'over': 'over stock',
      'none': 'Nothing is scheduled for this month yet. Try another month.',
      'tray.open': 'Review & send ▴',
      'f.company': 'Company', 'f.name': 'Your name', 'f.email': 'Email',
      'f.tel': 'Phone / WeChat', 'f.country': 'Destination country',
      'f.note': 'Anything else we should know', 'f.send': 'Send request',
      'done.h1': 'Request sent',
      'done.p': 'Our sales desk will check it against the production schedule and reply to you by email. Nothing is deducted until we confirm with you.',
      'done.again': 'Browse again',
      'months': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      'mshort': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    },
    zh: {
      'back': '← 返回主站',
      'gate.h1': '实时库存 · 按周查看',
      'gate.p': '当前可供货源——品种、杯径与数量，按生产周排列。客户可在此浏览并直接向销售部提交需求。访问码请向您的 KMTY 对接人索取。',
      'gate.ph': '访问码', 'gate.btn': '进入',
      'gate.bad': '访问码不正确，请与您的 KMTY 对接人核对。',
      'gate.none': '库存尚未开放，请稍后再试。',
      'gate.net': '无法连接服务器，请稍后重试。',
      'gate.ask': '还没有访问码？<a href="/#contact">联系我们索取</a>，一分钟即可。',
      'app.h1': '现有货源与供货时间',
      'app.p': '选择月份，即可按周查看。数量为当前尚未锁定的库存，会随订单确认而变动，仅供参考，不构成预留。',
      'app.foot': '数量随销售部确认订单实时更新。在我们回复您的需求之前，均不作预留。',
      'wk': '第', 'varieties': '个品种', 'plants': '株', 'available': '株可供',
      'qty': '数量', 'add': '加入', 'lines': '项', 'remove': '移除', 'over': '超出库存',
      'none': '本月暂无排产，请选择其他月份。',
      'tray.open': '核对并提交 ▴',
      'f.company': '公司名称', 'f.name': '联系人', 'f.email': '邮箱',
      'f.tel': '电话 / 微信', 'f.country': '目的地国家',
      'f.note': '其他需要说明的事项', 'f.send': '提交需求',
      'done.h1': '需求已提交',
      'done.p': '销售部将对照排产计划核实，并通过邮件回复您。在与您确认之前，不会扣减任何库存。',
      'done.again': '继续浏览',
      'months': ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
      'mshort': ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    },
    ru: {
      'back': '← На главную',
      'gate.h1': 'Наличие по неделям',
      'gate.p': 'Текущее наличие — сорта, диаметр горшка и количество по производственным неделям. Покупатели могут просматривать его и отправлять запрос напрямую в отдел продаж. Код доступа запросите у вашего менеджера KMTY.',
      'gate.ph': 'Код доступа', 'gate.btn': 'Войти',
      'gate.bad': 'Код неверный. Уточните его у вашего менеджера KMTY.',
      'gate.none': 'Наличие пока не открыто. Загляните чуть позже.',
      'gate.net': 'Нет связи с сервером. Попробуйте ещё раз.',
      'gate.ask': 'Нет кода? <a href="/#contact">Запросите его у нас</a> — это займёт минуту.',
      'app.h1': 'Что есть и когда',
      'app.p': 'Выберите месяц, чтобы посмотреть его по неделям. Количество — это то, что ещё не законтрактовано; оно меняется по мере подтверждения заказов, поэтому считайте его ориентиром, а не бронью.',
      'app.foot': 'Количество обновляется по мере подтверждения заказов отделом продаж. До нашего ответа ничего не бронируется.',
      'wk': 'Неделя', 'varieties': 'сортов', 'plants': 'шт.', 'available': 'в наличии',
      'qty': 'Кол-во', 'add': 'Добавить', 'lines': 'позиций', 'remove': 'Убрать', 'over': 'больше, чем есть',
      'none': 'На этот месяц пока ничего не запланировано. Выберите другой месяц.',
      'tray.open': 'Проверить и отправить ▴',
      'f.company': 'Компания', 'f.name': 'Ваше имя', 'f.email': 'Эл. почта',
      'f.tel': 'Телефон / WeChat', 'f.country': 'Страна назначения',
      'f.note': 'Что ещё нам стоит знать', 'f.send': 'Отправить запрос',
      'done.h1': 'Запрос отправлен',
      'done.p': 'Отдел продаж сверит его с планом производства и ответит вам по электронной почте. Ничего не списывается до подтверждения.',
      'done.again': 'Смотреть дальше',
      'months': ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
      'mshort': ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
    },
    vi: {
      'back': '← Về trang chính',
      'gate.h1': 'Tồn kho theo tuần',
      'gate.p': 'Nguồn hàng hiện có — từng giống, cỡ chậu và số lượng, xếp theo tuần sản xuất. Khách hàng có thể xem và gửi yêu cầu thẳng tới bộ phận kinh doanh. Xin mã truy cập từ người phụ trách KMTY của bạn.',
      'gate.ph': 'Mã truy cập', 'gate.btn': 'Mở',
      'gate.bad': 'Mã không đúng. Vui lòng kiểm tra lại với người phụ trách KMTY.',
      'gate.none': 'Tồn kho chưa mở. Vui lòng quay lại sau.',
      'gate.net': 'Không kết nối được máy chủ. Vui lòng thử lại.',
      'gate.ask': 'Chưa có mã? <a href="/#contact">Liên hệ để nhận</a> — chỉ mất một phút.',
      'app.h1': 'Có gì, và khi nào',
      'app.p': 'Chọn một tháng để xem theo từng tuần. Số lượng là phần chưa được đặt và sẽ thay đổi khi đơn hàng được xác nhận, nên hãy xem đây là thông tin tham khảo chứ không phải đặt giữ.',
      'app.foot': 'Số lượng cập nhật khi bộ phận kinh doanh xác nhận đơn. Chưa có gì được giữ cho tới khi chúng tôi phản hồi.',
      'wk': 'Tuần', 'varieties': 'giống', 'plants': 'cây', 'available': 'có sẵn',
      'qty': 'SL', 'add': 'Thêm', 'lines': 'mục', 'remove': 'Bỏ', 'over': 'vượt tồn kho',
      'none': 'Tháng này chưa có kế hoạch. Vui lòng chọn tháng khác.',
      'tray.open': 'Kiểm tra & gửi ▴',
      'f.company': 'Công ty', 'f.name': 'Tên của bạn', 'f.email': 'Email',
      'f.tel': 'Điện thoại / WeChat', 'f.country': 'Quốc gia nhận hàng',
      'f.note': 'Điều gì khác chúng tôi nên biết', 'f.send': 'Gửi yêu cầu',
      'done.h1': 'Đã gửi yêu cầu',
      'done.p': 'Bộ phận kinh doanh sẽ đối chiếu với kế hoạch sản xuất và trả lời bạn qua email. Không trừ tồn kho cho tới khi xác nhận với bạn.',
      'done.again': 'Xem tiếp',
      'months': ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'],
      'mshort': ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'],
    },
  };

  var LANG = 'en';
  try { var saved = localStorage.getItem('kmty-lang'); if (DICT[saved]) LANG = saved; } catch (e) {}

  var T = {
    lang: function () { return LANG; },
    set: function (l) {
      if (!DICT[l]) return;
      LANG = l;
      try { localStorage.setItem('kmty-lang', l); } catch (e) {}
      document.documentElement.lang = l;
    },
    s: function (k) { return (DICT[LANG] && DICT[LANG][k]) || DICT.en[k] || k; },
    month: function (m) { return T.s('mshort')[m]; },
    monthLong: function (m) { return T.s('months')[m]; },
    range: function (a, b) {
      var ms = T.s('mshort');
      var one = function (d) { return d.getUTCDate() + ' ' + ms[d.getUTCMonth()]; };
      return a.getUTCMonth() === b.getUTCMonth()
        ? a.getUTCDate() + '–' + b.getUTCDate() + ' ' + ms[b.getUTCMonth()]
        : one(a) + ' – ' + one(b);
    },
    apply: function (root) {
      document.documentElement.lang = LANG;
      root.querySelectorAll('[data-t]').forEach(function (el) {
        var v = T.s(el.getAttribute('data-t')); if (typeof v === 'string') el.textContent = v;
      });
      root.querySelectorAll('[data-t-html]').forEach(function (el) {
        var v = T.s(el.getAttribute('data-t-html')); if (typeof v === 'string') el.innerHTML = v;
      });
      root.querySelectorAll('[data-t-ph]').forEach(function (el) {
        var v = T.s(el.getAttribute('data-t-ph')); if (typeof v === 'string') el.placeholder = v;
      });
    },
  };

  /* ---------------- api ---------------- */
  function post(url, body, headers) {
    return fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'content-type': 'application/json' }, headers || {}),
      body: JSON.stringify(body || {}),
    }).then(function (r) { return r.json().catch(function () { return { ok: false, error: 'bad response' }; }); });
  }
  function get(url, headers) {
    return fetch(url, { headers: headers || {} })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'bad response' }; }); });
  }

  var api = {
    unlock: function (code) { return post('/api/inv/unlock', { code: code }); },
    items: function (code) { return get('/api/inv/items', { 'x-inv-code': code }); },
    inquire: function (code, body) { return post('/api/inv/inquire', body, { 'x-inv-code': code }); },
    // staff
    adminItems: function (pass) { return get('/api/inv/items', { 'x-admin-pass': pass }); },
    saveItem: function (pass, item) { return post('/api/inv/admin/item', item, { 'x-admin-pass': pass }); },
    inquiries: function (pass) { return get('/api/inv/admin/inquiries', { 'x-admin-pass': pass }); },
    decide: function (pass, key, action) { return post('/api/inv/admin/decide', { key: key, action: action }, { 'x-admin-pass': pass }); },
    getSettings: function (pass) { return get('/api/inv/admin/settings', { 'x-admin-pass': pass }); },
    setSettings: function (pass, s) { return post('/api/inv/admin/settings', s, { 'x-admin-pass': pass }); },
  };

  window.KMTY_INV = {
    t: T, api: api,
    weeks: { mondayOfWeek: mondayOfWeek, weeksInYear: weeksInYear, weeksOfMonth: weeksOfMonth },
  };
})();
