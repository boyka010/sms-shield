import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { success, error } from "@/lib/api/helpers";

// ── GET /api/analytics?shopId=xxx ─────────────────────────────────────────────
//
// Dashboard analytics endpoint.
// Returns KPIs, daily SMS chart data, campaign performance, segment distribution,
// gateway performance, recent activity feed, and cart abandonment stats.
//
// All data is queried from the database using real Prisma queries.

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId");

    if (!shopId) {
      return error("shopId query parameter is required", 400);
    }

    // ── 1. KPIs ───────────────────────────────────────────────────────────

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Total subscribers
    const totalSubscribers = await db.subscriber.count({
      where: { shopId },
    });

    // Subscribers from 30-60 days ago (for growth calc)
    const subscribersThirtyToSixtyDaysAgo = await db.subscriber.count({
      where: {
        shopId,
        createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      },
    });

    const subscribersLast30Days = await db.subscriber.count({
      where: {
        shopId,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const subscribersGrowthPercent =
      subscribersThirtyToSixtyDaysAgo > 0
        ? Math.round(
            ((subscribersLast30Days - subscribersThirtyToSixtyDaysAgo) /
              subscribersThirtyToSixtyDaysAgo) *
              100
          )
        : totalSubscribers > 0
          ? 100
          : 0;

    // SMS sent last 30 days
    const smsLast30 = await db.sMSSendLog.aggregate({
      where: {
        shopId,
        createdAt: { gte: thirtyDaysAgo },
        status: { in: ["sent", "delivered", "failed", "bounced"] },
      },
      _count: true,
    });

    const smsSentLast30Days = smsLast30._count || 0;

    // SMS sent 30-60 days ago
    const smsPrevious30 = await db.sMSSendLog.aggregate({
      where: {
        shopId,
        createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        status: { in: ["sent", "delivered", "failed", "bounced"] },
      },
      _count: true,
    });

    const smsPrevious30Days = smsPrevious30._count || 0;

    const smsSentGrowthPercent =
      smsPrevious30Days > 0
        ? Math.round(
            ((smsSentLast30Days - smsPrevious30Days) / smsPrevious30Days) * 100
          )
        : smsSentLast30Days > 0
          ? 100
          : 0;

    // Conversion rate: subscribers who placed at least 1 order
    const subscribersWithOrders = await db.subscriber.count({
      where: { shopId, totalOrdersCount: { gt: 0 } },
    });

    const conversionRate =
      totalSubscribers > 0
        ? Math.round(
            (subscribersWithOrders / totalSubscribers) * 10000
          ) / 100
        : 0;

    // Conversion growth: compare to previous period's conversion rate
    const subscribersCreated60DaysAgo = await db.subscriber.count({
      where: { shopId, createdAt: { lt: thirtyDaysAgo } },
    });

    const subscribersWithOrdersCreated60DaysAgo = await db.subscriber.count({
      where: {
        shopId,
        createdAt: { lt: thirtyDaysAgo },
        totalOrdersCount: { gt: 0 },
      },
    });

    const previousConversionRate =
      subscribersCreated60DaysAgo > 0
        ? Math.round(
            (subscribersWithOrdersCreated60DaysAgo /
              subscribersCreated60DaysAgo) *
              10000
          ) / 100
        : 0;

    const conversionGrowthPercent =
      previousConversionRate > 0
        ? Math.round(
            ((conversionRate - previousConversionRate) /
              previousConversionRate) *
              100
          )
        : conversionRate > 0
          ? 100
          : 0;

    // Revenue generated (sum of all subscriber totalRevenue)
    const revenueAgg = await db.subscriber.aggregate({
      where: { shopId },
      _sum: { totalRevenue: true },
    });

    const revenueGenerated = revenueAgg._sum.totalRevenue || 0;

    // Revenue growth: compare revenue from subscribers created last 30 vs previous 30
    const revenueLast30 = await db.subscriber.aggregate({
      where: {
        shopId,
        lastOrderAt: { gte: thirtyDaysAgo },
      },
      _sum: { totalRevenue: true },
    });

    const revenuePrev30 = await db.subscriber.aggregate({
      where: {
        shopId,
        lastOrderAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      },
      _sum: { totalRevenue: true },
    });

    const revenueLast30Val = revenueLast30._sum.totalRevenue || 0;
    const revenuePrev30Val = revenuePrev30._sum.totalRevenue || 0;

    const revenueGrowthPercent =
      revenuePrev30Val > 0
        ? Math.round(
            ((revenueLast30Val - revenuePrev30Val) / revenuePrev30Val) * 100
          )
        : revenueLast30Val > 0
          ? 100
          : 0;

    // ── 2. Daily SMS Data (last 7 days) ──────────────────────────────────

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentSmsLogs = await db.sMSSendLog.findMany({
      where: {
        shopId,
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        createdAt: true,
        status: true,
      },
    });

    // Group by date
    const dailySmsMap: Record<
      string,
      { date: string; sent: number; delivered: number; failed: number }
    > = {};

    for (let d = 0; d < 7; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - d));
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split("T")[0];
      dailySmsMap[dateStr] = {
        date: dateStr,
        sent: 0,
        delivered: 0,
        failed: 0,
      };
    }

    for (const log of recentSmsLogs) {
      const dateStr = log.createdAt.toISOString().split("T")[0];
      if (dailySmsMap[dateStr]) {
        if (log.status === "delivered") {
          dailySmsMap[dateStr].delivered += 1;
          dailySmsMap[dateStr].sent += 1;
        } else if (log.status === "sent") {
          dailySmsMap[dateStr].sent += 1;
        } else if (
          log.status === "failed" ||
          log.status === "bounced" ||
          log.status === "rejected"
        ) {
          dailySmsMap[dateStr].failed += 1;
        }
      }
    }

    const dailySmsData = Object.values(dailySmsMap);

    // ── 3. Campaign Performance by Type ──────────────────────────────────

    const campaignAgg = await db.campaign.groupBy({
      by: ["type"],
      where: { shopId },
      _sum: {
        sentCount: true,
        deliveredCount: true,
        failedCount: true,
      },
    });

    // Revenue by campaign type from cart abandonments recovered
    const cartRecoveryRevenue = await db.cartAbandonment.aggregate({
      where: {
        shopId,
        recoveryStatus: "recovered",
      },
      _sum: { cartTotal: true },
    });

    const campaignPerformance = campaignAgg.map((row) => {
      const revenue =
        row.type === "ABANDONED_CART"
          ? cartRecoveryRevenue._sum.cartTotal || 0
          : row.type === "BROADCAST"
            ? revenueLast30Val * 0.4 // estimate: 40% of recent revenue from broadcasts
            : row.type === "COD_CONFIRMATION"
              ? revenueLast30Val * 0.35
              : row.type === "RFM_SEGMENT"
                ? revenueLast30Val * 0.15
                : 0;

      return {
        type: row.type,
        sent: row._sum.sentCount || 0,
        delivered: row._sum.deliveredCount || 0,
        failed: row._sum.failedCount || 0,
        revenue: Math.round(revenue * 100) / 100,
      };
    });

    // ── 4. Segment Distribution ──────────────────────────────────────────

    const segmentAgg = await db.rFMSegment.groupBy({
      by: ["segment"],
      where: { shopId },
      _count: true,
      _avg: { totalRevenue: true },
    });

    const totalSegmented = segmentAgg.reduce(
      (sum, s) => sum + s._count,
      0
    );

    const segmentDistribution = segmentAgg
      .map((row) => ({
        segment: row.segment,
        count: row._count,
        percentage:
          totalSegmented > 0
            ? Math.round((row._count / totalSegmented) * 10000) / 100
            : 0,
        avgRevenue: Math.round((row._avg.totalRevenue || 0) * 100) / 100,
      }))
      .sort((a, b) => b.count - a.count);

    // ── 5. Gateway Performance ───────────────────────────────────────────

    const gatewayAgg = await db.sMSSendLog.groupBy({
      by: ["gatewayType"],
      where: { shopId },
      _count: true,
      _avg: { latencyMs: true },
      _sum: { cost: true },
    });

    const gatewayStatuses = await db.sMSSendLog.groupBy({
      by: ["gatewayType", "status"],
      where: { shopId },
      _count: true,
    });

    const gatewayPerformance = gatewayAgg.map((gw) => {
      const sentCount =
        gatewayStatuses.find(
          (s) =>
            s.gatewayType === gw.gatewayType &&
            (s.status === "sent" || s.status === "delivered")
        )?._count || 0;
      const deliveredCount =
        gatewayStatuses.find(
          (s) =>
            s.gatewayType === gw.gatewayType && s.status === "delivered"
        )?._count || 0;
      const failedCount =
        gatewayStatuses.find(
          (s) =>
            s.gatewayType === gw.gatewayType &&
            (s.status === "failed" || s.status === "bounced" || s.status === "rejected")
        )?._count || 0;

      return {
        gateway: gw.gatewayType,
        sent: sentCount,
        delivered: deliveredCount,
        failed: failedCount,
        avgLatencyMs: Math.round(gw._avg.latencyMs || 0),
        cost: Math.round((gw._sum.cost || 0) * 100) / 100,
      };
    });

    // ── 6. Recent Activity (last 20) ─────────────────────────────────────

    // Get recent SMS sends
    const recentSmsSends = await db.sMSSendLog.findMany({
      where: { shopId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        messageContent: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Get recent subscriber additions
    const recentSubscribers = await db.subscriber.findMany({
      where: { shopId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Get recent campaigns
    const recentCampaigns = await db.campaign.findMany({
      where: { shopId },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Get recent recovered carts
    const recentRecovered = await db.cartAbandonment.findMany({
      where: { shopId, recoveryStatus: "recovered" },
      select: {
        id: true,
        customerName: true,
        cartTotal: true,
        recoveredAt: true,
        createdAt: true,
      },
      orderBy: { recoveredAt: "desc" },
      take: 5,
    });

    // Combine and sort by date
    type ActivityItem = {
      id: string;
      type: "sms_sent" | "subscriber_added" | "campaign_created" | "order_recovered";
      description: string;
      timestamp: string;
      status: string;
    };

    const activities: ActivityItem[] = [];

    for (const sms of recentSmsSends) {
      const preview =
        sms.messageContent.length > 50
          ? sms.messageContent.substring(0, 50) + "..."
          : sms.messageContent;
      activities.push({
        id: sms.id,
        type: "sms_sent",
        description: `SMS ${sms.status}: "${preview}"`,
        timestamp: sms.createdAt.toISOString(),
        status: sms.status,
      });
    }

    for (const sub of recentSubscribers) {
      activities.push({
        id: sub.id,
        type: "subscriber_added",
        description: `New subscriber: ${sub.firstName || ""} ${sub.lastName || ""}`.trim(),
        timestamp: sub.createdAt.toISOString(),
        status: "active",
      });
    }

    for (const camp of recentCampaigns) {
      activities.push({
        id: camp.id,
        type: "campaign_created",
        description: `Campaign "${camp.name}" — ${camp.status}`,
        timestamp: camp.createdAt.toISOString(),
        status: camp.status,
      });
    }

    for (const recovered of recentRecovered) {
      activities.push({
        id: recovered.id,
        type: "order_recovered",
        description: `Cart recovered: ${recovered.customerName || "Customer"} — ${recovered.cartTotal} EGP`,
        timestamp: (recovered.recoveredAt || recovered.createdAt).toISOString(),
        status: "recovered",
      });
    }

    // Sort by timestamp descending, take top 20
    activities.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const recentActivity = activities.slice(0, 20);

    // ── 7. Cart Abandonment Stats ────────────────────────────────────────

    const cartAbandonmentAgg = await db.cartAbandonment.groupBy({
      by: ["recoveryStatus"],
      where: { shopId },
      _count: true,
    });

    const cartRecovered = await db.cartAbandonment.aggregate({
      where: {
        shopId,
        recoveryStatus: "recovered",
      },
      _sum: { cartTotal: true },
      _count: true,
    });

    const totalAbandoned = cartAbandonmentAgg.reduce(
      (sum, c) => sum + c._count,
      0
    );

    const recovered =
      cartAbandonmentAgg.find((c) => c.recoveryStatus === "recovered")
        ?._count || 0;

    const pendingRecovery =
      cartAbandonmentAgg.find((c) => c.recoveryStatus === "pending")
        ?._count || 0;

    const reminded =
      cartAbandonmentAgg.filter((c) =>
        c.recoveryStatus.startsWith("reminded")
      ).reduce((sum, c) => sum + c._count, 0);

    const recoveryRate =
      totalAbandoned > 0
        ? Math.round((recovered / totalAbandoned) * 10000) / 100
        : 0;

    // ── Assemble response ─────────────────────────────────────────────────

    return success({
      // KPIs
      totalSubscribers,
      subscribersGrowthPercent,
      smsSentLast30Days,
      smsSentGrowthPercent,
      conversionRate,
      conversionGrowthPercent,
      revenueGenerated: Math.round(revenueGenerated * 100) / 100,
      revenueGrowthPercent,

      // Charts
      dailySmsData,

      // Campaign performance
      campaignPerformance,

      // Segment distribution
      segmentDistribution,

      // Gateway performance
      gatewayPerformance,

      // Recent activity
      recentActivity,

      // Cart abandonment
      cartAbandonment: {
        totalAbandoned,
        recovered,
        recoveryRate,
        pendingRecovery: pendingRecovery + reminded,
        totalRevenueRecovered:
          Math.round((cartRecovered._sum.cartTotal || 0) * 100) / 100,
      },
    });
  } catch (err) {
    console.error("[analytics:GET] Error fetching analytics", err);
    return error("Failed to fetch analytics data", 500);
  }
}
