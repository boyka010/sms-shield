import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type CampaignType =
  | 'BROADCAST'
  | 'ABANDONED_CART'
  | 'COD_CONFIRMATION'
  | 'RFM_SEGMENT'
  | 'CUSTOM';

export interface CampaignItemType {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  type: CampaignType;
  status: CampaignStatus;
  segmentFilter: string | null;
  messageTemplate: string;
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

export interface CampaignFilters {
  status: string;
  type: string;
  search: string;
}

interface CampaignState {
  campaigns: CampaignItemType[];
  activeCampaign: CampaignItemType | null;
  isLoading: boolean;
  error: string | null;
  filters: CampaignFilters;
  fetchCampaigns: () => Promise<void>;
  createCampaign: (campaign: Partial<CampaignItemType>) => Promise<CampaignItemType>;
  updateCampaign: (id: string, data: Partial<CampaignItemType>) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;
  setActiveCampaign: (campaign: CampaignItemType | null) => void;
  setFilter: <K extends keyof CampaignFilters>(key: K, value: CampaignFilters[K]) => void;
  resetFilters: () => void;
}

const defaultFilters: CampaignFilters = {
  status: 'all',
  type: 'all',
  search: '',
};

export const useCampaignStore = create<CampaignState>()(
  devtools(
    (set, get) => ({
      campaigns: [],
      activeCampaign: null,
      isLoading: false,
      error: null,
      filters: { ...defaultFilters },

      fetchCampaigns: async () => {
        set({ isLoading: true });
        try {
          const shopId = 'demo-shop-1';
          const { status, type, search } = get().filters;
          const params = new URLSearchParams({ shopId, page: '1', pageSize: '50' });
          if (status && status !== 'all') params.set('status', status);
          if (type && type !== 'all') params.set('type', type);
          if (search) params.set('search', search);
          const res = await fetch(`/api/campaigns?${params}`);
          const data = await res.json();
          if (data.success) {
            set({ campaigns: data.data || [], isLoading: false });
          } else {
            set({ isLoading: false });
          }
        } catch {
          set({ isLoading: false });
        }
      },

      createCampaign: async (campaign: Partial<CampaignItemType>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch('/api/campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(campaign),
          });
          const data = await response.json();
          if (data.success) {
            const newCampaign = data.data.campaign;
            set((state) => ({
              campaigns: [newCampaign, ...state.campaigns],
              activeCampaign: newCampaign,
              isLoading: false,
            }));
            return newCampaign;
          }
          throw new Error(data.error);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to create campaign';
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      updateCampaign: async (id: string, data: Partial<CampaignItemType>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`/api/campaigns/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          const result = await response.json();
          if (result.success) {
            const updated: CampaignItemType = result.data;
            set((state) => ({
              campaigns: state.campaigns.map((c) => (c.id === id ? updated : c)),
              activeCampaign: state.activeCampaign?.id === id ? updated : state.activeCampaign,
              isLoading: false,
            }));
          } else {
            set({ error: result.error, isLoading: false });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update campaign';
          set({ error: message, isLoading: false });
        }
      },

      deleteCampaign: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`/api/campaigns/${id}`, {
            method: 'DELETE',
          });
          const result = await response.json();
          if (result.success) {
            set((state) => ({
              campaigns: state.campaigns.filter((c) => c.id !== id),
              activeCampaign: state.activeCampaign?.id === id ? null : state.activeCampaign,
              isLoading: false,
            }));
          } else {
            set({ error: result.error, isLoading: false });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to delete campaign';
          set({ error: message, isLoading: false });
        }
      },

      setActiveCampaign: (campaign: CampaignItemType | null) => {
        set({ activeCampaign: campaign });
      },

      setFilter: <K extends keyof CampaignFilters>(key: K, value: CampaignFilters[K]) => {
        set((state) => ({
          filters: { ...state.filters, [key]: value },
        }));
      },

      resetFilters: () => {
        set({ filters: { ...defaultFilters } });
      },
    }),
    { name: 'sms-shield-campaigns' }
  )
);
