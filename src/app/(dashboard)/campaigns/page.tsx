'use client';

import { useState, useEffect, useCallback } from 'react';
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
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useCampaignStore, type CampaignItemType, type CampaignStatus } from '@/stores/use-campaign-store';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    case 'paused':
      return { label: 'Paused', className: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' };
  }
}

function getTypeConfig(type: string) {
  switch (type) {
    case 'BROADCAST':
      return { label: 'Broadcast', icon: Megaphone, className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' };
    case 'ABANDONED_CART':
      return { label: 'Abandoned Cart', icon: ShoppingCart, className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' };
    case 'COD_CONFIRMATION':
      return { label: 'COD Confirmation', icon: Package, className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' };
    case 'RFM_SEGMENT':
      return { label: 'RFM Segment', icon: UserCheck, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
    default:
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

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function CampaignCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="text-center p-2 rounded-lg bg-muted/50 space-y-2">
              <Skeleton className="h-3.5 w-6 mx-auto" />
              <Skeleton className="h-4 w-10 mx-auto" />
              <Skeleton className="h-2.5 w-14 mx-auto" />
            </div>
          ))}
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </CardContent>
      <Separator />
      <CardFooter className="py-3 gap-2">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 flex-1" />
      </CardFooter>
    </Card>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="py-4">
          <CardContent className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CampaignCard
// ---------------------------------------------------------------------------

function CampaignCard({ campaign }: { campaign: CampaignItemType }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { deleteCampaign, fetchCampaigns } = useCampaignStore();
  const statusConfig = getStatusConfig(campaign.status);
  const typeConfig = getTypeConfig(campaign.type);
  const deliveryPercent = campaign.totalRecipients > 0
    ? Math.round((campaign.deliveredCount / campaign.totalRecipients) * 100)
    : 0;

  const handleDelete = async () => {
    try {
      await deleteCampaign(campaign.id);
      toast.success('Campaign deleted');
      setIsDeleting(false);
      fetchCampaigns();
    } catch {
      toast.error('Failed to delete campaign');
    }
  };

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
          {campaign.messageTemplate}
        </p>

        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <Users className="size-3.5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs font-semibold">{formatNumber(campaign.totalRecipients)}</p>
            <p className="text-[10px] text-muted-foreground">Recipients</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <Send className="size-3.5 mx-auto mb-1 text-amber-500" />
            <p className="text-xs font-semibold">{formatNumber(campaign.sentCount)}</p>
            <p className="text-[10px] text-muted-foreground">Sent</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <CheckCircle2 className="size-3.5 mx-auto mb-1 text-emerald-500" />
            <p className="text-xs font-semibold">{formatNumber(campaign.deliveredCount)}</p>
            <p className="text-[10px] text-muted-foreground">Delivered</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <XCircle className="size-3.5 mx-auto mb-1 text-red-500" />
            <p className="text-xs font-semibold">{formatNumber(campaign.failedCount)}</p>
            <p className="text-[10px] text-muted-foreground">Failed</p>
          </div>
        </div>

        {campaign.status !== 'draft' && campaign.totalRecipients > 0 && (
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
            <span>Campaign stopped due to a gateway error. Check gateway settings.</span>
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
                onClick={handleDelete}
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

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Error State
// ---------------------------------------------------------------------------

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="size-24 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center mb-6">
        <AlertCircle className="size-10 text-red-500" />
      </div>
      <h3 className="text-xl font-semibold mb-2">Failed to load campaigns</h3>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Something went wrong while fetching your campaigns. Please try again.
      </p>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="size-4" />
        Retry
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Filters
// ---------------------------------------------------------------------------

const statusFilters: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CampaignsPage() {
  const {
    campaigns,
    isLoading,
    error,
    filters,
    fetchCampaigns,
    setFilter,
    deleteCampaign,
  } = useCampaignStore();

  const [activeTab, setActiveTab] = useState('all');

  // Fetch campaigns on mount
  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleTabChange = useCallback(
    (tab: string) => {
      setActiveTab(tab);
      setFilter('status', tab === 'all' ? 'all' : tab);
      fetchCampaigns();
    },
    [setFilter, fetchCampaigns]
  );

  const handleRetry = useCallback(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Derived data
  const filteredCampaigns = filters.status === 'all' || filters.status === ''
    ? campaigns
    : campaigns.filter((c) => c.status === filters.status);

  const totalRecipients = campaigns.reduce((sum, c) => sum + c.totalRecipients, 0);
  const totalDelivered = campaigns.reduce((sum, c) => sum + c.deliveredCount, 0);
  const totalFailed = campaigns.reduce((sum, c) => sum + c.failedCount, 0);

  // Tab counts
  const getTabCount = (value: string) => {
    if (value === 'all') return campaigns.length;
    return campaigns.filter((c) => c.status === value).length;
  };

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

      {/* Error State */}
      {error && !isLoading && campaigns.length === 0 ? (
        <ErrorState onRetry={handleRetry} />
      ) : (
        <>
          {/* Summary Stats */}
          {isLoading && campaigns.length === 0 ? (
            <StatsSkeleton />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="py-4">
                <CardContent className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Megaphone className="size-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{campaigns.length}</p>
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
          )}

          {/* Tab Filters */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="flex-wrap h-auto">
              {statusFilters.map((filter) => (
                <TabsTrigger key={filter.value} value={filter.value}>
                  {filter.label}
                  <span className="ml-1.5 text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-mono">
                    {getTabCount(filter.value)}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            {isLoading && filteredCampaigns.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <CampaignCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredCampaigns.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCampaigns.map((campaign) => (
                  <CampaignCard key={campaign.id} campaign={campaign} />
                ))}
              </div>
            ) : (
              <EmptyState />
            )}
          </Tabs>
        </>
      )}
    </div>
  );
}
