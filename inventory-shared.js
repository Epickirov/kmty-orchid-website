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
  /* which ISO week we are in right now — the calendar opens on it rather than
     on January, because nobody orders into the past */
  function isoWeekNow() {
    var t = new Date();
    var d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - y0) / 86400000 + 1) / 7);
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
      'gate.ph': 'Access code', 'gate.btn': 'Unlock',
      'gate.bad': 'That code is not right. Check it with your KMTY contact.',
      'gate.none': 'Inventory is not open yet. Please check back shortly.',
      'gate.net': 'Could not reach the server. Try again in a moment.',
      'gate.ask': 'No code yet? <a href="/#contact">Ask us for one</a> — it takes a minute.',
      'app.foot': 'Quantities update as our sales desk confirms orders. Nothing here is reserved until we reply to your request.',
      'wk': 'Week', 'varieties': 'varieties', 'plants': 'plants', 'remove': 'Remove', 'over': 'over stock',
      'none': 'Nothing is scheduled for this month yet. Try another month.',
      'f.company': 'Company', 'f.name': 'Your name', 'f.email': 'Email',
      'f.tel': 'Phone / WeChat', 'f.country': 'Destination country',
      'f.note': 'Anything else we should know', 'f.send': 'Send request',
      'done.h1': 'Request sent',
      'done.p': 'Our sales desk will check it against the production schedule and reply to you by email. Nothing is deducted until we confirm with you.',
        'view.cal': 'Calendar',
      'view.gal': 'Gallery',
      'dens.cosy': 'Cosy',
      'dens.compact': 'Compact',
      'nav.status': 'Track a request',
      'gate.h1': 'Availability, week by week',
      'gate.p': 'Our production calendar — every variety, cup size and quantity, by week. Browse it, build a request and send it straight to our sales desk. Ask your KMTY contact for the access code.',
      'f.search': 'Search code or variety',
      'f.avail': 'In stock only',
      'wkOf': 'Week beginning',
      'avail': 'available',
      'trayOf': 'tray of %s',
      'pop.add': 'Add',
      'pop.update': 'Update',
      'pop.trays': '%n trays of %s',
      'pop.over': 'more than we hold',
      'pad.h': 'Your request',
      'pad.total': 'Total',
      'pad.empty': 'Nothing added yet. Pick a week on any variety.',
      'done.keep': 'Keep this reference — you can track the request with it and the email address you used.',
      'done.track': 'Track it',
      'done.again': 'Back to availability',
      'st.h1': 'Track a request',
      'st.p': 'Enter the reference we gave you and the email you sent it from.',
      'st.ref': 'INQ-…',
      'st.email': 'you@company.com',
      'st.btn': 'Check',
      'st.back': 'Back to availability',
      'st.none': 'No request matches that reference and email.',
      'st.pending': 'With our sales desk',
      'st.confirmed': 'Confirmed',
      'st.declined': 'Declined',
      'st.msg.pending': 'We have it and are checking it against the production schedule. Nothing is deducted yet.',
      'st.msg.confirmed': 'Confirmed and set aside. Our sales desk will be in touch about shipping.',
      'st.msg.declined': 'We could not fill this one. Nothing was deducted — please talk to your KMTY contact.',
      'st.set': 'Set aside:',
      'ns': 'N.S.',
      'ns.full': 'Natural spread — the width of one open flower',
      'ht': 'Height',
      'ht.full': 'Plant height',
      'stem.SS': 'Single stem', 'stem.DS': 'Dual stem',
      'stem.SS.s': 'SS', 'stem.DS.s': 'DS',
      'stem.full': 'Stem',
      'shot.plant': 'Whole plant', 'shot.flower': 'Flower',
      'shot.swap': 'Show this one large',
      'cup': 'Cup',
      'tray': 'Per tray',
    'months': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      'mshort': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    },
    zh: {
      'back': '← 返回主站',
      'gate.ph': '访问码', 'gate.btn': '进入',
      'gate.bad': '访问码不正确，请与您的 KMTY 对接人核对。',
      'gate.none': '库存尚未开放，请稍后再试。',
      'gate.net': '无法连接服务器，请稍后重试。',
      'gate.ask': '还没有访问码？<a href="/#contact">联系我们索取</a>，一分钟即可。',
      'app.foot': '数量随销售部确认订单实时更新。在我们回复您的需求之前，均不作预留。',
      'wk': '第', 'varieties': '个品种', 'plants': '株', 'remove': '移除', 'over': '超出库存',
      'none': '本月暂无排产，请选择其他月份。',
      'f.company': '公司名称', 'f.name': '联系人', 'f.email': '邮箱',
      'f.tel': '电话 / 微信', 'f.country': '目的地国家',
      'f.note': '其他需要说明的事项', 'f.send': '提交需求',
      'done.h1': '需求已提交',
      'done.p': '销售部将对照排产计划核实，并通过邮件回复您。在与您确认之前，不会扣减任何库存。',
        'view.cal': '排产日历',
      'view.gal': '图库',
      'dens.cosy': '宽松',
      'dens.compact': '紧凑',
      'nav.status': '查询进度',
      'gate.h1': '逐周可供货表',
      'gate.p': '我们的排产日历——品种、杯径、数量，按周排列。浏览后即可直接向销售部提交需求。访问码请向您的 KMTY 对接人索取。',
      'f.search': '搜索编号或品种',
      'f.avail': '仅看有货',
      'wkOf': '周起始',
      'avail': '株可供',
      'trayOf': '每盘 %s 株',
      'pop.add': '加入',
      'pop.update': '更新',
      'pop.trays': '%n 盘 × %s 株',
      'pop.over': '超出现有库存',
      'pad.h': '需求清单',
      'pad.total': '合计',
      'pad.empty': '尚未选择。在任意品种上点选周次即可。',
      'done.keep': '请保存此单号——凭单号与提交邮箱即可查询进度。',
      'done.track': '查询进度',
      'done.again': '返回可供货表',
      'st.h1': '查询进度',
      'st.p': '请输入我们提供的单号，以及提交时所用的邮箱。',
      'st.ref': 'INQ-…',
      'st.email': 'you@company.com',
      'st.btn': '查询',
      'st.back': '返回可供货表',
      'st.none': '未找到与该单号及邮箱匹配的需求。',
      'st.pending': '销售部处理中',
      'st.confirmed': '已确认',
      'st.declined': '已婉拒',
      'st.msg.pending': '我们已收到，正在对照排产计划核实。目前尚未扣减库存。',
      'st.msg.confirmed': '已确认并预留，销售部将就发运事宜与您联系。',
      'st.msg.declined': '本次未能满足，库存未作任何扣减，请与您的 KMTY 对接人联系。',
      'st.set': '已预留：',
      'ns': '花径',
      'ns.full': '花径 — 单朵花完全展开的宽度',
      'ht': '株高',
      'ht.full': '株高',
      'stem.SS': '单梗', 'stem.DS': '双梗',
      'stem.SS.s': '单梗', 'stem.DS.s': '双梗',
      'stem.full': '梗数',
      'shot.plant': '整株', 'shot.flower': '花朵特写',
      'shot.swap': '放大这张',
      'cup': '杯径',
      'tray': '每盘',
    'months': ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
      'mshort': ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    },
    ru: {
      'back': '← На главную',
      'gate.ph': 'Код доступа', 'gate.btn': 'Войти',
      'gate.bad': 'Код неверный. Уточните его у вашего менеджера KMTY.',
      'gate.none': 'Наличие пока не открыто. Загляните чуть позже.',
      'gate.net': 'Нет связи с сервером. Попробуйте ещё раз.',
      'gate.ask': 'Нет кода? <a href="/#contact">Запросите его у нас</a> — это займёт минуту.',
      'app.foot': 'Количество обновляется по мере подтверждения заказов отделом продаж. До нашего ответа ничего не бронируется.',
      'wk': 'Неделя', 'varieties': 'сортов', 'plants': 'шт.', 'remove': 'Убрать', 'over': 'больше, чем есть',
      'none': 'На этот месяц пока ничего не запланировано. Выберите другой месяц.',
      'f.company': 'Компания', 'f.name': 'Ваше имя', 'f.email': 'Эл. почта',
      'f.tel': 'Телефон / WeChat', 'f.country': 'Страна назначения',
      'f.note': 'Что ещё нам стоит знать', 'f.send': 'Отправить запрос',
      'done.h1': 'Запрос отправлен',
      'done.p': 'Отдел продаж сверит его с планом производства и ответит вам по электронной почте. Ничего не списывается до подтверждения.',
        'view.cal': 'Календарь',
      'view.gal': 'Галерея',
      'dens.cosy': 'Свободно',
      'dens.compact': 'Плотно',
      'nav.status': 'Статус запроса',
      'gate.h1': 'Наличие по неделям',
      'gate.p': 'Наш производственный календарь — сорта, диаметр горшка и количество по неделям. Посмотрите, соберите запрос и отправьте его прямо в отдел продаж. Код доступа запросите у вашего менеджера KMTY.',
      'f.search': 'Поиск по коду или сорту',
      'f.avail': 'Только в наличии',
      'wkOf': 'Начало недели',
      'avail': 'в наличии',
      'trayOf': 'лоток по %s',
      'pop.add': 'Добавить',
      'pop.update': 'Обновить',
      'pop.trays': '%n лотков по %s',
      'pop.over': 'больше, чем есть',
      'pad.h': 'Ваш запрос',
      'pad.total': 'Итого',
      'pad.empty': 'Пока пусто. Выберите неделю у любого сорта.',
      'done.keep': 'Сохраните номер — по нему и вашей почте можно отследить запрос.',
      'done.track': 'Отследить',
      'done.again': 'К наличию',
      'st.h1': 'Статус запроса',
      'st.p': 'Введите номер запроса и почту, с которой он был отправлен.',
      'st.ref': 'INQ-…',
      'st.email': 'you@company.com',
      'st.btn': 'Проверить',
      'st.back': 'К наличию',
      'st.none': 'Запрос с таким номером и почтой не найден.',
      'st.pending': 'У отдела продаж',
      'st.confirmed': 'Подтверждён',
      'st.declined': 'Отклонён',
      'st.msg.pending': 'Запрос получен, сверяем с планом производства. Пока ничего не списано.',
      'st.msg.confirmed': 'Подтверждён и отложен. Отдел продаж свяжется с вами по отгрузке.',
      'st.msg.declined': 'Выполнить не удалось. Ничего не списано — свяжитесь с вашим менеджером KMTY.',
      'st.set': 'Отложено:',
      'ns': 'Ø цветка',
      'ns.full': 'Натуральный размах — ширина раскрытого цветка',
      'ht': 'Высота',
      'ht.full': 'Высота растения',
      'stem.SS': 'Один цветонос', 'stem.DS': 'Два цветоноса',
      'stem.SS.s': 'SS', 'stem.DS.s': 'DS',
      'stem.full': 'Цветонос',
      'shot.plant': 'Всё растение', 'shot.flower': 'Цветок',
      'shot.swap': 'Показать крупно',
      'cup': 'Горшок',
      'tray': 'В лотке',
    'months': ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
      'mshort': ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
    },
    vi: {
      'back': '← Về trang chính',
      'gate.ph': 'Mã truy cập', 'gate.btn': 'Mở',
      'gate.bad': 'Mã không đúng. Vui lòng kiểm tra lại với người phụ trách KMTY.',
      'gate.none': 'Tồn kho chưa mở. Vui lòng quay lại sau.',
      'gate.net': 'Không kết nối được máy chủ. Vui lòng thử lại.',
      'gate.ask': 'Chưa có mã? <a href="/#contact">Liên hệ để nhận</a> — chỉ mất một phút.',
      'app.foot': 'Số lượng cập nhật khi bộ phận kinh doanh xác nhận đơn. Chưa có gì được giữ cho tới khi chúng tôi phản hồi.',
      'wk': 'Tuần', 'varieties': 'giống', 'plants': 'cây', 'remove': 'Bỏ', 'over': 'vượt tồn kho',
      'none': 'Tháng này chưa có kế hoạch. Vui lòng chọn tháng khác.',
      'f.company': 'Công ty', 'f.name': 'Tên của bạn', 'f.email': 'Email',
      'f.tel': 'Điện thoại / WeChat', 'f.country': 'Quốc gia nhận hàng',
      'f.note': 'Điều gì khác chúng tôi nên biết', 'f.send': 'Gửi yêu cầu',
      'done.h1': 'Đã gửi yêu cầu',
      'done.p': 'Bộ phận kinh doanh sẽ đối chiếu với kế hoạch sản xuất và trả lời bạn qua email. Không trừ tồn kho cho tới khi xác nhận với bạn.',
        'view.cal': 'Lịch sản xuất',
      'view.gal': 'Thư viện',
      'dens.cosy': 'Thoáng',
      'dens.compact': 'Gọn',
      'nav.status': 'Tra cứu yêu cầu',
      'gate.h1': 'Nguồn hàng theo tuần',
      'gate.p': 'Lịch sản xuất của chúng tôi — từng giống, cỡ chậu và số lượng, theo tuần. Xem, lập yêu cầu và gửi thẳng tới bộ phận kinh doanh. Xin mã truy cập từ người phụ trách KMTY của bạn.',
      'f.search': 'Tìm mã hoặc giống',
      'f.avail': 'Chỉ hàng có sẵn',
      'wkOf': 'Tuần bắt đầu',
      'avail': 'có sẵn',
      'trayOf': 'khay %s cây',
      'pop.add': 'Thêm',
      'pop.update': 'Cập nhật',
      'pop.trays': '%n khay × %s',
      'pop.over': 'vượt tồn kho',
      'pad.h': 'Yêu cầu của bạn',
      'pad.total': 'Tổng',
      'pad.empty': 'Chưa chọn gì. Hãy chọn một tuần ở bất kỳ giống nào.',
      'done.keep': 'Hãy giữ mã này — dùng nó cùng email đã gửi để tra cứu yêu cầu.',
      'done.track': 'Tra cứu',
      'done.again': 'Về nguồn hàng',
      'st.h1': 'Tra cứu yêu cầu',
      'st.p': 'Nhập mã chúng tôi đã cấp và email bạn đã dùng để gửi.',
      'st.ref': 'INQ-…',
      'st.email': 'you@company.com',
      'st.btn': 'Kiểm tra',
      'st.back': 'Về nguồn hàng',
      'st.none': 'Không tìm thấy yêu cầu khớp với mã và email đó.',
      'st.pending': 'Đang ở bộ phận kinh doanh',
      'st.confirmed': 'Đã xác nhận',
      'st.declined': 'Đã từ chối',
      'st.msg.pending': 'Chúng tôi đã nhận và đang đối chiếu với kế hoạch sản xuất. Chưa trừ tồn kho.',
      'st.msg.confirmed': 'Đã xác nhận và giữ hàng. Bộ phận kinh doanh sẽ liên hệ về việc giao hàng.',
      'st.msg.declined': 'Lần này chúng tôi chưa đáp ứng được. Không trừ tồn kho — vui lòng liên hệ người phụ trách KMTY.',
      'st.set': 'Đã giữ:',
      'ns': 'Ø hoa',
      'ns.full': 'Độ rộng của một bông hoa đã nở',
      'ht': 'Chiều cao',
      'ht.full': 'Chiều cao cây',
      'stem.SS': 'Một cành', 'stem.DS': 'Hai cành',
      'stem.SS.s': 'SS', 'stem.DS.s': 'DS',
      'stem.full': 'Cành hoa',
      'shot.plant': 'Cả cây', 'shot.flower': 'Hoa',
      'shot.swap': 'Xem ảnh này lớn',
      'cup': 'Chậu',
      'tray': 'Mỗi khay',
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
    dayRange: function (a, b) {
      var ms = T.s('mshort');
      return a.getUTCDate() + ' ' + ms[a.getUTCMonth()];
    },
    range: function (a, b) {
      var ms = T.s('mshort');
      var one = function (d) { return d.getUTCDate() + ' ' + ms[d.getUTCMonth()]; };
      return a.getUTCMonth() === b.getUTCMonth()
        ? a.getUTCDate() + '–' + b.getUTCDate() + ' ' + ms[b.getUTCMonth()]
        : one(a) + ' – ' + one(b);
    },
    /* SS / DS. `full` gives the sentence a buyer can read; the short form is
       the trade abbreviation everywhere except Chinese, where 单梗 / 双梗 *is*
       the abbreviation and SS would read as an import. */
    stem: function (c, full) { return c ? T.s('stem.' + c + (full ? '' : '.s')) : ''; },
    /* The measurements as a buyer writes them down. Anything not recorded is
       left out rather than shown as a zero or a dash — a blank in a spec line
       is noise, and a zero is a lie. */
    specs: function (it, skipStem) {
      var out = [];
      if (it.cup) out.push(it.cup);
      if (it.stem && !skipStem) out.push(T.stem(it.stem));
      if (it.ns) out.push(T.s('ns') + ' ' + it.ns + ' cm');
      if (it.ht) out.push(T.s('ht') + ' ' + it.ht + ' cm');
      return out;
    },
    /* skipStem is for the places that already show the SS/DS badge: saying it
       twice on one line is noise, and the line is fighting for width. */
    specLine: function (it, skipStem) { return T.specs(it, skipStem).join(' · ') || '—'; },
    /* Cup and stem alone: what identifies the grade in a list that already has
       the variety name above it. The measurements go in full where there is
       room to read them. */
    specShort: function (it) {
      var o = [];
      if (it.cup) o.push(it.cup);
      if (it.stem) o.push(T.stem(it.stem));
      return o.join(' · ') || '—';
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
    status: function (code, ref, email) { return post('/api/inv/status', { ref: ref, email: email }, { 'x-inv-code': code }); },
    // staff
    adminItems: function (pass) { return get('/api/inv/items', { 'x-admin-pass': pass }); },
    saveItem: function (pass, item) { return post('/api/inv/admin/item', item, { 'x-admin-pass': pass }); },
    inquiries: function (pass) { return get('/api/inv/admin/inquiries', { 'x-admin-pass': pass }); },
    decide: function (pass, key, action) { return post('/api/inv/admin/decide', { key: key, action: action }, { 'x-admin-pass': pass }); },
    getSettings: function (pass) { return get('/api/inv/admin/settings', { 'x-admin-pass': pass }); },
    setSettings: function (pass, s) { return post('/api/inv/admin/settings', s, { 'x-admin-pass': pass }); },
  };

  /* One place that knows how a photo is addressed, so the two pages and the
     admin cannot drift apart. `shot` is 'plant' (the default, and what the
     older single-photo links said) or 'flower'. updatedAt busts the cache,
     which is why the image route may cache hard. */
  function photo(it, shot) {
    return '/api/inv/img?id=' + encodeURIComponent(it.id) +
      (shot === 'flower' ? '&shot=flower' : '') + '&t=' + (it.updatedAt || 0);
  }
  function hasShot(it, shot) { return shot === 'flower' ? !!it.img2 : !!it.img; }

  window.KMTY_INV = {
    t: T, api: api, photo: photo, hasShot: hasShot,
    weeks: { mondayOfWeek: mondayOfWeek, weeksInYear: weeksInYear, weeksOfMonth: weeksOfMonth, isoWeekNow: isoWeekNow },
  };
})();
