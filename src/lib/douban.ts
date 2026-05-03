/**
 * Douban book verification via the public subject_suggest JSON endpoint.
 * Returns ground-truth: real subject id, real title, cover URL, normalized author.
 */

const ENDPOINT = 'https://book.douban.com/j/subject_suggest';
const TIMEOUT_MS = 8000;
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export type DoubanStatus = 'ok' | 'mismatch' | 'not_found' | 'error';

export type DoubanResult = {
  status: DoubanStatus;
  douban_id?: string;
  douban_url?: string;
  cover_url?: string;
  verified_title?: string;
  verified_author?: string;
};

type SuggestItem = {
  id: string;
  title: string;
  url: string;
  pic?: string;
  author_name?: string;
  type?: string;
};

const cache = new Map<string, DoubanResult>();

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\[\]【】（）()·\.\s,，:：;；'"`、_\-\/]/g, '')
    .trim();
}

function tokens(s: string): string[] {
  // crude token extraction: keep chunks of CJK or letters, length >= 2
  const matches = s.match(/[一-龥]+|[a-zA-Z]+/g) ?? [];
  return matches.filter((t) => t.length >= 2).map((t) => t.toLowerCase());
}

function titlesSimilar(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // overlap ratio
  const setA = new Set(na.split(''));
  const setB = new Set(nb.split(''));
  const overlap = [...setA].filter((c) => setB.has(c)).length;
  const ratio = overlap / Math.min(setA.size, setB.size);
  return ratio >= 0.6;
}

function authorsMatch(modelAuthor: string, doubanAuthor: string): boolean {
  const modTokens = tokens(modelAuthor);
  const dbTokens = tokens(doubanAuthor);
  if (modTokens.length === 0 || dbTokens.length === 0) return false;
  // any token of length >= 2 from model appears in douban (or vice versa)
  for (const t of modTokens) {
    for (const d of dbTokens) {
      if (t === d || t.includes(d) || d.includes(t)) return true;
    }
  }
  return false;
}

function pickBest(
  candidates: SuggestItem[],
  modelTitle: string,
  modelAuthor: string,
): { item: SuggestItem; status: 'ok' | 'mismatch' } | null {
  if (candidates.length === 0) return null;

  // Score each candidate: 2 for title sim, 1 for author match
  let best: { item: SuggestItem; titleOk: boolean; authorOk: boolean; score: number } | null =
    null;
  for (const c of candidates) {
    const titleOk = titlesSimilar(modelTitle, c.title);
    const authorOk = c.author_name ? authorsMatch(modelAuthor, c.author_name) : false;
    const score = (titleOk ? 2 : 0) + (authorOk ? 1 : 0);
    if (!best || score > best.score) {
      best = { item: c, titleOk, authorOk, score };
    }
  }
  if (!best) return null;
  if (best.titleOk && best.authorOk) return { item: best.item, status: 'ok' };
  if (best.titleOk || best.authorOk) return { item: best.item, status: 'mismatch' };
  return { item: best.item, status: 'mismatch' };
}

async function suggest(query: string): Promise<SuggestItem[]> {
  const url = `${ENDPOINT}?q=${encodeURIComponent(query)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        Referer: 'https://book.douban.com/',
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as SuggestItem[];
    return Array.isArray(data) ? data.filter((d) => d.type === 'b') : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyBook(title: string, author: string): Promise<DoubanResult> {
  const cacheKey = `${normalize(title)}|${normalize(author)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let result: DoubanResult;
  try {
    // First try: title only (most reliable on douban)
    let candidates = await suggest(title);

    // Fallback: title + author
    if (candidates.length === 0) {
      candidates = await suggest(`${title} ${author}`);
    }

    // Fallback: author only — pick book matching title from author's catalog
    if (candidates.length === 0) {
      candidates = await suggest(author);
    }

    if (candidates.length === 0) {
      result = { status: 'not_found' };
    } else {
      const picked = pickBest(candidates, title, author);
      if (!picked) {
        result = { status: 'not_found' };
      } else {
        result = {
          status: picked.status,
          douban_id: picked.item.id,
          douban_url: picked.item.url,
          cover_url: picked.item.pic,
          verified_title: picked.item.title,
          verified_author: picked.item.author_name,
        };
      }
    }
  } catch {
    result = { status: 'error' };
  }

  cache.set(cacheKey, result);
  return result;
}

export async function verifyMany<T extends { title: string; author: string }>(
  books: T[],
): Promise<DoubanResult[]> {
  return Promise.all(books.map((b) => verifyBook(b.title, b.author)));
}
