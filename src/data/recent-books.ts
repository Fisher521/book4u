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
    title: 'Intermezzo',
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
    title: '断代',
    author: '郭强生',
    year: 2024,
    taste: 'INFJ / INFP / ENFJ',
    note: '台湾作家。同志中年人对父辈与逝去恋人的双重凝视。',
  },

  // ── 2024 末 / 2025 ────────────────────────────────────────
  {
    title: '小城与不确定性的墙',
    original_title: '街とその不確かな壁',
    author: '村上春树',
    year: 2024,
    taste: 'INFJ / INFP / INTP',
    note: '村上时隔六年长篇。重写 1980 年中篇。图书馆、影子、被墙围住的城。',
  },
  {
    title: '不间断的人',
    author: '双雪涛',
    year: 2024,
    taste: 'INTP / ENTP / ENFP',
    note: '东北叙事新作。比《飞行家》更黑色更荒诞，男人在中年的断裂里继续走。',
  },
  {
    title: '温柔的讲述者',
    original_title: 'Czuły narrator',
    author: '奥尔加·托卡尔丘克 Olga Tokarczuk',
    year: 2024,
    taste: 'INFJ / INTJ / INFP',
    note: '托卡尔丘克诺奖演讲与散文集中译。第四人称、共情视角的文学宣言。',
  },
  {
    title: 'Wrong Norma',
    author: 'Anne Carson',
    year: 2024,
    taste: 'INFP / INFJ / ENTP',
    note: '碎片诗与散文。十年来最 Carson 的 Carson——荷马、当代、失眠并置。',
  },
  {
    title: 'Things in Nature Merely Grow',
    author: 'Yiyun Li',
    year: 2025,
    taste: 'INFJ / INFP / ISFJ',
    note: '李翊云回忆录。两个儿子相继自杀后写的。沉默、植物、不解释的悲伤。',
  },
  {
    title: 'The Emperor of Gladness',
    author: 'Ocean Vuong',
    year: 2025,
    taste: 'INFP / INFJ / ENFP',
    note: 'Vuong 第二部长篇。康涅狄格小镇、跨代孤独、阿片危机。诗的语言写小说。',
  },
  {
    title: 'Martyr!',
    author: 'Kaveh Akbar',
    year: 2024,
    taste: 'INFP / INFJ / INTP',
    note: '诗人首部长篇。伊朗裔美国人，戒酒、母亲被击落的航班、博物馆里的死亡艺术家。',
  },
  {
    title: 'Wandering Stars',
    author: 'Tommy Orange',
    year: 2024,
    taste: 'INFP / INFJ / ISFP',
    note: '《There There》续篇。原住民家族六代史，从屠杀幸存者到当代奥克兰少年。',
  },
  {
    title: 'Small Rain',
    author: 'Garth Greenwell',
    year: 2024,
    taste: 'INFJ / INFP / ISFJ',
    note: 'ICU 病房里的爱、疼痛、身体。三百页几乎没离开病床，却比任何旅行小说更远。',
  },
  {
    title: 'The Eleventh Hour',
    author: 'Salman Rushdie',
    year: 2025,
    taste: 'ENTP / INTP / ENFP',
    note: 'Rushdie 遇袭康复后第一本短篇集（2025 年 11 月）。五个故事，向 EM Forster 致敬。',
  },
  {
    title: 'Pathemata, or, The Story of My Mouth',
    author: 'Maggie Nelson',
    year: 2025,
    taste: 'INFP / INFJ / ENTP',
    note: 'Nelson 写下颌慢性疼痛的小书。极薄、极锋利，写身体的不可言说。',
  },
  {
    title: 'Creation Lake',
    author: 'Rachel Kushner',
    year: 2024,
    taste: 'INTJ / ENTJ / INTP',
    note: '布克奖入围。卧底女间谍渗透法国乡村激进派。冷峻、智性、Le Carré 的味道。',
  },
  {
    title: 'Held',
    author: 'Anne Michaels',
    year: 2024,
    taste: 'INFJ / INFP / ISFP',
    note: '布克奖入围。一战伤兵到当代，四代人的爱与丧失。诗化叙事、跨越百年。',
  },
  {
    title: 'Kairos',
    author: 'Jenny Erpenbeck',
    year: 2024,
    taste: 'INTJ / INFJ / INFP',
    note: '国际布克奖。东柏林一段不对等的爱情，与一个国家同时崩塌。',
  },
  {
    title: 'Headshot',
    author: 'Rita Bullwinkel',
    year: 2024,
    taste: 'ESTP / ENTP / ESTJ',
    note: '内华达少女拳击锦标赛两天的小说。八段对决，八种身体与未来。罕见硬题材。',
  },
  {
    title: 'Knife',
    author: 'Salman Rushdie',
    year: 2024,
    taste: 'ENTP / ENTJ / INTJ',
    note: '遇袭康复回忆录。从被刺到失去右眼的几个月。坦然、不饶恕、文学如何对抗暴力。',
  },
  {
    title: 'The Möbius Book',
    author: 'Catherine Lacey',
    year: 2025,
    taste: 'INFP / INFJ / INTP',
    note: '一本书两面：一面回忆录，一面虚构。分手与时间结构的实验。',
  },

  // ── 非虚构 / 历史 / 社科 (24-25) ────────────────────────────
  {
    title: 'The Demon of Unrest',
    author: 'Erik Larson',
    year: 2024,
    taste: 'INTJ / ENTJ / ENTP',
    note: 'Larson 写林肯就职到萨姆特堡开火那 5 个月。一个国家如何在所有人警告下撞墙。',
  },
  {
    title: 'The Wide Wide Sea',
    author: 'Hampton Sides',
    year: 2024,
    taste: 'INTJ / INTP / ENTP',
    note: 'Cook 船长第三次也是最后一次南太平洋航行。启蒙者如何变成入侵者。',
  },
  {
    title: 'The Anxious Generation',
    author: 'Jonathan Haidt',
    year: 2024,
    taste: 'ENFJ / ESTJ / ISFJ',
    note: '智能手机如何重写一代人的心理。父母、教育者、对儿童议题敏感者必读。',
  },
  {
    title: 'Slow Productivity',
    author: 'Cal Newport',
    year: 2024,
    taste: 'INTJ / ISTJ / ENTJ',
    note: '《Deep Work》作者新书。少做、做好、不焦虑——给被效率文化压垮的人。',
  },
  {
    title: 'Help Wanted',
    author: 'Adelle Waldman',
    year: 2024,
    taste: 'ISFJ / ESTJ / INFJ',
    note: '哈得逊河谷某连锁商超凌晨班的群像小说。蓝领、希望、被算法管理的尊严。',
  },

  // ── 法语 Nobel 中译 ───────────────────────────────────────
  {
    title: '简单的激情',
    original_title: 'Passion simple',
    author: '安妮·埃尔诺 Annie Ernaux',
    year: 2024,
    taste: 'INFP / INFJ / ENFP',
    note: '一段不对等情事的诚实记录。Ernaux 把欲望写成社会学田野。',
  },

  // ── 2026 ──────────────────────────────────────────────────
  // 我（Claude）的训练数据延伸到 2026 年 1 月，2026 年的"已上市新书"我能识别的极少
  // （多数 2026 新书在我训练时还是预告，没正式发售/没上豆瓣）。
  // 与其硬列让模型推一本豆瓣没有的书（→ 校验 fail → 重试浪费），不如等你读到/听说后
  // 确认豆瓣已收录再 append。
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
