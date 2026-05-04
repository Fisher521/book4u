/**
 * Per-IP rate limit, 3 requests/24h. Skipped silently if Upstash env not configured.
 * Owner bypass: cookie `bookpass` matching env `OWNER_TOKEN`.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let ratelimit: Ratelimit | null = null;

function init(): Ratelimit | null {
  if (ratelimit) return ratelimit;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(3, '24 h'),
    prefix: 'book4u:rec',
    analytics: false,
  });
  return ratelimit;
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  reset: number;
  bypassed: boolean;
};

export async function checkRecommendLimit(req: Request): Promise<RateLimitResult> {
  // Owner bypass via cookie
  const cookie = req.headers.get('cookie') || '';
  const passMatch = cookie.match(/bookpass=([^;]+)/);
  const ownerToken = process.env.OWNER_TOKEN;
  if (ownerToken && passMatch && passMatch[1] === ownerToken) {
    return { ok: true, remaining: 999, reset: 0, bypassed: true };
  }

  const rl = init();
  if (!rl) {
    // Upstash not configured — skip limit (e.g. local dev)
    return { ok: true, remaining: 999, reset: 0, bypassed: true };
  }

  // Identify by IP — best available proxy on Vercel
  const fwd = req.headers.get('x-forwarded-for') || '';
  const ip = fwd.split(',')[0].trim() || req.headers.get('x-real-ip') || 'anonymous';
  const result = await rl.limit(ip);
  return {
    ok: result.success,
    remaining: result.remaining,
    reset: result.reset,
    bypassed: false,
  };
}
