import { loadEnv } from '../lib/env';
loadEnv();

import { ensureSchema, untranslatedArticles, updateTranslations } from '../lib/db';
import { translateEnabled, translateBatch, TRANSLATE_MAX_PER_RUN } from '../lib/translate';

async function main(): Promise<void> {
  await ensureSchema();

  if (!translateEnabled()) {
    console.log('未設定 RUNWAY_API_KEY，跳過翻譯。');
    return;
  }

  const t0 = Date.now();
  const maxPerRun = TRANSLATE_MAX_PER_RUN();
  const candidates = await untranslatedArticles(maxPerRun);

  console.log(`候選 ${candidates.length} 則…`);

  if (candidates.length === 0) {
    console.log('\n──────── 翻譯結果 ────────');
    console.log('候選則數：0');
    console.log('成功則數：0');
    console.log('失敗則數：0');
    console.log(`耗時    ：${((Date.now() - t0) / 1000).toFixed(1)} 秒`);
    return;
  }

  const results = await translateBatch(
    candidates.map((a) => ({ id: a.id, title: a.title, summary: a.summary })),
  );

  const rows = candidates
    .filter((a) => results.has(a.id))
    .map((a) => {
      const r = results.get(a.id)!;
      return { id: a.id, titleZh: r.titleZh, summaryZh: r.summaryZh };
    });

  const updatedCount = await updateTranslations(rows);
  const failed = candidates.length - rows.length;

  console.log('\n──────── 翻譯結果 ────────');
  console.log(`候選則數：${candidates.length}`);
  console.log(`成功則數：${rows.length}（實際更新 ${updatedCount} 則）`);
  console.log(`失敗則數：${failed}`);
  console.log(`耗時    ：${((Date.now() - t0) / 1000).toFixed(1)} 秒`);
}

try {
  await main();
  process.exit(0);
} catch (err) {
  console.error('翻譯失敗：', (err as Error).message);
  process.exit(1);
}
