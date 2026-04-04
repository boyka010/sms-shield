import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { RfmCalculator, runDailyRfmCalculation } from '../services/rfm.server';

const prisma = new PrismaClient();

export function createRfmWorker() {
  return new Worker<{ merchantId: string; contactId?: string; recalculateAll?: boolean }>(
    'rfm-calculation-queue',
    async (job: Job<{ merchantId: string; contactId?: string; recalculateAll?: boolean }>) => {
      const { merchantId, contactId, recalculateAll } = job.data;

      console.log(`Processing RFM calculation for merchant ${merchantId}`);

      if (contactId) {
        const calculator = new RfmCalculator(merchantId);
        await calculator.calculateRfmForContact(contactId);
        return;
      }

      if (recalculateAll) {
        await runDailyRfmCalculation(merchantId);
        return;
      }

      throw new Error('Invalid RFM job parameters');
    },
    {
      concurrency: 2,
      limiter: {
        max: 10,
        duration: 3600000
      }
    }
  );
}

export function createAutomationWorker() {
  return new Worker<{ automationId: string; contactId: string; touchNumber: number }>(
    'automation-trigger-queue',
    async (job: Job<{ automationId: string; contactId: string; touchNumber: number }>) => {
      const { automationId, contactId, touchNumber } = job.data;

      const automation = await prisma.automation.findUnique({
        where: { id: automationId }
      });

      if (!automation || !automation.isActive) {
        return;
      }

      const contact = await prisma.contact.findUnique({
        where: { id: contactId }
      });

      if (!contact || !contact.smsOptIn) {
        return;
      }

      const variables = {
        firstName: contact.firstName || 'Customer',
        lastName: contact.lastName || '',
        phoneNumber: contact.phoneNumber
      };

      const message = this.interpolateTemplate(automation.messageTemplate, variables);

      await prisma.smsJob.create({
        data: {
          automationId,
          contactId,
          phoneNumber: contact.phoneNumber,
          message,
          status: 'PENDING',
          scheduledAt: new Date()
        }
      });
    },
    {
      concurrency: 10
    }
  );
}

export function createCampaignWorker() {
  return new Worker<{ campaignId: string; batchSize?: number; segmentFilter?: any }>(
    'campaign-send-queue',
    async (job: Job<{ campaignId: string; batchSize?: number; segmentFilter?: any }>) => {
      const { campaignId, batchSize = 100, segmentFilter } = job.data;

      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId }
      });

      if (!campaign || campaign.status !== 'RUNNING') {
        return;
      }

      const whereClause: any = {
        merchantId: campaign.merchantId,
        smsOptIn: true
      };

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
          where: { id: campaignId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date()
          }
        });
        return;
      }

      for (const contact of contacts) {
        const variables = {
          firstName: contact.firstName || 'Customer',
          lastName: contact.lastName || '',
          phoneNumber: contact.phoneNumber,
          totalOrders: contact.totalOrders.toString(),
          totalSpent: contact.totalSpent.toFixed(2)
        };

        const message = this.interpolateTemplate(campaign.messageTemplate, variables);

        await prisma.smsJob.create({
          data: {
            campaignId,
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
          sentCount: { increment: contacts.length },
          totalRecipients: contacts.length
        }
      });
    },
    {
      concurrency: 5
    }
  );
}

export function createCodConfirmationWorker() {
  return new Worker<{ orderId: string; contactId: string; confirmationToken: string }>(
    'cod-confirmation-queue',
    async (job: Job<{ orderId: string; contactId: string; confirmationToken: string }>) => {
      const { orderId, contactId, confirmationToken } = job.data;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { contact: true }
      });

      if (!order || order.financial_status !== 'pending') {
        return;
      }

      const merchant = await prisma.merchant.findUnique({
        where: { id: order.contact.merchantId }
      });

      if (!merchant) {
        return;
      }

      const confirmationUrl = `https://${merchant.shopifyStoreUrl}/a/sms-shield/confirm-cod?token=${confirmationToken}&order=${order.orderNumber}`;

      const message = `Dear ${order.contact.firstName || 'Customer'}, confirm your COD order #${order.orderNumber}. Click: ${confirmationUrl}. Reply YES to confirm.`;

      await prisma.smsJob.create({
        data: {
          contactId: order.contactId,
          phoneNumber: order.contact.phoneNumber,
          message,
          status: 'PENDING'
        }
      });
    },
    {
      concurrency: 10
    }
  );
}

function interpolateTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  
  return result;
}
