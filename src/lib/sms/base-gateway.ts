// =============================================================================
// Base SMS Gateway — Abstract class shared by all gateway adapters
// =============================================================================

import type {
  SMSGatewayConfig,
  SMSMessagePayload,
  SMSMessageResponse,
  SMSBalanceResponse,
  SMSHealthCheckResult,
  SMSBatchPayload,
  SMSBatchResponse,
  SMSGatewayType,
  SMSMessageEncoding,
} from './types';

export abstract class BaseSMSGateway {
  protected config: SMSGatewayConfig;
  protected readonly maxRetries: number = 3;
  protected readonly retryDelay: number = 1000; // ms, used as base for exponential backoff
  protected readonly defaultTimeoutMs: number = 10000;

  constructor(config: SMSGatewayConfig) {
    this.config = config;
  }

  // ---------------------------------------------------------------------------
  // Identity — concrete adapters MUST provide these
  // ---------------------------------------------------------------------------

  abstract get gatewayType(): SMSGatewayType;
  abstract get name(): string;

  // ---------------------------------------------------------------------------
  // Abstract methods — concrete adapters MUST implement
  // ---------------------------------------------------------------------------

  /** Send a single SMS via the gateway's native API */
  protected abstract sendSingleMessage(payload: SMSMessagePayload): Promise<SMSMessageResponse>;

  /** Send a batch of SMS (some gateways support native batch, others loop) */
  protected abstract sendBatchMessages(payload: SMSBatchPayload): Promise<SMSBatchResponse>;

  /** Query the current account balance */
  protected abstract checkBalance(): Promise<SMSBalanceResponse>;

  /** Perform a lightweight health check (e.g. auth validation) */
  protected abstract performHealthCheck(): Promise<SMSHealthCheckResult>;

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Send a single SMS with built-in retry logic (exponential backoff).
   * Retries only happen when the gateway response indicates the error is retryable.
   */
  async send(payload: SMSMessagePayload): Promise<SMSMessageResponse> {
    this.validatePayload(payload);

    let lastResponse: SMSMessageResponse | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.sendSingleMessage(payload);

        if (response.success) {
          return response;
        }

        lastResponse = response;

        // Non-retryable errors should short-circuit immediately
        if (!response.retryable) {
          return response;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * Math.pow(2, attempt - 1));
        }
      } catch (error) {
        lastResponse = this.handleError(error, payload.recipientPhone);

        if (!lastResponse.retryable) {
          return lastResponse;
        }

        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * Math.pow(2, attempt - 1));
        }
      }
    }

    return lastResponse!;
  }

  /**
   * Send a batch of SMS messages.
   * Delegates to the concrete adapter's batch implementation.
   */
  async sendBatch(payload: SMSBatchPayload): Promise<SMSBatchResponse> {
    if (!payload.recipients || payload.recipients.length === 0) {
      throw new Error('Batch must have at least one recipient');
    }
    if (payload.recipients.length > 1000) {
      throw new Error('Batch cannot exceed 1000 recipients per request');
    }

    // Validate every phone number before sending
    for (const phone of payload.recipients) {
      this.validatePayload({ ...payload, recipientPhone: phone });
    }

    return this.sendBatchMessages(payload);
  }

  /** Query the account balance from this gateway */
  async getBalance(): Promise<SMSBalanceResponse> {
    return this.checkBalance();
  }

  /** Run a lightweight health check against this gateway */
  async healthCheck(): Promise<SMSHealthCheckResult> {
    return this.performHealthCheck();
  }

  // ---------------------------------------------------------------------------
  // Shared utilities for subclasses
  // ---------------------------------------------------------------------------

  /** Validate the phone number format and message constraints */
  protected validatePayload(payload: SMSMessagePayload): void {
    if (!payload.recipientPhone) {
      throw new Error('Recipient phone is required');
    }
    if (!payload.message) {
      throw new Error('Message content is required');
    }
    if (payload.message.length === 0) {
      throw new Error('Message cannot be empty');
    }
    if (payload.message.length > 1600) {
      throw new Error('Message exceeds 1600 character limit');
    }

    // Validate Egyptian phone number format
    const normalizedPhone = payload.recipientPhone.replace(/[^0-9+]/g, '');
    if (!/^(\+20|20)1[0125]\d{8}$/.test(normalizedPhone)) {
      throw new Error(`Invalid Egyptian phone number: ${payload.recipientPhone}`);
    }
  }

  /** Normalise a phone string to the +20XXXXXXXXXX canonical format */
  protected normalizePhone(phone: string): string {
    let digits = phone.replace(/[^0-9]/g, '');
    // If starts with 0, strip leading 0 and prepend country code
    if (digits.startsWith('0')) {
      digits = digits.substring(1);
    }
    // If already has country code 20, prepend +
    if (digits.startsWith('20') && digits.length === 12) {
      return `+${digits}`;
    }
    // Otherwise prepend +20
    return `+20${digits}`;
  }

  /** Convert an unknown thrown value into a structured SMSMessageResponse */
  protected handleError(error: unknown, recipientPhone: string): SMSMessageResponse {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Network / timeout / DNS errors are retryable.
    // Auth / validation errors are NOT retryable.
    const nonRetryableKeywords = [
      'Invalid',
      'Unauthorized',
      'Forbidden',
      'authentication',
      'credentials',
      'blacklist',
      'blocked',
    ];
    const isNonRetryable = nonRetryableKeywords.some(kw =>
      errorMessage.toLowerCase().includes(kw.toLowerCase()),
    );

    return {
      success: false,
      recipientPhone,
      gatewayType: this.gatewayType,
      statusMessage: errorMessage,
      latencyMs: 0,
      timestamp: new Date(),
      retryable: !isNonRetryable,
    };
  }

  /** Promise-based delay helper */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** URL-encode key-value pairs into a form body string */
  protected buildFormData(params: Record<string, string>): string {
    return Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  /** Detect whether a message fits in GSM 7-bit or requires UCS-2 */
  protected detectEncoding(message: string): 'GSM_7BIT' | 'UCS2' {
    const gsm7BitRegex =
      /^[A-Za-z0-9 @£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./:;<=>?¡¿ÄÖÑÜ§¿äöñüà\n\r\t{}[\]~^|€]*$/;
    return gsm7BitRegex.test(message) ? 'GSM_7BIT' : 'UCS2';
  }

  /** Resolve the effective encoding (explicit or auto-detected) */
  protected resolveEncoding(message: string, explicit?: SMSMessageEncoding): 'GSM_7BIT' | 'UCS2' {
    if (explicit === 'GSM_7BIT' || explicit === 'UCS2') return explicit;
    return this.detectEncoding(message);
  }

  /**
   * Calculate the number of SMS segments for a message.
   * GSM 7-bit: 160 chars per segment (153 for multipart)
   * UCS-2:    70 chars per segment (67 for multipart)
   */
  protected calculateSegments(message: string): number {
    const encoding = this.detectEncoding(message);
    const singleLimit = encoding === 'GSM_7BIT' ? 160 : 70;
    const multiLimit = encoding === 'GSM_7BIT' ? 153 : 67;

    if (message.length <= singleLimit) return 1;
    return Math.ceil(message.length / multiLimit);
  }

  /**
   * Perform an HTTP POST with form data and return the parsed JSON response.
   * Centralises fetch + timeout + error handling for all gateway adapters.
   */
  protected async postForm<T = unknown>(
    url: string,
    params: Record<string, string>,
  ): Promise<{ data: T; latencyMs: number }> {
    const timeoutMs = this.config.timeoutMs ?? this.defaultTimeoutMs;
    const body = this.buildFormData(params);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const startTime = Date.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body,
        signal: controller.signal,
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
      }

      const contentType = response.headers.get('content-type') ?? '';
      let data: T;

      if (contentType.includes('application/json')) {
        data = (await response.json()) as T;
      } else {
        // Some gateways return plain text or XML — return raw string
        data = (await response.text()) as unknown as T;
      }

      return { data, latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Perform an HTTP POST with a JSON body and return the parsed JSON response.
   */
  protected async postJson<T = unknown>(
    url: string,
    jsonBody: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): Promise<{ data: T; latencyMs: number }> {
    const timeoutMs = this.config.timeoutMs ?? this.defaultTimeoutMs;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const startTime = Date.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...extraHeaders,
        },
        body: JSON.stringify(jsonBody),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
      }

      const data = (await response.json()) as T;
      return { data, latencyMs };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Perform an HTTP GET with optional query params and return the parsed response.
   */
  protected async httpGet<T = unknown>(
    url: string,
    params?: Record<string, string>,
    extraHeaders?: Record<string, string>,
  ): Promise<{ data: T; latencyMs: number }> {
    const timeoutMs = this.config.timeoutMs ?? this.defaultTimeoutMs;

    const queryString = params ? `?${this.buildFormData(params)}` : '';
    const fullUrl = `${url}${queryString}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const startTime = Date.now();
    try {
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...extraHeaders,
        },
        signal: controller.signal,
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
      }

      const contentType = response.headers.get('content-type') ?? '';
      let data: T;

      if (contentType.includes('application/json')) {
        data = (await response.json()) as T;
      } else {
        data = (await response.text()) as unknown as T;
      }

      return { data, latencyMs };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`Request to ${fullUrl} timed out after ${timeoutMs}ms`);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** Return the effective sender name (config default or per-message override) */
  protected resolveSenderName(payload: SMSMessagePayload): string {
    return payload.senderName ?? this.config.senderName;
  }

  /** Generate a UUID v4 for tracking purposes */
  protected generateMessageId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
