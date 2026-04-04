'use client';

import { useState, useMemo } from 'react';
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
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
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

type Source = 'Popup' | 'Checkout' | 'API';
type SubscriberStatus = 'verified' | 'unverified';

interface Subscriber {
  id: string;
  phone: string;
  phoneDisplay: string;
  firstName: string;
  lastName: string;
  segment: Segment;
  source: Source;
  orders: number;
  revenue: number;
  lastOrderDate: string | null;
  lastOrderRelative: string;
  status: SubscriberStatus;
  createdAt: string;
}

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

const SOURCE_STYLES: Record<Source, string> = {
  Popup: 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400 border-sky-200 dark:border-sky-800',
  Checkout: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  API: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400 border-violet-200 dark:border-violet-800',
};

const ITEMS_PER_PAGE = 25;

// ── Sample Data ──────────────────────────────────────────────────────────

const SUBSCRIBERS: Subscriber[] = [
  { id: '1', phone: '01012345678', phoneDisplay: '010 1234 5678', firstName: 'Ahmed', lastName: 'El-Masry', segment: 'CHAMPION', source: 'Checkout', orders: 47, revenue: 38450, lastOrderDate: '2025-01-13', lastOrderRelative: '2 hours ago', status: 'verified', createdAt: '2023-04-12' },
  { id: '2', phone: '01198765432', phoneDisplay: '011 9876 5432', firstName: 'Fatma', lastName: 'Hassan', segment: 'CHAMPION', source: 'Checkout', orders: 52, revenue: 42100, lastOrderDate: '2025-01-13', lastOrderRelative: '3 hours ago', status: 'verified', createdAt: '2023-02-28' },
  { id: '3', phone: '01255667788', phoneDisplay: '012 5566 7788', firstName: 'Mohamed', lastName: 'Ibrahim', segment: 'LOYAL', source: 'Popup', orders: 28, revenue: 19800, lastOrderDate: '2025-01-12', lastOrderRelative: 'Yesterday', status: 'verified', createdAt: '2023-08-15' },
  { id: '4', phone: '01099887766', phoneDisplay: '010 9988 7766', firstName: 'Sara', lastName: 'Khalil', segment: 'LOYAL', source: 'Checkout', orders: 31, revenue: 22300, lastOrderDate: '2025-01-11', lastOrderRelative: '2 days ago', status: 'verified', createdAt: '2023-06-01' },
  { id: '5', phone: '01533445566', phoneDisplay: '015 3344 5566', firstName: 'Omar', lastName: 'Abdel-Rahim', segment: 'POTENTIAL_LOYALIST', source: 'API', orders: 12, revenue: 8900, lastOrderDate: '2025-01-10', lastOrderRelative: '3 days ago', status: 'verified', createdAt: '2024-01-20' },
  { id: '6', phone: '01122334455', phoneDisplay: '011 2233 4455', firstName: 'Nour', lastName: 'El-Din', segment: 'POTENTIAL_LOYALIST', source: 'Checkout', orders: 9, revenue: 6400, lastOrderDate: '2025-01-09', lastOrderRelative: '4 days ago', status: 'verified', createdAt: '2024-03-10' },
  { id: '7', phone: '01244556677', phoneDisplay: '012 4455 6677', firstName: '', lastName: '', segment: 'NEW_CUSTOMER', source: 'Popup', orders: 1, revenue: 450, lastOrderDate: '2025-01-12', lastOrderRelative: 'Yesterday', status: 'verified', createdAt: '2025-01-12' },
  { id: '8', phone: '01066778899', phoneDisplay: '010 6677 8899', firstName: 'Youssef', lastName: 'Mansour', segment: 'NEW_CUSTOMER', source: 'Checkout', orders: 2, revenue: 1200, lastOrderDate: '2025-01-11', lastOrderRelative: '2 days ago', status: 'unverified', createdAt: '2025-01-08' },
  { id: '9', phone: '01577889900', phoneDisplay: '015 7788 9900', firstName: 'Hana', lastName: 'Saeed', segment: 'AT_RISK', source: 'Checkout', orders: 15, revenue: 11200, lastOrderDate: '2024-11-28', lastOrderRelative: '46 days ago', status: 'verified', createdAt: '2023-09-05' },
  { id: '10', phone: '01188990011', phoneDisplay: '011 8899 0011', firstName: 'Khaled', lastName: 'Fathy', segment: 'AT_RISK', source: 'API', orders: 18, revenue: 13500, lastOrderDate: '2024-12-05', lastOrderRelative: '39 days ago', status: 'verified', createdAt: '2023-07-22' },
  { id: '11', phone: '01299001122', phoneDisplay: '012 9900 1122', firstName: 'Mariam', lastName: 'Youssef', segment: 'PRICE_SENSITIVE', source: 'Popup', orders: 22, revenue: 9800, lastOrderDate: '2025-01-08', lastOrderRelative: '5 days ago', status: 'verified', createdAt: '2023-11-10' },
  { id: '12', phone: '01000112233', phoneDisplay: '010 0011 2233', firstName: 'Ali', lastName: 'Reda', segment: 'PRICE_SENSITIVE', source: 'Checkout', orders: 19, revenue: 7600, lastOrderDate: '2025-01-06', lastOrderRelative: '1 week ago', status: 'verified', createdAt: '2023-12-01' },
  { id: '13', phone: '01511223344', phoneDisplay: '015 1122 3344', firstName: '', lastName: 'El-Sayed', segment: 'HIBERNATING', source: 'Popup', orders: 8, revenue: 5200, lastOrderDate: '2024-09-15', lastOrderRelative: '4 months ago', status: 'verified', createdAt: '2023-05-20' },
  { id: '14', phone: '01122334466', phoneDisplay: '011 2233 4466', firstName: 'Rania', lastName: 'Mahmoud', segment: 'HIBERNATING', source: 'Checkout', orders: 6, revenue: 3800, lastOrderDate: '2024-08-22', lastOrderRelative: '5 months ago', status: 'unverified', createdAt: '2023-08-14' },
  { id: '15', phone: '01233445588', phoneDisplay: '012 3344 5588', firstName: 'Hassan', lastName: 'Mourad', segment: 'LOST', source: 'API', orders: 4, revenue: 2100, lastOrderDate: '2024-04-10', lastOrderRelative: '9 months ago', status: 'verified', createdAt: '2023-03-18' },
  { id: '16', phone: '01044556699', phoneDisplay: '010 4455 6699', firstName: 'Amira', lastName: 'Tawfik', segment: 'LOST', source: 'Popup', orders: 3, revenue: 1450, lastOrderDate: '2024-03-05', lastOrderRelative: '10 months ago', status: 'verified', createdAt: '2023-06-25' },
  { id: '17', phone: '01555667700', phoneDisplay: '015 5566 7700', firstName: 'Ibrahim', lastName: 'Nabil', segment: 'CHAMPION', source: 'Checkout', orders: 41, revenue: 35200, lastOrderDate: '2025-01-13', lastOrderRelative: '1 hour ago', status: 'verified', createdAt: '2023-01-30' },
  { id: '18', phone: '01166778811', phoneDisplay: '011 6677 8811', firstName: 'Layla', lastName: 'Atef', segment: 'LOYAL', source: 'Checkout', orders: 25, revenue: 17600, lastOrderDate: '2025-01-10', lastOrderRelative: '3 days ago', status: 'verified', createdAt: '2023-10-05' },
  { id: '19', phone: '01277889922', phoneDisplay: '012 7788 9922', firstName: 'Mahmoud', lastName: 'Salem', segment: 'NEW_CUSTOMER', source: 'API', orders: 1, revenue: 320, lastOrderDate: '2025-01-13', lastOrderRelative: '30 minutes ago', status: 'unverified', createdAt: '2025-01-13' },
  { id: '20', phone: '01088990033', phoneDisplay: '010 8899 0033', firstName: 'Dina', lastName: 'Fawzy', segment: 'AT_RISK', source: 'Popup', orders: 14, revenue: 10100, lastOrderDate: '2024-12-18', lastOrderRelative: '26 days ago', status: 'verified', createdAt: '2023-09-22' },
  { id: '21', phone: '01599001144', phoneDisplay: '015 9900 1144', firstName: 'Tarek', lastName: 'Hussein', segment: 'CHAMPION', source: 'Checkout', orders: 56, revenue: 47800, lastOrderDate: '2025-01-12', lastOrderRelative: 'Yesterday', status: 'verified', createdAt: '2022-11-15' },
  { id: '22', phone: '01100112255', phoneDisplay: '011 0011 2255', firstName: 'Heba', lastName: 'Lotfy', segment: 'POTENTIAL_LOYALIST', source: 'Checkout', orders: 7, revenue: 5100, lastOrderDate: '2025-01-07', lastOrderRelative: '6 days ago', status: 'verified', createdAt: '2024-06-18' },
  { id: '23', phone: '01211223366', phoneDisplay: '012 1122 3366', firstName: '', lastName: '', segment: 'PRICE_SENSITIVE', source: 'Popup', orders: 16, revenue: 6900, lastOrderDate: '2025-01-04', lastOrderRelative: '9 days ago', status: 'verified', createdAt: '2024-02-14' },
  { id: '24', phone: '01022334477', phoneDisplay: '010 2233 4477', firstName: 'Sherif', lastName: 'Gamal', segment: 'LOYAL', source: 'API', orders: 33, revenue: 24500, lastOrderDate: '2025-01-11', lastOrderRelative: '2 days ago', status: 'verified', createdAt: '2023-04-08' },
  { id: '25', phone: '01533445588', phoneDisplay: '015 3344 5588', firstName: 'Aya', lastName: 'Zaki', segment: 'NEW_CUSTOMER', source: 'Checkout', orders: 3, revenue: 2800, lastOrderDate: '2025-01-12', lastOrderRelative: 'Yesterday', status: 'verified', createdAt: '2025-01-05' },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  // Format: 0XX XXXX XXXX → 0XX XXXX XXXX (show first 4 and group)
  const digits = phone.replace(/\s/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} XXXX`;
  }
  return phone;
}

function formatCurrency(amount: number): string {
  return `EGP ${amount.toLocaleString('en-US')}`;
}

function getSegmentBadge(segment: Segment) {
  return (
    <Badge variant="outline" className={`border-transparent font-medium ${SEGMENT_STYLES[segment]}`}>
      {SEGMENT_LABELS[segment]}
    </Badge>
  );
}

function getSourceBadge(source: Source) {
  return (
    <Badge variant="outline" className={`text-xs ${SOURCE_STYLES[source]}`}>
      {source}
    </Badge>
  );
}

// ── Page Component ───────────────────────────────────────────────────────

export default function SubscribersPage() {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Derived
  const hasFilters = searchQuery || segmentFilter !== 'all' || sourceFilter !== 'all' || statusFilter !== 'all';

  const filteredSubscribers = useMemo(() => {
    return SUBSCRIBERS.filter((sub) => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (sub.firstName + ' ' + sub.lastName).toLowerCase().includes(q);
        const phoneMatch = sub.phone.includes(q) || sub.phoneDisplay.includes(q);
        if (!nameMatch && !phoneMatch) return false;
      }

      // Segment
      if (segmentFilter !== 'all' && sub.segment !== segmentFilter) return false;

      // Source
      if (sourceFilter !== 'all' && sub.source !== sourceFilter) return false;

      // Status
      if (statusFilter !== 'all' && sub.status !== statusFilter) return false;

      return true;
    });
  }, [searchQuery, segmentFilter, sourceFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSubscribers.length / ITEMS_PER_PAGE));

  // Clamp page
  const safePage = Math.min(currentPage, totalPages);

  const paginatedSubscribers = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredSubscribers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSubscribers, safePage]);

  const showingStart = filteredSubscribers.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1;
  const showingEnd = Math.min(safePage * ITEMS_PER_PAGE, filteredSubscribers.length);

  // Handlers
  const clearFilters = () => {
    setSearchQuery('');
    setSegmentFilter('all');
    setSourceFilter('all');
    setStatusFilter('all');
    setCurrentPage(1);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedSubscribers.length && paginatedSubscribers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedSubscribers.map((s) => s.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyPhone = (id: string, phone: string) => {
    navigator.clipboard.writeText(phone).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = () => {
    // Build CSV content
    const headers = ['Phone', 'Name', 'Segment', 'Source', 'Orders', 'Revenue', 'Last Order', 'Status'];
    const rows = filteredSubscribers.map((s) => [
      s.phone,
      `${s.firstName} ${s.lastName}`.trim(),
      SEGMENT_LABELS[s.segment],
      s.source,
      String(s.orders),
      String(s.revenue),
      s.lastOrderRelative,
      s.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subscribers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const isAllSelected = paginatedSubscribers.length > 0 && selectedIds.size === paginatedSubscribers.length;
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, safePage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [safePage, totalPages]);

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
          <Badge variant="secondary" className="mt-1 h-fit px-2.5 py-0.5 text-sm font-semibold tabular-nums">
            {filteredSubscribers.length.toLocaleString()}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <Download className="size-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="size-4" />
            Import
          </Button>
        </div>
      </div>

      {/* ── Filters Bar ──────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by phone or name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>

            {/* Segment Filter */}
            <Select value={segmentFilter} onValueChange={(v) => { setSegmentFilter(v); setCurrentPage(1); }}>
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
            <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="Popup">Popup</SelectItem>
                <SelectItem value="Checkout">Checkout</SelectItem>
                <SelectItem value="API">API</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
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
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
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
          <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive hover:text-destructive">
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
                        // For indeterminate state
                        if (el) {
                          (el as unknown as HTMLInputElement).indeterminate = isSomeSelected;
                        }
                      }}
                      onCheckedChange={toggleSelectAll}
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
                {paginatedSubscribers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      No subscribers found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSubscribers.map((subscriber) => {
                    const isSelected = selectedIds.has(subscriber.id);
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
                            aria-label={`Select ${subscriber.phoneDisplay}`}
                          />
                        </TableCell>

                        {/* Phone */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="size-3.5 text-muted-foreground" />
                            <span className="font-mono text-sm">{maskPhone(subscriber.phone)}</span>
                            <button
                              onClick={() => copyPhone(subscriber.id, subscriber.phone)}
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
                              : '—'}
                          </span>
                        </TableCell>

                        {/* Segment */}
                        <TableCell>{getSegmentBadge(subscriber.segment)}</TableCell>

                        {/* Source */}
                        <TableCell>{getSourceBadge(subscriber.source)}</TableCell>

                        {/* Orders */}
                        <TableCell className="text-right">
                          <span className="tabular-nums text-sm">{subscriber.orders}</span>
                        </TableCell>

                        {/* Revenue */}
                        <TableCell className="text-right">
                          <span className="tabular-nums text-sm font-medium">{formatCurrency(subscriber.revenue)}</span>
                        </TableCell>

                        {/* Last Order */}
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {subscriber.lastOrderRelative || 'Never'}
                          </span>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {subscriber.status === 'verified' ? (
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
          Showing <span className="font-medium text-foreground">{showingStart}</span>–
          <span className="font-medium text-foreground">{showingEnd}</span> of{' '}
          <span className="font-medium text-foreground">{filteredSubscribers.length.toLocaleString()}</span>{' '}
          subscribers
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
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
                onClick={() => setCurrentPage(1)}
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
              variant={page === safePage ? 'default' : 'ghost'}
              size="sm"
              className="size-8"
              onClick={() => setCurrentPage(page)}
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
                onClick={() => setCurrentPage(totalPages)}
              >
                {totalPages}
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
          >
            <ChevronRight className="size-4" />
            <span className="sr-only">Next</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
