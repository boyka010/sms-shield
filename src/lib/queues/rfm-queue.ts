// ─────────────────────────────────────────────────────────────────────────────
// SMS-Shield — RFM (Recency, Frequency, Monetary) Calculation Queue
// ─────────────────────────────────────────────────────────────────────────────

import type { QueueJob, QueueName, QueueProcessor } from './index';
import { getQueue } from './index';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RFMCalculationJobData {
  shopId: string;
  calculationDate: string; // ISO date string
}

interface SubscriberOrderData {
  id: string;
  shopId: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: Date | null;
  createdAt: Date;
}

interface RFMScore {
  subscriberId: string;
  recencyScore: number;    // 1-5
  frequencyScore: number;  // 1-5
  monetaryScore: number;   // 1-5
  rfmTotal: number;        // 3-15
  segment: RFMSegment;
}

// ── RFM Segment Definitions ──────────────────────────────────────────────────

export type RFMSegment =
  | 'Champions'
  | 'Loyal'
  | 'Potential Loyalist'
  | 'New Customer'
  | 'Promising'
  | 'Need Attention'
  | 'At Risk'
  | "Can't Lose"
  | 'Hibernating'
  | 'Lost'
  | 'Price Sensitive'
  | 'Recent Customers'
  | 'Average Customers';

interface SegmentRule {
  name: RFMSegment;
  // Priority order: lower priority = checked first
  priority: number;
  matches: (r: number, f: number, m: number) => boolean;
}

// Rules are ordered by specificity (most specific first)
const SEGMENT_RULES: SegmentRule[] = [
  {
    name: 'Champions',
    priority: 0,
    matches: (r, f, m) => r >= 4 && f >= 4 && m >= 4,
  },
  {
    name: "Can't Lose",
    priority: 1,
    matches: (r, f, m) => r <= 2 && f >= 4 && m >= 4,
  },
  {
    name: 'Loyal',
    priority: 2,
    matches: (r, f, m) => r >= 3 && f >= 3 && m >= 3,
  },
  {
    name: 'At Risk',
    priority: 3,
    matches: (r, f, m) => r <= 2 && f >= 3 && m >= 3,
  },
  {
    name: 'Potential Loyalist',
    priority: 4,
    matches: (r, f, m) => r >= 4 && f <= 2 && m >= 3,
  },
  {
    name: 'New Customer',
    priority: 5,
    matches: (r, f, _m) => r >= 4 && f === 1,
  },
  {
    name: 'Promising',
    priority: 6,
    matches: (r, f, m) => r >= 3 && f === 1 && m >= 2,
  },
  {
    name: 'Need Attention',
    priority: 7,
    matches: (r, f, m) => r >= 2 && f <= 2 && m >= 2,
  },
  {
    name: 'Price Sensitive',
    priority: 8,
    matches: (_r, _f, m) => m <= 2,
  },
  {
    name: 'Hibernating',
    priority: 9,
    matches: (r, f, m) => r <= 2 && f <= 2 && m <= 2,
  },
  {
    name: 'Lost',
    priority: 10,
    matches: (r, f, m) => r <= 1 && f <= 1 && m <= 1,
  },
];

// ── Constants ────────────────────────────────────────────────────────────────

const QUEUE_NAME: QueueName = 'rfm-calculate';

// Recency thresholds in days (days since last order → score)
const RECENCY_THRESHOLDS = [
  { maxDays: 30, score: 5 },    // purchased within 30 days
  { maxDays: 60, score: 4 },    // 31-60 days
  { maxDays: 120, score: 3 },   // 61-120 days
  { maxDays: 365, score: 2 },   // 121-365 days
  { maxDays: Infinity, score: 1 }, // 365+ days or never
];

// Frequency thresholds (total orders → score)
const FREQUENCY_THRESHOLDS = [
  { minOrders: 10, score: 5 },
  { minOrders: 6, score: 4 },
  { minOrders: 4, score: 3 },
  { minOrders: 2, score: 2 },
  { minOrders: 0, score: 1 },
];

// ── Scoring Functions ────────────────────────────────────────────────────────

/**
 * Calculate Recency score (1-5) based on days since last order.
 * Uses fixed thresholds but could be percentile-based per shop.
 */
function calculateRecencyScore(lastOrderAt: Date | null, calculationDate: Date): number {
  if (!lastOrderAt) return 1; // never ordered

  const daysSinceOrder = Math.floor(
    (calculationDate.getTime() - lastOrderAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  for (const threshold of RECENCY_THRESHOLDS) {
    if (daysSinceOrder <= threshold.maxDays) {
      return threshold.score;
    }
  }

  return 1;
}

/**
 * Calculate Frequency score (1-5) based on total order count.
 */
function calculateFrequencyScore(totalOrders: number): number {
  for (const threshold of FREQUENCY_THRESHOLDS) {
    if (totalOrders >= threshold.minOrders) {
      return threshold.score;
    }
  }
  return 1;
}

/**
 * Calculate Monetary score (1-5) using percentile-based thresholds relative to shop average.
 * This ensures scoring adapts to each shop's price range.
 *
 * Percentiles:
 *   - Score 5: top 20% (above 80th percentile)
 *   - Score 4: 60th-80th percentile
 *   - Score 3: 40th-60th percentile (average)
 *   - Score 2: 20th-40th percentile
 *   - Score 1: below 20th percentile
 */
function calculateMonetaryScore(
  subscriberTotalSpent: number,
  allSpentValues: number[],
): number {
  if (allSpentValues.length === 0) return 1;
  if (allSpentValues.length === 1) return subscriberTotalSpent > 0 ? 3 : 1;

  const sorted = [...allSpentValues].sort((a, b) => a - b);
  const rank = sorted.filter((v) => v <= subscriberTotalSpent).length;
  const percentile = rank / sorted.length;

  if (percentile >= 0.8) return 5;
  if (percentile >= 0.6) return 4;
  if (percentile >= 0.4) return 3;
  if (percentile >= 0.2) return 2;
  return 1;
}

/**
 * Determine segment based on R, F, M scores using priority-ordered rules.
 */
function determineSegment(r: number, f: number, m: number): RFMSegment {
  for (const rule of SEGMENT_RULES) {
    if (rule.matches(r, f, m)) {
      return rule.name;
    }
  }

  // Fallback — shouldn't reach here if rules are exhaustive
  return 'Average Customers';
}

// ── Main Processor ───────────────────────────────────────────────────────────

async function processRFMCalculation(job: QueueJob<RFMCalculationJobData>): Promise<void> {
  const { shopId, calculationDate: calcDateStr } = job.data;
  const calculationDate = new Date(calcDateStr);

  logger.info('Starting RFM calculation', {
    jobId: job.id,
    shopId,
    calculationDate: calcDateStr,
  });

  // ── Step 1: Fetch all subscribers with order data for this shop ────────
  const subscribers = await fetchSubscribersWithOrderData(shopId);

  if (subscribers.length === 0) {
    logger.info('No subscribers found for RFM calculation', { shopId });
    await storeCalculationMetadata(shopId, calcDateStr, 0, {});
    return;
  }

  logger.info('Fetched subscribers for RFM', {
    shopId,
    subscriberCount: subscribers.length,
  });

  // ── Step 2: Extract all totalSpent values for percentile calculation ───
  const allSpentValues = subscribers.map((s) => s.totalSpent).filter((v) => v > 0);

  // ── Step 3: Calculate RFM scores for each subscriber ───────────────────
  const scores: RFMScore[] = [];
  const segmentCounts: Record<string, number> = {};

  for (const subscriber of subscribers) {
    const recencyScore = calculateRecencyScore(subscriber.lastOrderAt, calculationDate);
    const frequencyScore = calculateFrequencyScore(subscriber.totalOrders);
    const monetaryScore = calculateMonetaryScore(subscriber.totalSpent, allSpentValues);
    const rfmTotal = recencyScore + frequencyScore + monetaryScore;
    const segment = determineSegment(recencyScore, frequencyScore, monetaryScore);

    scores.push({
      subscriberId: subscriber.id,
      recencyScore,
      frequencyScore,
      monetaryScore,
      rfmTotal,
      segment,
    });

    segmentCounts[segment] = (segmentCounts[segment] ?? 0) + 1;
  }

  // ── Step 4: Batch upsert RFMSegment records ────────────────────────────
  await batchUpsertRFMSegments(shopId, calcDateStr, scores);

  // ── Step 5: Store calculation metadata ─────────────────────────────────
  await storeCalculationMetadata(shopId, calcDateStr, subscribers.length, segmentCounts);

  logger.info('RFM calculation completed', {
    jobId: job.id,
    shopId,
    calculationDate: calcDateStr,
    subscribersScored: scores.length,
    segmentBreakdown: segmentCounts,
  });
}

// ── Data fetching ────────────────────────────────────────────────────────────

async function fetchSubscribersWithOrderData(shopId: string): Promise<SubscriberOrderData[]> {
  try {
    // Fetch all active subscribers with their order aggregate data
    const subscribers = await (db as any).subscriber.findMany({
      where: {
        shopId,
        isActive: true,
      },
      select: {
        id: true,
        shopId: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        totalOrders: true,
        totalSpent: true,
        lastOrderAt: true,
        createdAt: true,
      },
      orderBy: { lastOrderAt: 'desc' },
    });

    return subscribers as SubscriberOrderData[];
  } catch (err) {
    logger.error('Failed to fetch subscribers for RFM calculation', {
      shopId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ── Batch upsert ─────────────────────────────────────────────────────────────

async function batchUpsertRFMSegments(
  shopId: string,
  calculationDate: string,
  scores: RFMScore[],
): Promise<void> {
  // Process in batches of 100 to avoid DB pressure
  const BATCH_SIZE = 100;

  for (let i = 0; i < scores.length; i += BATCH_SIZE) {
    const batch = scores.slice(i, i + BATCH_SIZE);

    // Use Promise.all for parallel upserts within each batch
    const upserts = batch.map(async (score) => {
      try {
        await (db as any).rFMSegment.upsert({
          where: {
            subscriberId_calculationDate: {
              subscriberId: score.subscriberId,
              calculationDate,
            },
          },
          create: {
            subscriberId: score.subscriberId,
            shopId,
            calculationDate,
            recencyScore: score.recencyScore,
            frequencyScore: score.frequencyScore,
            monetaryScore: score.monetaryScore,
            rfmTotal: score.rfmTotal,
            segment: score.segment,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          update: {
            recencyScore: score.recencyScore,
            frequencyScore: score.frequencyScore,
            monetaryScore: score.monetaryScore,
            rfmTotal: score.rfmTotal,
            segment: score.segment,
            updatedAt: new Date(),
          },
        });
      } catch (err) {
        logger.warn('Failed to upsert RFM segment for subscriber', {
          shopId,
          subscriberId: score.subscriberId,
          error: err instanceof Error ? err.message : String(err),
        });
        // Don't throw — continue with other subscribers
      }
    });

    await Promise.all(upserts);

    logger.debug(`RFM batch upserted`, {
      shopId,
      batch: `${i + 1}-${Math.min(i + BATCH_SIZE, scores.length)} of ${scores.length}`,
    });
  }
}

// ── Metadata storage ─────────────────────────────────────────────────────────

async function storeCalculationMetadata(
  shopId: string,
  calculationDate: string,
  totalSubscribers: number,
  segmentBreakdown: Record<string, number>,
): Promise<void> {
  try {
    await (db as any).rFMMetadata.upsert({
      where: {
        shopId_calculationDate: { shopId, calculationDate },
      },
      create: {
        shopId,
        calculationDate,
        totalSubscribers,
        segmentBreakdown: JSON.stringify(segmentBreakdown),
        calculatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        totalSubscribers,
        segmentBreakdown: JSON.stringify(segmentBreakdown),
        calculatedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    logger.debug('RFM calculation metadata stored', {
      shopId,
      calculationDate,
      totalSubscribers,
    });
  } catch (err) {
    logger.warn('Failed to store RFM calculation metadata', {
      shopId,
      calculationDate,
      error: err instanceof Error ? err.message : String(err),
    });
    // Don't throw — metadata storage failure shouldn't fail the whole job
  }
}

// ── Utility: Generate RFM report summary ─────────────────────────────────────

export function generateRFMReport(scores: RFMScore[]): {
  totalSubscribers: number;
  averageRecency: number;
  averageFrequency: number;
  averageMonetary: number;
  segmentDistribution: Record<RFMSegment, number>;
  topChampions: Array<{ subscriberId: string; rfmTotal: number }>;
  atRiskCount: number;
  lostCount: number;
} {
  const totalSubscribers = scores.length;
  const averageRecency = scores.reduce((s, c) => s + c.recencyScore, 0) / (totalSubscribers || 1);
  const averageFrequency = scores.reduce((s, c) => s + c.frequencyScore, 0) / (totalSubscribers || 1);
  const averageMonetary = scores.reduce((s, c) => s + c.monetaryScore, 0) / (totalSubscribers || 1);

  const segmentDistribution: Record<string, number> = {};
  for (const score of scores) {
    segmentDistribution[score.segment] = (segmentDistribution[score.segment] ?? 0) + 1;
  }

  const topChampions = scores
    .filter((s) => s.segment === 'Champions')
    .sort((a, b) => b.rfmTotal - a.rfmTotal)
    .slice(0, 20)
    .map((s) => ({ subscriberId: s.subscriberId, rfmTotal: s.rfmTotal }));

  const atRiskCount = scores.filter((s) => s.segment === 'At Risk').length;
  const lostCount = scores.filter((s) => s.segment === 'Lost').length;

  return {
    totalSubscribers,
    averageRecency: Math.round(averageRecency * 100) / 100,
    averageFrequency: Math.round(averageFrequency * 100) / 100,
    averageMonetary: Math.round(averageMonetary * 100) / 100,
    segmentDistribution: segmentDistribution as Record<RFMSegment, number>,
    topChampions,
    atRiskCount,
    lostCount,
  };
}

// ── Registration ─────────────────────────────────────────────────────────────

export function registerRFMQueue(): void {
  const queue = getQueue<RFMCalculationJobData>(QUEUE_NAME);
  queue.register(processRFMCalculation as QueueProcessor<RFMCalculationJobData>);
  logger.info('RFM calculation queue registered', { queue: QUEUE_NAME });
}

export { processRFMCalculation };
