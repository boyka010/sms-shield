// ─────────────────────────────────────────────────────────────────────────────
// SMS-Shield — Webhook Processing Queue
// ─────────────────────────────────────────────────────────────────────────────

import type { QueueJob, QueueName, QueueProcessor } from './index';
import { getQueue } from './index';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface WebhookProcessJobData {
  shopId: string;
  topic: string;
  shopifyDomain: string;
  payload: unknown; // parsed JSON body
  webhookEventId: string; // the DB record ID
}

// Shopify typed payloads — we extract only the fields we use
interface ShopifyCustomerPayload {
  id: number;
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  tags?: string;
  created_at?: string;
  updated_at?: string;
  orders_count?: number;
  total_spent?: string;
  state?: string;
  default_address?: {
    phone?: string;
    country?: string;
    city?: string;
  };
}

interface ShopifyCartPayload {
  token?: string;
  note?: string;
  total_price?: string;
  currency?: string;
  line_items?: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
    variant_id?: number;
    product_id?: number;
    properties?: Record<string, string>;
  }>;
  customer?: ShopifyCustomerPayload;
  created_at?: string;
  updated_at?: string;
}

interface ShopifyOrderPayload {
  id: number;
  order_number: number;
  email?: string;
  phone?: string;
  total_price?: string;
  currency?: string;
  financial_status?: string;
  fulfillment_status?: string;
  customer?: ShopifyCustomerPayload;
  line_items?: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
    variant_id?: number;
    product_id?: number;
  }>;
  created_at?: string;
  processed_at?: string;
  tags?: string;
  discount_codes?: Array<{ code: string; amount: string }>;
  shipping_address?: {
    phone?: string;
    first_name?: string;
    last_name?: string;
    city?: string;
    country?: string;
  };
}

interface ShopifyCheckoutPayload {
  id: number;
  token?: string;
  email?: string;
  phone?: string;
  total_price?: string;
  currency?: string;
  source_name?: string;
  customer?: ShopifyCustomerPayload;
  line_items?: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
  }>;
  created_at?: string;
  updated_at?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const QUEUE_NAME: QueueName = 'webhook-process';

const SUPPORTED_TOPICS = new Set([
  'carts/update',
  'orders/create',
  'orders/updated',
  'orders/cancelled',
  'checkouts/create',
  'checkouts/update',
  'customers/create',
  'customers/update',
  'customers/enabled',
  'customers/disable',
  'app/uninstalled',
  'shop/update',
  'products/update',
]);

// ── Topic Router Map ─────────────────────────────────────────────────────────

type TopicHandler = (shopId: string, payload: unknown, webhookEventId: string) => Promise<void>;

const TOPIC_HANDLERS: Record<string, TopicHandler> = {
  'carts/update': handleCartUpdate,
  'orders/create': handleOrderCreate,
  'orders/updated': handleOrderUpdated,
  'orders/cancelled': handleOrderCancelled,
  'checkouts/create': handleCheckoutCreate,
  'checkouts/update': handleCheckoutUpdate,
  'customers/create': handleCustomerCreate,
  'customers/update': handleCustomerUpdate,
  'customers/enabled': handleCustomerCreate, // treat same as create
  'customers/disable': handleCustomerDisable,
  'app/uninstalled': handleAppUninstalled,
  'shop/update': handleShopUpdate,
  'products/update': handleProductUpdate,
};

// ── Main Processor ───────────────────────────────────────────────────────────

async function processWebhook(job: QueueJob<WebhookProcessJobData>): Promise<void> {
  const { shopId, topic, shopifyDomain, payload, webhookEventId } = job.data;

  logger.info('Processing webhook', {
    jobId: job.id,
    shopId,
    topic,
    shopifyDomain,
    webhookEventId,
  });

  // ── Validate topic ────────────────────────────────────────────────────
  if (!SUPPORTED_TOPICS.has(topic)) {
    logger.warn('Unsupported webhook topic — skipping', {
      jobId: job.id,
      shopId,
      topic,
      webhookEventId,
    });
    await markWebhookEvent(webhookEventId, 'skipped', `Unsupported topic: ${topic}`);
    return;
  }

  // ── Validate payload ──────────────────────────────────────────────────
  if (!payload || typeof payload !== 'object') {
    const error = 'Invalid or empty webhook payload';
    logger.error(error, { jobId: job.id, shopId, topic, webhookEventId });
    await markWebhookEvent(webhookEventId, 'failed', error);
    throw new Error(error);
  }

  // ── Mark event as processing ──────────────────────────────────────────
  await markWebhookEvent(webhookEventId, 'processing');

  // ── Route to handler ──────────────────────────────────────────────────
  const handler = TOPIC_HANDLERS[topic];
  if (!handler) {
    logger.warn('No handler registered for topic', { topic, shopId, webhookEventId });
    await markWebhookEvent(webhookEventId, 'skipped', `No handler for topic: ${topic}`);
    return;
  }

  try {
    await handler(shopId, payload, webhookEventId);
    await markWebhookEvent(webhookEventId, 'completed');

    logger.info('Webhook processed successfully', {
      jobId: job.id,
      shopId,
      topic,
      webhookEventId,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('Webhook handler failed', {
      jobId: job.id,
      shopId,
      topic,
      webhookEventId,
      error,
    });
    await markWebhookEvent(webhookEventId, 'failed', error);
    throw err; // re-throw to trigger queue retry
  }
}

// ── Webhook Event DB helpers ─────────────────────────────────────────────────

async function markWebhookEvent(
  webhookEventId: string,
  status: string,
  errorMessage?: string | null,
): Promise<void> {
  try {
    await (db as any).webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status,
        errorMessage: errorMessage ?? null,
        processedAt: status === 'completed' || status === 'failed' ? new Date() : null,
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    logger.error('Failed to update webhook event status', {
      webhookEventId,
      status,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Normalize phone number ───────────────────────────────────────────────────

function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  // Remove all non-digit characters except leading +
  let cleaned = raw.replace(/[^\d+]/g, '');
  // If it starts with 00, replace with +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }
  // Must match E.164
  if (/^\+\d{7,15}$/.test(cleaned)) return cleaned;
  // If no + and looks like a domestic number, prepend country code from shop settings
  // (in production, fetch from shop config; for now, assume Egypt +20)
  if (/^\d{10,13}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  return null;
}

// ── Topic Handlers ───────────────────────────────────────────────────────────

async function handleCartUpdate(
  shopId: string,
  rawPayload: unknown,
  _webhookEventId: string,
): Promise<void> {
  const payload = rawPayload as ShopifyCartPayload;

  logger.info('Handling cart/update', { shopId, cartToken: payload.token });

  if (!payload.token) {
    logger.warn('Cart update has no token — skipping', { shopId });
    return;
  }

  // Phone from customer or shipping address
  const phone = normalizePhone(
    payload.customer?.phone ?? payload.customer?.default_address?.phone,
  );

  // Find or create subscriber
  const email = payload.customer?.email;
  if (!phone && !email) {
    logger.warn('Cart update has no phone or email — skipping', {
      shopId,
      cartToken: payload.token,
    });
    return;
  }

  const total = parseFloat(payload.total_price ?? '0');
  const lineItems = (payload.line_items ?? []).map((item) => ({
    title: item.title,
    quantity: item.quantity,
    price: parseFloat(item.price),
  }));

  // Upsert the CartAbandonment record
  const cartData: Record<string, unknown> = {
    shopId,
    cartToken: payload.token,
    customerEmail: email,
    customerPhone: phone,
    customerName: payload.customer
      ? `${payload.customer.first_name ?? ''} ${payload.customer.last_name ?? ''}`.trim()
      : null,
    currency: payload.currency ?? 'EGP',
    cartTotal: total,
    lineItemsCount: lineItems.reduce((sum, item) => sum + item.quantity, 0),
    lineItemsJson: JSON.stringify(lineItems),
    status: 'active',
    lastUpdatedAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    await (db as any).cartAbandonment.upsert({
      where: {
        shopId_cartToken: { shopId, cartToken: payload.token },
      },
      create: {
        ...cartData,
        createdAt: new Date(),
      },
      update: {
        cartTotal: total,
        lineItemsCount: cartData.lineItemsCount,
        lineItemsJson: cartData.lineItemsJson,
        customerEmail: email,
        customerPhone: phone,
        customerName: cartData.customerName,
        lastUpdatedAt: new Date(),
        status: 'active',
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    logger.error('Failed to upsert cart abandonment record', {
      shopId,
      cartToken: payload.token,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  // Sync subscriber if we have contact info
  if (phone || email) {
    await syncSubscriberFromCart(shopId, {
      email,
      phone,
      firstName: payload.customer?.first_name,
      lastName: payload.customer?.last_name,
      shopifyCustomerId: payload.customer?.id?.toString(),
    });
  }

  logger.info('Cart abandonment record upserted', {
    shopId,
    cartToken: payload.token,
    total,
    itemCount: lineItems.length,
  });
}

async function handleCheckoutCreate(
  shopId: string,
  rawPayload: unknown,
  _webhookEventId: string,
): Promise<void> {
  const payload = rawPayload as ShopifyCheckoutPayload;

  logger.info('Handling checkouts/create', {
    shopId,
    checkoutId: payload.id,
    token: payload.token,
  });

  if (!payload.token) return;

  const phone = normalizePhone(payload.phone ?? payload.customer?.phone);
  const email = payload.email ?? payload.customer?.email;
  const total = parseFloat(payload.total_price ?? '0');

  // Update the cart abandonment record with checkout data
  try {
    await (db as any).cartAbandonment.updateMany({
      where: { shopId, cartToken: payload.token },
      data: {
        checkoutId: payload.id.toString(),
        checkoutEmail: email,
        checkoutPhone: phone,
        checkoutTotal: total,
        status: 'checkout_started',
        lastUpdatedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    logger.warn('Failed to update cart abandonment with checkout data', {
      shopId,
      checkoutId: payload.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Sync subscriber
  if (phone || email) {
    await syncSubscriberFromCart(shopId, {
      email,
      phone,
      firstName: payload.customer?.first_name,
      lastName: payload.customer?.last_name,
      shopifyCustomerId: payload.customer?.id?.toString(),
    });
  }
}

async function handleCheckoutUpdate(
  shopId: string,
  rawPayload: unknown,
  _webhookEventId: string,
): Promise<void> {
  const payload = rawPayload as ShopifyCheckoutPayload;

  logger.info('Handling checkouts/update', {
    shopId,
    checkoutId: payload.id,
    token: payload.token,
  });

  if (!payload.token) return;

  const phone = normalizePhone(payload.phone ?? payload.customer?.phone);
  const email = payload.email ?? payload.customer?.email;
  const total = parseFloat(payload.total_price ?? '0');

  try {
    await (db as any).cartAbandonment.updateMany({
      where: { shopId, cartToken: payload.token },
      data: {
        checkoutEmail: email,
        checkoutPhone: phone,
        checkoutTotal: total,
        lastUpdatedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    logger.warn('Failed to update cart abandonment on checkout update', {
      shopId,
      checkoutId: payload.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleOrderCreate(
  shopId: string,
  rawPayload: unknown,
  _webhookEventId: string,
): Promise<void> {
  const payload = rawPayload as ShopifyOrderPayload;

  logger.info('Handling orders/create', {
    shopId,
    orderId: payload.id,
    orderNumber: payload.order_number,
  });

  const total = parseFloat(payload.total_price ?? '0');
  const phone = normalizePhone(
    payload.phone ?? payload.shipping_address?.phone ?? payload.customer?.phone,
  );
  const email = payload.email ?? payload.customer?.email;
  const firstName = payload.customer?.first_name ?? payload.shipping_address?.first_name;
  const lastName = payload.customer?.last_name ?? payload.shipping_address?.last_name;

  // ── Recover any associated cart abandonment ───────────────────────────
  // Match by customer email or phone
  if (email || phone) {
    try {
      const whereClause: Record<string, unknown> = {
        shopId,
        status: { in: ['active', 'first_touch_sent', 'second_touch_sent'] },
      };
      if (email) whereClause.customerEmail = email;
      else if (phone) whereClause.customerPhone = phone;

      await (db as any).cartAbandonment.updateMany({
        where: whereClause,
        data: {
          status: 'recovered',
          recoveredOrderId: payload.id.toString(),
          recoveredAt: new Date(),
          updatedAt: new Date(),
        },
      });

      logger.info('Cart abandonment recovered via order', {
        shopId,
        orderId: payload.id,
        customerEmail: email,
        customerPhone: phone,
      });
    } catch (err) {
      logger.warn('Failed to recover cart abandonment on order create', {
        shopId,
        orderId: payload.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Sync / upsert subscriber ──────────────────────────────────────────
  if (phone || email) {
    await syncSubscriberFromOrder(shopId, {
      email,
      phone,
      firstName,
      lastName,
      shopifyCustomerId: payload.customer?.id?.toString(),
      totalSpent: total,
      orderCount: 1,
    });
  }

  // ── Trigger post-purchase automation ──────────────────────────────────
  try {
    await triggerAutomation(shopId, 'POST_PURCHASE', {
      orderId: payload.id.toString(),
      orderName: `#${payload.order_number}`,
      total,
      currency: payload.currency ?? 'EGP',
      customerPhone: phone,
      customerEmail: email,
      customerName: `${firstName ?? ''} ${lastName ?? ''}`.trim(),
    });
  } catch (err) {
    logger.warn('Failed to trigger post-purchase automation', {
      shopId,
      orderId: payload.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleOrderUpdated(
  shopId: string,
  rawPayload: unknown,
  _webhookEventId: string,
): Promise<void> {
  const payload = rawPayload as ShopifyOrderPayload;

  logger.info('Handling orders/updated', {
    shopId,
    orderId: payload.id,
    financialStatus: payload.financial_status,
    fulfillmentStatus: payload.fulfillment_status,
  });

  // If order is now confirmed (COD), trigger COD confirmation automation
  if (payload.financial_status === 'pending' && payload.fulfillment_status === null) {
    const phone = normalizePhone(
      payload.phone ?? payload.shipping_address?.phone ?? payload.customer?.phone,
    );

    if (phone) {
      try {
        await triggerAutomation(shopId, 'COD_CONFIRMATION', {
          orderId: payload.id.toString(),
          orderName: `#${payload.order_number}`,
          total: parseFloat(payload.total_price ?? '0'),
          currency: payload.currency ?? 'EGP',
          customerPhone: phone,
        });
      } catch (err) {
        logger.warn('Failed to trigger COD confirmation', {
          shopId,
          orderId: payload.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // Update subscriber order stats
  const total = parseFloat(payload.total_price ?? '0');
  await updateSubscriberOrderStats(shopId, {
    email: payload.email,
    phone: normalizePhone(payload.phone ?? payload.customer?.phone),
    totalSpent: total,
  });
}

async function handleOrderCancelled(
  shopId: string,
  rawPayload: unknown,
  _webhookEventId: string,
): Promise<void> {
  const payload = rawPayload as ShopifyOrderPayload;

  logger.info('Handling orders/cancelled', {
    shopId,
    orderId: payload.id,
    orderNumber: payload.order_number,
  });

  // Decrement subscriber order stats
  await updateSubscriberOrderStats(shopId, {
    email: payload.email,
    phone: normalizePhone(payload.phone ?? payload.customer?.phone),
    totalSpent: -parseFloat(payload.total_price ?? '0'),
    orderCountDelta: -1,
  });
}

async function handleCustomerCreate(
  shopId: string,
  rawPayload: unknown,
  _webhookEventId: string,
): Promise<void> {
  const payload = rawPayload as ShopifyCustomerPayload;

  logger.info('Handling customers/create', {
    shopId,
    customerId: payload.id,
    email: payload.email,
  });

  const phone = normalizePhone(payload.phone ?? payload.default_address?.phone);

  await syncSubscriberFromCustomer(shopId, {
    shopifyCustomerId: payload.id.toString(),
    email: payload.email,
    phone,
    firstName: payload.first_name,
    lastName: payload.last_name,
    tags: payload.tags,
    ordersCount: payload.orders_count ?? 0,
    totalSpent: parseFloat(payload.total_spent ?? '0'),
    state: payload.state,
    isNew: true,
  });
}

async function handleCustomerUpdate(
  shopId: string,
  rawPayload: unknown,
  _webhookEventId: string,
): Promise<void> {
  const payload = rawPayload as ShopifyCustomerPayload;

  logger.info('Handling customers/update', {
    shopId,
    customerId: payload.id,
    email: payload.email,
  });

  const phone = normalizePhone(payload.phone ?? payload.default_address?.phone);

  await syncSubscriberFromCustomer(shopId, {
    shopifyCustomerId: payload.id.toString(),
    email: payload.email,
    phone,
    firstName: payload.first_name,
    lastName: payload.last_name,
    tags: payload.tags,
    ordersCount: payload.orders_count ?? 0,
    totalSpent: parseFloat(payload.total_spent ?? '0'),
    state: payload.state,
    isNew: false,
  });
}

async function handleCustomerDisable(
  shopId: string,
  rawPayload: unknown,
  _webhookEventId: string,
): Promise<void> {
  const payload = rawPayload as ShopifyCustomerPayload;

  logger.info('Handling customers/disable', {
    shopId,
    customerId: payload.id,
    email: payload.email,
  });

  // Mark subscriber as unsubscribed
  const email = payload.email;
  const phone = normalizePhone(payload.phone ?? payload.default_address?.phone);

  if (email || phone) {
    try {
      const whereClause: Record<string, unknown> = { shopId };
      if (email) whereClause.email = email;
      else if (phone) whereClause.phone = phone;

      await (db as any).subscriber.updateMany({
        where: whereClause,
        data: {
          isActive: false,
          unsubscribedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      logger.warn('Failed to deactivate subscriber on customer/disable', {
        shopId,
        customerId: payload.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

async function handleAppUninstalled(
  shopId: string,
  _rawPayload: unknown,
  _webhookEventId: string,
): Promise<void> {
  logger.warn('App uninstalled — deactivating shop', { shopId });

  try {
    await (db as any).shop.update({
      where: { id: shopId },
      data: {
        isActive: false,
        uninstalledAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Cancel all active automations for this shop
    await (db as any).automationExecution.updateMany({
      where: {
        shopId,
        status: { in: ['initialized', 'waiting', 'first_touch_sent', 'second_touch_sent'] },
      },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      },
    });

    logger.info('Shop deactivated on app uninstall', { shopId });
  } catch (err) {
    logger.error('Failed to deactivate shop on uninstall', {
      shopId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

async function handleShopUpdate(
  shopId: string,
  _rawPayload: unknown,
  _webhookEventId: string,
): Promise<void> {
  logger.info('Handling shop/update', { shopId });
  // In production: sync shop details (name, domain, currency, etc.)
  // For now this is a no-op placeholder that keeps the webhook event clean
}

async function handleProductUpdate(
  shopId: string,
  rawPayload: unknown,
  _webhookEventId: string,
): Promise<void> {
  const payload = rawPayload as { id?: number; title?: string; status?: string };
  logger.info('Handling products/update', {
    shopId,
    productId: payload?.id,
    productTitle: payload?.title,
  });
  // Could trigger inventory/sale price alerts in the future
}

// ── Subscriber sync helpers ──────────────────────────────────────────────────

interface SubscriberSyncData {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  shopifyCustomerId?: string;
}

async function syncSubscriberFromCart(
  shopId: string,
  data: SubscriberSyncData,
): Promise<void> {
  try {
    const whereClause: Record<string, unknown> = { shopId };
    if (data.phone) {
      whereClause.phone = data.phone;
    } else if (data.email) {
      whereClause.email = data.email;
    } else {
      return;
    }

    await (db as any).subscriber.upsert({
      where: whereClause as any,
      create: {
        shopId,
        email: data.email,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        shopifyCustomerId: data.shopifyCustomerId,
        isActive: true,
        source: 'cart_abandonment',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        email: data.email ?? undefined,
        phone: data.phone ?? undefined,
        firstName: data.firstName ?? undefined,
        lastName: data.lastName ?? undefined,
        shopifyCustomerId: data.shopifyCustomerId ?? undefined,
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    logger.warn('Failed to sync subscriber from cart', {
      shopId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function syncSubscriberFromOrder(
  shopId: string,
  data: SubscriberSyncData & { totalSpent?: number; orderCount?: number },
): Promise<void> {
  try {
    const whereClause: Record<string, unknown> = { shopId };
    if (data.phone) {
      whereClause.phone = data.phone;
    } else if (data.email) {
      whereClause.email = data.email;
    } else {
      return;
    }

    await (db as any).subscriber.upsert({
      where: whereClause as any,
      create: {
        shopId,
        email: data.email,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        shopifyCustomerId: data.shopifyCustomerId,
        totalSpent: data.totalSpent ?? 0,
        totalOrders: data.orderCount ?? 1,
        lastOrderAt: new Date(),
        isActive: true,
        source: 'order',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        email: data.email ?? undefined,
        phone: data.phone ?? undefined,
        firstName: data.firstName ?? undefined,
        lastName: data.lastName ?? undefined,
        shopifyCustomerId: data.shopifyCustomerId ?? undefined,
        totalSpent: { increment: data.totalSpent ?? 0 },
        totalOrders: { increment: data.orderCount ?? 1 },
        lastOrderAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    logger.warn('Failed to sync subscriber from order', {
      shopId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function syncSubscriberFromCustomer(
  shopId: string,
  data: SubscriberSyncData & {
    tags?: string | null;
    ordersCount?: number;
    totalSpent?: number;
    state?: string | null;
    isNew?: boolean;
  },
): Promise<void> {
  try {
    const whereClause: Record<string, unknown> = { shopId };
    if (data.shopifyCustomerId) {
      whereClause.shopifyCustomerId = data.shopifyCustomerId;
    } else if (data.phone) {
      whereClause.phone = data.phone;
    } else if (data.email) {
      whereClause.email = data.email;
    } else {
      return;
    }

    await (db as any).subscriber.upsert({
      where: whereClause as any,
      create: {
        shopId,
        email: data.email,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        shopifyCustomerId: data.shopifyCustomerId,
        tags: data.tags ?? '',
        totalSpent: data.totalSpent ?? 0,
        totalOrders: data.ordersCount ?? 0,
        isActive: data.state !== 'disabled',
        source: 'customer_sync',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        email: data.email ?? undefined,
        phone: data.phone ?? undefined,
        firstName: data.firstName ?? undefined,
        lastName: data.lastName ?? undefined,
        tags: data.tags ?? undefined,
        totalSpent: data.totalSpent,
        totalOrders: data.ordersCount,
        isActive: data.state !== 'disabled',
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    logger.warn('Failed to sync subscriber from customer', {
      shopId,
      customerId: data.shopifyCustomerId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function updateSubscriberOrderStats(
  shopId: string,
  data: {
    email?: string | null;
    phone?: string | null;
    totalSpent?: number;
    orderCountDelta?: number;
  },
): Promise<void> {
  try {
    const whereClause: Record<string, unknown> = { shopId };
    if (data.phone) {
      whereClause.phone = data.phone;
    } else if (data.email) {
      whereClause.email = data.email;
    } else {
      return;
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.totalSpent !== undefined) {
      updateData.totalSpent = { increment: data.totalSpent };
    }
    if (data.orderCountDelta !== undefined) {
      updateData.totalOrders = { increment: data.orderCountDelta };
      if (data.orderCountDelta > 0) {
        updateData.lastOrderAt = new Date();
      }
    }

    await (db as any).subscriber.updateMany({
      where: whereClause,
      data: updateData,
    });
  } catch (err) {
    logger.warn('Failed to update subscriber order stats', {
      shopId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Automation trigger helper ────────────────────────────────────────────────

async function triggerAutomation(
  shopId: string,
  flowType: string,
  contextData: Record<string, unknown>,
): Promise<void> {
  try {
    // Check if automation is enabled for this shop
    const automationConfig = await (db as any).automationConfig.findFirst({
      where: { shopId, flowType, isActive: true },
    });

    if (!automationConfig) {
      logger.debug('Automation not enabled for shop/flow', { shopId, flowType });
      return;
    }

    // Create an automation execution
    await (db as any).automationExecution.create({
      data: {
        shopId,
        flowType,
        status: 'initialized',
        contextData: JSON.stringify(contextData),
        configId: automationConfig.id,
        currentStep: 0,
        currentState: 'initialized',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    logger.info('Automation triggered', {
      shopId,
      flowType,
      configId: automationConfig.id,
    });
  } catch (err) {
    logger.warn('Failed to trigger automation', {
      shopId,
      flowType,
      error: err instanceof Error ? err.message : String(err),
    });
    // Don't throw — webhook processing shouldn't fail because automation trigger failed
  }
}

// ── Registration ─────────────────────────────────────────────────────────────

export function registerWebhookQueue(): void {
  const queue = getQueue<WebhookProcessJobData>(QUEUE_NAME);
  queue.register(processWebhook as QueueProcessor<WebhookProcessJobData>);
  logger.info('Webhook processing queue registered', { queue: QUEUE_NAME });
}

export { processWebhook };
