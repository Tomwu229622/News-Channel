import { loadEnv } from '../lib/env';
loadEnv();

import { ensureSchema, totalCount } from '../lib/db';

console.log('建立資料表…');
await ensureSchema();
const n = await totalCount();
console.log(`✓ 資料庫就緒，目前共 ${n} 則新聞。`);

process.exit(0);
