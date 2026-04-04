'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Play,
  RefreshCw,
  Send,
  Users,
  DollarSign,
  TrendingUp,
  Crown,
  Heart,
  Star,
  Sparkles,
  AlertTriangle,
  UserX,
  Moon,
  Ghost,
  Tag,
  ChevronLeft,
  ChevronRight,
  Phone,
  ShieldCheck,
  BarChart3,
  Target,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import {
  useRFMSegments,
  useTriggerRFMCalculation,
  useSubscribers,
  type RFMSegmentName,
} from '@/hooks/use-queries';

// ---------------------------------------------------------------------------
// Segment visual config — maps API segment names → UI display
// ---------------------------------------------------------------------------

type SegmentKey = string;

interface SegmentVisual {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  colorBg: string;
  colorText: string;
  description: string;
}

const segmentVisuals: Record<SegmentKey, SegmentVisual> = {
  CHAMPION: {
    name: 'Champion',
    icon: Crown,
    color: '#10b981',
    colorBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    colorText: 'text-emerald-700 dark:text-emerald-400',
    description: 'Bought recently, buy often, and spend the most!',
  },
  LOYAL: {
    name: 'Loyal',
    icon: Heart,
    color: '#14b8a6',
    colorBg: 'bg-teal-100 dark:bg-teal-900/30',
    colorText: 'text-teal-700 dark:text-teal-400',
    description: 'Spend good money with us often. Responsive to promotions.',
  },
  POTENTIAL_LOYALIST: {
    name: 'Potential Loyalist',
    icon: TrendingUp,
    color: '#06b6d4',
    colorBg: 'bg-cyan-100 dark:bg-cyan-900/30',
    colorText: 'text-cyan-700 dark:text-cyan-400',
    description: 'Recent customers, but have spent a good amount.',
  },
  NEW_CUSTOMER: {
    name: 'New Customer',
    icon: Star,
    color: '#8b5cf6',
    colorBg: 'bg-violet-100 dark:bg-violet-900/30',
    colorText: 'text-violet-700 dark:text-violet-400',
    description: 'First purchases within last 30 days. Nurture them!',
  },
  PROMISING: {
    name: 'Promising',
    icon: Sparkles,
    color: '#f59e0b',
    colorBg: 'bg-amber-100 dark:bg-amber-900/30',
    colorText: 'text-amber-700 dark:text-amber-400',
    description: "Recent shoppers, but haven't spent much yet.",
  },
  NEED_ATTENTION: {
    name: 'Need Attention',
    icon: AlertTriangle,
    color: '#f97316',
    colorBg: 'bg-orange-100 dark:bg-orange-900/30',
    colorText: 'text-orange-700 dark:text-orange-400',
    description: 'Above average recency, frequency & monetary values.',
  },
  AT_RISK: {
    name: 'At Risk',
    icon: UserX,
    color: '#ef4444',
    colorBg: 'bg-red-100 dark:bg-red-900/30',
    colorText: 'text-red-700 dark:text-red-400',
    description: 'Spent big money and purchased often, but long time ago.',
  },
  CANT_LOSE: {
    name: "Can't Lose",
    icon: ShieldCheck,
    color: '#dc2626',
    colorBg: 'bg-red-100 dark:bg-red-900/30',
    colorText: 'text-red-700 dark:text-red-400',
    description: "Made biggest purchases and often, but haven't returned lately.",
  },
  HIBERNATING: {
    name: 'Hibernating',
    icon: Moon,
    color: '#6b7280',
    colorBg: 'bg-gray-100 dark:bg-gray-800',
    colorText: 'text-gray-700 dark:text-gray-400',
    description: 'Last purchase was long ago. Low spenders and low frequency.',
  },
  LOST: {
    name: 'Lost',
    icon: Ghost,
    color: '#4b5563',
    colorBg: 'bg-gray-100 dark:bg-gray-800',
    colorText: 'text-gray-600 dark:text-gray-500',
    description: 'Lowest recency, frequency and monetary scores.',
  },
  PRICE_SENSITIVE: {
    name: 'Price Sensitive',
    icon: Tag,
    color: '#ec4899',
    colorBg: 'bg-pink-100 dark:bg-pink-900/30',
    colorText: 'text-pink-700 dark:text-pink-400',
    description: 'Only buy with discounts. Respond well to offers.',
  },
};

const chartConfig: Record<string, { label: string; color: string }> = {
  CHAMPION: { label: 'Champion', color: '#10b981' },
  LOYAL: { label: 'Loyal', color: '#14b8a6' },
  POTENTIAL_LOYALIST: { label: 'Potential Loyalist', color: '#06b6d4' },
  NEW_CUSTOMER: { label: 'New Customer', color: '#8b5cf6' },
  PROMISING: { label: 'Promising', color: '#f59e0b' },
  NEED_ATTENTION: { label: 'Need Attention', color: '#f97316' },
  AT_RISK: { label: 'At Risk', color: '#ef4444' },
  CANT_LOSE: { label: "Can't Lose", color: '#dc2626' },
  HIBERNATING: { label: 'Hibernating', color: '#6b7280' },
  LOST: { label: 'Lost', color: '#4b5563' },
  PRICE_SENSITIVE: { label: 'Price Sensitive', color: '#ec4899' },
};

const heatmapData: Record<string, string> = {
  '5-5': 'CHAMPION', '5-4': 'CHAMPION', '5-3': 'LOYAL', '5-2': 'POTENTIAL_LOYALIST', '5-1': 'NEW_CUSTOMER',
  '4-5': 'LOYAL', '4-4': 'LOYAL', '4-3': 'POTENTIAL_LOYALIST', '4-2': 'PROMISING', '4-1': 'PROMISING',
  '3-5': 'NEED_ATTENTION', '3-4': 'NEED_ATTENTION', '3-3': 'NEED_ATTENTION', '3-2': 'HIBERNATING', '3-1': 'HIBERNATING',
  '2-5': 'AT_RISK', '2-4': 'AT_RISK', '2-3': 'HIBERNATING', '2-2': 'LOST', '2-1': 'LOST',
  '1-5': 'CANT_LOSE', '1-4': 'AT_RISK', '1-3': 'HIBERNATING', '1-2': 'LOST', '1-1': 'LOST',
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHOP_ID = 'demo-shop-1';
const ITEMS_PER_PAGE = 8;

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function SegmentCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-1.5 w-full" />
      <CardHeader className="pb-3">
        <div className="flex items-start gap-2.5">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-7 w-20" />
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg p-2.5 space-y-1">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-4 w-14" />
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 space-y-1">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-4 w-14" />
          </div>
        </div>
        <Skeleton className="h-8 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

function StatsRowSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="py-4">
          <CardContent className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-28" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(num: number): string {
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return num.toString();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffHours / 24);
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function getHeatmapColor(segId: string): string {
  return segmentVisuals[segId]?.color ?? '#6b7280';
}

function getHeatmapLabel(segId: string): string {
  return segmentVisuals[segId]?.name ?? '';
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function RFMPage() {
  const [selectedSegment, setSelectedSegment] = useState<SegmentKey | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // RFM data
  const { data: rfmData, isLoading: rfmLoading, error: rfmError, refetch: refetchRFM } = useRFMSegments(SHOP_ID);
  const triggerRFM = useTriggerRFMCalculation();

  // Subscriber detail for selected segment
  const { data: subscriberData, isLoading: subsLoading } = useSubscribers(
    SHOP_ID,
    { segment: selectedSegment ?? undefined },
    currentPage,
    ITEMS_PER_PAGE,
  );

  const segments = rfmData?.segments ?? [];

  // Derived totals
  const totalSubscribers = segments.reduce((sum, s) => sum + s.subscriberCount, 0);
  const totalRevenue = segments.reduce((sum, s) => sum + s.totalRevenue, 0);

  // Pie chart data
  const pieData = segments.map((seg) => ({
    name: seg.segment,
    value: seg.subscriberCount,
    fill: segmentVisuals[seg.segment]?.color ?? '#6b7280',
  }));

  // Subscriber pagination
  const subscribers = subscriberData?.data ?? [];
  const pagination = subscriberData?.pagination;
  const totalPages = pagination?.totalPages ?? 1;

  const handleRunAnalysis = () => {
    triggerRFM.mutate({ shopId: SHOP_ID });
  };

  const handleSegmentClick = (segKey: SegmentKey) => {
    if (selectedSegment === segKey) {
      setSelectedSegment(null);
    } else {
      setSelectedSegment(segKey);
      setCurrentPage(1);
    }
  };

  const isAnalyzing = triggerRFM.isPending;

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 max-w-[1400px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">RFM Segments</h1>
          <p className="text-muted-foreground mt-1">
            Recency, Frequency &amp; Monetary analysis of your customers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <RefreshCw className={`size-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {rfmData?.lastCalculatedAt
              ? `Last calculated: ${formatRelativeTime(rfmData.lastCalculatedAt)}`
              : 'Not yet calculated'}
          </span>
          <Button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Play className="size-4" />
                Run Analysis
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error state */}
      {rfmError && !rfmLoading && segments.length === 0 && (
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="size-16 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
              <AlertCircle className="size-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold">Failed to load RFM data</h3>
            <p className="text-muted-foreground text-center max-w-md">{rfmError.message}</p>
            <Button variant="outline" onClick={() => refetchRFM()}>
              <RefreshCw className="size-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {rfmLoading && segments.length === 0 ? (
        <StatsRowSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="py-4">
            <CardContent className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Users className="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rfmData?.totalSegmentedSubscribers?.toLocaleString() ?? totalSubscribers.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Subscribers</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <DollarSign className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                <BarChart3 className="size-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  ${totalSubscribers > 0 ? Math.round(totalRevenue / totalSubscribers).toLocaleString() : '0'}
                </p>
                <p className="text-xs text-muted-foreground">Avg. Revenue / Subscriber</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Segment Overview Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="size-5 text-emerald-500" />
          Segment Overview
        </h2>
        {rfmLoading && segments.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SegmentCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {segments.map((seg) => {
              const vis = segmentVisuals[seg.segment];
              if (!vis) return null;
              const percentage = totalSubscribers > 0 ? ((seg.subscriberCount / totalSubscribers) * 100).toFixed(1) : '0.0';
              const avgOrderValue = seg.subscriberCount > 0 ? Math.round(seg.totalRevenue / seg.subscriberCount) : 0;

              return (
                <Card
                  key={seg.segment}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md overflow-hidden
                    ${selectedSegment === seg.segment ? 'ring-2 ring-emerald-500 shadow-md' : 'hover:border-emerald-200 dark:hover:border-emerald-800'}
                  `}
                  onClick={() => handleSegmentClick(seg.segment)}
                >
                  <div className="h-1.5" style={{ backgroundColor: vis.color }} />
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`size-9 rounded-lg ${vis.colorBg} flex items-center justify-center`}>
                          <vis.icon className={`size-4.5 ${vis.colorText}`} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{vis.name}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">{vis.description}</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">{seg.subscriberCount.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">subscribers</span>
                      <Badge variant="outline" className={`ml-auto text-[10px] ${vis.colorBg} ${vis.colorText}`}>
                        {percentage}%
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/50 rounded-lg p-2.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg. Order</p>
                        <p className="text-sm font-semibold">${avgOrderValue}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Revenue</p>
                        <p className="text-sm font-semibold">${(seg.totalRevenue / 1000).toFixed(0)}k</p>
                      </div>
                    </div>

                    <Link
                      href={`/campaigns/new?type=${seg.segment.toLowerCase()}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs"
                        style={{ borderColor: vis.color, color: vis.color }}
                      >
                        <Send className="size-3" />
                        Send Campaign
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Segment Distribution</CardTitle>
            <CardDescription>Percentage breakdown of subscribers by RFM segment</CardDescription>
          </CardHeader>
          <CardContent>
            {rfmLoading ? (
              <Skeleton className="mx-auto aspect-square max-h-[350px] w-full" />
            ) : pieData.length > 0 ? (
              <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[350px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    strokeWidth={2}
                    stroke="hsl(var(--background))"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                <BarChart3 className="size-10 mb-2" />
                <p className="text-sm">No segment data available</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={handleRunAnalysis}>
                  Run Analysis
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RFM Heatmap Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">RFM Heatmap</CardTitle>
            <CardDescription>Recency vs Frequency grid showing dominant segments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* Column labels */}
              <div className="flex items-center gap-2">
                <div className="w-20" />
                <div className="flex-1 grid grid-cols-5 gap-1 text-center">
                  {[1, 2, 3, 4, 5].map((f) => (
                    <span key={f} className="text-[10px] text-muted-foreground font-medium">
                      F {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Grid rows (Recency 5 down to 1) */}
              {[5, 4, 3, 2, 1].map((r) => (
                <div key={r} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-medium w-20 text-right">
                    R {r}
                  </span>
                  <div className="flex-1 grid grid-cols-5 gap-1">
                    {[1, 2, 3, 4, 5].map((f) => {
                      const key = `${r}-${f}`;
                      const segId = heatmapData[key];
                      const color = getHeatmapColor(segId);
                      const label = getHeatmapLabel(segId);

                      return (
                        <div
                          key={key}
                          className="aspect-square rounded-md flex items-center justify-center text-[8px] font-semibold cursor-default transition-transform hover:scale-110 hover:z-10 relative"
                          style={{
                            backgroundColor: color,
                            color: '#fff',
                          }}
                          title={`${label} (R${r}, F${f})`}
                        >
                          <span className="truncate px-0.5">{label.split(' ')[0]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-3 border-t">
                {segments.slice(0, 7).map((seg) => {
                  const vis = segmentVisuals[seg.segment];
                  return vis ? (
                    <div key={seg.segment} className="flex items-center gap-1.5 text-[10px]">
                      <div className="size-2.5 rounded-sm" style={{ backgroundColor: vis.color }} />
                      <span className="text-muted-foreground">{vis.name}</span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Segment Details Table */}
      {selectedSegment && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="size-5 text-emerald-500" />
                  {segmentVisuals[selectedSegment]?.name ?? selectedSegment} Subscribers
                </CardTitle>
                <CardDescription>
                  {subsLoading
                    ? 'Loading...'
                    : `${pagination?.total ?? subscribers.length} subscribers in this segment`}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSegment(null)}
              >
                <ChevronLeft className="size-4" />
                Back
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {subsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : subscribers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="size-10 mb-2" />
                <p className="text-sm">No subscribers found in this segment</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-center">Orders</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead>Last Order</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscribers.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-mono text-xs">
                        {sub.maskedPhone ?? sub.rawPhoneNumber}
                      </TableCell>
                      <TableCell className="font-medium">
                        {sub.firstName || sub.lastName
                          ? `${sub.firstName ?? ''} ${sub.lastName ?? ''}`.trim()
                          : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {sub.totalOrdersCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">${sub.totalRevenue}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(sub.lastOrderAt ?? '')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {sub.source}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            {!subsLoading && totalPages > 1 && pagination && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}&ndash;{Math.min(currentPage * ITEMS_PER_PAGE, pagination.total)} of {pagination.total}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={page === currentPage ? 'default' : 'outline'}
                      size="icon"
                      className="size-8"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
