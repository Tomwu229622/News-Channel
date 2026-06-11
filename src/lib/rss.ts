import Parser from 'rss-parser';
import type { RawArticle, SourceDef } from './types';

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NewsFinder/0.1 (+local news aggregator)',
  },
});

function clean(text: string | undefined, max = 300): string {
  if (!text) return '';
  const stripped = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped.length > max ? `${stripped.slice(0, max)}…` : stripped;
}

/** 從單一 RSS 來源抓取新聞。失敗時拋出錯誤，由呼叫端 catch。 */
export async function fetchRss(source: SourceDef): Promise<RawArticle[]> {
  if (!source.rss) return [];
  const feed = await parser.parseURL(source.rss);
  const articles: RawArticle[] = [];

  for (const item of feed.items) {
    const link = item.link?.trim();
    const title = item.title?.trim();
    if (!link || !title) continue;

    const guid = (item.guid?.trim() || link).slice(0, 500);
    const publishedAt = item.isoDate
      ? item.isoDate
      : item.pubDate
        ? new Date(item.pubDate).toISOString()
        : new Date().toISOString();

    articles.push({
      guid,
      title,
      link,
      source: source.name,
      category: source.category,
      summary: clean(item.contentSnippet || item.content || item.summary),
      publishedAt,
    });
  }

  return articles;
}
