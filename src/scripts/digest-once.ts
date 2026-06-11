import { loadEnv } from '../lib/env';
loadEnv();

import { sendDigest } from '../lib/digest';

const r = await sendDigest(24);
console.log(`\n摘要管道：${r.channel}，共 ${r.count} 則`);

process.exit(0);
