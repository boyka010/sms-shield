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
  updateSettings: (settings: Partial<ShopSettings>) => Promise<ShopSettings>;
  setShop: (shop: Shop) => void;
}

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
          const res = await fetch(`/api/shop?shopDomain=${get().currentShop?.shopifyDomain || 'sms-shield-demo.myshopify.com'}`);
          const data = await res.json();
          if (data.success) {
            set({ currentShop: data.data, isLoading: false });
          } else {
            set({ error: data.error, isLoading: false });
          }
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch shop', isLoading: false });
        }
      },

      fetchSettings: async () => {
        try {
          const shopId = get().currentShop?.id || 'demo-shop-1';
          const res = await fetch(`/api/settings?shopId=${shopId}`);
          const data = await res.json();
          if (data.success) set({ settings: data.data });
        } catch (err) {
          console.error('Failed to fetch settings:', err);
        }
      },

      updateSettings: async (newSettings: Partial<ShopSettings>): Promise<ShopSettings> => {
        try {
          const shopId = get().currentShop?.id || 'demo-shop-1';
          const res = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shopId, ...newSettings }),
          });
          const data = await res.json();
          if (data.success) {
            set({ settings: data.data });
            return data.data;
          }
          throw new Error(data.error);
        } catch (err) {
          throw err;
        }
      },

      setShop: (shop: Shop) => {
        set({ currentShop: shop });
      },
    }),
    { name: 'sms-shield-shop' }
  )
);
