/**
 * SMS-Shield API Middleware Helpers
 *
 * Reusable middleware functions for Next.js API routes:
 * - Rate limiting with configurable thresholds
 * - CORS header injection
 * - Request timing for performance monitoring
 *
 * @example
 * ```ts
 * // In a Next.js route handler:
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = withRateLimit(request, { maxRequests: 10 });
 *   if (rateLimitResult) return rateLimitResult;
 *
 *   const end = withTiming('POST /api/gateways');
 *   // ... handler logic
 *   end();
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, type RateLimitOptions } from './api/rate-limit';

/**
 * Rate limit middleware for API routes.
 *
 * Returns a 429 response if the rate limit is exceeded,
 * or null if the request is allowed.
 *
 * @param request - The incoming NextRequest
 * @param options - Rate limit configuration
 * @returns A NextResponse with 429 status if limited, null if allowed
 */
export function withRateLimit(
  request: NextRequest,
  options?: RateLimitOptions & { maxRequests?: number }
): NextResponse | null {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown';

  const { allowed, remaining, resetAt } = rateLimit(`api:${ip}`, {
    windowMs: 60_000,
    maxRequests: options?.maxRequests || 100,
  });

  if (!allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': String(remaining),
          'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  // Return null to signal the request is allowed
  return null;
}

/**
 * Apply CORS headers to a response.
 *
 * @param response - The NextResponse to modify
 * @returns The same response with CORS headers added
 */
export function withCors(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Shopify-Hmac-Sha256');
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

/**
 * Create a request timing tracker.
 *
 * Call the returned function when the request completes to log duration.
 *
 * @param label - A descriptive label for the log entry
 * @returns A function that logs the elapsed time when called
 *
 * @example
 * ```ts
 * const end = withTiming('POST /api/gateways');
 * const result = await someOperation();
 * const duration = end(); // logs: "POST /api/gateways: 42ms"
 * ```
 */
export function withTiming(label: string): () => number {
  const start = Date.now();
  return () => {
    const duration = Date.now() - start;
    console.log(`⏱️  ${label}: ${duration}ms`);
    return duration;
  };
}

/**
 * Create a standardized API success response.
 */
export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(
    { success: true, data },
    {
      status,
      headers: { 'X-RateLimit-Policy': '100;w=60' },
    }
  );
}

/**
 * Create a standardized API error response.
 */
export function apiError(message: string, status = 500, details?: unknown): NextResponse {
  const body: Record<string, unknown> = {
    success: false,
    error: message,
  };
  if (details !== undefined) {
    body.details = details;
  }
  return NextResponse.json(body, { status });
}
