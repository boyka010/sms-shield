// ─────────────────────────────────────────────────────────────────────────────
// SMS-Shield — SMS Sending Queue Processor
// ─────────────────────────────────────────────────────────────────────────────

import type { QueueJob, QueueName } from './index';
import { getQueue, type QueueProcessor } from './index';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { SMSManager, type GatewayConfig, type SendSMSResult } from '@/lib/sms-manager';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SMSSendJobData {
  shopId: string;
  campaignId?: string;
  subscriberId?: string;
  recipientPhone: string; // normalized +20XXXXXXXXXX
  message: string;
  senderName?: string;
  encoding?: 'GSM_7BIT' | 'UCS2' | 'AUTO';
  scheduledAt?: Date;
  retryOnGatewayFailover: boolean;
}

interface ShopGatewayRow {
  id: string;
  shopId: string;
  provider: string;
  encryptedApiKey: string;
  encryptedApiSecret: string | null;
  senderName: string | null;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CampaignMessageRow {
  id: string;
  campaignId: string | null;
  shopId: string;
  subscriberId: string | null;
  recipientPhone: string;
  message: string;
  status: string;
  gatewayMessageId: string | null;
  gatewayProvider: string | null;
  gatewayId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  cost: number | null;
  currency: string | null;
  attempts: number;
  sentAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Constants ────────────────────────────────────────────────────────────────

const QUEUE_NAME: QueueName = 'sms-send';

// Non-retryable gateway error codes — these indicate permanent problems
const NON_RETRYABLE_ERRORS = new Set([
  'INVALID_PHONE_NUMBER',
  'PHONE_NUMBER_BLOCKED',
  'ACCOUNT_SUSPENDED',
  'INSUFFICIENT_CREDITS',
  'CONTENT_FILTERED',
  'SENDER_NAME_REJECTED',
  'OPTED_OUT',
]);

// ── Helpers ──────────────────────────────────────────────────────────────────

function isRetryableError(result: SendSMSResult): boolean {
  if (!result.errorCode) return true; // no error code = probably transient
  return !NON_RETRYABLE_ERRORS.has(result.errorCode);
}

function mapShopGatewayRow(row: ShopGatewayRow): GatewayConfig {
  return {
    id: row.id,
    provider: row.provider as GatewayConfig['provider'],
    encryptedApiKey: row.encryptedApiKey,
    encryptedApiSecret: row.encryptedApiSecret ?? undefined,
    senderName: row.senderName ?? undefined,
    priority: row.priority,
    isActive: row.isActive,
  };
}

/** Validate that a phone number meets minimum requirements. */
function isValidPhone(phone: string): boolean {
  // E.164 format: starts with +, followed by 7-15 digits
  return /^\+\d{7,15}$/.test(phone);
}

/** Truncate message to SMS segment limit (160 GSM-7 / 70 UCS-2 chars per segment). */
function truncateMessage(message: string, encoding: string): string {
  const maxLen = encoding === 'UCS2' ? 70 : 160;
  if (message.length <= maxLen) return message;
  // Allow up to 6 segments
  const maxSegments = 6;
  const segmentMax = encoding === 'UCS2' ? 67 : 153; // with concatenation headers
  const absoluteMax = segmentMax * maxSegments;
  return message.slice(0, absoluteMax);
}

// ── Processor ────────────────────────────────────────────────────────────────

async function processSMSSend(job: QueueJob<SMSSendJobData>): Promise<void> {
  const { data } = job;
  const { shopId, recipientPhone, message, encoding, campaignId, subscriberId } = data;

  logger.info('Processing SMS send job', {
    jobId: job.id,
    shopId,
    recipientPhone: recipientPhone.slice(0, 6) + '***' + recipientPhone.slice(-3),
    campaignId,
    subscriberId,
    attempt: job.attempts + 1,
    maxAttempts: job.maxAttempts,
  });

  // ── Step 1: Validate inputs ───────────────────────────────────────────
  if (!recipientPhone || !isValidPhone(recipientPhone)) {
    const error = `Invalid phone number format: ${recipientPhone}`;
    logger.error('SMS validation failed', { jobId: job.id, shopId, error });
    await updateCampaignMessageStatus(job, 'failed', null, null, null, 'INVALID_INPUT', error);
    // Non-retryable — throw but the queue won't retry since we update status
    throw new NonRetryableError(error);
  }

  if (!message || message.trim().length === 0) {
    const error = 'Message body is empty';
    logger.error('SMS validation failed', { jobId: job.id, shopId, error });
    await updateCampaignMessageStatus(job, 'failed', null, null, null, 'INVALID_INPUT', error);
    throw new NonRetryableError(error);
  }

  const resolvedEncoding: 'GSM_7BIT' | 'UCS2' | 'AUTO' = encoding ?? 'AUTO';
  const finalMessage = truncateMessage(message, resolvedEncoding);

  // ── Step 2: Load shop's gateway configurations ────────────────────────
  let gatewayRows: ShopGatewayRow[];
  try {
    gatewayRows = await (db as any).sMSGateway.findMany({
      where: {
        shopId,
        isActive: true,
      },
      orderBy: { priority: 'asc' },
    }) as ShopGatewayRow[];
  } catch (err) {
    const error = `Failed to load SMS gateways: ${err instanceof Error ? err.message : String(err)}`;
    logger.error('Database error loading gateways', { jobId: job.id, shopId, error });
    throw new Error(error); // retryable — might be transient DB issue
  }

  if (gatewayRows.length === 0) {
    const error = 'No active SMS gateway configured for this shop';
    logger.error(error, { jobId: job.id, shopId });
    await updateCampaignMessageStatus(job, 'failed', null, null, null, 'NO_GATEWAY', error);
    throw new NonRetryableError(error);
  }

  const gatewayConfigs = gatewayRows.map(mapShopGatewayRow);

  // ── Step 3: Create SMSManager and send ────────────────────────────────
  const smsManager = new SMSManager(shopId, gatewayConfigs);

  let sendResult: SendSMSResult;
  try {
    sendResult = await smsManager.sendWithFailover(recipientPhone, finalMessage, {
      senderName: data.senderName,
      encoding: resolvedEncoding,
    });
  } catch (err) {
    const error = `SMSManager threw unexpectedly: ${err instanceof Error ? err.message : String(err)}`;
    logger.error('SMS send failed with unexpected error', { jobId: job.id, shopId, error });
    // Update campaign message as failed
    await updateCampaignMessageStatus(job, 'failed', null, null, null, 'SEND_ERROR', error);
    // Retryable — unknown error
    throw new Error(error);
  }

  // ── Step 4: Handle result ─────────────────────────────────────────────
  if (sendResult.success) {
    logger.info('SMS sent successfully', {
      jobId: job.id,
      shopId,
      messageId: sendResult.messageId,
      gateway: sendResult.provider,
      gatewayId: sendResult.gatewayId,
      cost: sendResult.cost,
      currency: sendResult.currency,
    });

    // Update campaign message record
    await updateCampaignMessageStatus(
      job,
      'sent',
      sendResult.messageId ?? null,
      sendResult.gatewayId,
      sendResult.provider,
      null,
      null,
      sendResult.cost,
      sendResult.currency,
    );
  } else {
    logger.warn('SMS send failed', {
      jobId: job.id,
      shopId,
      errorCode: sendResult.errorCode,
      errorMessage: sendResult.errorMessage,
      gateway: sendResult.provider,
      gatewayId: sendResult.gatewayId,
      attempt: job.attempts + 1,
      retryable: isRetryableError(sendResult),
    });

    // Update campaign message record
    await updateCampaignMessageStatus(
      job,
      'failed',
      null,
      sendResult.gatewayId,
      sendResult.provider,
      sendResult.errorCode ?? 'UNKNOWN',
      sendResult.errorMessage ?? 'Unknown error',
    );

    if (data.retryOnGatewayFailover && isRetryableError(sendResult)) {
      // Throw to trigger queue retry
      throw new Error(
        `SMS send failed (retryable): ${sendResult.errorCode} — ${sendResult.errorMessage}`,
      );
    }

    // Non-retryable failure — log but don't throw
    logger.error('SMS send failed with non-retryable error', {
      jobId: job.id,
      shopId,
      errorCode: sendResult.errorCode,
      errorMessage: sendResult.errorMessage,
    });
  }
}

// ── Database helpers ─────────────────────────────────────────────────────────

async function updateCampaignMessageStatus(
  job: QueueJob<SMSSendJobData>,
  status: string,
  gatewayMessageId: string | null,
  gatewayId: string | null,
  gatewayProvider: string | null,
  errorCode: string | null,
  errorMessage: string | null,
  cost?: number | null,
  currency?: string | null,
): Promise<void> {
  // If this job is associated with a campaign message, update it.
  // The campaign message ID might be derived from the job id or the data.
  // For now we update by shop + campaign + subscriber + phone if possible.

  if (!job.data.campaignId && !job.data.subscriberId) {
    // No campaign/subscriber context — nothing to update in DB
    return;
  }

  try {
    const whereClause: Record<string, unknown> = {
      shopId: job.data.shopId,
      recipientPhone: job.data.recipientPhone,
    };

    if (job.data.campaignId) {
      whereClause.campaignId = job.data.campaignId;
    }
    if (job.data.subscriberId) {
      whereClause.subscriberId = job.data.subscriberId;
    }

    await (db as any).campaignMessage.updateMany({
      where: whereClause,
      data: {
        status,
        gatewayMessageId,
        gatewayId,
        gatewayProvider,
        errorCode,
        errorMessage,
        cost: cost ?? undefined,
        currency: currency ?? undefined,
        attempts: { increment: 1 },
        sentAt: status === 'sent' ? new Date() : undefined,
        updatedAt: new Date(),
      },
    });

    logger.debug('Campaign message updated', {
      shopId: job.data.shopId,
      status,
      gatewayMessageId,
    });
  } catch (err) {
    // DB update failure should not prevent the queue from working
    logger.error('Failed to update campaign message in DB', {
      jobId: job.id,
      shopId: job.data.shopId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Custom error for non-retryable failures ──────────────────────────────────

class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

// ── Registration ─────────────────────────────────────────────────────────────

export function registerSMSQueue(): void {
  const queue = getQueue<SMSSendJobData>(QUEUE_NAME);
  queue.register(processSMSSend as QueueProcessor<SMSSendJobData>);
  logger.info('SMS send queue registered', { queue: QUEUE_NAME });
}

export { processSMSSend };
