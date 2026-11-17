/* 共用：手機選單、語言切換（中文 ↔ 日文；按鈕上的 data-href 指向另一種語言的同一頁） */
(function () {
  'use strict';
  var btn = document.querySelector('.menu-btn');
  var menu = document.getElementById('mobile-menu');

  function setMenu(open) {
    if (!btn || !menu) return;
    btn.setAttribute('aria-expanded', String(open));
    var t = window.HY ? HY.t : function (s) { return s; };
    btn.setAttribute('aria-label', t(open ? '關閉選單' : '開啟選單'));
    menu.hidden = !open;
  }
  if (btn && menu) {
    btn.addEventListener('click', function () { setMenu(btn.getAttribute('aria-expanded') !== 'true'); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { setMenu(false); btn.focus(); }
    });
    window.addEventListener('resize', function () { if (window.innerWidth >= 1024) setMenu(false); });
  }

  /* 告訴搜尋引擎三種語言版本互相對應（用目前網址自動算出，不必寫死網域） */
  (function () {
    if (!/^https?:$/.test(location.protocol)) return;
    var m = location.pathname.match(/^(.*?\/)(?:(?:ja|en)\/)?([^\/]*)$/);
    if (!m) return;
    var root = location.origin + m[1], file = m[2];
    [['zh-Hant', ''], ['ja', 'ja/'], ['en', 'en/'], ['x-default', '']].forEach(function (x) {
      var l = document.createElement('link');
      l.rel = 'alternate'; l.hreflang = x[0]; l.href = root + x[1] + file;
      document.head.appendChild(l);
    });
  })();

  var langBtns = document.querySelectorAll('[data-lang]');
  Array.prototype.forEach.call(langBtns, function (b) {
    b.addEventListener('click', function () {
      var href = b.getAttribute('data-href');
      if (href) { window.location.href = href + window.location.hash; return; }
      var v = b.getAttribute('data-lang');
      Array.prototype.forEach.call(langBtns, function (x) {
        x.setAttribute('aria-pressed', String(x.getAttribute('data-lang') === v));
      });
    });
  });
})();
