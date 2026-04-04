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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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

interface RFMSegment {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  colorBg: string;
  colorText: string;
  subscriberCount: number;
  avgOrderValue: number;
  totalRevenue: number;
  percentage: number;
  description: string;
}

interface RFMSubscriber {
  id: string;
  phone: string;
  name: string;
  rScore: number;
  fScore: number;
  mScore: number;
  composite: number;
  lastOrder: string;
  revenue: number;
  segmentId: string;
}

const segments: RFMSegment[] = [
  {
    id: 'champion',
    name: 'Champion',
    icon: Crown,
    color: '#10b981',
    colorBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    colorText: 'text-emerald-700 dark:text-emerald-400',
    subscriberCount: 2150,
    avgOrderValue: 847,
    totalRevenue: 1821505,
    percentage: 5.1,
    description: 'Bought recently, buy often, and spend the most!',
  },
  {
    id: 'loyal',
    name: 'Loyal',
    icon: Heart,
    color: '#14b8a6',
    colorBg: 'bg-teal-100 dark:bg-teal-900/30',
    colorText: 'text-teal-700 dark:text-teal-400',
    subscriberCount: 3420,
    avgOrderValue: 623,
    totalRevenue: 2130660,
    percentage: 8.0,
    description: 'Spend good money with us often. Responsive to promotions.',
  },
  {
    id: 'potential_loyalists',
    name: 'Potential Loyalist',
    icon: TrendingUp,
    color: '#06b6d4',
    colorBg: 'bg-cyan-100 dark:bg-cyan-900/30',
    colorText: 'text-cyan-700 dark:text-cyan-400',
    subscriberCount: 5680,
    avgOrderValue: 415,
    totalRevenue: 2357200,
    percentage: 13.3,
    description: 'Recent customers, but have spent a good amount.',
  },
  {
    id: 'new_customers',
    name: 'New Customer',
    icon: Star,
    color: '#8b5cf6',
    colorBg: 'bg-violet-100 dark:bg-violet-900/30',
    colorText: 'text-violet-700 dark:text-violet-400',
    subscriberCount: 8900,
    avgOrderValue: 289,
    totalRevenue: 2572100,
    percentage: 20.9,
    description: 'First purchases within last 30 days. Nurture them!',
  },
  {
    id: 'promising',
    name: 'Promising',
    icon: Sparkles,
    color: '#f59e0b',
    colorBg: 'bg-amber-100 dark:bg-amber-900/30',
    colorText: 'text-amber-700 dark:text-amber-400',
    subscriberCount: 4200,
    avgOrderValue: 198,
    totalRevenue: 831600,
    percentage: 9.9,
    description: 'Recent shoppers, but haven\'t spent much yet.',
  },
  {
    id: 'need_attention',
    name: 'Need Attention',
    icon: AlertTriangle,
    color: '#f97316',
    colorBg: 'bg-orange-100 dark:bg-orange-900/30',
    colorText: 'text-orange-700 dark:text-orange-400',
    subscriberCount: 3100,
    avgOrderValue: 342,
    totalRevenue: 1060200,
    percentage: 7.3,
    description: 'Above average recency, frequency & monetary values.',
  },
  {
    id: 'at_risk',
    name: 'At Risk',
    icon: UserX,
    color: '#ef4444',
    colorBg: 'bg-red-100 dark:bg-red-900/30',
    colorText: 'text-red-700 dark:text-red-400',
    subscriberCount: 2840,
    avgOrderValue: 456,
    totalRevenue: 1295040,
    percentage: 6.7,
    description: 'Spent big money and purchased often, but long time ago.',
  },
  {
    id: 'cant_lose',
    name: "Can't Lose",
    icon: ShieldCheck,
    color: '#dc2626',
    colorBg: 'bg-red-100 dark:bg-red-900/30',
    colorText: 'text-red-700 dark:text-red-400',
    subscriberCount: 890,
    avgOrderValue: 1124,
    totalRevenue: 1000360,
    percentage: 2.1,
    description: 'Made biggest purchases and often, but haven\'t returned lately.',
  },
  {
    id: 'hibernating',
    name: 'Hibernating',
    icon: Moon,
    color: '#6b7280',
    colorBg: 'bg-gray-100 dark:bg-gray-800',
    colorText: 'text-gray-700 dark:text-gray-400',
    subscriberCount: 5200,
    avgOrderValue: 176,
    totalRevenue: 915200,
    percentage: 12.2,
    description: 'Last purchase was long ago. Low spenders and low frequency.',
  },
  {
    id: 'lost',
    name: 'Lost',
    icon: Ghost,
    color: '#4b5563',
    colorBg: 'bg-gray-100 dark:bg-gray-800',
    colorText: 'text-gray-600 dark:text-gray-500',
    subscriberCount: 3780,
    avgOrderValue: 124,
    totalRevenue: 468720,
    percentage: 8.9,
    description: 'Lowest recency, frequency and monetary scores.',
  },
  {
    id: 'price_sensitive',
    name: 'Price Sensitive',
    icon: Tag,
    color: '#ec4899',
    colorBg: 'bg-pink-100 dark:bg-pink-900/30',
    colorText: 'text-pink-700 dark:text-pink-400',
    subscriberCount: 2400,
    avgOrderValue: 156,
    totalRevenue: 374400,
    percentage: 5.6,
    description: 'Only buy with discounts. Respond well to offers.',
  },
];

function generateSubscribers(segmentId: string, count: number): RFMSubscriber[] {
  const seg = segments.find((s) => s.id === segmentId);
  if (!seg) return [];

  const names = [
    'Ahmed Hassan', 'Fatima Ali', 'Mohamed Ibrahim', 'Sara Mahmoud', 'Omar Khalil',
    'Layla Youssef', 'Karim Mansour', 'Nour El-Din', 'Hana Tarek', 'Youssef Adel',
    'Amira Fathy', 'Hussein Salem', 'Mona Reda', 'Tariq Mostafa', 'Dina Shawky',
    'Khaled Abdel', 'Rania Samir', 'Bassam Nabil', 'Heba Zakaria', 'Wael Ismail',
  ];

  const phonePrefixes = ['+20 10', '+20 11', '+20 12', '+20 15'];
  const subscribers: RFMSubscriber[] = [];

  for (let i = 0; i < count; i++) {
    const prefix = phonePrefixes[Math.floor(Math.random() * phonePrefixes.length)];
    const number = Math.floor(10000000 + Math.random() * 90000000);
    const maskedPhone = `${prefix.slice(0, 7)}****${number.toString().slice(-2)}`;

    let rBase: number, fBase: number, mBase: number;
    switch (segmentId) {
      case 'champion': rBase = 5; fBase = 5; mBase = 5; break;
      case 'loyal': rBase = 4; fBase = 4; mBase = 4; break;
      case 'potential_loyalists': rBase = 4; fBase = 3; mBase = 3; break;
      case 'new_customers': rBase = 5; fBase = 1; mBase = 1; break;
      case 'promising': rBase = 4; fBase = 1; mBase = 2; break;
      case 'need_attention': rBase = 3; fBase = 3; mBase = 3; break;
      case 'at_risk': rBase = 2; fBase = 3; mBase = 4; break;
      case 'cant_lose': rBase = 1; fBase = 5; mBase = 5; break;
      case 'hibernating': rBase = 2; fBase = 1; mBase = 2; break;
      case 'lost': rBase = 1; fBase = 1; mBase = 1; break;
      case 'price_sensitive': rBase = 3; fBase = 2; mBase = 1; break;
      default: rBase = 3; fBase = 3; mBase = 3;
    }

    const r = Math.min(5, Math.max(1, rBase + (Math.random() > 0.5 ? 1 : 0)));
    const f = Math.min(5, Math.max(1, fBase + (Math.random() > 0.5 ? 1 : 0)));
    const m = Math.min(5, Math.max(1, mBase + (Math.random() > 0.5 ? 1 : 0)));

    const daysAgo = segmentId === 'champion' || segmentId === 'new_customers'
      ? Math.floor(Math.random() * 14) + 1
      : segmentId === 'lost' || segmentId === 'hibernating'
      ? Math.floor(Math.random() * 180) + 90
      : Math.floor(Math.random() * 60) + 7;

    const lastOrderDate = new Date();
    lastOrderDate.setDate(lastOrderDate.getDate() - daysAgo);

    const revenueVariation = 0.5 + Math.random();
    const revenue = Math.round(seg.avgOrderValue * revenueVariation);

    subscribers.push({
      id: `${segmentId}-${i}`,
      phone: maskedPhone,
      name: names[i % names.length],
      rScore: r,
      fScore: f,
      mScore: m,
      composite: Math.round((r + f + m) / 3 * 100) / 100,
      lastOrder: lastOrderDate.toISOString().split('T')[0],
      revenue,
      segmentId,
    });
  }

  return subscribers;
}

const ITEMS_PER_PAGE = 8;

const chartConfig = {
  champion: { label: 'Champion', color: '#10b981' },
  loyal: { label: 'Loyal', color: '#14b8a6' },
  potential_loyalists: { label: 'Potential Loyalist', color: '#06b6d4' },
  new_customers: { label: 'New Customer', color: '#8b5cf6' },
  promising: { label: 'Promising', color: '#f59e0b' },
  need_attention: { label: 'Need Attention', color: '#f97316' },
  at_risk: { label: 'At Risk', color: '#ef4444' },
  cant_lose: { label: "Can't Lose", color: '#dc2626' },
  hibernating: { label: 'Hibernating', color: '#6b7280' },
  lost: { label: 'Lost', color: '#4b5563' },
  price_sensitive: { label: 'Price Sensitive', color: '#ec4899' },
};

const heatmapData: Record<string, string> = {
  '5-5': 'champion', '5-4': 'champion', '5-3': 'loyal', '5-2': 'potential_loyalists', '5-1': 'new_customers',
  '4-5': 'loyal', '4-4': 'loyal', '4-3': 'potential_loyalists', '4-2': 'promising', '4-1': 'promising',
  '3-5': 'need_attention', '3-4': 'need_attention', '3-3': 'need_attention', '3-2': 'hibernating', '3-1': 'hibernating',
  '2-5': 'at_risk', '2-4': 'at_risk', '2-3': 'hibernating', '2-2': 'lost', '2-1': 'lost',
  '1-5': 'cant_lose', '1-4': 'at_risk', '1-3': 'hibernating', '1-2': 'lost', '1-1': 'lost',
};

export default function RFMPage() {
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const subscribers = useMemo(() => {
    if (!selectedSegment) return [];
    return generateSubscribers(selectedSegment, 20);
  }, [selectedSegment]);

  const paginatedSubscribers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return subscribers.slice(start, start + ITEMS_PER_PAGE);
  }, [subscribers, currentPage]);

  const totalPages = Math.ceil(subscribers.length / ITEMS_PER_PAGE);

  const pieData = segments.map((seg) => ({
    name: seg.id,
    value: seg.subscriberCount,
    fill: seg.color,
  }));

  const totalSubscribers = segments.reduce((sum, s) => sum + s.subscriberCount, 0);
  const totalRevenue = segments.reduce((sum, s) => sum + s.totalRevenue, 0);

  const handleRunAnalysis = () => {
    setIsAnalyzing(true);
    setTimeout(() => setIsAnalyzing(false), 3000);
  };

  const getHeatmapColor = (segId: string): string => {
    const seg = segments.find((s) => s.id === segId);
    return seg?.color ?? '#6b7280';
  };

  const getHeatmapLabel = (segId: string): string => {
    const seg = segments.find((s) => s.id === segId);
    return seg?.name ?? '';
  };

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 max-w-[1400px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">RFM Segments</h1>
          <p className="text-muted-foreground mt-1">
            Recency, Frequency & Monetary analysis of your customers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <RefreshCw className={`size-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
            Last calculated: 2 hours ago
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

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="py-4">
          <CardContent className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Users className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalSubscribers.toLocaleString()}</p>
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
              <p className="text-2xl font-bold">${Math.round(totalRevenue / totalSubscribers)}</p>
              <p className="text-xs text-muted-foreground">Avg. Revenue / Subscriber</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Segment Overview Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="size-5 text-emerald-500" />
          Segment Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.map((segment) => (
            <Card
              key={segment.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md overflow-hidden
                ${selectedSegment === segment.id ? 'ring-2 ring-emerald-500 shadow-md' : 'hover:border-emerald-200 dark:hover:border-emerald-800'}
              `}
              onClick={() => {
                setSelectedSegment(selectedSegment === segment.id ? null : segment.id);
                setCurrentPage(1);
              }}
            >
              <div className="h-1.5" style={{ backgroundColor: segment.color }} />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`size-9 rounded-lg ${segment.colorBg} flex items-center justify-center`}>
                      <segment.icon className={`size-4.5 ${segment.colorText}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{segment.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{segment.description}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{segment.subscriberCount.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">subscribers</span>
                  <Badge variant="outline" className={`ml-auto text-[10px] ${segment.colorBg} ${segment.colorText}`}>
                    {segment.percentage}%
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg. Order</p>
                    <p className="text-sm font-semibold">${segment.avgOrderValue}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Revenue</p>
                    <p className="text-sm font-semibold">${(segment.totalRevenue / 1000).toFixed(0)}k</p>
                  </div>
                </div>

                <Link href={`/campaigns/new?type=${segment.id}`} onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs"
                    style={{ borderColor: segment.color, color: segment.color }}
                  >
                    <Send className="size-3" />
                    Send Campaign
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
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
                            color: r >= 3 || f >= 3 ? '#fff' : '#fff',
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
                {segments.slice(0, 7).map((seg) => (
                  <div key={seg.id} className="flex items-center gap-1.5 text-[10px]">
                    <div className="size-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
                    <span className="text-muted-foreground">{seg.name}</span>
                  </div>
                ))}
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
                  {segments.find((s) => s.id === selectedSegment)?.name} Subscribers
                </CardTitle>
                <CardDescription>
                  {subscribers.length} subscribers in this segment
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-center">R</TableHead>
                  <TableHead className="text-center">F</TableHead>
                  <TableHead className="text-center">M</TableHead>
                  <TableHead className="text-center">Composite</TableHead>
                  <TableHead>Last Order</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSubscribers.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-mono text-xs">{sub.phone}</TableCell>
                    <TableCell className="font-medium">{sub.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={sub.rScore >= 4 ? 'default' : sub.rScore >= 3 ? 'secondary' : 'outline'} className="font-mono text-xs">
                        {sub.rScore}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={sub.fScore >= 4 ? 'default' : sub.fScore >= 3 ? 'secondary' : 'outline'} className="font-mono text-xs">
                        {sub.fScore}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={sub.mScore >= 4 ? 'default' : sub.mScore >= 3 ? 'secondary' : 'outline'} className="font-mono text-xs">
                        {sub.mScore}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono text-xs font-medium">{sub.composite.toFixed(1)}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{sub.lastOrder}</TableCell>
                    <TableCell className="text-right font-medium">${sub.revenue}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, subscribers.length)} of {subscribers.length}
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
