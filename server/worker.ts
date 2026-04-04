import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('SMS Shield Worker Manager');
  console.log('=========================\n');

  const args = process.argv.slice(2);
  const worker = args[0];

  switch (worker) {
    case 'sms':
      const { startSmsWorker } = await import('./workers/sms.worker.js');
      await startSmsWorker();
      break;

    case 'webhook':
      const { startWebhookWorker } = await import('./workers/webhook.worker.js');
      await startWebhookWorker();
      break;

    case 'rfm':
      const { startRfmWorker } = await import('./workers/webhook.worker.js');
      await startRfmWorker();
      break;

    case 'campaign':
      const { startCampaignWorker } = await import('./workers/campaign.worker.js');
      await startCampaignWorker();
      break;

    case 'cron':
      const { startCronScheduler } = await import('./workers/cron.js');
      await startCronScheduler();
      break;

    case 'all':
      console.log('Starting all workers...');
      const { startSmsWorker: sms } = await import('./workers/sms.worker.js');
      const { startWebhookWorker: wh } = await import('./workers/webhook.worker.js');
      const { startCampaignWorker: camp } = await import('./workers/campaign.worker.js');
      const { startCronScheduler: cron } = await import('./workers/cron.js');
      
      Promise.all([
        sms().catch(console.error),
        wh().catch(console.error),
        camp().catch(console.error),
        cron().catch(console.error)
      ]);
      break;

    default:
      console.log('Usage: npm run worker <sms|webhook|rfm|campaign|cron|all>');
      process.exit(1);
  }
}

main().catch(console.error);
