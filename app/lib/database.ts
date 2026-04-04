import { PrismaClient } from '@prisma/client';
import { createClient } from 'ioredis';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const globalForRedis = globalThis as unknown as {
  cache: ReturnType<typeof createClient> | undefined;
};

const CACHE_TTL = 300;

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn']
      : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  client.$connect().then(() => {
    console.log('[Prisma] Connected to database');
  });

  client.$on('beforeExit', async () => {
    console.log('[Prisma] Disconnecting...');
    await client.$disconnect();
  });

  return client;
}

function createRedisCache() {
  const redis = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  redis.on('error', (err) => console.error('[Cache] Redis error:', err));
  redis.on('connect', () => console.log('[Cache] Connected to Redis'));

  return redis;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
export const cache = globalForRedis.cache ?? createRedisCache();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForRedis.cache = cache;
}

async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await cache.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[Cache] Get error:', error);
    return null;
  }
}

async function cacheSet(key: string, value: any, ttl: number = CACHE_TTL): Promise<void> {
  try {
    await cache.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error('[Cache] Set error:', error);
  }
}

async function cacheDel(key: string): Promise<void> {
  try {
    await cache.del(key);
  } catch (error) {
    console.error('[Cache] Del error:', error);
  }
}

async function cacheInvalidatePattern(pattern: string): Promise<void> {
  try {
    const keys = await cache.keys(pattern);
    if (keys.length > 0) {
      await cache.del(...keys);
    }
  } catch (error) {
    console.error('[Cache] Invalidate error:', error);
  }
}

async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_TTL
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  const data = await fetcher();
  await cacheSet(key, data, ttl);
  return data;
}

async function withQueryCache<T>(
  key: string,
  query: () => Promise<T>,
  ttl: number = CACHE_TTL
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  const data = await query();
  await cacheSet(key, data, ttl);
  return data;
}

async function invalidateMerchantCache(merchantId: string): Promise<void> {
  await cacheInvalidatePattern(`*:${merchantId}:*`);
}

async function invalidateContactCache(contactId: string): Promise<void> {
  await cache.del(`contact:${contactId}`);
}

async function healthCheck(): Promise<{ prisma: boolean; redis: boolean }> {
  let prismaOk = false;
  let redisOk = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    prismaOk = true;
  } catch {
    prismaOk = false;
  }

  try {
    await cache.ping();
    redisOk = true;
  } catch {
    redisOk = false;
  }

  return { prisma: prismaOk, redis: redisOk };
}

export {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheInvalidatePattern,
  withCache,
  withQueryCache,
  invalidateMerchantCache,
  invalidateContactCache,
  healthCheck
};

export default prisma;
