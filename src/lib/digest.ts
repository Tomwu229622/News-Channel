import nodemailer from 'nodemailer';
import { queryArticles } from './db';
import type { StoredArticle } from './types';
import { CATEGORIES } from './types';

/** 取得過去 N 小時的重大新聞，依重要性排序 */
export async function getDigestArticles(hours = 24, perCategory = 8): Promise<StoredArticle[]> {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const out: StoredArticle[] = [];
  for (const category of CATEGORIES) {
    const rows = (await queryArticles({ category, majorOnly: true, sinceIso: since, limit: 100 }))
      .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
      .slice(0, perCategory);
    out.push(...rows);
  }
  return out;
}

export interface Digest {
  title: string;
  text: string; // 純文字（console / email）
  html: string; // email HTML
  count: number;
}

export async function buildDigest(hours = 24): Promise<Digest> {
  const articles = await getDigestArticles(hours);
  const dateLabel = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const title = `📰 重大新聞每日摘要 ${dateLabel}（過去 ${hours} 小時，共 ${articles.length} 則）`;

  const lines: string[] = [title, ''];
  const htmlParts: string[] = [`<h2>${escapeHtml(title)}</h2>`];

  for (const category of CATEGORIES) {
    const inCat = articles.filter((a) => a.category === category);
    if (inCat.length === 0) continue;
    lines.push(`【${category}】`);
    htmlParts.push(`<h3>${category}</h3><ul>`);
    for (const a of inCat) {
      const summary = a.aiSummary || a.summary || '';
      lines.push(`• [${a.importance ?? '-'}] ${a.title} — ${a.source}`);
      if (summary) lines.push(`    ${summary}`);
      lines.push(`    ${a.link}`);
      htmlParts.push(
        `<li><a href="${escapeHtml(a.link)}">${escapeHtml(a.title)}</a> ` +
          `<small>(${escapeHtml(a.source)}・重要性 ${a.importance ?? '-'})</small>` +
          (summary ? `<br/><span>${escapeHtml(summary)}</span>` : '') +
          `</li>`,
      );
    }
    lines.push('');
    htmlParts.push('</ul>');
  }

  if (articles.length === 0) {
    lines.push('（過去時間內沒有判定為重大的新聞）');
    htmlParts.push('<p>（過去時間內沒有判定為重大的新聞）</p>');
  }

  return { title, text: lines.join('\n'), html: htmlParts.join('\n'), count: articles.length };
}

/** 依環境變數選擇推播管道：Teams > Email > console */
export async function sendDigest(hours = 24): Promise<{ channel: string; count: number }> {
  const digest = await buildDigest(hours);

  if (process.env.TEAMS_WEBHOOK_URL) {
    await sendTeams(process.env.TEAMS_WEBHOOK_URL, digest);
    return { channel: 'teams', count: digest.count };
  }

  if (process.env.SMTP_HOST && process.env.DIGEST_EMAIL_TO) {
    await sendEmail(digest);
    return { channel: 'email', count: digest.count };
  }

  console.log('\n' + digest.text + '\n');
  console.log('（未設定 TEAMS_WEBHOOK_URL 或 SMTP，摘要僅輸出在 console）');
  return { channel: 'console', count: digest.count };
}

async function sendTeams(webhook: string, digest: Digest): Promise<void> {
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: digest.text.replace(/\n/g, '\n\n') }),
  });
  if (!res.ok) {
    throw new Error(`Teams webhook 回應 ${res.status}: ${await res.text()}`);
  }
  console.log(`✓ 已推播至 Teams（${digest.count} 則）`);
}

async function sendEmail(digest: Digest): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  await transporter.sendMail({
    from: process.env.DIGEST_EMAIL_FROM || process.env.SMTP_USER,
    to: process.env.DIGEST_EMAIL_TO,
    subject: digest.title,
    text: digest.text,
    html: digest.html,
  });
  console.log(`✓ 已寄送 Email 至 ${process.env.DIGEST_EMAIL_TO}（${digest.count} 則）`);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
