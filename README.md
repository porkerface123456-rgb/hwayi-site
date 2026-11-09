# 華誼租車 新竹店｜機場接送・包車旅遊網站

純 HTML／CSS／JavaScript 靜態網站，不需要建置工具。

- `index.html`：首頁（查價、服務、精選車種、計價方式、常見問題）
- `booking.html`：線上預約（即時試算、驗證、確認頁）
- `assets/`：樣式、程式、圖片
- `DESIGN.md`：設計規範
- `_snapshots/`：存檔節點，每個資料夾是一個可還原的完整版本；`*.standalone.html` 是單一檔案、可直接用瀏覽器打開的備份
- `_archive/`：舊版設計（航廈時刻表版）

## 本機預覽

```bash
python3 -m http.server 8000
```

然後打開 http://localhost:8000

## 上線前待辦

- 補上所有 `[ ]` 空位的實際資料（載客數、等候規定、取消規定、付款方式等）
- 車輛實拍照片（福斯 T6、Hyundai Staria、賓士 Vito、賓士 Sprinter）
- `assets/js/data.js` 的 `submitBooking()` 串接實際通知（Email／LINE／後端 API）
