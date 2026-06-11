import fs from 'node:fs';

/**
 * 給 tsx 執行的入口（worker / scripts）載入 .env。
 * Next.js 網站本身會自動載入 .env，不需呼叫這個。
 */
export function loadEnv(): void {
  for (const file of ['.env.local', '.env']) {
    try {
      if (fs.existsSync(file)) process.loadEnvFile(file);
    } catch {
      // 忽略：檔案不存在或格式問題不應中斷程式
    }
  }
}
