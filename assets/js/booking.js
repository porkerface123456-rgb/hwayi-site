/* 預約頁：狀態、驗證、試算、送出、修改、帶入首頁查價 */
(function () {
  'use strict';
  var HY = window.HY;
  var $ = function (id) { return document.getElementById(id); };
  var form = $('booking-form');

  /* 進入預約頁一律從最上方開始：
     不讓瀏覽器或預覽環境沿用上一頁（或上次）的捲動位置。
     使用者一開始捲動或操作，就不再強制回到頂端。 */
  (function startAtTop() {
    if (location.hash) return;
    try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
    var timers = [];
    var toTop = function () { window.scrollTo(0, 0); };
    var stop = function () {
      timers.forEach(clearTimeout); timers = [];
      ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (t) { window.removeEventListener(t, stop, true); });
    };
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (t) { window.addEventListener(t, stop, true); });
    toTop();
    window.addEventListener('load', function () { toTop(); timers.push(setTimeout(toTop, 60), setTimeout(toTop, 300)); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) toTop(); });
    timers.push(setTimeout(stop, 1500));
  })();

  var OTHER = '其他地區';
  var TEXT = ['date', 'time', 'flight', 'rdate', 'rtime', 'rflight', 'addr', 'name', 'phone', 'line', 'email', 'note'];
  var ERR_ORDER = ['date', 'time', 'flight', 'rdate', 'rtime', 'rflight', 'addr', 'name', 'phone', 'email'];
  var NAMES = { date: '日期', time: '時間', flight: '航班編號', rdate: '回程日期', rtime: '回程時間', rflight: '回程航班編號', addr: '地址', name: '姓名', phone: '手機或 LINE ID', email: 'Email' };
  var PERSIST = ['type', 'airport', 'county', 'area', 'pax', 'bags', 'car', 'seats', 'stops'].concat(TEXT, ['submitted', 'ref', 'updated', 'snapshot']);
  var TTL = 48 * 60 * 60 * 1000;          /* 草稿與確認保留 48 小時 */
  var HANDOFF_TTL = 30 * 60 * 1000;
  var LIMITS = { pax: [1, 8], bags: [0, 12], stops: [0, 3] };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var sheetOpen = false;
  var handoffMsg = null;

  function blank(keep) {
    var b = {
      type: 'send', airport: 'T1', county: '新竹', area: '竹北', pax: 2, bags: 2, car: 't6', seats: 0, stops: 0,
      date: '', time: '', flight: '', rdate: '', rtime: '', rflight: '', addr: '',
      name: '', phone: '', line: '', email: '', note: '',
      tried: false, submitted: false, sending: false, ref: '', updated: false, snapshot: null
    };
    if (keep) ['name', 'phone', 'line', 'email'].forEach(function (k) { b[k] = keep[k] || ''; });
    return b;
  }

  function load() {
    var s = blank();
    try {
      var raw = localStorage.getItem(HY.DRAFT_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && o.data && Date.now() - o.savedAt < TTL) {
          PERSIST.forEach(function (k) { if (o.data[k] !== undefined) s[k] = o.data[k]; });
          if (!HY.CARS[s.car]) s.car = HY.CAR_ALIAS[s.car] || 't6';
        }
      }
    } catch (e) { /* 無法讀取就用空白表單 */ }
    s.sending = false; s.tried = false;
    if (HY.counties().indexOf(s.county) < 0 && s.county !== OTHER) s.county = '新竹';
    return s;
  }
  function save() {
    try {
      var d = {};
      PERSIST.forEach(function (k) { d[k] = state[k]; });
      localStorage.setItem(HY.DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), data: d }));
    } catch (e) { /* 私密模式：不保存 */ }
  }
  var state = load();
  function set(patch) { for (var k in patch) state[k] = patch[k]; save(); render(); }

  /* ---------- 衍生值 ---------- */
  function areaOpts() { return state.county === OTHER ? ['（專人報價）'] : HY.areasOf(state.county); }
  function currentArea() { var o = areaOpts(); return o.indexOf(state.area) >= 0 ? state.area : o[0]; }
  function seatsMax() { return Math.min(4, state.pax); }
  /* 依車型的載客與行李上限；尚未提供時暫用 8 位、8 件 */
  function carLimits(car) {
    var c = HY.CARS[car || state.car] || {};
    return { pax: c.maxPax || 8, bags: c.maxBags || HY.BAG_LIMIT, known: !!(c.maxPax && c.maxBags) };
  }
  function toHalf(str) {
    return String(str).replace(/[０-９＋－]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
  }
  function normPhone(p) { return toHalf(p).replace(/[\s\-().]/g, '').replace(/^\+8860/, '+886'); }

  function validate() {
    var s = state, E = {}, now = HY.twNow();
    var isPick = s.type === 'pick', isRound = s.type === 'round';
    if (!s.date) E.date = '請選擇日期';
    else if (s.date < now.date) E.date = '日期不能早於今天';
    if (!s.time) E.time = isPick ? '請填寫班機抵達時間' : '請填寫上車時間';
    else if (s.date === now.date && s.time <= now.hm) E.time = '這個時間已經過了，請選擇稍晚的時間';
    if (isPick && !s.flight.trim()) E.flight = '接機需要航班編號，司機才能掌握班機實際抵達時間';
    if (isRound) {
      if (!s.rdate) E.rdate = '請選擇回程日期';
      else if (s.date && s.rdate < s.date) E.rdate = '回程日期不能早於去程';
      if (!s.rtime) E.rtime = '請填寫回程班機抵達時間';
      else if (s.rdate && s.rdate === s.date && s.time && s.rtime <= s.time) E.rtime = '回程時間要晚於去程上車時間';
      if (!s.rflight.trim()) E.rflight = '回程接機需要航班編號，司機才能掌握班機抵達時間';
    }
    if (!s.addr.trim()) E.addr = '請填寫詳細地址，司機才找得到您';
    if (!s.name.trim()) E.name = '請填寫姓名';
    var digits = normPhone(s.phone);
    if (!digits && !s.line.trim()) E.phone = '手機或 LINE ID 請至少填一項，客服才能聯絡您';
    else if (digits) {
      var tw = /^0\d{8,9}$/.test(digits) || /^\+886\d{8,9}$/.test(digits);
      var intl = /^\+\d{8,15}$/.test(digits);
      if (/^09/.test(digits) && digits.length !== 10) E.phone = '手機號碼是 10 碼，例如 0912-345-678';
      else if (!(tw || intl)) E.phone = '電話格式不太對，例如 0912-345-678 或 +81 90-1234-5678';
    }
    if (s.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email.trim())) E.email = 'Email 格式不太對，例如 name@example.com';
    return E;
  }
  function errKeys(E) { return ERR_ORDER.filter(function (k) { return E[k]; }); }

  function pricing() {
    var s = state, isPick = s.type === 'pick', isRound = s.type === 'round', trips = isRound ? 2 : 1, area = currentArea();
    var base = s.county === OTHER ? 0 : HY.priceOf(s.county, area);
    var quote = HY.CARS[s.car].quote || s.county === OTHER;
    var reason = s.county === OTHER ? '此地區不在價目表內，由專人報價。'
      : '這台車由專人報價。';
    var seats = Math.min(s.seats, s.pax);
    if (quote && (seats || s.stops)) reason += '加購項目會一併計入報價。';
    if (quote) reason += '送出後，專人會在' + HY.REPLY_TIME + '內回覆金額。';
    var place = s.county === OTHER ? OTHER : HY.placeOf(s.county, area);
    var ap = HY.AIRPORTS[s.airport].short;
    var seatFee = seats * 100 * trips, stopFee = s.stops * 100;
    var apExtra = HY.AIRPORTS[s.airport].extra || 0, apFee = apExtra * trips;
    var amt = function (n) { return quote ? HY.fmt(n) + '（併入報價）' : HY.fmt(n); };
    var lines = [{ k: (isRound ? '來回' : '單程') + ' × ' + trips + ' 趟', v: quote ? '專人報價' : HY.fmt(base * trips) }];
    if (apFee) lines.push({ k: '松山機場加價' + (trips > 1 ? ' × ' + trips + ' 趟' : ''), v: amt(apFee) });
    if (seats) lines.push({ k: '安全座椅 × ' + seats + (trips > 1 ? '（來回）' : ''), v: amt(seatFee) });
    if (s.stops) lines.push({ k: '中途停靠 × ' + s.stops, v: amt(stopFee) });
    return {
      from: isPick ? ap : place, to: isPick ? place : ap, isRound: isRound, place: place, seats: seats,
      lines: lines, quote: quote, reason: reason,
      total: quote ? '專人報價' : HY.fmt(base * trips + apFee + seatFee + stopFee)
    };
  }
  function routeHTML(p) { return HY.esc(p.from) + (p.isRound ? HY.ICON.both : HY.ICON.arrow) + HY.esc(p.to); }

  /* ---------- 畫面 ---------- */
  function label(id, text, required) {
    $(id).innerHTML = HY.esc(text) + '<span class="req">' + (required ? '必填' : '選填') + '</span>';
  }
  function markField(k, bad, msg) {
    var el = $('f-' + k), er = $('e-' + k);
    if (!el || !er) return;
    el.setAttribute('aria-invalid', bad ? 'true' : 'false');
    er.hidden = !bad;
    er.innerHTML = bad ? HY.ICON.alert + '<span>' + HY.esc(msg) + '</span>' : '';
    if (bad) el.setAttribute('aria-describedby', 'e-' + k); else el.removeAttribute('aria-describedby');
  }
  function stepper(k, min, max) {
    $('v-' + k).textContent = state[k];
    var btns = form.querySelectorAll('[data-step="' + k + '"]');
    btns[0].disabled = state[k] <= min;
    btns[1].disabled = state[k] >= max;
  }
  function fillCounties() {
    $('f-county').innerHTML = HY.counties().concat([OTHER]).map(function (c) {
      return '<option value="' + HY.esc(c) + '">' + HY.esc(c) + '</option>';
    }).join('');
  }
  function fillAreas() {
    var sel = $('f-area'), opts = areaOpts();
    if (sel.getAttribute('data-county') !== state.county) {
      sel.innerHTML = opts.map(function (o) { return '<option value="' + HY.esc(o) + '">' + HY.esc(o) + '</option>'; }).join('');
      sel.setAttribute('data-county', state.county);
    }
    sel.value = currentArea();
    sel.disabled = state.county === OTHER || HY.isAll(state.county);
  }
  function syncInputs() {
    TEXT.forEach(function (k) { var el = $('f-' + k); if (el && el.value !== state[k]) el.value = state[k]; });
  }

  function render() {
    var s = state, isPick = s.type === 'pick', isRound = s.type === 'round';
    var now = HY.twNow();

    $('view-form').hidden = s.submitted;
    $('view-done').hidden = !s.submitted;
    document.body.classList.toggle('is-done', s.submitted);

    ['type', 'airport', 'car'].forEach(function (n) {
      Array.prototype.forEach.call(form.querySelectorAll('input[name="' + n + '"]'), function (r) { r.checked = r.value === s[n]; });
    });

    label('l-date', isPick ? '接機日期' : (isRound ? '去程日期' : '送機日期'), true);
    label('l-time', isPick ? '班機抵達時間' : '上車時間', true);
    label('l-flight', isRound ? '去程航班編號' : '航班編號', isPick);
    label('l-addr', isPick ? '下車地址' : (isRound ? '上車地址（回程也送回這裡）' : '上車地址'), true);
    $('legend-place').textContent = isPick ? '下車地點' : (isRound ? '上下車地點' : '上車地點');
    $('f-date').min = now.date;
    $('f-rdate').min = s.date || now.date;
    $('return-fields').hidden = !isRound;
    $('send-tip').hidden = isPick;

    if ($('f-county').value !== s.county) $('f-county').value = s.county;
    fillAreas();

    var lim = carLimits();
    stepper('pax', 1, lim.pax); stepper('bags', 0, 12); stepper('seats', 0, seatsMax()); stepper('stops', 0, 3);
    $('pax-hint').textContent = '這台車最多 ' + lim.pax + ' 位';
    $('overcap-n').textContent = lim.bags;
    $('overcap').hidden = !(s.bags > lim.bags);
    Array.prototype.forEach.call(document.querySelectorAll('.cap[data-car]'), function (el) {
      var c = HY.CARS[el.getAttribute('data-car')];
      el.hidden = !(c.maxPax && c.maxBags);  /* 數字提供前先不顯示 */
      el.innerHTML = '<span class="nobr">載客 ' + c.maxPax + ' 位</span>・<span class="nobr">行李 ' + c.maxBags + ' 件</span>';
    });

    var E = validate(), keys = errKeys(E), show = s.tried;
    ERR_ORDER.forEach(function (k) { markField(k, !!(show && E[k]), E[k]); });
    var contactMissing = show && E.phone && !normPhone(s.phone);
    $('f-line').setAttribute('aria-invalid', contactMissing ? 'true' : 'false');

    var p = pricing(), rh = routeHTML(p);
    var lh = p.lines.map(function (l) { return '<div><dt>' + HY.esc(l.k) + '</dt><dd class="data">' + HY.esc(l.v) + '</dd></div>'; }).join('');
    $('t-route').innerHTML = rh; $('m-route').innerHTML = rh;
    $('t-lines').innerHTML = lh; $('m-lines').innerHTML = lh;
    $('t-total').textContent = p.total; $('m-total').textContent = p.total;
    ['t-total', 'm-total'].forEach(function (id) { $(id).classList.toggle('is-quote', p.quote); });
    ['t-quote', 'm-quote'].forEach(function (id) { $(id).hidden = !p.quote; $(id).textContent = p.quote ? p.reason : ''; });

    var es = $('t-errors');
    if (show && keys.length) {
      es.hidden = false;
      es.innerHTML = '<strong>還有 ' + keys.length + ' 項需要處理</strong>' +
        keys.slice(0, 3).map(function (k) {
          return '<a href="#f-' + k + '" data-focus="f-' + k + '">' + HY.esc(NAMES[k] + '：' + E[k]) + '</a>';
        }).join('') +
        (keys.length > 3 ? '<span class="hint">另外還有 ' + (keys.length - 3) + ' 項，請往下檢查</span>' : '');
    } else { es.hidden = true; es.innerHTML = ''; }
    $('m-errors').hidden = !(show && keys.length);
    $('m-errors').textContent = show && keys.length ? '還有 ' + keys.length + ' 項需要處理，已捲到第一個欄位' : '';

    var submitLabel = s.sending ? '送出中…' : (s.ref ? '更新預約' : '送出預約');
    Array.prototype.forEach.call(document.querySelectorAll('.js-submit'), function (b) {
      b.textContent = submitLabel; b.disabled = s.sending; b.setAttribute('aria-busy', String(s.sending));
    });

    $('edit-banner').hidden = !(s.ref && !s.submitted);
    $('edit-ref').textContent = s.ref;
    if (handoffMsg) {
      $('notice').hidden = false;
      $('notice-text').textContent = handoffMsg.text;
      $('notice-undo').hidden = !handoffMsg.undo;
    } else { $('notice').hidden = true; }

    $('m-sheet').hidden = !sheetOpen;
    $('m-toggle').setAttribute('aria-expanded', String(sheetOpen));
    $('m-toggle-hint').textContent = sheetOpen ? '收合明細' : '看明細';

    if (s.submitted) renderDone(p);
  }

  function when(date, time) {
    var wd = '日一二三四五六'.charAt(new Date(date + 'T12:00:00').getDay());
    return date.slice(5).replace('-', '/') + '（' + wd + '）' + time;
  }
  function renderDone(p) {
    var s = state, isPick = s.type === 'pick', isRound = s.type === 'round';
    $('done-title').textContent = s.updated ? '已更新您的預約' : '已收到您的預約';
    $('done-ref').textContent = s.ref;
    var rows = [
      ['服務', isRound ? '來回接送' : (isPick ? '接機' : '送機')],
      ['路線', p.from + (isRound ? ' ⇄ ' : ' → ') + p.to],
      [isPick ? '接機' : (isRound ? '去程' : '送機'), { data: when(s.date, s.time) + (s.flight ? '・' + s.flight.toUpperCase() : '') }]
    ];
    if (isRound) rows.push(['回程', { data: when(s.rdate, s.rtime) + '・' + s.rflight.toUpperCase() }]);
    rows.push([isPick ? '下車地址' : '上車地址', p.place + ' ' + s.addr]);
    rows.push(['人數／行李', s.pax + ' 位・' + s.bags + ' 件']);
    rows.push(['車種', HY.CARS[s.car].name]);
    if (s.bags > carLimits().bags) rows.push(['提醒', '行李較多，可能需要兩台車，客服會與您確認']);
    if (p.quote) rows.push(['報價', '專人會在' + HY.REPLY_TIME + '內以 LINE 或電話回覆金額']);
    if (p.seats || s.stops) rows.push(['加購', [p.seats ? '安全座椅 ' + p.seats + ' 座' : '', s.stops ? '中途停靠 ' + s.stops + ' 點' : ''].filter(Boolean).join('・')]);
    rows.push(['聯絡人', [s.name, s.phone, s.line ? 'LINE ' + s.line : ''].filter(Boolean).join('・')]);
    if (s.note.trim()) rows.push(['備註', s.note]);
    $('done-summary').innerHTML = rows.map(function (r) {
      var v = typeof r[1] === 'object' ? '<span class="data">' + HY.esc(r[1].data) + '</span>' : HY.esc(r[1]);
      return '<div><dt>' + HY.esc(r[0]) + '</dt><dd>' + v + '</dd></div>';
    }).join('');
    $('done-total').textContent = p.total;
    $('done-total').classList.toggle('is-quote', p.quote);
  }

  /* ---------- 動作 ---------- */
  function scrollTop() { window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); }
  function focusField(id) {
    var el = $(id);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    el.focus({ preventScroll: true });
  }
  function genRef() {
    return 'HY-' + HY.twNow().date.replace(/-/g, '') + '-' + String(Math.floor(1000 + Math.random() * 9000));
  }

  function submit() {
    if (state.sending) return;
    var keys = errKeys(validate());
    if (keys.length) {
      sheetOpen = false;
      set({ tried: true });
      setTimeout(function () { focusField('f-' + keys[0]); }, 30);
      return;
    }
    set({ tried: true, sending: true });
    var payload = {};
    PERSIST.forEach(function (k) { if (k !== 'snapshot') payload[k] = state[k]; });
    payload.area = currentArea();
    payload.seats = Math.min(state.seats, state.pax);
    payload.estimate = pricing().total;
    var isUpdate = !!state.ref, ref = state.ref || genRef();
    payload.ref = ref;
    payload.updated = isUpdate;
    payload.carName = HY.CARS[state.car].name;
    payload.airport = HY.AIRPORTS[state.airport].name;
    HY.submitBooking(payload).then(function () {
      handoffMsg = null; sheetOpen = false;
      set({ sending: false, submitted: true, ref: ref, updated: isUpdate, snapshot: null, tried: false });
      window.scrollTo(0, 0);
      $('done-title').focus();
    }, function () {
      set({ sending: false });
      var msg = '送出失敗，請再試一次，或直接撥 03-5550113。';
      $('m-errors').hidden = false;
      $('m-errors').textContent = msg;
      $('t-errors').hidden = false;
      $('t-errors').innerHTML = '<strong>' + msg + '</strong>';
    });
  }

  function onField(e) {
    var t = e.target, n = t.name;
    if (!n) return;
    if (TEXT.indexOf(n) >= 0) { state[n] = t.value; save(); render(); return; }
    if (n === 'type' || n === 'airport' || n === 'car') {
      if (t.checked && state[n] !== t.value) {
        var o = {}; o[n] = t.value;
        if (n === 'car') { var mp = carLimits(t.value).pax; if (state.pax > mp) { o.pax = mp; o.seats = Math.min(state.seats, mp); } }
        set(o);
      }
      return;
    }
    if (n === 'county') { set({ county: t.value, area: '' }); return; }
    if (n === 'area') { set({ area: t.value }); }
  }
  form.addEventListener('input', onField);
  form.addEventListener('change', onField);
  form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });

  form.addEventListener('click', function (e) {
    var b = e.target.closest('[data-step]');
    if (!b || b.disabled) return;
    var k = b.getAttribute('data-step'), d = Number(b.getAttribute('data-dir'));
    var lim = k === 'seats' ? [0, seatsMax()] : (k === 'pax' ? [1, carLimits().pax] : LIMITS[k]);
    var v = Math.max(lim[0], Math.min(lim[1], state[k] + d));
    var patch = {}; patch[k] = v;
    if (k === 'pax') patch.seats = Math.min(state.seats, v);
    set(patch);
  });

  $('t-errors').addEventListener('click', function (e) {
    var a = e.target.closest('[data-focus]');
    if (a) { e.preventDefault(); focusField(a.getAttribute('data-focus')); }
  });
  $('m-toggle').addEventListener('click', function () { sheetOpen = !sheetOpen; sheetScrollY = window.scrollY; render(); });
  /* 明細面板：按 Esc、開始填欄位、或捲動頁面時自動收合 */
  var sheetScrollY = 0;
  function closeSheet() { if (sheetOpen) { sheetOpen = false; render(); } }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheetOpen) { closeSheet(); $('m-toggle').focus(); } });
  form.addEventListener('focusin', closeSheet);
  window.addEventListener('scroll', function () { if (sheetOpen && Math.abs(window.scrollY - sheetScrollY) > 100) closeSheet(); }, { passive: true });
  /* 表單底部的送出按鈕在畫面上時，隱藏底部列的送出按鈕 */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      document.body.classList.toggle('actions-in-view', en[0].isIntersecting);
    }, { threshold: 0.5 }).observe(document.querySelector('.form-actions'));
  }

  $('btn-edit').addEventListener('click', function () {
    var snap = {};
    PERSIST.forEach(function (k) { if (k !== 'snapshot') snap[k] = state[k]; });
    set({ submitted: false, updated: false, tried: false, snapshot: snap });
    syncInputs();
    scrollTop();
    $('form-title').focus({ preventScroll: true });
  });
  $('btn-cancel-edit').addEventListener('click', function () {
    var snap = state.snapshot;
    if (snap) Object.keys(snap).forEach(function (k) { state[k] = snap[k]; });
    state.snapshot = null; state.submitted = true; state.tried = false;
    save(); syncInputs(); render();
    window.scrollTo(0, 0);
    $('done-title').focus();
  });
  $('btn-reset').addEventListener('click', function () {
    state = blank(state);           /* 保留姓名與聯絡方式，方便預約下一筆 */
    handoffMsg = null; sheetOpen = false;
    save(); syncInputs(); render();
    window.scrollTo(0, 0);
    $('form-title').focus();
  });
  $('btn-copy').addEventListener('click', function () {
    var btn = this, ref = state.ref;
    var done = function () { btn.textContent = '已複製'; setTimeout(function () { btn.textContent = '複製編號'; }, 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ref).then(done, function () { fallbackCopy(ref); done(); });
    } else { fallbackCopy(ref); done(); }
  });
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* 無法複製時使用者仍可手動選取編號 */ }
    document.body.removeChild(ta);
  }

  /* ---------- 首頁查價帶入 ---------- */
  function applyHandoff() {
    var h;
    try {
      var raw = localStorage.getItem(HY.HANDOFF_KEY);
      if (!raw) return false;
      localStorage.removeItem(HY.HANDOFF_KEY);
      h = JSON.parse(raw);
    } catch (e) { return false; }
    if (!h || !(Date.now() - h.at < HANDOFF_TTL)) return false;
    if (h.car && !HY.CARS[h.car]) h.car = HY.CAR_ALIAS[h.car];
    if (h.car && HY.CARS[h.car] && !h.county) {
      if (state.ref && !state.submitted) { handoffMsg = { text: '您正在修改預約 ' + state.ref + '，首頁選擇的車種沒有套用。', undo: false }; render(); return true; }
      var prevCar = { car: state.car };
      if (state.submitted) state = blank(state);
      state.car = h.car;
      var mp = carLimits(h.car).pax; if (state.pax > mp) state.pax = mp;
      handoffMsg = { text: '已帶入首頁選擇的車種：' + HY.CARS[h.car].name + '。', undo: prevCar.car !== h.car ? prevCar : false };
      save(); syncInputs(); render();
      return true;
    }
    if (HY.counties().indexOf(h.county) < 0) return false;
    var airport = HY.AIRPORTS[h.airport] ? h.airport : 'T1';
    var area = HY.areasOf(h.county).indexOf(h.area) >= 0 ? h.area : HY.areasOf(h.county)[0];
    var text = HY.placeOf(h.county, area) + '・' + HY.AIRPORTS[airport].short;
    if (state.ref && !state.submitted) {
      handoffMsg = { text: '您正在修改預約 ' + state.ref + '，首頁選擇的「' + text + '」沒有套用。', undo: false };
      render();
      return true;
    }
    var prev = { county: state.county, area: currentArea(), airport: state.airport };
    var started = state.submitted;
    if (started) state = blank(state);
    state.county = h.county; state.area = area; state.airport = airport;
    var same = prev.county === state.county && prev.area === area && prev.airport === airport;
    handoffMsg = {
      text: (started ? '已開始新的預約，並帶入首頁選擇：' : '已帶入首頁選擇：') + text + '。',
      undo: (!started && !same) ? prev : false
    };
    save(); syncInputs(); render();
    return true;
  }
  $('notice-undo').addEventListener('click', function () {
    if (handoffMsg && handoffMsg.undo) { var u = handoffMsg.undo; handoffMsg = null; set(u); }
  });
  $('notice-close').addEventListener('click', function () { handoffMsg = null; render(); });
  window.addEventListener('storage', function (e) { if (e.key === HY.HANDOFF_KEY && e.newValue) applyHandoff(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) applyHandoff(); });

  /* ---------- 啟動 ---------- */
  fillCounties();
  syncInputs();
  if (!applyHandoff()) render();
})();
