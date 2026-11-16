// ============================================================
// 華誼租車：網站預約／意見反饋 → Google 試算表 + Email 通知
// 貼到 Google 試算表的「擴充功能 → Apps Script」，取代原本全部內容。
// 修改後記得：部署 → 管理部署作業 → 編輯（鉛筆）→ 版本選「新版本」→ 部署
// ============================================================

// ===== 設定 =====
// 收通知的管理員信箱（多個用半形逗號隔開）
const NOTIFY_TO = 'your-email@gmail.com';
// 寄給客人的信上顯示的寄件人名稱
const SENDER_NAME = '華誼租車';
// 客人回信時寄到哪裡（通常填管理員信箱的第一個）
const REPLY_TO = 'your-email@gmail.com';

const LINE_ID = 'kiki939779';
const PHONE = '+886-3-555-0113';

// ===== 試算表欄位 =====
const BOOKING_COLS = [
  ['收到時間', d => new Date()],
  ['預約編號', d => d.ref],
  ['狀態', d => d.updated ? '修改' : '新預約'],
  ['語言', d => ({ ja: '日文', en: '英文' })[d.lang] || '中文'],
  ['服務類型', d => ({ send: '送機', pick: '接機', round: '來回' })[d.type] || d.type],
  ['機場', d => d.airport],
  ['縣市', d => d.county],
  ['鄉鎮區', d => d.area],
  ['上車地址', d => d.addr],
  ['日期', d => d.date],
  ['時間', d => d.time],
  ['航班', d => d.flight],
  ['回程日期', d => d.rdate],
  ['回程時間', d => d.rtime],
  ['回程航班', d => d.rflight],
  ['人數', d => d.pax],
  ['行李', d => d.bags],
  ['車種', d => d.carName || d.car],
  ['安全座椅', d => d.seats],
  ['中途停靠', d => d.stops],
  ['試算金額', d => d.estimate],
  ['姓名', d => d.name],
  ['電話', d => d.phone],
  ['LINE', d => d.line],
  ['Email', d => d.email],
  ['備註', d => d.note],
  ['已寄確認信給客人', d => d._customerMailed ? '是' : ''],
];

const FEEDBACK_COLS = [
  ['收到時間', d => new Date()],
  ['語言', d => ({ ja: '日文', en: '英文' })[d.lang] || '中文'],
  ['意見類型', d => d.type],
  ['滿意度', d => d.rate],
  ['搭乘日期', d => d.date],
  ['姓名', d => d.name],
  ['聯絡方式', d => d.contact],
  ['意見內容', d => d.message],
];

// ===== 主程式 =====
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    const isFeedback = d.kind === 'feedback';

    // 1) 先寄確認信給客人（只有預約、而且有填 Email 才寄）；寄失敗不影響後面的記錄
    if (!isFeedback && isEmail(d.email)) {
      try { sendCustomerMail(d); d._customerMailed = true; } catch (err) { d._customerMailed = false; }
    }

    // 2) 記到試算表
    const cols = isFeedback ? FEEDBACK_COLS : BOOKING_COLS;
    const sheet = getSheet(isFeedback ? '意見反饋' : '預約', cols);
    // 文字開頭加 ' ：避免電話號碼的 0 被吃掉，也避免被當成公式
    const row = cols.map(c => {
      const v = c[1](d);
      return (typeof v === 'string' && v) ? "'" + v : (v ?? '');
    });
    sheet.appendRow(row);

    // 3) 通知管理員
    const lines = cols.slice(1).map((c, i) => c[0] + '：' + String(row[i + 1]).replace(/^'/, ''))
                      .filter(l => !/：$/.test(l));
    const subject = isFeedback
      ? '【意見反饋】' + (d.type || '') + '｜' + (d.name || '未留名')
      : '【' + (d.updated ? '修改預約' : '新預約') + '】' + (d.ref || '') + '｜' + (d.date || '') + ' ' + (d.time || '') + '｜' + (d.name || '');
    MailApp.sendEmail({ to: NOTIFY_TO, subject: subject, body: lines.join('\n') + '\n\n試算表：' + SpreadsheetApp.getActive().getUrl() });

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ===== 寄給客人的預約確認信（依網站語言：中文／日文／英文）=====
const T = {
  zh: {
    subjectNew: '【華誼租車】已收到您的預約 {ref}',
    subjectUpd: '【華誼租車】已更新您的預約 {ref}',
    hello: '{name} 您好：',
    intro: '感謝您的預約，以下是您送出的內容。專人會在一天內以 LINE 或電話確認車輛與最終金額，確認後才算完成預約。',
    ref: '預約編號', service: '服務', airport: '機場', date: '日期時間', flight: '航班',
    ret: '回程', addr: '地址', pax: '人數／行李', car: '車種', addons: '加購', price: '預估金額（每車）', note: '備註',
    paxFmt: '{p} 位・{b} 件', seats: '安全座椅 {n} 座', stops: '中途停靠 {n} 點',
    type: { send: '送機', pick: '接機', round: '來回接送' },
    quote: '專人報價',
    outro: '需要修改預約內容，請加 LINE（{line}）告知預約編號。\n一天內沒有收到聯絡，請撥 24 小時專線 {phone}。',
    sign: '華誼租車 新竹店',
    auto: '（此信為系統自動寄出）'
  },
  ja: {
    subjectNew: '【華誼租車】ご予約を受け付けました {ref}',
    subjectUpd: '【華誼租車】ご予約を更新しました {ref}',
    hello: '{name} 様',
    intro: 'ご予約ありがとうございます。送信いただいた内容は以下のとおりです。1日以内に担当者が LINE またはお電話で、車両と最終料金をご連絡します。確認が取れた時点で予約完了となります。',
    ref: '予約番号', service: 'サービス', airport: '空港', date: '日時', flight: '便名',
    ret: '復路', addr: '住所', pax: '人数／荷物', car: '車種', addons: 'オプション', price: '概算料金（1台あたり）', note: '備考',
    paxFmt: '{p}名・{b}個', seats: 'チャイルドシート{n}台', stops: '途中立ち寄り{n}か所',
    type: { send: '空港行き', pick: '空港お迎え', round: '往復送迎' },
    quote: '個別見積もり',
    outro: 'ご予約内容の変更は、LINE（ID：{line}）で予約番号をお知らせください。\n1日以内に連絡がない場合は、24時間ダイヤル {phone} までお電話ください。',
    sign: '華誼租車 新竹店',
    auto: '（このメールは自動送信されています）'
  },
  en: {
    subjectNew: '[Hwayi Car Rental] We have received your booking {ref}',
    subjectUpd: '[Hwayi Car Rental] Your booking has been updated {ref}',
    hello: 'Dear {name},',
    intro: 'Thank you for your booking. Here are the details you sent. Within 1 day we will confirm the vehicle and final price by LINE or phone. Your booking is complete once confirmed.',
    ref: 'Booking number', service: 'Service', airport: 'Airport', date: 'Date & time', flight: 'Flight',
    ret: 'Return', addr: 'Address', pax: 'Passengers / bags', car: 'Vehicle', addons: 'Add-ons', price: 'Estimated price (per vehicle)', note: 'Notes',
    paxFmt: '{p} passengers · {b} bags', seats: 'Child seat × {n}', stops: 'Extra stop × {n}',
    type: { send: 'Airport drop-off', pick: 'Airport pickup', round: 'Round-trip transfer' },
    quote: 'Custom quote',
    outro: 'To change your booking, send us your booking number on LINE (ID: {line}).\nIf you have not heard from us within 1 day, please call our 24-hour line at {phone}.',
    sign: 'Hwayi Car Rental, Hsinchu',
    auto: '(This is an automated email.)'
  }
};

// 機場、車種名稱（網站送來的是中文）
const NAMES = {
  ja: {
    '桃園機場 第一航廈': '桃園空港 第1ターミナル', '桃園機場 第二航廈': '桃園空港 第2ターミナル', '桃園機場 第三航廈': '桃園空港 第3ターミナル',
    '台北松山機場': '台北松山空港', '台中國際機場': '台中国際空港',
    '福斯 The New Crafter': 'フォルクスワーゲン The New Crafter', '福斯 T6': 'フォルクスワーゲン T6', 'Hyundai Staria': 'ヒョンデ Staria',
    '賓士 Vito': 'メルセデス・ベンツ Vito', '賓士 V250D': 'メルセデス・ベンツ V250D', '賓士 Sprinter': 'メルセデス・ベンツ Sprinter'
  },
  en: {
    '桃園機場 第一航廈': 'Taoyuan Airport Terminal 1', '桃園機場 第二航廈': 'Taoyuan Airport Terminal 2', '桃園機場 第三航廈': 'Taoyuan Airport Terminal 3',
    '台北松山機場': 'Taipei Songshan Airport', '台中國際機場': 'Taichung International Airport',
    '福斯 The New Crafter': 'Volkswagen The New Crafter', '福斯 T6': 'Volkswagen T6', 'Hyundai Staria': 'Hyundai Staria',
    '賓士 Vito': 'Mercedes-Benz Vito', '賓士 V250D': 'Mercedes-Benz V250D', '賓士 Sprinter': 'Mercedes-Benz Sprinter'
  }
};

function sendCustomerMail(d) {
  const lang = T[d.lang] ? d.lang : 'zh';
  const t = T[lang];
  const nm = s => (NAMES[lang] && NAMES[lang][s]) || s || '';
  const fill = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m));
  const note = String(d.note || '').replace(/^【[^】]*】/, '');  // 拿掉網站加的語言標記
  const addons = [d.seats > 0 ? fill(t.seats, { n: d.seats }) : '', d.stops > 0 ? fill(t.stops, { n: d.stops }) : ''].filter(Boolean).join(', ');
  const price = d.estimate === '專人報價' || !d.estimate ? t.quote : d.estimate;

  const rows = [
    [t.ref, d.ref],
    [t.service, t.type[d.type] || d.type],
    [t.airport, nm(d.airport)],
    [t.date, [d.date, d.time].filter(Boolean).join(' ')],
    [t.flight, d.flight],
    [t.ret, d.type === 'round' ? [d.rdate, d.rtime, d.rflight].filter(Boolean).join(' ') : ''],
    [t.addr, d.addr],
    [t.pax, fill(t.paxFmt, { p: d.pax, b: d.bags })],
    [t.car, nm(d.carName)],
    [t.addons, addons],
    [t.price, price],
    [t.note, note]
  ].filter(r => r[1]);

  const body = [
    fill(t.hello, { name: d.name || '' }),
    '',
    t.intro,
    '',
    rows.map(r => r[0] + (lang === 'en' ? ': ' : '：') + r[1]).join('\n'),
    '',
    fill(t.outro, { line: LINE_ID, phone: PHONE }),
    '',
    t.sign,
    t.auto
  ].join('\n');

  MailApp.sendEmail({
    to: d.email,
    subject: fill(d.updated ? t.subjectUpd : t.subjectNew, { ref: d.ref || '' }),
    body: body,
    name: SENDER_NAME,
    replyTo: REPLY_TO
  });
}

// ===== 工具 =====
function isEmail(s) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || '').trim()); }

function getSheet(name, cols) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(cols.map(c => c[0]));
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, cols.length).setFontWeight('bold').setBackground('#D9B45A');
  }
  return sh;
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ===== 手動測試 =====
// 在編輯器上方選這個函式按「執行」：會寫一筆測試資料、寄通知給管理員，並寄一封確認信到 TEST_EMAIL
const TEST_EMAIL = 'your-email@gmail.com';
function testRun() {
  doPost({ postData: { contents: JSON.stringify({
    kind: 'booking', ref: 'TEST01', type: 'send', airport: '桃園機場 第一航廈', county: '新竹', area: '竹北',
    addr: '測試地址', date: '2026-12-01', time: '05:30', pax: 2, bags: 2, carName: '福斯 T6',
    seats: 0, stops: 0, estimate: 'NT$1,200', name: '測試', phone: '0912345678', email: TEST_EMAIL, lang: 'zh'
  }) } });
}
