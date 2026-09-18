/**
 * 英文新聞 → 繁體中文（台灣用語）翻譯，走公司 LLM gateway（runway.taitra.ai）。
 *
 * 端點與 OpenAI 相容（/v1/chat/completions），用 Bearer token 認證。
 * RUNWAY_MODEL 是逗號分隔的模型清單，依序嘗試：某個模型失敗（非 2xx、逾時、
 * 或回傳內容解析失敗）就換下一個模型重試同一批；全部失敗則該批放棄，不拋例外。
 */

const REQUEST_TIMEOUT_MS = 60_000;
const CHUNK_SIZE = 20;
const MAX_SUMMARY_CHARS = 600;

const CJK_RE = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/;

const SYSTEM_PROMPT =
  '你是新聞翻譯，把英文新聞標題與摘要翻成台灣慣用的繁體中文，' +
  '專有名詞用台灣媒體常見譯法（例：Fed→聯準會、Nvidia→輝達、TSMC→台積電），' +
  '數字與英文縮寫可保留。';

/** 是否啟用翻譯（取決於有無 RUNWAY_API_KEY） */
export function translateEnabled(): boolean {
  return Boolean(process.env.RUNWAY_API_KEY);
}

/** 每次蒐集最多翻幾則（控制成本），讀 env，預設 80。以函式形式提供，避免 module 載入時
 *  （在 .env 尚未載入前）就把值定死。 */
export function TRANSLATE_MAX_PER_RUN(): number {
  const n = Number(process.env.TRANSLATE_MAX_PER_RUN ?? 80);
  return Number.isFinite(n) && n > 0 ? n : 80;
}

/** 標題不含任何 CJK 字元且非空，才算需要翻譯 */
export function needsTranslation(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return !CJK_RE.test(t);
}

export interface TranslateItem {
  id: string | number;
  title: string;
  summary: string;
}

export interface TranslateResult {
  titleZh: string;
  summaryZh: string;
}

/** 批次翻譯：內部自動切成每批最多 20 則。回傳 id → 翻譯結果的 Map；缺的 id 視為未翻譯。 */
export async function translateBatch(
  items: TranslateItem[],
): Promise<Map<string | number, TranslateResult>> {
  const out = new Map<string | number, TranslateResult>();
  if (!translateEnabled() || items.length === 0) return out;

  const models = (process.env.RUNWAY_MODEL || 'claude-haiku,gpt-5-chat')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (models.length === 0) return out;

  for (let start = 0; start < items.length; start += CHUNK_SIZE) {
    const chunk = items.slice(start, start + CHUNK_SIZE);
    await translateChunk(chunk, models, out);
  }

  return out;
}

async function translateChunk(
  chunk: TranslateItem[],
  models: string[],
  out: Map<string | number, TranslateResult>,
): Promise<void> {
  const payload = chunk.map((it) => ({
    id: it.id,
    title: it.title,
    summary: (it.summary || '').slice(0, MAX_SUMMARY_CHARS),
  }));
  const userPrompt =
    JSON.stringify(payload) +
    '\n\n只回傳 JSON 陣列，每個元素 {"id":..., "title_zh":..., "summary_zh":...}，' +
    '順序與 id 對應，不要加任何說明文字或 markdown code fence。';
  const maxTokens = Math.min(8000, chunk.length * 300 + 500);

  let parsed: Array<Record<string, unknown>> | null = null;
  for (const model of models) {
    const text = await callChatCompletion(model, userPrompt, maxTokens);
    if (text === null) continue;
    parsed = parseTranslationJson(text);
    if (parsed) break;
    console.warn(`  ✗ [translate] 模型 ${model} 回傳內容無法解析，改用下一個模型`);
  }

  if (!parsed) {
    console.warn(`  ✗ [translate] 這批 ${chunk.length} 則全部模型都失敗，放棄翻譯`);
    return;
  }

  const byId = new Map(chunk.map((it) => [String(it.id), it] as const));
  for (const row of parsed) {
    const src = byId.get(String(row.id));
    if (!src) continue;
    const titleZh = typeof row.title_zh === 'string' ? row.title_zh.trim() : '';
    if (!titleZh) continue; // 標題翻譯缺失視為未翻譯
    const summaryZh = typeof row.summary_zh === 'string' ? row.summary_zh.trim() : '';
    out.set(src.id, { titleZh, summaryZh });
  }
}

async function callChatCompletion(
  model: string,
  userPrompt: string,
  maxTokens: number,
): Promise<string | null> {
  const baseUrl = process.env.RUNWAY_BASE_URL || 'https://runway.taitra.ai';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`  ✗ [translate] 模型 ${model} 回應 ${res.status}，改用下一個模型`);
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  ✗ [translate] 模型 ${model} 呼叫失敗（${msg}），改用下一個模型`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseTranslationJson(text: string): Array<Record<string, unknown>> | null {
  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) cleaned = fence[1].trim();

  try {
    const v = JSON.parse(cleaned);
    return Array.isArray(v) ? v : null;
  } catch {
    // 容錯：抓出文字中第一段 [ ... ] 再試一次
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return null;
    try {
      const v = JSON.parse(match[0]);
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  }
}
