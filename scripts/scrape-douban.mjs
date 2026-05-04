#!/usr/bin/env node
/**
 * Scrape 豆瓣 tag pages aggressively. Outputs JSON to stdout.
 * Filters: 评分 >= 7.5 · 评价数 >= 200 · 出版年 in 2024-2026
 */

import { writeFileSync } from 'node:fs';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchHtml(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://book.douban.com/' } });
  if (!r.ok) return '';
  return await r.text();
}

function parseBooks(html) {
  const books = [];
  const itemRe = /<li class="subject-item">([\s\S]*?)<\/li>/g;
  let m;
  while ((m = itemRe.exec(html))) {
    const item = m[1];
    const titleMatch = item.match(/<h2[^>]*>\s*<a\s+href="([^"]+)"\s+title="([^"]+)"/);
    const pubMatch = item.match(/<div class="pub">([\s\S]*?)<\/div>/);
    const ratingMatch = item.match(/<span class="rating_nums">([\d.]+)<\/span>/);
    const plMatch = item.match(/<span class="pl">\s*\(([^)]+)\)/);
    if (titleMatch) {
      const pub = pubMatch ? pubMatch[1].trim().replace(/\s+/g, ' ') : '';
      // Parse: "Author / [translator /] publisher / YYYY-MM[-DD] / price"
      const parts = pub.split(' / ').map((s) => s.trim());
      // Find pub date — pattern YYYY-MM or YYYY-M
      let pubDate = '';
      for (const p of parts) {
        if (/^\d{4}-\d{1,2}/.test(p)) {
          pubDate = p;
          break;
        }
      }
      const author = parts[0] || '';
      const year = pubDate ? parseInt(pubDate.slice(0, 4)) : null;
      books.push({
        url: titleMatch[1],
        title: titleMatch[2].trim(),
        author,
        publisher: parts.length >= 3 ? parts[parts.length - 3] : '',
        pubDate,
        year,
        rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
        votes: plMatch ? parseInt(plMatch[1].replace(/[^0-9]/g, '')) : 0,
      });
    }
  }
  return books;
}

async function scrapeTag(tag, maxPages = 10) {
  const all = [];
  for (let p = 0; p < maxPages; p++) {
    const url = `https://book.douban.com/tag/${encodeURIComponent(tag)}?start=${p * 20}&type=T`;
    const html = await fetchHtml(url);
    const books = parseBooks(html);
    all.push(...books);
    if (books.length < 20) break; // last page
    await new Promise((r) => setTimeout(r, 500));
  }
  return all;
}

const TAGS = [
  // years
  '2024', '2025', '2026',
  // big buckets
  '小说', '文学', '随笔', '散文', '诗歌', '短篇小说', '长篇小说',
  // foreign lit by region
  '外国文学', '日本文学', '韩国文学', '英国文学', '美国文学', '法国文学', '德国文学', '俄罗斯文学',
  '拉美文学', '北欧文学', '南美文学', '东南亚文学',
  // chinese lit splits
  '中国文学', '中国当代', '当代文学', '台湾文学', '香港文学', '港台',
  // genre fiction
  '推理', '悬疑', '科幻', '奇幻', '言情', '惊悚', '武侠', '玄幻',
  // non-fiction
  '历史', '哲学', '心理学', '社会学', '社会', '纪实', '传记', '回忆录',
  '人类学', '政治', '宗教', '文化',
  // life
  '女性', '成长', '教育', '育儿', '艺术', '设计', '建筑',
  '美食', '旅行', '自然', '博物', '健康',
  // pop/biz
  '商业', '经济', '管理', '科普', '互联网', '科技',
  // visual
  '漫画', '绘本', '摄影',
  // craft
  '写作', '电影', '音乐', '戏剧',
];
const PAGES_PER_TAG = 15; // 300 per tag max

const all = [];
for (const tag of TAGS) {
  process.stderr.write(`Scraping tag/${tag}…\n`);
  const books = await scrapeTag(tag, PAGES_PER_TAG);
  process.stderr.write(`  got ${books.length}\n`);
  all.push(...books);
}

// Dedupe by URL
const byUrl = new Map();
for (const b of all) {
  if (!byUrl.has(b.url)) byUrl.set(b.url, b);
}
const dedup = [...byUrl.values()];

// Filter: pub year 2024-2026, rating >= 7.3, votes >= 50 (loosened for more breadth)
const filtered = dedup
  .filter((b) => b.year && b.year >= 2024 && b.year <= 2026)
  .filter((b) => b.rating && b.rating >= 7.3)
  .filter((b) => b.votes >= 50)
  .sort((a, b) => b.votes - a.votes);

process.stderr.write(`\nDedup: ${dedup.length} → filtered (2024-2026, ≥7.5, ≥200 votes): ${filtered.length}\n\n`);

// Print summary
for (const b of filtered) {
  console.log(`[${b.year}] [${b.rating}/${b.votes}] 《${b.title}》  ${b.author.slice(0, 40)}`);
}

// Save JSON
writeFileSync(
  new URL('./scraped-douban.json', import.meta.url),
  JSON.stringify(filtered, null, 2),
);
process.stderr.write(`\n→ saved to scripts/scraped-douban.json (${filtered.length} books)\n`);
