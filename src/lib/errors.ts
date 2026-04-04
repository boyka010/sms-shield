/**
 * SMS-Shield Custom Error Classes
 *
 * Enterprise-grade error hierarchy for the SMS-Shield Shopify App.
 * All operational errors extend AppError and include structured metadata
 * for logging, monitoring, and API response serialization.
 */

// ─── Serialized Error Interface ───────────────────────────────────────────────

export interface SerializedError {
  name: string;
  code: string;
  message: string;
  statusCode: number;
  isOperational: boolean;
  timestamp: string;
  details?: Record<string, unknown>;
  stack?: string;
}

// ─── Base Application Error ───────────────────────────────────────────────────

/**
 * Base error class for all SMS-Shield application errors.
 *
 * @example
 * ```ts
 * throw new AppError("Something went wrong", {
 *   code: "CUSTOM_ERROR",
 *   statusCode: 500,
 * });
 * ```
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: string;
  public readonly details: Record<string, unknown>;
  public readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      code?: string;
      statusCode?: number;
      isOperational?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    } = {}
  ) {
    super(message);

    this.name = this.constructor.name;
    this.code = options.code ?? "INTERNAL_ERROR";
    this.statusCode = options.statusCode ?? 500;
    this.isOperational = options.isOperational ?? true;
    this.timestamp = new Date().toISOString();
    this.details = options.details ?? {};
    this.cause = options.cause;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace, excluding constructor call
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serializes the error to a plain object suitable for JSON responses.
   * Strips stack traces in production environments.
   */
  serialize(): SerializedError {
    const isProduction = process.env.NODE_ENV === "production";

    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      timestamp: this.timestamp,
      ...(Object.keys(this.details).length > 0 && { details: this.details }),
      ...(!isProduction && { stack: this.stack }),
    };
  }
}

// ─── Encryption / Decryption Errors ───────────────────────────────────────────

/**
 * Thrown when an encryption operation fails.
 * Used when API keys, phone numbers, or PII cannot be encrypted.
 */
export class EncryptionError extends AppError {
  constructor(
    message: string = "Encryption operation failed",
    details?: Record<string, unknown>
  ) {
    super(message, {
      code: "ENCRYPTION_ERROR",
      statusCode: 500,
      details,
    });
  }
}

/**
 * Thrown when a decryption operation fails.
 * Covers invalid ciphertext, corrupted data, wrong key, or tampered auth tags.
 */
export class DecryptionError extends AppError {
  constructor(
    message: string = "Decryption operation failed",
    details?: Record<string, unknown>
  ) {
    super(message, {
      code: "DECRYPTION_ERROR",
      statusCode: 500,
      details,
    });
  }
}

// ─── Validation Errors ────────────────────────────────────────────────────────

/**
 * Thrown when input validation fails.
 * Used for invalid phone numbers, missing fields, malformed payloads, etc.
 */
export class ValidationError extends AppError {
  constructor(
    message: string = "Validation failed",
    details?: Record<string, unknown>
  ) {
    super(message, {
      code: "VALIDATION_ERROR",
      statusCode: 400,
      details,
    });
  }
}

// ─── Authentication Errors ────────────────────────────────────────────────────

/**
 * Thrown when authentication or authorization fails.
 * Covers invalid tokens, missing credentials, forbidden access, etc.
 */
export class AuthenticationError extends AppError {
  constructor(
    message: string = "Authentication required",
    details?: Record<string, unknown>
  ) {
    super(message, {
      code: "AUTHENTICATION_ERROR",
      statusCode: 401,
      details,
    });
  }
}

/**
 * Thrown when a Shopify webhook HMAC signature cannot be verified.
 * Indicates the request may have been tampered with or is from an untrusted source.
 */
export class WebhookVerificationError extends AppError {
  constructor(
    message: string = "Webhook verification failed",
    details?: Record<string, unknown>
  ) {
    super(message, {
      code: "WEBHOOK_VERIFICATION_FAILED",
      statusCode: 401,
      details,
    });
  }
}

// ─── SMS Gateway Errors ───────────────────────────────────────────────────────

/**
 * Thrown when the SMS gateway returns an error or is unreachable.
 * Includes the gateway type (e.g., "twilio", "vonage") and any
 * external error code from the upstream provider.
 */
export class SMSGatewayError extends AppError {
  public readonly gatewayType: string;
  public readonly externalCode: string | null;

  constructor(
    message: string = "SMS gateway error",
    gatewayType?: string,
    externalCode?: string | null,
    details?: Record<string, unknown>
  ) {
    const mergedDetails: Record<string, unknown> = {
      ...details,
      ...(gatewayType && { gatewayType }),
      ...(externalCode && { externalCode }),
    };

    super(message, {
      code: "SMS_GATEWAY_ERROR",
      statusCode: 502,
      details: mergedDetails,
    });

    this.gatewayType = gatewayType ?? "unknown";
    this.externalCode = externalCode ?? null;
  }
}

/**
 * Thrown when sending an SMS message fails.
 * Includes the masked recipient phone for safe logging,
 * the gateway type, and whether the request is retryable.
 */
export class SMSSendError extends AppError {
  public readonly recipientPhone: string;
  public readonly gatewayType: string;
  public readonly retryable: boolean;

  constructor(
    message: string = "Failed to send SMS",
    recipientPhone?: string,
    gatewayType?: string,
    retryable?: boolean,
    details?: Record<string, unknown>
  ) {
    const mergedDetails: Record<string, unknown> = {
      ...details,
      ...(recipientPhone && { recipientPhoneMasked: recipientPhone }),
      ...(gatewayType && { gatewayType }),
      ...(retryable !== undefined && { retryable }),
    };

    super(message, {
      code: "SMS_SEND_FAILED",
      statusCode: 502,
      details: mergedDetails,
    });

    this.recipientPhone = recipientPhone ?? "unknown";
    this.gatewayType = gatewayType ?? "unknown";
    this.retryable = retryable ?? false;
  }
}

// ─── Rate Limit Errors ────────────────────────────────────────────────────────

/**
 * Thrown when a rate limit is exceeded.
 * Includes the `retryAfter` duration in seconds so clients
 * know when they can retry the request.
 */
export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(
    message: string = "Rate limit exceeded",
    retryAfter?: number,
    details?: Record<string, unknown>
  ) {
    const mergedDetails: Record<string, unknown> = {
      ...details,
      retryAfterSeconds: retryAfter ?? 60,
    };

    super(message, {
      code: "RATE_LIMIT_EXCEEDED",
      statusCode: 429,
      details: mergedDetails,
    });

    this.retryAfter = retryAfter ?? 60;
  }
}

// ─── Not Found Errors ─────────────────────────────────────────────────────────

/**
 * Thrown when a requested resource does not exist.
 * Includes the resource type and its ID for precise logging.
 */
export class NotFoundError extends AppError {
  public readonly resource: string;
  public readonly resourceId: string | null;

  constructor(
    message: string = "Resource not found",
    resource?: string,
    resourceId?: string | null,
    details?: Record<string, unknown>
  ) {
    const mergedDetails: Record<string, unknown> = {
      ...details,
      ...(resource && { resource }),
      ...(resourceId && { resourceId }),
    };

    super(message, {
      code: "NOT_FOUND",
      statusCode: 404,
      details: mergedDetails,
    });

    this.resource = resource ?? "unknown";
    this.resourceId = resourceId ?? null;
  }
}

// ─── Configuration Errors ─────────────────────────────────────────────────────

/**
 * Thrown when the application is misconfigured.
 * Common causes: missing env vars, invalid API keys, bad database URLs.
 */
export class ConfigurationError extends AppError {
  public readonly fieldName: string | null;

  constructor(
    message: string = "Configuration error",
    fieldName?: string | null,
    details?: Record<string, unknown>
  ) {
    const mergedDetails: Record<string, unknown> = {
      ...details,
      ...(fieldName && { fieldName }),
    };

    super(message, {
      code: "CONFIGURATION_ERROR",
      statusCode: 500,
      details: mergedDetails,
    });

    this.fieldName = fieldName ?? null;
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Type guard to check if an error is an operational AppError.
 *
 * Operational errors are expected business logic failures (invalid input,
 * rate limits, not found) as opposed to unexpected programming bugs.
 *
 * @example
 * ```ts
 * if (isOperationalError(error)) {
 *   // Safe to return to client with structured response
 * } else {
 *   // Unexpected error — log full stack, return generic 500
 * }
 * ```
 */
export function isOperationalError(error: unknown): error is AppError {
  return error instanceof AppError && error.isOperational === true;
}

/**
 * Serializes any caught error into a structured JSON-safe object.
 * Handles both AppError instances and unknown thrown values.
 *
 * @example
 * ```ts
 * try {
 *   await sendSMS(phone, message);
 * } catch (err) {
 *   const serialized = serializeError(err);
 *   logger.error("SMS send failed", serialized);
 *   return Response.json(serialized, { status: serialized.statusCode });
 * }
 * ```
 */
export function serializeError(error: unknown): SerializedError {
  if (error instanceof AppError) {
    return error.serialize();
  }

  if (error instanceof Error) {
    const isProduction = process.env.NODE_ENV === "production";

    return {
      name: error.name,
      code: "UNEXPECTED_ERROR",
      message: isProduction
        ? "An unexpected error occurred"
        : (error.message ?? "An unexpected error occurred"),
      statusCode: 500,
      isOperational: false,
      timestamp: new Date().toISOString(),
      ...(!isProduction && { stack: error.stack }),
    };
  }

  // Handle non-Error thrown values (strings, numbers, etc.)
  return {
    name: "UnknownError",
    code: "UNEXPECTED_ERROR",
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : `Unexpected error: ${String(error)}`,
    statusCode: 500,
    isOperational: false,
    timestamp: new Date().toISOString(),
  };
}
