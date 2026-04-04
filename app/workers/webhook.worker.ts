import { PrismaClient } from '@prisma/client';
import { prisma, cache } from '../lib/database';
import { processWebhookIdempotently } from '../lib/webhook-idempotency';
import { createAuditLog } from '../lib/audit-log';
import { registerProcessHandlers, createConnectionHandler, shutdownManager } from '../lib/shutdown';

const POLL_INTERVAL = 2000;
const LOCK_TTL = 30000;

async function processPendingWebhooks(): Promise<void> {
  const pendingWebhooks = await prisma.webhookDelivery.findMany({
    where: { status: 'received' },
    orderBy: { createdAt: 'asc' },
    take: 20
  });

  for (const webhook of pendingWebhooks) {
    if (shutdownManager.isShuttingDownState()) {
      break;
    }

    const lockKey = `lock:webhook:${webhook.id}`;
    const lockAcquired = await cache.set(lockKey, process.pid.toString(), 'PX', LOCK_TTL, 'NX');

    if (!lockAcquired) {
      continue;
    }

    const release = createConnectionHandler();

    try {
      const result = await processWebhookIdempotently(
        webhook.topic,
        webhook.payload,
        webhook.shopifyStoreUrl
      );

      if (result.success && !result.isDuplicate) {
        await prisma.webhookDelivery.update({
          where: { id: webhook.id },
          data: { status: 'processed', processingTime: 100 }
        });

        await createAuditLog(
          'system',
          'WEBHOOK_RECEIVE',
          'ORDER',
          { details: { topic: webhook.topic, shop: webhook.shopifyStoreUrl } }
        );
      }

      console.log(`[Webhook] Processed ${webhook.topic} from ${webhook.shopifyStoreUrl}`);
    } catch (error) {
      console.error(`[Webhook] Failed to process webhook ${webhook.id}:`, error);

      await prisma.webhookDelivery.update({
        where: { id: webhook.id },
        data: { status: 'failed' }
      });
    } finally {
      await cache.del(lockKey);
      release();
    }
  }
}

async function main(): Promise<void> {
  console.log('[Webhook Worker] Starting...');
  registerProcessHandlers();

  const pollLoop = async () => {
    if (shutdownManager.isShuttingDownState()) {
      console.log('[Webhook Worker] Shutting down, stopping poll');
      return;
    }

    try {
      await processPendingWebhooks();
    } catch (error) {
      console.error('[Webhook Worker] Poll error:', error);
    }

    const nextPoll = shutdownManager.isShuttingDownState() ? 100 : POLL_INTERVAL;
    setTimeout(pollLoop, nextPoll);
  };

  await pollLoop();
}

main().catch((error) => {
  console.error('[Webhook Worker] Fatal error:', error);
  process.exit(1);
});
