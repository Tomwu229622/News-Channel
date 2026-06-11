import { type NextRequest, NextResponse } from 'next/server';
import { queryArticles } from '@/lib/db';
import { CATEGORIES, type Category } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** JSON API：可供其他程式/前端取用新聞資料 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = sp.get('category') as Category | null;
  const articles = await queryArticles({
    category: category && CATEGORIES.includes(category) ? category : undefined,
    keyword: sp.get('keyword') ?? undefined,
    majorOnly: sp.get('major') === '1',
    limit: Math.min(Number(sp.get('limit') ?? 200) || 200, 500),
  });
  return NextResponse.json({ count: articles.length, articles });
}
