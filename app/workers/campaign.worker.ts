import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CampaignJobPayload {
  campaignId: string;
  batchSize?: number;
  segmentFilter?: Record<string, any>;
}

async function processCampaignJob(payload: CampaignJobPayload): Promise<void> {
  console.log(`[Campaign Worker] Processing campaign ${payload.campaignId}`);

  const campaign = await prisma.campaign.findUnique({
    where: { id: payload.campaignId }
  });

  if (!campaign) {
    console.error(`[Campaign Worker] Campaign ${payload.campaignId} not found`);
    return;
  }

  if (campaign.status !== 'RUNNING') {
    console.log(`[Campaign Worker] Campaign ${payload.campaignId} is not running`);
    return;
  }

  const batchSize = payload.batchSize || 100;

  const whereClause: any = {
    merchantId: campaign.merchantId,
    smsOptIn: true
  };

  const segmentFilter = payload.segmentFilter || (campaign.segmentFilter as any);
  
  if (segmentFilter?.segment) {
    whereClause.segment = segmentFilter.segment;
  }

  if (segmentFilter?.minOrders) {
    whereClause.totalOrders = { gte: segmentFilter.minOrders };
  }

  if (segmentFilter?.minSpent) {
    whereClause.totalSpent = { gte: segmentFilter.minSpent };
  }

  const contacts = await prisma.contact.findMany({
    where: whereClause,
    take: batchSize,
    skip: campaign.sentCount
  });

  if (contacts.length === 0) {
    await prisma.campaign.update({
      where: { id: payload.campaignId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });
    console.log(`[Campaign Worker] Campaign ${payload.campaignId} completed`);
    return;
  }

  const variables = {
    firstName: '{{firstName}}',
    lastName: '{{lastName}}',
    phoneNumber: '{{phoneNumber}}',
    totalOrders: '{{totalOrders}}',
    totalSpent: '{{totalSpent}}'
  };

  for (const contact of contacts) {
    const message = interpolateTemplate(campaign.messageTemplate, {
      firstName: contact.firstName || 'Customer',
      lastName: contact.lastName || '',
      phoneNumber: contact.phoneNumber,
      totalOrders: contact.totalOrders.toString(),
      totalSpent: contact.totalSpent.toFixed(2)
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
    where: { id: payload.campaignId },
    data: {
      sentCount: { increment: contacts.length },
      totalRecipients: campaign.totalRecipients + contacts.length
    }
  });

  console.log(`[Campaign Worker] Enqueued ${contacts.length} SMS jobs for campaign ${payload.campaignId}`);
}

function interpolateTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

async function processAutomationJob(
  automationId: string,
  contactId: string,
  touchNumber: number
): Promise<void> {
  console.log(`[Automation Worker] Processing automation ${automationId} for contact ${contactId}`);

  const automation = await prisma.automation.findUnique({
    where: { id: automationId }
  });

  if (!automation || !automation.isActive) {
    console.log(`[Automation Worker] Automation ${automationId} is inactive or not found`);
    return;
  }

  const contact = await prisma.contact.findUnique({
    where: { id: contactId }
  });

  if (!contact || !contact.smsOptIn) {
    console.log(`[Automation Worker] Contact ${contactId} not found or opted out`);
    return;
  }

  const message = interpolateTemplate(automation.messageTemplate, {
    firstName: contact.firstName || 'Customer',
    lastName: contact.lastName || '',
    phoneNumber: contact.phoneNumber,
    totalOrders: contact.totalOrders.toString(),
    totalSpent: contact.totalSpent.toFixed(2)
  });

  await prisma.smsJob.create({
    data: {
      automationId,
      contactId,
      phoneNumber: contact.phoneNumber,
      message,
      status: 'PENDING'
    }
  });

  console.log(`[Automation Worker] Created SMS job for automation ${automationId}`);
}

async function processScheduledAutomations(): Promise<void> {
  console.log('[Automation Worker] Processing scheduled automations...');

  const now = new Date();
  
  const pendingJobs = await prisma.smsJob.findMany({
    where: {
      status: 'PENDING',
      automationId: { not: null },
      scheduledAt: { lte: now }
    },
    take: 50
  });

  console.log(`[Automation Worker] Found ${pendingJobs.length} pending automation jobs`);

  for (const job of pendingJobs) {
    if (job.automationId && job.contactId) {
      await processAutomationJob(job.automationId, job.contactId, 1);
      
      await prisma.smsJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          processedAt: new Date()
        }
      });
    }
  }
}

async function startCampaignWorker(): Promise<void> {
  console.log('[Campaign Worker] Starting worker...');

  while (true) {
    try {
      const pendingCampaign = await prisma.campaign.findFirst({
        where: { status: 'RUNNING' },
        orderBy: { startedAt: 'asc' },
        take: 1
      });

      if (pendingCampaign) {
        await processCampaignJob({
          campaignId: pendingCampaign.id,
          batchSize: 100
        });
      }

      await processScheduledAutomations();

      await new Promise(resolve => setTimeout(resolve, 30000));
    } catch (error) {
      console.error('[Campaign Worker] Error:', error);
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  }
}

if (require.main === module) {
  startCampaignWorker().catch(console.error);
}

export { 
  processCampaignJob, 
  processAutomationJob, 
  processScheduledAutomations,
  startCampaignWorker 
};
