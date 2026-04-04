// =============================================================================
// WE Telecom (WE SMS) Gateway Adapter
// API: https://sms-wegate.com/api/v3
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
// WE API response shapes
// -----------------------------------------------------------------------------

interface WESendResponse {
  success: boolean;
  code?: number;
  message?: string;
  data?: {
    messageId?: string;
    messageIds?: string[];
    cost?: number;
    currency?: string;
    balance?: number;
    failedNumbers?: string[];
    failedReasons?: Record<string, string>;
  };
}

interface WEBalanceResponse {
  success: boolean;
  code?: number;
  message?: string;
  data?: {
    balance?: number;
    currency?: string;
    smsCount?: number;
    unit?: string;
  };
}

interface WEHealthResponse {
  success: boolean;
  code?: number;
  message?: string;
  data?: {
    status?: string;
    latencyMs?: number;
  };
}

// WE API error codes
const WE_API_CODES: Record<number, { success: boolean; retryable: boolean; description: string }> = {
  0:     { success: true,  retryable: false, description: 'Message sent successfully' },
  200:   { success: true,  retryable: false, description: 'OK — request processed' },
  400:   { success: false, retryable: false, description: 'Bad request — invalid parameters' },
  401:   { success: false, retryable: false, description: 'Unauthorized — invalid API key' },
  403:   { success: false, retryable: false, description: 'Forbidden — account suspended or restricted' },
  404:   { success: false, retryable: false, description: 'Endpoint not found' },
  422:   { success: false, retryable: false, description: 'Validation error — check input fields' },
  429:   { success: false, retryable: true,  description: 'Rate limit exceeded — slow down' },
  500:   { success: false, retryable: true,  description: 'Internal server error' },
  502:   { success: false, retryable: true,  description: 'Bad gateway — upstream failure' },
  503:   { success: false, retryable: true,  description: 'Service unavailable — try again later' },
  504:   { success: false, retryable: true,  description: 'Gateway timeout' },
  1001:  { success: false, retryable: false, description: 'Invalid sender name' },
  1002:  { success: false, retryable: false, description: 'Invalid recipient number' },
  1003:  { success: false, retryable: false, description: 'Message content is empty' },
  1004:  { success: false, retryable: false, description: 'Message exceeds maximum length' },
  1005:  { success: false, retryable: false, description: 'Insufficient balance' },
  1006:  { success: false, retryable: false, description: 'Account is inactive' },
  1007:  { success: false, retryable: false, description: 'Recipient number is blacklisted' },
  1008:  { success: false, retryable: false, description: 'Sender name not approved' },
  1009:  { success: false, retryable: false, description: 'Invalid scheduled time' },
  1010:  { success: false, retryable: true,  description: 'Temporary send limit reached' },
};

// API endpoint constants
const WE_API_BASE_URL = 'https://sms-wegate.com/api/v3';
const WE_SEND_ENDPOINT = `${WE_API_BASE_URL}/sms/send`;
const WE_BATCH_ENDPOINT = `${WE_API_BASE_URL}/sms/send-batch`;
const WE_BALANCE_ENDPOINT = `${WE_API_BASE_URL}/account/balance`;
const WE_HEALTH_ENDPOINT = `${WE_API_BASE_URL}/health`;

export class WEGatewayAdapter extends BaseSMSGateway {
  get gatewayType(): SMSGatewayType {
    return 'WE_API';
  }

  get name(): string {
    return 'WE Telecom API';
  }

  // ---------------------------------------------------------------------------
  // Auth headers — WE uses Bearer token authentication
  // ---------------------------------------------------------------------------

  /** Build the Authorization header for WE API requests */
  private get authHeaders(): Record<string, string> {
    if (!this.config.apiKey) {
      throw new Error('WE Gateway requires an apiKey in the gateway configuration');
    }
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  // ---------------------------------------------------------------------------
  // Single message
  // ---------------------------------------------------------------------------

  protected async sendSingleMessage(payload: SMSMessagePayload): Promise<SMSMessageResponse> {
    const sender = this.resolveSenderName(payload);
    const encoding = this.resolveEncoding(payload.message, payload.encoding);
    const messageId = payload.messageId ?? this.generateMessageId();

    const jsonBody: Record<string, unknown> = {
      recipient: [this.normalizePhone(payload.recipientPhone)],
      sender,
      content: payload.message,
      type: encoding === 'UCS2' ? 'unicode' : 'sms',
    };

    // Scheduled send
    if (payload.scheduledAt && payload.scheduledAt > new Date()) {
      jsonBody.scheduledAt = payload.scheduledAt.toISOString();
    }

    // Include tracking ID if provided
    if (payload.messageId) {
      jsonBody.referenceId = payload.messageId;
    }

    const { data, latencyMs } = await this.postJson<WESendResponse>(
      WE_SEND_ENDPOINT,
      jsonBody,
      this.authHeaders,
    );
    return this.parseSendResponse(data, payload.recipientPhone, messageId, latencyMs);
  }

  // ---------------------------------------------------------------------------
  // Batch messages
  // ---------------------------------------------------------------------------

  protected async sendBatchMessages(payload: SMSBatchPayload): Promise<SMSBatchResponse> {
    const sender = this.resolveSenderName(payload);
    const encoding = this.resolveEncoding(payload.message, payload.encoding);
    const startTime = Date.now();

    const normalizedRecipients = payload.recipients.map((r) => this.normalizePhone(r));

    const jsonBody: Record<string, unknown> = {
      recipient: normalizedRecipients,
      sender,
      content: payload.message,
      type: encoding === 'UCS2' ? 'unicode' : 'sms',
    };

    if (payload.messageId) {
      jsonBody.referenceId = payload.messageId;
    }

    const results: SMSMessageResponse[] = [];
    let successfulCount = 0;
    let failedCount = 0;

    try {
      const { data, latencyMs } = await this.postJson<WESendResponse>(
        WE_BATCH_ENDPOINT,
        jsonBody,
        this.authHeaders,
      );
      const totalLatencyMs = Date.now() - startTime;

      const apiCode = data.code ?? (data.success ? 200 : 500);
      const codeInfo = this.getCodeInfo(apiCode);

      // Build per-recipient results
      const messageIds = data.data?.messageIds ?? [];
      const failedNumbers = data.data?.failedNumbers ?? [];
      const failedReasons = data.data?.failedReasons ?? {};

      for (let i = 0; i < normalizedRecipients.length; i++) {
        const phone = normalizedRecipients[i];
        const isFailed = failedNumbers.includes(phone);

        if (isFailed) {
          const failReason = failedReasons[phone] || codeInfo.description;
          results.push({
            success: false,
            recipientPhone: phone,
            gatewayType: this.gatewayType,
            statusCode: String(apiCode),
            statusMessage: failReason,
            latencyMs,
            timestamp: new Date(),
            retryable: codeInfo.retryable,
          });
          failedCount++;
        } else {
          results.push({
            success: true,
            externalMessageId: messageIds[i] ?? data.data?.messageId,
            recipientPhone: phone,
            gatewayType: this.gatewayType,
            statusCode: String(apiCode),
            statusMessage: data.message || codeInfo.description,
            cost: data.data?.cost,
            currency: data.data?.currency,
            latencyMs,
            timestamp: new Date(),
            retryable: false,
          });
          successfulCount++;
        }
      }

      return {
        totalRecipients: normalizedRecipients.length,
        successfulCount,
        failedCount,
        results,
        gatewayType: this.gatewayType,
        totalLatencyMs,
      };
    } catch (error) {
      const totalLatencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      for (const phone of normalizedRecipients) {
        results.push({
          success: false,
          recipientPhone: phone,
          gatewayType: this.gatewayType,
          statusMessage: errorMessage,
          latencyMs: 0,
          timestamp: new Date(),
          retryable: true,
        });
      }

      return {
        totalRecipients: normalizedRecipients.length,
        successfulCount: 0,
        failedCount: normalizedRecipients.length,
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
    try {
      const { data } = await this.httpGet<WEBalanceResponse>(WE_BALANCE_ENDPOINT, undefined, this.authHeaders);

      if (!data.success && data.code !== undefined) {
        const codeInfo = this.getCodeInfo(data.code);
        return {
          success: false,
          error: data.message || codeInfo.description,
        };
      }

      return {
        success: true,
        balance: data.data?.balance ?? data.data?.smsCount ?? 0,
        currency: data.data?.currency,
        unit: data.data?.unit ?? (data.data?.balance !== undefined ? 'currency' : 'SMS'),
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

    try {
      const { latencyMs } = await this.httpGet<WEHealthResponse>(
        WE_HEALTH_ENDPOINT,
        undefined,
        this.authHeaders,
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

  private getCodeInfo(code: number | undefined): {
    success: boolean;
    retryable: boolean;
    description: string;
  } {
    if (code === undefined || code === null) {
      return { success: false, retryable: true, description: 'No response code received' };
    }
    return (
      WE_API_CODES[code] ?? {
        success: false,
        retryable: true,
        description: `Unknown response code: ${code}`,
      }
    );
  }

  private parseSendResponse(
    data: WESendResponse,
    recipientPhone: string,
    trackingId: string,
    latencyMs: number,
  ): SMSMessageResponse {
    const apiCode = data.code ?? (data.success ? 200 : 500);
    const codeInfo = this.getCodeInfo(apiCode);

    if (codeInfo.success) {
      return {
        success: true,
        externalMessageId: data.data?.messageId ?? data.data?.messageIds?.[0] ?? trackingId,
        recipientPhone: this.normalizePhone(recipientPhone),
        gatewayType: this.gatewayType,
        statusCode: String(apiCode),
        statusMessage: data.message || codeInfo.description,
        cost: data.data?.cost,
        currency: data.data?.currency,
        latencyMs,
        timestamp: new Date(),
        retryable: false,
      };
    }

    return {
      success: false,
      recipientPhone: this.normalizePhone(recipientPhone),
      gatewayType: this.gatewayType,
      statusCode: String(apiCode),
      statusMessage: data.message || codeInfo.description,
      latencyMs,
      timestamp: new Date(),
      retryable: codeInfo.retryable,
    };
  }
}
