/* 首頁：查價器、價目表分頁、帶入預約頁 */
(function () {
  'use strict';
  var HY = window.HY;
  var $ = function (id) { return document.getElementById(id); };

  function handoff(county, area, airport) {
    try {
      localStorage.setItem(HY.HANDOFF_KEY, JSON.stringify({ county: county, area: area, airport: airport, at: Date.now() }));
    } catch (e) { /* 私密模式等情況：預約頁會使用預設值 */ }
  }

  /* ---------- 查價器 ---------- */
  var qc = $('q-county'), qa = $('q-area'), qair = $('q-airport');
  qc.innerHTML = HY.counties().map(function (c) { return '<option>' + HY.esc(c) + '</option>'; }).join('');
  qc.value = '新竹';

  function fillAreas(keep) {
    var areas = HY.areasOf(qc.value);
    qa.innerHTML = areas.map(function (a) { return '<option>' + HY.esc(a) + '</option>'; }).join('');
    qa.value = keep && areas.indexOf(keep) >= 0 ? keep : areas[0];
  }

  function updateQuote() {
    var county = qc.value, area = qa.value, ap = qair.value;
    var to = HY.AIRPORTS[ap].short;
    $('q-route').innerHTML = HY.esc(county + area) + HY.ICON.arrow + HY.esc(to);
    var price = $('q-price');
    if (ap === 'TSA') {
      price.textContent = '專人報價';
      price.classList.add('is-quote');
      $('q-note').textContent = '松山機場依地址報價，送出預約後客服會回覆金額。';
    } else {
      price.textContent = HY.fmt(HY.priceOf(county, area));
      price.classList.remove('is-quote');
      $('q-note').textContent = '每車單趟・九人座商務車・送機接機同價';
    }
  }

  fillAreas('竹北');
  updateQuote();
  qc.addEventListener('change', function () { fillAreas(); updateQuote(); });
  qa.addEventListener('change', updateQuote);
  qair.addEventListener('change', updateQuote);
  $('q-book').addEventListener('click', function () { handoff(qc.value, qa.value, qair.value); });

  /* ---------- 價目表分頁（鍵盤：左右鍵切換） ---------- */
  var tabs = $('tabs'), rows = $('board-rows'), board = $('board');
  var counties = HY.counties();
  var current = '新竹';

  tabs.innerHTML = counties.map(function (c, i) {
    return '<button type="button" role="tab" class="tab" id="tab-' + i + '" aria-controls="board" data-county="' + HY.esc(c) + '">' + HY.esc(c) + '</button>';
  }).join('');

  function selectCounty(c, focus) {
    current = c;
    Array.prototype.forEach.call(tabs.children, function (b) {
      var on = b.getAttribute('data-county') === c;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on) { board.setAttribute('aria-labelledby', b.id); if (focus) b.focus(); }
    });
    rows.innerHTML = HY.PRICES[c].map(function (r) {
      return '<div class="board-row"><span class="board-areas">' + HY.esc(r[0].join('、')) + '</span>' +
        '<span class="board-price data">' + HY.fmt(r[1]) + '</span></div>';
    }).join('');
    $('board-book').textContent = '從' + c + '出發，線上預約';
  }

  tabs.addEventListener('click', function (e) {
    var b = e.target.closest('[role="tab"]');
    if (b) selectCounty(b.getAttribute('data-county'));
  });
  tabs.addEventListener('keydown', function (e) {
    var i = counties.indexOf(current);
    if (e.key === 'ArrowRight') { e.preventDefault(); selectCounty(counties[(i + 1) % counties.length], true); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); selectCounty(counties[(i - 1 + counties.length) % counties.length], true); }
    if (e.key === 'Home') { e.preventDefault(); selectCounty(counties[0], true); }
    if (e.key === 'End') { e.preventDefault(); selectCounty(counties[counties.length - 1], true); }
  });
  $('board-book').addEventListener('click', function () { handoff(current, HY.areasOf(current)[0], 'T1'); });

  selectCounty('新竹');

  /* 查價器在畫面上時，隱藏底部列（避免同時出現兩個主按鈕） */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      document.body.classList.toggle('quote-in-view', en[0].isIntersecting);
    }, { threshold: 0.25 }).observe($('quote'));
  }
})();
