/**
 * SMS-Shield Rate Limiter
 *
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window approach with configurable window size
 * and max request count per key.
 *
 * Note: For production distributed systems, consider using Redis
 * or an external rate-limiting service instead of in-memory storage.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  /** Time window in milliseconds. Default: 60000 (1 minute) */
  windowMs?: number;
  /** Maximum number of requests per window. Default: 100 */
  maxRequests?: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** Timestamp (ms) when the window resets */
  resetAt: number;
}

/**
 * Check if a request should be rate-limited.
 *
 * @param key - Unique identifier for the rate limit bucket (e.g. IP address, API key, user ID)
 * @param options - Configuration options
 * @returns RateLimitResult with allowed status and metadata
 *
 * @example
 * ```ts
 * const { allowed, remaining } = rateLimit('192.168.1.1', { maxRequests: 50 });
 * if (!allowed) {
 *   return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 * }
 * ```
 */
export function rateLimit(key: string, options?: RateLimitOptions): RateLimitResult {
  const { windowMs = 60_000, maxRequests = 100 } = options || {};
  const now = Date.now();

  let entry = store.get(key);

  // Reset window if expired or missing
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count++;

  return {
    allowed: entry.count <= maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Reset the rate limit for a given key.
 * Useful for testing or admin actions.
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/**
 * Get current rate limit status without incrementing the counter.
 */
export function getRateLimitStatus(key: string): RateLimitResult | null {
  const entry = store.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now > entry.resetAt) return null;

  return {
    allowed: true,
    remaining: Math.max(0, 100 - entry.count), // approximate
    resetAt: entry.resetAt,
  };
}

// Cleanup old entries every 5 minutes to prevent memory leaks
if (typeof globalThis !== 'undefined') {
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }, 5 * 60_000);

  // Allow Node.js to exit even if the interval is still running
  if (typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
  }
}
