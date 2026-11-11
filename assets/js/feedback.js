/* 首頁：意見反饋表單（尚未串接後端，送出流程與預約相同使用模擬） */
(function () {
  'use strict';
  var HY = window.HY;
  var $ = function (id) { return document.getElementById(id); };
  var form = $('fb-form');
  if (!form) return;
  var msg = $('fb-msg'), err = $('fb-e-msg'), btn = $('fb-submit'), count = $('fb-count');

  $('fb-date').max = HY.twNow().date || '';

  function showErr(text) {
    msg.setAttribute('aria-invalid', text ? 'true' : 'false');
    err.hidden = !text;
    err.innerHTML = text ? HY.ICON.alert + '<span>' + HY.esc(text) + '</span>' : '';
    if (text) msg.setAttribute('aria-describedby', 'fb-e-msg'); else msg.removeAttribute('aria-describedby');
  }
  msg.addEventListener('input', function () {
    count.textContent = msg.value.length + ' / 1000';
    if (!err.hidden && msg.value.trim().length >= 5) showErr('');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = msg.value.trim();
    if (text.length < 5) { showErr(text ? '請再多寫幾個字，至少 5 個字' : '請填寫意見內容'); msg.focus(); return; }
    showErr('');
    var data = {
      type: (form.querySelector('input[name="fbtype"]:checked') || {}).value,
      rate: $('fb-rate').value, date: $('fb-date').value,
      name: $('fb-name').value.trim(), contact: $('fb-contact').value.trim(), message: text
    };
    btn.disabled = true; btn.textContent = '送出中…';
    HY.submitFeedback(data).then(function () {
      form.hidden = true;
      $('fb-done-msg').textContent = data.contact
        ? '我們已收到您的意見，專人會透過「' + data.contact + '」與您聯繫。'
        : '我們已收到您的意見，會轉給相關同仁處理。';
      $('fb-done').hidden = false; $('fb-done').focus();
    }, function () {
      showErr('送出失敗，請稍後再試，或直接 LINE：kiki939779');
    }).then(function () { btn.disabled = false; btn.textContent = '送出意見'; });
  });

  $('fb-again').addEventListener('click', function () {
    form.reset(); count.textContent = '0 / 1000';
    $('fb-done').hidden = true; form.hidden = false; msg.focus();
  });
})();
