import { createClient } from 'ioredis';
import { PrismaClient } from '@prisma/client';

const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const prisma = new PrismaClient();

interface DeadLetterEntry {
  id: string;
  jobType: 'sms' | 'campaign' | 'automation' | 'webhook';
  jobId: string;
  payload: any;
  error: string;
  retryCount: number;
  failedAt: number;
  originalQueue: string;
  merchantId?: string;
  contactId?: string;
  phoneNumber?: string;
}

const DLQ_KEY = 'dlq:entries';
const DLQ_PROCESSING = 'dlq:processing';

export async function addToDeadLetterQueue(
  jobType: DeadLetterEntry['jobType'],
  jobId: string,
  payload: any,
  error: Error | string,
  originalQueue: string,
  options: {
    merchantId?: string;
    contactId?: string;
    phoneNumber?: string;
  } = {}
): Promise<void> {
  const entry: DeadLetterEntry = {
    id: `dlq:${Date.now()}:${Math.random().toString(36).slice(2, 11)}`,
    jobType,
    jobId,
    payload,
    error: error instanceof Error ? error.message : error,
    retryCount: 0,
    failedAt: Date.now(),
    originalQueue,
    merchantId: options.merchantId,
    contactId: options.contactId,
    phoneNumber: options.phoneNumber
  };

  await redis.lpush(DLQ_KEY, JSON.stringify(entry));

  await prisma.smsJob.update({
    where: { id: jobId },
    data: { status: 'FAILED' }
  });

  console.error(`[DLQ] Added job ${jobId} to dead letter queue:`, error instanceof Error ? error.message : error);
}

export async function getDeadLetterEntries(
  start: number = 0,
  count: number = 50
): Promise<DeadLetterEntry[]> {
  const entries = await redis.lrange(DLQ_KEY, start, start + count - 1);
  return entries.map(e => JSON.parse(e));
}

export async function retryDeadLetterEntry(id: string): Promise<{ success: boolean; error?: string }> {
  const entries = await redis.lrange(DLQ_KEY, 0, -1);
  const entry = entries.find(e => JSON.parse(e).id === id);

  if (!entry) {
    return { success: false, error: 'Entry not found' };
  }

  const parsed: DeadLetterEntry = JSON.parse(entry);

  await redis.lrem(DLQ_KEY, 1, entry);

  const processingKey = `${DLQ_PROCESSING}:${id}`;
  await redis.set(processingKey, JSON.stringify({ ...parsed, retryCount: parsed.retryCount + 1 }), 'EX', 3600);

  console.log(`[DLQ] Re-queued entry ${id} for retry (#${parsed.retryCount + 1})`);

  return { success: true };
}

export async function removeDeadLetterEntry(id: string): Promise<{ success: boolean; error?: string }> {
  const entries = await redis.lrange(DLQ_KEY, 0, -1);
  const entry = entries.find(e => JSON.parse(e).id === id);

  if (!entry) {
    return { success: false, error: 'Entry not found' };
  }

  await redis.lrem(DLQ_KEY, 1, entry);

  console.log(`[DLQ] Removed entry ${id} permanently`);

  return { success: true };
}

export async function getDeadLetterStats(): Promise<{
  total: number;
  byType: Record<string, number>;
  oldestEntry?: number;
  newestEntry?: number;
}> {
  const entries = await redis.lrange(DLQ_KEY, 0, -1);
  
  const byType: Record<string, number> = {
    sms: 0,
    campaign: 0,
    automation: 0,
    webhook: 0
  };

  let oldestEntry: number | undefined;
  let newestEntry: number | undefined;

  for (const entry of entries) {
    const parsed = JSON.parse(entry);
    byType[parsed.jobType] = (byType[parsed.jobType] || 0) + 1;
    
    if (!oldestEntry || parsed.failedAt < oldestEntry) {
      oldestEntry = parsed.failedAt;
    }
    if (!newestEntry || parsed.failedAt > newestEntry) {
      newestEntry = parsed.failedAt;
    }
  }

  return {
    total: entries.length,
    byType,
    oldestEntry,
    newestEntry
  };
}

export async function processDeadLetterQueue(): Promise<{
  processed: number;
  failed: number;
}> {
  let processed = 0;
  let failed = 0;

  const entries = await redis.lrange(DLQ_KEY, 0, 9);

  for (const entry of entries) {
    const parsed: DeadLetterEntry = JSON.parse(entry);

    if (parsed.retryCount >= 3) {
      console.log(`[DLQ] Entry ${parsed.id} exceeded max retries, keeping in DLQ`);
      continue;
    }

    try {
      if (parsed.jobType === 'sms') {
        const { sendSmsWithFallback } = await import('../adapters/sms-router.server.js');
        
        if (parsed.merchantId && parsed.phoneNumber && parsed.payload?.message) {
          await sendSmsWithFallback(
            parsed.merchantId,
            parsed.phoneNumber,
            parsed.payload.message,
            parsed.contactId
          );
        }
      }

      await redis.lrem(DLQ_KEY, 1, entry);
      processed++;
      console.log(`[DLQ] Successfully reprocessed entry ${parsed.id}`);
    } catch (error) {
      const newRetryCount = parsed.retryCount + 1;
      const newEntry = { ...parsed, retryCount: newRetryCount, failedAt: Date.now() };
      
      await redis.lrem(DLQ_KEY, 1, entry);
      await redis.lpush(DLQ_KEY, JSON.stringify(newEntry));
      
      failed++;
      console.error(`[DLQ] Failed to reprocess entry ${parsed.id}:`, error);
    }
  }

  return { processed, failed };
}

export async function clearDeadLetterQueue(): Promise<void> {
  await redis.del(DLQ_KEY);
  console.log('[DLQ] Cleared all entries');
}

export { redis };
