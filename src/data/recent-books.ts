/**
 * 2025+ 新书候选池
 *
 * 为什么需要：Qwen-VL-Max 训练 cutoff 在 2024 末，2025 之后出版/中译的书它不知道。
 * 这个文件里的书会被注入 system prompt，作为模型可参考的"近期书单"。
 *
 * 维护方法：
 * - 加新书：直接 append 到数组
 * - 每本必须**豆瓣可查**（否则推了会被校验拦截 → 重试 → 浪费时间）
 * - `taste` 字段填合适的 MBTI 类型，多个用 ` / ` 分隔
 * - 控制在 8-20 本之间。太少效果不明显，太多稀释 prompt。
 *
 * 当前 seed 是少数几本相对确定的 2024-2025 书。你应该按自己的阅读和发现持续添加。
 */

export type RecentBook = {
  title: string;
  original_title?: string;
  author: string;
  year: number;
  taste: string; // MBTI 标签，如 "INFJ / INFP"，或 "all" 表示通用
  note: string; // 一句话特征说明
};

export const RECENT_BOOKS: RecentBook[] = [
  {
    title: '不做告别',
    original_title: '작별하지 않는다',
    author: '韩江 Han Kang',
    year: 2024,
    taste: 'INFJ / INFP / ISFP',
    note: '诺奖后中译。济州 4·3 事件的伤痕，白色与雪的语言。沉痛但克制。',
  },
  {
    title: 'Intermezzo（中场）',
    author: 'Sally Rooney',
    year: 2024,
    taste: 'INFP / ENFP / INFJ',
    note: 'Rooney 最成熟的一本。两兄弟与悲伤，比《正常人》更内向更结构。',
  },
  {
    title: 'James',
    author: 'Percival Everett',
    year: 2024,
    taste: 'INTJ / INTP / ENTJ',
    note: '《哈克贝利·费恩》视角反转——以 Jim 的口吻重写。普利策小说。',
  },
  {
    title: 'Caledonian Road',
    author: 'Andrew O\'Hagan',
    year: 2024,
    taste: 'ENTJ / ENTP / INTJ',
    note: '伦敦阶层全景。Dickens 式群像，写当代精英虚伪与崩塌。',
  },
  {
    title: 'The Safekeep',
    author: 'Yael van der Wouden',
    year: 2024,
    taste: 'INFJ / ISFJ / ISFP',
    note: '布克奖入围。战后荷兰，房子、记忆、隐藏的身份。慢热得惊艳。',
  },
  {
    title: '青春期猫',
    author: '塞壬',
    year: 2024,
    taste: 'INFP / ENFP / ISFP',
    note: '中国当代散文家。打工女性视角的诚实自传，肉身与时代。',
  },
  {
    title: '断代',
    author: '郭强生',
    year: 2024,
    taste: 'INFJ / INFP / ENFJ',
    note: '台湾作家。同志中年人对父辈与逝去恋人的双重凝视。',
  },
];

/**
 * 把候选池格式化进 system prompt 的字符串。空数组返回空串。
 */
export function formatRecentBooksForPrompt(books: RecentBook[] = RECENT_BOOKS): string {
  if (books.length === 0) return '';
  const lines = books.map(
    (b) => `- 《${b.title}》${b.author}（${b.year}）— 适合：${b.taste} — ${b.note}`,
  );
  return `\n══════════════════════════════════════════════════════════
近期新书候选池（你训练时可能不熟，但豆瓣已收录）
══════════════════════════════════════════════════════════

以下是 2024-2025 出版的好书，**可以纳入推荐考虑**（不是必选）。
当 ta 的画像匹配上某本的"适合"标签，且主题/味道对得上时，可以推。
注意：这些书你训练时可能没见过，**只在你按上面的"适合"标签判断对得上时才推**，
不要为了"推新书"而推不对的书。

${lines.join('\n')}
`;
}
