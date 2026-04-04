import { createClient, RedisClientType } from 'ioredis';
import { consumerConfig } from 'zod';

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.on('error', (err) => console.error('[RateLimiter] Redis error:', err));

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

class RateLimiter {
  private keyPrefix: string;

  constructor(
    private merchantId: string,
    private config: RateLimitConfig
  ) {
    this.keyPrefix = `ratelimit:${merchantId}`;
  }

  async check(): Promise<RateLimitResult> {
    const now = Date.now();
    const key = `${this.keyPrefix}:requests`;
    const windowStart = now - this.config.windowMs;

    const current = await redis.zcount(key, windowStart, '+inf');

    if (current >= this.config.maxRequests) {
      const oldestRequest = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetAt = oldestRequest[1] 
        ? Math.ceil((parseInt(oldestRequest[1]) + this.config.windowMs - now) / 1000)
        : Math.ceil(this.config.windowMs / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetAt: now + this.config.windowMs,
        retryAfter: resetAt
      };
    }

    await redis.zadd(key, now, `${now}:${Math.random()}`);
    await redis.expire(key, Math.ceil(this.config.windowMs / 1000) + 1);

    return {
      allowed: true,
      remaining: this.config.maxRequests - current - 1,
      resetAt: now + this.config.windowMs
    };
  }

  async reset(): Promise<void> {
    await redis.del(`${this.keyPrefix}:requests`);
  }

  async getCurrentCount(): Promise<number> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    return redis.zcount(`${this.keyPrefix}:requests`, windowStart, '+inf');
  }
}

const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  sms: { windowMs: 60000, maxRequests: 50 },
  api: { windowMs: 60000, maxRequests: 100 },
  webhook: { windowMs: 60000, maxRequests: 200 },
  campaign: { windowMs: 3600000, maxRequests: 10 }
};

export async function checkSmsRateLimit(merchantId: string): Promise<RateLimitResult> {
  const limiter = new RateLimiter(merchantId, DEFAULT_RATE_LIMITS.sms);
  return limiter.check();
}

export async function checkApiRateLimit(merchantId: string): Promise<RateLimitResult> {
  const limiter = new RateLimiter(merchantId, DEFAULT_RATE_LIMITS.api);
  return limiter.check();
}

export async function checkWebhookRateLimit(shopifyStoreUrl: string): Promise<RateLimitResult> {
  const limiter = new RateLimiter(shopifyStoreUrl, DEFAULT_RATE_LIMITS.webhook);
  return limiter.check();
}

export async function checkCampaignRateLimit(merchantId: string): Promise<RateLimitResult> {
  const limiter = new RateLimiter(merchantId, DEFAULT_RATE_LIMITS.campaign);
  return limiter.check();
}

export async function resetRateLimit(merchantId: string, type: string = 'sms'): Promise<void> {
  const config = DEFAULT_RATE_LIMITS[type] || DEFAULT_RATE_LIMITS.sms;
  const limiter = new RateLimiter(merchantId, config);
  await limiter.reset();
}

export { RateLimiter, redis };
