import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';

const prisma = new PrismaClient();

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    smsGateways: ServiceStatus[];
    jobs: JobStatus;
  };
}

interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
}

interface JobStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    
    return {
      status: latency < 100 ? 'up' : 'degraded',
      latency,
      message: latency < 100 ? 'Database responding normally' : 'Database responding slowly'
    };
  } catch (error) {
    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Database connection failed'
    };
  }
}

async function checkRedis(): Promise<ServiceStatus> {
  const start = Date.now();
  const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    connectTimeout: 5000,
    maxRetriesPerRequest: 1
  });
  
  try {
    await redis.ping();
    const latency = Date.now() - start;
    await redis.quit();
    
    return {
      status: latency < 100 ? 'up' : 'degraded',
      latency,
      message: latency < 100 ? 'Redis responding normally' : 'Redis responding slowly'
    };
  } catch (error) {
    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Redis connection failed'
    };
  }
}

async function checkSmsGateways(): Promise<ServiceStatus[]> {
  const gateways: ServiceStatus[] = [];
  
  const merchants = await prisma.merchant.findMany({
    take: 5,
    include: {
      apiKeys: { take: 3 }
    }
  });

  for (const merchant of merchants) {
    if (merchant.apiKeys.length === 0) continue;

    try {
      const { SmsRouter } = await import('../adapters/sms-router.server.js');
      const router = await SmsRouter.create(merchant.id);
      const health = await router.checkGatewaysHealth();
      
      for (const [provider, isHealthy] of health) {
        gateways.push({
          status: isHealthy ? 'up' : 'degraded',
          message: `${provider}: ${isHealthy ? 'Available' : 'No credits or error'}`
        });
      }
    } catch (error) {
      gateways.push({
        status: 'down',
        message: `Failed to check gateways: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  return gateways;
}

async function checkJobs(): Promise<JobStatus> {
  const [pending, processing, completed, failed] = await Promise.all([
    prisma.smsJob.count({ where: { status: 'PENDING' } }),
    prisma.smsJob.count({ where: { status: 'PROCESSING' } }),
    prisma.smsJob.count({ where: { status: 'COMPLETED', updatedAt: { gte: new Date(Date.now() - 3600000) } } }),
    prisma.smsJob.count({ where: { status: 'FAILED', updatedAt: { gte: new Date(Date.now() - 3600000) } } })
  ]);

  return { pending, processing, completed, failed };
}

export async function performHealthCheck(): Promise<HealthCheckResult> {
  const [database, redis, smsGateways, jobs] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkSmsGateways(),
    checkJobs()
  ]);

  const allServicesUp = database.status !== 'down' && redis.status !== 'down';
  const anyGatewayUp = smsGateways.some(g => g.status === 'up');
  
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (allServicesUp && anyGatewayUp) {
    overallStatus = 'healthy';
  } else if (database.status === 'up' && redis.status === 'up') {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'unhealthy';
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: {
      database,
      redis,
      smsGateways,
      jobs
    }
  };
}

export async function getMetrics() {
  const [
    totalContacts,
    totalOrders,
    totalCampaigns,
    activeCampaigns,
    totalSmsSent,
    recentDeliveries,
    segmentCounts,
    topContacts
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.order.count(),
    prisma.campaign.count(),
    prisma.campaign.count({ where: { status: 'RUNNING' } }),
    prisma.smsJob.count({ where: { status: 'COMPLETED' } }),
    prisma.smsLog.count({ where: { createdAt: { gte: new Date(Date.now() - 86400000) } } }),
    prisma.contact.groupBy({
      by: ['segment'],
      _count: true
    }),
    prisma.contact.findMany({
      orderBy: { totalSpent: 'desc' },
      take: 10,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        totalSpent: true,
        totalOrders: true,
        segment: true
      }
    })
  ]);

  const deliveryRate = recentDeliveries > 0 
    ? ((await prisma.smsLog.count({ 
        where: { 
          status: 'delivered',
          createdAt: { gte: new Date(Date.now() - 86400000) } 
        } 
      })) / recentDeliveries) * 100 
    : 0;

  return {
    totalContacts,
    totalOrders,
    totalCampaigns,
    activeCampaigns,
    totalSmsSent,
    recentDeliveries,
    deliveryRate: deliveryRate.toFixed(1),
    segments: Object.fromEntries(segmentCounts.map(s => [s.segment, s._count])),
    topContacts
  };
}

export async function getMerchantStats(merchantId: string) {
  const [
    totalContacts,
    activeContacts,
    totalOrders,
    totalRevenue,
    campaigns,
    automations,
    recentSms
  ] = await Promise.all([
    prisma.contact.count({ where: { merchantId } }),
    prisma.contact.count({ 
      where: { 
        merchantId,
        lastOrderDate: { gte: new Date(Date.now() - 30 * 86400000) }
      } 
    }),
    prisma.order.count({ where: { contact: { merchantId } } }),
    prisma.order.aggregate({
      where: { contact: { merchantId } },
      _sum: { totalPrice: true }
    }),
    prisma.campaign.findMany({
      where: { merchantId },
      take: 10,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.automation.findMany({
      where: { merchantId }
    }),
    prisma.smsJob.count({
      where: {
        contact: { merchantId },
        status: 'COMPLETED'
      }
    })
  ]);

  return {
    totalContacts,
    activeContacts,
    totalOrders,
    totalRevenue: totalRevenue._sum.totalPrice || 0,
    campaigns,
    automations,
    totalSmsSent: recentSms
  };
}
