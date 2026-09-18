import { loadEnv } from '../lib/env';
loadEnv();

import { collect } from '../lib/collector';

console.log('開始蒐集新聞…\n');
const s = await collect();

console.log('\n──────── 蒐集結果 ────────');
console.log(`抓取總數  ：${s.fetched}`);
console.log(`全新則數  ：${s.fresh}`);
console.log(`寫入資料庫：${s.inserted}`);
console.log(`重大新聞  ：${s.major}`);
console.log(`AI 評分   ：${s.aiEnriched}`);
console.log(`翻譯則數  ：${s.translated}`);
console.log(`資料庫總數：${s.total}`);
console.log(`耗時      ：${(s.durationMs / 1000).toFixed(1)} 秒`);

process.exit(0);
