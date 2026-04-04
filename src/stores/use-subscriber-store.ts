import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

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
  source: 'popup' | 'checkout' | 'api' | 'import';
  discountCodeId: string | null;
  isVerified: boolean;
  tags: string[];
  totalOrdersCount: number;
  totalRevenue: number;
  lastOrderAt: string | null;
  firstOrderAt: string | null;
  createdAt: string;
  updatedAt: string;
  maskedPhone?: string;
  discountCode?: {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
    isActive: boolean;
  };
}

export interface SubscriberFilters {
  search: string;
  segment: string;
  source: string;
  isVerified: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

interface SubscriberState {
  subscribers: SubscriberType[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  filters: SubscriberFilters;
  selectedIds: Set<string>;
  fetchSubscribers: () => Promise<void>;
  setSearch: (search: string) => void;
  setFilter: <K extends keyof SubscriberFilters>(key: K, value: SubscriberFilters[K]) => void;
  resetFilters: () => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  deleteSelected: () => Promise<void>;
}

const defaultFilters: SubscriberFilters = {
  search: '',
  segment: 'all',
  source: 'all',
  isVerified: 'all',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  page: 1,
  pageSize: 25,
};

export const useSubscriberStore = create<SubscriberState>()(
  devtools(
    (set, get) => ({
      subscribers: [],
      totalCount: 0,
      isLoading: false,
      error: null,
      filters: { ...defaultFilters },
      selectedIds: new Set<string>(),

      fetchSubscribers: async () => {
        set({ isLoading: true, error: null });
        try {
          const { search, segment, source, isVerified, sortBy, sortOrder, page, pageSize } = get().filters;
          const shopId = 'demo-shop-1';
          const params = new URLSearchParams({
            shopId,
            page: String(page),
            pageSize: String(pageSize),
            ...(search && { search }),
            ...(segment && segment !== 'all' && { segment }),
            ...(source && source !== 'all' && { source }),
            ...(isVerified !== 'all' && { isVerified }),
            sortBy: sortBy || 'createdAt',
            sortOrder: sortOrder || 'desc',
          });
          const res = await fetch(`/api/subscribers?${params}`);
          const data = await res.json();
          if (data.success) {
            set({
              subscribers: data.data || [],
              totalCount: data.pagination?.total || 0,
              isLoading: false,
            });
          } else {
            set({ error: data.error, isLoading: false });
          }
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch', isLoading: false });
        }
      },

      setSearch: (search: string) => {
        set((state) => ({
          filters: { ...state.filters, search, page: 1 },
        }));
      },

      setFilter: <K extends keyof SubscriberFilters>(key: K, value: SubscriberFilters[K]) => {
        set((state) => ({
          filters: { ...state.filters, [key]: value, page: key === 'page' ? value : 1 } as SubscriberFilters,
        }));
      },

      resetFilters: () => {
        set({ filters: { ...defaultFilters }, selectedIds: new Set<string>() });
      },

      toggleSelect: (id: string) => {
        set((state) => {
          const newSelected = new Set(state.selectedIds);
          if (newSelected.has(id)) {
            newSelected.delete(id);
          } else {
            newSelected.add(id);
          }
          return { selectedIds: newSelected };
        });
      },

      selectAll: () => {
        set((state) => {
          const newSelected = new Set<string>();
          state.subscribers.forEach((subscriber) => newSelected.add(subscriber.id));
          return { selectedIds: newSelected };
        });
      },

      clearSelection: () => {
        set({ selectedIds: new Set<string>() });
      },

      deleteSelected: async () => {
        set({ isLoading: true, error: null });
        try {
          const { selectedIds } = get();
          if (selectedIds.size === 0) {
            set({ isLoading: false });
            return;
          }

          const response = await fetch('/api/subscribers/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedIds) }),
          });

          if (!response.ok) {
            throw new Error(`Failed to delete subscribers: ${response.statusText}`);
          }

          const data = await response.json();
          if (data.success) {
            set((state) => ({
              subscribers: state.subscribers.filter((s) => !selectedIds.has(s.id)),
              totalCount: state.totalCount - selectedIds.size,
              selectedIds: new Set<string>(),
              isLoading: false,
            }));
          } else {
            set({ error: data.error, isLoading: false });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to delete subscribers';
          set({ error: message, isLoading: false });
        }
      },
    }),
    { name: 'sms-shield-subscribers' }
  )
);
