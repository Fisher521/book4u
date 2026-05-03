/**
 * Unified LLM caller. Toggles between Qwen-VL (DashScope) and Claude (Agent SDK).
 * Selected via MODEL env var. Default: qwen-vl-max.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

export type LLMImage = { mediaType: string; base64: string };

export type LLMInput = {
  systemPrompt: string;
  userText: string;
  images: LLMImage[];
  temperature?: number;
  abortSignal?: AbortSignal;
};

export type LLMOutput = {
  text: string;
  model: string;
  cost_usd?: number;
};

const MODEL = process.env.MODEL || 'qwen-vl-max';

export function getModel(): string {
  return MODEL;
}

// Approximate Qwen-VL-Max pricing (CNY) → USD rough conversion
// qwen-vl-max: input ¥0.02/1K, output ¥0.02/1K (as of 2025)
const QWEN_INPUT_USD_PER_1K = 0.02 / 7;
const QWEN_OUTPUT_USD_PER_1K = 0.02 / 7;

async function callQwen(input: LLMInput): Promise<LLMOutput> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY 未配置（在 .env.local 里加上）');

  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [{ type: 'text', text: input.userText }];

  for (const img of input.images) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${img.mediaType};base64,${img.base64}` },
    });
  }

  const res = await fetch(
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    {
      method: 'POST',
      signal: input.abortSignal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content },
        ],
        temperature: input.temperature ?? 0.85,
        max_tokens: 4096,
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Qwen 调用失败 (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string }; finish_reason?: string }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  const text = data.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('Qwen 返回空内容');

  let cost: number | undefined;
  if (data.usage) {
    cost =
      (data.usage.prompt_tokens / 1000) * QWEN_INPUT_USD_PER_1K +
      (data.usage.completion_tokens / 1000) * QWEN_OUTPUT_USD_PER_1K;
  }

  return { text, model: MODEL, cost_usd: cost };
}

async function callClaude(input: LLMInput): Promise<LLMOutput> {
  const imageBlocks = input.images.map((img) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: img.mediaType,
      data: img.base64,
    },
  }));

  const content = [{ type: 'text' as const, text: input.userText }, ...imageBlocks];

  async function* userPrompt() {
    yield {
      type: 'user' as const,
      message: {
        role: 'user' as const,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: content as any,
      },
      parent_tool_use_id: null,
      session_id: '',
    };
  }

  const abortController = new AbortController();
  if (input.abortSignal) {
    input.abortSignal.addEventListener('abort', () => abortController.abort());
  }

  const q = query({
    prompt: userPrompt(),
    options: {
      model: MODEL,
      systemPrompt: input.systemPrompt,
      tools: [],
      maxTurns: 1,
      permissionMode: 'bypassPermissions',
      extraArgs: { 'dangerously-skip-permissions': null },
      abortController,
    },
  });

  let text = '';
  let cost: number | undefined;
  for await (const msg of q) {
    if (msg.type === 'result') {
      if (msg.subtype === 'success') {
        text = msg.result;
        cost = msg.total_cost_usd;
      } else {
        throw new Error(`Claude 调用失败：${JSON.stringify(msg).slice(0, 300)}`);
      }
    }
  }
  if (!text) throw new Error('Claude 返回空内容');
  return { text, model: MODEL, cost_usd: cost };
}

export async function callLLM(input: LLMInput): Promise<LLMOutput> {
  if (MODEL.startsWith('qwen')) return callQwen(input);
  if (MODEL.startsWith('claude')) return callClaude(input);
  throw new Error(`不支持的 MODEL: ${MODEL}（支持 qwen-* 或 claude-*）`);
}
