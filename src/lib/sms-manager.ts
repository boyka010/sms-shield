// ─────────────────────────────────────────────────────────────────────────────
// SMS-Shield SMS Manager — Multi-gateway SMS sender with failover
// ─────────────────────────────────────────────────────────────────────────────

import { decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';

/** Get the app-level encryption key from environment. */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  return key;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface GatewayConfig {
  id: string;
  provider: SMSProvider;
  encryptedApiKey: string;
  encryptedApiSecret?: string;
  senderName?: string;
  priority: number; // 1 = primary
  isActive: boolean;
}

export type SMSProvider = 'twilio' | 'vonage' | 'messagebird' | 'bulk_sms' | 'custom';

export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  gatewayId: string;
  provider: SMSProvider;
  status: 'sent' | 'delivered' | 'queued' | 'failed';
  errorCode?: string;
  errorMessage?: string;
  cost?: number;
  currency?: string;
}

export interface SendSMSParams {
  recipientPhone: string;
  message: string;
  senderName?: string;
  encoding?: 'GSM_7BIT' | 'UCS2' | 'AUTO';
  gatewayConfig: GatewayConfig;
}

// ── SMS Manager ──────────────────────────────────────────────────────────────

export class SMSManager {
  private gateways: GatewayConfig[];
  private shopId: string;
  private encryptionKey: string;

  constructor(shopId: string, gatewayConfigs: GatewayConfig[], encryptionKey?: string) {
    this.shopId = shopId;
    this.encryptionKey = encryptionKey ?? getEncryptionKey();
    this.gateways = gatewayConfigs
      .filter((g) => g.isActive)
      .sort((a, b) => a.priority - b.priority);
  }

  getGatewayCount(): number {
    return this.gateways.length;
  }

  /** Send SMS through primary gateway, with automatic failover to backups. */
  async sendWithFailover(
    recipientPhone: string,
    message: string,
    options?: { senderName?: string; encoding?: 'GSM_7BIT' | 'UCS2' | 'AUTO' },
  ): Promise<SendSMSResult> {
    if (this.gateways.length === 0) {
      return {
        success: false,
        gatewayId: 'none',
        provider: 'twilio',
        status: 'failed',
        errorCode: 'NO_GATEWAY',
        errorMessage: 'No active SMS gateway configured for this shop',
      };
    }

    const encoding = options?.encoding ?? 'AUTO';
    const senderName = options?.senderName;

    let lastError = '';

    for (const gateway of this.gateways) {
      try {
        const result = await this.sendViaGateway({
          recipientPhone,
          message,
          senderName,
          encoding,
          gatewayConfig: gateway,
        });

        if (result.success) {
          logger.info('SMS sent successfully', {
            shopId: this.shopId,
            gatewayId: gateway.id,
            provider: gateway.provider,
            messageId: result.messageId,
            recipient: recipientPhone,
          });
          return result;
        }

        lastError = result.errorMessage ?? `Gateway ${gateway.provider} returned failure`;
        logger.warn('SMS gateway returned failure, trying next gateway', {
          shopId: this.shopId,
          gatewayId: gateway.id,
          provider: gateway.provider,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
        });
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        logger.warn('SMS gateway error, trying next gateway', {
          shopId: this.shopId,
          gatewayId: gateway.id,
          provider: gateway.provider,
          error: lastError,
        });
      }
    }

    // All gateways exhausted
    return {
      success: false,
      gatewayId: this.gateways[this.gateways.length - 1]?.id ?? 'none',
      provider: this.gateways[this.gateways.length - 1]?.provider ?? 'twilio',
      status: 'failed',
      errorCode: 'ALL_GATEWAYS_FAILED',
      errorMessage: `All ${this.gateways.length} gateway(s) failed. Last error: ${lastError}`,
    };
  }

  /** Send via a specific gateway. Route to the appropriate provider implementation. */
  private async sendViaGateway(params: SendSMSParams): Promise<SendSMSResult> {
    const { gatewayConfig } = params;
    const decryptedKey = await decrypt(gatewayConfig.encryptedApiKey, this.encryptionKey);
    const decryptedSecret = gatewayConfig.encryptedApiSecret
      ? await decrypt(gatewayConfig.encryptedApiSecret, this.encryptionKey)
      : undefined;

    switch (gatewayConfig.provider) {
      case 'twilio':
        return this.sendViaTwilio(params, decryptedKey, decryptedSecret);
      case 'vonage':
        return this.sendViaVonage(params, decryptedKey, decryptedSecret);
      case 'messagebird':
        return this.sendViaMessageBird(params, decryptedKey, decryptedSecret);
      case 'bulk_sms':
        return this.sendViaBulkSMS(params, decryptedKey);
      case 'custom':
        return this.sendViaCustom(params, decryptedKey, decryptedSecret);
      default:
        return {
          success: false,
          gatewayId: gatewayConfig.id,
          provider: gatewayConfig.provider,
          status: 'failed',
          errorCode: 'UNKNOWN_PROVIDER',
          errorMessage: `Unknown SMS provider: ${gatewayConfig.provider}`,
        };
    }
  }

  // ── Provider implementations ──────────────────────────────────────────

  private async sendViaTwilio(
    params: SendSMSParams,
    accountSid: string,
    authToken: string | undefined,
  ): Promise<SendSMSResult> {
    try {
      // In production, use the twilio SDK:
      // const client = require('twilio')(accountSid, authToken);
      // const result = await client.messages.create({
      //   body: params.message,
      //   from: params.senderName ?? params.gatewayConfig.senderName,
      //   to: params.recipientPhone,
      // });

      // Simulated successful response
      const messageId = `TW_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return {
        success: true,
        messageId,
        gatewayId: params.gatewayConfig.id,
        provider: 'twilio',
        status: 'queued',
        cost: 0.0075,
        currency: 'USD',
      };
    } catch (err) {
      return {
        success: false,
        gatewayId: params.gatewayConfig.id,
        provider: 'twilio',
        status: 'failed',
        errorCode: 'TWILIO_ERROR',
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async sendViaVonage(
    params: SendSMSParams,
    apiKey: string,
    apiSecret: string | undefined,
  ): Promise<SendSMSResult> {
    try {
      // In production, use the vonage SDK:
      // const { Vonage } = require('@vonage/server-sdk');
      // const vonage = new Vonage({ apiKey, apiSecret });
      // const result = await vonage.sms.send({ to: params.recipientPhone, from: params.senderName, text: params.message });

      const messageId = `VG_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return {
        success: true,
        messageId,
        gatewayId: params.gatewayConfig.id,
        provider: 'vonage',
        status: 'queued',
        cost: 0.0065,
        currency: 'EUR',
      };
    } catch (err) {
      return {
        success: false,
        gatewayId: params.gatewayConfig.id,
        provider: 'vonage',
        status: 'failed',
        errorCode: 'VONAGE_ERROR',
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async sendViaMessageBird(
    params: SendSMSParams,
    apiKey: string,
    _apiSecret: string | undefined,
  ): Promise<SendSMSResult> {
    try {
      // In production, use the messagebird SDK

      const messageId = `MB_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return {
        success: true,
        messageId,
        gatewayId: params.gatewayConfig.id,
        provider: 'messagebird',
        status: 'queued',
        cost: 0.008,
        currency: 'EUR',
      };
    } catch (err) {
      return {
        success: false,
        gatewayId: params.gatewayConfig.id,
        provider: 'messagebird',
        status: 'failed',
        errorCode: 'MESSAGEBIRD_ERROR',
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async sendViaBulkSMS(
    params: SendSMSParams,
    apiToken: string,
  ): Promise<SendSMSResult> {
    try {
      // In production, use the BulkSMS HTTP API

      const messageId = `BS_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return {
        success: true,
        messageId,
        gatewayId: params.gatewayConfig.id,
        provider: 'bulk_sms',
        status: 'queued',
        cost: 0.004,
        currency: 'USD',
      };
    } catch (err) {
      return {
        success: false,
        gatewayId: params.gatewayConfig.id,
        provider: 'bulk_sms',
        status: 'failed',
        errorCode: 'BULK_SMS_ERROR',
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async sendViaCustom(
    params: SendSMSParams,
    endpointOrKey: string,
    _secret: string | undefined,
  ): Promise<SendSMSResult> {
    try {
      // In production, send to custom webhook / API endpoint

      const messageId = `CS_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return {
        success: true,
        messageId,
        gatewayId: params.gatewayConfig.id,
        provider: 'custom',
        status: 'queued',
      };
    } catch (err) {
      return {
        success: false,
        gatewayId: params.gatewayConfig.id,
        provider: 'custom',
        status: 'failed',
        errorCode: 'CUSTOM_GATEWAY_ERROR',
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
