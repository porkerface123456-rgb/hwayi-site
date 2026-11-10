/* 首頁「精選車種」：分頁切換、照片填入、空狀態 */
(function () {
  'use strict';
  var list = document.getElementById('fleet-tabs');
  if (!list) return;
  var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));

  function select(i, focus) {
    tabs.forEach(function (t, k) {
      var on = k === i;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (on) {
        if (focus) t.focus();
        t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    });
  }
  list.addEventListener('click', function (e) {
    var t = e.target.closest('[role="tab"]');
    if (t) select(tabs.indexOf(t));
  });
  list.addEventListener('keydown', function (e) {
    var i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    var next = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(next, true);
  });

  /* 分頁在手機上可以橫向捲動：還能往右捲時顯示右側漸層提示 */
  function updateScrollCue() {
    var more = list.scrollWidth - list.clientWidth - list.scrollLeft > 4;
    list.classList.toggle('has-more', more);
  }
  list.addEventListener('scroll', updateScrollCue, { passive: true });
  window.addEventListener('resize', updateScrollCue);
  updateScrollCue();
})();

/* 照片：依 fleet-photos.js 的網址填入。
   0 張：整塊顯示一個「照片準備中」區塊（保留版面空間，不顯示 3 個空框）
   1～3 張：顯示照片，還沒提供的位置顯示淡色底塊 */
(function () {
  'use strict';
  var photos = window.HY_FLEET_PHOTOS || {};
  Array.prototype.forEach.call(document.querySelectorAll('.lp-gallery[data-car]'), function (g) {
    var urls = (photos[g.getAttribute('data-car')] || []).map(function (u) { return String(u || '').trim(); });
    var valid = urls.filter(function (u) { return /^https?:\/\//.test(u); });
    var name = ((g.parentNode.querySelector('.lp-fleet-text h3') || {}).textContent || '').trim();
    var loaded = 0;

    function setState() { g.classList.toggle('is-empty', loaded === 0); }
    setState();
    if (!valid.length) return;

    Array.prototype.forEach.call(g.querySelectorAll('.lp-slot'), function (slot, i) {
      var url = urls[i] || '';
      if (!/^https?:\/\//.test(url)) return;
      var ph = slot.querySelector('.lp-slot-ph');
      var img = new Image();
      img.alt = name + ' 照片 ' + (i + 1);
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.onload = function () { slot.classList.add('has-photo'); if (ph) ph.hidden = true; loaded++; setState(); };
      img.onerror = function () { img.remove(); slot.classList.remove('has-photo'); if (ph) ph.hidden = false; };
      img.src = url;
      slot.appendChild(img);
    });
  });
})();

/* 「用這台車預約」：把車種帶入預約頁 */
document.addEventListener('click', function (e) {
  var a = e.target.closest('[data-handoff-car]');
  if (!a || !window.HY) return;
  try { localStorage.setItem(window.HY.HANDOFF_KEY, JSON.stringify({ car: a.getAttribute('data-handoff-car'), at: Date.now() })); } catch (err) {}
});
