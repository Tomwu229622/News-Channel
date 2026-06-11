import type { SourceDef } from './types';

/**
 * 新聞來源清單。
 *
 * 原則：優先使用 RSS（穩定、省資源）；只有沒有公開 RSS 的來源才用 `scrape`（Playwright）。
 * 想新增/移除來源，直接改這個檔案即可。某個來源抓取失敗不會影響其他來源。
 */
export const SOURCES: SourceDef[] = [
  // ── 台灣本地 ──────────────────────────────────────────
  { name: '中央社 政治', category: '台灣本地', rss: 'https://feeds.feedburner.com/rsscna/politics' },
  { name: '中央社 社會', category: '台灣本地', rss: 'https://feeds.feedburner.com/rsscna/social' },
  { name: '自由時報 即時', category: '台灣本地', rss: 'https://news.ltn.com.tw/rss/all.xml' },
  { name: 'ETtoday 即時', category: '台灣本地', rss: 'https://feeds.feedburner.com/ettoday/realtime' },

  // ── 國際 ──────────────────────────────────────────────
  { name: 'BBC 中文', category: '國際', rss: 'https://feeds.bbci.co.uk/zhongwen/trad/rss.xml' },
  { name: 'BBC World', category: '國際', rss: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'The Guardian World', category: '國際', rss: 'https://www.theguardian.com/world/rss' },
  { name: 'NYT World', category: '國際', rss: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { name: '中央社 國際', category: '國際', rss: 'https://feeds.feedburner.com/rsscna/intworld' },

  // ── 財經貿易 ──────────────────────────────────────────
  { name: '經濟日報 要聞', category: '財經貿易', rss: 'https://money.udn.com/rssfeed/news/1001/5590?ch=money' },
  { name: '鉅亨網 頭條', category: '財經貿易', rss: 'https://news.cnyes.com/rss/v1/news/category/headline' },
  { name: '中央社 財經', category: '財經貿易', rss: 'https://feeds.feedburner.com/rsscna/finance' },
  { name: 'BBC Business', category: '財經貿易', rss: 'https://feeds.bbci.co.uk/news/business/rss.xml' },

  // ── 科技產業 ──────────────────────────────────────────
  { name: 'iThome', category: '科技產業', rss: 'https://www.ithome.com.tw/rss' },
  { name: 'TechNews 科技新報', category: '科技產業', rss: 'https://technews.tw/feed/' },
  { name: '中央社 科技', category: '科技產業', rss: 'https://feeds.feedburner.com/rsscna/technology' },
  { name: 'TechCrunch', category: '科技產業', rss: 'https://techcrunch.com/feed/' },
  { name: 'The Verge', category: '科技產業', rss: 'https://www.theverge.com/rss/index.xml' },

  // ── Playwright 補強範例（沒有 RSS 時可比照新增） ─────────
  // {
  //   name: '某無 RSS 網站',
  //   category: '科技產業',
  //   scrape: {
  //     url: 'https://example.com/news',
  //     itemSelector: 'article.news-item',
  //     titleSelector: 'h2 a',
  //   },
  // },
];
