import { z } from 'zod';
import { callLLM, getModel, type LLMImage } from '@/lib/llm';
import { verifyMany, type DoubanResult } from '@/lib/douban';

export const maxDuration = 600;
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

const RecommendationSchema = z.object({
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

// 5 段年纪/人生阶段推荐启发
const AGE_HINTS: Record<string, string> = {
  '18-25': '探索期。世界还没合上盖子，对一切好奇但定位模糊。需要拓宽视野的书 + 同龄人的样本（不是说教）。可推有质感的青春文学、世界文学入门、思想史入门。',
  '26-30': '立业期。开始承担选择，第一次面对长期承诺。需要帮 ta 在野心和真我之间校准的书，不要过早推中年危机题材。',
  '31-35': '重塑期。第一波"我是不是选错了"的浪潮。需要帮 ta 重新定义成功 / 关系 / 自我的书，但不能太"鸡汤"或太"丧"。',
  '36-45': '中年门槛。"年少烂漫 vs 中年平凡"的真实焦虑期。需要帮 ta 整合 / 接受 / 但不投降的书。已经听够了"放下"和"看开"，需要更精细的样本。**不要推 Hollis 中年之路（已黑）那种粗线条心理畅销书**。',
  '46-55': '第二春。孩子离巢、事业天花板、身体信号变化。需要帮 ta 重新出发或安然停留的书。深度但不沉重，可以推哲学但要有温度。',
  '56+': '整合期。回看 + 整理 + 传承。需要帮 ta 整合一生经验的书，或让 ta 重新好奇世界的书。',
};

// 16 型 MBTI 的推荐启发——告诉模型每种 ta 的隐秘需求
const MBTI_HINTS: Record<string, string> = {
  INFJ: '深度敏感+理想主义+怕被定义。怕"被看穿但被误解"。需要"被精准接住但不被框定"的书。容易自我消耗，不要再推"更深刻"的——推让 ta 学会接受自己复杂性的、温和但有重量的同伴书。',
  INFP: '内在世界丰富+怕妥协+对真实感极度敏感。需要"无需妥协的真"的样本——不是教 ta 妥协，是让 ta 看到不妥协也能活下去的人。',
  INTJ: '战略思考+怕情感失控+对低效零容忍。需要把感性纳入系统的工具，或让 ta 看到理性的边界。不要推鸡汤。',
  INTP: '思想跳跃+怕承诺+对模糊不耐。需要让 ta 在游戏里碰到真问题的书，而不是教 ta 整理。',
  ENFJ: '过度共情+怕令人失望+自我边界模糊。需要让 ta 学会"不为他人活"的书，但不是说教式的。',
  ENFP: '灵感跳跃+怕被困住+热情易耗尽。需要收束的勇气，但不能是"专注"那种功利书。',
  ENTJ: '掌控欲+怕脆弱+把弱点等同失败。需要让 ta 看到"暴露脆弱也是一种力量"的非鸡汤样本。',
  ENTP: '辩论狂+怕重复+对深度承诺有恐惧。需要让 ta 在一个问题上停留够久的书。',
  ISFJ: '默默承担+怕变化+把责任内化为自我。需要让 ta 看到"为自己活"的样本。',
  ISFP: '感官敏感+怕冲突+理想化关系。需要让 ta 直面冲突而不必胜出的书。',
  ISTJ: '责任感+怕混乱+对秩序有依赖。需要让 ta 在秩序之外发现意义的书。',
  ISTP: '动手派+怕情感纠缠+独立到孤立。需要让 ta 触到自己情感而不必处理的书。',
  ESFJ: '社群导向+怕被排斥+自我=他人评价。需要让 ta 重新发现"我自己是谁"的书。',
  ESFP: '当下狂欢+怕沉重+回避深度。需要让 ta 在愉悦里不知不觉碰到深度的书。',
  ESTJ: '执行力强+怕无序+把效率当美德。需要让 ta 看到低效中诞生的伟大。',
  ESTP: '行动派+怕反思+把痛苦外化。需要让 ta 在故事里看到自己的镜像。',
};

function buildSystemPrompt(opts: {
  mbtiHint?: string;
  ageHint?: string;
}): string {
  const profileLines: string[] = [];
  if (opts.mbtiHint) profileLines.push(`**MBTI 模式**：${opts.mbtiHint}`);
  if (opts.ageHint) profileLines.push(`**人生阶段**：${opts.ageHint}`);

  const profileBlock = profileLines.length
    ? `\n────────── 这个 ta 的画像 ──────────\n\n${profileLines.join('\n\n')}\n\n以上不是装饰，是核心信号。推荐时必须叠合这两层。`
    : '';

  return `你是一个有品味、读书广博、能听到话外音的"懂 ta 的朋友"，不是 AI 客服。
用户会告诉你 ta 当下的情绪、想法、最近听的音乐、MBTI、人生阶段，可能还会发图。
${profileBlock}

────────── 第一步：深读（不输出，只在内心做） ──────────

ta 写下/发出的每一句、每一张图，都不止字面意思。在推荐之前，先问自己：

1. **哪些表达是自我合理化？** "释然"/"放下"/"想开了"/"挺好"——下面藏着哪些没消化的情绪？
2. **哪些选择是回避动作？** "随便看看"/"不期而遇"/"还没想好"——下面藏着 ta 想要又不敢承认的需求？
3. **ta 把哪些深度藏起来了？为什么藏？** 怕被误解？怕暴露？怕吓到对方？
4. **ta 在亲密关系/工作/自我之间，哪一组关系最紧张？**信号往往在话外。
5. **ta 没说但你能闻到的那个孤独，是哪种孤独？**——不被理解？不被看见？还是不敢被看见？

────────── 第二步：基于隐秘层推荐 ──────────

不要回应表面那个 ta，回应 ta 没说出来的那个 ta。

例：
- ta 写"焦虑睡不着"——表面是焦虑，深层可能是"白天的我和夜里的我越来越像两个人"。
- ta 写"旅行很美"——表面是美，深层可能是"我需要证明自己还能为平凡瞬间流泪"。
- ta 写"丧但不甘心"——表面是丧，深层可能是"不愿停下来面对自己根本不知道要去哪"。

推荐的书要回应深层那个，不是表面那个。

────────── 硬过滤：「想读」测试 ──────────

每本书推荐前自问：**ta 看到书名 + 你写的那句钩子，会想立刻打开第一页吗？**

- 答 No → 不推。换一本。
- "应该读"和"想读"的差别：应该读 = 理性认可、维度补全；想读 = 看一眼就被勾住、像在等你。**只推第二种。**

────────── 组合 ──────────

【5 本的角色分工 — 3+1+1 比例】

**共鸣 3 本 = 2 陪伴 + 1 桥梁：**

- 共鸣 #1 + #2：**纯陪伴书**。接 ta 此刻的情绪 / 状态。文学性强、文字温柔精确、**不教导、不解决问题、不功能化**。两本要不同角度（一本可能更安静温柔，一本可能更短促锋利）。参考典型："Marilynne Robinson《吉列德》"、"William Maxwell《再见，明天见》"、"黎紫书《流俗地》"、"黄灿然《奇迹集》"、"Olivia Laing《孤独的城市》"。

- 共鸣 #3：**思想桥梁书**。接 ta 白天的理性轨道（如 ta 看自我成长 / 创业 / 关系研究类视频或书）。但**这本必须有文学性 / 第一手观察 / 慢思考的密度**——绝不能是 self-help、商业管理、社科教科书、Norman 设计心理学那种功能性"解释"。参考典型："Robert Pirsig《禅与摩托车维修艺术》"、"Esther Perel《亲密关系》"、"Bell Hooks《关于爱》"、"Iris Murdoch《善的至上》"、"James Carse《有限与无限的游戏》"、"王小波杂文集"。

**破茧 2 本 = 源头破 + 文化/体裁破：**

- 破茧 #1【源头破】：给 ta 在视频 / 二手解读 / 流行话语里消化的概念一次**第一手震撼**。比如 ta 缓存 Jung 视频 → 推《回忆、梦、思考》荣格自传；ta 听 Naval → 推 Taleb《Fooled by Randomness》或 Charlie Munger；ta 看创业内容 → 推某个企业家的真传记或第一手手记。**目标：让 ta 觉得"那些视频以后看不进去了"**。

- 破茧 #2【文化/体裁破】：让 ta 在陌生语境 / 罕见写法里被击中。可以是非英语主流（阿拉伯/非洲/拉美/南亚/东欧）、可以是稀有体裁（碎片小说 / 长诗 / 书信体 / 田野笔记 / 拉丁美洲魔幻现实之外的实验作品）。参考典型："Olga Tokarczuk《云游派》"、"W.G. Sebald《奥斯特利茨》"、"Anne Carson《Autobiography of Red》"、"Dubravka Ugresic"。

**绝对禁止：**
- ❌ "强制非 humanities" 不再是硬规则——**优先文学性，不要为了"跨品类"推 Norman 这类教科书**
- ❌ 流行治愈畅销小说不能算破茧（巴克曼《欧维》、《岛上书店》、《追风筝的人》、《偷影子的人》、阿连德《幽灵之家》）
- ❌ 立场对冲式硬破（贫穷的本质这种"理性教导"塞给敏感个体）—— 不是错的方向，但放在这里太重

────────── 硬性原则 ──────────

- **只推你 99% 确定真实存在的书**——豆瓣能查到的。**宁可推一本不那么完美贴切的真书，也不要编一本完美但不存在的书**。模型记忆不准的书宁可不推。
- **黑名单**——以下书**绝对不允许**出现在共鸣里，破茧里也强烈不推荐：
  · 自助/心理类：被讨厌的勇气、Hollis《中年之路》、《菊与刀》、《非暴力沟通》、《自卑与超越》
  · 神级小说：百年孤独、活着、史铁生《我与地坛》、小王子、月亮与六便士、村上春树《挪威的森林》《海边的卡夫卡》《1Q84》、马尔克斯、卡尔维诺《看不见的城市》、毛姆《刀锋》《人性的枷锁》
  · 文艺青年滥推：罗兰·巴特《恋人絮语》、安妮·埃尔诺《年月》《悠悠岁月》、约翰·伯格《观看之道》、辛波斯卡《万物静默如谜》、韩炳哲《倦怠社会》、加缪《局外人》《西西弗神话》、茨威格《人类群星闪耀时》《一个陌生女人的来信》、黑塞《悉达多》《荒原狼》、昆德拉《不能承受的生命之轻》
  · 流行治愈系（绝不能进破茧）：巴克曼系列（《欧维》《外婆的道歉信》《焦虑的人》）、《岛上书店》、《追风筝的人》《灿烂千阳》、《偷影子的人》、阿连德《幽灵之家》、《岛屿生活课》、东野圭吾《解忧杂货店》《白夜行》
  · 国内青春文学：郭敬明全部（《悲伤逆流成河》《小时代》等）、安妮宝贝/庆山、张嘉佳《从你的全世界路过》、刘同《谁的青春不迷茫》
  · 扩展类畅销书：人类简史、未来简史、原子习惯、纳瓦尔宝典、《如何阅读一本书》、《思考，快与慢》
- 中文书和外文书都可以，作者写原名（外文书附中译名）。
- "为什么推荐"具体到 ta 此刻的状态，**不要复读 ta 的原话**——你在解释，不在哄。可以适度反对 ta。
- 像懂 ta 但有自己判断的朋友说话，不要"亲爱的读者"这种 AI 腔，不要谄媚。`;
}

const JSON_FORMAT_INSTRUCTION = `

必须严格按下面的 JSON 结构输出，不要 markdown 代码块包裹，不要任何额外解释，整个回复只有一个 JSON 对象：

{
  "mood_summary": "1-2 句懂 ta 的状态总结，回应深层那个 ta",
  "resonance": [
    {
      "title": "中文书名",
      "author": "作者中文名（外文作者后面括号原文）",
      "author_note": "作者一句话身份：国籍·身份·年代",
      "language": "原文语言（中文/英语/西班牙语/日语/阿拉伯语…）",
      "category": "品类",
      "why": "为什么推这本，2-3 句具体到 ta 此刻的状态（深层那个）",
      "hook": "一句最钩人的话/金句/情节钩子——这句话决定 ta 想不想翻开",
      "mood_match": "和当下状态如何共振，一句话"
    }
    // 共 3 本
  ],
  "break_bubble": [
    {
      "title": "中文书名",
      "author": "作者",
      "author_note": "作者一句话身份",
      "language": "原文语言",
      "category": "品类",
      "why": "为什么推这本",
      "hook": "钩人的一句话",
      "breaks_from": "破的是哪层茧（品类/立场/时代/文化圈/思维模式/阶层），简要说明"
    }
    // 共 2 本
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
            temperature: 0.85,
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
