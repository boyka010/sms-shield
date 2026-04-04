'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Send,
  Users,
  CheckCircle2,
  XCircle,
  Eye,
  Copy,
  Trash2,
  Megaphone,
  ShoppingCart,
  Package,
  Clock,
  AlertTriangle,
  MailCheck,
  MailX,
  UserCheck,
  CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';

type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'failed';
type CampaignType = 'broadcast' | 'abandoned_cart' | 'cod_confirmation' | 'rfm_segment' | 'custom';

interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  messagePreview: string;
  recipients: number;
  sent: number;
  delivered: number;
  failed: number;
  scheduledAt?: string;
  createdAt: string;
}

const sampleCampaigns: Campaign[] = [
  {
    id: '1',
    name: 'Ramadan Flash Sale',
    type: 'broadcast',
    status: 'running',
    messagePreview: '🎉 Ramadan Mubarak! Get 30% off all products. Use code RAMADAN30. Limited time offer! Shop now at {{store_name}}',
    recipients: 12500,
    sent: 8750,
    delivered: 8200,
    failed: 550,
    createdAt: '2025-01-15T10:00:00Z',
  },
  {
    id: '2',
    name: 'Cart Recovery - Weekend',
    type: 'abandoned_cart',
    status: 'completed',
    messagePreview: 'Hey {{customer_name}}, you left items in your cart! Complete your purchase now and get free shipping. {{recovery_link}}',
    recipients: 3420,
    sent: 3420,
    delivered: 3280,
    failed: 140,
    createdAt: '2025-01-14T08:00:00Z',
  },
  {
    id: '3',
    name: 'COD Order Confirmation',
    type: 'cod_confirmation',
    status: 'scheduled',
    messagePreview: 'Hi {{customer_name}}, your order #{{order_id}} has been confirmed! Payment on delivery. Track your order here.',
    recipients: 890,
    sent: 0,
    delivered: 0,
    failed: 0,
    scheduledAt: '2025-01-16T09:00:00Z',
    createdAt: '2025-01-15T14:30:00Z',
  },
  {
    id: '4',
    name: 'Loyal Customer VIP Offer',
    type: 'rfm_segment',
    status: 'draft',
    messagePreview: 'Exclusive VIP deal for our best customers! Use code VIP25 for 25% off your next order. Valid until Feb 28th!',
    recipients: 2150,
    sent: 0,
    delivered: 0,
    failed: 0,
    createdAt: '2025-01-15T16:00:00Z',
  },
  {
    id: '5',
    name: 'New Year Collection Launch',
    type: 'broadcast',
    status: 'completed',
    messagePreview: '✨ New Collection Alert! Discover our latest arrivals. First 100 customers get 15% off with code NEWYEAR15!',
    recipients: 18000,
    sent: 18000,
    delivered: 17200,
    failed: 800,
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: '6',
    name: 'Win-Back Inactive Users',
    type: 'custom',
    status: 'failed',
    messagePreview: 'We miss you {{customer_name}}! Here is a special {{discount_code}} for 20% off. Come back and shop today!',
    recipients: 5600,
    sent: 3200,
    delivered: 2800,
    failed: 400,
    createdAt: '2025-01-13T11:00:00Z',
  },
];

function getStatusConfig(status: CampaignStatus) {
  switch (status) {
    case 'draft':
      return { label: 'Draft', className: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' };
    case 'scheduled':
      return { label: 'Scheduled', className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' };
    case 'running':
      return { label: 'Running', className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' };
    case 'completed':
      return { label: 'Completed', className: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800' };
    case 'failed':
      return { label: 'Failed', className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' };
  }
}

function getTypeConfig(type: CampaignType) {
  switch (type) {
    case 'broadcast':
      return { label: 'Broadcast', icon: Megaphone, className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' };
    case 'abandoned_cart':
      return { label: 'Abandoned Cart', icon: ShoppingCart, className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' };
    case 'cod_confirmation':
      return { label: 'COD Confirmation', icon: Package, className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' };
    case 'rfm_segment':
      return { label: 'RFM Segment', icon: UserCheck, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
    case 'custom':
      return { label: 'Custom', icon: MailCheck, className: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' };
  }
}

function formatNumber(num: number): string {
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return num.toString();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const statusConfig = getStatusConfig(campaign.status);
  const typeConfig = getTypeConfig(campaign.type);
  const deliveryPercent = campaign.recipients > 0
    ? Math.round((campaign.delivered / campaign.recipients) * 100)
    : 0;

  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <CardTitle className="text-base truncate">{campaign.name}</CardTitle>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typeConfig.className}`}>
                <typeConfig.icon className="size-3" />
                {typeConfig.label}
              </Badge>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusConfig.className}`}>
                {statusConfig.label}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {campaign.messagePreview}
        </p>

        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <Users className="size-3.5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs font-semibold">{formatNumber(campaign.recipients)}</p>
            <p className="text-[10px] text-muted-foreground">Recipients</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <Send className="size-3.5 mx-auto mb-1 text-amber-500" />
            <p className="text-xs font-semibold">{formatNumber(campaign.sent)}</p>
            <p className="text-[10px] text-muted-foreground">Sent</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <CheckCircle2 className="size-3.5 mx-auto mb-1 text-emerald-500" />
            <p className="text-xs font-semibold">{formatNumber(campaign.delivered)}</p>
            <p className="text-[10px] text-muted-foreground">Delivered</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <XCircle className="size-3.5 mx-auto mb-1 text-red-500" />
            <p className="text-xs font-semibold">{formatNumber(campaign.failed)}</p>
            <p className="text-[10px] text-muted-foreground">Failed</p>
          </div>
        </div>

        {campaign.status !== 'draft' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Delivery progress</span>
              <span className="font-medium text-foreground">{deliveryPercent}%</span>
            </div>
            <Progress value={deliveryPercent} className="h-1.5" />
          </div>
        )}

        {campaign.scheduledAt && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            <span>Scheduled: {formatDate(campaign.scheduledAt)}</span>
          </div>
        )}

        {campaign.status === 'failed' && (
          <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded-md">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>Campaign stopped at 56% due to gateway timeout</span>
          </div>
        )}
      </CardContent>

      <Separator />

      <CardFooter className="py-3 gap-2">
        <Button variant="ghost" size="sm" className="flex-1 text-xs h-8">
          <Eye className="size-3.5" />
          View
        </Button>
        <Button variant="ghost" size="sm" className="flex-1 text-xs h-8">
          <Copy className="size-3.5" />
          Duplicate
        </Button>
        <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="flex-1 text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30">
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{campaign.name}&quot;? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => setIsDeleting(false)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="size-24 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-6">
        <Megaphone className="size-10 text-emerald-500" />
      </div>
      <h3 className="text-xl font-semibold mb-2">No campaigns yet</h3>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Create your first SMS campaign to engage your customers. Choose from broadcast, abandoned cart recovery, or target specific RFM segments.
      </p>
      <Link href="/campaigns/new">
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="size-4" />
          Create your first campaign
        </Button>
      </Link>
    </div>
  );
}

const statusFilters: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

export default function CampaignsPage() {
  const [activeTab, setActiveTab] = useState('all');

  const filteredCampaigns = activeTab === 'all'
    ? sampleCampaigns
    : sampleCampaigns.filter((c) => c.status === activeTab);

  const totalRecipients = sampleCampaigns.reduce((sum, c) => sum + c.recipients, 0);
  const totalSent = sampleCampaigns.reduce((sum, c) => sum + c.sent, 0);
  const totalDelivered = sampleCampaigns.reduce((sum, c) => sum + c.delivered, 0);
  const totalFailed = sampleCampaigns.reduce((sum, c) => sum + c.failed, 0);

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 max-w-[1400px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Manage and track your SMS marketing campaigns
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
            <Plus className="size-4" />
            Create Campaign
          </Button>
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="py-4">
          <CardContent className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Megaphone className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{sampleCampaigns.length}</p>
              <p className="text-xs text-muted-foreground">Total Campaigns</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Users className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatNumber(totalRecipients)}</p>
              <p className="text-xs text-muted-foreground">Total Recipients</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatNumber(totalDelivered)}</p>
              <p className="text-xs text-muted-foreground">Delivered</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle className="size-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatNumber(totalFailed)}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Filters */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          {statusFilters.map((filter) => (
            <TabsTrigger key={filter.value} value={filter.value}>
              {filter.label}
              <span className="ml-1.5 text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-mono">
                {filter.value === 'all'
                  ? sampleCampaigns.length
                  : sampleCampaigns.filter((c) => c.status === filter.value).length
                }
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {statusFilters.map((filter) => (
          <TabsContent key={filter.value} value={filter.value}>
            {filteredCampaigns.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCampaigns.map((campaign) => (
                  <CampaignCard key={campaign.id} campaign={campaign} />
                ))}
              </div>
            ) : (
              <EmptyState />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
