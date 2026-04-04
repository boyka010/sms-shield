import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface Shop {
  id: string;
  shopifyDomain: string;
  plan: string;
  isActive: boolean;
  currency: string;
}

interface ShopSettings {
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

interface ShopState {
  currentShop: Shop | null;
  settings: ShopSettings | null;
  isLoading: boolean;
  error: string | null;
  fetchShop: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<ShopSettings>) => Promise<void>;
  setShop: (shop: Shop) => void;
}

const API_BASE = '/api';

export const useShopStore = create<ShopState>()(
  devtools(
    (set, get) => ({
      currentShop: null,
      settings: null,
      isLoading: false,
      error: null,

      fetchShop: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_BASE}/shop`);
          if (!response.ok) {
            throw new Error(`Failed to fetch shop: ${response.statusText}`);
          }
          const data = await response.json();
          set({ currentShop: data, isLoading: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch shop data';
          set({ error: message, isLoading: false });
        }
      },

      fetchSettings: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_BASE}/shop/settings`);
          if (!response.ok) {
            throw new Error(`Failed to fetch settings: ${response.statusText}`);
          }
          const data = await response.json();
          set({ settings: data, isLoading: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch shop settings';
          set({ error: message, isLoading: false });
        }
      },

      updateSettings: async (settings: Partial<ShopSettings>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_BASE}/shop/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
          });
          if (!response.ok) {
            throw new Error(`Failed to update settings: ${response.statusText}`);
          }
          const data = await response.json();
          set({ settings: data, isLoading: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update shop settings';
          set({ error: message, isLoading: false });
        }
      },

      setShop: (shop: Shop) => {
        set({ currentShop: shop });
      },
    }),
    { name: 'sms-shield-shop' }
  )
);
