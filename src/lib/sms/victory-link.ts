// =============================================================================
// Victory Link Gateway Adapter
// API: https://sms.victorylink.com/api/SendSMS
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
// Victory Link API response shapes
// The API may return JSON or XML. We handle both formats.
// -----------------------------------------------------------------------------

interface VictoryLinkSendResponse {
  Code?: number | string;
  Message?: string;
  SMSID?: string;
  Balance?: number;
  Cost?: number;
  Currency?: string;
}

interface VictoryLinkBalanceResponse {
  Code?: number | string;
  Message?: string;
  Balance?: number;
  Currency?: string;
  SMSCount?: number;
}

/** XML <string> wrapper that some endpoints return */
interface VictoryLinkXmlEnvelope {
  string?: string;
}

// Victory Link response codes
const VICTORY_LINK_CODES: Record<string | number, { success: boolean; retryable: boolean; description: string }> = {
  0:     { success: true,  retryable: false, description: 'Message sent successfully' },
  100:   { success: false, retryable: false, description: 'Invalid credentials' },
  101:   { success: false, retryable: false, description: 'Invalid sender name' },
  102:   { success: false, retryable: false, description: 'Invalid mobile number format' },
  103:   { success: false, retryable: false, description: 'Message content is empty' },
  104:   { success: false, retryable: false, description: 'Message exceeds maximum length' },
  105:   { success: false, retryable: false, description: 'Insufficient balance' },
  106:   { success: false, retryable: false, description: 'Account suspended' },
  107:   { success: false, retryable: false, description: 'Mobile number is blacklisted' },
  108:   { success: false, retryable: false, description: 'Invalid API key' },
  200:   { success: false, retryable: true,  description: 'Gateway timeout' },
  201:   { success: false, retryable: true,  description: 'Service temporarily unavailable' },
  202:   { success: false, retryable: true,  description: 'Rate limit exceeded, try again later' },
  203:   { success: false, retryable: true,  description: 'Internal server error' },
  300:   { success: false, retryable: false, description: 'Unsupported encoding' },
  301:   { success: false, retryable: false, description: 'Scheduled time is invalid' },
  500:   { success: false, retryable: true,  description: 'Unknown gateway error' },
};

// API endpoint constants
const VICTORY_LINK_SEND_URL = 'https://sms.victorylink.com/api/SendSMS';
const VICTORY_LINK_BALANCE_URL = 'https://sms.victorylink.com/api/GetBalance';

export class VictoryLinkAdapter extends BaseSMSGateway {
  get gatewayType(): SMSGatewayType {
    return 'VICTORY_LINK';
  }

  get name(): string {
    return 'Victory Link';
  }

  // ---------------------------------------------------------------------------
  // Single message
  // ---------------------------------------------------------------------------

  protected async sendSingleMessage(payload: SMSMessagePayload): Promise<SMSMessageResponse> {
    const sender = this.resolveSenderName(payload);
    const encoding = this.resolveEncoding(payload.message, payload.encoding);
    const messageId = payload.messageId ?? this.generateMessageId();

    const formParams: Record<string, string> = {
      userName: this.config.username,
      password: this.config.password,
      mobile: this.normalizePhone(payload.recipientPhone),
      message: payload.message,
      senderName: sender,
      apiKey: this.config.apiKey ?? '',
      // Victory Link uses "unicode" flag instead of explicit encoding
      unicode: encoding === 'UCS2' ? 'true' : 'false',
    };

    // Scheduled send
    if (payload.scheduledAt && payload.scheduledAt > new Date()) {
      formParams.scheduledDate = this.formatDateISO(payload.scheduledAt);
    }

    const { data, latencyMs } = await this.postForm<VictoryLinkSendResponse>(
      VICTORY_LINK_SEND_URL,
      formParams,
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

    // Victory Link supports comma-separated mobile numbers
    const mobiles = payload.recipients.map((r) => this.normalizePhone(r)).join(',');

    const formParams: Record<string, string> = {
      userName: this.config.username,
      password: this.config.password,
      mobile: mobiles,
      message: payload.message,
      senderName: sender,
      apiKey: this.config.apiKey ?? '',
      unicode: encoding === 'UCS2' ? 'true' : 'false',
    };

    const results: SMSMessageResponse[] = [];
    let successfulCount = 0;
    let failedCount = 0;

    try {
      const { data, latencyMs } = await this.postForm<VictoryLinkSendResponse>(
        VICTORY_LINK_SEND_URL,
        formParams,
      );
      const totalLatencyMs = Date.now() - startTime;

      const code = data.Code ?? 500;
      const codeInfo = this.getCodeInfo(code);

      if (codeInfo.success) {
        for (const phone of payload.recipients) {
          results.push({
            success: true,
            externalMessageId: data.SMSID,
            recipientPhone: this.normalizePhone(phone),
            gatewayType: this.gatewayType,
            statusCode: String(code),
            statusMessage: data.Message || codeInfo.description,
            cost: data.Cost,
            currency: data.Currency,
            latencyMs,
            timestamp: new Date(),
            retryable: false,
          });
          successfulCount++;
        }
      } else {
        for (const phone of payload.recipients) {
          results.push({
            success: false,
            recipientPhone: this.normalizePhone(phone),
            gatewayType: this.gatewayType,
            statusCode: String(code),
            statusMessage: data.Message || codeInfo.description,
            latencyMs,
            timestamp: new Date(),
            retryable: codeInfo.retryable,
          });
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
      userName: this.config.username,
      password: this.config.password,
      apiKey: this.config.apiKey ?? '',
    };

    try {
      const { data } = await this.postForm<VictoryLinkBalanceResponse | VictoryLinkXmlEnvelope>(
        VICTORY_LINK_BALANCE_URL,
        formParams,
      );

      // Handle XML-style envelope: { string: "..." }
      if ('string' in data && typeof data.string === 'string') {
        // The string field might be JSON or a plain value — attempt JSON parse
        try {
          const inner = JSON.parse(data.string) as VictoryLinkBalanceResponse;
          return this.parseBalanceResponse(inner);
        } catch {
          // Not JSON, treat as plain text
          return {
            success: true,
            balance: parseFloat(data.string) || 0,
            unit: 'currency',
          };
        }
      }

      return this.parseBalanceResponse(data as VictoryLinkBalanceResponse);
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
      userName: this.config.username,
      password: this.config.password,
      apiKey: this.config.apiKey ?? '',
    };

    try {
      const { latencyMs } = await this.postForm<VictoryLinkBalanceResponse | VictoryLinkXmlEnvelope>(
        VICTORY_LINK_BALANCE_URL,
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

  private getCodeInfo(code: string | number | undefined): {
    success: boolean;
    retryable: boolean;
    description: string;
  } {
    if (code === undefined || code === null) {
      return { success: false, retryable: true, description: 'No response code received' };
    }
    return (
      VICTORY_LINK_CODES[code] ?? {
        success: false,
        retryable: true,
        description: `Unknown response code: ${code}`,
      }
    );
  }

  private parseSendResponse(
    data: VictoryLinkSendResponse,
    recipientPhone: string,
    trackingId: string,
    latencyMs: number,
  ): SMSMessageResponse {
    const code = data.Code ?? 500;
    const codeInfo = this.getCodeInfo(code);

    return {
      success: codeInfo.success,
      externalMessageId: codeInfo.success ? (data.SMSID ?? trackingId) : undefined,
      recipientPhone: this.normalizePhone(recipientPhone),
      gatewayType: this.gatewayType,
      statusCode: String(code),
      statusMessage: data.Message || codeInfo.description,
      cost: data.Cost,
      currency: data.Currency,
      latencyMs,
      timestamp: new Date(),
      retryable: codeInfo.retryable,
    };
  }

  private parseBalanceResponse(data: VictoryLinkBalanceResponse): SMSBalanceResponse {
    const code = data.Code ?? 500;
    const codeInfo = this.getCodeInfo(code);

    if (!codeInfo.success) {
      return {
        success: false,
        error: data.Message || codeInfo.description,
      };
    }

    return {
      success: true,
      balance: data.Balance ?? data.SMSCount ?? 0,
      currency: data.Currency,
      unit: data.Balance !== undefined ? 'currency' : 'SMS',
    };
  }

  private formatDateISO(date: Date): string {
    return date.toISOString();
  }
}
