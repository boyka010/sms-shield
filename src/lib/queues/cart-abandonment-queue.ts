// ─────────────────────────────────────────────────────────────────────────────
// SMS-Shield — Cart Abandonment Monitoring Queue
// ─────────────────────────────────────────────────────────────────────────────

import type { QueueJob, QueueName, QueueProcessor } from './index';
import { getQueue } from './index';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CartAbandonmentJobData {
  shopId: string;
  checkType: 'initial' | 'follow_up_1' | 'follow_up_2' | 'final';
  lookbackMinutes: number;
}

interface CartAbandonmentRecord {
  id: string;
  shopId: string;
  cartToken: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerName: string | null;
  encryptedPhone?: string | null;   // if phone is stored encrypted
  cartTotal: number;
  currency: string;
  lineItemsCount: number;
  lineItemsJson: string;
  status: string;
  recoveryStatus: string;
  touchCount: number;
  lastTouchSentAt: Date | null;
  lastTouchType: string | null;
  checkoutId: string | null;
  checkoutEmail: string | null;
  checkoutPhone: string | null;
  checkoutTotal: number | null;
  recoveredAt: Date | null;
  recoveredOrderId: string | null;
  lastUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface CartRecoverySettings {
  shopId: string;
  isEnabled: boolean;
  delayMinutes: number;
  followUp1DelayMinutes: number;
  followUp2DelayMinutes: number;
  finalDelayMinutes: number;
  initialTemplate: string | null;
  followUp1Template: string | null;
  followUp2Template: string | null;
  finalTemplate: string | null;
  maxTouchesPerCart: number;
  stopOnRecovery: boolean;
  senderName: string | null;
}

interface SubscriberRecord {
  id: string;
  shopId: string;
  email: string | null;
  phone: string | null;
  encryptedPhone?: string | null;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  unsubscribedAt: Date | null;
  isPhoneVerified: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const QUEUE_NAME: QueueName = 'cart-abandonment-check';

/** Maps checkType → the recovery status value expected on carts to process */
const CHECK_TYPE_STATUS_MAP: Record<CartAbandonmentJobData['checkType'], string[]> = {
  initial: ['active', 'checkout_started'],
  follow_up_1: ['first_touch_sent'],
  follow_up_2: ['second_touch_sent'],
  final: ['third_touch_sent'],
};

/** Maps checkType → the next recovery status to set after queuing SMS */
const CHECK_TYPE_NEXT_STATUS: Record<CartAbandonmentJobData['checkType'], string> = {
  initial: 'first_touch_sent',
  follow_up_1: 'second_touch_sent',
  follow_up_2: 'third_touch_sent',
  final: 'final_touch_sent',
};

/** Maps checkType → template field on CartRecoverySettings */
const CHECK_TYPE_TEMPLATE_FIELD: Record<CartAbandonmentJobData['checkType'], keyof CartRecoverySettings> = {
  initial: 'initialTemplate',
  follow_up_1: 'followUp1Template',
  follow_up_2: 'followUp2Template',
  final: 'finalTemplate',
};

/** Maps checkType → touch type stored on TouchPoint */
const CHECK_TYPE_TOUCH_TYPE: Record<CartAbandonmentJobData['checkType'], string> = {
  initial: 'cart_recovery_1',
  follow_up_1: 'cart_recovery_2',
  follow_up_2: 'cart_recovery_3',
  final: 'cart_recovery_final',
};

// ── Template variable replacement ────────────────────────────────────────────

function renderTemplate(
  template: string,
  variables: Record<string, string | number | undefined>,
): string {
  let rendered = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    if (rendered.includes(placeholder)) {
      rendered = rendered.replaceAll(placeholder, value != null ? String(value) : '');
    }
  }

  // Clean up any unresolved placeholders
  rendered = rendered.replace(/\{\{[^}]+\}\}/g, '');

  return rendered.trim();
}

// ── Main Processor ───────────────────────────────────────────────────────────

async function processCartAbandonment(job: QueueJob<CartAbandonmentJobData>): Promise<void> {
  const { shopId, checkType, lookbackMinutes } = job.data;

  logger.info('Processing cart abandonment check', {
    jobId: job.id,
    shopId,
    checkType,
    lookbackMinutes,
  });

  // ── Step 1: Load shop's cart recovery settings ────────────────────────
  const settings = await loadCartRecoverySettings(shopId);
  if (!settings || !settings.isEnabled) {
    logger.info('Cart recovery not enabled for shop', { shopId });
    return;
  }

  // Get the template for this check type
  const templateField = CHECK_TYPE_TEMPLATE_FIELD[checkType];
  const rawTemplate = settings[templateField];
  const template = typeof rawTemplate === 'string' ? rawTemplate : null;
  if (!template) {
    logger.warn(`No template configured for ${checkType}`, { shopId, checkType });
    return;
  }

  // ── Step 2: Fetch matching carts ───────────────────────────────────────
  const validStatuses = CHECK_TYPE_STATUS_MAP[checkType];
  const cutoffDate = new Date(Date.now() - lookbackMinutes * 60 * 1000);

  const carts = await fetchMatchingCarts(shopId, validStatuses, cutoffDate, settings.maxTouchesPerCart);

  if (carts.length === 0) {
    logger.info('No matching abandoned carts found', {
      shopId,
      checkType,
      validStatuses,
      lookbackMinutes,
    });
    return;
  }

  logger.info(`Found ${carts.length} abandoned carts to process`, {
    shopId,
    checkType,
  });

  // ── Step 3: Process each cart ─────────────────────────────────────────
  let processed = 0;
  let skipped = 0;
  let queued = 0;

  for (const cart of carts) {
    const result = await processSingleCart(cart, checkType, settings, template);
    if (result === 'queued') {
      queued++;
    } else if (result === 'skipped') {
      skipped++;
    }
    processed++;
  }

  logger.info('Cart abandonment check completed', {
    jobId: job.id,
    shopId,
    checkType,
    total: carts.length,
    processed,
    queued,
    skipped,
  });
}

// ── Data fetching ────────────────────────────────────────────────────────────

async function loadCartRecoverySettings(shopId: string): Promise<CartRecoverySettings | null> {
  try {
    const settings = await (db as any).cartRecoverySettings.findUnique({
      where: { shopId },
    });
    return settings as CartRecoverySettings | null;
  } catch (err) {
    logger.error('Failed to load cart recovery settings', {
      shopId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function fetchMatchingCarts(
  shopId: string,
  validStatuses: string[],
  cutoffDate: Date,
  maxTouchesPerCart: number,
): Promise<CartAbandonmentRecord[]> {
  try {
    const carts = await (db as any).cartAbandonment.findMany({
      where: {
        shopId,
        recoveryStatus: { in: validStatuses },
        lastUpdatedAt: { lte: cutoffDate },
        recoveredAt: null, // not already recovered
        touchCount: { lt: maxTouchesPerCart }, // haven't exceeded max touches
      },
      orderBy: { lastUpdatedAt: 'asc' }, // process oldest first
      take: 500, // batch limit per job run
    });

    return carts as CartAbandonmentRecord[];
  } catch (err) {
    logger.error('Failed to fetch matching abandoned carts', {
      shopId,
      validStatuses,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

async function fetchSubscriberByPhoneOrEmail(
  shopId: string,
  phone: string | null,
  email: string | null,
): Promise<SubscriberRecord | null> {
  try {
    if (phone) {
      const sub = await (db as any).subscriber.findFirst({
        where: { shopId, phone },
      });
      if (sub) return sub as SubscriberRecord;
    }

    if (email) {
      const sub = await (db as any).subscriber.findFirst({
        where: { shopId, email },
      });
      if (sub) return sub as SubscriberRecord;
    }

    return null;
  } catch (err) {
    logger.warn('Failed to fetch subscriber', {
      shopId,
      phone,
      email,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Single cart processing ───────────────────────────────────────────────────

type ProcessingResult = 'queued' | 'skipped';

async function processSingleCart(
  cart: CartAbandonmentRecord,
  checkType: CartAbandonmentJobData['checkType'],
  settings: CartRecoverySettings,
  template: string,
): Promise<ProcessingResult> {
  // ── Resolve phone number ──────────────────────────────────────────────
  // Priority: cart.customerPhone > cart.checkoutPhone > subscriber.phone
  let phone = cart.customerPhone ?? cart.checkoutPhone;

  // Handle encrypted phone
  if (!phone && cart.encryptedPhone) {
    try {
      const encKey = process.env.ENCRYPTION_KEY;
      if (encKey) {
        phone = await (await import('@/lib/encryption')).decrypt(cart.encryptedPhone, encKey);
      }
    } catch {
      logger.warn('Failed to decrypt cart phone', {
        cartId: cart.id,
        shopId: cart.shopId,
      });
    }
  }

  // ── Load subscriber for additional phone lookup & opt-out check ───────
  const subscriber = await fetchSubscriberByPhoneOrEmail(
    cart.shopId,
    phone,
    cart.customerEmail ?? cart.checkoutEmail,
  );

  // Check opt-out
  if (subscriber && !subscriber.isActive) {
    logger.debug('Subscriber is inactive/unsubscribed — skipping', {
      cartId: cart.id,
      subscriberId: subscriber.id,
    });
    await updateCartStatus(cart.id, 'unsubscribed');
    return 'skipped';
  }

  // Try subscriber phone if we don't have one from cart
  if (!phone && subscriber?.phone) {
    phone = subscriber.phone;
  }

  // Handle encrypted subscriber phone
  if (!phone && subscriber?.encryptedPhone) {
    try {
      const encKey = process.env.ENCRYPTION_KEY;
      if (encKey) {
        phone = await (await import('@/lib/encryption')).decrypt(subscriber.encryptedPhone, encKey);
      }
    } catch {
      // ignore
    }
  }

  // ── Validate we have a phone number ───────────────────────────────────
  if (!phone || !isValidPhone(phone)) {
    logger.debug('No valid phone number for cart — skipping', {
      cartId: cart.id,
      shopId: cart.shopId,
      customerEmail: cart.customerEmail,
    });
    await updateCartStatus(cart.id, 'no_phone');
    return 'skipped';
  }

  // ── Parse cart line items for template ────────────────────────────────
  let lineItems: Array<{ title: string; quantity: number; price: number }> = [];
  try {
    lineItems = JSON.parse(cart.lineItemsJson ?? '[]');
  } catch {
    lineItems = [];
  }

  const topItem = lineItems[0]?.title ?? 'your items';
  const itemNames = lineItems.map((item) => item.title);
  const itemsSummary =
    itemNames.length <= 2
      ? itemNames.join(' and ')
      : `${itemNames[0]} and ${itemNames.length - 1} more items`;

  const customerName =
    cart.customerName ??
    (subscriber ? `${subscriber.firstName ?? ''} ${subscriber.lastName ?? ''}`.trim() : 'Customer');

  // ── Build message from template ───────────────────────────────────────
  const message = renderTemplate(template, {
    customer_name: customerName,
    cart_total: formatCurrency(cart.cartTotal, cart.currency),
    item_count: cart.lineItemsCount,
    top_item: topItem,
    items_summary: itemsSummary,
    recovery_link: `https://${settings.shopId ? '' : ''}checkout`, // In production: generate signed recovery URL
    shop_name: cart.shopId, // In production: load shop name
  });

  // ── Queue the SMS send ────────────────────────────────────────────────
  try {
    const { getQueue: getSMQueue } = await import('./index');
    const smsQueue = getSMQueue<import('./sms-queue').SMSSendJobData>('sms-send');
    smsQueue.add(
      {
        shopId: cart.shopId,
        recipientPhone: phone,
        message,
        senderName: settings.senderName ?? undefined,
        encoding: 'AUTO',
        retryOnGatewayFailover: true,
        subscriberId: subscriber?.id,
      },
      { priority: 3 }, // cart recovery is high priority
    );

    // ── Update cart recovery status ────────────────────────────────────
    const nextStatus = CHECK_TYPE_NEXT_STATUS[checkType];
    await updateCartAfterTouch(cart.id, nextStatus, checkType);

    // ── Create TouchPoint record ───────────────────────────────────────
    const touchType = CHECK_TYPE_TOUCH_TYPE[checkType];
    await createTouchPoint({
      shopId: cart.shopId,
      subscriberId: subscriber?.id,
      subscriberPhone: phone,
      touchType,
      cartId: cart.id,
      cartToken: cart.cartToken,
      channel: 'sms',
      messageId: null, // will be filled when SMS is actually sent
      template: template.slice(0, 500), // store truncated template for audit
    });

    return 'queued';
  } catch (err) {
    logger.error('Failed to queue SMS for cart recovery', {
      cartId: cart.id,
      shopId: cart.shopId,
      checkType,
      error: err instanceof Error ? err.message : String(err),
    });
    return 'skipped';
  }
}

// ── DB update helpers ────────────────────────────────────────────────────────

async function updateCartStatus(cartId: string, recoveryStatus: string): Promise<void> {
  try {
    await (db as any).cartAbandonment.update({
      where: { id: cartId },
      data: {
        recoveryStatus,
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    logger.warn('Failed to update cart status', {
      cartId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function updateCartAfterTouch(
  cartId: string,
  nextStatus: string,
  checkType: string,
): Promise<void> {
  try {
    await (db as any).cartAbandonment.update({
      where: { id: cartId },
      data: {
        recoveryStatus: nextStatus,
        lastTouchSentAt: new Date(),
        lastTouchType: checkType,
        touchCount: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    logger.warn('Failed to update cart after touch', {
      cartId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

interface TouchPointCreateData {
  shopId: string;
  subscriberId?: string | null;
  subscriberPhone: string;
  touchType: string;
  cartId: string;
  cartToken: string;
  channel: string;
  messageId?: string | null;
  template?: string;
}

async function createTouchPoint(data: TouchPointCreateData): Promise<void> {
  try {
    await (db as any).touchPoint.create({
      data: {
        shopId: data.shopId,
        subscriberId: data.subscriberId,
        subscriberPhone: data.subscriberPhone,
        touchType: data.touchType,
        cartId: data.cartId,
        cartToken: data.cartToken,
        channel: data.channel,
        messageId: data.messageId,
        template: data.template,
        status: 'queued',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    logger.warn('Failed to create touch point', {
      shopId: data.shopId,
      cartId: data.cartId,
      touchType: data.touchType,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Utility helpers ──────────────────────────────────────────────────────────

function isValidPhone(phone: string): boolean {
  return /^\+\d{7,15}$/.test(phone);
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'EGP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || 'EGP'} ${amount.toFixed(2)}`;
  }
}

// ── Schedule helper — create cron-style jobs for cart abandonment checks ─────

export function scheduleCartAbandonmentChecks(shopId: string): void {
  const { getQueue: getCartQueue } = await_safeImport();
  const queue = getCartQueue<CartAbandonmentJobData>('cart-abandonment-check');

  // Initial check: 30 minutes after cart abandonment
  queue.add(
    { shopId, checkType: 'initial', lookbackMinutes: 30 },
    { delayMs: 0, priority: 3 }, // runs immediately on schedule
  );

  // Follow-up 1: 4 hours
  queue.add(
    { shopId, checkType: 'follow_up_1', lookbackMinutes: 240 },
    { delayMs: 0, priority: 4 },
  );

  // Follow-up 2: 24 hours
  queue.add(
    { shopId, checkType: 'follow_up_2', lookbackMinutes: 1440 },
    { delayMs: 0, priority: 5 },
  );

  // Final: 48 hours
  queue.add(
    { shopId, checkType: 'final', lookbackMinutes: 2880 },
    { delayMs: 0, priority: 6 },
  );

  logger.info('Cart abandonment checks scheduled', { shopId });
}

async function await_safeImport() {
  return await import('./index') as typeof import('./index');
}

// ── Registration ─────────────────────────────────────────────────────────────

export function registerCartAbandonmentQueue(): void {
  const queue = getQueue<CartAbandonmentJobData>(QUEUE_NAME);
  queue.register(processCartAbandonment as QueueProcessor<CartAbandonmentJobData>);
  logger.info('Cart abandonment check queue registered', { queue: QUEUE_NAME });
}

export { processCartAbandonment };
