import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyShopifyWebhook } from '@/lib/hmac';
import { success, error } from '@/lib/api/helpers';

/**
 * POST /api/webhooks/shopify
 *
 * Shopify webhook receiver. Accepts webhook payloads from Shopify,
 * verifies HMAC signature, persists the event, and dispatches
 * async processing.
 */
export async function POST(request: NextRequest) {
  try {
    // ── 1. Read raw body (required for HMAC verification) ──────────────
    const rawBody = await request.text();

    if (!rawBody || rawBody.length === 0) {
      return error('Empty request body', 400);
    }

    // ── 2. Verify HMAC signature ───────────────────────────────────────
    const hmacHeader = request.headers.get('x-shopify-hmac-sha256') ?? '';
    const clientSecret = process.env.SHOPIFY_API_SECRET ?? '';

    if (!clientSecret) {
      // In development without a secret, we skip verification but log a warning
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[webhook] SHOPIFY_API_SECRET not set — skipping HMAC verification');
      } else {
        return error('Server misconfigured: missing SHOPIFY_API_SECRET', 500);
      }
    } else {
      const isValid = verifyShopifyWebhook(rawBody, hmacHeader, clientSecret);
      if (!isValid) {
        return error('Invalid HMAC signature', 401);
      }
    }

    // ── 3. Extract shop domain and topic from headers ──────────────────
    const shopDomain = request.headers.get('x-shopify-shop-domain') ?? '';
    const topic = request.headers.get('x-shopify-topic') ?? '';

    if (!shopDomain) {
      return error('Missing shop domain header', 400);
    }

    if (!topic) {
      return error('Missing topic header', 400);
    }

    // ── 4. Find or create the Shop in DB ───────────────────────────────
    const shop = await db.shop.upsert({
      where: { shopifyDomain: shopDomain },
      create: {
        shopifyDomain: shopDomain,
        shopifyToken: 'webhook-initial',
        isActive: true,
      },
      update: {
        updatedAt: new Date(),
      },
    });

    // ── 5. Parse the payload for storage ───────────────────────────────
    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(rawBody);
    } catch {
      // If the body is not valid JSON, store it as a raw string
      parsedPayload = rawBody;
    }

    // ── 6. Create a WebhookEvent record (status: pending) ─────────────
    const webhookEvent = await db.webhookEvent.create({
      data: {
        shopId: shop.id,
        topic,
        shopifyDomain: shopDomain,
        payload: typeof parsedPayload === 'string'
          ? parsedPayload
          : JSON.stringify(parsedPayload),
        processingStatus: 'pending',
        processingAttempts: 0,
      },
    });

    // ── 7. Dispatch async processing via the webhook queue ─────────────
    try {
      const { getQueue } = await import('@/lib/queues');
      const queue = getQueue<{
        shopId: string;
        topic: string;
        shopifyDomain: string;
        payload: unknown;
        webhookEventId: string;
      }>('webhook-process');

      queue.add({
        shopId: shop.id,
        topic,
        shopifyDomain: shopDomain,
        payload: parsedPayload,
        webhookEventId: webhookEvent.id,
      });

      console.log(`[webhook] Dispatched event ${webhookEvent.id} for processing — topic: ${topic}, shop: ${shopDomain}`);
    } catch (queueErr) {
      // Queue dispatch failure is non-fatal — event is stored and can be
      // retried later via a cron job or manual trigger
      console.error('[webhook] Failed to dispatch event for async processing', {
        eventId: webhookEvent.id,
        error: queueErr instanceof Error ? queueErr.message : String(queueErr),
      });
    }

    // ── 8. Return 200 immediately (async processing) ──────────────────
    return success({
      message: 'Webhook received',
      eventId: webhookEvent.id,
      topic,
      shopDomain,
    });
  } catch (err) {
    console.error('[webhook] Unhandled error in webhook handler', err);
    return error(
      'Internal server error',
      500,
      process.env.NODE_ENV !== 'production'
        ? err instanceof Error ? err.message : String(err)
        : undefined
    );
  }
}
