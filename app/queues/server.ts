import { Queue, Worker, QueueEvents, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  connectionName: 'sms-shield-main'
});

export const QUEUE_NAMES = {
  SMS_SEND: 'sms-send-queue',
  SMS_BATCH: 'sms-batch-queue',
  RFM_CALCULATION: 'rfm-calculation-queue',
  WEBHOOK_PROCESSING: 'webhook-processing-queue',
  AUTOMATION_TRIGGER: 'automation-trigger-queue',
  CAMPAIGN_SEND: 'campaign-send-queue',
  COD_CONFIRMATION: 'cod-confirmation-queue'
} as const;

export interface SmsJobData {
  jobId: string;
  contactId: string;
  phoneNumber: string;
  message: string;
  merchantId: string;
  campaignId?: string;
  automationId?: string;
  gateway?: string;
}

export interface RfmJobData {
  merchantId: string;
  contactId?: string;
  recalculateAll?: boolean;
}

export interface WebhookJobData {
  topic: string;
  payload: any;
  shopifyStoreUrl: string;
  webhookId?: string;
}

export interface AutomationJobData {
  automationId: string;
  contactId: string;
  triggerType: string;
  touchNumber: number;
}

export interface CampaignJobData {
  campaignId: string;
  batchSize?: number;
  segmentFilter?: any;
}

export interface CodConfirmationJobData {
  orderId: string;
  contactId: string;
  confirmationToken: string;
}

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  },
  removeOnComplete: {
    count: 1000,
    age: 24 * 3600
  },
  removeOnFail: {
    count: 5000,
    age: 7 * 24 * 3600
  }
};

export const smsQueue = new Queue<SmsJobData>(QUEUE_NAMES.SMS_SEND, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    priority: 1
  }
});

export const smsBatchQueue = new Queue<SmsJobData>(QUEUE_NAMES.SMS_BATCH, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    concurrency: 10
  }
});

export const rfmQueue = new Queue<RfmJobData>(QUEUE_NAMES.RFM_CALCULATION, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    priority: 10,
    concurrency: 2
  }
});

export const webhookQueue = new Queue<WebhookJobData>(QUEUE_NAMES.WEBHOOK_PROCESSING, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    priority: 1,
    concurrency: 20
  }
});

export const automationQueue = new Queue<AutomationJobData>(QUEUE_NAMES.AUTOMATION_TRIGGER, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    priority: 2
  }
});

export const campaignQueue = new Queue<CampaignJobData>(QUEUE_NAMES.CAMPAIGN_SEND, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    priority: 3,
    concurrency: 5
  }
});

export const codConfirmationQueue = new Queue<CodConfirmationJobData>(QUEUE_NAMES.COD_CONFIRMATION, {
  connection
});

export const queueEvents = new QueueEvents(QUEUE_NAMES.SMS_SEND, { connection });
export const rfmQueueEvents = new QueueEvents(QUEUE_NAMES.RFM_CALCULATION, { connection });
export const webhookQueueEvents = new QueueEvents(QUEUE_NAMES.WEBHOOK_PROCESSING, { connection });

export async function addSmsJob(data: SmsJobData, delay?: number): Promise<void> {
  const jobOptions: JobsOptions = {
    ...defaultJobOptions
  };
  
  if (delay) {
    jobOptions.delay = delay;
  }
  
  await smsQueue.add('send-sms', data, jobOptions);
}

export async function addSmsBatch(
  jobs: SmsJobData[],
  concurrency: number = 50
): Promise<void> {
  await smsBatchQueue.add('send-sms-batch', jobs, {
    ...defaultJobOptions,
    concurrency
  });
}

export async function addRfmCalculation(
  data: RfmJobData,
  priority: number = 10
): Promise<void> {
  await rfmQueue.add('calculate-rfm', data, {
    ...defaultJobOptions,
    priority
  });
}

export async function addWebhookJob(data: WebhookJobData): Promise<void> {
  await webhookQueue.add('process-webhook', data, {
    ...defaultJobOptions,
    priority: 1
  });
}

export async function addAutomationJob(
  data: AutomationJobData,
  delay: number = 0
): Promise<void> {
  await automationQueue.add('trigger-automation', data, {
    ...defaultJobOptions,
    delay
  });
}

export async function addCampaignJob(
  data: CampaignJobData
): Promise<void> {
  await campaignQueue.add('run-campaign', data, defaultJobOptions);
}

export async function scheduleCodConfirmation(
  data: CodConfirmationJobData,
  delayMinutes: number = 30
): Promise<void> {
  await codConfirmationQueue.add('send-cod-link', data, {
    delay: delayMinutes * 60 * 1000,
    attempts: 5
  });
}

export async function getQueueStats(queueName: string) {
  const queue = new Queue(queueName, { connection });
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount()
  ]);
  
  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + delayed
  };
}

export async function clearQueue(queueName: string): Promise<void> {
  const queue = new Queue(queueName, { connection });
  await queue.obliterate({ force: true });
}

export { connection, Queue, Worker, QueueEvents };
