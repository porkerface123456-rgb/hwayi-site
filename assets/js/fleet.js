/* 首頁「精選車種」分頁：點選或用左右鍵切換車款 */
(function () {
  'use strict';
  var list = document.getElementById('fleet-tabs');
  if (!list) return;
  var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
  var dots = Array.prototype.slice.call(document.querySelectorAll('.lp-dots span'));

  function select(i, focus) {
    tabs.forEach(function (t, k) {
      var on = k === i;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (dots[k]) dots[k].classList.toggle('on', on);
      if (on && focus) t.focus();
    });
  }
  list.addEventListener('click', function (e) {
    var t = e.target.closest('[role="tab"]');
    if (t) select(tabs.indexOf(t));
  });
  list.addEventListener('keydown', function (e) {
    var i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); select((i + 1) % tabs.length, true); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); select((i - 1 + tabs.length) % tabs.length, true); }
  });
})();

/* 把 fleet-photos.js 設定的照片放進每款車的 3 個空格；網址空白或載入失敗就保留空格 */
(function () {
  'use strict';
  var photos = window.HY_FLEET_PHOTOS || {};
  Array.prototype.forEach.call(document.querySelectorAll('.lp-gallery[data-car]'), function (g) {
    var urls = photos[g.getAttribute('data-car')] || [];
    var name = (g.parentNode.querySelector('.lp-fleet-text h3') || {}).textContent || '';
    Array.prototype.forEach.call(g.querySelectorAll('.lp-slot'), function (slot, i) {
      var url = (urls[i] || '').trim();
      if (!/^https?:\/\//.test(url)) return;
      var ph = slot.querySelector('.lp-slot-ph');
      var img = new Image();
      img.alt = name.trim() + ' 照片 ' + (i + 1);
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.onload = function () { slot.classList.add('has-photo'); if (ph) ph.hidden = true; };
      img.onerror = function () { img.remove(); slot.classList.remove('has-photo'); if (ph) ph.hidden = false; };
      img.src = url;
      slot.appendChild(img);
    });
  });
})();
