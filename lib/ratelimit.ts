import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Returns null when Upstash env vars aren't set (local dev / missing config).
// Callers must handle null — never crash when rate limiting is unavailable.
function makeRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = makeRedis();

function limiter(requests: number, windowSeconds: number): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, `${windowSeconds}s`),
    analytics: false,
  });
}

// notify-registration: 5 per hour per IP (Resend quota protection)
export const notifyRatelimit = limiter(5, 3600);

// share link creation: 20 per hour per user
export const shareLinkRatelimit = limiter(20, 3600);

// magic-link staff invite: 10 per hour per workspace
export const inviteRatelimit = limiter(10, 3600);

export async function checkRateLimit(
  limiterInstance: Ratelimit | null,
  identifier: string,
): Promise<{ allowed: boolean; remaining?: number }> {
  if (!limiterInstance) return { allowed: true };
  const { success, remaining } = await limiterInstance.limit(identifier);
  return { allowed: success, remaining };
}
