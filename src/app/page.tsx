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

type DeepRead = {
  theme: string;
  theme_evidence: string;
  surface_emotion: string;
  hidden_emotion: string;
  hidden_need: 'be_understood' | 'be_disrupted' | 'be_accompanied' | 'be_awakened' | 'be_held';
  tension_locus: 'intimate' | 'work' | 'self' | 'aging' | 'identity' | 'economic';
  mbti_alignment: 'aligned' | 'mild_drift' | 'strong_conflict';
  conflict_note?: string;
  cultural_signals?: string[];
  media_hints?: {
    music?: string[];
    videos?: string[];
    other?: string[];
  };
};

type Recommendation = {
  deep_read?: DeepRead;
  mood_summary: string;
  resonance: ResonanceBook[];
  break_bubble: BreakBubbleBook[];
  _meta?: { cost_usd?: number; model?: string; retry_rounds?: number; unverified_count?: number };
};

const HIDDEN_NEED_LABEL: Record<DeepRead['hidden_need'], string> = {
  be_understood: '想被理解（不必被解决）',
  be_disrupted: '想被打破',
  be_accompanied: '想被陪伴',
  be_awakened: '想被点醒',
  be_held: '想被托住',
};

const TENSION_LABEL: Record<DeepRead['tension_locus'], string> = {
  intimate: '亲密关系',
  work: '工作',
  self: '自我',
  aging: '衰老',
  identity: '身份',
  economic: '经济',
};

const ALIGNMENT_LABEL: Record<DeepRead['mbti_alignment'], string> = {
  aligned: '和你 MBTI baseline 一致',
  mild_drift: '偏离 baseline 一点',
  strong_conflict: '强烈偏离 baseline',
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

// LLM sometimes returns titles already wrapped in 《》, which gets double-wrapped at render.
function cleanTitle(t: string): string {
  return t.replace(/^[《<「『]+|[》>」』]+$/g, '').trim();
}

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

      {data.deep_read && <DeepReadView data={data.deep_read} />}

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
        <SaveButton />
        <span className="sep">·</span>
        <ShareButton data={data} />
        <span className="sep">·</span>
        <button type="button" onClick={onReset}>再寻一次</button>
        <span className="sep">·</span>
        <button type="button" onClick={onClear}>清空</button>
      </div>
    </section>
  );
}

function SaveButton() {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setFeedback(null);
    const target = document.querySelector('.results') as HTMLElement | null;
    if (!target) {
      setBusy(false);
      return;
    }
    // Hide post-actions and the deep-read collapsible body so the saved image is clean
    const actions = document.querySelector('.post-actions') as HTMLElement | null;
    const drBody = document.querySelector('.deep-read-body') as HTMLElement | null;
    const drToggle = document.querySelector('.deep-read-toggle') as HTMLElement | null;
    const prevActionsVis = actions?.style.visibility ?? '';
    const prevDrToggleDisp = drToggle?.style.display ?? '';
    if (actions) actions.style.visibility = 'hidden';
    if (drToggle) drToggle.style.display = 'none';

    try {
      const { domToBlob } = await import('modern-screenshot');
      // Wait for any inline images (covers via /api/cover) to fully load
      const imgs = Array.from(target.querySelectorAll('img'));
      await Promise.all(
        imgs.map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
                // failsafe timeout
                setTimeout(() => resolve(), 4000);
              }),
        ),
      );
      const blob = await domToBlob(target, {
        backgroundColor: '#f8f4ea',
        scale: 2,
        fetch: { requestInit: { cache: 'force-cache' } },
      });
      if (!blob) throw new Error('截图返回空');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `逢书-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setFeedback('已保存到下载');
    } catch (err) {
      console.error('[save]', err);
      setFeedback('保存失败 ' + (err instanceof Error ? `(${err.message.slice(0, 30)})` : ''));
    } finally {
      if (actions) actions.style.visibility = prevActionsVis;
      if (drToggle) drToggle.style.display = prevDrToggleDisp;
      setBusy(false);
      setTimeout(() => setFeedback(null), 3000);
    }
    void drBody;
  }

  return (
    <>
      <button type="button" onClick={save} disabled={busy} className="action-with-icon">
        <SaveIcon />
        <span>{busy ? '正在制图…' : '保存图'}</span>
      </button>
      {feedback && <span className="share-feedback">{feedback}</span>}
    </>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 9.5v2a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-2" />
      <path d="M4.5 6.5L7 9l2.5-2.5" />
      <path d="M7 1.5v7" />
    </svg>
  );
}

function ShareButton({ data }: { data: Recommendation }) {
  const [feedback, setFeedback] = useState<string | null>(null);

  async function share() {
    const text = buildShareText(data);
    const url =
      typeof window !== 'undefined'
        ? window.location.href
        : process.env.NEXT_PUBLIC_SITE_URL || '';

    // Try Web Share API first (mobile native share)
    let shareTried = false;
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      shareTried = true;
      try {
        // Some platforms (WeChat in-app browser) reject text-with-url payloads silently.
        // Try url-only first (more compatible), then text+url as fallback.
        await navigator.share({ title: '逢书 · 此刻给你的几本书', url });
        setFeedback('已分享');
        setTimeout(() => setFeedback(null), 2000);
        return;
      } catch (err) {
        const name = (err as Error).name;
        if (name === 'AbortError') return; // user cancelled, no fallback
        console.warn('[share] navigator.share failed:', err);
        // fall through to clipboard
      }
    }

    // Fallback: clipboard
    try {
      await navigator.clipboard.writeText(text + '\n\n' + url);
      setFeedback(shareTried ? '分享受限，已复制到剪贴板' : '已复制到剪贴板');
      setTimeout(() => setFeedback(null), 2500);
    } catch (err) {
      console.error('[share] clipboard failed:', err);
      setFeedback('请手动复制 URL');
      setTimeout(() => setFeedback(null), 3000);
    }
  }

  return (
    <>
      <button type="button" onClick={share} className="action-with-icon">
        <ShareIcon />
        <span>分享</span>
      </button>
      {feedback && <span className="share-feedback">{feedback}</span>}
    </>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 1.5v8" />
      <path d="M4 4.5L7 1.5l3 3" />
      <path d="M2 8.5v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3" />
    </svg>
  );
}

function buildShareText(data: Recommendation): string {
  // Optimized for forwarding: short, intriguing, makes friend want to click.
  // Picks 2-3 most striking hooks (1 from each section), drops the personal mood
  // (which doesn't translate to friend), ends with clear CTA + URL.
  const lines: string[] = [];
  lines.push('「逢书」给我寄来一份书单');
  lines.push('');
  // First resonance hook as opener (most relatable)
  if (data.resonance[0]) {
    lines.push(`《${cleanTitle(data.resonance[0].title)}》— ${data.resonance[0].author}`);
    if (data.resonance[0].hook) lines.push(`  ${data.resonance[0].hook}`);
    lines.push('');
  }
  // 1 from break_bubble (the "你不会主动找的") — adds intrigue
  if (data.break_bubble[0]) {
    lines.push(`《${cleanTitle(data.break_bubble[0].title)}》— ${data.break_bubble[0].author}`);
    if (data.break_bubble[0].hook) lines.push(`  ${data.break_bubble[0].hook}`);
    lines.push('');
  }
  lines.push('… 一共 5 本。');
  lines.push('');
  lines.push('告诉它你此刻的样子，它给你寄一份属于你的：');
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

  const searchKey = `${cleanTitle(entry.title)} ${entry.author}`;
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
            <span className="cover-label"><em>《{cleanTitle(entry.title)}》<br/>无封面</em></span>
          )}
        </div>

        <div className="head">
          <div className="title-row">
            <h3 className="title">《{cleanTitle(entry.title)}》</h3>
            {entry.category && <span className="category">{entry.category}</span>}
          </div>
          <p className="author">{entry.author}</p>
          {entry.author_note && <p className="author-note">{entry.author_note}</p>}
        </div>
      </div>

      <div className="ornament" aria-hidden="true">
        <span className="rule" />
        <span className="glyph">❦</span>
        <span className="rule" />
      </div>

      <p className="hook">{entry.hook}</p>

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

/* — Douban brand icon: green rounded square with white "豆" — */
function DoubanIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <rect width="16" height="16" rx="3" fill="#00b51d" />
      <text
        x="8"
        y="11.5"
        textAnchor="middle"
        fontFamily="-apple-system, 'PingFang SC', 'Hiragino Sans GB', sans-serif"
        fontSize="11"
        fontWeight="800"
        fill="#fff"
      >
        豆
      </text>
    </svg>
  );
}

function DeepReadView({ data }: { data: DeepRead }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="deep-read">
      <button
        type="button"
        className="deep-read-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>AI 读到了什么</span>
        <span className="chevron">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <dl className="deep-read-body">
          <div className="dr-row">
            <dt>主题</dt>
            <dd>
              <strong>{data.theme}</strong>
              {data.theme_evidence && (
                <span className="dr-evidence"> · {data.theme_evidence}</span>
              )}
            </dd>
          </div>
          <div className="dr-row">
            <dt>你能感到的</dt>
            <dd>{data.surface_emotion}</dd>
          </div>
          <div className="dr-row">
            <dt>你没说的</dt>
            <dd>{data.hidden_emotion}</dd>
          </div>
          <div className="dr-row">
            <dt>真正想要的</dt>
            <dd>{HIDDEN_NEED_LABEL[data.hidden_need]}</dd>
          </div>
          <div className="dr-row">
            <dt>张力在</dt>
            <dd>{TENSION_LABEL[data.tension_locus]}</dd>
          </div>
          <div className="dr-row">
            <dt>MBTI</dt>
            <dd>
              {ALIGNMENT_LABEL[data.mbti_alignment]}
              {data.conflict_note && (
                <span className="dr-evidence"> · {data.conflict_note}</span>
              )}
            </dd>
          </div>
          {data.cultural_signals && data.cultural_signals.length > 0 && (
            <div className="dr-row">
              <dt>文化信号</dt>
              <dd>{data.cultural_signals.join(' · ')}</dd>
            </div>
          )}
          {data.media_hints && Object.values(data.media_hints).some((arr) => arr && arr.length) && (
            <div className="dr-row">
              <dt>媒体线索</dt>
              <dd>
                {[
                  data.media_hints.music?.length ? `🎵 ${data.media_hints.music.join('、')}` : null,
                  data.media_hints.videos?.length ? `📺 ${data.media_hints.videos.join('、')}` : null,
                  data.media_hints.other?.length ? data.media_hints.other.join('、') : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
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
