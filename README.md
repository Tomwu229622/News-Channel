# 📰 News Finder — 重大新聞蒐集器

每小時自動蒐集 **台灣本地 / 國際 / 財經貿易 / 科技產業** 四大類重要新聞，
以 RSS/API 為主、Playwright 補強，存入本機 SQLite，並提供網頁瀏覽、關鍵字篩選、
AI 重要性評分與每日摘要推播。

---

## 功能

- ⏱️ **每小時自動蒐集**（可調整頻率）
- 📡 **RSS/API 為主**：18 個來源（中央社、自由時報、ETtoday、BBC、Guardian、NYT、鉅亨網、經濟日報、iThome、TechNews、TechCrunch、The Verge…）
- 🤖 **Playwright 補強**：沒有 RSS 的網站可用瀏覽器自動化抓取
- 🏷️ **關鍵字分類與篩選**：依「關稅、半導體、台積電、升息…」等關鍵字標記與搜尋
- 🧠 **AI 重要性評分與摘要**（選填）：用 Claude Haiku 判斷「重大」並生成一句話摘要
- 🌐 **英文新聞自動翻成繁體中文**（選填，走公司 gateway）
- 🗃️ **歷史資料庫（Neon Postgres）**：自動去重、可回查，本機與雲端共用
- 📨 **每日摘要推播**（選填）：Teams Webhook / Email，未設定則印在 console
- 🌐 **網頁介面**：分類、重大篩選、關鍵字搜尋、一鍵手動更新

---

## 環境需求

- Node.js 22+（建議 24）
- 一個免費 [Neon](https://neon.tech) Postgres 資料庫（本機與雲端共用，申請見 [DEPLOY.md](./DEPLOY.md)）
- Windows / macOS / Linux 皆可

## 快速開始（本機）

```powershell
npm install

# 設定資料庫連線：複製範本後，把 .env 裡的 DATABASE_URL 填上 Neon 連線字串
Copy-Item .env.example .env

npm run db:init    # 建立資料表
npm run collect    # 抓一次新聞
npm run dev        # 開 http://localhost:3000
```

> 若要使用 Playwright 補強沒有 RSS 的來源，另外執行一次 `npx playwright install chromium`。

---

## 使用方式

### 1. 啟動網站

```powershell
npm run dev
```

開啟 http://localhost:3000 — 可瀏覽、分類、搜尋關鍵字、只看重大、右上角「立即更新」手動抓取。

### 2. 啟動每小時自動排程

另開一個終端機：

```powershell
npm run worker
```

排程器會：
- 啟動時先抓一次
- 之後每小時整點抓取（`COLLECT_CRON`）
- 每天 08:00 產生每日摘要（`DIGEST_CRON`）

> 想讓它常駐、開機自動啟動，可用 Windows「工作排程器」設定開機執行 `npm run worker`，
> 或用 [pm2](https://pm2.keymetrics.io/) 等程序管理工具。

### 3. 手動指令

```powershell
npm run collect   # 手動抓一次
npm run translate # 手動補翻既有未翻譯的英文新聞
npm run digest    # 手動產生並推播每日摘要
```

---

## 設定（.env）

| 變數 | 說明 |
|------|------|
| `DATABASE_URL` | **（必填）** Neon Postgres 連線字串，本機與雲端共用 |
| `ANTHROPIC_API_KEY` | 填入後啟用 Claude AI 重要性評分與摘要；不填則用關鍵字判斷 |
| `AI_MAX_PER_RUN` | 每次蒐集最多送幾則給 AI（預設 40，控制成本） |
| `RUNWAY_API_KEY` | 填入後啟用英文新聞自動翻譯（走公司 LLM gateway）；不填則不翻譯 |
| `RUNWAY_BASE_URL` | 公司 LLM gateway 位址（預設 `https://runway.taitra.ai`） |
| `RUNWAY_MODEL` | 逗號分隔的模型清單，依序嘗試（預設 `claude-haiku,gpt-5-chat`） |
| `TRANSLATE_MAX_PER_RUN` | 每次蒐集最多翻幾則（預設 80，控制成本） |
| `TEAMS_WEBHOOK_URL` | Teams 傳入 Webhook，設定後每日摘要推播到 Teams |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `DIGEST_EMAIL_TO` / `DIGEST_EMAIL_FROM` | Email 推播設定 |
| `COLLECT_CRON` | 蒐集排程（預設 `0 * * * *`，每小時） |
| `DIGEST_CRON` | 摘要排程（預設 `0 8 * * *`，每天 08:00） |

推播優先序：**Teams → Email → console**（都沒設定就只印在畫面）。

---

## 自訂

### 新增/移除新聞來源

編輯 `src/lib/sources.ts`。優先用 RSS：

```ts
{ name: '來源名稱', category: '科技產業', rss: 'https://example.com/feed' }
```

沒有 RSS 的網站，用 Playwright 補強：

```ts
{
  name: '某網站',
  category: '國際',
  scrape: {
    url: 'https://example.com/news',
    itemSelector: 'article.item',   // 每則新聞容器
    titleSelector: 'h2 a',          // 標題（相對 item）
    // linkSelector 省略時自動取容器內第一個 <a>
  },
}
```

某個來源抓取失敗不會影響其他來源。

### 調整「重大新聞」判斷

編輯 `src/lib/classify.ts` 的 `KEYWORD_WEIGHTS`（關鍵字權重）與 `MAJOR_THRESHOLD`（重大門檻）。

---

## 專案結構

```
src/
  lib/
    types.ts       型別定義
    sources.ts     新聞來源清單  ← 想加來源改這裡
    db.ts          Neon Postgres 存取（@neondatabase/serverless）
    rss.ts         RSS 抓取
    scrape.ts      Playwright 補強抓取
    classify.ts    關鍵字分類與重大判斷  ← 想調權重改這裡
    ai.ts          Claude AI 評分與摘要
    translate.ts   英文新聞翻譯（走公司 LLM gateway）
    collector.ts   蒐集編排（抓取→去重→分類→AI→翻譯→入庫）
    digest.ts      每日摘要生成與推播
    env.ts         載入 .env（給 worker/scripts 用）
  scripts/
    collect-once.ts   手動蒐集
    translate-once.ts 手動補翻既有未翻譯新聞
    digest-once.ts    手動摘要
    init-db.ts        建立資料表
  worker.ts        本機 node-cron 排程器
  app/             Next.js 網站（App Router）
    page.tsx       新聞列表頁
    api/news       JSON API
    api/collect    手動觸發蒐集
.github/workflows/
  collect.yml      雲端每小時蒐集（GitHub Actions）
  digest.yml       雲端每日摘要（GitHub Actions）
```

---

## 部署到雲端（全部免費）

把網站放上 Vercel、排程交給 GitHub Actions、資料庫用 Neon，
即可全雲端、隨時隨地觀看，不必開自己的電腦。

👉 完整步驟見 **[DEPLOY.md](./DEPLOY.md)**

> 本機的 `npm run worker`（node-cron）與雲端的 GitHub Actions 是兩種排程方式，擇一即可：
> 自己電腦長開就用 worker；要全雲端就用 GitHub Actions。
