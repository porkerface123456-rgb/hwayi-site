/* 共用：手機選單、語言切換（翻譯尚未提供，暫時只切換狀態） */
(function () {
  'use strict';
  var btn = document.querySelector('.menu-btn');
  var menu = document.getElementById('mobile-menu');

  function setMenu(open) {
    if (!btn || !menu) return;
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? '關閉選單' : '開啟選單');
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

  var langBtns = document.querySelectorAll('[data-lang]');
  Array.prototype.forEach.call(langBtns, function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-lang');
      Array.prototype.forEach.call(langBtns, function (x) {
        x.setAttribute('aria-pressed', String(x.getAttribute('data-lang') === v));
      });
    });
  });
})();
