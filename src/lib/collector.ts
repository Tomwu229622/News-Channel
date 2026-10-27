import { SOURCES } from './sources';
import { fetchRss } from './rss';
import { fetchScrapeSources } from './scrape';
import { classifyByKeywords, type ClassifyResult } from './classify';
import { aiEnabled, aiEnrich, type AiEnrichment } from './ai';
import { translateEnabled, translateBatch, needsTranslation, TRANSLATE_MAX_PER_RUN } from './translate';
import {
  existingGuids,
  insertArticles,
  purgeOlderThan,
  totalCount,
  ensureSchema,
  type InsertRow,
} from './db';
import type { RawArticle } from './types';

export interface CollectStats {
  startedAt: string;
  durationMs: number;
  fetched: number; // 抓到的總則數（去重前）
  fresh: number; // 全新（資料庫沒有的）
  inserted: number; // 實際寫入
  aiEnriched: number; // 經 AI 評分的則數
  major: number; // 判定為重大的新則數
  translated: number; // 經翻譯的則數
  purged: number; // 清除的過期新聞則數
  total: number; // 資料庫目前總數
}

interface Item {
  a: RawArticle;
  kw: ClassifyResult;
  ai?: AiEnrichment;
  translated?: { titleZh: string; summaryZh: string };
}

/** 新聞保留天數（讀 RETENTION_DAYS，預設 30；非正整數時退回 30）。需在函式內讀取，因 loadEnv() 晚於 import。 */
function retentionDays(): number {
  const n = Number(process.env.RETENTION_DAYS);
  return Number.isInteger(n) && n > 0 ? n : 30;
}

/** 執行一輪完整蒐集：抓取 → 去重 → 分類 → (可選)AI → 入庫 */
export async function collect(): Promise<CollectStats> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  await ensureSchema();

  // 1) RSS 來源並行抓取
  const rssSources = SOURCES.filter((s) => s.rss);
  const rssResults = await Promise.allSettled(rssSources.map((s) => fetchRss(s)));
  const raw: RawArticle[] = [];
  rssResults.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      raw.push(...r.value);
      console.log(`  ✓ [rss] ${rssSources[i].name}: ${r.value.length} 則`);
    } else {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      console.error(`  ✗ [rss] ${rssSources[i].name} 失敗: ${msg}`);
    }
  });

  // 2) Playwright 補強（沒有 RSS 的來源）
  raw.push(...(await fetchScrapeSources(SOURCES)));

  // 3) 去重：先去掉本批內重複，再用一次查詢濾掉資料庫已存在的
  //    超過保留天數的舊文不入庫（否則會每小時入庫又被清除，並浪費 AI/翻譯額度）
  const keepDays = retentionDays();
  const cutoffIso = new Date(Date.now() - keepDays * 86400e3).toISOString();
  const seen = new Set<string>();
  const batch: RawArticle[] = [];
  for (const a of raw) {
    if (a.publishedAt < cutoffIso) continue;
    if (seen.has(a.guid)) continue;
    seen.add(a.guid);
    batch.push(a);
  }
  const existing = await existingGuids(batch.map((a) => a.guid));
  const fresh = batch.filter((a) => !existing.has(a.guid));

  // 4) 關鍵字分類（一律執行，免費）
  const items: Item[] = fresh.map((a) => ({ a, kw: classifyByKeywords(a.title, a.summary) }));

  // 5) AI 評分與摘要（可選、限量以控制成本）
  let aiEnriched = 0;
  if (aiEnabled() && items.length > 0) {
    const maxPerRun = Number(process.env.AI_MAX_PER_RUN ?? 40);
    const candidates = [...items]
      .sort((x, y) => y.kw.importance - x.kw.importance)
      .slice(0, maxPerRun);
    console.log(`  • [ai] 對 ${candidates.length} 則進行 AI 評分…`);
    const enrichments = await aiEnrich(
      candidates.map(({ a }) => ({ title: a.title, summary: a.summary, category: a.category })),
    );
    candidates.forEach((c, idx) => {
      const e = enrichments[idx];
      if (e) {
        c.ai = e;
        aiEnriched++;
      }
    });
  }

  // 6) 翻譯（可選、限量以控制成本，優先翻譯重要性較高的英文新聞）
  let translated = 0;
  if (translateEnabled() && items.length > 0) {
    const maxPerRun = TRANSLATE_MAX_PER_RUN();
    const importanceOf = (item: Item) => (item.ai ? item.ai.importance : item.kw.importance);
    const candidates = items
      .filter((item) => needsTranslation(item.a.title))
      .map((item, idx) => ({ idx, item }))
      .sort((x, y) => importanceOf(y.item) - importanceOf(x.item))
      .slice(0, maxPerRun);

    if (candidates.length > 0) {
      console.log(`  • [translate] 對 ${candidates.length} 則進行翻譯…`);
      const results = await translateBatch(
        candidates.map(({ idx, item }) => ({ id: idx, title: item.a.title, summary: item.a.summary })),
      );
      for (const { idx, item } of candidates) {
        const r = results.get(idx);
        if (r) {
          item.translated = r;
          translated++;
        }
      }
    }
  }

  // 7) 批次入庫
  const insertRows: InsertRow[] = items.map((item) => ({
    article: item.a,
    aiSummary: item.ai ? item.ai.aiSummary : null,
    importance: item.ai ? item.ai.importance : item.kw.importance,
    isMajor: item.ai ? item.ai.isMajor : item.kw.isMajor,
    keywords: item.kw.keywords,
    titleZh: item.translated ? item.translated.titleZh : null,
    summaryZh: item.translated ? item.translated.summaryZh : null,
  }));
  const { inserted, major } = await insertArticles(insertRows);

  // 8) 清除超過保留天數的舊新聞（失敗只警告，不中斷蒐集）
  let purged = 0;
  try {
    purged = await purgeOlderThan(keepDays);
  } catch (err) {
    console.warn(`  ! [purge] 清除過期新聞失敗: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    startedAt,
    durationMs: Date.now() - t0,
    fetched: raw.length,
    fresh: fresh.length,
    inserted,
    aiEnriched,
    major,
    translated,
    purged,
    total: await totalCount(),
  };
}
