import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CronJob {
  name: string;
  cronExpression: string;
  handler: () => Promise<void>;
}

async function runDailyRfmJob(): Promise<void> {
  console.log('[Cron] Running daily RFM calculation...');

  const merchants = await prisma.merchant.findMany({
    select: { id: true }
  });

  console.log(`[Cron] Processing ${merchants.length} merchants`);

  for (const merchant of merchants) {
    try {
      await calculateRfmForMerchant(merchant.id);
      console.log(`[Cron] RFM calculated for merchant ${merchant.id}`);
    } catch (error) {
      console.error(`[Cron] RFM failed for merchant ${merchant.id}:`, error);
    }
  }

  console.log('[Cron] Daily RFM calculation complete');
}

async function calculateRfmForMerchant(merchantId: string): Promise<void> {
  const contacts = await prisma.contact.findMany({
    where: { merchantId },
    include: {
      orders: {
        orderBy: { orderDate: 'desc' }
      }
    }
  });

  const threshold = {
    recency: { recent: 30, medium: 90 },
    frequency: { high: 5, medium: 2 },
    monetary: { high: 5000, medium: 2000 }
  };

  for (const contact of contacts) {
    if (contact.orders.length === 0) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { segment: 'NEW' }
      });
      continue;
    }

    const lastOrderDate = contact.orders[0].orderDate;
    const daysSinceLastOrder = Math.ceil(
      (Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const recencyScore = calculateRecencyScore(daysSinceLastOrder, threshold);
    const frequencyScore = calculateFrequencyScore(contact.totalOrders, threshold);
    const monetaryScore = calculateMonetaryScore(contact.totalSpent, threshold);
    const totalScore = recencyScore + frequencyScore + monetaryScore;

    const segment = determineSegment(recencyScore, frequencyScore, monetaryScore);

    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        rfmRecencyScore: recencyScore,
        rfmFrequencyScore: frequencyScore,
        rfmMonetaryScore: monetaryScore,
        rfmTotalScore: totalScore,
        segment
      }
    });
  }

  await updateRfmCache(merchantId);
}

function calculateRecencyScore(days: number, t: any): number {
  if (days <= t.recency.recent) return 5;
  if (days <= t.recency.medium) return 4;
  if (days <= 180) return 3;
  if (days <= 365) return 2;
  return 1;
}

function calculateFrequencyScore(orders: number, t: any): number {
  if (orders >= t.frequency.high) return 5;
  if (orders >= t.frequency.medium) return 4;
  if (orders >= 2) return 3;
  if (orders === 1) return 2;
  return 1;
}

function calculateMonetaryScore(spent: number, t: any): number {
  if (spent >= t.monetary.high) return 5;
  if (spent >= t.monetary.medium) return 4;
  if (spent >= 1000) return 3;
  if (spent >= 500) return 2;
  return 1;
}

function determineSegment(recency: number, frequency: number, monetary: number): string {
  if (recency >= 4 && frequency >= 4 && monetary >= 4) return 'CHAMPIONS';
  if (recency >= 3 && frequency >= 3) return 'LOYAL';
  if (recency <= 2 && frequency >= 3) return 'AT_RISK';
  if (monetary <= 2 && frequency >= 3) return 'PRICE_SENSITIVE';
  if (recency <= 2 && frequency <= 2) return 'DORMANT';
  return 'NEW';
}

async function updateRfmCache(merchantId: string): Promise<void> {
  const segments = await prisma.contact.groupBy({
    by: ['segment'],
    where: { merchantId },
    _count: true,
    _sum: { totalSpent: true }
  });

  for (const seg of segments) {
    const avgOrderValue = seg._count > 0 
      ? (seg._sum.totalSpent || 0) / seg._count 
      : 0;

    await prisma.cachedRfmCalculation.upsert({
      where: {
        merchantId_segment: {
          merchantId,
          segment: seg.segment as any
        }
      },
      create: {
        merchantId,
        segment: seg.segment as any,
        contactCount: seg._count,
        totalRevenue: seg._sum.totalSpent || 0,
        avgOrderValue
      },
      update: {
        contactCount: seg._count,
        totalRevenue: seg._sum.totalSpent || 0,
        avgOrderValue,
        calculatedAt: new Date()
      }
    });
  }
}

async function runStaleJobCleanup(): Promise<void> {
  console.log('[Cron] Running stale job cleanup...');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  await prisma.smsJob.deleteMany({
    where: {
      status: 'COMPLETED',
      createdAt: { lt: thirtyDaysAgo }
    }
  });

  await prisma.webhookDelivery.deleteMany({
    where: {
      createdAt: { lt: thirtyDaysAgo }
    }
  });

  console.log('[Cron] Stale job cleanup complete');
}

async function runInactiveContactCheck(): Promise<void> {
  console.log('[Cron] Checking for inactive contacts...');

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const contacts = await prisma.contact.findMany({
    where: {
      lastOrderDate: { lt: ninetyDaysAgo },
      segment: { not: 'DORMANT' }
    }
  });

  console.log(`[Cron] Found ${contacts.length} inactive contacts`);

  for (const contact of contacts) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { segment: 'DORMANT' }
    });
  }

  console.log('[Cron] Inactive contact check complete');
}

async function runCampaignScheduler(): Promise<void> {
  console.log('[Cron] Running campaign scheduler...');

  const now = new Date();

  const scheduledCampaigns = await prisma.campaign.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: now }
    }
  });

  for (const campaign of scheduledCampaigns) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'RUNNING',
        startedAt: new Date()
      }
    });

    await enqueueCampaignJobs(campaign.id);
  }

  console.log(`[Cron] Started ${scheduledCampaigns.length} scheduled campaigns`);
}

async function enqueueCampaignJobs(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId }
  });

  if (!campaign) return;

  const segmentFilter = campaign.segmentFilter as any;
  
  const whereClause: any = {
    merchantId: campaign.merchantId,
    smsOptIn: true
  };

  if (segmentFilter?.segment) {
    whereClause.segment = segmentFilter.segment;
  }

  const contacts = await prisma.contact.findMany({
    where: whereClause,
    take: 100
  });

  for (const contact of contacts) {
    const message = interpolateTemplate(campaign.messageTemplate, {
      firstName: contact.firstName || 'Customer',
      lastName: contact.lastName || '',
      phoneNumber: contact.phoneNumber
    });

    await prisma.smsJob.create({
      data: {
        campaignId: campaign.id,
        contactId: contact.id,
        phoneNumber: contact.phoneNumber,
        message,
        status: 'PENDING'
      }
    });
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      sentCount: contacts.length,
      totalRecipients: contacts.length
    }
  });
}

function interpolateTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

const CRON_JOBS: CronJob[] = [
  {
    name: 'daily-rfm',
    cronExpression: '0 2 * * *',
    handler: runDailyRfmJob
  },
  {
    name: 'stale-cleanup',
    cronExpression: '0 3 * * *',
    handler: runStaleJobCleanup
  },
  {
    name: 'inactive-check',
    cronExpression: '0 4 * * *',
    handler: runInactiveContactCheck
  },
  {
    name: 'campaign-scheduler',
    cronExpression: '*/15 * * * *',
    handler: runCampaignScheduler
  }
];

function parseCronExpression(expression: string): number {
  const parts = expression.split(' ');
  const [, , , dayOfMonth, month, dayOfWeek] = parts;
  
  return 60000;
}

async function startCronScheduler(): Promise<void> {
  console.log('[Cron] Starting scheduler...');
  console.log('[Cron] Registered jobs:', CRON_JOBS.map(j => j.name).join(', '));

  const checkInterval = 60000;

  while (true) {
    const now = new Date();
    const minute = now.getMinutes();

    if (minute === 0) {
      for (const job of CRON_JOBS) {
        try {
          await job.handler();
        } catch (error) {
          console.error(`[Cron] Job ${job.name} failed:`, error);
        }
      }
    }

    if (minute % 15 === 0) {
      try {
        await runCampaignScheduler();
      } catch (error) {
        console.error('[Cron] Campaign scheduler failed:', error);
      }
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
}

if (require.main === module) {
  console.log('[Cron] Starting cron jobs...');
  startCronScheduler().catch(console.error);
}

export { 
  runDailyRfmJob, 
  runStaleJobCleanup, 
  runInactiveContactCheck, 
  runCampaignScheduler,
  startCronScheduler 
};
