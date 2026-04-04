import { ActionFunctionArgs, json } from '@remix-run/node';
import { verifyWebhookSignature } from '../utils/security.server';
import { webhookPayloadSchema } from '../lib/validation';
import { processWebhookIdempotently } from '../lib/webhook-idempotency';
import { checkWebhookRateLimit } from '../lib/rate-limiter';
import { createAuditLog } from '../lib/audit-log';
import { prisma, cache } from '../lib/database';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get('shop');

  if (!shop) {
    return json({ error: 'Missing shop parameter' }, { status: 400 });
  }

  const rateLimit = await checkWebhookRateLimit(shop);
  if (!rateLimit.allowed) {
    return json(
      { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    );
  }

  const body = await request.text();
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256') || '';
  const topic = request.headers.get('x-shopify-topic') || '';

  const merchant = await prisma.merchant.findUnique({
    where: { shopifyStoreUrl: shop }
  });

  if (!merchant) {
    console.error(`[Webhook] Unknown shop: ${shop}`);
    return json({ error: 'Store not found' }, { status: 404 });
  }

  const isValid = verifyWebhookSignature(body, hmacHeader, merchant.shopifyApiSecret);
  if (!isValid) {
    console.error(`[Webhook] Invalid signature from ${shop}`);
    return json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validationResult = webhookPayloadSchema.safeParse({
    ...payload,
    topic,
    shop_domain: shop
  });

  if (!validationResult.success) {
    console.error(`[Webhook] Validation failed:`, validationResult.error.flatten());
    return json({ error: 'Invalid payload', details: validationResult.error.flatten() }, { status: 400 });
  }

  await createAuditLog(merchant.id, 'WEBHOOK_RECEIVE', 'ORDER', {
    details: { topic, shop },
    piiAccessed: false
  });

  const result = await processWebhookIdempotently(topic, payload, shop);

  if (!result.success && !result.isDuplicate) {
    return json({ error: result.error }, { status: 500 });
  }

  return json({ success: true, duplicate: result.isDuplicate });
}

export async function loader() {
  return json({ status: 'ok', timestamp: new Date().toISOString() });
}
