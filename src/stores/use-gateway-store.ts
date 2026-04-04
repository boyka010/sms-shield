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

const API_BASE = '/api';

export const useGatewayStore = create<GatewayState>()(
  devtools(
    (set, get) => ({
      gateways: [],
      healthChecks: new Map<string, HealthCheckResult>(),
      balances: new Map<string, GatewayBalance>(),
      isLoading: false,
      error: null,

      fetchGateways: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_BASE}/gateways`);
          if (!response.ok) {
            throw new Error(`Failed to fetch gateways: ${response.statusText}`);
          }
          const data: GatewayConfigType[] = await response.json();

          const healthMap = new Map<string, HealthCheckResult>();
          const balanceMap = new Map<string, GatewayBalance>();
          data.forEach((gateway) => {
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
            gateways: data,
            healthChecks: healthMap,
            balances: balanceMap,
            isLoading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch gateway configurations';
          set({ error: message, isLoading: false });
        }
      },

      addGateway: async (gateway: Partial<GatewayConfigType>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_BASE}/gateways`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gateway),
          });
          if (!response.ok) {
            throw new Error(`Failed to add gateway: ${response.statusText}`);
          }
          const data: GatewayConfigType = await response.json();
          set((state) => ({
            gateways: [...state.gateways, data].sort((a, b) => a.priority - b.priority),
            isLoading: false,
          }));
          return data;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to add gateway';
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      updateGateway: async (id: string, data: Partial<GatewayConfigType>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_BASE}/gateways/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!response.ok) {
            throw new Error(`Failed to update gateway: ${response.statusText}`);
          }
          const updated: GatewayConfigType = await response.json();
          set((state) => ({
            gateways: state.gateways
              .map((g) => (g.id === id ? updated : g))
              .sort((a, b) => a.priority - b.priority),
            isLoading: false,
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update gateway';
          set({ error: message, isLoading: false });
        }
      },

      deleteGateway: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_BASE}/gateways/${id}`, {
            method: 'DELETE',
          });
          if (!response.ok) {
            throw new Error(`Failed to delete gateway: ${response.statusText}`);
          }
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
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to delete gateway';
          set({ error: message, isLoading: false });
        }
      },

      checkHealth: async (id?: string) => {
        set({ isLoading: true, error: null });
        try {
          const targetId = id ?? 'all';
          const url = id
            ? `${API_BASE}/gateways/${id}/health`
            : `${API_BASE}/gateways/health`;
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Health check failed: ${response.statusText}`);
          }
          const results: HealthCheckResult[] = await response.json();

          set((state) => {
            const newHealthChecks = new Map(state.healthChecks);
            results.forEach((result) => {
              newHealthChecks.set(result.gatewayId, result);
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
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Health check failed';
          set({ error: message, isLoading: false });
        }
      },

      checkBalances: async (id?: string) => {
        set({ isLoading: true, error: null });
        try {
          const url = id
            ? `${API_BASE}/gateways/${id}/balance`
            : `${API_BASE}/gateways/balance`;
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Balance check failed: ${response.statusText}`);
          }
          const results: GatewayBalance[] = await response.json();

          set((state) => {
            const newBalances = new Map(state.balances);
            results.forEach((balance) => {
              newBalances.set(balance.gatewayId, balance);
            });
            return { balances: newBalances, isLoading: false };
          });
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
