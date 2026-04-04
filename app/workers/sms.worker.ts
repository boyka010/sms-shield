import { PrismaClient } from '@prisma/client';
import { prisma, cache } from '../lib/database';
import { getAvailableGateway, recordGatewaySuccess, recordGatewayFailure } from '../lib/circuit-breaker';
import { addToDeadLetterQueue } from '../lib/dead-letter-queue';
import { registerProcessHandlers, createConnectionHandler, shutdownManager } from '../lib/shutdown';
import { sendSmsWithFallback } from '../adapters/sms-router.server';

const POLL_INTERVAL = 1000;
const LOCK_TTL = 30000;

interface SmsJobData {
  jobId: string;
  contactId: string;
  phoneNumber: string;
  message: string;
  merchantId: string;
  campaignId?: string;
  automationId?: string;
}

async function processSmsJob(data: SmsJobData): Promise<void> {
  const release = createConnectionHandler();
  
  try {
    await prisma.smsJob.update({
      where: { id: data.jobId },
      data: { status: 'PROCESSING', processedAt: new Date() }
    });

    const gateway = await getAvailableGateway();
    if (!gateway) {
      throw new Error('No SMS gateways available');
    }

    const result = await sendSmsWithFallback(
      data.merchantId,
      data.phoneNumber,
      data.message,
      data.contactId,
      data.campaignId,
      data.automationId
    );

    if (result.success) {
      await recordGatewaySuccess(gateway);
      
      await prisma.smsJob.update({
        where: { id: data.jobId },
        data: {
          status: 'COMPLETED',
          deliveredAt: new Date(),
          externalId: result.messageId,
          cost: result.cost
        }
      });

      if (data.campaignId) {
        await prisma.campaign.update({
          where: { id: data.campaignId },
          data: { sentCount: { increment: 1 }, deliveredCount: { increment: 1 } }
        });
      }

      console.log(`[SMS] Job ${data.jobId} completed via ${gateway}`);
    } else {
      await recordGatewayFailure(gateway, new Error(result.error));
      throw new Error(result.error || 'SMS sending failed');
    }
  } catch (error) {
    console.error(`[SMS] Job ${data.jobId} failed:`, error);
    
    const job = await prisma.smsJob.findUnique({ where: { id: data.jobId } });
    const retryCount = (job?.retryCount || 0) + 1;
    const maxRetries = job?.maxRetries || 3;

    if (retryCount <= maxRetries) {
      await prisma.smsJob.update({
        where: { id: data.jobId },
        data: { status: 'RETRY', retryCount, errorMessage: error instanceof Error ? error.message : 'Unknown error' }
      });
    } else {
      await prisma.smsJob.update({
        where: { id: data.jobId },
        data: { status: 'FAILED', failedAt: new Date(), errorMessage: error instanceof Error ? error.message : 'Unknown error' }
      });

      await addToDeadLetterQueue(
        'sms',
        data.jobId,
        data,
        error instanceof Error ? error : 'Unknown error',
        'sms-send-queue',
        { merchantId: data.merchantId, contactId: data.contactId, phoneNumber: data.phoneNumber }
      );

      if (data.campaignId) {
        await prisma.campaign.update({
          where: { id: data.campaignId },
          data: { failedCount: { increment: 1 } }
        });
      }
    }

    throw error;
  } finally {
    release();
  }
}

async function pollJobs(): Promise<void> {
  const lockKey = 'lock:sms-worker';
  const lockAcquired = await cache.set(lockKey, process.pid.toString(), 'PX', LOCK_TTL, 'NX');

  if (!lockAcquired) {
    return;
  }

  try {
    const pendingJobs = await prisma.smsJob.findMany({
      where: {
        status: { in: ['PENDING', 'RETRY'] },
        scheduledAt: { lte: new Date() }
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10
    });

    for (const job of pendingJobs) {
      if (shutdownManager.isShuttingDownState()) {
        break;
      }

      const contact = await prisma.contact.findUnique({
        where: { id: job.contactId }
      });

      if (!contact) {
        console.warn(`[SMS] Contact ${job.contactId} not found for job ${job.id}`);
        continue;
      }

      const data: SmsJobData = {
        jobId: job.id,
        contactId: job.contactId,
        phoneNumber: job.phoneNumber || contact.phoneNumber,
        message: job.message,
        merchantId: contact.merchantId,
        campaignId: job.campaignId || undefined,
        automationId: job.automationId || undefined
      };

      await processSmsJob(data);
    }
  } finally {
    await cache.del(lockKey);
  }
}

async function main(): Promise<void> {
  console.log('[SMS Worker] Starting...');
  registerProcessHandlers();

  let lastPoll = Date.now();

  const pollLoop = async () => {
    if (shutdownManager.isShuttingDownState()) {
      console.log('[SMS Worker] Shutting down, stopping poll');
      return;
    }

    try {
      await pollJobs();
      lastPoll = Date.now();
    } catch (error) {
      console.error('[SMS Worker] Poll error:', error);
    }

    const nextPoll = shutdownManager.isShuttingDownState() ? 100 : POLL_INTERVAL;
    setTimeout(pollLoop, nextPoll);
  };

  await pollLoop();
}

main().catch((error) => {
  console.error('[SMS Worker] Fatal error:', error);
  process.exit(1);
});
