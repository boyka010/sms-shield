import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type GatewayType = 'SMS_MISR' | 'VICTORY_LINK' | 'WE_API';
export type HealthStatus = 'unknown' | 'healthy' | 'degraded' | 'down';

export interface GatewayConfigType {
  id: string;
  shopId: string;
  gatewayType: GatewayType;
  encryptedUsername: string;
  encryptedPassword: string;
  encryptedApiKey: string | null;
  senderName: string;
  isActive: boolean;
  priority: number;
  lastHealthCheckAt: string | null;
  healthStatus: HealthStatus;
  createdAt: string;
  updatedAt: string;
  // API response includes masked fields
  maskedUsername?: string;
  maskedPassword?: string;
  hasApiKey?: boolean;
  maskedApiKey?: string | null;
}

export interface HealthCheckResult {
  gatewayId: string;
  status: HealthStatus;
  latencyMs: number | null;
  checkedAt: string;
  errorMessage: string | null;
}

export interface GatewayBalance {
  gatewayId: string;
  balance: number;
  currency: string;
  checkedAt: string;
}

interface GatewayState {
  gateways: GatewayConfigType[];
  healthChecks: Map<string, HealthCheckResult>;
  balances: Map<string, GatewayBalance>;
  isLoading: boolean;
  error: string | null;
  fetchGateways: () => Promise<void>;
  addGateway: (gateway: Partial<GatewayConfigType>) => Promise<GatewayConfigType>;
  updateGateway: (id: string, data: Partial<GatewayConfigType>) => Promise<void>;
  deleteGateway: (id: string) => Promise<void>;
  checkHealth: (id?: string) => Promise<void>;
  checkBalances: (id?: string) => Promise<void>;
  setHealthCheck: (gatewayId: string, result: HealthCheckResult) => void;
  setBalance: (gatewayId: string, balance: GatewayBalance) => void;
}

export const useGatewayStore = create<GatewayState>()(
  devtools(
    (set, get) => ({
      gateways: [],
      healthChecks: new Map<string, HealthCheckResult>(),
      balances: new Map<string, GatewayBalance>(),
      isLoading: false,
      error: null,

      fetchGateways: async () => {
        set({ isLoading: true });
        try {
          const shopId = 'demo-shop-1';
          const res = await fetch(`/api/gateways?shopId=${shopId}`);
          const data = await res.json();
          if (data.success) {
            const gateways = data.data || [];

            const healthMap = new Map<string, HealthCheckResult>();
            gateways.forEach((gateway: GatewayConfigType) => {
              if (gateway.lastHealthCheckAt) {
                healthMap.set(gateway.id, {
                  gatewayId: gateway.id,
                  status: gateway.healthStatus,
                  latencyMs: null,
                  checkedAt: gateway.lastHealthCheckAt,
                  errorMessage: null,
                });
              }
            });

            set({
              gateways,
              healthChecks: healthMap,
              isLoading: false,
            });
          }
        } catch {
          set({ isLoading: false });
        }
      },

      addGateway: async (gateway: Partial<GatewayConfigType>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch('/api/gateways', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gateway),
          });
          const result = await response.json();
          if (result.success) {
            const data: GatewayConfigType = result.data;
            set((state) => ({
              gateways: [...state.gateways, data].sort((a, b) => a.priority - b.priority),
              isLoading: false,
            }));
            return data;
          }
          throw new Error(result.error);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to add gateway';
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      updateGateway: async (id: string, data: Partial<GatewayConfigType>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch('/api/gateways', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, ...data }),
          });
          const result = await response.json();
          if (result.success) {
            const updated: GatewayConfigType = result.data;
            set((state) => ({
              gateways: state.gateways
                .map((g) => (g.id === id ? updated : g))
                .sort((a, b) => a.priority - b.priority),
              isLoading: false,
            }));
          } else {
            set({ error: result.error, isLoading: false });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update gateway';
          set({ error: message, isLoading: false });
        }
      },

      deleteGateway: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch('/api/gateways', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          });
          const result = await response.json();
          if (result.success) {
            set((state) => {
              const newHealthChecks = new Map(state.healthChecks);
              newHealthChecks.delete(id);
              const newBalances = new Map(state.balances);
              newBalances.delete(id);
              return {
                gateways: state.gateways.filter((g) => g.id !== id),
                healthChecks: newHealthChecks,
                balances: newBalances,
                isLoading: false,
              };
            });
          } else {
            set({ error: result.error, isLoading: false });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to delete gateway';
          set({ error: message, isLoading: false });
        }
      },

      checkHealth: async (id?: string) => {
        set({ isLoading: true, error: null });
        try {
          const url = id
            ? `/api/gateways/${id}/health`
            : '/api/gateways/health';
          const response = await fetch(url);
          const result = await response.json();
          if (result.success) {
            const results: HealthCheckResult[] = result.data;

            set((state) => {
              const newHealthChecks = new Map(state.healthChecks);
              results.forEach((r) => {
                newHealthChecks.set(r.gatewayId, r);
              });

              const updatedGateways = state.gateways.map((gateway) => {
                const healthResult = newHealthChecks.get(gateway.id);
                if (healthResult) {
                  return { ...gateway, healthStatus: healthResult.status, lastHealthCheckAt: healthResult.checkedAt };
                }
                return gateway;
              });

              return { gateways: updatedGateways, healthChecks: newHealthChecks, isLoading: false };
            });
          } else {
            set({ error: result.error, isLoading: false });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Health check failed';
          set({ error: message, isLoading: false });
        }
      },

      checkBalances: async (id?: string) => {
        set({ isLoading: true, error: null });
        try {
          const url = id
            ? `/api/gateways/${id}/balance`
            : '/api/gateways/balance';
          const response = await fetch(url);
          const result = await response.json();
          if (result.success) {
            const results: GatewayBalance[] = result.data;

            set((state) => {
              const newBalances = new Map(state.balances);
              results.forEach((balance) => {
                newBalances.set(balance.gatewayId, balance);
              });
              return { balances: newBalances, isLoading: false };
            });
          } else {
            set({ error: result.error, isLoading: false });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Balance check failed';
          set({ error: message, isLoading: false });
        }
      },

      setHealthCheck: (gatewayId: string, result: HealthCheckResult) => {
        set((state) => {
          const newHealthChecks = new Map(state.healthChecks);
          newHealthChecks.set(gatewayId, result);
          return { healthChecks: newHealthChecks };
        });
      },

      setBalance: (gatewayId: string, balance: GatewayBalance) => {
        set((state) => {
          const newBalances = new Map(state.balances);
          newBalances.set(gatewayId, balance);
          return { balances: newBalances };
        });
      },
    }),
    { name: 'sms-shield-gateways' }
  )
);
