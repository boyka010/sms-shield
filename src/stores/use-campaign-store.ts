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

const API_BASE = '/api';

export const useCampaignStore = create<CampaignState>()(
  devtools(
    (set, get) => ({
      campaigns: [],
      activeCampaign: null,
      isLoading: false,
      error: null,
      filters: { ...defaultFilters },

      fetchCampaigns: async () => {
        set({ isLoading: true, error: null });
        try {
          const { filters } = get();
          const params = new URLSearchParams();

          if (filters.status && filters.status !== 'all') params.set('status', filters.status);
          if (filters.type && filters.type !== 'all') params.set('type', filters.type);
          if (filters.search) params.set('search', filters.search);

          const response = await fetch(`${API_BASE}/campaigns?${params.toString()}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch campaigns: ${response.statusText}`);
          }
          const data = await response.json();
          set({ campaigns: data, isLoading: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch campaigns';
          set({ error: message, isLoading: false });
        }
      },

      createCampaign: async (campaign: Partial<CampaignItemType>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_BASE}/campaigns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(campaign),
          });
          if (!response.ok) {
            throw new Error(`Failed to create campaign: ${response.statusText}`);
          }
          const data: CampaignItemType = await response.json();
          set((state) => ({
            campaigns: [data, ...state.campaigns],
            activeCampaign: data,
            isLoading: false,
          }));
          return data;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to create campaign';
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      updateCampaign: async (id: string, data: Partial<CampaignItemType>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_BASE}/campaigns/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!response.ok) {
            throw new Error(`Failed to update campaign: ${response.statusText}`);
          }
          const updated: CampaignItemType = await response.json();
          set((state) => ({
            campaigns: state.campaigns.map((c) => (c.id === id ? updated : c)),
            activeCampaign: state.activeCampaign?.id === id ? updated : state.activeCampaign,
            isLoading: false,
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update campaign';
          set({ error: message, isLoading: false });
        }
      },

      deleteCampaign: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_BASE}/campaigns/${id}`, {
            method: 'DELETE',
          });
          if (!response.ok) {
            throw new Error(`Failed to delete campaign: ${response.statusText}`);
          }
          set((state) => ({
            campaigns: state.campaigns.filter((c) => c.id !== id),
            activeCampaign: state.activeCampaign?.id === id ? null : state.activeCampaign,
            isLoading: false,
          }));
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
