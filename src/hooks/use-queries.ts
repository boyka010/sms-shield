// =============================================================================
// SMS-Shield — TanStack Query Hooks
// Comprehensive data fetching & mutation hooks for all API resources
// =============================================================================

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { toast } from 'sonner';

// =============================================================================
// API Helper
// =============================================================================

const API_BASE = '';

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationInfo;
  error?: string;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  const json = await response.json();

  if (!json.success) {
    throw new Error(json.error || `API Error (${response.status})`);
  }

  return json.data as T;
}

async function apiFetchPaginated<T>(
  url: string
): Promise<{ data: T[]; pagination: PaginationInfo }> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
  });

  const json: PaginatedResponse<T> = await response.json();

  if (!json.success) {
    throw new Error(json.error || `API Error (${response.status})`);
  }

  return { data: json.data, pagination: json.pagination };
}

// =============================================================================
// Shared Types
// =============================================================================

export interface PaginationInfo {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  statusCode?: number;
  details?: unknown;
}

// =============================================================================
// Dashboard Analytics Types
// =============================================================================

export interface KpiMetric {
  label: string;
  value: string;
  change: number;
  previousValue?: string;
}

export interface DeliveryChartData {
  day: string;
  sent: number;
  delivered: number;
  failed: number;
}

export interface CampaignPerformanceData {
  name: string;
  type: string;
  sent: number;
  delivered: number;
  failed: number;
  revenue: number;
}

export interface ActivityFeedItem {
  id: string;
  type:
    | 'campaign_sent'
    | 'order_placed'
    | 'subscriber_added'
    | 'gateway_failover'
    | 'rfm_completed'
    | 'cart_recovered'
    | 'subscriber_imported'
    | 'campaign_scheduled';
  description: string;
  timestamp: string;
  status: 'success' | 'failed' | 'pending' | 'info';
  metadata?: Record<string, unknown>;
}

export interface GatewayStatusSummary {
  gatewayType: string;
  isActive: boolean;
  healthStatus: string;
  lastHealthCheckAt: string | null;
  smsSentToday: number;
  successRate: number;
}

export interface DashboardAnalytics {
  kpis: {
    totalSubscribers: KpiMetric;
    smsSent30d: KpiMetric;
    conversionRate: KpiMetric;
    revenueGenerated: KpiMetric;
  };
  deliveryChart: DeliveryChartData[];
  campaignPerformance: CampaignPerformanceData[];
  recentActivity: ActivityFeedItem[];
  gatewayStatuses: GatewayStatusSummary[];
  topSegments: {
    segment: string;
    subscriberCount: number;
    avgRevenue: number;
  }[];
  summaryGeneratedAt: string;
}

// =============================================================================
// Subscriber Types
// =============================================================================

export interface SubscriberFilters {
  search?: string;
  segment?: string;
  source?: string;
  isVerified?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export type SubscriberSource = 'popup' | 'checkout' | 'api' | 'import';

export interface DiscountCodeRef {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  isActive: boolean;
}

export interface SubscriberType {
  id: string;
  shopId: string;
  phoneNumber: string;
  rawPhoneNumber: string;
  phoneHash: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  consentGranted: boolean;
  consentTimestamp: string;
  source: SubscriberSource;
  discountCodeId: string | null;
  isVerified: boolean;
  tags: string[];
  totalOrdersCount: number;
  totalRevenue: number;
  lastOrderAt: string | null;
  firstOrderAt: string | null;
  createdAt: string;
  updatedAt: string;
  discountCode?: DiscountCodeRef;
  maskedPhone?: string;
}

export interface CreateSubscriberInput {
  shopId: string;
  phoneNumber: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  source?: string;
  discountType?: string;
  discountValue?: number;
}

export interface CreateSubscriberResponse {
  subscriber: {
    id: string;
    maskedPhone: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    source: string;
    isVerified: boolean;
    createdAt: string;
  };
}

// =============================================================================
// Campaign Types
// =============================================================================

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type CampaignTypeValue =
  | 'BROADCAST'
  | 'ABANDONED_CART'
  | 'COD_CONFIRMATION'
  | 'RFM_SEGMENT'
  | 'CUSTOM';

export interface CampaignFilters {
  status?: string;
  type?: string;
  search?: string;
}

export interface CampaignMessage {
  id: string;
  subscriberId: string;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  retryCount: number;
  createdAt: string;
}

export interface CampaignType {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  type: CampaignTypeValue;
  status: CampaignStatus;
  segmentFilter: string | null;
  senderName: string | null;
  gatewayType: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignDetail extends CampaignType {
  messageTemplate: string;
  messages: CampaignMessage[];
}

export interface CreateCampaignInput {
  shopId: string;
  name: string;
  type: string;
  messageTemplate: string;
  segmentFilter?: string;
  scheduledAt?: string;
  senderName?: string;
}

export interface UpdateCampaignInput {
  name?: string;
  messageTemplate?: string;
  status?: string;
  segmentFilter?: string | null;
  scheduledAt?: string | null;
}

export interface DeleteCampaignResponse {
  message: string;
  deletedCampaignId: string;
  deletedMessageCount: number;
}

// =============================================================================
// RFM Segment Types
// =============================================================================

export type RFMSegmentName =
  | 'CHAMPION'
  | 'LOYAL'
  | 'POTENTIAL_LOYALIST'
  | 'NEW_CUSTOMER'
  | 'PROMISING'
  | 'NEED_ATTENTION'
  | 'AT_RISK'
  | 'CANT_LOSE'
  | 'HIBERNATING'
  | 'LOST'
  | 'PRICE_SENSITIVE';

export interface RFMSubscriberRecord {
  subscriberId: string;
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  rfmCompositeScore: number;
  daysSinceLastOrder: number;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  calculatedAt: string;
  subscriber: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    isVerified: boolean;
    tags: string;
    createdAt: string;
  };
}

export interface RFMSegmentGroup {
  segment: RFMSegmentName;
  subscriberCount: number;
  avgRecency: number;
  avgFrequency: number;
  avgMonetary: number;
  avgCompositeScore: number;
  totalRevenue: number;
  subscribers: RFMSubscriberRecord[];
}

export interface RFMSegmentData {
  shopId: string;
  lastCalculatedAt: string | null;
  totalSegmentedSubscribers: number;
  overallAverages: {
    recency: number;
    frequency: number;
    monetary: number;
  };
  segments: RFMSegmentGroup[];
}

export interface TriggerRFMResponse {
  message: string;
  jobId: string;
  shopId: string;
  calculationDate: string;
  status: string;
}

// =============================================================================
// Shop Settings Types
// =============================================================================

export interface ShopSettingsType {
  id: string;
  shopId: string;
  popupEnabled: boolean;
  popupDelaySeconds: number;
  popupHeadline: string;
  popupSubtext: string;
  discountType: string;
  discountValue: number;
  buttonColor: string;
  buttonTextColor: string;
  smsConsentText: string;
  codConfirmationEnabled: boolean;
  autoApplyDiscount: boolean;
  maxRetriesPerGateway: number;
  smsRetryIntervalMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateSettingsInput {
  shopId: string;
  popupEnabled?: boolean;
  popupDelaySeconds?: number;
  popupHeadline?: string;
  popupSubtext?: string;
  discountType?: string;
  discountValue?: number;
  buttonColor?: string;
  buttonTextColor?: string;
  smsConsentText?: string;
  codConfirmationEnabled?: boolean;
  autoApplyDiscount?: boolean;
  maxRetriesPerGateway?: number;
  smsRetryIntervalMinutes?: number;
}

// =============================================================================
// Gateway Config Types
// =============================================================================

export type GatewayTypeValue = 'SMS_MISR' | 'VICTORY_LINK' | 'WE_API';
export type HealthStatus = 'unknown' | 'healthy' | 'degraded' | 'down';

export interface GatewayConfigType {
  id: string;
  shopId: string;
  gatewayType: GatewayTypeValue;
  maskedUsername: string;
  maskedPassword: string;
  hasApiKey: boolean;
  maskedApiKey: string | null;
  senderName: string;
  isActive: boolean;
  priority: number;
  lastHealthCheckAt: string | null;
  healthStatus: HealthStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AddGatewayInput {
  shopId: string;
  gatewayType: string;
  username: string;
  password: string;
  apiKey?: string;
  senderName: string;
  priority?: number;
}

export interface UpdateGatewayInput {
  id: string;
  username?: string;
  password?: string;
  apiKey?: string;
  senderName?: string;
  isActive?: boolean;
  priority?: number;
}

export interface DeleteGatewayResponse {
  message: string;
  deletedGatewayId: string;
  gatewayType: string;
}

export interface GatewayHealthCheckResponse {
  gatewayId: string;
  status: HealthStatus;
  latencyMs: number;
  checkedAt: string;
  errorMessage: string | null;
}

// =============================================================================
// Shop Types
// =============================================================================

export type ShopPlan = 'free' | 'starter' | 'pro' | 'enterprise';

export interface ShopStats {
  subscribers: number;
  campaigns: number;
  discountCodes: number;
  gateways: number;
  webhookEvents: number;
}

export interface ShopType {
  id: string;
  shopifyDomain: string;
  isActive: boolean;
  plan: ShopPlan;
  currency: string;
  installedAt: string;
  updatedAt: string;
  stats: ShopStats;
}

// =============================================================================
// Dashboard Analytics Hooks
// =============================================================================

export function useDashboardAnalytics(shopId: string) {
  return useQuery({
    queryKey: ['dashboard', 'analytics', shopId],
    queryFn: () =>
      apiFetch<DashboardAnalytics>(`/api/analytics?shopId=${shopId}`),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // auto-refresh every minute
    enabled: !!shopId,
  });
}

// =============================================================================
// Subscriber Hooks
// =============================================================================

export function useSubscribers(
  shopId: string,
  filters: SubscriberFilters,
  page: number,
  pageSize: number
) {
  return useQuery({
    queryKey: ['subscribers', shopId, filters, page, pageSize],
    queryFn: () => {
      const params = new URLSearchParams({
        shopId,
        page: String(page),
        pageSize: String(pageSize),
      });

      if (filters.search) params.set('search', filters.search);
      if (filters.segment && filters.segment !== 'all')
        params.set('segment', filters.segment);
      if (filters.source && filters.source !== 'all')
        params.set('source', filters.source);
      if (filters.isVerified && filters.isVerified !== 'all')
        params.set('isVerified', filters.isVerified);
      if (filters.sortBy) params.set('sortBy', filters.sortBy);
      if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);

      return apiFetchPaginated<SubscriberType>(`/api/subscribers?${params}`);
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!shopId,
  });
}

export function useCreateSubscriber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSubscriberInput) =>
      apiFetch<CreateSubscriberResponse>('/api/subscribers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to create subscriber', {
        description: error.message,
      });
    },
  });
}

// =============================================================================
// Campaign Hooks
// =============================================================================

export function useCampaigns(
  shopId: string,
  filters: CampaignFilters = {},
  options?: Partial<
    UseQueryOptions<{ data: CampaignType[]; pagination: PaginationInfo }>
  >
) {
  return useQuery({
    queryKey: ['campaigns', shopId, filters],
    queryFn: () => {
      const params = new URLSearchParams({ shopId });
      if (filters.status && filters.status !== 'all')
        params.set('status', filters.status);
      if (filters.type && filters.type !== 'all') params.set('type', filters.type);
      if (filters.search) params.set('search', filters.search);
      return apiFetchPaginated<CampaignType>(`/api/campaigns?${params}`);
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!shopId,
    ...options,
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: () => apiFetch<CampaignDetail>(`/api/campaigns/${id}`),
    staleTime: 30 * 1000,
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCampaignInput) =>
      apiFetch<CampaignType>('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Campaign created successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to create campaign', {
        description: error.message,
      });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCampaignInput }) =>
      apiFetch<CampaignType>(`/api/campaigns/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({
        queryKey: ['campaign', variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Campaign updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update campaign', {
        description: error.message,
      });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<DeleteCampaignResponse>(`/api/campaigns/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Campaign deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete campaign', {
        description: error.message,
      });
    },
  });
}

// =============================================================================
// RFM Segment Hooks
// =============================================================================

export function useRFMSegments(shopId: string, segmentFilter?: string) {
  return useQuery({
    queryKey: ['rfm', shopId, segmentFilter],
    queryFn: () => {
      const params = new URLSearchParams({ shopId });
      if (segmentFilter) params.set('segment', segmentFilter);
      return apiFetch<RFMSegmentData>(`/api/rfm?${params}`);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — RFM data changes infrequently
    enabled: !!shopId,
  });
}

export function useTriggerRFMCalculation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { shopId: string }) =>
      apiFetch<TriggerRFMResponse>('/api/rfm', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['rfm', variables.shopId],
      });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('RFM recalculation triggered', {
        description: 'Segments will be updated shortly.',
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to trigger RFM calculation', {
        description: error.message,
      });
    },
  });
}

// =============================================================================
// Shop Settings Hooks
// =============================================================================

export function useShopSettings(shopId: string) {
  return useQuery({
    queryKey: ['settings', shopId],
    queryFn: () =>
      apiFetch<ShopSettingsType>(`/api/settings?shopId=${shopId}`),
    staleTime: 10 * 60 * 1000, // 10 minutes — settings change rarely
    enabled: !!shopId,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateSettingsInput) =>
      apiFetch<ShopSettingsType>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update settings', {
        description: error.message,
      });
    },
  });
}

// =============================================================================
// Gateway Config Hooks
// =============================================================================

export function useGateways(shopId: string) {
  return useQuery({
    queryKey: ['gateways', shopId],
    queryFn: () =>
      apiFetch<GatewayConfigType[]>(`/api/gateways?shopId=${shopId}`),
    staleTime: 2 * 60 * 1000,
    enabled: !!shopId,
  });
}

export function useAddGateway() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddGatewayInput) =>
      apiFetch<GatewayConfigType>('/api/gateways', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['gateways', variables.shopId],
      });
      toast.success('Gateway added successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to add gateway', {
        description: error.message,
      });
    },
  });
}

export function useUpdateGateway() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateGatewayInput) =>
      apiFetch<GatewayConfigType>('/api/gateways', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateways'] });
      toast.success('Gateway updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update gateway', {
        description: error.message,
      });
    },
  });
}

export function useDeleteGateway() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<DeleteGatewayResponse>('/api/gateways', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateways'] });
      toast.success('Gateway removed successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to remove gateway', {
        description: error.message,
      });
    },
  });
}

export function useCheckGatewayHealth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (gatewayId: string) =>
      apiFetch<GatewayHealthCheckResponse>(
        `/api/gateways/${gatewayId}/health`,
        {
          method: 'POST',
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateways'] });
      toast.success('Health check completed');
    },
    onError: (error: Error) => {
      toast.error('Health check failed', {
        description: error.message,
      });
    },
  });
}

// =============================================================================
// Shop Info Hooks
// =============================================================================

export function useShop(shopDomain: string) {
  return useQuery({
    queryKey: ['shop', shopDomain],
    queryFn: () =>
      apiFetch<ShopType>(
        `/api/shop?shopDomain=${encodeURIComponent(shopDomain)}`
      ),
    staleTime: 5 * 60 * 1000,
    enabled: !!shopDomain,
  });
}
