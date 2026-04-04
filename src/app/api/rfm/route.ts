import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestBody } from '@/lib/api/helpers';

// ── GET /api/rfm ──────────────────────────────────────────────────────────────
//
// Get RFM segments for a shop.
// Returns segment data grouped by segment name with counts.
// Includes latest calculation data per subscriber.
//

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const shopId = searchParams.get('shopId');
    if (!shopId) {
      return error('shopId query parameter is required', 400);
    }

    // Optional segment filter
    const segmentFilter = searchParams.get('segment');

    // Build where clause
    const where: Record<string, unknown> = { shopId };
    if (segmentFilter) {
      where.segment = segmentFilter;
    }

    // Get the most recent calculation date for this shop
    const latestCalculation = await db.rFMSegment.aggregate({
      where: { shopId },
      _max: { calculatedAt: true },
    });

    const latestCalcDate = latestCalculation._max.calculatedAt;

    // Fetch all RFM segments for this shop (latest calculation only)
    const rfmRecords = await db.rFMSegment.findMany({
      where,
      select: {
        id: true,
        subscriberId: true,
        calculatedAt: true,
        recencyScore: true,
        frequencyScore: true,
        monetaryScore: true,
        rfmCompositeScore: true,
        segment: true,
        daysSinceLastOrder: true,
        totalOrders: true,
        totalRevenue: true,
        averageOrderValue: true,
        subscriber: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isVerified: true,
            tags: true,
            createdAt: true,
          },
        },
      },
      orderBy: { calculatedAt: 'desc' },
    });

    // Group by segment name
    const segmentGroups: Record<string, {
      segment: string;
      subscriberCount: number;
      avgRecency: number;
      avgFrequency: number;
      avgMonetary: number;
      avgCompositeScore: number;
      totalRevenue: number;
      subscribers: Array<{
        subscriberId: string;
        recencyScore: number;
        frequencyScore: number;
        monetaryScore: number;
        rfmCompositeScore: number;
        daysSinceLastOrder: number;
        totalOrders: number;
        totalRevenue: number;
        averageOrderValue: number;
        calculatedAt: Date;
        subscriber: {
          id: string;
          email: string | null;
          firstName: string | null;
          lastName: string | null;
          isVerified: boolean;
          tags: string;
          createdAt: Date;
        };
      }>;
    }> = {};

    for (const record of rfmRecords) {
      if (!segmentGroups[record.segment]) {
        segmentGroups[record.segment] = {
          segment: record.segment,
          subscriberCount: 0,
          avgRecency: 0,
          avgFrequency: 0,
          avgMonetary: 0,
          avgCompositeScore: 0,
          totalRevenue: 0,
          subscribers: [],
        };
      }

      const group = segmentGroups[record.segment];
      group.subscriberCount += 1;
      group.avgRecency += record.recencyScore;
      group.avgFrequency += record.frequencyScore;
      group.avgMonetary += record.monetaryScore;
      group.avgCompositeScore += record.rfmCompositeScore;
      group.totalRevenue += record.totalRevenue;
      group.subscribers.push({
        subscriberId: record.subscriberId,
        recencyScore: record.recencyScore,
        frequencyScore: record.frequencyScore,
        monetaryScore: record.monetaryScore,
        rfmCompositeScore: record.rfmCompositeScore,
        daysSinceLastOrder: record.daysSinceLastOrder,
        totalOrders: record.totalOrders,
        totalRevenue: record.totalRevenue,
        averageOrderValue: record.averageOrderValue,
        calculatedAt: record.calculatedAt,
        subscriber: record.subscriber,
      });
    }

    // Compute averages
    for (const group of Object.values(segmentGroups)) {
      const count = group.subscriberCount || 1;
      group.avgRecency = Math.round((group.avgRecency / count) * 100) / 100;
      group.avgFrequency = Math.round((group.avgFrequency / count) * 100) / 100;
      group.avgMonetary = Math.round((group.avgMonetary / count) * 100) / 100;
      group.avgCompositeScore = Math.round((group.avgCompositeScore / count) * 100) / 100;
      group.totalRevenue = Math.round(group.totalRevenue * 100) / 100;
    }

    // Compute overall stats
    const totalSubscribers = rfmRecords.length;
    const overallAvgRecency = totalSubscribers > 0
      ? Math.round((rfmRecords.reduce((sum, r) => sum + r.recencyScore, 0) / totalSubscribers) * 100) / 100
      : 0;
    const overallAvgFrequency = totalSubscribers > 0
      ? Math.round((rfmRecords.reduce((sum, r) => sum + r.frequencyScore, 0) / totalSubscribers) * 100) / 100
      : 0;
    const overallAvgMonetary = totalSubscribers > 0
      ? Math.round((rfmRecords.reduce((sum, r) => sum + r.monetaryScore, 0) / totalSubscribers) * 100) / 100
      : 0;

    return success({
      shopId,
      lastCalculatedAt: latestCalcDate,
      totalSegmentedSubscribers: totalSubscribers,
      overallAverages: {
        recency: overallAvgRecency,
        frequency: overallAvgFrequency,
        monetary: overallAvgMonetary,
      },
      segments: Object.values(segmentGroups),
    });
  } catch (err) {
    console.error('[rfm:GET] Error fetching RFM segments', err);
    return error('Failed to fetch RFM segments', 500);
  }
}

// ── POST /api/rfm ─────────────────────────────────────────────────────────────
//
// Trigger RFM recalculation.
// Enqueues an RFM calculation job and returns a job ID.
//

export async function POST(request: NextRequest) {
  try {
    const body = await getRequestBody<{
      shopId: string;
    }>(request);

    const { shopId } = body;

    if (!shopId) {
      return error('shopId is required', 400);
    }

    // Verify shop exists
    const shop = await db.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      return error('Shop not found', 404);
    }

    // Enqueue RFM calculation job
    const { getQueue } = await import('@/lib/queues');
    const calculationDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const queue = getQueue<{
      shopId: string;
      calculationDate: string;
    }>('rfm-calculate');

    const job = queue.add({
      shopId,
      calculationDate,
    });

    return success({
      message: 'RFM recalculation triggered',
      jobId: job.id,
      shopId,
      calculationDate,
      status: job.status,
    }, 202);
  } catch (err) {
    console.error('[rfm:POST] Error triggering RFM calculation', err);
    return error('Failed to trigger RFM calculation', 500);
  }
}
