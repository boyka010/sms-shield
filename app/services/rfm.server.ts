import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RfmScore {
  recency: number;
  frequency: number;
  monetary: number;
  total: number;
}

interface RfmThresholds {
  recency: { recent: number; medium: number };
  frequency: { high: number; medium: number };
  monetary: { high: number; medium: number };
}

const DEFAULT_THRESHOLDS: RfmThresholds = {
  recency: { recent: 30, medium: 90 },
  frequency: { high: 5, medium: 2 },
  monetary: { high: 5000, medium: 2000 }
};

export class RfmCalculator {
  private merchantId: string;
  private thresholds: RfmThresholds;

  constructor(merchantId: string, thresholds?: RfmThresholds) {
    this.merchantId = merchantId;
    this.thresholds = thresholds || DEFAULT_THRESHOLDS;
  }

  async calculateRfmForContact(contactId: string): Promise<RfmScore> {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        orders: {
          orderBy: { orderDate: 'desc' }
        }
      }
    });

    if (!contact || contact.orders.length === 0) {
      return { recency: 0, frequency: 0, monetary: 0, total: 0 };
    }

    const lastOrderDate = contact.orders[0].orderDate;
    const daysSinceLastOrder = this.calculateDaysSince(lastOrderDate);

    const recencyScore = this.calculateRecencyScore(daysSinceLastOrder);
    const frequencyScore = this.calculateFrequencyScore(contact.totalOrders);
    const monetaryScore = this.calculateMonetaryScore(contact.totalSpent);

    const totalScore = recencyScore + frequencyScore + monetaryScore;

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        rfmRecencyScore: recencyScore,
        rfmFrequencyScore: frequencyScore,
        rfmMonetaryScore: monetaryScore,
        rfmTotalScore: totalScore,
        segment: this.determineSegment(recencyScore, frequencyScore, monetaryScore)
      }
    });

    return {
      recency: recencyScore,
      frequency: frequencyScore,
      monetary: monetaryScore,
      total: totalScore
    };
  }

  async calculateRfmForAllContacts(): Promise<void> {
    const contacts = await prisma.contact.findMany({
      where: { merchantId: this.merchantId },
      include: {
        orders: {
          orderBy: { orderDate: 'desc' }
        }
      }
    });

    const updates = contacts.map(contact => {
      if (contact.orders.length === 0) {
        return {
          id: contact.id,
          segment: 'NEW' as const,
          rfmRecencyScore: 0,
          rfmFrequencyScore: 0,
          rfmMonetaryScore: 0,
          rfmTotalScore: 0
        };
      }

      const lastOrderDate = contact.orders[0].orderDate;
      const daysSinceLastOrder = this.calculateDaysSince(lastOrderDate);

      const recencyScore = this.calculateRecencyScore(daysSinceLastOrder);
      const frequencyScore = this.calculateFrequencyScore(contact.totalOrders);
      const monetaryScore = this.calculateMonetaryScore(contact.totalSpent);

      return {
        id: contact.id,
        rfmRecencyScore: recencyScore,
        rfmFrequencyScore: frequencyScore,
        rfmMonetaryScore: monetaryScore,
        rfmTotalScore: recencyScore + frequencyScore + monetaryScore,
        segment: this.determineSegment(recencyScore, frequencyScore, monetaryScore)
      };
    });

    await prisma.$transaction(
      updates.map(update =>
        prisma.contact.update({
          where: { id: update.id },
          data: {
            rfmRecencyScore: update.rfmRecencyScore,
            rfmFrequencyScore: update.rfmFrequencyScore,
            rfmMonetaryScore: update.rfmMonetaryScore,
            rfmTotalScore: update.rfmTotalScore,
            segment: update.segment
          }
        }))
    );

    await this.updateRfmCache();
  }

  private calculateDaysSince(date: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private calculateRecencyScore(daysSinceLastOrder: number): number {
    if (daysSinceLastOrder <= this.thresholds.recency.recent) return 5;
    if (daysSinceLastOrder <= this.thresholds.recency.medium) return 4;
    if (daysSinceLastOrder <= 180) return 3;
    if (daysSinceLastOrder <= 365) return 2;
    return 1;
  }

  private calculateFrequencyScore(totalOrders: number): number {
    if (totalOrders >= this.thresholds.frequency.high) return 5;
    if (totalOrders >= this.thresholds.frequency.medium) return 4;
    if (totalOrders >= 2) return 3;
    if (totalOrders === 1) return 2;
    return 1;
  }

  private calculateMonetaryScore(totalSpent: number): number {
    if (totalSpent >= this.thresholds.monetary.high) return 5;
    if (totalSpent >= this.thresholds.monetary.medium) return 4;
    if (totalSpent >= 1000) return 3;
    if (totalSpent >= 500) return 2;
    return 1;
  }

  private determineSegment(
    recency: number,
    frequency: number,
    monetary: number
  ): 'CHAMPIONS' | 'LOYAL' | 'AT_RISK' | 'PRICE_SENSITIVE' | 'NEW' | 'DORMANT' {
    const total = recency + frequency + monetary;

    if (recency >= 4 && frequency >= 4 && monetary >= 4) {
      return 'CHAMPIONS';
    }

    if (recency >= 3 && frequency >= 3) {
      return 'LOYAL';
    }

    if (recency <= 2 && frequency >= 3) {
      return 'AT_RISK';
    }

    if (monetary <= 2 && frequency >= 3) {
      return 'PRICE_SENSITIVE';
    }

    if (recency <= 2 && frequency <= 2) {
      return 'DORMANT';
    }

    return 'NEW';
  }

  private async updateRfmCache(): Promise<void> {
    const segments = await prisma.contact.groupBy({
      by: ['segment'],
      where: { merchantId: this.merchantId },
      _count: true,
      _sum: {
        totalSpent: true
      }
    });

    for (const segment of segments) {
      const avgOrderValue = segment._count > 0 
        ? (segment._sum.totalSpent || 0) / segment._count 
        : 0;

      await prisma.cachedRfmCalculation.upsert({
        where: {
          merchantId_segment: {
            merchantId: this.merchantId,
            segment: segment.segment as any
          }
        },
        create: {
          merchantId: this.merchantId,
          segment: segment.segment as any,
          contactCount: segment._count,
          totalRevenue: segment._sum.totalSpent || 0,
          avgOrderValue
        },
        update: {
          contactCount: segment._count,
          totalRevenue: segment._sum.totalSpent || 0,
          avgOrderValue,
          calculatedAt: new Date()
        }
      });
    }
  }

  async getSegmentStats(): Promise<Map<string, { count: number; revenue: number }>> {
    const stats = new Map<string, { count: number; revenue: number }>();

    const cached = await prisma.cachedRfmCalculation.findMany({
      where: { merchantId: this.merchantId }
    });

    for (const item of cached) {
      stats.set(item.segment, {
        count: item.contactCount,
        revenue: item.totalRevenue
      });
    }

    return stats;
  }
}

export async function runDailyRfmCalculation(merchantId: string): Promise<void> {
  const calculator = new RfmCalculator(merchantId);
  await calculator.calculateRfmForAllContacts();
}

export async function getContactsBySegment(
  merchantId: string,
  segment: 'CHAMPIONS' | 'LOYAL' | 'AT_RISK' | 'PRICE_SENSITIVE' | 'NEW' | 'DORMANT',
  limit: number = 100,
  offset: number = 0
) {
  return prisma.contact.findMany({
    where: {
      merchantId,
      segment
    },
    orderBy: { rfmTotalScore: 'desc' },
    take: limit,
    skip: offset,
    include: {
      orders: {
        orderBy: { orderDate: 'desc' },
        take: 5
      }
    }
  });
}
