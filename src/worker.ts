import { loadEnv } from './lib/env';
loadEnv();

import cron from 'node-cron';
import { collect } from './lib/collector';
import { sendDigest } from './lib/digest';
import { aiEnabled } from './lib/ai';

const COLLECT_CRON = process.env.COLLECT_CRON || '0 * * * *'; // 每小時整點
const DIGEST_CRON = process.env.DIGEST_CRON || '0 8 * * *'; // 每天 08:00

function now(): string {
  return new Date().toLocaleString('zh-TW');
}

async function runCollect(): Promise<void> {
  console.log(`\n[${now()}] 開始蒐集…`);
  try {
    const s = await collect();
    console.log(
      `[${now()}] 完成：抓取 ${s.fetched}、新增 ${s.inserted}` +
        `（重大 ${s.major}、AI ${s.aiEnriched}），資料庫共 ${s.total} 則，` +
        `耗時 ${(s.durationMs / 1000).toFixed(1)}s`,
    );
  } catch (e) {
    console.error('[蒐集失敗]', e);
  }
}

async function runDigest(): Promise<void> {
  console.log(`\n[${now()}] 產生每日摘要…`);
  try {
    await sendDigest(24);
  } catch (e) {
    console.error('[摘要失敗]', e);
  }
}

if (!cron.validate(COLLECT_CRON)) throw new Error(`COLLECT_CRON 格式錯誤：${COLLECT_CRON}`);
if (!cron.validate(DIGEST_CRON)) throw new Error(`DIGEST_CRON 格式錯誤：${DIGEST_CRON}`);

console.log('📰 News Finder 排程已啟動');
console.log(`  • 蒐集排程：${COLLECT_CRON}`);
console.log(`  • 摘要排程：${DIGEST_CRON}`);
console.log(`  • AI 評分：${aiEnabled() ? '啟用 (Claude Haiku)' : '未啟用（改用關鍵字判斷）'}`);
console.log('  按 Ctrl+C 結束。\n');

cron.schedule(COLLECT_CRON, runCollect);
cron.schedule(DIGEST_CRON, runDigest);

// 啟動時立即先跑一次蒐集，不必等到下一個整點
void runCollect();
