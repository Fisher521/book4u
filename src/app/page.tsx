'use client';

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';

type DoubanInfo = {
  status: 'ok' | 'mismatch' | 'not_found' | 'error';
  douban_id?: string;
  douban_url?: string;
  cover_url?: string;
  verified_title?: string;
  verified_author?: string;
};

type BookBase = {
  title: string;
  author: string;
  author_note?: string;
  language?: string;
  category: string;
  why: string;
  hook: string;
  douban?: DoubanInfo;
};

type ResonanceBook = BookBase & { mood_match: string };
type BreakBubbleBook = BookBase & { breaks_from: string };

type Recommendation = {
  mood_summary: string;
  resonance: ResonanceBook[];
  break_bubble: BreakBubbleBook[];
  _meta?: { cost_usd?: number; model?: string; retry_rounds?: number; unverified_count?: number };
};

type FormSnapshot = {
  expression: string;
  mbti: string;
  age: string;
};

type LoadingStage = 'thinking' | 'verifying' | 'retrying';
type StageInfo = { stage: LoadingStage; failedCount?: number };

const STAGE_LINE: Record<LoadingStage, string> = {
  thinking: '正在打开书架',
  verifying: '对照豆瓣的纸页',
  retrying: '有几本对不上，再换一本',
};

const MBTI_LIST = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

const AGE_LIST = [
  { v: '18-25', label: '18–25 · 探索期' },
  { v: '26-30', label: '26–30 · 立业期' },
  { v: '31-35', label: '31–35 · 重塑期' },
  { v: '36-45', label: '36–45 · 中年门槛' },
  { v: '46-55', label: '46–55 · 第二春' },
  { v: '56+', label: '56 + · 整合期' },
];

const CHINESE_NUMERALS = ['壹', '貳', '參', '肆', '伍'];

const REQUEST_TIMEOUT_MS = 420_000;
const FORM_KEY = 'mood-reader:form';
const RESULT_KEY = 'mood-reader:result';

export default function Home() {
  const [expression, setExpression] = useState('');
  const [mbti, setMbti] = useState('INFJ');
  const [age, setAge] = useState('36-45');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stage, setStage] = useState<StageInfo | null>(null);
  const [result, setResult] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [restored, setRestored] = useState(false);

  // Restore form + last result on mount
  useEffect(() => {
    try {
      const formRaw = localStorage.getItem(FORM_KEY);
      if (formRaw) {
        const f = JSON.parse(formRaw) as Partial<FormSnapshot> & {
          mood?: string;
          thoughts?: string;
          music?: string;
        };
        if (f.expression) setExpression(f.expression);
        else {
          const merged = [f.mood, f.thoughts, f.music].filter(Boolean).join('\n');
          if (merged) setExpression(merged);
        }
        if (f.mbti) setMbti(f.mbti);
        if (f.age) setAge(f.age);
      }
      const resRaw = localStorage.getItem(RESULT_KEY);
      if (resRaw) setResult(JSON.parse(resRaw) as Recommendation);
    } catch {
      // ignore
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    const snapshot: FormSnapshot = { expression, mbti, age };
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify(snapshot));
    } catch {}
  }, [expression, mbti, age, restored]);

  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [loading]);

  async function onPickImages(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = '';
    const compressed = await Promise.all(files.map((f) => compressImage(f)));
    const next = [...images, ...compressed].slice(0, 6);
    setImages(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  function removeImage(idx: number) {
    const next = images.filter((_, i) => i !== idx);
    setImages(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  async function runRecommend() {
    setLoading(true);
    setError(null);
    setResult(null);

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort('timeout'), REQUEST_TIMEOUT_MS);

    const fd = new FormData();
    fd.append('expression', expression);
    fd.append('mbti', mbti);
    fd.append('age', age);
    images.forEach((f) => fd.append('images', f));

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        body: fd,
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setError(data.error ?? '出错了');
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('no response stream');
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: Recommendation | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          let event: { type: string; [k: string]: unknown };
          try { event = JSON.parse(line); } catch { continue; }
          if (event.type === 'stage') {
            const failedCount = (event.failedCount as number) || 0;
            setStage({ stage: event.stage as LoadingStage, failedCount });
          } else if (event.type === 'result') {
            finalResult = event.data as Recommendation;
          } else if (event.type === 'error') {
            setError((event.message as string) ?? '出错了');
          }
        }
      }

      if (finalResult) {
        setResult(finalResult);
        try { localStorage.setItem(RESULT_KEY, JSON.stringify(finalResult)); } catch {}
      }
    } catch (err) {
      if (controller.signal.aborted) {
        const reason = controller.signal.reason;
        setError(reason === 'timeout' ? '超时了（>7 分钟），请重试或减少图片数量' : '已取消');
      } else {
        setError(err instanceof Error ? err.message : '网络错误');
      }
    } finally {
      clearTimeout(timeoutId);
      abortRef.current = null;
      setLoading(false);
      setStage(null);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    runRecommend();
  }

  function onCancel() {
    abortRef.current?.abort('user');
  }

  function clearAll() {
    setExpression('');
    setImages([]);
    setPreviews([]);
    setResult(null);
    setError(null);
    try {
      localStorage.removeItem(FORM_KEY);
      localStorage.removeItem(RESULT_KEY);
    } catch {}
  }

  const elapsedStr = (() => {
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return m > 0 ? `${m}'${String(s).padStart(2, '0')}"` : `${s}s`;
  })();

  const statusText = stage
    ? stage.stage === 'retrying' && stage.failedCount
      ? `${stage.failedCount} 本对不上，再换一换`
      : STAGE_LINE[stage.stage]
    : STAGE_LINE.thinking;

  const canSubmit = !!(expression || images.length > 0);

  return (
    <main className="page">
      <header className="masthead">
        <h1>逢书</h1>
        <p className="subtitle">A Book to Meet You</p>
        <p className="epigraph">此刻，与这本书不期而遇。</p>
        <hr className="hairline" />
      </header>

      <form className="composer" onSubmit={onSubmit}>
        <div className="selects">
          <div className="field">
            <label htmlFor="mbti">人格类型</label>
            <select id="mbti" value={mbti} onChange={(e) => setMbti(e.target.value)}>
              {MBTI_LIST.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="age">人生阶段</label>
            <select id="age" value={age} onChange={(e) => setAge(e.target.value)}>
              {AGE_LIST.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
            </select>
          </div>
        </div>

        <div className="composer-body">
          <textarea
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder={'此刻你想说什么——可以是一段心境，一个未完成的念头，一首歌，一张刚拍下的照片。\n写给一个会读你的朋友。'}
            disabled={loading}
          />
          <div className="composer-tools">
            <div className="photo-row">
              {previews.map((src, i) => (
                <div key={i} className="photo-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" />
                  <button type="button" onClick={() => removeImage(i)} aria-label="移除">×</button>
                </div>
              ))}
              {images.length < 6 && (
                <label className="photo-add" aria-label="附图">
                  +
                  <input type="file" accept="image/*" multiple onChange={onPickImages} />
                </label>
              )}
            </div>

            {loading ? (
              <div className="loading">
                <div className="status">
                  <em>{statusText}</em>
                  <span className="dots"><span>·</span><span>·</span><span>·</span></span>
                </div>
                <div className="right">
                  <span className="elapsed">{elapsedStr}</span>
                  <button type="button" className="cancel" onClick={onCancel}>取消</button>
                </div>
              </div>
            ) : (
              <button type="submit" className="submit" disabled={!canSubmit}>
                {result ? 'Send Again' : 'Find me a book'}
              </button>
            )}
          </div>
          {!loading && !canSubmit && (
            <p className="submit-hint">写一句，或附一张图</p>
          )}
        </div>

        {error && <div className="error-pill">{error}</div>}
      </form>

      {result && !loading && (
        <Results data={result} onReset={() => setResult(null)} onClear={clearAll} />
      )}
    </main>
  );
}

// ─────────────────── Results ───────────────────

function Results({
  data,
  onReset,
  onClear,
}: {
  data: Recommendation;
  onReset: () => void;
  onClear: () => void;
}) {
  return (
    <section className="results fade-in" key={data.mood_summary}>
      <p className="mood-summary">{data.mood_summary}</p>

      <div className="section-opener">
        <span className="label">PART ONE · <span className="accent-r">共鸣</span></span>
        <span className="descriptor">与你同频</span>
      </div>
      {data.resonance.map((b, i) => (
        <BookEntry key={`r-${i}`} entry={b} idx={i} kind="resonance" />
      ))}

      <div className="section-opener">
        <span className="label">PART TWO · <span className="accent-x">破茧</span></span>
        <span className="descriptor">自视野之外</span>
      </div>
      {data.break_bubble.map((b, i) => (
        <BookEntry key={`b-${i}`} entry={b} idx={i + 3} kind="rupture" />
      ))}

      <div className="post-actions">
        <ShareButton data={data} />
        <span className="sep">·</span>
        <button type="button" onClick={onReset}>再寻一次</button>
        <span className="sep">·</span>
        <button type="button" onClick={onClear}>清空</button>
      </div>
    </section>
  );
}

function ShareButton({ data }: { data: Recommendation }) {
  const [feedback, setFeedback] = useState<string | null>(null);

  async function share() {
    const text = buildShareText(data);
    const url = typeof window !== 'undefined' ? window.location.href : 'https://book4u-khaki.vercel.app';
    // Try Web Share API first (mobile native share — WeChat needs a url field, not text-only)
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: '逢书 · 此刻给你的几本书', text, url });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        // fall through to clipboard
      }
    }
    // Fallback: clipboard
    try {
      await navigator.clipboard.writeText(text + '\n\n' + url);
      setFeedback('已复制到剪贴板');
      setTimeout(() => setFeedback(null), 2000);
    } catch {
      setFeedback('请手动复制');
      setTimeout(() => setFeedback(null), 2000);
    }
  }

  return (
    <>
      <button type="button" onClick={share}>分享</button>
      {feedback && <span className="share-feedback">{feedback}</span>}
    </>
  );
}

function buildShareText(data: Recommendation): string {
  const lines: string[] = [];
  lines.push('逢书 · 此刻给你的几本书');
  lines.push('');
  lines.push(`「${data.mood_summary}」`);
  lines.push('');
  lines.push('— 共鸣 · 与你同频 —');
  data.resonance.forEach((b) => {
    lines.push('');
    lines.push(`《${b.title}》  ${b.author}`);
    if (b.hook) lines.push(`「${b.hook}」`);
  });
  lines.push('');
  lines.push('— 破茧 · 自视野之外 —');
  data.break_bubble.forEach((b) => {
    lines.push('');
    lines.push(`《${b.title}》  ${b.author}`);
    if (b.hook) lines.push(`「${b.hook}」`);
  });
  lines.push('');
  lines.push('—— 由 逢书 · A Book to Meet You 寄出');
  return lines.join('\n');
}

function BookEntry({
  entry,
  idx,
  kind,
}: {
  entry: BookBase & { mood_match?: string; breaks_from?: string };
  idx: number;
  kind: 'resonance' | 'rupture';
}) {
  const numeral = CHINESE_NUMERALS[idx] ?? `${idx + 1}`;
  const matchLabel = kind === 'resonance' ? '同频于 ——' : '破的是 ——';
  const matchText = kind === 'resonance' ? entry.mood_match : entry.breaks_from;

  const searchKey = `${entry.title} ${entry.author}`;
  const doubanFallback = `https://search.douban.com/book/subject_search?search_text=${encodeURIComponent(searchKey)}`;
  const dbStatus = entry.douban?.status;
  const doubanUrl = dbStatus === 'ok' ? entry.douban!.douban_url ?? doubanFallback : doubanFallback;

  const cover = dbStatus === 'ok' ? entry.douban?.cover_url : undefined;
  const proxiedCover = cover ? `/api/cover?u=${encodeURIComponent(cover)}` : null;

  return (
    <article className={`book ${kind}`}>
      <span className="numeral" aria-hidden="true">{numeral}</span>

      <div className="cover-row">
        <div className="cover">
          {proxiedCover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={proxiedCover} alt={entry.title} loading="lazy" />
          ) : (
            <span className="cover-label"><em>《{entry.title}》<br/>无封面</em></span>
          )}
        </div>

        <div className="head">
          <div className="title-row">
            <h3 className="title">《{entry.title}》</h3>
            {entry.category && <span className="category">{entry.category}</span>}
          </div>
          <p className="byline">
            <span>{entry.author}</span>
            {entry.author_note && (
              <>
                <span className="em">——</span>
                <span className="tag">{entry.author_note}</span>
              </>
            )}
          </p>
          <p className="hook">{entry.hook}</p>
        </div>
      </div>

      <div className="ornament" aria-hidden="true">
        <span className="rule" />
        <span className="glyph">❦</span>
        <span className="rule" />
      </div>

      <p className="why">{entry.why}</p>

      {matchText && (
        <p className="match">
          <span className="label">{matchLabel}</span>
          {matchText}
        </p>
      )}

      <div className="footer">
        <div className="links">
          <a href={doubanUrl} target="_blank" rel="noreferrer" title="到豆瓣">
            <DoubanIcon /><span>到豆瓣</span>
          </a>
        </div>
        <VerifyPill douban={entry.douban} />
      </div>
    </article>
  );
}

/* — channel icon — minimalist line-art, monochrome via currentColor — */
function DoubanIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" aria-hidden>
      <rect x="2" y="2.5" width="10" height="9" rx="0.8" />
      <line x1="4.4" y1="6" x2="9.6" y2="6" />
      <line x1="4.4" y1="8.4" x2="7.8" y2="8.4" />
    </svg>
  );
}

function VerifyPill({ douban }: { douban?: DoubanInfo }) {
  // Only flag suspect books; verified ones stay quiet
  if (!douban) return null;
  if (douban.status === 'mismatch') return <span className="verify miss">似有偏差</span>;
  if (douban.status === 'not_found') return <span className="verify miss">豆瓣无寻</span>;
  return null;
}

/**
 * Client-side image compression. Resizes to max 1568px on long edge
 * and re-encodes as JPEG 0.85.
 */
async function compressImage(file: File, maxDim = 1568, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('image load failed'));
      i.src = dataUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    if (scale === 1 && file.size < 800_000) return file;
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob) return file;
    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
