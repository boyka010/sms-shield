'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  Send,
  TrendingUp,
  DollarSign,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
  UserPlus,
  AlertTriangle,
  Megaphone,
  BarChart3,
  Zap,
  Shield,
  Clock,
  AlertCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useDashboardAnalytics } from '@/hooks/use-queries';

// ── Actual API Response Shape ───────────────────────────────────────────
// The API returns a flat object; the hook's generic type doesn't match,
// so we work with the real shape here.

interface DailySmsPoint {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
}

interface CampaignPerfRow {
  type: string;
  sent: number;
  delivered: number;
  failed: number;
  revenue: number;
}

interface ActivityItem {
  id: string;
  type: 'sms_sent' | 'subscriber_added' | 'campaign_created' | 'order_recovered';
  description: string;
  timestamp: string;
  status: string;
}

interface CartAbandonmentStats {
  totalAbandoned: number;
  recovered: number;
  recoveryRate: number;
  pendingRecovery: number;
  totalRevenueRecovered: number;
}

interface AnalyticsData {
  totalSubscribers: number;
  subscribersGrowthPercent: number;
  smsSentLast30Days: number;
  smsSentGrowthPercent: number;
  conversionRate: number;
  conversionGrowthPercent: number;
  revenueGenerated: number;
  revenueGrowthPercent: number;
  dailySmsData: DailySmsPoint[];
  campaignPerformance: CampaignPerfRow[];
  recentActivity: ActivityItem[];
  cartAbandonment: CartAbandonmentStats;
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** Format an ISO date string to a short day name (Mon, Tue, …). */
function formatDay(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

/** Simple relative time formatter (e.g. "2 minutes ago"). */
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months !== 1 ? 's' : ''} ago`;
}

/** Format a number with commas. */
function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

/** Map API activity type → icon element. */
function activityIcon(type: string) {
  switch (type) {
    case 'sms_sent':
      return <Send className="size-4 text-emerald-500" />;
    case 'subscriber_added':
      return <UserPlus className="size-4 text-sky-500" />;
    case 'campaign_created':
      return <Megaphone className="size-4 text-amber-500" />;
    case 'order_recovered':
      return <ShoppingCart className="size-4 text-teal-500" />;
    default:
      return <AlertCircle className="size-4 text-muted-foreground" />;
  }
}

/** Map API status string → badge variant key. */
function statusVariant(status: string): 'success' | 'failed' | 'pending' {
  const s = status.toLowerCase();
  if (['delivered', 'active', 'recovered', 'completed', 'sent'].includes(s)) return 'success';
  if (['failed', 'bounced', 'rejected'].includes(s)) return 'failed';
  return 'pending';
}

// ── Static Quick Actions ────────────────────────────────────────────────

const quickActions = [
  {
    label: 'New Campaign',
    href: '/campaigns/new',
    icon: <Megaphone className="size-5" />,
    bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    hoverBg: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/50',
    textColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    label: 'View Subscribers',
    href: '/subscribers',
    icon: <Users className="size-5" />,
    bg: 'bg-teal-50 dark:bg-teal-950/50',
    hoverBg: 'hover:bg-teal-100 dark:hover:bg-teal-900/50',
    textColor: 'text-teal-600 dark:text-teal-400',
  },
  {
    label: 'Run RFM Analysis',
    href: '',
    action: 'rfm',
    icon: <BarChart3 className="size-5" />,
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    hoverBg: 'hover:bg-amber-100 dark:hover:bg-amber-900/50',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    label: 'Gateway Health',
    href: '/settings',
    icon: <Shield className="size-5" />,
    bg: 'bg-rose-50 dark:bg-rose-950/50',
    hoverBg: 'hover:bg-rose-100 dark:hover:bg-rose-900/50',
    textColor: 'text-rose-600 dark:text-rose-400',
  },
];

// ── Chart Tooltips ──────────────────────────────────────────────────────

function DeliveryTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="mb-2 text-sm font-semibold text-foreground">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function CampaignTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="mb-2 text-sm font-semibold text-foreground">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">
            {entry.dataKey === 'sent' ? 'Sent' : 'Revenue (EGP)'}:
          </span>
          <span className="font-medium text-foreground">
            {entry.dataKey === 'revenue'
              ? `EGP ${entry.value.toLocaleString()}`
              : entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Status Badge ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'success' | 'failed' | 'pending' }) {
  const variants: Record<string, { className: string; label: string }> = {
    success: {
      className:
        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-transparent',
      label: 'Success',
    },
    failed: {
      className:
        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-transparent',
      label: 'Failed',
    },
    pending: {
      className:
        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-transparent',
      label: 'Pending',
    },
  };
  const v = variants[status];
  return (
    <Badge variant="outline" className={v.className}>
      {v.label}
    </Badge>
  );
}

// ── Skeleton Components ─────────────────────────────────────────────────

function KpiCardSkeleton() {
  return (
    <Card className="gap-4 py-5 shadow-sm">
      <CardContent className="flex items-start justify-between gap-4">
        <div className="space-y-2.5 flex-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-36" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-3.5" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="size-10 rounded-full shrink-0" />
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

function ActivityFeedSkeleton() {
  const rows = 4;
  return (
    <Card className="shadow-sm lg:col-span-2">
      <CardHeader>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-52" />
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <div className="space-y-0 px-6">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i}>
              <div className="flex items-start gap-3 py-3">
                <Skeleton className="size-8 rounded-full shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-4 w-full max-w-sm" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
              </div>
              {i < rows - 1 && <Separator />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CartAbandonmentSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
        <Skeleton className="h-2.5 w-full rounded-full" />
      </CardContent>
    </Card>
  );
}

// ── Page Component ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, isError, refetch, dataUpdatedAt } =
    useDashboardAnalytics('demo-shop-1');

  // Derive the real typed data from the hook response
  const analytics = data as unknown as AnalyticsData | undefined;

  // Track last update time
  const lastUpdatedAt = dataUpdatedAt > 0
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null;

  // Map daily SMS data with formatted day names for the chart
  const deliveryChartData = analytics?.dailySmsData
    ? analytics.dailySmsData.map((d) => ({
        day: formatDay(d.date),
        sent: d.sent,
        delivered: d.delivered,
        failed: d.failed,
      }))
    : [];

  // Map campaign performance with human-readable names
  const campaignChartData = analytics?.campaignPerformance
    ? analytics.campaignPerformance.map((c) => {
        const nameMap: Record<string, string> = {
          BROADCAST: 'Broadcast',
          ABANDONED_CART: 'Abandoned Cart',
          COD_CONFIRMATION: 'COD Confirmation',
          RFM_SEGMENT: 'RFM Campaign',
          CUSTOM: 'Custom',
        };
        return {
          name: nameMap[c.type] || c.type,
          sent: c.sent,
          revenue: c.revenue,
        };
      })
    : [];

  const handleRefresh = () => {
    setIsRefreshing(true);
    refetch().finally(() => setIsRefreshing(false));
  };

  const handleQuickAction = (action: string) => {
    if (action === 'rfm') {
      alert('RFM Analysis triggered! This will analyze and re-segment all subscribers.');
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Monitor your SMS marketing performance</p>
        </div>
        <div className="flex items-center gap-3 w-fit">
          {lastUpdatedAt && !isLoading && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3" />
              Last updated {lastUpdatedAt}
            </span>
          )}
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="gap-2"
          >
            <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* ── Error Banner ─────────────────────────────────────────── */}
      {isError && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">
              Failed to load dashboard data. Click to retry.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50 shrink-0"
          >
            <RefreshCw className="size-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      )}

      {/* ── KPI Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading || !analytics ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            {/* Total Subscribers */}
            <Card className="gap-4 py-5 shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Subscribers</p>
                  <p className="text-2xl font-bold tracking-tight text-foreground">
                    {fmt(analytics.totalSubscribers)}
                  </p>
                  <div className="flex items-center gap-1">
                    {analytics.subscribersGrowthPercent >= 0 ? (
                      <ArrowUpRight className="size-3.5 text-emerald-500" />
                    ) : (
                      <ArrowDownRight className="size-3.5 text-red-500" />
                    )}
                    <span
                      className={`text-xs font-medium ${
                        analytics.subscribersGrowthPercent >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {Math.abs(analytics.subscribersGrowthPercent)}%
                    </span>
                    <span className="text-xs text-muted-foreground">from last month</span>
                  </div>
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <Users className="size-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </CardContent>
            </Card>

            {/* SMS Sent (30d) */}
            <Card className="gap-4 py-5 shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">SMS Sent (30d)</p>
                  <p className="text-2xl font-bold tracking-tight text-foreground">
                    {fmt(analytics.smsSentLast30Days)}
                  </p>
                  <div className="flex items-center gap-1">
                    {analytics.smsSentGrowthPercent >= 0 ? (
                      <ArrowUpRight className="size-3.5 text-emerald-500" />
                    ) : (
                      <ArrowDownRight className="size-3.5 text-red-500" />
                    )}
                    <span
                      className={`text-xs font-medium ${
                        analytics.smsSentGrowthPercent >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {Math.abs(analytics.smsSentGrowthPercent)}%
                    </span>
                    <span className="text-xs text-muted-foreground">from last month</span>
                  </div>
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30">
                  <Send className="size-5 text-teal-600 dark:text-teal-400" />
                </div>
              </CardContent>
            </Card>

            {/* Conversion Rate */}
            <Card className="gap-4 py-5 shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
                  <p className="text-2xl font-bold tracking-tight text-foreground">
                    {analytics.conversionRate}%
                  </p>
                  <div className="flex items-center gap-1">
                    {analytics.conversionGrowthPercent >= 0 ? (
                      <ArrowUpRight className="size-3.5 text-emerald-500" />
                    ) : (
                      <ArrowDownRight className="size-3.5 text-red-500" />
                    )}
                    <span
                      className={`text-xs font-medium ${
                        analytics.conversionGrowthPercent >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {Math.abs(analytics.conversionGrowthPercent)}%
                    </span>
                    <span className="text-xs text-muted-foreground">from last month</span>
                  </div>
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <TrendingUp className="size-5 text-amber-600 dark:text-amber-400" />
                </div>
              </CardContent>
            </Card>

            {/* Revenue Generated */}
            <Card className="gap-4 py-5 shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Revenue Generated</p>
                  <p className="text-2xl font-bold tracking-tight text-foreground">
                    EGP {fmt(analytics.revenueGenerated)}
                  </p>
                  <div className="flex items-center gap-1">
                    {analytics.revenueGrowthPercent >= 0 ? (
                      <ArrowUpRight className="size-3.5 text-emerald-500" />
                    ) : (
                      <ArrowDownRight className="size-3.5 text-red-500" />
                    )}
                    <span
                      className={`text-xs font-medium ${
                        analytics.revenueGrowthPercent >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {Math.abs(analytics.revenueGrowthPercent)}%
                    </span>
                    <span className="text-xs text-muted-foreground">from last month</span>
                  </div>
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <DollarSign className="size-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── Charts Section ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* SMS Delivery Overview */}
        {isLoading || !analytics ? (
          <ChartSkeleton />
        ) : (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">SMS Delivery Overview</CardTitle>
              <CardDescription>Sent vs delivered vs failed — last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={deliveryChartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sentGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-foreground)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--color-foreground)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="deliveredGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="failedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-destructive)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--color-destructive)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                    />
                    <Tooltip content={<DeliveryTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="sent"
                      stroke="var(--color-foreground)"
                      strokeWidth={2}
                      fill="url(#sentGradient)"
                      name="Sent"
                    />
                    <Area
                      type="monotone"
                      dataKey="delivered"
                      stroke="var(--color-chart-2)"
                      strokeWidth={2}
                      fill="url(#deliveredGradient)"
                      name="Delivered"
                    />
                    <Area
                      type="monotone"
                      dataKey="failed"
                      stroke="var(--color-destructive)"
                      strokeWidth={2}
                      fill="url(#failedGradient)"
                      name="Failed"
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '12px' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campaign Performance */}
        {isLoading || !analytics ? (
          <ChartSkeleton />
        ) : (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Campaign Performance</CardTitle>
              <CardDescription>Messages sent and revenue by campaign type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={campaignChartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sentBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={1} />
                        <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0.7} />
                      </linearGradient>
                      <linearGradient id="revenueBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={1} />
                        <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                    />
                    <Tooltip content={<CampaignTooltip />} />
                    <Bar dataKey="sent" fill="url(#sentBar)" radius={[4, 4, 0, 0]} name="Sent" />
                    <Bar dataKey="revenue" fill="url(#revenueBar)" radius={[4, 4, 0, 0]} name="Revenue" />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '12px' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Cart Abandonment Card ─────────────────────────────────── */}
      {isLoading || !analytics ? (
        <CartAbandonmentSkeleton />
      ) : (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Cart Abandonment Recovery</CardTitle>
            <CardDescription>
              Track abandoned carts and recovery performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Abandoned</p>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {fmt(analytics.cartAbandonment.totalAbandoned)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Recovered</p>
                <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {fmt(analytics.cartAbandonment.recovered)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Recovery Rate</p>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {analytics.cartAbandonment.recoveryRate}%
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Revenue Recovered</p>
                <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  EGP {fmt(analytics.cartAbandonment.totalRevenueRecovered)}
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Recovery progress</span>
                <span className="font-medium text-foreground">
                  {analytics.cartAbandonment.recoveryRate}%
                </span>
              </div>
              <Progress
                value={Math.min(analytics.cartAbandonment.recoveryRate, 100)}
                className="h-2.5"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Recent Activity + Quick Actions ──────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        {isLoading || !analytics ? (
          <ActivityFeedSkeleton />
        ) : (
          <Card className="shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
              <CardDescription>Latest events across your SMS operations</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              <ScrollArea className="h-[380px] px-6">
                <div className="space-y-0">
                  {analytics.recentActivity.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Zap className="size-8 mb-2 opacity-50" />
                      <p className="text-sm">No recent activity</p>
                    </div>
                  ) : (
                    analytics.recentActivity.map((item, index) => (
                      <div key={item.id}>
                        <div className="flex items-start gap-3 py-3">
                          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                            {activityIcon(item.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground leading-snug">
                              {item.description}
                            </p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {timeAgo(item.timestamp)}
                              </span>
                              <StatusBadge status={statusVariant(item.status)} />
                            </div>
                          </div>
                        </div>
                        {index < analytics.recentActivity.length - 1 && <Separator />}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            <CardDescription>Common tasks at your fingertips</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    if (action.action) {
                      handleQuickAction(action.action);
                    } else if (action.href) {
                      router.push(action.href);
                    }
                  }}
                  className={`group flex flex-col items-center gap-2 rounded-xl p-4 text-center transition-all ${action.bg} ${action.hoverBg} hover:shadow-sm`}
                >
                  <span className={action.textColor}>{action.icon}</span>
                  <span className="text-xs font-medium text-foreground">{action.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
