# 評論小幫手 review-helper

Google 新評論自動偵測＋AI 回覆建議。先做**自用版**（萬家福五甲店），驗證流程後再包裝成賣給商家的多商家版。

## 現在會做的事

1. 每 2 小時自動檢查 Google 地圖最新評論（助理端排程）
2. 新評論自動入庫、去重
3. AI 依星級＋內容產生回覆建議（繁體中文、店家語氣）
4. WhatsApp 推播給你：評論內容＋AI 建議，你複製去 Google 回
5. 後台可看全部評論、改建議、一鍵複製、標記已回覆

## 上線步驟（Cloudflare）

1. Cloudflare Pages → Create → 連這個 GitHub repo，Build 設定都不用填（純靜態＋Functions），按 Deploy
2. 建 D1：Workers & Pages → D1 → Create database，取名 `review-helper-db`
3. 綁定：Pages 專案 → Settings → Functions → D1 database bindings → 新增，變數名填 `DB`，選 `review-helper-db`
4. 環境變數：同頁面 Environment Variables → 新增 `INGEST_SECRET`，值填一串亂碼（英數 20 字以上，自己記下來，後台管理密碼用得到）
5. 跑 migration：D1 → `review-helper-db` → Console，貼上 `migrations/0001_init.sql` 全文執行
6. 跑 seed：同一個 Console，貼上 `seed/seen_reviews.sql` 全文執行（把 2026-10-01 之前的 94 則標成已看過，避免誤報）
7. 重部署一次（Deployments → 最新一筆 → Retry），打開網址，應該看到「評論小幫手」後台

## 偵測排程（助理端）

- cron `review-watch`：每天 08:00–22:00 每 2 小時跑一次
- 流程：browser 開地圖連結讀最新 10 則 → POST /api/ingest（帶 x-ingest-secret）→ 有新增就產生 AI 建議 → POST /api/suggest → WhatsApp 推播
- 去重 key＝作者＋星數＋內文前 40 字（Google 的「幾天前」會漂移，不能當 key）

## AI 回覆建議規則

- 5 星無文字：簡短感謝＋歡迎再來
- 4–5 星有文字：針對提到的點具體回應＋感謝
- 3 星：感謝＋針對缺點說明會改進
- 1–2 星：先誠懇致歉、不辯解、說明會檢討改進、留客服專線邀請私下聯繫
- 抱怨改名：溫和說明品牌更新是為了提供更好服務，感謝長期支持
- 150 字內、繁體中文，結尾署名（設定頁可改）
- **鐵律：1–2 星一律人工審核後才能發，AI 只給建議**

## LINE 群組推播設定

1. 到 developers.line.biz，用你的 LINE 帳號登入
2. Create provider（取名如「評論小幫手」）→ Create channel → Messaging API，基本資料隨便填
3. 進 channel → Messaging API 分頁 → 發行 **Channel access token（長期）**，複製起來
4. 把這個官方帳號加為好友，**拉進你要推播的 LINE 群組**
5. 同一頁往下找到 Webhook settings：URL 填 `https://<你的Pages網址>/api/line-webhook`，開啟 **Use webhook**
6. 在群組裡講一句話（隨便什麼都行），系統會記下群組 ID
7. Cloudflare Pages → Settings → Environment Variables，新增：
   - `LINE_CHANNEL_ACCESS_TOKEN`＝步驟 3 的 token
   - `LINE_CHANNEL_SECRET`＝channel 的 Channel secret（在 Basic settings）
   - （`INGEST_SECRET` 沿用之前那組）
8. 重部署一次。偵測到新評論後，助理會呼叫 `/api/notify` 推到群組

注意：LINE 官方帳號每月免費推播 200 則，五甲店一個月約 30 則評論，夠用。

## API

| 方法 | 路徑 | 說明 |
|---|---|---|
| POST | /api/ingest | 寫入評論（需 secret，自動去重） |
| GET | /api/reviews?filter=pending | 評論列表＋建議 |
| POST | /api/suggest | 寫入 AI 建議（需 secret） |
| POST | /api/mark-replied | 標記已回覆（需 secret） |
| GET/POST | /api/settings | 商家設定 |

## 販售版 roadmap

- [ ] Google Business Profile API 正式串接（取代 browser 檢查，輪詢 15 分鐘）
- [ ] 商家 Google OAuth 登入＋多分店管理
- [ ] Worker 內直接呼叫 LLM 產生建議（目前由助理產生）
- [ ] LINE 推播（台灣店家都在 LINE 上）
- [ ] 一鍵發佈回覆到 Google（需商家授權）
- [ ] 月費制：NT$299–599／店／月
