'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  Download,
  Upload,
  X,
  Copy,
  Check,
  MoreHorizontal,
  Eye,
  Send,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Phone,
  Filter,
  AlertCircle,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSubscriberStore } from '@/stores/use-subscriber-store';

// ── Types ────────────────────────────────────────────────────────────────

type Segment =
  | 'CHAMPION'
  | 'LOYAL'
  | 'POTENTIAL_LOYALIST'
  | 'NEW_CUSTOMER'
  | 'AT_RISK'
  | 'PRICE_SENSITIVE'
  | 'HIBERNATING'
  | 'LOST';

type DisplaySource = 'Popup' | 'Checkout' | 'API' | 'Import';

// ── Constants ────────────────────────────────────────────────────────────

const SEGMENT_STYLES: Record<Segment, string> = {
  CHAMPION: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  LOYAL: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  POTENTIAL_LOYALIST: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  NEW_CUSTOMER: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  AT_RISK: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  PRICE_SENSITIVE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  HIBERNATING: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
  LOST: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-500',
};

const SEGMENT_LABELS: Record<Segment, string> = {
  CHAMPION: 'Champion',
  LOYAL: 'Loyal',
  POTENTIAL_LOYALIST: 'Potential Loyalist',
  NEW_CUSTOMER: 'New Customer',
  AT_RISK: 'At Risk',
  PRICE_SENSITIVE: 'Price Sensitive',
  HIBERNATING: 'Hibernating',
  LOST: 'Lost',
};

const SOURCE_STYLES: Record<DisplaySource, string> = {
  Popup: 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400 border-sky-200 dark:border-sky-800',
  Checkout: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  API: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400 border-violet-200 dark:border-violet-800',
  Import: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800',
};

// Map store source (lowercase) to display source (titlecase)
function toDisplaySource(source: string): DisplaySource {
  const map: Record<string, DisplaySource> = {
    popup: 'Popup',
    checkout: 'Checkout',
    api: 'API',
    import: 'Import',
  };
  return map[source] || 'API';
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `EGP ${amount.toLocaleString('en-US')}`;
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffWeeks === 1) return '1 week ago';
  if (diffWeeks < 5) return `${diffWeeks} weeks ago`;
  if (diffMonths === 1) return '1 month ago';
  return `${diffMonths} months ago`;
}

function getSegmentBadge(segment: string | null) {
  const key = segment as Segment | null;
  if (!key || !SEGMENT_STYLES[key]) {
    return (
      <Badge variant="outline" className="border-transparent text-xs text-muted-foreground">
        —
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={`border-transparent font-medium ${SEGMENT_STYLES[key]}`}>
      {SEGMENT_LABELS[key]}
    </Badge>
  );
}

function getSourceBadge(source: string) {
  const display = toDisplaySource(source);
  return (
    <Badge variant="outline" className={`text-xs ${SOURCE_STYLES[display]}`}>
      {display}
    </Badge>
  );
}

// ── Skeleton Table ───────────────────────────────────────────────────────

function SkeletonTable() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell className="w-10">
            <Skeleton className="size-4" />
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Skeleton className="size-3.5" />
              <Skeleton className="h-4 w-28" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-16 rounded-full" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="ml-auto h-4 w-8" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="ml-auto h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="size-5 rounded-full" />
          </TableCell>
          <TableCell className="w-12">
            <Skeleton className="size-8" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ── Page Component ───────────────────────────────────────────────────────

export default function SubscribersPage() {
  const {
    subscribers,
    totalCount,
    isLoading,
    error,
    filters,
    selectedIds,
    fetchSubscribers,
    setSearch,
    setFilter,
    resetFilters,
    toggleSelect,
    selectAll,
    clearSelection,
    deleteSelected,
  } = useSubscriberStore();

  // Local search input (for debounce UX)
  const [searchInput, setSearchInput] = useState(filters.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load
  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearch(value);
        fetchSubscribers();
      }, 300);
    },
    [setSearch, fetchSubscribers],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Filter handlers
  const handleSegmentChange = (value: string) => {
    setFilter('segment', value);
    fetchSubscribers();
  };

  const handleSourceChange = (value: string) => {
    setFilter('source', value);
    fetchSubscribers();
  };

  const handleStatusChange = (value: string) => {
    setFilter('isVerified', value);
    fetchSubscribers();
  };

  const handleClearFilters = () => {
    resetFilters();
    setSearchInput('');
    fetchSubscribers();
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const showingStart = totalCount === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1;
  const showingEnd = Math.min(filters.page * filters.pageSize, totalCount);

  const goToPage = (page: number) => {
    setFilter('page', page);
    fetchSubscribers();
  };

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, filters.page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [filters.page, totalPages]);

  // Selection
  const isAllSelected = subscribers.length > 0 && selectedIds.size === subscribers.length;
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  // Bulk delete
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    await deleteSelected();
  };

  // Copy phone
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyPhone = (id: string, phone: string) => {
    navigator.clipboard.writeText(phone).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export
  const handleExport = () => {
    window.open('/api/export?shopId=demo-shop-1&format=csv', '_blank');
  };

  // Active filters check
  const hasFilters = filters.search || filters.segment !== 'all' || filters.source !== 'all' || filters.isVerified !== 'all';

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Subscribers</h1>
            <p className="mt-1 text-muted-foreground">
              Manage your SMS subscriber base
            </p>
          </div>
          {isLoading ? (
            <Skeleton className="mt-1 h-6 w-16 rounded-full" />
          ) : (
            <Badge variant="secondary" className="mt-1 h-fit px-2.5 py-0.5 text-sm font-semibold tabular-nums">
              {totalCount.toLocaleString()}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="size-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="size-4" />
            Import
          </Button>
        </div>
      </div>

      {/* ── Error State ───────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/40">
          <AlertCircle className="size-4 text-red-500" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchSubscribers()}
            className="ml-auto text-xs text-red-600 hover:text-red-800 dark:text-red-400"
          >
            Retry
          </Button>
        </div>
      )}

      {/* ── Filters Bar ──────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by phone or name..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Segment Filter */}
            <Select value={filters.segment} onValueChange={handleSegmentChange}>
              <SelectTrigger className="w-[170px]">
                <Filter className="size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Segments</SelectItem>
                <SelectItem value="CHAMPION">Champion</SelectItem>
                <SelectItem value="LOYAL">Loyal</SelectItem>
                <SelectItem value="POTENTIAL_LOYALIST">Potential Loyalist</SelectItem>
                <SelectItem value="NEW_CUSTOMER">New Customer</SelectItem>
                <SelectItem value="AT_RISK">At Risk</SelectItem>
                <SelectItem value="PRICE_SENSITIVE">Price Sensitive</SelectItem>
                <SelectItem value="HIBERNATING">Hibernating</SelectItem>
                <SelectItem value="LOST">Lost</SelectItem>
              </SelectContent>
            </Select>

            {/* Source Filter */}
            <Select value={filters.source} onValueChange={handleSourceChange}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="popup">Popup</SelectItem>
                <SelectItem value="checkout">Checkout</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="import">Import</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={filters.isVerified} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters} className="gap-1.5 text-muted-foreground">
                <X className="size-3.5" />
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Bulk Actions Bar ─────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/40">
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {selectedIds.size} selected
          </span>
          <Separator orientation="vertical" className="h-5 bg-emerald-200 dark:bg-emerald-700" />
          <Button size="sm" variant="outline" className="gap-1.5 text-xs">
            <Send className="size-3.5" />
            Send SMS
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs">
            <Download className="size-3.5" />
            Export Selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs text-destructive hover:text-destructive"
            onClick={handleDeleteSelected}
            disabled={isLoading}
          >
            <Trash2 className="size-3.5" />
            Delete Selected
          </Button>
        </div>
      )}

      {/* ── Data Table ───────────────────────────────────────────── */}
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) {
                          (el as unknown as HTMLInputElement).indeterminate = isSomeSelected;
                        }
                      }}
                      onCheckedChange={selectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Last Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <SkeletonTable />
                ) : subscribers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      No subscribers found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  subscribers.map((subscriber) => {
                    const isSelected = selectedIds.has(subscriber.id);
                    const displayName = subscriber.maskedPhone || subscriber.phoneNumber || '—';
                    return (
                      <TableRow
                        key={subscriber.id}
                        data-state={isSelected ? 'selected' : undefined}
                        className="group"
                      >
                        {/* Checkbox */}
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(subscriber.id)}
                            aria-label={`Select ${displayName}`}
                          />
                        </TableCell>

                        {/* Phone */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="size-3.5 text-muted-foreground" />
                            <span className="font-mono text-sm">{displayName}</span>
                            <button
                              onClick={() => copyPhone(subscriber.id, displayName)}
                              className="rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                              title="Copy phone number"
                            >
                              {copiedId === subscriber.id ? (
                                <Check className="size-3 text-emerald-500" />
                              ) : (
                                <Copy className="size-3 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                        </TableCell>

                        {/* Name */}
                        <TableCell>
                          <span className="text-sm font-medium">
                            {subscriber.firstName && subscriber.lastName
                              ? `${subscriber.firstName} ${subscriber.lastName}`
                              : subscriber.firstName || subscriber.lastName || '—'}
                          </span>
                        </TableCell>

                        {/* Segment */}
                        <TableCell>{getSegmentBadge(subscriber.segment)}</TableCell>

                        {/* Source */}
                        <TableCell>{getSourceBadge(subscriber.source)}</TableCell>

                        {/* Orders */}
                        <TableCell className="text-right">
                          <span className="tabular-nums text-sm">{subscriber.totalOrdersCount}</span>
                        </TableCell>

                        {/* Revenue */}
                        <TableCell className="text-right">
                          <span className="tabular-nums text-sm font-medium">
                            {formatCurrency(subscriber.totalRevenue)}
                          </span>
                        </TableCell>

                        {/* Last Order */}
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatRelativeDate(subscriber.lastOrderAt)}
                          </span>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {subscriber.isVerified ? (
                            <CircleCheck className="size-5 text-emerald-500" />
                          ) : (
                            <CircleX className="size-5 text-gray-400" />
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8">
                                <MoreHorizontal className="size-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="gap-2">
                                <Eye className="size-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2">
                                <Send className="size-4" />
                                Send SMS
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" className="gap-2">
                                <Trash2 className="size-4" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Pagination ───────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          Showing{' '}
          <span className="font-medium text-foreground">{showingStart}</span>–
          <span className="font-medium text-foreground">{showingEnd}</span> of{' '}
          <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span>{' '}
          subscribers
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => goToPage(filters.page - 1)}
            disabled={filters.page <= 1 || isLoading}
          >
            <ChevronLeft className="size-4" />
            <span className="sr-only">Previous</span>
          </Button>

          {pageNumbers[0] > 1 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="size-8"
                onClick={() => goToPage(1)}
              >
                1
              </Button>
              {pageNumbers[0] > 2 && (
                <span className="px-1 text-muted-foreground">…</span>
              )}
            </>
          )}

          {pageNumbers.map((page) => (
            <Button
              key={page}
              variant={page === filters.page ? 'default' : 'ghost'}
              size="sm"
              className="size-8"
              onClick={() => goToPage(page)}
            >
              {page}
            </Button>
          ))}

          {pageNumbers[pageNumbers.length - 1] < totalPages && (
            <>
              {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                <span className="px-1 text-muted-foreground">…</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="size-8"
                onClick={() => goToPage(totalPages)}
              >
                {totalPages}
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => goToPage(filters.page + 1)}
            disabled={filters.page >= totalPages || isLoading}
          >
            <ChevronRight className="size-4" />
            <span className="sr-only">Next</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
