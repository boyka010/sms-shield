import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { addSmsJob, SmsJobData } from '../queues/server';
import { sendSmsWithFallback } from '../adapters/sms-router.server';
import { normalizeEgyptianPhone, validateEgyptianPhone } from '../utils/security.server';

const prisma = new PrismaClient();

export function createSmsWorker() {
  return new Worker<SmsJobData>(
    'sms-send-queue',
    async (job: Job<SmsJobData>) => {
      const { jobId, phoneNumber, message, merchantId, campaignId, automationId } = job.data;

      console.log(`Processing SMS job ${jobId} for ${phoneNumber}`);

      if (!validateEgyptianPhone(phoneNumber)) {
        throw new Error('Invalid Egyptian phone number');
      }

      const normalizedPhone = normalizeEgyptianPhone(phoneNumber);

      await prisma.smsJob.update({
        where: { id: jobId },
        data: {
          status: 'PROCESSING',
          processedAt: new Date()
        }
      });

      const result = await sendSmsWithFallback(
        merchantId,
        normalizedPhone,
        message,
        job.data.contactId,
        campaignId,
        automationId
      );

      if (result.success) {
        await prisma.smsJob.update({
          where: { id: jobId },
          data: {
            status: 'COMPLETED',
            deliveredAt: new Date(),
            externalId: result.messageId,
            cost: result.cost
          }
        });

        if (campaignId) {
          await prisma.campaign.update({
            where: { id: campaignId },
            data: {
              sentCount: { increment: 1 },
              deliveredCount: { increment: 1 }
            }
          });
        }

        return result;
      }

      throw new Error(result.error || 'SMS sending failed');
    },
    {
      concurrency: 50,
      limiter: {
        max: 100,
        duration: 60000
      }
    }
  );
}

export async function processWebhook(topic: string, payload: any, shopifyStoreUrl: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { shopifyStoreUrl },
    include: { settings: true }
  });

  if (!merchant) {
    console.error(`Merchant not found for ${shopifyStoreUrl}`);
    return;
  }

  switch (topic) {
    case 'carts/update':
      await handleCartUpdate(merchant.id, payload);
      break;
    case 'orders/create':
      await handleOrderCreate(merchant.id, payload);
      break;
    case 'checkouts/update':
      await handleCheckoutUpdate(merchant.id, payload);
      break;
    default:
      console.log(`Unhandled webhook topic: ${topic}`);
  }
}

async function handleCartUpdate(merchantId: string, payload: any) {
  const cartId = payload.id;
  const customer = payload.customer;
  
  if (!customer || !customer.phone) {
    return;
  }

  const phoneNumber = customer.phone;
  const email = customer.email;

  if (!validateEgyptianPhone(phoneNumber)) {
    return;
  }

  const normalizedPhone = normalizeEgyptianPhone(phoneNumber);
  const phoneHash = hashString(normalizedPhone);
  const emailHash = email ? hashString(email.toLowerCase()) : null;

  const contact = await prisma.contact.upsert({
    where: {
      merchantId_phoneNumber: {
        merchantId,
        phoneNumber: normalizedPhone
      }
    },
    create: {
      merchantId,
      phoneNumber: normalizedPhone,
      phoneNumberHash: phoneHash,
      email: email || undefined,
      emailHash: emailHash || undefined,
      firstName: customer.first_name,
      lastName: customer.last_name,
      smsOptIn: true,
      smsOptInDate: new Date()
    },
    update: {
      firstName: customer.first_name,
      lastName: customer.last_name,
      email: email || undefined,
      emailHash: emailHash || undefined
    }
  });

  const automation = await prisma.automation.findFirst({
    where: {
      merchantId,
      triggerType: 'ABANDONED_CART',
      isActive: true
    }
  });

  if (automation) {
    await scheduleAutomation(automation.id, contact.id, 1, automation.delayMinutes);
  }
}

async function handleOrderCreate(merchantId: string, payload: any) {
  const orderId = payload.id;
  const customer = payload.customer;
  const lineItems = payload.line_items || [];

  if (!customer) {
    return;
  }

  const phoneNumber = customer.phone || customer.default_address?.phone;
  const email = customer.email || customer.default_address?.email;

  if (!phoneNumber || !validateEgyptianPhone(phoneNumber)) {
    return;
  }

  const normalizedPhone = normalizeEgyptianPhone(phoneNumber);
  const phoneHash = hashString(normalizedPhone);
  const emailHash = email ? hashString(email.toLowerCase()) : null;

  const contact = await prisma.contact.upsert({
    where: {
      merchantId_phoneNumber: {
        merchantId,
        phoneNumber: normalizedPhone
      }
    },
    create: {
      merchantId,
      phoneNumber: normalizedPhone,
      phoneNumberHash: phoneHash,
      email: email || undefined,
      emailHash: emailHash || undefined,
      firstName: customer.first_name,
      lastName: customer.last_name,
      smsOptIn: true,
      smsOptInDate: new Date()
    },
    update: {
      firstName: customer.first_name,
      lastName: customer.last_name,
      email: email || undefined,
      emailHash: emailHash || undefined,
      totalOrders: { increment: 1 },
      lastOrderDate: new Date(),
      firstOrderDate: undefined
    }
  });

  const totalPrice = parseFloat(payload.total_price || '0');
  const currency = payload.currency || 'EGP';

  await prisma.order.create({
    data: {
      contactId: contact.id,
      shopifyOrderId: orderId.toString(),
      orderNumber: payload.order_number?.toString() || orderId.toString(),
      totalPrice,
      currency,
      financialStatus: payload.financial_status,
      fulfillmentStatus: payload.fulfillment_status,
      lineItems,
      customerId: customer.id?.toString(),
      checkoutId: payload.checkout_id?.toString(),
      orderDate: new Date(payload.created_at || Date.now())
    }
  });

  const existingContact = await prisma.contact.findUnique({
    where: { id: contact.id }
  });

  if (existingContact && !existingContact.firstOrderDate) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { firstOrderDate: new Date() }
    });
  }

  await prisma.contact.update({
    where: { id: contact.id },
    data: {
      totalSpent: { increment: totalPrice },
      averageOrderValue: (existingContact?.totalSpent || 0 + totalPrice) / ((existingContact?.totalOrders || 0) + 1)
    }
  });

  const winBackAutomation = await prisma.automation.findFirst({
    where: {
      merchantId,
      triggerType: 'WIN_BACK',
      isActive: true
    }
  });

  if (winBackAutomation) {
    await scheduleAutomation(winBackAutomation.id, contact.id, 1, winBackAutomation.delayMinutes);
  }
}

async function handleCheckoutUpdate(merchantId: string, payload: any) {
  if (payload.payment_due && parseFloat(payload.payment_due) > 0) {
    await handleCartUpdate(merchantId, payload);
  }
}

async function scheduleAutomation(
  automationId: string,
  contactId: string,
  touchNumber: number,
  delayMinutes: number
) {
  await prisma.smsJob.create({
    data: {
      automationId,
      contactId,
      phoneNumber: '',
      message: '',
      status: 'PENDING',
      scheduledAt: new Date(Date.now() + delayMinutes * 60 * 1000)
    }
  });
}

function hashString(str: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(str).digest('hex');
}

export function createWebhookWorker() {
  return new Worker<any>(
    'webhook-processing-queue',
    async (job) => {
      const { topic, payload, shopifyStoreUrl } = job.data;
      await processWebhook(topic, payload, shopifyStoreUrl);
    },
    {
      concurrency: 20
    }
  );
}
