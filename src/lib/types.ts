export type Category = '台灣本地' | '國際' | '財經貿易' | '科技產業';

export const CATEGORIES: Category[] = ['台灣本地', '國際', '財經貿易', '科技產業'];

/** 新聞來源定義：優先用 RSS，沒有 RSS 的來源才用 Playwright 補強 */
export interface SourceDef {
  name: string;
  category: Category;
  /** RSS / Atom feed 網址（首選） */
  rss?: string;
  /** 沒有 RSS 時，用 Playwright 抓取的設定 */
  scrape?: {
    url: string;
    /** 每則新聞的容器選擇器 */
    itemSelector: string;
    /** 標題選擇器（相對於 item） */
    titleSelector: string;
    /** 連結選擇器（相對於 item），預設取 item 內第一個 <a> */
    linkSelector?: string;
  };
}

/** 蒐集到、尚未存入資料庫的原始新聞 */
export interface RawArticle {
  guid: string;
  title: string;
  link: string;
  source: string;
  category: Category;
  summary: string;
  publishedAt: string; // ISO 8601
}

/** 資料庫中的一筆新聞 */
export interface StoredArticle {
  id: number;
  guid: string;
  title: string;
  link: string;
  source: string;
  category: Category;
  summary: string;
  aiSummary: string | null;
  importance: number | null; // 0-100
  isMajor: number; // 0 / 1
  keywords: string[]; // 命中的關鍵字
  titleZh: string | null; // 翻譯後標題（繁體中文）
  summaryZh: string | null; // 翻譯後摘要（繁體中文）
  publishedAt: string;
  fetchedAt: string;
}
