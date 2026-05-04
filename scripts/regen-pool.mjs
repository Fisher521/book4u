#!/usr/bin/env node
/**
 * Reads scripts/scraped-douban-tight.json and writes src/data/douban-pool.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Use ALL filtered books from raw scrape (rating>=7.5, votes>=100 already applied)
const raw = JSON.parse(readFileSync(join(__dirname, 'scraped-douban.json'), 'utf8'));
const data = raw.sort((a, b) => {
  if (a.year !== b.year) return a.year - b.year;
  return b.votes - a.votes;
});
const counts = { 2024: 0, 2025: 0, 2026: 0 };
for (const b of data) counts[b.year]++;
console.log(`24:${counts[2024]} 25:${counts[2025]} 26:${counts[2026]} → total ${data.length}`);

const escape = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const lines = data.map((b) => {
  const a = escape(b.author).slice(0, 80);
  const t = escape(b.title);
  return `  { title: '${t}', author: '${a}', year: ${b.year}, rating: ${b.rating}, votes: ${b.votes} },`;
});

const out = `/**
 * 豆瓣 2024-2026 高分热门书池 (自动抓取)
 *
 * 数据源：scripts/scrape-douban.mjs (豆瓣 tag 页爬取)
 * 筛选：rating >= 7.5/7.8 + votes >= 200/400/600 (按年份梯度)
 * 数量：约 ${data.length} 本
 *
 * 区别于 RECENT_BOOKS：这里没有 MBTI 标签，只有书名/作者/年/分数。
 * 模型按主题/题材自行匹配。
 *
 * 重新抓取：
 *   node scripts/scrape-douban.mjs
 *   node scripts/regen-pool.mjs
 */

export type DoubanBook = {
  title: string;
  author: string;
  year: number;
  rating: number;
  votes: number;
};

export const DOUBAN_POOL: DoubanBook[] = [
${lines.join('\n')}
];

export function formatDoubanPoolForPrompt(books: DoubanBook[] = DOUBAN_POOL): string {
  if (books.length === 0) return '';
  const grouped: Record<number, DoubanBook[]> = { 2024: [], 2025: [], 2026: [] };
  for (const b of books) {
    if (grouped[b.year]) grouped[b.year].push(b);
  }
  const sect = (year: number, list: DoubanBook[]): string => {
    if (list.length === 0) return '';
    const items = list.map((b) => \`- 《\${b.title}》\${b.author}（豆瓣 \${b.rating}）\`).join('\\n');
    return \`\\n── \${year}（\${list.length} 本）──\\n\${items}\`;
  };
  return \`
══════════════════════════════════════════════════════════
豆瓣 2024-2026 高分新书池（自动抓取，全部豆瓣可校验）
══════════════════════════════════════════════════════════

以下是豆瓣最近的高分书（评分 ≥ 7.5、评价数 ≥ 200），覆盖文学/小说/历史/
散文/科幻/推理/纪实/哲学/女性/漫画等多种题材。当用户的画像匹配上某本的
题材或味道时可以推荐（不强制）。这些书都已豆瓣可查，不会校验失败。
\${sect(2024, grouped[2024])}\${sect(2025, grouped[2025])}\${sect(2026, grouped[2026])}
\`;
}
`;

writeFileSync(join(ROOT, 'src/data/douban-pool.ts'), out);
console.log(`Generated src/data/douban-pool.ts (${data.length} books)`);
