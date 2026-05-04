/**
 * 蒸馏 seed inputs — 32 个真实场景，覆盖 16 种 MBTI × 2 each。
 * 每对里一个带 media_hints (B站/电影/博主) 一个不带，年龄分散。
 */

export type DistillSeed = {
  id: string;
  mbti: string;
  age: string;
  expression: string;
  mood_tags: string[]; // 用于运行时按主题匹配
  has_media: boolean;
};

export const SEEDS: DistillSeed[] = [
  // ── NF: INFJ ──
  {
    id: 'infj-1',
    mbti: 'INFJ', age: '36-45',
    expression: '最近心碎得睡不着，总想起一个走了的人。白天还得开会。B 站缓存了好多荣格的视频但没看完。',
    mood_tags: ['丧失', '心碎', '中年', '失眠'], has_media: true,
  },
  {
    id: 'infj-2',
    mbti: 'INFJ', age: '26-30',
    expression: '最近一直在做一件其实没人逼我的事。完成的时候反而不开心。我是不是在用忙碌逃什么。',
    mood_tags: ['倦怠', '自我怀疑', '逃避'], has_media: false,
  },
  // ── NF: INFP ──
  {
    id: 'infp-1',
    mbti: 'INFP', age: '18-25',
    expression: '刚毕业三个月，每天上下班路上听廖一梅的播客。觉得自己在变成那种"被生活吸走灵魂"的人。',
    mood_tags: ['初入职场', '理想破灭', '自我流失'], has_media: true,
  },
  {
    id: 'infp-2',
    mbti: 'INFP', age: '31-35',
    expression: '一直想写一本书，写了几年都没成。现在翻开自己以前的稿，感觉那个写它的人比现在的我更相信什么。',
    mood_tags: ['创作瓶颈', '自我比较', '理想落差'], has_media: false,
  },
  // ── NF: ENFJ ──
  {
    id: 'enfj-1',
    mbti: 'ENFJ', age: '36-45',
    expression: '我妈最近被诊断得了阿尔茨海默症。我有三个月没敢和我朋友提这件事。我习惯了照顾别人，不知道怎么被照顾。',
    mood_tags: ['父母衰老', '照顾者', '不会求助'], has_media: false,
  },
  {
    id: 'enfj-2',
    mbti: 'ENFJ', age: '26-30',
    expression: '小红书上看了好多"如何给自己设界限"的内容。点了赞，但回到工作还是被动接活。是不是设界限对我来说就是太自私？',
    mood_tags: ['过度共情', '边界感', '自我怀疑'], has_media: true,
  },
  // ── NF: ENFP ──
  {
    id: 'enfp-1',
    mbti: 'ENFP', age: '26-30',
    expression: '同时在做四个项目。每个都让我兴奋过 3 天。现在没一个让我兴奋了。要不要全停掉。',
    mood_tags: ['热情耗尽', '专注难', '焦虑'], has_media: false,
  },
  {
    id: 'enfp-2',
    mbti: 'ENFP', age: '36-45',
    expression: '中年了，朋友圈里所有人都在结婚生子买房，我刚辞职去学陶艺。看了几部是枝裕和的电影但是越看越虚。',
    mood_tags: ['同侪压力', '另类人生', '中年虚无'], has_media: true,
  },
  // ── NT: INTJ ──
  {
    id: 'intj-1',
    mbti: 'INTJ', age: '31-35',
    expression: '我做了一个我精确分析过的最优职业选择。三年了它在每一项数据上都正确。但我每天醒来都在问：那为什么我没在活。',
    mood_tags: ['理性 vs 感性', '系统失灵', '存在性危机'], has_media: false,
  },
  {
    id: 'intj-2',
    mbti: 'INTJ', age: '26-30',
    expression: '在追 Sapolsky 关于 free will 的讲座。看完第三个 video，开始怀疑自己每一个决定都不是"我"做的。这种感觉持续了一周。',
    mood_tags: ['决定论', '自由意志', '认知颠覆'], has_media: true,
  },
  // ── NT: INTP ──
  {
    id: 'intp-1',
    mbti: 'INTP', age: '18-25',
    expression: '同时在读 6 本书没读完一本。在 Notion 里有 200 个想法但没动手做一个。我是真的好奇还是在用好奇逃避做。',
    mood_tags: ['过度发散', '完成困难', '自我怀疑'], has_media: false,
  },
  {
    id: 'intp-2',
    mbti: 'INTP', age: '31-35',
    expression: '最近在 YouTube 看了几个 Hofstadter 关于 strange loop 的访谈。开始觉得自己不是一个统一的"我"。但这种领悟没让我更轻松，反而更卡。',
    mood_tags: ['自我消解', '智识焦虑', '动弹不得'], has_media: true,
  },
  // ── NT: ENTJ ──
  {
    id: 'entj-1',
    mbti: 'ENTJ', age: '36-45',
    expression: '上周公司裁了我带的整个组。我做了所有该做的事，结果没一个能保住。第一次觉得"掌控"是个幻觉。',
    mood_tags: ['失败', '掌控破灭', '中年挫折'], has_media: false,
  },
  {
    id: 'entj-2',
    mbti: 'ENTJ', age: '46-55',
    expression: '在听 Robert Caro 写 LBJ 的有声书。他写权力的细节让我又兴奋又怕——我意识到自己也在用同样的方式管人。',
    mood_tags: ['权力反思', '自我审视', '案例对照'], has_media: true,
  },
  // ── NT: ENTP ──
  {
    id: 'entp-1',
    mbti: 'ENTP', age: '26-30',
    expression: '我最擅长在饭局上让所有人开心。但散场后一个人走路回家的那 20 分钟，是我一天最不知道自己是谁的时候。',
    mood_tags: ['表演性自我', '孤独', '社交后空虚'], has_media: false,
  },
  {
    id: 'entp-2',
    mbti: 'ENTP', age: '31-35',
    expression: '听 Žižek 的 podcast 听到第 30 集。我开始用他的话术解构身边所有事，包括我自己的感情。我女朋友说她受不了了。',
    mood_tags: ['过度智识化', '亲密关系', '辩论病'], has_media: true,
  },
  // ── SF: ISFJ ──
  {
    id: 'isfj-1',
    mbti: 'ISFJ', age: '36-45',
    expression: '孩子上中学住校了。家里安静下来后，我才发现我已经十年没有"自己想做的事"。',
    mood_tags: ['空巢', '自我重启', '迟到的自由'], has_media: false,
  },
  {
    id: 'isfj-2',
    mbti: 'ISFJ', age: '26-30',
    expression: '抖音刷到很多"孝顺是一场情感勒索"的视频。觉得很对，但回家见到我妈又什么都说不出口。',
    mood_tags: ['原生家庭', '内疚', '观念 vs 情感'], has_media: true,
  },
  // ── SF: ISFP ──
  {
    id: 'isfp-1',
    mbti: 'ISFP', age: '18-25',
    expression: '一直觉得自己感情很丰富，但最近恋爱时反而麻木。是不是太多次假装"没事"，最后真的没事了。',
    mood_tags: ['情感隔绝', '麻木', '亲密关系'], has_media: false,
  },
  {
    id: 'isfp-2',
    mbti: 'ISFP', age: '31-35',
    expression: '一直在听一些古典乐——Schubert 的弦乐五重奏 D956 第二乐章循环了好多天。说不出为什么但听完会哭。',
    mood_tags: ['说不出的悲伤', '美感', '音乐'], has_media: true,
  },
  // ── SF: ESFJ ──
  {
    id: 'esfj-1',
    mbti: 'ESFJ', age: '46-55',
    expression: '退休后的第一年。组里同事还会找我帮忙，我每次都接。我害怕一旦不再"被需要"，我就消失了。',
    mood_tags: ['退休', '身份失落', '过度负责'], has_media: false,
  },
  {
    id: 'esfj-2',
    mbti: 'ESFJ', age: '26-30',
    expression: '看了《海边的曼彻斯特》。一晚上没睡。那种"有些悲伤就是没法解决"的设定击中我了——我一直以为我能把所有事都搞定。',
    mood_tags: ['悲剧承认', '电影震撼', '掌控幻觉'], has_media: true,
  },
  // ── SF: ESFP ──
  {
    id: 'esfp-1',
    mbti: 'ESFP', age: '18-25',
    expression: '从来没认真想过"未来"两个字。今年身边好几个朋友都在考公，我突然慌了，但也不知道慌什么。',
    mood_tags: ['延迟规划', '同侪焦虑', '未来虚无'], has_media: false,
  },
  {
    id: 'esfp-2',
    mbti: 'ESFP', age: '31-35',
    expression: '在看《我的天才女友》小说和剧。Lila 让我想起我自己——那种又烈又乱、被生活反复打又站起来的女孩，现在快没力气了。',
    mood_tags: ['女性命运', '中年疲惫', '镜像自我'], has_media: true,
  },
  // ── ST: ISTJ ──
  {
    id: 'istj-1',
    mbti: 'ISTJ', age: '36-45',
    expression: '我做了一份精确到周的 5 年规划。今年第二年，公司倒了。所有计划作废。第一次发现自己其实不知道怎么"不做计划"地活。',
    mood_tags: ['计划失灵', '不确定性', '中年重置'], has_media: false,
  },
  {
    id: 'istj-2',
    mbti: 'ISTJ', age: '46-55',
    expression: '老婆开始每周末去寺院禅修。我是那种连超市买菜都要列单的人。我在想要不要也去——但我连"为什么"都说不清楚。',
    mood_tags: ['秩序感动摇', '配偶变化', '寻意义'], has_media: false,
  },
  // ── ST: ISTP ──
  {
    id: 'istp-1',
    mbti: 'ISTP', age: '26-30',
    expression: '上周我爸住院，我去陪了三天。我帮他擦身、办出院手续、跟医生谈一切。回家后我跟我女朋友吵了一架，因为她问"你还好吗"。',
    mood_tags: ['情感被叩问', '行动派 vs 感性', '亲人疾病'], has_media: false,
  },
  {
    id: 'istp-2',
    mbti: 'ISTP', age: '36-45',
    expression: '在重读 Hemingway 的《老人与海》。这次读到一半哭了。年轻时只觉得是关于硬汉，现在觉得是关于"做了所有事还是输了"。',
    mood_tags: ['重读发现', '中年理解', '徒劳'], has_media: true,
  },
  // ── ST: ESTJ ──
  {
    id: 'estj-1',
    mbti: 'ESTJ', age: '46-55',
    expression: '管了一辈子团队，最近发现我儿子根本不愿意跟我说话。我用管 KPI 的逻辑管他，结果他十年没主动跟我说过一句心里话。',
    mood_tags: ['亲子裂痕', '管理 vs 关系', '中年觉醒'], has_media: false,
  },
  {
    id: 'estj-2',
    mbti: 'ESTJ', age: '36-45',
    expression: '前同事推荐了 Atul Gawande 的《Being Mortal》。我这种人是绝对不会主动看"临终关怀"的。但翻了几页，停不下来。',
    mood_tags: ['死亡议题', '执行者反思', '边界突破'], has_media: true,
  },
  // ── ST: ESTP ──
  {
    id: 'estp-1',
    mbti: 'ESTP', age: '18-25',
    expression: '一直觉得自己什么场子都能 hold 住。最近一次上台 pitch 完全 blank 了。回去查我自己以前的视频，发现我说话方式越来越像在演别人。',
    mood_tags: ['表演崩塌', '真实自我', '行动派失灵'], has_media: false,
  },
  {
    id: 'estp-2',
    mbti: 'ESTP', age: '26-30',
    expression: '最近迷上看 Anthony Bourdain 的 No Reservations 老节目。看他在每个国家吃饭、跟陌生人聊到天亮——我意识到我已经一年没和任何人深谈了。',
    mood_tags: ['行动派孤独', '真实连接', '远方'], has_media: true,
  },
];
