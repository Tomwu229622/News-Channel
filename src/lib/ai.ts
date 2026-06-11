import Anthropic from '@anthropic-ai/sdk';

/** 是否啟用 AI（取決於有無 ANTHROPIC_API_KEY） */
export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface AiInput {
  title: string;
  summary: string;
  category: string;
}

export interface AiEnrichment {
  importance: number; // 0-100
  isMajor: boolean;
  aiSummary: string; // 繁體中文一句話
}

const MODEL = 'claude-haiku-4-5';
const BATCH_SIZE = 8;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

const SYSTEM = `你是一位資深新聞編輯，服務於台灣的對外貿易發展協會（TAITRA）。
你會收到一批新聞（含標題與摘要）。請針對每一則，判斷它對「關注台灣政經、國際情勢、財經貿易、科技產業」的讀者而言有多重要，並寫一句精煉的繁體中文摘要。

重要性評分標準（0-100）：
- 80-100：重大事件（戰爭、天災、重大政策、關稅變動、央行決策、重大產業/供應鏈消息）
- 50-79：值得關注的重要新聞
- 20-49：一般新聞
- 0-19：花邊、瑣事

只輸出 JSON，格式為陣列，每個元素對應一則新聞（順序相同）：
[{"i":0,"importance":85,"isMajor":true,"summary":"一句話摘要"}, ...]
isMajor 在 importance>=70 時為 true。不要輸出 JSON 以外的任何文字。`;

/** 對一批新聞做 AI 評分與摘要。回傳順序與輸入相同；個別失敗以 null 表示。 */
export async function aiEnrich(items: AiInput[]): Promise<(AiEnrichment | null)[]> {
  const results: (AiEnrichment | null)[] = new Array(items.length).fill(null);

  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    const batch = items.slice(start, start + BATCH_SIZE);
    try {
      const enriched = await enrichBatch(batch);
      for (let j = 0; j < enriched.length; j++) {
        results[start + j] = enriched[j];
      }
    } catch (err) {
      console.error('  ✗ [ai] 批次處理失敗，改用關鍵字判斷:', (err as Error).message);
    }
  }

  return results;
}

async function enrichBatch(batch: AiInput[]): Promise<(AiEnrichment | null)[]> {
  const userContent = batch
    .map((a, i) => `[${i}] 分類:${a.category}\n標題:${a.title}\n摘要:${a.summary || '(無)'}`)
    .join('\n\n');

  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: 'user', content: userContent }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const parsed = parseJsonArray(text);
  const out: (AiEnrichment | null)[] = new Array(batch.length).fill(null);
  for (const row of parsed) {
    const i = typeof row.i === 'number' ? row.i : -1;
    if (i < 0 || i >= batch.length) continue;
    const importance = clampScore(row.importance);
    out[i] = {
      importance,
      isMajor: Boolean(row.isMajor) || importance >= 70,
      aiSummary: String(row.summary ?? '').slice(0, 200),
    };
  }
  return out;
}

function clampScore(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseJsonArray(text: string): Array<Record<string, unknown>> {
  // 容錯：抓出文字中第一段 [ ... ]
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const v = JSON.parse(match[0]);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
