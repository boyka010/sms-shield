import { PrismaClient } from '@prisma/client';
import { startSmsWorker } from './sms.worker.js';
import { startWebhookWorker, startRfmWorker } from './webhook.worker.js';
import { startCampaignWorker } from './campaign.worker.js';
import { startCronScheduler } from './cron.js';
import { performHealthCheck } from './utils/health.server.js';
import { json } from '@remix-run/node';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(50));
  console.log('SMS Shield - Starting Workers');
  console.log('='.repeat(50));

  const workers = [
    { name: 'SMS Worker', start: startSmsWorker },
    { name: 'Webhook Worker', start: startWebhookWorker },
    { name: 'RFM Worker', start: startRfmWorker },
    { name: 'Campaign Worker', start: startCampaignWorker },
    { name: 'Cron Scheduler', start: startCronScheduler }
  ];

  for (const worker of workers) {
    worker.start()
      .then(() => console.log(`[Main] ${worker.name} started`))
      .catch(err => console.error(`[Main] ${worker.name} failed:`, err));
  }

  console.log('[Main] All workers started');
  console.log('[Main] Press Ctrl+C to stop');
}

if (require.main === module) {
  main().catch(console.error);
}

export { performHealthCheck };
