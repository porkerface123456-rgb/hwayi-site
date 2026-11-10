/* 共用資料與工具：價目、機場、車種、格式化、送出（尚未串接後端） */
window.HY = (function () {
  'use strict';

  /* 中南部 → 桃園機場，每車單趟（來源：店家價目表） */
  var PRICES = {
    '新竹': [[['新豐', '湖口', '新埔'], 1100], [['竹北', '關西', '芎林'], 1200], [['東區', '北區'], 1300], [['竹東', '寶山', '香山'], 1400]],
    '苗栗': [[['頭份', '竹南'], 1700], [['造橋', '頭屋', '後龍', '公館', '苗栗市'], 2000], [['通霄', '銅鑼', '苑裡', '三義'], 2300]],
    '台中': [[['大甲', '大安', '后里', '外埔'], 2500], [['清水', '神岡', '豐原'], 2600], [['梧棲', '沙鹿', '北屯', '大雅', '西屯', '潭子', '太平'], 2700], [['南屯', '西區', '北區', '中區'], 2800], [['南區', '大里', '大肚', '龍井', '烏日'], 2900]],
    '彰化': [[['員林', '田中', '二林', '溪湖', '北斗'], 3300], [['彰化市', '鹿港', '和美'], 3400]],
    '雲林': [[['麥寮', '崙背', '西螺', '莿桐', '二崙', '林內'], 3500], [['台西', '虎尾', '元長', '東勢', '土庫', '大埤', '褒忠', '斗南', '斗六'], 3700], [['四湖', '口湖', '水林', '古坑', '北港'], 3900]],
    '嘉義': [[['新港', '民雄', '大林'], 4100], [['太保', '嘉義市'], 4300], [['水上', '中埔', '朴子', '布袋', '東石'], 4500]],
    '台南': [[['下營', '鹽水', '柳營', '新營', '六甲', '麻豆', '安定', '官田', '新市', '善化', '山上'], 4900], [['安南', '北區', '永康', '安平', '中西區', '東區', '仁德', '歸仁'], 5100]]
  };

  var AIRPORTS = {
    T1: { name: '桃園機場 第一航廈', short: '桃園 T1' },
    T2: { name: '桃園機場 第二航廈', short: '桃園 T2' },
    TSA: { name: '台北松山機場', short: '松山機場' }
  };

  var CARS = {
    /* maxPax／maxBags：各車載客與行李上限（28 吋計）。null = 尚未提供，暫用最多 8 位、8 件 */
    std: { name: '精選九人座', sub: '福斯 T6・Hyundai Staria・賓士 Vito・賓士 Sprinter', note: '依價目表', maxPax: null, maxBags: null },
    v250: { name: '賓士 V250D', sub: '頂級移動式頭等艙', note: '專人報價', maxPax: null, maxBags: null },
    nanny: { name: '福斯 The New Crafter 九人座（VIP）', sub: 'VIP 高頂改裝・KTV', note: '專人報價', maxPax: null, maxBags: null }
  };

  function counties() { return Object.keys(PRICES); }
  function areasOf(c) {
    return PRICES[c] ? PRICES[c].reduce(function (a, r) { return a.concat(r[0]); }, []) : [];
  }
  function priceOf(c, area) {
    var p = 0;
    (PRICES[c] || []).forEach(function (r) { if (r[0].indexOf(area) >= 0) p = r[1]; });
    return p;
  }
  function fmt(n) { return 'NT$' + Number(n).toLocaleString('en-US'); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 一律以台灣時間判斷「今天／現在」，不受旅客手機時區影響 */
  function twNow() {
    try {
      var parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date());
      var o = {};
      parts.forEach(function (p) { o[p.type] = p.value; });
      return { date: o.year + '-' + o.month + '-' + o.day, hm: o.hour + ':' + o.minute };
    } catch (e) {
      var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
      return { date: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), hm: pad(d.getHours()) + ':' + pad(d.getMinutes()) };
    }
  }

  /* 送出預約。上線前在這裡串接實際通知管道（Email／LINE／後端 API）。
     目前模擬 900ms 後成功，回傳 Promise 以便替換。 */
  function submitBooking(payload) {
    return new Promise(function (resolve) { setTimeout(function () { resolve(payload); }, 900); });
  }

  var ICON = {
    arrow: '<svg class="i i-s" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    both: '<svg class="i i-s" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16l-4-4M20 15H4l4 4"/></svg>',
    alert: '<svg class="i i-s" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></svg>'
  };

  return {
    PRICES: PRICES, AIRPORTS: AIRPORTS, CARS: CARS, BAG_LIMIT: 8, REPLY_TIME: '[回覆時間]',
    HANDOFF_KEY: 'hy-quote-handoff', DRAFT_KEY: 'hy-booking-draft',
    LINE_URL: 'https://line.me/ti/p/~kiki939779',
    counties: counties, areasOf: areasOf, priceOf: priceOf, fmt: fmt, esc: esc,
    twNow: twNow, submitBooking: submitBooking, ICON: ICON
  };
})();
