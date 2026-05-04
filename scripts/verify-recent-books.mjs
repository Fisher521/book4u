#!/usr/bin/env node
/**
 * Verify each entry in src/data/recent-books.ts against 豆瓣 subject_suggest.
 * Prints status per book: ok / mismatch / not_found
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// crude TS parse: extract title + author + year from the literal array
const src = readFileSync(join(ROOT, 'src/data/recent-books.ts'), 'utf8');
const entries = [];
const re = /\{\s*title:\s*['"`]([^'"`]+)['"`][\s\S]*?author:\s*['"`]([^'"`]+)['"`][\s\S]*?year:\s*(\d+)/g;
let m;
while ((m = re.exec(src))) {
  entries.push({ title: m[1], author: m[2], year: Number(m[3]) });
}

const ENDPOINT = 'https://book.douban.com/j/subject_suggest';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function suggest(q) {
  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json', Referer: 'https://book.douban.com/' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.filter((d) => d.type === 'b') : [];
  } catch (e) {
    return [];
  }
}

function normalize(s) {
  return s.toLowerCase().replace(/[\[\]【】（）()·\.\s,，:：;；'"`、_\-\/]/g, '').trim();
}
function tokens(s) {
  const matches = s.match(/[一-龥]+|[a-zA-Z]+/g) ?? [];
  return matches.filter((t) => t.length >= 2).map((t) => t.toLowerCase());
}
function titlesSimilar(a, b) {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const sA = new Set(na), sB = new Set(nb);
  const overlap = [...sA].filter((c) => sB.has(c)).length;
  return overlap / Math.min(sA.size, sB.size) >= 0.6;
}
function authorsMatch(a, b) {
  const ta = tokens(a), tb = tokens(b);
  for (const x of ta) for (const y of tb) if (x === y || x.includes(y) || y.includes(x)) return true;
  return false;
}

async function verify(title, author) {
  let cands = await suggest(title);
  if (cands.length === 0) cands = await suggest(`${title} ${author}`);
  if (cands.length === 0) cands = await suggest(author);
  if (cands.length === 0) return { status: 'not_found' };
  let best = null;
  for (const c of cands) {
    const tOk = titlesSimilar(title, c.title);
    const aOk = c.author_name ? authorsMatch(author, c.author_name) : false;
    const score = (tOk ? 2 : 0) + (aOk ? 1 : 0);
    if (!best || score > best.score) best = { c, tOk, aOk, score };
  }
  if (best.tOk && best.aOk)
    return { status: 'ok', title: best.c.title, author: best.c.author_name, url: best.c.url };
  if (best.tOk || best.aOk)
    return { status: 'mismatch', title: best.c.title, author: best.c.author_name, url: best.c.url };
  return { status: 'mismatch', title: best.c.title, author: best.c.author_name, url: best.c.url };
}

console.log(`Verifying ${entries.length} books on 豆瓣…\n`);
const results = [];
for (const e of entries) {
  const r = await verify(e.title, e.author);
  const tag = r.status === 'ok' ? '✓' : r.status === 'mismatch' ? '?' : '✗';
  const note =
    r.status === 'ok'
      ? `→ 《${r.title}》 ${r.author || ''}`
      : r.status === 'mismatch'
        ? `→ 豆瓣返回: 《${r.title}》 ${r.author || ''}`
        : '→ 豆瓣无结果';
  console.log(`${tag} ${e.year} 《${e.title}》 ${e.author}  ${note}`);
  results.push({ ...e, ...r });
  await new Promise((r) => setTimeout(r, 300)); // rate limit politeness
}

const ok = results.filter((r) => r.status === 'ok').length;
const mm = results.filter((r) => r.status === 'mismatch').length;
const nf = results.filter((r) => r.status === 'not_found').length;
console.log(`\nSummary: ${ok} ok · ${mm} mismatch · ${nf} not_found · total ${entries.length}`);
