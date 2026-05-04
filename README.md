# 逢书 · A Book to Meet You

基于情绪、心境、品味,给你一份恰好的书单。

## 本地开发

```bash
pnpm install
pnpm dev
```

打开 http://localhost:3000 。

需要的环境变量(放 `.env.local`):

```
DASHSCOPE_API_KEY=...           # 阿里云 DashScope (Qwen 模型)
UPSTASH_REDIS_REST_URL=...      # 限流(可选,本地不配会跳过限流)
UPSTASH_REDIS_REST_TOKEN=...
OWNER_TOKEN=...                 # 用 cookie 绕过限流(可选)
MODEL=qwen-vl-max               # 默认模型
NEXT_PUBLIC_SITE_URL=...        # 服务端渲染时分享链接的兜底,如 https://book4u.example.com
```

## 部署:Cloudflare Workers(via OpenNext)

为了在中国大陆能稳定访问,本项目使用 [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) 部署到 Cloudflare Workers,而不是 Vercel(`*.vercel.app` 域名在国内被屏蔽)。

### 一次性配置(在 Cloudflare 控制台)

1. 注册/登录 [Cloudflare](https://dash.cloudflare.com),进入 **Workers & Pages** → **Create** → **Import a repository**,选 `fisher521/book4u`。
2. **Build 配置**:
   - Build command: `pnpm install --frozen-lockfile && pnpm run build:cf`
   - Deploy command: `pnpm exec opennextjs-cloudflare deploy`
   - 不需要 Output directory(Workers 模式由 wrangler.jsonc 决定)
3. **Environment variables & secrets**(从 Vercel 复制):
   - `DASHSCOPE_API_KEY`(secret)
   - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`(secret)
   - `OWNER_TOKEN`(secret)
   - `NEXT_PUBLIC_SITE_URL`(plain,改成你的最终域名)
   - `MODEL` / `STAGE1_MODEL` / `STAGE2_MODEL` / `CRITIQUE_MODEL`(plain;wrangler.jsonc 里已设默认值,不重置可不填)
4. **绑定自定义域名**:Workers 项目 → Settings → Domains & Routes → Add custom domain。建议域名直接放在 Cloudflare DNS,自动签证书。
5. **Plan**:免费版每个请求 10ms CPU,推荐路由会超;**升级 Workers Paid($5/月)** 拿到 30s CPU/请求。

### 本地预览 Workers 构建

```bash
pnpm run preview     # 本地起 wrangler 模拟 Workers 环境
pnpm run deploy      # 直接部署(需 wrangler login)
```

### 国内访问说明

- **必须绑自定义域名**——`*.workers.dev` 在国内同样不稳。
- 不带 ICP 的话,Cloudflare 会让国内用户走境外节点,延迟 200-500ms,但通常能开。
- 想稳定低延迟,需要 ICP 备案 + Cloudflare 中国合作 CDN(京东云)。

## 项目结构

- `src/app/page.tsx`:主页交互
- `src/app/api/recommend/route.ts`:推荐核心(Stage1 信号抽取 → Stage2 选书 → Critique 自检 → 豆瓣校验 + 重试)
- `src/lib/llm.ts`:DashScope/Qwen 调用
- `src/lib/douban.ts`:豆瓣 `subject_suggest` 校验
- `src/data/`:MBTI 定锚池、近期新书池、Sonnet-distilled 黄金示例
- `scripts/`:一次性数据生成脚本(distill / scrape-douban),不参与运行时
