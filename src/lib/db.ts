import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import type { Category, RawArticle, StoredArticle } from './types';

// ── 連線（延遲初始化，缺少 DATABASE_URL 時給出清楚錯誤） ──────────
let _sql: NeonQueryFunction<false, false> | null = null;
function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        '缺少 DATABASE_URL 環境變數。請在 .env（本機）或部署平台的環境變數中，' +
          '填入 Neon Postgres 連線字串。詳見 README「部署到雲端」章節。',
      );
    }
    _sql = neon(url);
  }
  return _sql;
}

// ── 建表（每個程序只跑一次，後續 await 立即返回） ──────────────────
let schemaReady: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  if (!schemaReady) schemaReady = initSchema();
  return schemaReady;
}

async function initSchema(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS articles (
      id           SERIAL PRIMARY KEY,
      guid         TEXT UNIQUE NOT NULL,
      title        TEXT NOT NULL,
      link         TEXT NOT NULL,
      source       TEXT NOT NULL,
      category     TEXT NOT NULL,
      summary      TEXT NOT NULL DEFAULT '',
      ai_summary   TEXT,
      importance   INTEGER,
      is_major     INTEGER NOT NULL DEFAULT 0,
      keywords     TEXT NOT NULL DEFAULT '[]',
      published_at TEXT NOT NULL,
      fetched_at   TEXT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_published ON articles (published_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_category ON articles (category)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_major ON articles (is_major)`;
}

// ── 型別轉換 ──────────────────────────────────────────────────
function rowToArticle(r: Record<string, unknown>): StoredArticle {
  return {
    id: Number(r.id),
    guid: r.guid as string,
    title: r.title as string,
    link: r.link as string,
    source: r.source as string,
    category: r.category as Category,
    summary: (r.summary as string) ?? '',
    aiSummary: (r.ai_summary as string | null) ?? null,
    importance: r.importance === null ? null : Number(r.importance),
    isMajor: Number(r.is_major),
    keywords: safeParseKeywords(r.keywords as string),
    publishedAt: r.published_at as string,
    fetchedAt: r.fetched_at as string,
  };
}

function safeParseKeywords(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// ── 去重：回傳「資料庫中已存在」的 guid 集合 ──────────────────────
export async function existingGuids(guids: string[]): Promise<Set<string>> {
  if (guids.length === 0) return new Set();
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql.query('SELECT guid FROM articles WHERE guid = ANY($1)', [
    guids,
  ])) as { guid: string }[];
  return new Set(rows.map((r) => r.guid));
}

export interface InsertRow {
  article: RawArticle;
  aiSummary: string | null;
  importance: number | null;
  isMajor: boolean;
  keywords: string[];
}

/** 批次寫入，guid 衝突則略過。回傳實際寫入數與其中重大則數。 */
export async function insertArticles(
  rows: InsertRow[],
): Promise<{ inserted: number; major: number }> {
  await ensureSchema();
  if (rows.length === 0) return { inserted: 0, major: 0 };

  const sql = getSql();
  const now = new Date().toISOString();
  const COLS = 12;
  const CHUNK = 100;
  let inserted = 0;
  let major = 0;

  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK);
    const placeholders = chunk
      .map((_, idx) => {
        const b = idx * COLS;
        return `(${Array.from({ length: COLS }, (_, k) => `$${b + k + 1}`).join(',')})`;
      })
      .join(',');

    const params: unknown[] = [];
    for (const r of chunk) {
      params.push(
        r.article.guid,
        r.article.title,
        r.article.link,
        r.article.source,
        r.article.category,
        r.article.summary,
        r.aiSummary,
        r.importance,
        r.isMajor ? 1 : 0,
        JSON.stringify(r.keywords),
        r.article.publishedAt,
        now,
      );
    }

    const text =
      `INSERT INTO articles ` +
      `(guid,title,link,source,category,summary,ai_summary,importance,is_major,keywords,published_at,fetched_at) ` +
      `VALUES ${placeholders} ON CONFLICT (guid) DO NOTHING RETURNING is_major`;

    const res = (await sql.query(text, params)) as { is_major: number }[];
    inserted += res.length;
    major += res.filter((x) => Number(x.is_major) === 1).length;
  }

  return { inserted, major };
}

// ── 查詢 ──────────────────────────────────────────────────────
export interface QueryOptions {
  category?: Category;
  majorOnly?: boolean;
  keyword?: string;
  limit?: number;
  sinceIso?: string;
}

export async function queryArticles(opts: QueryOptions = {}): Promise<StoredArticle[]> {
  await ensureSchema();
  const sql = getSql();

  const cond: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (opts.category) {
    cond.push(`category = $${i++}`);
    params.push(opts.category);
  }
  if (opts.majorOnly) {
    cond.push('is_major = 1');
  }
  if (opts.keyword) {
    cond.push(`(title ILIKE $${i} OR summary ILIKE $${i} OR keywords ILIKE $${i})`);
    params.push(`%${opts.keyword}%`);
    i++;
  }
  if (opts.sinceIso) {
    cond.push(`published_at >= $${i++}`);
    params.push(opts.sinceIso);
  }

  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  params.push(opts.limit ?? 200);
  const text = `SELECT * FROM articles ${where} ORDER BY published_at DESC LIMIT $${i}`;

  const rows = (await sql.query(text, params)) as Record<string, unknown>[];
  return rows.map(rowToArticle);
}

export async function countByCategory(): Promise<Record<string, number>> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT category, COUNT(*)::int AS n FROM articles GROUP BY category
  `) as { category: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.category, Number(r.n)]));
}

export async function totalCount(): Promise<number> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`SELECT COUNT(*)::int AS n FROM articles`) as { n: number }[];
  return Number(rows[0]?.n ?? 0);
}
