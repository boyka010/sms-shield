'use client';

import { useState } from 'react';
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
  MoreHorizontal,
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

// ── Types ────────────────────────────────────────────────────────────────

interface KpiData {
  label: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

interface ActivityItem {
  id: string;
  icon: React.ReactNode;
  description: string;
  timestamp: string;
  status: 'success' | 'failed' | 'pending';
}

// ── Sample Data ──────────────────────────────────────────────────────────

const kpiCards: KpiData[] = [
  {
    label: 'Total Subscribers',
    value: '12,847',
    change: 12.5,
    icon: <Users className="size-5" />,
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    label: 'SMS Sent (30d)',
    value: '48,293',
    change: 8.3,
    icon: <Send className="size-5" />,
    iconBg: 'bg-teal-100 dark:bg-teal-900/30',
    iconColor: 'text-teal-600 dark:text-teal-400',
  },
  {
    label: 'Conversion Rate',
    value: '24.7%',
    change: 3.2,
    icon: <TrendingUp className="size-5" />,
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    label: 'Revenue Generated',
    value: 'EGP 284,500',
    change: 15.8,
    icon: <DollarSign className="size-5" />,
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
];

const deliveryData = [
  { day: 'Mon', sent: 6200, delivered: 5840, failed: 360 },
  { day: 'Tue', sent: 7100, delivered: 6820, failed: 280 },
  { day: 'Wed', sent: 8400, delivered: 7950, failed: 450 },
  { day: 'Thu', sent: 6800, delivered: 6510, failed: 290 },
  { day: 'Fri', sent: 9200, delivered: 8760, failed: 440 },
  { day: 'Sat', sent: 5600, delivered: 5320, failed: 280 },
  { day: 'Sun', sent: 4993, delivered: 4720, failed: 273 },
];

const campaignData = [
  { name: 'Broadcast', sent: 18400, revenue: 82000 },
  { name: 'Abandoned Cart', sent: 12800, revenue: 124000 },
  { name: 'COD Confirmation', sent: 10300, revenue: 42000 },
  { name: 'RFM Campaign', sent: 6793, revenue: 36500 },
];

const recentActivity: ActivityItem[] = [
  {
    id: '1',
    icon: <Send className="size-4 text-emerald-500" />,
    description: 'Broadcast campaign "Summer Sale" sent to 3,240 subscribers',
    timestamp: '2 minutes ago',
    status: 'success',
  },
  {
    id: '2',
    icon: <ShoppingCart className="size-4 text-teal-500" />,
    description: 'Order #12847 placed via COD confirmation SMS link',
    timestamp: '15 minutes ago',
    status: 'success',
  },
  {
    id: '3',
    icon: <UserPlus className="size-4 text-sky-500" />,
    description: '15 new subscribers added from checkout opt-in',
    timestamp: '32 minutes ago',
    status: 'success',
  },
  {
    id: '4',
    icon: <AlertTriangle className="size-4 text-red-500" />,
    description: 'SMS gateway failover triggered — switched to Victory Link',
    timestamp: '1 hour ago',
    status: 'failed',
  },
  {
    id: '5',
    icon: <Send className="size-4 text-emerald-500" />,
    description: 'RFM Champion campaign delivered to 1,840 customers',
    timestamp: '1 hour ago',
    status: 'success',
  },
  {
    id: '6',
    icon: <ShoppingCart className="size-4 text-teal-500" />,
    description: 'Abandoned cart recovery — Order #12844 converted',
    timestamp: '2 hours ago',
    status: 'success',
  },
  {
    id: '7',
    icon: <UserPlus className="size-4 text-sky-500" />,
    description: '8 subscribers imported via CSV upload',
    timestamp: '3 hours ago',
    status: 'pending',
  },
  {
    id: '8',
    icon: <Send className="size-4 text-emerald-500" />,
    description: 'Price-sensitive segment campaign scheduled for tomorrow',
    timestamp: '4 hours ago',
    status: 'pending',
  },
];

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

// ── Custom Tooltip for Charts ────────────────────────────────────────────

function DeliveryTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
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

function CampaignTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string; dataKey: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="mb-2 text-sm font-semibold text-foreground">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.dataKey === 'sent' ? 'Sent' : 'Revenue (EGP)'}:</span>
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

// ── Status Badge Helper ──────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'success' | 'failed' | 'pending' }) {
  const variants: Record<string, { className: string; label: string }> = {
    success: {
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-transparent',
      label: 'Success',
    },
    failed: {
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-transparent',
      label: 'Failed',
    },
    pending: {
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-transparent',
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

// ── Page Component ───────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  const handleQuickAction = (action: string) => {
    if (action === 'rfm') {
      // Trigger RFM analysis — placeholder for real implementation
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
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="w-fit gap-2"
        >
          <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card
            key={kpi.label}
            className="gap-4 py-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <CardContent className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                <p className="text-2xl font-bold tracking-tight text-foreground">{kpi.value}</p>
                <div className="flex items-center gap-1">
                  {kpi.change >= 0 ? (
                    <ArrowUpRight className="size-3.5 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="size-3.5 text-red-500" />
                  )}
                  <span
                    className={`text-xs font-medium ${
                      kpi.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {Math.abs(kpi.change)}%
                  </span>
                  <span className="text-xs text-muted-foreground">from last month</span>
                </div>
              </div>
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${kpi.iconBg}`}>
                <span className={kpi.iconColor}>{kpi.icon}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Charts Section ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* SMS Delivery Overview */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">SMS Delivery Overview</CardTitle>
            <CardDescription>Sent vs delivered vs failed — last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={deliveryData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
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
                    tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : String(v)}
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

        {/* Campaign Performance */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Campaign Performance</CardTitle>
            <CardDescription>Messages sent and revenue by campaign type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campaignData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
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
                    tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : String(v)}
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
      </div>

      {/* ── Recent Activity + Quick Actions ──────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            <CardDescription>Latest events across your SMS operations</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <ScrollArea className="h-[380px] px-6">
              <div className="space-y-0">
                {recentActivity.map((item, index) => (
                  <div key={item.id}>
                    <div className="flex items-start gap-3 py-3">
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-snug">{item.description}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{item.timestamp}</span>
                          <StatusBadge status={item.status} />
                        </div>
                      </div>
                    </div>
                    {index < recentActivity.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

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
