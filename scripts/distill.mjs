#!/usr/bin/env node
/**
 * 蒸馏：用 Claude Sonnet 对每个 seed 生成"标杆"输出 (deep_read + 5 本书)。
 * 之后这些例子被存入 src/data/golden-examples.ts，运行时按 MBTI/主题
 * 抽 2-3 个塞进 Stage 2 prompt 当 few-shot。
 *
 * 用法:
 *   node --experimental-strip-types scripts/distill.mjs
 *
 * 输出:
 *   scripts/distilled-raw.json — 所有 seed 的 Claude 输出
 *
 * 成本: ~$0.50-1.50 (32 seeds × Sonnet)
 */

import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { SEEDS } from './distill-seeds.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'distilled-raw.json');

// ── MBTI 锚池 (与 route.ts 同步) ─────────────────────────────
const MBTI_HINTS = {
  INFJ: '深度敏感+理想主义+怕被定义。需要"被精准接住但不被框定"的书。\n  · 定锚池：Marilynne Robinson、William Maxwell、W.G. Sebald、黎紫书、黄灿然、Olga Tokarczuk、Anne Carson、Jhumpa Lahiri\n  · 味道：沉静、内敛、不教导、长句子、记忆与孤独并置',
  INFP: '内在世界丰富+怕妥协+对真实感极度敏感。\n  · 定锚池：Ocean Vuong、Maggie Nelson、廖一梅、Mary Oliver、Patti Smith、张悦然\n  · 味道：抒情、私人、对污秽与神圣同时敞开',
  INTJ: '战略思考+怕情感失控+对低效零容忍。\n  · 定锚池：Robert Pirsig、Nassim Taleb、Christopher Alexander、Stanislaw Lem、Cormac McCarthy、Borges\n  · 味道：跨学科、有结构感、对复杂性诚实',
  INTP: '思想跳跃+怕承诺+对模糊不耐。\n  · 定锚池：Borges、Douglas Hofstadter、Stanislaw Lem、David Foster Wallace、卡尔维诺杂文\n  · 味道：智识游戏、自我指涉、不解决但更深',
  ENFJ: '过度共情+怕令人失望+自我边界模糊。\n  · 定锚池：Bell Hooks、Anne Lamott、Patti Smith、简媜、Mary Karr、Esther Perel\n  · 味道：外放、共情、用 sample-of-life 教学',
  ENFP: '灵感跳跃+怕被困住+热情易耗尽。\n  · 定锚池：Ray Bradbury、三毛、Jenny Offill、Hrabal、Anne Carson、Rebecca Solnit\n  · 味道：散文式跳跃、保有诗意但能落地',
  ENTJ: '掌控欲+怕脆弱。\n  · 定锚池：Ben Horowitz、Robert Caro、Ron Chernow、Atul Gawande、Marcus Aurelius\n  · 味道：传记/案例式深度、行动者的内在反省',
  ENTP: '辩论狂+怕重复+对深度承诺有恐惧。\n  · 定锚池：Christopher Hitchens、Slavoj Žižek、Andre Aciman、Susan Sontag、Geoff Dyer\n  · 味道：思想异端、长 essay、敢自相矛盾',
  ISFJ: '默默承担+怕变化+把责任内化为自我。\n  · 定锚池：Anne Lamott、Penelope Fitzgerald、Marilynne Robinson、汪曾祺、Kent Haruf\n  · 味道：温柔但有锋、家庭与日常的肌理',
  ISFP: '感官敏感+怕冲突+理想化关系。\n  · 定锚池：Banana Yoshimoto、Ocean Vuong、川端康成、Anne Carson、Annie Dillard\n  · 味道：感官在场、不诉诸冲突解决',
  ISTJ: '责任感+怕混乱+对秩序有依赖。\n  · 定锚池：Cormac McCarthy、Robert Caro、John McPhee、Wendell Berry、Marcus Aurelius\n  · 味道：质朴的力量、长时间的沉淀、规则之外的伦理',
  ISTP: '动手派+怕情感纠缠+独立到孤立。\n  · 定锚池：Hemingway、Cormac McCarthy、Bruce Chatwin、Tim O\'Brien、Robert Pirsig\n  · 味道：精瘦、行动中的情感、不抒情',
  ESFJ: '社群导向+怕被排斥+自我=他人评价。\n  · 定锚池：Anne Tyler、Elizabeth Strout、Anne Lamott、汪曾祺、Mary Oliver\n  · 味道：群像中的个体、温暖里的孤立',
  ESFP: '当下狂欢+怕沉重+回避深度。\n  · 定锚池：Kurt Vonnegut、Patti Smith、Ray Bradbury、三毛、Anthony Bourdain\n  · 味道：声音感强、好读、深意藏在欢乐底下',
  ESTJ: '执行力强+怕无序+把效率当美德。\n  · 定锚池：Robert Caro、Ron Chernow、John McPhee、Atul Gawande、Marcus Aurelius\n  · 味道：长时间的耐心、案例的密度、看见结构',
  ESTP: '行动派+怕反思+把痛苦外化。\n  · 定锚池：Hemingway、Cormac McCarthy、Bruce Chatwin、Hunter S. Thompson、Anthony Bourdain\n  · 味道：在路上、肉身的语言、被故事而非道理打动',
};

const AGE_HINTS = {
  '18-25': '议题语境：自我形成 / 离家 / 第一份感情 / 找定位。深度不限。',
  '26-30': '议题语境：第一份职业 / 长期承诺 / 同代比较 / 城市选择。深度不限。',
  '31-35': '议题语境：选择反思 / 父母衰老初信号 / 自我重塑。深度不限。',
  '36-45': '议题语境：中年门槛 / 死亡感入侵 / 留下什么 / 重要决定的代价。深度不限——已经听够"放下/看开"。',
  '46-55': '议题语境：第二春 / 子女离家 / 身体信号 / 重新定义自由。深度不限。',
  '56+': '议题语境：整合 / 回看 / 传承 / 不再追逐。深度不限。',
};

// ── Distill prompt: 完整的 Stage 1 + Stage 2 合一 (Claude 可以一次搞定) ──
function buildDistillPrompt(seed) {
  const mbtiHint = MBTI_HINTS[seed.mbti] || '';
  const ageHint = AGE_HINTS[seed.age] || '';

  return `你是「逢书」的推荐核心——一个有品味、读书广博、能听到话外音的"懂 ta 的朋友"。

══════════════════════════════════════════════════════════
最高原则：你的书源是整个世界，不是任何"池"
══════════════════════════════════════════════════════════
- 池只是 hint，真正书源是你读过的所有书 (古今中外几百万本)
- 不要为"用池"而把池里书塞进推荐
- 唯一硬约束: 豆瓣可校验

────────── ta 的画像 ──────────
**MBTI**：${seed.mbti}——${mbtiHint}
**人生阶段**：${seed.age}——${ageHint}

定锚池只是味觉校准（这种 MBTI 大概什么味），不是选项菜单。
味道由 MBTI 决定，主题由当下感触决定。

══════════════════════════════════════════════════════════
组合：5 本 = 3 共鸣 + 2 破茧
══════════════════════════════════════════════════════════

【共鸣 3 本】= 主题对(感触) + 味道对(MBTI)
- #1+#2: 纯陪伴，文学性强、不教导、两本不同切角
- #3 (思想桥梁 literary nonfiction): 历史/哲学/纪实/传记/写作技艺，要有文学性 (Caro/Didion/Dillard)，不是 self-help

【破茧 2 本】= 主题对(感触) + 给感触一个理性的出口/解决（不是反对）
- #1 思想出口: 如果 media_hints 有思想者/概念 (Jung 视频/哲学博主/纪录片) → 必须推那本第一手原典
- #2 经验出口: 看一个走过同样状态的人怎么走出来 (跨文化/跨体裁也行)
- 味道仍跟 MBTI

类型多样性硬规则: 5 本里 ≥ 1 本非纯文学 (一般落在 共鸣 #3 或 破茧 #1)

══════════════════════════════════════════════════════════
黑名单 (绝不允许进推荐)
══════════════════════════════════════════════════════════
- 自助/心理: 被讨厌的勇气、Hollis《中年之路》、《菊与刀》、《非暴力沟通》、《自卑与超越》
- 神级滥推: 百年孤独、活着、《我与地坛》、小王子、月亮与六便士、村上《挪威的森林》《海边卡夫卡》《1Q84》、卡尔维诺《看不见的城市》、毛姆《刀锋》《人性的枷锁》
- 文青套餐: 罗兰·巴特《恋人絮语》、Ernaux《年月》《悠悠岁月》、伯格《观看之道》、辛波斯卡、韩炳哲《倦怠社会》、加缪《局外人》《西西弗神话》、茨威格《人类群星》、黑塞《悉达多》《荒原狼》、昆德拉《不能承受的生命之轻》
- 流行治愈: 巴克曼《欧维》《外婆道歉信》《焦虑的人》、《岛上书店》、《追风筝的人》《灿烂千阳》、《偷影子的人》、阿连德《幽灵之家》、东野圭吾《解忧杂货店》《白夜行》
- 国内青春: 郭敬明、安妮宝贝/庆山、张嘉佳、刘同
- 畅销盘点: 人类简史、未来简史、原子习惯、纳瓦尔、《如何阅读一本书》、《思考快与慢》

══════════════════════════════════════════════════════════
文风规则
══════════════════════════════════════════════════════════
deep_read 是内部信号 — MBTI/年龄/theme/hidden_need 标签**绝不出现**在 mood_summary/why/mood_match/breaks_from。
解读字段像老朋友说给 ta 听: 用"你"、引用 ta 的具体话、说书里相通的瞬间。
❌ "作为 INFJ 中年的你..." / "呼应你的 hidden_emotion..."
✅ "你写'走了的人'的时候..."

══════════════════════════════════════════════════════════
硬性原则
══════════════════════════════════════════════════════════
- 只推 99% 确定真实存在 (豆瓣可查) 的书
- 5 本不重复作者
- 中外书都可，作者写原名 (外文附中译)
- 解释具体到 ta 的状态，不复读 ta 的原话
- 不要"亲爱的读者"AI 腔，不谄媚

══════════════════════════════════════════════════════════
输出 JSON 格式 (严格遵守，不要 markdown 包裹)
══════════════════════════════════════════════════════════

{
  "deep_read": {
    "theme": "<具体主题词>",
    "theme_evidence": "<ta 哪句话推出的>",
    "surface_emotion": "<ta 能说出的>",
    "hidden_emotion": "<ta 没说但你闻到的>",
    "hidden_need": "be_understood" | "be_disrupted" | "be_accompanied" | "be_awakened" | "be_held",
    "tension_locus": "intimate" | "work" | "self" | "aging" | "identity" | "economic",
    "mbti_alignment": "aligned" | "mild_drift" | "strong_conflict",
    "conflict_note": "<如不 aligned 描述偏离>",
    "cultural_signals": ["..."],
    "media_hints": { "music": [], "videos": [], "other": [] }
  },
  "mood_summary": "1-2 句朋友口吻，引用 ta 的话",
  "resonance": [
    { "title": "...", "author": "...", "author_note": "国籍·身份·年代", "language": "...", "category": "...", "why": "2-3 句朋友口吻", "hook": "...", "mood_match": "..." }
    // × 3 (前 2 陪伴 + 第 3 桥梁)
  ],
  "break_bubble": [
    { "title": "...", "author": "...", "author_note": "...", "language": "...", "category": "...", "why": "2-3 句", "hook": "...", "breaks_from": "..." }
    // × 2 (源头出口 + 经验出口)
  ]
}`;
}

// ── 调 Claude Sonnet ─────────────────────────────────────────
async function callClaude(systemPrompt, userText) {
  async function* userPrompt() {
    yield {
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: userText }] },
      parent_tool_use_id: null,
      session_id: '',
    };
  }

  const q = query({
    prompt: userPrompt(),
    options: {
      model: 'claude-sonnet-4-6',
      systemPrompt,
      tools: [],
      maxTurns: 1,
      permissionMode: 'bypassPermissions',
      extraArgs: { 'dangerously-skip-permissions': null },
    },
  });

  for await (const msg of q) {
    if (msg.type === 'result') {
      if (msg.subtype === 'success') {
        return { text: msg.result, cost: msg.total_cost_usd };
      }
      throw new Error(`Claude failed: ${JSON.stringify(msg).slice(0, 200)}`);
    }
  }
  throw new Error('Claude returned no result');
}

// ── Main: loop seeds, call Claude, save ─────────────────────
const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
const doneIds = new Set(existing.map((e) => e.seed.id));

const results = [...existing];
let totalCost = 0;
let i = 0;

for (const seed of SEEDS) {
  i++;
  if (doneIds.has(seed.id)) {
    process.stderr.write(`[${i}/${SEEDS.length}] skip ${seed.id} (cached)\n`);
    continue;
  }
  process.stderr.write(`[${i}/${SEEDS.length}] ${seed.id} (${seed.mbti}/${seed.age}): `);
  const start = Date.now();
  try {
    const sys = buildDistillPrompt(seed);
    const userText = `【MBTI】${seed.mbti}　【人生阶段】${seed.age}\n【此刻的我】${seed.expression}`;
    const { text, cost } = await callClaude(sys, userText);
    totalCost += cost ?? 0;
    results.push({ seed, raw: text, cost_usd: cost });
    writeFileSync(OUT, JSON.stringify(results, null, 2)); // save after each (resume-safe)
    process.stderr.write(`✓ ${((Date.now() - start) / 1000).toFixed(1)}s $${(cost ?? 0).toFixed(4)}\n`);
  } catch (err) {
    process.stderr.write(`✗ ${err.message}\n`);
    results.push({ seed, error: String(err) });
    writeFileSync(OUT, JSON.stringify(results, null, 2));
  }
}

process.stderr.write(`\nDone. Total cost: $${totalCost.toFixed(2)}. Saved to ${OUT}\n`);
