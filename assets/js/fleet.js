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
