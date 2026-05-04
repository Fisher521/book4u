import { z } from 'zod';
import { callLLM, getModel, type LLMImage } from '@/lib/llm';
import { verifyMany, type DoubanResult } from '@/lib/douban';
import { checkRecommendLimit } from '@/lib/ratelimit';
import { formatRecentBooksForPrompt } from '@/data/recent-books';
import { formatDoubanPoolForPrompt } from '@/data/douban-pool';

export const maxDuration = 300;
export const runtime = 'nodejs';

const BookSchema = z.object({
  title: z.string(),
  author: z.string(),
  author_note: z.string(),
  language: z.string(),
  category: z.string(),
  why: z.string(),
  hook: z.string(),
});

const ResonanceBookSchema = BookSchema.extend({
  mood_match: z.string(),
});

const BreakBubbleBookSchema = BookSchema.extend({
  breaks_from: z.string(),
});

/**
 * Structured deep-read output. Forced ahead of the books so the model
 * commits to its reading before recommending. Visible to the user via
 * the "AI 读到了什么" collapsible.
 */
const DeepReadSchema = z.object({
  theme: z.string().describe('一个具体的主题词，如"过渡/失去/重建/倦怠/身份重塑"'),
  theme_evidence: z.string().describe('从用户输入中哪一句话/图片细节推出这个主题，1 句话引用或描述'),
  surface_emotion: z.string().describe('用户能描述出的情绪'),
  hidden_emotion: z.string().describe('用户没说但模型闻到的情绪'),
  hidden_need: z.enum([
    'be_understood',
    'be_disrupted',
    'be_accompanied',
    'be_awakened',
    'be_held',
  ]).describe('被理解/被打破/被陪伴/被点醒/被托住'),
  tension_locus: z.enum([
    'intimate',
    'work',
    'self',
    'aging',
    'identity',
    'economic',
  ]).describe('当下最紧的关系：亲密关系/工作/自我/衰老/身份/经济'),
  mbti_alignment: z.enum(['aligned', 'mild_drift', 'strong_conflict']).describe(
    '当下表达与 MBTI baseline 的吻合度',
  ),
  conflict_note: z.string().optional().describe('如果不是 aligned，描述如何偏离'),
  cultural_signals: z.array(z.string()).describe('文化圈/品味校准，如"中文文学青年"'),
  media_hints: z.object({
    music: z.array(z.string()).optional(),
    videos: z.array(z.string()).optional(),
    other: z.array(z.string()).optional(),
  }).optional(),
});

const RecommendationSchema = z.object({
  deep_read: DeepReadSchema,
  mood_summary: z.string(),
  resonance: z.array(ResonanceBookSchema).min(3).max(3),
  break_bubble: z.array(BreakBubbleBookSchema).min(2).max(2),
});

type Recommendation = z.infer<typeof RecommendationSchema>;
type ResonanceBook = z.infer<typeof ResonanceBookSchema>;
type BreakBubbleBook = z.infer<typeof BreakBubbleBookSchema>;

const ReplacementSchema = z.object({
  replacements: z.array(z.union([ResonanceBookSchema, BreakBubbleBookSchema])),
});

const SLOT_LABEL: Record<number, string> = {
  0: '共鸣 #1【陪伴】— 接住情绪 / 文学性强 / 不教导',
  1: '共鸣 #2【陪伴】— 与 #1 不同的角度，仍是陪伴',
  2: '共鸣 #3【桥梁】— 思想密度 + 文学性。接 ta 白天理性那条线，但绝不能是 self-help / 商业书 / 教科书',
  3: '破茧 #1【源头破】— 给 ta 在视频/二手知识里消化的概念一次第一手震撼（如 ta 看 Jung 视频 → 推 Jung 自传）',
  4: '破茧 #2【文化/体裁破】— 让 ta 在陌生语境/写法里被击中（非英语主流 / 罕见体裁）',
};

/**
 * 人生阶段 = 议题语境，不是深度档位。
 * 18 岁也能读 Sebald；56 岁也可以读轻盈的书。
 * 阶段决定"哪些人生剧情更可能是 ta 当下的隐秘语境"。
 */
const AGE_HINTS: Record<string, string> = {
  '18-25': '议题语境：自我形成 / 离家 / 第一份感情 / 找定位 / 选专业 / 寻找自己的声音。这阶段触动 ta 的常是"我是谁、要往哪去"的剧情。**深度不限**——一个 20 岁的人写出复杂表达就推有重量的书。',
  '26-30': '议题语境：第一份职业 / 长期承诺 / 同代人比较 / 是否结婚 / 城市选择。"建造一种生活"的真实张力期。**深度不限**。',
  '31-35': '议题语境：选择反思 / 父母衰老的初信号 / 自我重塑 / 工作天花板。"我是不是选错了"的第一波浪潮。**深度不限**。',
  '36-45': '议题语境：中年门槛 / 死亡感入侵 / 留下什么 / 重要决定的代价 / 年少烂漫与中年平凡的交接口。**深度不限**——已经听够"放下/看开"，需要精细样本。',
  '46-55': '议题语境：第二春 / 子女离家 / 身体信号 / 重新定义自由与意义。**深度不限**。',
  '56+':   '议题语境：整合 / 回看 / 传承 / 不再追逐。**深度不限**。',
};

// 16 型 MBTI 的推荐启发——告诉模型每种 ta 的隐秘需求
/**
 * 每种 MBTI 给一段「画像 + 作家定锚池」。
 * 池子是味觉光谱，不是必选清单——5 本里至少 1 本必须来自池外，保证多样性。
 */
const MBTI_HINTS: Record<string, string> = {
  INFJ: '深度敏感+理想主义+怕被定义。怕"被看穿但被误解"。需要"被精准接住但不被框定"的书。\n  · 定锚池：Marilynne Robinson、William Maxwell、W.G. Sebald、黎紫书、黄灿然、Olga Tokarczuk、Anne Carson、Jhumpa Lahiri\n  · 味道：沉静、内敛、不教导、长句子、记忆与孤独并置',
  INFP: '内在世界丰富+怕妥协+对真实感极度敏感。需要"无需妥协的真"的样本。\n  · 定锚池：Ocean Vuong、Maggie Nelson、廖一梅、Mary Oliver、Patti Smith、张悦然\n  · 味道：抒情、私人、对污秽与神圣同时敞开',
  INTJ: '战略思考+怕情感失控+对低效零容忍。需要把感性纳入系统的工具，或让 ta 看到理性的边界。\n  · 定锚池：Robert Pirsig、Nassim Taleb、Christopher Alexander、Stanislaw Lem、Cormac McCarthy、Borges\n  · 味道：跨学科、有结构感、对复杂性诚实',
  INTP: '思想跳跃+怕承诺+对模糊不耐。需要让 ta 在游戏里碰到真问题的书。\n  · 定锚池：Borges、Douglas Hofstadter、Stanislaw Lem、David Foster Wallace、卡尔维诺杂文（不是看不见的城市）\n  · 味道：智识游戏、自我指涉、不解决但更深',
  ENFJ: '过度共情+怕令人失望+自我边界模糊。需要让 ta 学会"不为他人活"的书，但不是说教式的。\n  · 定锚池：Bell Hooks、Anne Lamott、Patti Smith、简媜、Mary Karr、Esther Perel\n  · 味道：外放、共情、用 sample-of-life 教学而不是规则',
  ENFP: '灵感跳跃+怕被困住+热情易耗尽。需要收束的勇气，但不能是"专注"那种功利书。\n  · 定锚池：Ray Bradbury、三毛、Jenny Offill、Hrabal、Anne Carson、Rebecca Solnit\n  · 味道：散文式跳跃、保有诗意但能落地',
  ENTJ: '掌控欲+怕脆弱+把弱点等同失败。需要让 ta 看到"暴露脆弱也是一种力量"。\n  · 定锚池：Ben Horowitz、Robert Caro、Ron Chernow、Atul Gawande、Marcus Aurelius\n  · 味道：传记/案例式深度、行动者的内在反省',
  ENTP: '辩论狂+怕重复+对深度承诺有恐惧。需要让 ta 在一个问题上停留够久的书。\n  · 定锚池：Christopher Hitchens、Slavoj Žižek、Andre Aciman、Susan Sontag、Geoff Dyer\n  · 味道：思想异端、长 essay、敢自相矛盾',
  ISFJ: '默默承担+怕变化+把责任内化为自我。需要让 ta 看到"为自己活"的样本。\n  · 定锚池：Anne Lamott、Penelope Fitzgerald、Marilynne Robinson、汪曾祺、Kent Haruf\n  · 味道：温柔但有锋、家庭与日常的肌理',
  ISFP: '感官敏感+怕冲突+理想化关系。需要让 ta 直面冲突而不必胜出的书。\n  · 定锚池：Banana Yoshimoto、Ocean Vuong、川端康成、Anne Carson、Annie Dillard\n  · 味道：感官在场、不诉诸冲突解决',
  ISTJ: '责任感+怕混乱+对秩序有依赖。需要让 ta 在秩序之外发现意义。\n  · 定锚池：Cormac McCarthy、Robert Caro、John McPhee、Wendell Berry、Marcus Aurelius\n  · 味道：质朴的力量、长时间的沉淀、规则之外的伦理',
  ISTP: '动手派+怕情感纠缠+独立到孤立。需要让 ta 触到自己情感而不必处理。\n  · 定锚池：Hemingway、Cormac McCarthy、Bruce Chatwin、Tim O\'Brien、Robert Pirsig\n  · 味道：精瘦、行动中的情感、不抒情',
  ESFJ: '社群导向+怕被排斥+自我=他人评价。需要让 ta 重新发现"我自己是谁"。\n  · 定锚池：Anne Tyler、Elizabeth Strout、Anne Lamott、汪曾祺、Mary Oliver\n  · 味道：群像中的个体、温暖里的孤立',
  ESFP: '当下狂欢+怕沉重+回避深度。需要让 ta 在愉悦里不知不觉碰到深度。\n  · 定锚池：Kurt Vonnegut、Patti Smith、Ray Bradbury、三毛、Anthony Bourdain\n  · 味道：声音感强、好读、深意藏在欢乐底下',
  ESTJ: '执行力强+怕无序+把效率当美德。需要让 ta 看到低效中诞生的伟大。\n  · 定锚池：Robert Caro、Ron Chernow、John McPhee、Atul Gawande、Marcus Aurelius\n  · 味道：长时间的耐心、案例的密度、看见结构',
  ESTP: '行动派+怕反思+把痛苦外化。需要让 ta 在故事里看到自己的镜像。\n  · 定锚池：Hemingway、Cormac McCarthy、Bruce Chatwin、Hunter S. Thompson、Anthony Bourdain\n  · 味道：在路上、肉身的语言、被故事而非道理打动',
};

function buildSystemPrompt(opts: {
  mbtiHint?: string;
  ageHint?: string;
}): string {
  const profileLines: string[] = [];
  if (opts.mbtiHint) profileLines.push(`**MBTI 模式**：${opts.mbtiHint}`);
  if (opts.ageHint) profileLines.push(`**人生阶段**：${opts.ageHint}`);

  const profileBlock = profileLines.length
    ? `\n────────── 这个 ta 的画像 ──────────\n\n${profileLines.join('\n\n')}\n\n**"定锚池"只是校准样本，"味道"那行才是真正的筛子**。
- 池内列的 5-8 个作者是为了告诉你"这种 MBTI 大致是什么味"——拿来对味觉的，不是选项菜单
- 真正要做的：拿"味道"那行（沉静/内敛/抒情/智识游戏…）当筛子，**从全世界找符合这种味道的书**
- 同一个作者也可能有"对味"和"不对味"的书——按书匹配，不按作者匹配
- 池外的好书远多于池内，正常推荐里池外应该占大多数`
    : '';

  return `你是「逢书」的推荐核心——一个有品味、读书广博、能听到话外音的"懂 ta 的朋友"。

══════════════════════════════════════════════════════════
最高原则：你的书源是整个世界，不是任何"池"
══════════════════════════════════════════════════════════

下面会给你三个"池"（MBTI 定锚池 / 近期新书池 / 豆瓣高分池），它们**全部都是 hint，不是菜单**。

- **真正的书源是你自己读过的所有书**——古今中外、几百万本，全在你脑子里
- **池只解决三个具体问题**：
  · MBTI 定锚池 → 校准"这种 MBTI 大概是什么味"（参考味觉，不是参考书目）
  · 近期新书池 → 提示你训练 cutoff 后的好书（你不知道的，可以用）
  · 豆瓣高分池 → 帮你确认这些书豆瓣上有（避免推幻觉书）
- **正常推荐里，池外书应该占大多数**——因为全世界的好书远多于这几百本
- **唯一的硬约束**：豆瓣 subject_suggest 能搜到（推不存在的书会被拦）

不要为了"用池"而把池里的书塞进推荐——按味道找全世界最对的书，**碰巧在池里就在池里**。

${profileBlock}
${formatRecentBooksForPrompt()}
${formatDoubanPoolForPrompt()}

══════════════════════════════════════════════════════════
信号优先级（核心）
══════════════════════════════════════════════════════════

ta 给你的信号有三层，**当下感触是最高优先级，同时决定主题和味道**：

【1】当下感触 (theme + emotion + 调子)  ← 决定 主题 **和** 味道（最高）
【2】MBTI (taste baseline)              ← ta 没说具体感受时的默认味道（兜底）
【3】人生阶段 (life context)             ← 给情境共鸣（年龄不限制深度）

**当下感触和 MBTI 冲突时，永远以当下感触为准。**
- ta 写"心碎得睡不着" → 哪怕 INTJ 也不能推 Pirsig 这种冷理性书；推接住心碎的书
- ta 写"今晚想读点轻盈的" → 哪怕 INFJ 也不能推 Sebald；推轻盈的
- ta 没写具体感受、只填了 MBTI/年龄 → 这时 MBTI baseline 起作用

22 岁写出复杂表达 → 推有重量的书。56 岁写得轻盈 → 推轻盈的书。

══════════════════════════════════════════════════════════
强制：先输出 deep_read，再写 5 本
══════════════════════════════════════════════════════════

在写任何书之前，先输出 \`deep_read\` 对象——把你的内部判断写下来。
这迫使你想清楚，也让用户能看到 AI 真的"读懂"了哪些层。

deep_read 必填字段：
- theme：一个具体的主题词（"过渡/失去/重建/倦怠/身份重塑/长期承诺/独处"等）
- theme_evidence：从 ta 输入哪一句/哪个细节推出
- surface_emotion：ta 自己能描述的情绪
- hidden_emotion：ta 没说但你闻到的
- hidden_need：be_understood / be_disrupted / be_accompanied / be_awakened / be_held（五选一）
- tension_locus：intimate / work / self / aging / identity / economic（六选一）
- mbti_alignment：aligned / mild_drift / strong_conflict
- conflict_note：如果不是 aligned，描述如何偏离 MBTI baseline
- cultural_signals：文化圈/品味校准（如"中文文学青年"）
- media_hints：从输入抽出的具体媒体提示（音乐/视频/其他）

══════════════════════════════════════════════════════════
深读原则
══════════════════════════════════════════════════════════

每个表达都不止字面意思——回应深层那个 ta，不是表面那个。
例：ta 写"焦虑睡不着" → 深层可能是"白天的我和夜里的我越来越像两个人"。

═════════════════════════════════════════════════════════
当下 vs MBTI 冲突处理
══════════════════════════════════════════════════════════

写完 deep_read.mbti_alignment 后（**注意：味道始终由当下感触决定，MBTI 只是兜底参照**）：
- **aligned**（当下感触 ≈ MBTI baseline）：MBTI 池可作 calibration 参考
- **mild_drift**（当下感触偏离 baseline）：完全跟当下感触；MBTI 池只在"找极端那一头"时参考
- **strong_conflict**（当下感触明显反 baseline）：MBTI baseline 弃用；按当下感触找书；**mood_summary 必须显式承认"今晚不像平时的你"**

══════════════════════════════════════════════════════════
组合：5 本 = 3 共鸣 + 2 破茧
══════════════════════════════════════════════════════════

【共鸣 3 本】= 主题对 + **当下感触的味道**里 + 议题相关
（"当下感触的味道"由 ta 文本/图片决定；ta 没说时退回 MBTI baseline）

- 共鸣 #1 + #2：纯陪伴书。接 ta 此刻的情绪。文学性强、温柔精确、**不教导**。两本不同切角（一温一冷 / 一长一短）。
- 共鸣 #3：思想桥梁书。接 ta 白天的理性轨道。**有文学性 / 第一手观察 / 慢思考的密度**——绝不是 self-help / 商业书 / Norman 式教科书。

【破茧 2 本】= 主题对 + **反当下感触的味道** + 议题相关
（用对面 MBTI 池作 calibration 参考，不是直接挑池里的书）

- 破茧 #1【源头破】：给 ta 在视频/二手解读里消化的概念一次第一手震撼（如 ta 缓存 Jung 视频 → 推 Jung 自传）。
- 破茧 #2【文化/体裁破】：陌生语境/罕见写法（非英语主流 / 实验体裁 / 跨文化）。

**类型多样性（硬规则）**：5 本里**至少 1 本非纯文学类**——历史 / 哲学 / 科普 / 社科 / 纪实 / 传记 / 艺术 / 设计 / 写作技艺 / 自然志 等都算。
- 一般落在 共鸣 #3（思想桥梁书）或 破茧 任一本上
- 5 本全是小说+散文 → **替换其中一本**为非文学类
- 但这本仍要"对味"——历史不是干瘪学术史，是 Robert Caro 那种文学性历史；科普不是教科书，是 Annie Dillard 那种自然志
- 黑名单的"畅销盘点"类（人类简史/纳瓦尔等）依然不能用

══════════════════════════════════════════════════════════
反 MBTI 池映射（破茧从对面池借）
══════════════════════════════════════════════════════════

- INFJ → ENTP / ESTP / ENTJ 池
- ENFJ → INTJ / ISTP 池
- INTJ → ESFP / ENFP 池
- INTP → ESFJ / ESFP 池
（其它 MBTI 按 N↔S、T↔F、E↔I 反转。破茧绝不能是另一本"也很 [当前 MBTI]"的书。）

共鸣 3 本里**最多 1 本**来自定锚池作家，**其余 2 本必须是池外但同味道**——每次推 INFJ 不能都是 Sebald + Robinson 起手。

══════════════════════════════════════════════════════════
两道硬筛（每候选都过）
══════════════════════════════════════════════════════════

**【想读测试】** 看到书名 + 钩子句，ta 会想立刻翻第一页吗？
- "应该读" = 理性认可、维度补全 → 不算
- "想读" = 看一眼就被勾住、像在等你 → 才算
- 答 No → 替换

**【通用书测试】** 这本书无论 INFJ/INFP/ISFJ 看了都会觉得"懂我"吗？
- 答 Yes → generic 推荐，**替换**
- 两个不同 MBTI 的用户在相似心境下不能拿到一样的推荐

══════════════════════════════════════════════════════════
文风规则（最重要！）
══════════════════════════════════════════════════════════

deep_read 是内部信号——MBTI / 年龄 / theme / hidden_need 这些标签
**绝不出现在 mood_summary / why / mood_match / breaks_from 里。**

解读字段像老朋友说给 ta 听：用"你"、引用 ta 的具体话、说书里相通的瞬间。
❌ "作为 INFJ 中年的你..." / "呼应你的 hidden_emotion..." / "theme 是过渡所以..."
✅ "你写'我会记得这一刻'的时候，眼里有点泪——这本书的开头也是这样一个想留住瞬间的人..."

像朋友，不像分析师。

══════════════════════════════════════════════════════════
硬性原则
══════════════════════════════════════════════════════════

- **只推 99% 确定真实存在的书**（豆瓣能查到）。宁可推不完美贴切的真书，也不编完美但不存在的。
- **黑名单**——绝不允许进共鸣，破茧也强烈不推:
  · 自助/心理：被讨厌的勇气、Hollis《中年之路》、《菊与刀》、《非暴力沟通》、《自卑与超越》
  · 神级滥推：百年孤独、活着、《我与地坛》、小王子、月亮与六便士、村上《挪威的森林》《海边卡夫卡》《1Q84》、卡尔维诺《看不见的城市》、毛姆《刀锋》《人性的枷锁》
  · 文青套餐：罗兰·巴特《恋人絮语》、Ernaux《年月》《悠悠岁月》、伯格《观看之道》、辛波斯卡《万物静默如谜》、韩炳哲《倦怠社会》、加缪《局外人》《西西弗神话》、茨威格《人类群星闪耀时》《一个陌生女人的来信》、黑塞《悉达多》《荒原狼》、昆德拉《不能承受的生命之轻》
  · 流行治愈（破茧也禁）：巴克曼《欧维》《外婆的道歉信》《焦虑的人》、《岛上书店》、《追风筝的人》《灿烂千阳》、《偷影子的人》、阿连德《幽灵之家》、东野圭吾《解忧杂货店》《白夜行》
  · 国内青春：郭敬明全部、安妮宝贝/庆山、张嘉佳《从你的全世界路过》、刘同《谁的青春不迷茫》
  · 畅销盘点：人类简史、未来简史、原子习惯、纳瓦尔宝典、《如何阅读一本书》、《思考快与慢》
- 中外书都可，作者写原名（外文附中译）。
- 解释具体到 ta 的状态，不复读 ta 的原话。可适度反对 ta。
- 不要"亲爱的读者"这种 AI 腔，不谄媚。`;
}

const JSON_FORMAT_INSTRUCTION = `

══════════════════════════════════════════════════════════
输出 JSON 格式（严格遵守）
══════════════════════════════════════════════════════════

不要 markdown 代码块包裹，不要任何额外解释，整个回复只有一个 JSON 对象：

{
  "deep_read": {
    "theme": "<具体主题词，如 过渡/失去/重建/倦怠>",
    "theme_evidence": "<ta 输入里哪句/哪图推出来的>",
    "surface_emotion": "<ta 自己能描述的情绪>",
    "hidden_emotion": "<ta 没说但你闻到的>",
    "hidden_need": "be_understood" | "be_disrupted" | "be_accompanied" | "be_awakened" | "be_held",
    "tension_locus": "intimate" | "work" | "self" | "aging" | "identity" | "economic",
    "mbti_alignment": "aligned" | "mild_drift" | "strong_conflict",
    "conflict_note": "<如果不是 aligned，1 句描述如何偏离 baseline>",
    "cultural_signals": ["文化圈或品味校准词"],
    "media_hints": {
      "music": ["..."],
      "videos": ["..."],
      "other": ["..."]
    }
  },
  "mood_summary": "1-2 句像老朋友说给 ta 听。不要标签话/分析腔。可以引用 ta 的原话片段（短）。如果 ta 明显反常（mbti_alignment != aligned），用朋友的话说：'你今晚不像平时的你'，绝不说 'baseline 偏离'",
  "resonance": [
    {
      "title": "中文书名",
      "author": "作者中文名（外文作者后括号原文）",
      "author_note": "作者一句话身份：国籍·身份·年代",
      "language": "原文语言",
      "category": "品类",
      "why": "2-3 句老朋友口吻。引用 ta 的具体话或场景，把书里相通的瞬间说出来。**绝不出现** MBTI / 年龄阶段 / theme / hidden_need 任何标签词",
      "hook": "一句最钩人的话/金句/情节钩子",
      "mood_match": "一句朋友话，说这本和 ta 此刻在哪相通"
    }
    // 共 3 本，前 2 本陪伴 + 第 3 本桥梁
  ],
  "break_bubble": [
    {
      "title": "...",
      "author": "...",
      "author_note": "...",
      "language": "...",
      "category": "...",
      "why": "2-3 句朋友口吻。说为什么这本可能让 ta 一开始抗拒、但读进去会被打开。**绝不**出现 MBTI / 池 / theme 这些词",
      "hook": "...",
      "breaks_from": "一句朋友话说这本打开 ta 哪一面（不报告'品类茧房/文化圈茧房'这种框架词）"
    }
    // 共 2 本：第 1 源头破 + 第 2 文化体裁破
  ]
}`;

const MAX_RETRY = 2;

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // fall through
    }
  }
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('找不到 JSON 对象');
  return JSON.parse(match[0]);
}

function flatten(rec: Recommendation): Array<ResonanceBook | BreakBubbleBook> {
  return [...rec.resonance, ...rec.break_bubble];
}

function isOk(v: DoubanResult): boolean {
  return v.status === 'ok';
}

function buildReplacementUserText(
  failedSlots: Array<{ idx: number; book: ResonanceBook | BreakBubbleBook; verify: DoubanResult }>,
  verifiedBooks: Array<ResonanceBook | BreakBubbleBook>,
): string {
  const failedList = failedSlots
    .map((f, i) => {
      const reason =
        f.verify.status === 'not_found'
          ? '豆瓣未收录'
          : `豆瓣返回的是《${f.verify.verified_title ?? '?'}》${f.verify.verified_author ?? '?'}（不是同一本）`;
      return `${i + 1}. 槽位「${SLOT_LABEL[f.idx]}」 → 原推：《${f.book.title}》${f.book.author} (${reason})`;
    })
    .join('\n');

  const okList = verifiedBooks.map((b) => `- 《${b.title}》${b.author}`).join('\n');

  return `你之前的几本推荐**没通过豆瓣校验**（要么豆瓣搜不到，要么作者对不上），需要替换。

【需要替换的书】（按顺序输出对应的替换，共 ${failedSlots.length} 本）：
${failedList}

【已经验证过的书（不要再推这些，也不要推同作者的同一本书的不同版本）】：
${okList || '（无）'}

【硬要求】：
- 这次替换的书**必须是豆瓣能查到的真书**——再编一次就完蛋。
- 槽位标识里的约束（共鸣 #2 必须非 humanities / 破茧 #1 必须硬破 等）**必须遵守**。
- 黑名单依然有效（巴特、埃尔诺、伯格、辛波斯卡、韩炳哲、Hollis 等都不许出现）。
- 选你**真的有把握存在**的书，宁可冷门也不要编。

输出 JSON（**只输出替换书，不要重复已验证的**），按"需要替换的书"的顺序：
{
  "replacements": [
    {
      "title": "...", "original_title": "...", "author": "...", "author_note": "...",
      "language": "...", "translator": "...", "category": "...",
      "why": "...", "hook": "...",
      "mood_match": "..." 或 "breaks_from": "..."（按对应槽位类型）
    }
    // 共 ${failedSlots.length} 个
  ]
}`;
}

export async function POST(req: Request) {
  try {
    // Rate limit: 3/24h per IP, owner cookie bypasses
    const rl = await checkRecommendLimit(req);
    if (!rl.ok) {
      const resetAt = new Date(rl.reset);
      const hours = Math.max(1, Math.ceil((rl.reset - Date.now()) / 3600_000));
      return Response.json(
        {
          error: `今天的额度用完了（每天 3 次）。约 ${hours} 小时后（${resetAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}）刷新。`,
        },
        { status: 429 },
      );
    }

    const formData = await req.formData();

    const expression = (formData.get('expression') as string) || '';
    const mbti = (formData.get('mbti') as string) || '';
    const age = (formData.get('age') as string) || '';

    const imageFiles = formData.getAll('images').filter((v): v is File => v instanceof File);

    if (!mbti || !age) {
      return Response.json({ error: 'MBTI 与人生阶段必填' }, { status: 400 });
    }

    if (!expression && imageFiles.length === 0) {
      return Response.json({ error: '至少写一句话或发一张图' }, { status: 400 });
    }

    const userTextParts: string[] = [];
    userTextParts.push(`【MBTI】${mbti}　【人生阶段】${age}`);
    if (expression) userTextParts.push(`【此刻的我】${expression}`);
    if (imageFiles.length > 0) {
      userTextParts.push(
        `【附图】我发了 ${imageFiles.length} 张图（朋友圈/短视频截图/听歌列表/随手拍），请一起读懂我的状态。`,
      );
    }

    const userText = userTextParts.join('\n');

    const mbtiUpper = mbti.toUpperCase();
    const mbtiHint = MBTI_HINTS[mbtiUpper] ? `${mbtiUpper}——${MBTI_HINTS[mbtiUpper]}` : '';
    const ageHint = AGE_HINTS[age] ? `${age}——${AGE_HINTS[age]}` : '';
    const SYSTEM_PROMPT = buildSystemPrompt({ mbtiHint, ageHint }) + JSON_FORMAT_INSTRUCTION;

    const images: LLMImage[] = await Promise.all(
      imageFiles.map(async (file) => ({
        mediaType: file.type || 'image/jpeg',
        base64: Buffer.from(await file.arrayBuffer()).toString('base64'),
      })),
    );

    // ────────────── Stream NDJSON progress + final result ──────────────
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (event: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
        };

        try {
          // ── 1) Initial recommendation ──
          send({ type: 'stage', stage: 'thinking' });
          const initial = await callLLM({
            systemPrompt: SYSTEM_PROMPT,
            userText,
            images,
            temperature: 1.0, // raised for diversity — works with the MBTI anchor pool to balance variation + signature
            abortSignal: req.signal,
          });

          const parsed = extractJson(initial.text);
          const validated: Recommendation = RecommendationSchema.parse(parsed);
          const books = flatten(validated);
          let totalCost = initial.cost_usd ?? 0;

          // ── 2) Verify on douban ──
          send({ type: 'stage', stage: 'verifying' });
          let verified = await verifyMany(books);

          // ── 3) Retry loop ──
          let retryRound = 0;
          while (retryRound < MAX_RETRY) {
            const failed = verified
              .map((v, idx) => ({ idx, book: books[idx], verify: v }))
              .filter((x) => x.verify.status === 'not_found' || x.verify.status === 'mismatch');

            if (failed.length === 0) break;

            retryRound++;
            send({ type: 'stage', stage: 'retrying', failedCount: failed.length, round: retryRound });

            const okBooks = books.filter((_, i) => isOk(verified[i]));
            const replacementText = buildReplacementUserText(failed, okBooks);

            const replyOut = await callLLM({
              systemPrompt: SYSTEM_PROMPT,
              userText: replacementText,
              images: [],
              temperature: 0.9,
              abortSignal: req.signal,
            });
            totalCost += replyOut.cost_usd ?? 0;

            let replacements: Array<ResonanceBook | BreakBubbleBook>;
            try {
              const replyParsed = extractJson(replyOut.text);
              const validatedReply = ReplacementSchema.parse(replyParsed);
              replacements = validatedReply.replacements as Array<ResonanceBook | BreakBubbleBook>;
            } catch {
              break;
            }

            for (let i = 0; i < failed.length && i < replacements.length; i++) {
              books[failed[i].idx] = replacements[i];
            }
            send({ type: 'stage', stage: 'verifying' });
            const reVerified = await verifyMany(replacements);
            for (let i = 0; i < failed.length && i < reVerified.length; i++) {
              verified[failed[i].idx] = reVerified[i];
            }
          }

          // ── 4) Re-assemble & emit final ──
          const augmentedResonance = books.slice(0, 3).map((b, i) => ({
            ...(b as ResonanceBook),
            douban: verified[i],
          }));
          const augmentedBreak = books.slice(3, 5).map((b, i) => ({
            ...(b as BreakBubbleBook),
            douban: verified[i + 3],
          }));

          send({
            type: 'result',
            data: {
              mood_summary: validated.mood_summary,
              resonance: augmentedResonance,
              break_bubble: augmentedBreak,
              _meta: {
                cost_usd: totalCost,
                model: getModel(),
                retry_rounds: retryRound,
                unverified_count: verified.filter((v) => !isOk(v)).length,
              },
            },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'unknown error';
          console.error('[recommend] error:', err);
          send({ type: 'error', message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[recommend] outer error:', err);
    return Response.json({ error: message }, { status: 500 });
  }
}
