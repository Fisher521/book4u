/**
 * 豆瓣 2024-2026 高分热门书池 (自动抓取)
 *
 * 数据源：scripts/scrape-douban.mjs (豆瓣 tag 页爬取)
 * 筛选：rating >= 7.5/7.8 + votes >= 200/400/600 (按年份梯度)
 * 数量：约 150 本
 *
 * 区别于 RECENT_BOOKS：这里没有 MBTI 标签，只有书名/作者/年/分数。
 * 模型按主题/题材自行匹配。
 *
 * 重新抓取：
 *   node scripts/scrape-douban.mjs
 *   node scripts/regen-pool.mjs
 */

export type DoubanBook = {
  title: string;
  author: string;
  year: number;
  rating: number;
  votes: number;
};

export const DOUBAN_POOL: DoubanBook[] = [
  { title: '食南之徒', author: '马伯庸', year: 2024, rating: 8.2, votes: 52586 },
  { title: '恶女的告白', author: '[日] 叶真中显', year: 2024, rating: 8.5, votes: 42271 },
  { title: '世上为什么要有图书馆', author: '杨素秋', year: 2024, rating: 8.8, votes: 32993 },
  { title: '猫鱼', author: '陈冲', year: 2024, rating: 8.5, votes: 15974 },
  { title: '康熙的红票', author: '孙立天', year: 2024, rating: 9.3, votes: 15546 },
  { title: '油炸绿番茄', author: '[美] 范妮·弗拉格', year: 2024, rating: 8.7, votes: 15075 },
  { title: '暗处的女儿', author: '[意大利] 埃莱娜·费兰特', year: 2024, rating: 8.7, votes: 14440 },
  { title: '早安，怪物', author: '[加] 凯瑟琳·吉尔迪纳', year: 2024, rating: 9, votes: 13992 },
  { title: '我看见的世界', author: '[美] 李飞飞', year: 2024, rating: 8.8, votes: 11742 },
  { title: '控糖革命', author: '[法]杰西·安佐斯佩（Jessie Inchauspé）', year: 2024, rating: 8, votes: 11322 },
  { title: '草民', author: '蔡崇达', year: 2024, rating: 8, votes: 10093 },
  { title: '阿勒泰的角落', author: '李娟', year: 2024, rating: 8.8, votes: 9740 },
  { title: '团圆记', author: '杨云苏', year: 2024, rating: 8.6, votes: 8584 },
  { title: '我用中文做了场梦', author: '[意] 亚历（Alessandro Ceschi）', year: 2024, rating: 8, votes: 8274 },
  { title: '九诗心', author: '黄晓丹', year: 2024, rating: 8.9, votes: 7875 },
  { title: '事件', author: '[法] 安妮·埃尔诺', year: 2024, rating: 9.2, votes: 7785 },
  { title: '乔瓦尼的房间', author: '[美] 詹姆斯·鲍德温', year: 2024, rating: 8.1, votes: 7775 },
  { title: '小城与不确定性的墙', author: '[日] 村上春树', year: 2024, rating: 7.9, votes: 7758 },
  { title: '大众文化的女性主义指南', author: '[韩] 孙希定 [韩] 林允玉 [韩] 金智惠 编、[韩] 崔至恩 等著、崔至恩', year: 2024, rating: 8.5, votes: 7680 },
  { title: '逃走的人', author: '李颖迪', year: 2024, rating: 7.9, votes: 7069 },
  { title: '智人之上', author: '[以色列] 尤瓦尔·赫拉利', year: 2024, rating: 8, votes: 6391 },
  { title: '无条件投降博物馆', author: '[荷]杜布拉夫卡·乌格雷西奇', year: 2024, rating: 8.3, votes: 5971 },
  { title: '失控的照护', author: '[日] 叶真中显', year: 2024, rating: 8, votes: 5745 },
  { title: '血与蜜之地', author: '刘子超', year: 2024, rating: 8.5, votes: 5633 },
  { title: '身后无遗物', author: '[日] 伊藤比吕美', year: 2024, rating: 7.8, votes: 4868 },
  { title: '看不见的中东', author: '姚璐', year: 2024, rating: 8.5, votes: 4546 },
  { title: '我的骨头没有忘记', author: '[美] 斯蒂芬妮·胡', year: 2024, rating: 8.5, votes: 4491 },
  { title: '超越百岁', author: '彼得 · 阿提亚（Peter Attia）、比尔 · 吉福德（Bill Gifford）', year: 2024, rating: 8.4, votes: 4459 },
  { title: '日暮时分', author: '[韩] 黄晳暎', year: 2024, rating: 8.1, votes: 4270 },
  { title: '我人生最开始的好朋友', author: '蔡崇达', year: 2024, rating: 8.4, votes: 4248 },
  { title: '象棋的故事', author: '[奥] 斯蒂芬·茨威格', year: 2024, rating: 9, votes: 4141 },
  { title: '吃着吃着就老了', author: '陈晓卿', year: 2024, rating: 8.1, votes: 4128 },
  { title: '东京平常日1', author: '[日]松本大洋', year: 2024, rating: 8.7, votes: 3905 },
  { title: '三国前夜', author: '张向荣', year: 2024, rating: 8.5, votes: 3808 },
  { title: '伊甸之东', author: '[美]约翰·斯坦贝克', year: 2024, rating: 9.1, votes: 3563 },
  { title: '初老的女人', author: '伊藤比吕美', year: 2024, rating: 8.1, votes: 3325 },
  { title: '三生万物', author: '宁高宁', year: 2024, rating: 8.3, votes: 3100 },
  { title: '女校之星', author: '(日)和山山', year: 2024, rating: 8.7, votes: 3048 },
  { title: '第六病室', author: '(俄) 安东·巴甫洛维奇·契诃夫', year: 2024, rating: 9.1, votes: 3048 },
  { title: '人生解忧', author: '成庆', year: 2024, rating: 8.6, votes: 3016 },
  { title: '解闷儿', author: '张辰亮', year: 2024, rating: 8.5, votes: 2907 },
  { title: '莉莉亚娜不可战胜的夏天', author: '[墨西哥] 克里斯蒂娜·里韦拉·加尔萨', year: 2024, rating: 8.4, votes: 2872 },
  { title: '涅朵奇卡', author: '[俄] 陀思妥耶夫斯基', year: 2024, rating: 8.4, votes: 2803 },
  { title: '钦探', author: '周游', year: 2024, rating: 8.6, votes: 2760 },
  { title: '岛屿的厝', author: '龚万莹', year: 2024, rating: 8.2, votes: 2687 },
  { title: '秦汉史讲义', author: '秦晖', year: 2024, rating: 9.2, votes: 2686 },
  { title: '地粮·新粮', author: '[法] 安德烈·纪德', year: 2024, rating: 8.2, votes: 2664 },
  { title: '我妈笑了', author: '香特尔·阿克曼', year: 2024, rating: 8.1, votes: 2605 },
  { title: '十日终焉·迷城', author: '杀虫队队员', year: 2024, rating: 8, votes: 2535 },
  { title: '佐丽', author: '[美]莱尔德·亨特', year: 2024, rating: 8.4, votes: 2499 },
  { title: '她来劈开这山', author: '病鹤斋、群白 绘', year: 2025, rating: 8.1, votes: 14403 },
  { title: '咸的玩笑', author: '刘震云', year: 2025, rating: 8.5, votes: 11989 },
  { title: '蛇结', author: '[法]弗朗索瓦·莫里亚克', year: 2025, rating: 8.3, votes: 11397 },
  { title: '方舟', author: '[日] 夕木春央', year: 2025, rating: 7.8, votes: 10948 },
  { title: '父亲的解放日志', author: '[韩] 郑智我', year: 2025, rating: 8.6, votes: 8478 },
  { title: '格外的活法', author: '[日] 吉井忍', year: 2025, rating: 8.1, votes: 8293 },
  { title: '要有光', author: '梁鸿', year: 2025, rating: 9, votes: 7866 },
  { title: '一个女人一生中的二十四小时', author: '斯蒂芬·茨威格', year: 2025, rating: 8.6, votes: 7147 },
  { title: '林门郑氏', author: '[马来西亚] 林雪虹', year: 2025, rating: 7.9, votes: 6783 },
  { title: '我是寨子里长大的女孩', author: '扎十一惹', year: 2025, rating: 8.8, votes: 6626 },
  { title: '年龄是一种感觉', author: '[加] 海莉·麦克吉', year: 2025, rating: 8.1, votes: 5294 },
  { title: '即使以最微弱的光', author: '[韩] 崔恩荣', year: 2025, rating: 8.7, votes: 4963 },
  { title: '谁来决定吃什么', author: '陈宇慧', year: 2025, rating: 8, votes: 4851 },
  { title: '哲学家的最后一课', author: '朱锐', year: 2025, rating: 8.8, votes: 4634 },
  { title: '我才不想做家务', author: '纪静蓉', year: 2025, rating: 9.2, votes: 4457 },
  { title: '想在天气好时去海边', author: '拟泥nini', year: 2025, rating: 8.1, votes: 4250 },
  { title: '象首迷宮', author: '白井智之', year: 2025, rating: 7.8, votes: 4111 },
  { title: '跑外卖', author: '王晚', year: 2025, rating: 8.3, votes: 4016 },
  { title: '太阳的阴影', author: '[波] 雷沙德·卡普希钦斯基', year: 2025, rating: 9.3, votes: 4014 },
  { title: '血孩子', author: '[美] 奥克塔维娅·E.巴特勒', year: 2025, rating: 8.2, votes: 3965 },
  { title: '沧城', author: '阿措', year: 2025, rating: 8.6, votes: 3934 },
  { title: '她对此感到厌烦2', author: '妚鹤', year: 2025, rating: 9, votes: 3842 },
  { title: '一个阿富汗女人的来信', author: '[阿富汗] 哈迪亚·海达里', year: 2025, rating: 7.9, votes: 3702 },
  { title: '蜉蝣直上', author: '小佳', year: 2025, rating: 8.2, votes: 3384 },
  { title: '她弥留之际', author: '(法) 西蒙娜·德·波伏瓦', year: 2025, rating: 8.7, votes: 3372 },
  { title: '雪的练习生', author: '[日] 多和田叶子', year: 2025, rating: 8.2, votes: 3018 },
  { title: '777', author: '[日] 伊坂幸太郎', year: 2025, rating: 8.1, votes: 2980 },
  { title: '初步举证', author: '[澳] 苏茜·米勒', year: 2025, rating: 8.7, votes: 2961 },
  { title: '鹅之书', author: '[美] 李翊云', year: 2025, rating: 8.3, votes: 2954 },
  { title: '书怎么读都有趣', author: '[日] 青山南', year: 2025, rating: 8, votes: 2947 },
  { title: '结婚十年', author: '苏青', year: 2025, rating: 8.2, votes: 2838 },
  { title: '在轮下', author: '[德] 赫尔曼·黑塞', year: 2025, rating: 8.7, votes: 2766 },
  { title: '黄色墙纸', author: '[美] 夏洛特·珀金斯·吉尔曼', year: 2025, rating: 8.6, votes: 2696 },
  { title: '我以为这辈子完蛋了', author: '[美]艾莉·布罗什', year: 2025, rating: 8.2, votes: 2556 },
  { title: '向坐着的人指控爱情', author: '[哥伦比亚] 加西亚·马尔克斯', year: 2025, rating: 8.1, votes: 2448 },
  { title: '一切愁云消散', author: '[英] 薇塔·萨克维尔-韦斯特', year: 2025, rating: 8.2, votes: 2424 },
  { title: '故纸浮生.1-2', author: '(日)儿岛青', year: 2025, rating: 9.3, votes: 2218 },
  { title: '伤口愈合中', author: '[韩] 韩江', year: 2025, rating: 7.9, votes: 2112 },
  { title: '燕子呢喃，白鹤鸣叫', author: '阮夕清', year: 2025, rating: 8.2, votes: 2031 },
  { title: '缝纫机与金鱼', author: '[日]永井美糸', year: 2025, rating: 8.3, votes: 1926 },
  { title: '十日终焉·白羊', author: '杀虫队队员', year: 2025, rating: 8.1, votes: 1910 },
  { title: '希腊别传', author: '陈嘉映', year: 2025, rating: 8.8, votes: 1904 },
  { title: '安史之乱', author: '张诗坪、胡可奇', year: 2025, rating: 9.1, votes: 1852 },
  { title: '镖⼈：卷十三', author: '许先哲', year: 2025, rating: 9, votes: 1843 },
  { title: '万物自洽法则', author: '大张伟', year: 2025, rating: 7.8, votes: 1784 },
  { title: '少女中国', author: '[日] 滨田麻矢', year: 2025, rating: 8.6, votes: 1699 },
  { title: '你为什么不离开我的生活？', author: '[美] 薇薇安·戈尔尼克', year: 2025, rating: 8.7, votes: 1628 },
  { title: '两个普通女人的十年通信', author: '仙人球爱水、污士奇', year: 2025, rating: 8.1, votes: 1511 },
  { title: '与希罗多德一起旅行', author: '[波] 雷沙德·卡普希钦斯基', year: 2025, rating: 8.4, votes: 1502 },
  { title: '小说榫卯', author: '张秋子', year: 2025, rating: 8.4, votes: 1481 },
  { title: '树', author: '[日] 幸田文', year: 2025, rating: 8.3, votes: 1470 },
  { title: '法比安', author: '[德国] 埃里希·凯斯特纳', year: 2025, rating: 8.5, votes: 1461 },
  { title: '允许爱情消失', author: '杜素娟', year: 2025, rating: 8.4, votes: 1450 },
  { title: '陆地的尽头，是海洋的开始', author: '俞昆', year: 2025, rating: 9, votes: 1436 },
  { title: '邪恶的幸福', author: '[丹麦] 托芙·迪特莱弗森', year: 2025, rating: 8.3, votes: 1399 },
  { title: '全球真实故事集 Ⅱ', author: '吴琦 主编', year: 2025, rating: 8.7, votes: 1342 },
  { title: '玫瑰朝上', author: '[巴勒斯坦] 莫萨布·阿布·托哈', year: 2025, rating: 8.8, votes: 1313 },
  { title: '东京平常日3', author: '[日]松本大洋', year: 2025, rating: 9.3, votes: 1278 },
  { title: '捕云记', author: '[日] 多和田叶子', year: 2025, rating: 8.3, votes: 1256 },
  { title: '小说家与夜的分界线', author: '[日] 山白朝子', year: 2025, rating: 8, votes: 1237 },
  { title: '真事隐', author: '孙立天', year: 2026, rating: 8.7, votes: 1732 },
  { title: '安定此心', author: '姜涛', year: 2026, rating: 8.7, votes: 1617 },
  { title: '只剩你一个', author: '[美] 赖利·塞杰', year: 2026, rating: 7.8, votes: 1218 },
  { title: '天色已晚', author: '[爱尔兰]克莱尔·吉根', year: 2026, rating: 8.3, votes: 1029 },
  { title: '凯罗斯', author: '[德] 燕妮·埃彭贝克', year: 2026, rating: 8.5, votes: 1000 },
  { title: '呼啸山庄', author: '[英] 艾米莉·勃朗特', year: 2026, rating: 7.9, votes: 927 },
  { title: '密室偏爱时代的谋杀事件', author: '[日] 鸭崎暖炉', year: 2026, rating: 7.7, votes: 807 },
  { title: '挽救计划', author: '[美] 安迪·威尔', year: 2026, rating: 9.1, votes: 795 },
  { title: '收留', author: '[爱尔兰] 克莱尔·吉根', year: 2026, rating: 8.5, votes: 712 },
  { title: '我的天才朋友', author: '[瑞典] 弗雷德里克·巴克曼', year: 2026, rating: 8.3, votes: 685 },
  { title: '烧纸', author: '[韩] 李沧东', year: 2026, rating: 8.7, votes: 662 },
  { title: '她和她的决心', author: '东来', year: 2026, rating: 8.3, votes: 605 },
  { title: '我收养了一个朋友', author: '[韩]银曙澜', year: 2026, rating: 7.9, votes: 549 },
  { title: '我从凉山来', author: '阿西阿呷', year: 2026, rating: 7.7, votes: 536 },
  { title: '死亡之前的十五秒', author: '[日] 榊林铭', year: 2026, rating: 7.5, votes: 535 },
  { title: '表姐妹', author: '[阿根廷] 奥罗拉·本图里尼', year: 2026, rating: 8.6, votes: 533 },
  { title: '故乡无用', author: '[马来西亚] 马尼尼为', year: 2026, rating: 7.5, votes: 503 },
  { title: '白', author: '龚姝', year: 2026, rating: 8, votes: 463 },
  { title: '大厂小民', author: '张小满', year: 2026, rating: 8.5, votes: 449 },
  { title: '纸上的权利', author: '刘楷悦', year: 2026, rating: 9.3, votes: 439 },
  { title: '年轻医生手记', author: '［俄］米哈伊尔·布尔加科夫', year: 2026, rating: 8.8, votes: 355 },
  { title: '在世与认知', author: '陈嘉映', year: 2026, rating: 8.6, votes: 335 },
  { title: '好猫八不', author: '王朔', year: 2026, rating: 8.6, votes: 329 },
  { title: '哈萨比斯：谷歌AI之脑', author: '塞巴斯蒂安·马拉比', year: 2026, rating: 8.8, votes: 319 },
  { title: '像女孩那样丢球', author: '[美] 艾丽斯·玛丽恩·杨', year: 2026, rating: 8.8, votes: 295 },
  { title: '低音', author: '[日] 上野千鹤子', year: 2026, rating: 7.8, votes: 280 },
  { title: '温柔的讲述者', author: '[波兰] 奥尔加·托卡尔丘克', year: 2026, rating: 8.8, votes: 276 },
  { title: '观鸟大年', author: '[美] 马克·奥布马斯克（Mark Obmascik）', year: 2026, rating: 8.9, votes: 274 },
  { title: '旷野的慰藉', author: '[美] 格蕾特尔·埃里克（Gretel Ehrlich）', year: 2026, rating: 8.6, votes: 270 },
  { title: '蓝色八开笔记本', author: '[奥] 弗朗茨·卡夫卡', year: 2026, rating: 8.3, votes: 268 },
  { title: '弹珠游戏', author: '[法] 埃莉萨·秀雅·迪萨潘', year: 2026, rating: 7.7, votes: 260 },
  { title: '幸福蒙太奇', author: '马凌云', year: 2026, rating: 7.9, votes: 254 },
  { title: '她比时代快半步', author: '[英] 索菲·柯林斯', year: 2026, rating: 8.4, votes: 248 },
  { title: '阅读还有未来吗？', author: '[美] 乔治·斯坦纳、[伊朗] 拉明·贾汉贝格鲁', year: 2026, rating: 8.5, votes: 243 },
  { title: '罐头厂街', author: '[美] 约翰·斯坦贝克', year: 2026, rating: 9, votes: 238 },
  { title: '山间游乐场（全两册）', author: '杨凯芩', year: 2026, rating: 9.6, votes: 229 },
  { title: '白雪猪头', author: '苏童', year: 2026, rating: 8.6, votes: 227 },
  { title: '男流文学论', author: '[日] 上野千鹤子、[日] 小仓千加子、[日] 富冈多惠子', year: 2026, rating: 8, votes: 225 },
  { title: '我们如何理解这个世界', author: '[英] 齐格蒙特·鲍曼、[英] 基思·特斯特', year: 2026, rating: 9.2, votes: 222 },
  { title: '密室推理游戏', author: '[日]歌野晶午', year: 2026, rating: 7.5, votes: 222 },
];

export function formatDoubanPoolForPrompt(books: DoubanBook[] = DOUBAN_POOL): string {
  if (books.length === 0) return '';
  const grouped: Record<number, DoubanBook[]> = { 2024: [], 2025: [], 2026: [] };
  for (const b of books) {
    if (grouped[b.year]) grouped[b.year].push(b);
  }
  const sect = (year: number, list: DoubanBook[]): string => {
    if (list.length === 0) return '';
    const items = list.map((b) => `- 《${b.title}》${b.author}（豆瓣 ${b.rating}）`).join('\n');
    return `\n── ${year}（${list.length} 本）──\n${items}`;
  };
  return `
══════════════════════════════════════════════════════════
豆瓣 2024-2026 高分新书池（自动抓取，全部豆瓣可校验）
══════════════════════════════════════════════════════════

以下是豆瓣最近的高分书（评分 ≥ 7.5、评价数 ≥ 200），覆盖文学/小说/历史/
散文/科幻/推理/纪实/哲学/女性/漫画等多种题材。当用户的画像匹配上某本的
题材或味道时可以推荐（不强制）。这些书都已豆瓣可查，不会校验失败。
${sect(2024, grouped[2024])}${sect(2025, grouped[2025])}${sect(2026, grouped[2026])}
`;
}
