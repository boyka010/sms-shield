// =============================================================================
// SMS Misr Gateway Adapter
// API Docs: https://smsmisr.com
// =============================================================================

import type {
  SMSMessagePayload,
  SMSMessageResponse,
  SMSBalanceResponse,
  SMSHealthCheckResult,
  SMSBatchPayload,
  SMSBatchResponse,
  SMSGatewayType,
} from './types';
import { BaseSMSGateway } from './base-gateway';

// -----------------------------------------------------------------------------
// SMS Misr API response shapes
// -----------------------------------------------------------------------------

interface SMSMisrSendResponse {
  code: string | number;
  message: string;
  SMSID?: string;      // returned on success
  balance?: number;     // sometimes included
  cost?: number;        // cost of the sent message
  currency?: string;
}

interface SMSMisrBalanceResponse {
  code: string | number;
  message: string;
  balance?: number;
  currency?: string;
  SMSCount?: number;    // number of remaining SMS
}

// SMS Misr response codes
const SMS_MISR_CODES: Record<string | number, { success: boolean; retryable: boolean; description: string }> = {
  1901: { success: true,  retryable: false, description: 'Message sent successfully' },
  1902: { success: false, retryable: false, description: 'Invalid username or password' },
  1903: { success: false, retryable: false, description: 'Insufficient balance' },
  1904: { success: false, retryable: false, description: 'Invalid sender name' },
  1905: { success: false, retryable: false, description: 'Invalid mobile number' },
  1906: { success: false, retryable: true,  description: 'Gateway timeout' },
  1907: { success: false, retryable: true,  description: 'Service temporarily unavailable' },
  1908: { success: false, retryable: false, description: 'Message content is empty or too long' },
  1909: { success: false, retryable: false, description: 'Account is suspended' },
  1910: { success: false, retryable: true,  description: 'Rate limit exceeded' },
  1911: { success: false, retryable: false, description: 'Invalid API key' },
  1912: { success: false, retryable: false, description: 'Scheduled time is in the past' },
  1913: { success: false, retryable: false, description: 'Mobile number is blacklisted' },
};

// API endpoint constants
const SMS_MISR_BASE_URL = 'https://smsmisr.com/api/SMS';
const SMS_MISR_LANGUAGE_EN_AR = '2'; // English with Arabic support

export class SMSMisrAdapter extends BaseSMSGateway {
  get gatewayType(): SMSGatewayType {
    return 'SMS_MISR';
  }

  get name(): string {
    return 'SMS Misr';
  }

  // ---------------------------------------------------------------------------
  // Single message
  // ---------------------------------------------------------------------------

  protected async sendSingleMessage(payload: SMSMessagePayload): Promise<SMSMessageResponse> {
    const sender = this.resolveSenderName(payload);
    const encoding = this.resolveEncoding(payload.message, payload.encoding);
    const messageId = payload.messageId ?? this.generateMessageId();

    const formParams: Record<string, string> = {
      username: this.config.username,
      password: this.config.password,
      mobile: this.normalizePhone(payload.recipientPhone),
      message: payload.message,
      sender: sender,
      language: SMS_MISR_LANGUAGE_EN_AR,
      encoding: encoding,
    };

    // If API key is configured, send it alongside credentials
    if (this.config.apiKey) {
      formParams.apiKey = this.config.apiKey;
    }

    // Scheduled send
    if (payload.scheduledAt && payload.scheduledAt > new Date()) {
      // Format as YYYY-MM-DD HH:MM:SS
      formParams.delayUntil = this.formatDate(payload.scheduledAt);
    }

    const { data, latencyMs } = await this.postForm<SMSMisrSendResponse>(SMS_MISR_BASE_URL, formParams);
    return this.parseSendResponse(data, payload.recipientPhone, encoding, messageId, latencyMs);
  }

  // ---------------------------------------------------------------------------
  // Batch messages
  // ---------------------------------------------------------------------------

  protected async sendBatchMessages(payload: SMSBatchPayload): Promise<SMSBatchResponse> {
    const sender = this.resolveSenderName(payload);
    const encoding = this.resolveEncoding(payload.message, payload.encoding);
    const startTime = Date.now();

    // SMS Misr supports comma-separated mobile numbers in a single request
    const mobiles = payload.recipients.map((r) => this.normalizePhone(r)).join(',');

    const formParams: Record<string, string> = {
      username: this.config.username,
      password: this.config.password,
      mobile: mobiles,
      message: payload.message,
      sender: sender,
      language: SMS_MISR_LANGUAGE_EN_AR,
      encoding: encoding,
    };

    if (this.config.apiKey) {
      formParams.apiKey = this.config.apiKey;
    }

    const results: SMSMessageResponse[] = [];
    let successfulCount = 0;
    let failedCount = 0;

    try {
      const { data, latencyMs } = await this.postForm<SMSMisrSendResponse>(SMS_MISR_BASE_URL, formParams);
      const totalLatencyMs = Date.now() - startTime;

      const code = data.code;
      const codeInfo = SMS_MISR_CODES[code] ?? {
        success: false,
        retryable: true,
        description: `Unknown response code: ${code}`,
      };

      if (codeInfo.success) {
        // Batch succeeded — create a success response for every recipient
        for (const phone of payload.recipients) {
          const response: SMSMessageResponse = {
            success: true,
            externalMessageId: data.SMSID,
            recipientPhone: this.normalizePhone(phone),
            gatewayType: this.gatewayType,
            statusCode: String(code),
            statusMessage: codeInfo.description,
            cost: data.cost,
            currency: data.currency,
            latencyMs,
            timestamp: new Date(),
            retryable: false,
          };
          results.push(response);
          successfulCount++;
        }
      } else {
        // Batch failed — create a failure response for every recipient
        for (const phone of payload.recipients) {
          const response: SMSMessageResponse = {
            success: false,
            recipientPhone: this.normalizePhone(phone),
            gatewayType: this.gatewayType,
            statusCode: String(code),
            statusMessage: data.message || codeInfo.description,
            latencyMs,
            timestamp: new Date(),
            retryable: codeInfo.retryable,
          };
          results.push(response);
          failedCount++;
        }
      }

      return {
        totalRecipients: payload.recipients.length,
        successfulCount,
        failedCount,
        results,
        gatewayType: this.gatewayType,
        totalLatencyMs,
      };
    } catch (error) {
      const totalLatencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      for (const phone of payload.recipients) {
        results.push({
          success: false,
          recipientPhone: this.normalizePhone(phone),
          gatewayType: this.gatewayType,
          statusMessage: errorMessage,
          latencyMs: 0,
          timestamp: new Date(),
          retryable: true,
        });
      }

      return {
        totalRecipients: payload.recipients.length,
        successfulCount: 0,
        failedCount: payload.recipients.length,
        results,
        gatewayType: this.gatewayType,
        totalLatencyMs,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Balance check
  // ---------------------------------------------------------------------------

  protected async checkBalance(): Promise<SMSBalanceResponse> {
    const formParams: Record<string, string> = {
      username: this.config.username,
      password: this.config.password,
    };

    if (this.config.apiKey) {
      formParams.apiKey = this.config.apiKey;
    }

    try {
      const { data } = await this.postForm<SMSMisrBalanceResponse>(
        `${SMS_MISR_BASE_URL}?service=checkBalance`,
        formParams,
      );

      const code = data.code;
      const isSuccess = code === 1901 || code === '1901';

      if (!isSuccess) {
        const codeInfo = SMS_MISR_CODES[code] ?? {
          description: `Unknown response code: ${code}`,
        };
        return {
          success: false,
          error: (codeInfo as { description: string }).description || data.message,
        };
      }

      return {
        success: true,
        balance: data.balance ?? data.SMSCount ?? 0,
        currency: data.currency,
        unit: data.balance !== undefined ? 'currency' : 'SMS',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Health check
  // ---------------------------------------------------------------------------

  protected async performHealthCheck(): Promise<SMSHealthCheckResult> {
    const startTime = Date.now();
    const formParams: Record<string, string> = {
      username: this.config.username,
      password: this.config.password,
    };

    try {
      const { latencyMs } = await this.postForm<SMSMisrBalanceResponse>(
        `${SMS_MISR_BASE_URL}?service=checkBalance`,
        formParams,
      );

      return {
        gatewayType: this.gatewayType,
        isHealthy: true,
        latencyMs,
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        gatewayType: this.gatewayType,
        isHealthy: false,
        latencyMs: Date.now() - startTime,
        lastError: error instanceof Error ? error.message : String(error),
        checkedAt: new Date(),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private parseSendResponse(
    data: SMSMisrSendResponse,
    recipientPhone: string,
    encoding: string,
    trackingId: string,
    latencyMs: number,
  ): SMSMessageResponse {
    const code = data.code;
    const codeInfo = SMS_MISR_CODES[code] ?? {
      success: false,
      retryable: true,
      description: `Unknown response code: ${code}`,
    };

    return {
      success: codeInfo.success,
      externalMessageId: codeInfo.success ? (data.SMSID ?? trackingId) : undefined,
      recipientPhone: this.normalizePhone(recipientPhone),
      gatewayType: this.gatewayType,
      statusCode: String(code),
      statusMessage: data.message || codeInfo.description,
      cost: data.cost,
      currency: data.currency,
      latencyMs,
      timestamp: new Date(),
      retryable: codeInfo.retryable,
    };
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }
}
