'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useInView } from 'framer-motion';
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
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useDashboardAnalytics } from '@/hooks/use-queries';

// ── Types ──────────────────────────────────────────────────────────────

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

function formatDay(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function animateNumber(from: number, to: number, duration: number, onUpdate: (val: number) => void) {
  const start = performance.now();
  const step = (timestamp: number) => {
    const progress = Math.min((timestamp - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    onUpdate(Math.floor(from + (to - from) * eased));
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── Animated Number Component ──────────────────────────────────────────

function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });

  useEffect(() => {
    if (inView) {
      animateNumber(0, value, 1200, setDisplay);
    }
  }, [inView, value]);

  return (
    <span ref={ref} className="count-up">
      {prefix}{fmt(display)}{suffix}
    </span>
  );
}

// ── Activity Icon ──────────────────────────────────────────────────────

function activityIcon(type: string) {
  switch (type) {
    case 'sms_sent':
      return <Send className="size-3.5 text-emerald-500" />;
    case 'subscriber_added':
      return <UserPlus className="size-3.5 text-sky-500" />;
    case 'campaign_created':
      return <Megaphone className="size-3.5 text-amber-500" />;
    case 'order_recovered':
      return <ShoppingCart className="size-3.5 text-teal-500" />;
    default:
      return <AlertCircle className="size-3.5 text-muted-foreground" />;
  }
}

function statusVariant(status: string): 'success' | 'failed' | 'pending' {
  const s = status.toLowerCase();
  if (['delivered', 'active', 'recovered', 'completed', 'sent'].includes(s)) return 'success';
  if (['failed', 'bounced', 'rejected'].includes(s)) return 'failed';
  return 'pending';
}

// ── Quick Actions ──────────────────────────────────────────────────────

const quickActions = [
  {
    label: 'New Campaign',
    href: '/campaigns/new',
    icon: <Megaphone className="size-4" />,
    color: 'emerald',
  },
  {
    label: 'Subscribers',
    href: '/subscribers',
    icon: <Users className="size-4" />,
    color: 'sky',
  },
  {
    label: 'RFM Analysis',
    href: '/rfm',
    icon: <BarChart3 className="size-4" />,
    color: 'amber',
  },
  {
    label: 'Gateways',
    href: '/settings',
    icon: <Shield className="size-4" />,
    color: 'rose',
  },
];

const colorMap: Record<string, { bg: string; text: string; hover: string; ring: string }> = {
  emerald: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    hover: 'hover:bg-emerald-500/15',
    ring: 'ring-emerald-500/20',
  },
  sky: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-600 dark:text-sky-400',
    hover: 'hover:bg-sky-500/15',
    ring: 'ring-sky-500/20',
  },
  amber: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    hover: 'hover:bg-amber-500/15',
    ring: 'ring-amber-500/20',
  },
  rose: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-600 dark:text-rose-400',
    hover: 'hover:bg-rose-500/15',
    ring: 'ring-rose-500/20',
  },
};

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
    <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl p-3 shadow-lg">
      <p className="mb-2 text-xs font-semibold text-foreground">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
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
    <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl p-3 shadow-lg">
      <p className="mb-2 text-xs font-semibold text-foreground">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
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

// ── Skeletons ──────────────────────────────────────────────────────────

function BentoSkeleton({ className }: { className?: string }) {
  return (
    <div className={`bento-panel p-5 ${className}`}>
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-7 w-32 mb-2" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="bento-panel p-5 lg:col-span-2">
      <Skeleton className="h-3 w-28 mb-4" />
      <Skeleton className="h-[260px] w-full rounded-lg" />
    </div>
  );
}

// ── Page Component ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, isError, refetch, dataUpdatedAt } =
    useDashboardAnalytics('demo-shop-1');

  const analytics = data as unknown as AnalyticsData | undefined;

  const lastUpdatedAt = dataUpdatedAt > 0
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null;

  const deliveryChartData = analytics?.dailySmsData
    ? analytics.dailySmsData.map((d) => ({
        day: formatDay(d.date),
        sent: d.sent,
        delivered: d.delivered,
        failed: d.failed,
      }))
    : [];

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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
    },
  };

  return (
    <div className="relative space-y-6">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-[0.4]" />
        <div className="bg-radial-glow absolute inset-0" />
      </div>

      {/* ── Page Header ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <Sparkles className="size-4 text-amber-500 float" />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your SMS marketing command center
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdatedAt && !isLoading && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3" />
              Updated {lastUpdatedAt}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="gap-1.5 h-8 text-xs"
          >
            <RefreshCw className={`size-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </Button>
        </div>
      </motion.div>

      {/* ── Error Banner ─────────────────────────────────────────── */}
      {isError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 rounded-xl border border-red-200/50 bg-red-500/5 px-4 py-3 dark:border-red-900/30 dark:bg-red-500/5"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-600 dark:text-red-400">
              Failed to load data. Click to retry.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-red-300/50 text-red-600 hover:bg-red-500/10 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-500/10 shrink-0 h-7 text-xs"
          >
            <RefreshCw className="size-3 mr-1" />
            Retry
          </Button>
        </motion.div>
      )}

      {/* ── Bento Grid ───────────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate={isLoading ? 'hidden' : 'visible'}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        {isLoading || !analytics ? (
          <>
            <BentoSkeleton />
            <BentoSkeleton />
            <BentoSkeleton />
            <BentoSkeleton />
          </>
        ) : (
          <>
            {/* KPI 1: Subscribers */}
            <motion.div
              variants={itemVariants}
              className="group bento-panel relative overflow-hidden p-5"
            >
              <div className="absolute right-0 top-0 size-24 -translate-y-6 translate-x-6 rounded-full bg-emerald-500/5 blur-xl transition-all group-hover:size-32" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="metric-label">Total Subscribers</span>
                  <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 transition-transform group-hover:scale-110 group-hover:bg-emerald-500/15">
                    <Users className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <p className="metric-value mt-2 text-foreground">
                  <AnimatedNumber value={analytics.totalSubscribers} />
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  {analytics.subscribersGrowthPercent >= 0 ? (
                    <ArrowUpRight className="size-3 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="size-3 text-red-500" />
                  )}
                  <span
                    className={`text-xs font-semibold ${
                      analytics.subscribersGrowthPercent >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {Math.abs(analytics.subscribersGrowthPercent)}%
                  </span>
                  <span className="text-xs text-muted-foreground">vs last month</span>
                </div>
              </div>
            </motion.div>

            {/* KPI 2: SMS Sent */}
            <motion.div
              variants={itemVariants}
              className="group bento-panel relative overflow-hidden p-5"
            >
              <div className="absolute right-0 top-0 size-24 -translate-y-6 translate-x-6 rounded-full bg-sky-500/5 blur-xl transition-all group-hover:size-32" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="metric-label">SMS Sent (30d)</span>
                  <div className="flex size-8 items-center justify-center rounded-lg bg-sky-500/10 transition-transform group-hover:scale-110 group-hover:bg-sky-500/15">
                    <Send className="size-3.5 text-sky-600 dark:text-sky-400" />
                  </div>
                </div>
                <p className="metric-value mt-2 text-foreground">
                  <AnimatedNumber value={analytics.smsSentLast30Days} />
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  {analytics.smsSentGrowthPercent >= 0 ? (
                    <ArrowUpRight className="size-3 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="size-3 text-red-500" />
                  )}
                  <span
                    className={`text-xs font-semibold ${
                      analytics.smsSentGrowthPercent >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {Math.abs(analytics.smsSentGrowthPercent)}%
                  </span>
                  <span className="text-xs text-muted-foreground">vs last month</span>
                </div>
              </div>
            </motion.div>

            {/* KPI 3: Conversion Rate */}
            <motion.div
              variants={itemVariants}
              className="group bento-panel relative overflow-hidden p-5"
            >
              <div className="absolute right-0 top-0 size-24 -translate-y-6 translate-x-6 rounded-full bg-amber-500/5 blur-xl transition-all group-hover:size-32" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="metric-label">Conversion Rate</span>
                  <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 transition-transform group-hover:scale-110 group-hover:bg-amber-500/15">
                    <TrendingUp className="size-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                <p className="metric-value mt-2 text-foreground">
                  <AnimatedNumber value={analytics.conversionRate} suffix="%" />
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  {analytics.conversionGrowthPercent >= 0 ? (
                    <ArrowUpRight className="size-3 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="size-3 text-red-500" />
                  )}
                  <span
                    className={`text-xs font-semibold ${
                      analytics.conversionGrowthPercent >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {Math.abs(analytics.conversionGrowthPercent)}%
                  </span>
                  <span className="text-xs text-muted-foreground">vs last month</span>
                </div>
              </div>
            </motion.div>

            {/* KPI 4: Revenue */}
            <motion.div
              variants={itemVariants}
              className="group bento-panel relative overflow-hidden p-5"
            >
              <div className="absolute right-0 top-0 size-24 -translate-y-6 translate-x-6 rounded-full bg-primary/5 blur-xl transition-all group-hover:size-32" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="metric-label">Revenue Generated</span>
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 transition-transform group-hover:scale-110 group-hover:bg-primary/15">
                    <DollarSign className="size-3.5 text-primary" />
                  </div>
                </div>
                <p className="metric-value mt-2 text-foreground">
                  <AnimatedNumber value={analytics.revenueGenerated} prefix="EGP " />
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  {analytics.revenueGrowthPercent >= 0 ? (
                    <ArrowUpRight className="size-3 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="size-3 text-red-500" />
                  )}
                  <span
                    className={`text-xs font-semibold ${
                      analytics.revenueGrowthPercent >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {Math.abs(analytics.revenueGrowthPercent)}%
                  </span>
                  <span className="text-xs text-muted-foreground">vs last month</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* ── Charts Row ───────────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate={isLoading ? 'hidden' : 'visible'}
        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        {isLoading || !analytics ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            {/* SMS Delivery Overview */}
            <motion.div variants={itemVariants} className="bento-panel p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="section-label">Delivery</p>
                  <h3 className="mt-0.5 text-sm font-semibold text-foreground">SMS Delivery Overview</h3>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-foreground/60" />
                    Sent
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500/70" />
                    Delivered
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-destructive/60" />
                    Failed
                  </span>
                </div>
              </div>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={deliveryChartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sentGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-foreground)" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="var(--color-foreground)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="deliveredGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.6 0.18 145)" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="oklch(0.6 0.18 145)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="failedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-destructive)" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="var(--color-destructive)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                      tickLine={false}
                      axisLine={{ stroke: 'oklch(from var(--border) l c h / 0.5)' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
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
                      animationDuration={1200}
                    />
                    <Area
                      type="monotone"
                      dataKey="delivered"
                      stroke="oklch(0.6 0.18 145)"
                      strokeWidth={2}
                      fill="url(#deliveredGradient)"
                      name="Delivered"
                      animationDuration={1200}
                    />
                    <Area
                      type="monotone"
                      dataKey="failed"
                      stroke="var(--color-destructive)"
                      strokeWidth={1.5}
                      fill="url(#failedGradient)"
                      name="Failed"
                      animationDuration={1200}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Campaign Performance */}
            <motion.div variants={itemVariants} className="bento-panel p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="section-label">Performance</p>
                  <h3 className="mt-0.5 text-sm font-semibold text-foreground">Campaign Performance</h3>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-primary/70" />
                    Sent
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-amber-500/70" />
                    Revenue
                  </span>
                </div>
              </div>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={campaignChartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      className="text-muted-foreground"
                      tickLine={false}
                      axisLine={{ stroke: 'oklch(from var(--border) l c h / 0.5)' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                    />
                    <Tooltip content={<CampaignTooltip />} />
                    <Bar
                      dataKey="sent"
                      fill="oklch(0.65 0.18 145 / 0.8)"
                      radius={[6, 6, 0, 0]}
                      name="Sent"
                      animationDuration={1000}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="oklch(0.80 0.15 75 / 0.7)"
                      radius={[6, 6, 0, 0]}
                      name="Revenue"
                      animationDuration={1000}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* ── Cart Abandonment ─────────────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate={isLoading ? 'hidden' : 'visible'}
      >
        {isLoading || !analytics ? (
          <div className="bento-panel p-5">
            <Skeleton className="h-3 w-28 mb-4" />
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
            <Skeleton className="h-2 w-full rounded-full mt-4" />
          </div>
        ) : (
          <div className="bento-panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="section-label">Recovery</p>
                <h3 className="mt-0.5 text-sm font-semibold text-foreground">Cart Abandonment Recovery</h3>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-xs"
              >
                <span className="pulse-dot mr-1 size-1.5 rounded-full bg-emerald-500" />
                Active
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
              <div>
                <p className="metric-label">Total Abandoned</p>
                <p className="metric-value mt-1 text-foreground">
                  <AnimatedNumber value={analytics.cartAbandonment.totalAbandoned} />
                </p>
              </div>
              <div>
                <p className="metric-label">Recovered</p>
                <p className="metric-value mt-1 text-emerald-600 dark:text-emerald-400">
                  <AnimatedNumber value={analytics.cartAbandonment.recovered} />
                </p>
              </div>
              <div>
                <p className="metric-label">Recovery Rate</p>
                <p className="metric-value mt-1 text-foreground">
                  {analytics.cartAbandonment.recoveryRate}%
                </p>
              </div>
              <div>
                <p className="metric-label">Revenue Recovered</p>
                <p className="metric-value mt-1 text-emerald-600 dark:text-emerald-400">
                  <AnimatedNumber value={analytics.cartAbandonment.totalRevenueRecovered} prefix="EGP " />
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Recovery progress</span>
                <span className="font-semibold text-foreground">{analytics.cartAbandonment.recoveryRate}%</span>
              </div>
              <Progress
                value={Math.min(analytics.cartAbandonment.recoveryRate, 100)}
                className="h-2"
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Activity + Quick Actions ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent Activity */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate={isLoading ? 'hidden' : 'visible'}
          className="bento-panel lg:col-span-2"
        >
          {isLoading || !analytics ? (
            <div className="p-5">
              <Skeleton className="h-3 w-24 mb-4" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 py-3">
                  <Skeleton className="size-7 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-full max-w-sm" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="section-label">Feed</p>
                  <h3 className="mt-0.5 text-sm font-semibold text-foreground">Recent Activity</h3>
                </div>
                {analytics.recentActivity.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {analytics.recentActivity.length} events
                  </span>
                )}
              </div>
              <ScrollArea className="h-[320px]">
                <div className="space-y-0 pr-4">
                  {analytics.recentActivity.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Zap className="size-10 mb-3 opacity-30" />
                      <p className="text-sm">No recent activity</p>
                      <p className="text-xs mt-1 text-muted-foreground/60">
                        Events will appear here as they happen
                      </p>
                    </div>
                  ) : (
                    analytics.recentActivity.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.04, duration: 0.3 }}
                      >
                        <div className="group flex items-start gap-3 rounded-lg p-2 -mx-2 transition-colors hover:bg-muted/50">
                          <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/80 transition-colors group-hover:bg-muted">
                            {activityIcon(item.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground leading-snug line-clamp-2">
                              {item.description}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-xs text-muted-foreground/70">
                                {timeAgo(item.timestamp)}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 h-4 ${
                                  statusVariant(item.status) === 'success'
                                    ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                    : statusVariant(item.status) === 'failed'
                                    ? 'border-red-500/30 text-red-600 dark:text-red-400'
                                    : 'border-amber-500/30 text-amber-600 dark:text-amber-400'
                                }`}
                              >
                                {item.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        {index < analytics.recentActivity.length - 1 && (
                          <Separator className="mx-2 opacity-50" />
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate={isLoading ? 'hidden' : 'visible'}
          className="bento-panel"
        >
          <div className="p-5">
            <div className="mb-3">
              <p className="section-label">Actions</p>
              <h3 className="mt-0.5 text-sm font-semibold text-foreground">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {quickActions.map((action, i) => {
                const colors = colorMap[action.color];
                return (
                  <motion.button
                    key={action.label}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06, duration: 0.3 }}
                    onClick={() => router.push(action.href)}
                    className={`group flex flex-col items-center gap-2 rounded-xl p-3.5 text-center transition-all ${colors.bg} ${colors.hover} hover:shadow-sm hover:scale-[1.02] active:scale-[0.98]`}
                  >
                    <span className={`${colors.text} transition-transform group-hover:scale-110`}>
                      {action.icon}
                    </span>
                    <span className="text-xs font-medium text-foreground">{action.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <Separator className="opacity-50" />

          <div className="p-5">
            <Link
              href="/campaigns/new"
              className="group flex items-center justify-between rounded-xl bg-primary/5 p-3 transition-all hover:bg-primary/10 hover:shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 transition-transform group-hover:scale-110">
                  <Megaphone className="size-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Launch Campaign</p>
                  <p className="text-[10px] text-muted-foreground">Create and send a new SMS blast</p>
                </div>
              </div>
              <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
