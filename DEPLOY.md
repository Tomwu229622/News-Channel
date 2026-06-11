# 雲端部署指南（全部免費）

把這個專案變成「全雲端、隨時可看」需要三個免費服務：

| 角色 | 服務 | 做什麼 |
|------|------|--------|
| 網站 | **Vercel**（Hobby 免費） | 你開網頁看新聞的地方 |
| 每小時排程 | **GitHub Actions**（免費） | 每小時跑蒐集、每天寄摘要 |
| 資料庫 | **Neon**（Postgres 免費） | 三者共用的新聞資料庫 |

> 為什麼排程不放 Vercel？因為 Vercel 免費方案的 Cron 一天只能跑一次，做不到每小時。

照以下順序做即可，全程不用寫程式。

---

## 步驟 1：把程式碼放上 GitHub

1. 到 https://github.com/new 建一個 repo（例如 `news-finder`，Private 或 Public 都行）。
2. 在專案資料夾執行（PowerShell）：

   ```powershell
   git init
   git add .
   git commit -m "News Finder 初版"
   git branch -M main
   git remote add origin https://github.com/<你的帳號>/news-finder.git
   git push -u origin main
   ```

   > `.env`、`node_modules`、`data/` 已被 `.gitignore` 排除，不會上傳，放心。

---

## 步驟 2：建立 Neon 資料庫

1. 到 https://neon.tech 用 GitHub 帳號登入（免費）。
2. 建立一個 Project（區域選離台灣近的，如 `Asia Pacific (Singapore)` 或 `US West`）。
3. 在專案首頁找到 **Connection string**，點「Copy」。它長得像：

   ```
   postgresql://用戶:密碼@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

4. **先在本機測一次**（確認連線與抓取都正常）：

   ```powershell
   Copy-Item .env.example .env
   ```

   用編輯器打開 `.env`，把 `DATABASE_URL=` 後面貼上剛剛複製的字串，存檔。然後：

   ```powershell
   npm run db:init    # 建立資料表
   npm run collect    # 抓一次新聞，應看到各來源 ✓ 與寫入筆數
   npm run dev        # 開 http://localhost:3000 確認看得到新聞
   ```

   看到新聞就代表雲端資料庫已就緒。

---

## 步驟 3：部署網站到 Vercel

1. 到 https://vercel.com 用 GitHub 帳號登入。
2. **Add New → Project**，選剛剛的 `news-finder` repo，按 **Import**。
3. 在 **Environment Variables** 加入：
   - `DATABASE_URL` = 步驟 2 的 Neon 連線字串
   - （選填）`ANTHROPIC_API_KEY` = 你的 Claude 金鑰（網站上「立即更新」按鈕會用到 AI）
4. 按 **Deploy**。完成後會給你一個網址（如 `https://news-finder-xxx.vercel.app`），打開就能看新聞。

> 進階：也可以在 Vercel 用 **Storage → Neon** 一鍵建立資料庫，它會自動把 `DATABASE_URL` 填好，省去手動複製。

---

## 步驟 4：設定 GitHub Actions 排程

排程程式（每小時蒐集、每天摘要）已經寫在 `.github/workflows/`，只要設定密鑰就會自動跑。

1. 在 GitHub repo 頁面：**Settings → Secrets and variables → Actions → New repository secret**。
2. 至少加入這一個：
   - `DATABASE_URL` = Neon 連線字串
3. 想啟用 AI 評分，再加：
   - `ANTHROPIC_API_KEY` = Claude 金鑰
4. 想讓每日摘要寄到 Teams 或 Email，再加（擇一）：
   - Teams：`TEAMS_WEBHOOK_URL`
   - Email：`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`DIGEST_EMAIL_TO`、`DIGEST_EMAIL_FROM`
5. 到 **Actions** 分頁，若提示啟用 workflow 就按啟用。
6. **馬上驗證**：點「蒐集新聞（每小時）」→ **Run workflow** 手動跑一次，綠勾代表成功；回 Vercel 網站重新整理就會看到新聞。

之後它就會每小時自動抓、每天 08:00（台北時間）出摘要。

---

## 完成後的樣子

```
每小時 ─▶ GitHub Actions 跑 collect ─▶ 寫入 Neon ─▶ Vercel 網站即時顯示
每天   ─▶ GitHub Actions 跑 digest  ─▶ 摘要寄到 Teams / Email
```

打開 Vercel 網址即可隨時隨地觀看，不必開自己的電腦。

---

## 常見問題

- **GitHub 排程沒跑？** 免費排程在尖峰可能延遲幾分鐘；另外 repo 連續 60 天沒有新 commit，排程會被自動停用，推一個 commit 即可恢復。
- **想改抓取頻率？** 編輯 `.github/workflows/collect.yml` 裡的 `cron`（例如每 30 分鐘 `*/30 * * * *`）。
- **想加沒有 RSS 的網站？** 在 `src/lib/sources.ts` 加 `scrape` 設定，並把 `collect.yml` 裡安裝 Playwright 的那行註解打開。
- **本機跟雲端會打架嗎？** 不會，兩邊連同一個 Neon，靠 `guid` 自動去重。
