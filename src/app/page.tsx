import { queryArticles, countByCategory, totalCount } from '@/lib/db';
import { CATEGORIES, type Category } from '@/lib/types';
import RefreshButton from './RefreshButton';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '剛剛';
  if (m < 60) return `${m} 分鐘前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小時前`;
  return `${Math.floor(h / 24)} 天前`;
}

/** 絕對時間，強制用 Asia/Taipei 時區（伺服器可能是 UTC，不能用本地時間）。
 * 今年：MM/DD HH:mm；非今年：YYYY/MM/DD HH:mm。 */
function absTime(iso: string): string {
  const fmt = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const partsOf = (d: Date) => {
    const parts = fmt.formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return {
      year: get('year'),
      month: get('month'),
      day: get('day'),
      hour: get('hour'),
      minute: get('minute'),
    };
  };

  const p = partsOf(new Date(iso));
  const nowYear = partsOf(new Date()).year;

  if (p.year === nowYear) {
    return `${p.month}/${p.day} ${p.hour}:${p.minute}`;
  }
  return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}`;
}

function buildHref(base: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const category = str(sp.category) as Category | undefined;
  const keyword = str(sp.keyword)?.trim() || undefined;
  const majorOnly = str(sp.major) === '1';

  const [articles, counts, total] = await Promise.all([
    queryArticles({
      category: category && CATEGORIES.includes(category) ? category : undefined,
      keyword,
      majorOnly,
      limit: 200,
    }),
    countByCategory(),
    totalCount(),
  ]);

  return (
    <main className="container">
      <header className="header">
        <div>
          <h1>📰 重大新聞蒐集器</h1>
          <p className="subtitle">
            每小時自動蒐集 · 資料庫共 <strong>{total}</strong> 則新聞
          </p>
        </div>
        <RefreshButton />
      </header>

      {/* 分類列 */}
      <nav className="tabs">
        <a className={`tab ${!category ? 'active' : ''}`} href={buildHref({ keyword, major: majorOnly ? '1' : undefined })}>
          全部
        </a>
        {CATEGORIES.map((c) => (
          <a
            key={c}
            className={`tab ${category === c ? 'active' : ''}`}
            href={buildHref({ category: c, keyword, major: majorOnly ? '1' : undefined })}
          >
            {c} <span className="count">{counts[c] ?? 0}</span>
          </a>
        ))}
      </nav>

      {/* 篩選列 */}
      <div className="filters">
        <form className="search" action="/" method="get">
          {category && <input type="hidden" name="category" value={category} />}
          {majorOnly && <input type="hidden" name="major" value="1" />}
          <input
            type="text"
            name="keyword"
            placeholder="搜尋關鍵字（如：關稅、半導體、台積電）"
            defaultValue={keyword ?? ''}
          />
          <button type="submit">搜尋</button>
        </form>
        <a
          className={`major-toggle ${majorOnly ? 'on' : ''}`}
          href={buildHref({ category, keyword, major: majorOnly ? undefined : '1' })}
        >
          {majorOnly ? '★ 只看重大' : '☆ 只看重大'}
        </a>
      </div>

      {/* 新聞列表 */}
      <section className="list">
        {articles.length === 0 ? (
          <div className="empty">
            目前沒有符合條件的新聞。點右上角「立即更新」抓取，或執行 <code>npm run collect</code>。
          </div>
        ) : (
          articles.map((a) => (
            <article key={a.id} className={`card ${a.isMajor ? 'major' : ''}`}>
              <div className="card-meta">
                <span className={`cat cat-${CATEGORIES.indexOf(a.category)}`}>{a.category}</span>
                <span className="source">{a.source}</span>
                <span className="time">
                  {absTime(a.publishedAt)} · {timeAgo(a.publishedAt)}
                </span>
                {a.importance !== null && (
                  <span className={`score ${a.isMajor ? 'high' : ''}`}>重要性 {a.importance}</span>
                )}
                {a.isMajor && <span className="badge">重大</span>}
              </div>
              <h2 className="card-title">
                <a href={a.link} target="_blank" rel="noopener noreferrer">
                  {a.titleZh || a.title}
                </a>
                {a.titleZh && <div className="card-title-original">{a.title}</div>}
              </h2>
              {(a.aiSummary || a.summaryZh || a.summary) && (
                <p className="card-summary">{a.aiSummary || a.summaryZh || a.summary}</p>
              )}
              {a.keywords.length > 0 && (
                <div className="chips">
                  {a.keywords.map((k) => (
                    <a key={k} className="chip" href={buildHref({ keyword: k })}>
                      #{k}
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))
        )}
      </section>

      <footer className="footer">
        顯示最新 {articles.length} 則 · News Finder
      </footer>
    </main>
  );
}
