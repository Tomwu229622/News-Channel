import type { Browser } from 'playwright';
import type { RawArticle, SourceDef } from './types';

/**
 * 用 Playwright 抓取沒有 RSS 的來源。
 * 所有 scrape 來源共用一個瀏覽器實例，抓完即關閉。
 *
 * 注意：playwright 以「動態 import」載入，且只在確實有 scrape 來源時才執行。
 * 否則靜態 import 會把整包 playwright 拉進 Vercel serverless function，
 * 在沒有瀏覽器的環境 cold start 即失敗，導致 /api/collect 回傳 HTML 錯誤頁。
 * 目前所有來源皆為 RSS，scrape 僅在 GitHub Actions（已裝瀏覽器）才會用到。
 */
export async function fetchScrapeSources(sources: SourceDef[]): Promise<RawArticle[]> {
  const scrapeSources = sources.filter((s) => s.scrape);
  if (scrapeSources.length === 0) return [];

  const { chromium } = await import('playwright');

  let browser: Browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    console.error(
      '  ✗ [scrape] 無法啟動瀏覽器，請先執行 `npx playwright install chromium`。',
      (err as Error).message,
    );
    return [];
  }

  const out: RawArticle[] = [];
  try {
    for (const source of scrapeSources) {
      try {
        const items = await scrapeOne(browser, source);
        out.push(...items);
        console.log(`  ✓ [scrape] ${source.name}: ${items.length} 則`);
      } catch (err) {
        console.error(`  ✗ [scrape] ${source.name} 失敗:`, (err as Error).message);
      }
    }
  } finally {
    await browser.close();
  }
  return out;
}

async function scrapeOne(browser: Browser, source: SourceDef): Promise<RawArticle[]> {
  const cfg = source.scrape!;
  const page = await browser.newPage();
  try {
    await page.goto(cfg.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector(cfg.itemSelector, { timeout: 10000 }).catch(() => {});

    const raw = await page.$$eval(
      cfg.itemSelector,
      (nodes, sel) => {
        return nodes.map((node) => {
          const titleEl = sel.titleSelector
            ? node.querySelector(sel.titleSelector)
            : node;
          const linkEl = sel.linkSelector
            ? (node.querySelector(sel.linkSelector) as HTMLAnchorElement | null)
            : (node.querySelector('a') as HTMLAnchorElement | null) ??
              (titleEl?.closest('a') as HTMLAnchorElement | null);
          return {
            title: titleEl?.textContent?.trim() ?? '',
            href: linkEl?.getAttribute('href') ?? '',
          };
        });
      },
      { titleSelector: cfg.titleSelector, linkSelector: cfg.linkSelector },
    );

    const base = new URL(cfg.url);
    const now = new Date().toISOString();
    const articles: RawArticle[] = [];
    for (const { title, href } of raw) {
      if (!title || !href) continue;
      const link = new URL(href, base).toString();
      articles.push({
        guid: link,
        title,
        link,
        source: source.name,
        category: source.category,
        summary: '',
        publishedAt: now,
      });
    }
    return articles;
  } finally {
    await page.close();
  }
}
