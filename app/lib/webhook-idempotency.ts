import { createClient } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { hash } from './security.server';

const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const prisma = new PrismaClient();

interface WebhookMessage {
  topic: string;
  shopifyStoreUrl: string;
  messageId: string;
  payload: any;
  processedAt?: number;
  status: 'pending' | 'processed' | 'duplicate' | 'failed';
}

const DUPLICATE_WINDOW_MS = 300000;
const LOCK_TTL_MS = 30000;

export async function processWebhookIdempotently(
  topic: string,
  payload: any,
  shopifyStoreUrl: string
): Promise<{ success: boolean; isDuplicate: boolean; error?: string }> {
  const messageId = extractMessageId(topic, payload);
  
  if (!messageId) {
    return { success: false, isDuplicate: false, error: 'No message ID in payload' };
  }

  const idempotencyKey = `webhook:${shopifyStoreUrl}:${topic}:${messageId}`;

  const existing = await redis.get(idempotencyKey);
  if (existing) {
    const data = JSON.parse(existing);
    if (data.status === 'processed') {
      console.log(`[Webhook] Duplicate message: ${idempotencyKey}`);
      return { success: true, isDuplicate: true };
    }
  }

  const lockKey = `lock:${idempotencyKey}`;
  const lockAcquired = await redis.set(lockKey, process.pid.toString(), 'PX', LOCK_TTL_MS, 'NX');
  
  if (!lockAcquired) {
    const waiting = await new Promise(resolve => setTimeout(resolve, 1000));
    const retryData = await redis.get(idempotencyKey);
    if (retryData) {
      const data = JSON.parse(retryData);
      if (data.status === 'processed') {
        return { success: true, isDuplicate: true };
      }
    }
    return { success: false, isDuplicate: false, error: 'Message currently being processed' };
  }

  try {
    await redis.set(
      idempotencyKey,
      JSON.stringify({
        topic,
        shopifyStoreUrl,
        messageId,
        payload: hash(JSON.stringify(payload)),
        status: 'pending',
        createdAt: Date.now()
      }),
      'PX',
      DUPLICATE_WINDOW_MS
    );

    await processWebhook(topic, payload, shopifyStoreUrl);

    await redis.set(
      idempotencyKey,
      JSON.stringify({
        topic,
        shopifyStoreUrl,
        messageId,
        status: 'processed',
        processedAt: Date.now()
      }),
      'PX',
      DUPLICATE_WINDOW_MS
    );

    return { success: true, isDuplicate: false };
  } catch (error) {
    await redis.set(
      idempotencyKey,
      JSON.stringify({
        topic,
        shopifyStoreUrl,
        messageId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        failedAt: Date.now()
      }),
      'PX',
      DUPLICATE_WINDOW_MS
    );

    return {
      success: false,
      isDuplicate: false,
      error: error instanceof Error ? error.message : 'Processing failed'
    };
  } finally {
    await redis.del(lockKey);
  }
}

function extractMessageId(topic: string, payload: any): string | null {
  switch (topic) {
    case 'orders/create':
    case 'orders/updated':
      return `order:${payload.id}`;
    case 'carts/update':
      return `cart:${payload.id}`;
    case 'checkouts/update':
      return `checkout:${payload.id}`;
    case 'products/create':
    case 'products/update':
      return `product:${payload.id}`;
    case 'customers/create':
    case 'customers/update':
      return `customer:${payload.id}`;
    default:
      return payload.id ? `${topic.split('/')[0]}:${payload.id}` : null;
  }
}

async function processWebhook(topic: string, payload: any, shopifyStoreUrl: string): Promise<void> {
  console.log(`[Webhook] Processing ${topic} from ${shopifyStoreUrl}`);

  const merchant = await prisma.merchant.findUnique({
    where: { shopifyStoreUrl },
    include: { settings: true }
  });

  if (!merchant) {
    throw new Error(`Merchant not found: ${shopifyStoreUrl}`);
  }

  switch (topic) {
    case 'carts/update':
      await handleCartUpdate(merchant.id, payload);
      break;
    case 'orders/create':
      await handleOrderCreate(merchant.id, payload);
      break;
    case 'checkouts/update':
      await handleCheckoutUpdate(merchant.id, payload);
      break;
    default:
      console.log(`[Webhook] Unhandled topic: ${topic}`);
  }

  await prisma.webhookDelivery.create({
    data: {
      shopifyStoreUrl,
      topic,
      payloadHash: hash(JSON.stringify(payload)),
      payload,
      status: 'processed',
      processingTime: 0
    }
  });
}

async function handleCartUpdate(merchantId: string, payload: any): Promise<void> {
  const customer = payload.customer;
  if (!customer?.phone) return;

  const phone = normalizePhone(customer.phone);
  const phoneHash = hash(phone);
  const emailHash = customer.email ? hash(customer.email.toLowerCase()) : null;

  await prisma.contact.upsert({
    where: {
      merchantId_phoneNumber: { merchantId, phoneNumber: phone }
    },
    create: {
      merchantId,
      phoneNumber: phone,
      phoneNumberHash: phoneHash,
      email: customer.email,
      emailHash: emailHash || undefined,
      firstName: customer.first_name,
      lastName: customer.last_name,
      smsOptIn: true,
      smsOptInDate: new Date()
    },
    update: {
      firstName: customer.first_name,
      lastName: customer.last_name
    }
  });
}

async function handleOrderCreate(merchantId: string, payload: any): Promise<void> {
  const customer = payload.customer;
  if (!customer?.phone) return;

  const phone = normalizePhone(customer.phone);
  const phoneHash = hash(phone);
  const emailHash = customer.email ? hash(customer.email.toLowerCase()) : null;
  const totalPrice = parseFloat(payload.total_price || '0');

  const contact = await prisma.contact.upsert({
    where: {
      merchantId_phoneNumber: { merchantId, phoneNumber: phone }
    },
    create: {
      merchantId,
      phoneNumber: phone,
      phoneNumberHash: phoneHash,
      email: customer.email,
      emailHash: emailHash || undefined,
      firstName: customer.first_name,
      lastName: customer.last_name,
      smsOptIn: true,
      smsOptInDate: new Date(),
      totalOrders: 1,
      totalSpent: totalPrice,
      averageOrderValue: totalPrice,
      lastOrderDate: new Date(),
      firstOrderDate: new Date()
    },
    update: {
      totalOrders: { increment: 1 },
      totalSpent: { increment: totalPrice },
      lastOrderDate: new Date()
    }
  });

  await prisma.order.create({
    data: {
      contactId: contact.id,
      shopifyOrderId: payload.id.toString(),
      orderNumber: payload.order_number?.toString() || payload.id.toString(),
      totalPrice,
      currency: payload.currency || 'EGP',
      financialStatus: payload.financial_status,
      fulfillmentStatus: payload.fulfillment_status,
      lineItems: payload.line_items || [],
      customerId: customer.id?.toString(),
      checkoutId: payload.checkout_id?.toString(),
      orderDate: new Date(payload.created_at || Date.now())
    }
  });
}

async function handleCheckoutUpdate(merchantId: string, payload: any): Promise<void> {
  if (payload.payment_due && parseFloat(payload.payment_due) > 0) {
    await handleCartUpdate(merchantId, payload);
  }
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('20')) return cleaned;
  if (cleaned.startsWith('0')) return '20' + cleaned.slice(1);
  return '20' + cleaned;
}

export { processWebhookIdempotently };
