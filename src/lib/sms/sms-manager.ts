// =============================================================================
// SMS Manager — Central orchestrator with automatic gateway failover
// Enterprise Shopify App — SMS Adapter Pattern
// =============================================================================

import type {
  SMSMessagePayload,
  SMSMessageResponse,
  SMSBatchPayload,
  SMSBatchResponse,
  SMSBalanceResponse,
  SMSHealthCheckResult,
  SMSGatewayConfig,
  SMSGatewayType,
} from './types';
import { BaseSMSGateway } from './base-gateway';
import { SMSMisrAdapter } from './sms-misr';
import { VictoryLinkAdapter } from './victory-link';
import { WEGatewayAdapter } from './we-gateway';

// -----------------------------------------------------------------------------
// Manager configuration
// -----------------------------------------------------------------------------

export interface SMSManagerConfig {
  shopId: string;
  /** Decrypted gateway configs — the manager sorts by priority internally */
  gateways: SMSGatewayConfig[];
  /** Maximum number of different gateways to try before giving up (default 2) */
  maxGlobalRetries?: number;
  /** Enable console logging for debugging (default true) */
  enableLogging?: boolean;
}

// -----------------------------------------------------------------------------
// Metrics
// -----------------------------------------------------------------------------

export interface GatewayMetricSnapshot {
  sent: number;
  failed: number;
  avgLatencyMs: number;
}

export interface SMSManagerMetrics {
  totalSent: number;
  totalFailed: number;
  totalRetried: number;
  gatewayStats: Partial<Record<SMSGatewayType, GatewayMetricSnapshot>>;
}

// -----------------------------------------------------------------------------
// SMS Manager
// -----------------------------------------------------------------------------

export class SMSManager {
  private gateways: BaseSMSGateway[] = [];
  private config: Required<SMSManagerConfig>;
  private metrics: SMSManagerMetrics;

  constructor(config: SMSManagerConfig) {
    this.config = {
      maxGlobalRetries: 2,
      enableLogging: true,
      ...config,
    };

    this.metrics = {
      totalSent: 0,
      totalFailed: 0,
      totalRetried: 0,
      gatewayStats: {},
    };

    this.initializeGateways();
    this.log('SMS Manager initialized', {
      shopId: this.config.shopId,
      activeGateways: this.gateways.map((g) => g.gatewayType),
      maxGlobalRetries: this.config.maxGlobalRetries,
    });
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  private initializeGateways(): void {
    // Sort by priority (lower number = higher priority = tried first)
    const sorted = [...this.config.gateways].sort((a, b) => a.priority - b.priority);

    for (const gwConfig of sorted) {
      if (!gwConfig.isActive) {
        this.log(`Skipping inactive gateway: ${gwConfig.gatewayType}`);
        continue;
      }

      try {
        const gateway = this.createGateway(gwConfig);
        this.gateways.push(gateway);
        this.metrics.gatewayStats[gwConfig.gatewayType] = {
          sent: 0,
          failed: 0,
          avgLatencyMs: 0,
        };
      } catch (error) {
        this.log(`Failed to create gateway ${gwConfig.gatewayType}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (this.gateways.length === 0) {
      this.log('WARNING: No active SMS gateways configured!', { shopId: this.config.shopId });
    }
  }

  private createGateway(gwConfig: SMSGatewayConfig): BaseSMSGateway {
    switch (gwConfig.gatewayType) {
      case 'SMS_MISR':
        return new SMSMisrAdapter(gwConfig);
      case 'VICTORY_LINK':
        return new VictoryLinkAdapter(gwConfig);
      case 'WE_API':
        return new WEGatewayAdapter(gwConfig);
      default:
        throw new Error(`Unknown gateway type: ${gwConfig.gatewayType as string}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Send single SMS with automatic failover
  // ---------------------------------------------------------------------------

  /**
   * Send a single SMS. On failure, automatically tries the next available
   * gateway (up to `maxGlobalRetries` gateways total).
   */
  async send(payload: SMSMessagePayload): Promise<SMSMessageResponse> {
    if (this.gateways.length === 0) {
      return this.buildNoGatewayResponse(payload.recipientPhone);
    }

    const maxAttempts = Math.min(this.config.maxGlobalRetries, this.gateways.length);
    let lastResponse: SMSMessageResponse | null = null;

    for (let i = 0; i < maxAttempts; i++) {
      const gateway = this.gateways[i];

      try {
        const startTime = Date.now();
        const response = await gateway.send(payload);
        const endToEndLatency = Date.now() - startTime;

        if (response.success) {
          this.recordSuccess(response, endToEndLatency);
          this.log('SMS sent successfully', {
            gateway: gateway.gatewayType,
            recipient: payload.recipientPhone,
            externalId: response.externalMessageId,
            latencyMs: response.latencyMs,
            endToEndMs: endToEndLatency,
          });
          return response;
        }

        // Gateway returned a failure
        lastResponse = response;
        this.recordFailure(response, endToEndLatency);
        this.log('SMS send failed', {
          gateway: gateway.gatewayType,
          recipient: payload.recipientPhone,
          code: response.statusCode,
          message: response.statusMessage,
          retryable: response.retryable,
        });

        // Decide whether to failover to the next gateway
        if (i + 1 < maxAttempts) {
          if (response.retryable) {
            this.metrics.totalRetried++;
            this.log('Failover: trying next gateway', {
              from: gateway.gatewayType,
              to: this.gateways[i + 1]?.gatewayType,
            });
            continue;
          }
          // Non-retryable but we have another gateway — still try it
          // (a validation error on one gateway might not exist on another)
          this.metrics.totalRetried++;
          this.log('Non-retryable error but attempting next gateway', {
            from: gateway.gatewayType,
            to: this.gateways[i + 1]?.gatewayType,
          });
          continue;
        }
      } catch (error) {
        // Gateway threw an exception entirely
        const errorMessage = error instanceof Error ? error.message : String(error);
        lastResponse = this.buildErrorResponse(gateway.gatewayType, payload.recipientPhone, errorMessage);

        this.recordFailure(lastResponse, 0);
        this.log('SMS gateway exception', {
          gateway: gateway.gatewayType,
          recipient: payload.recipientPhone,
          error: errorMessage,
        });

        if (i + 1 < maxAttempts) {
          this.metrics.totalRetried++;
          this.log('Failover after exception: trying next gateway', {
            from: gateway.gatewayType,
            to: this.gateways[i + 1]?.gatewayType,
          });
          continue;
        }
      }
    }

    return lastResponse ?? this.buildNoGatewayResponse(payload.recipientPhone);
  }

  // ---------------------------------------------------------------------------
  // Send batch SMS with automatic failover for failed recipients
  // ---------------------------------------------------------------------------

  /**
   * Send a batch of SMS messages. If the primary gateway partially fails,
   * retryable failures are automatically re-sent via the next gateway.
   */
  async sendBatch(payload: SMSBatchPayload): Promise<SMSBatchResponse> {
    if (this.gateways.length === 0) {
      return this.buildNoGatewayBatchResponse(payload.recipients);
    }

    // Use primary gateway
    const primaryGateway = this.gateways[0];
    const startTime = Date.now();

    try {
      const primaryResponse = await primaryGateway.sendBatch(payload);
      const primaryLatency = Date.now() - startTime;

      // Record all results
      for (const result of primaryResponse.results) {
        if (result.success) {
          this.recordSuccess(result, 0);
        } else {
          this.recordFailure(result, 0);
        }
      }

      // If everything succeeded, return immediately
      if (primaryResponse.failedCount === 0) {
        this.log('Batch sent successfully', {
          gateway: primaryGateway.gatewayType,
          total: primaryResponse.totalRecipients,
        });
        return { ...primaryResponse, totalLatencyMs: primaryLatency };
      }

      // If there are retryable failures and we have a backup gateway, retry them
      const retryableFailures = primaryResponse.results.filter(
        (r) => !r.success && r.retryable,
      );
      const nonRetryableFailures = primaryResponse.results.filter(
        (r) => !r.success && !r.retryable,
      );

      if (retryableFailures.length > 0 && this.gateways.length > 1) {
        const backupGateway = this.gateways[1];
        const failedRecipients = retryableFailures.map((r) => r.recipientPhone);

        this.log('Retrying batch failures on backup gateway', {
          backupGateway: backupGateway.gatewayType,
          retryCount: failedRecipients.length,
        });

        const retryPayload: SMSBatchPayload = {
          ...payload,
          recipients: failedRecipients,
        };

        const retryResponse = await backupGateway.sendBatch(retryPayload);

        // Record retry results
        for (const result of retryResponse.results) {
          if (result.success) {
            this.recordSuccess(result, 0);
            this.metrics.totalRetried++;
          } else {
            this.recordFailure(result, 0);
            this.metrics.totalRetried++;
          }
        }

        // Merge results: successes from primary + non-retryable + retry results
        const mergedResults = [
          ...primaryResponse.results.filter((r) => r.success),
          ...retryResponse.results,
          ...nonRetryableFailures,
        ];

        const finalSuccessCount = mergedResults.filter((r) => r.success).length;
        const finalFailCount = mergedResults.filter((r) => !r.success).length;
        const totalLatencyMs = Date.now() - startTime;

        this.log('Batch completed with failover', {
          primaryGateway: primaryGateway.gatewayType,
          backupGateway: backupGateway.gatewayType,
          success: finalSuccessCount,
          failed: finalFailCount,
        });

        return {
          totalRecipients: payload.recipients.length,
          successfulCount: finalSuccessCount,
          failedCount: finalFailCount,
          results: mergedResults,
          gatewayType: primaryGateway.gatewayType,
          totalLatencyMs,
        };
      }

      // No backup gateway or no retryable failures
      return { ...primaryResponse, totalLatencyMs: primaryLatency };
    } catch (error) {
      // Primary gateway threw an exception — try backup gateway with all recipients
      if (this.gateways.length > 1) {
        const backupGateway = this.gateways[1];
        const errorMessage = error instanceof Error ? error.message : String(error);

        this.log('Primary gateway exception, failing over entire batch', {
          from: primaryGateway.gatewayType,
          to: backupGateway.gatewayType,
          error: errorMessage,
        });

        this.metrics.totalRetried += payload.recipients.length;

        try {
          const backupResponse = await backupGateway.sendBatch(payload);

          for (const result of backupResponse.results) {
            if (result.success) {
              this.recordSuccess(result, 0);
            } else {
              this.recordFailure(result, 0);
            }
          }

          return { ...backupResponse, totalLatencyMs: Date.now() - startTime };
        } catch {
          // Both gateways failed
          return this.buildNoGatewayBatchResponse(payload.recipients);
        }
      }

      // Only one gateway and it threw
      return this.buildNoGatewayBatchResponse(payload.recipients);
    }
  }

  // ---------------------------------------------------------------------------
  // Balance & health checks
  // ---------------------------------------------------------------------------

  /** Query balance from all configured gateways in parallel */
  async checkAllBalances(): Promise<Map<SMSGatewayType, SMSBalanceResponse>> {
    const results = new Map<SMSGatewayType, SMSBalanceResponse>();

    const checks = this.gateways.map(async (gateway) => {
      try {
        const balance = await gateway.getBalance();
        results.set(gateway.gatewayType, balance);
      } catch (error) {
        results.set(gateway.gatewayType, {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    await Promise.allSettled(checks);
    return results;
  }

  /** Run health checks against all configured gateways in parallel */
  async healthCheckAll(): Promise<SMSHealthCheckResult[]> {
    const checks = this.gateways.map(async (gateway) => {
      try {
        return await gateway.healthCheck();
      } catch (error) {
        return {
          gatewayType: gateway.gatewayType,
          isHealthy: false,
          latencyMs: 0,
          lastError: error instanceof Error ? error.message : 'Unknown error',
          checkedAt: new Date(),
        } satisfies SMSHealthCheckResult;
      }
    });

    const settled = await Promise.allSettled(checks);

    return settled.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      return {
        gatewayType: 'SMS_MISR' as SMSGatewayType,
        isHealthy: false,
        latencyMs: 0,
        lastError: 'Health check promise rejected',
        checkedAt: new Date(),
      } satisfies SMSHealthCheckResult;
    });
  }

  /**
   * Get a summary of the best (highest priority, healthy) gateway.
   * Useful for determining which gateway to show in the admin UI.
   */
  async getRecommendedGateway(): Promise<{
    gatewayType: SMSGatewayType;
    isHealthy: boolean;
    latencyMs: number;
  } | null> {
    const healthResults = await this.healthCheckAll();

    for (const result of healthResults) {
      if (result.isHealthy) {
        return {
          gatewayType: result.gatewayType,
          isHealthy: true,
          latencyMs: result.latencyMs,
        };
      }
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Metrics
  // ---------------------------------------------------------------------------

  /** Return a snapshot of current metrics */
  getMetrics(): SMSManagerMetrics {
    return {
      totalSent: this.metrics.totalSent,
      totalFailed: this.metrics.totalFailed,
      totalRetried: this.metrics.totalRetried,
      gatewayStats: { ...this.metrics.gatewayStats },
    };
  }

  /** Reset all counters to zero */
  resetMetrics(): void {
    this.metrics = {
      totalSent: 0,
      totalFailed: 0,
      totalRetried: 0,
      gatewayStats: {},
    };
    for (const gw of this.gateways) {
      this.metrics.gatewayStats[gw.gatewayType] = {
        sent: 0,
        failed: 0,
        avgLatencyMs: 0,
      };
    }
  }

  /** Get the list of active gateway types in priority order */
  getActiveGateways(): SMSGatewayType[] {
    return this.gateways.map((g) => g.gatewayType);
  }

  /** Get the total number of active gateways */
  getGatewayCount(): number {
    return this.gateways.length;
  }

  // ---------------------------------------------------------------------------
  // Internal: metrics recording
  // ---------------------------------------------------------------------------

  private recordSuccess(response: SMSMessageResponse, latency: number): void {
    this.metrics.totalSent++;
    const stats = this.metrics.gatewayStats[response.gatewayType];
    if (stats) {
      stats.sent++;
      // Running average: new_avg = ((old_avg * (n-1)) + new_val) / n
      stats.avgLatencyMs = (stats.avgLatencyMs * (stats.sent - 1) + latency) / stats.sent;
    }
  }

  private recordFailure(response: SMSMessageResponse, _latency: number): void {
    this.metrics.totalFailed++;
    const stats = this.metrics.gatewayStats[response.gatewayType];
    if (stats) {
      stats.failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal: response builders
  // ---------------------------------------------------------------------------

  private buildNoGatewayResponse(recipientPhone: string): SMSMessageResponse {
    return {
      success: false,
      recipientPhone,
      gatewayType: 'SMS_MISR',
      statusMessage: 'No active SMS gateways configured',
      latencyMs: 0,
      timestamp: new Date(),
      retryable: false,
    };
  }

  private buildNoGatewayBatchResponse(recipients: string[]): SMSBatchResponse {
    return {
      totalRecipients: recipients.length,
      successfulCount: 0,
      failedCount: recipients.length,
      results: recipients.map((phone) => ({
        success: false,
        recipientPhone: phone,
        gatewayType: 'SMS_MISR' as SMSGatewayType,
        statusMessage: 'No active SMS gateways configured',
        latencyMs: 0,
        timestamp: new Date(),
        retryable: false,
      })),
      gatewayType: 'SMS_MISR',
      totalLatencyMs: 0,
    };
  }

  private buildErrorResponse(
    gatewayType: SMSGatewayType,
    recipientPhone: string,
    message: string,
  ): SMSMessageResponse {
    return {
      success: false,
      recipientPhone,
      gatewayType,
      statusMessage: message,
      latencyMs: 0,
      timestamp: new Date(),
      retryable: !message.includes('Invalid') &&
                !message.includes('Unauthorized') &&
                !message.includes('Forbidden'),
    };
  }

  // ---------------------------------------------------------------------------
  // Internal: logging
  // ---------------------------------------------------------------------------

  private log(message: string, meta?: Record<string, unknown>): void {
    if (!this.config.enableLogging) return;

    const timestamp = new Date().toISOString();
    const prefix = `[SMSManager:${this.config.shopId}]`;

    if (meta) {
      console.log(`${prefix} ${timestamp} — ${message}`, meta);
    } else {
      console.log(`${prefix} ${timestamp} — ${message}`);
    }
  }
}

// -----------------------------------------------------------------------------
// Factory function
// -----------------------------------------------------------------------------

/**
 * Create an SMSManager instance. This is the recommended entry point.
 *
 * @example
 * ```ts
 * const manager = createSMSManager({
 *   shopId: 'shop-myshop.myshopify.com',
 *   gateways: [
 *     {
 *       id: 'gw-1',
 *       shopId: 'shop-myshop.myshopify.com',
 *       gatewayType: 'SMS_MISR',
 *       username: 'my-user',
 *       password: 'my-pass',
 *       senderName: 'MyShop',
 *       isActive: true,
 *       priority: 1,
 *     },
 *     {
 *       id: 'gw-2',
 *       shopId: 'shop-myshop.myshopify.com',
 *       gatewayType: 'VICTORY_LINK',
 *       username: 'my-user',
 *       password: 'my-pass',
 *       apiKey: 'vl-key-abc123',
 *       senderName: 'MyShop',
 *       isActive: true,
 *       priority: 2,
 *     },
 *   ],
 * });
 *
 * const result = await manager.send({
 *   recipientPhone: '+201012345678',
 *   message: 'Hello from MyShop! Your order #1234 has been confirmed.',
 * });
 * ```
 */
export function createSMSManager(config: SMSManagerConfig): SMSManager {
  return new SMSManager(config);
}
