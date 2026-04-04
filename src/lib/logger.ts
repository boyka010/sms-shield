/**
 * SMS-Shield Structured JSON Logger
 *
 * Production-grade structured logging for the SMS-Shield Shopify App.
 * Outputs JSON lines to stdout for log aggregation (Datadog, CloudWatch, etc.)
 * and pretty-prints to console in development with ANSI colors.
 *
 * Features:
 * - Log levels: debug, info, warn, error, fatal
 * - Per-entry context tagging for module identification
 * - Request-scoped logging with shopId and requestId
 * - Child loggers for sub-modules
 * - Circular reference handling in meta objects
 * - Conditional console output (dev vs. production)
 *
 * @example
 * ```ts
 * import { createLogger } from "@/lib/logger";
 *
 * const log = createLogger("sms-service");
 * log.info("SMS sent successfully", { phone: "0101234XXXX", gateway: "twilio" });
 * log.error("SMS delivery failed", { error: err.message, retryCount: 3 });
 * ```
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Supported log levels in ascending severity order */
export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

/** Numeric values for log level comparison (higher = more severe) */
const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

/** A single structured log entry */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: string;
  shopId?: string;
  requestId?: string;
  meta?: Record<string, unknown>;
}

/** Logger instance with level-filtered log methods */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  fatal(message: string, meta?: Record<string, unknown>): void;
  /** Create a child logger with additional context namespace */
  child(additionalContext: string): Logger;
  /** Get the current minimum log level */
  getLevel(): LogLevel;
  /** Set the minimum log level */
  setLevel(level: LogLevel): void;
  /** Bind a requestId to all subsequent log entries */
  setRequestId(requestId: string): void;
  /** Bind a shopId to all subsequent log entries */
  setShopId(shopId: string): void;
  /** Clear bound request and shop IDs */
  clearBindings(): void;
}

// ─── ANSI Color Codes ─────────────────────────────────────────────────────────

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
} as const;

/** ANSI color mapping per log level */
const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: COLORS.cyan,
  info: COLORS.blue,
  warn: COLORS.yellow,
  error: COLORS.red,
  fatal: COLORS.magenta,
};

/** Display label per log level (uppercase, padded) */
const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: " INFO",
  warn: " WARN",
  error: "ERROR",
  fatal: "FATAL",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolves the effective minimum log level from environment variables.
 * Falls back to "info" if not configured.
 */
function resolveLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase()?.trim();

  if (envLevel && envLevel in LOG_LEVEL_VALUES) {
    return envLevel as LogLevel;
  }

  // Default to "debug" in development, "info" in production
  return process.env.NODE_ENV === "development" ? "debug" : "info";
}

/**
 * Safely serializes meta objects, handling circular references and
 * non-serializable values (BigInt, functions, symbols, undefined).
 */
function safeStringify(obj: unknown, indent?: number): string {
  const seen = new WeakSet();

  try {
    return JSON.stringify(
      obj,
      (_key: string, value: unknown) => {
        // Handle circular references
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) {
            return "[Circular]";
          }
          seen.add(value);
        }

        // Handle BigInt
        if (typeof value === "bigint") {
          return value.toString() + "n";
        }

        // Handle undefined (JSON.stringify drops it)
        if (value === undefined) {
          return "[undefined]";
        }

        // Handle functions
        if (typeof value === "function") {
          return `[Function: ${value.name || "anonymous"}]`;
        }

        // Handle symbols
        if (typeof value === "symbol") {
          return value.toString();
        }

        // Handle Error objects — include message, name, and stack
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack,
          };
        }

        return value;
      },
      indent
    );
  } catch {
    return String(obj);
  }
}

/**
 * Returns true if we're running in a development-like environment
 * where console pretty-printing is desired.
 */
function isDevMode(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "test" ||
    process.env.NODE_ENV === undefined
  );
}

// ─── Logger Implementation ────────────────────────────────────────────────────

/**
 * Creates a logger instance bound to a specific context string.
 *
 * @param context - Module or service identifier (e.g., "sms-service", "webhook-handler")
 * @param options - Optional configuration overrides
 * @returns A Logger instance
 *
 * @example
 * ```ts
 * const log = createLogger("order-sync");
 * log.info("Syncing orders", { shop: "my-store.myshopify.com" });
 * ```
 */
export function createLogger(
  context: string,
  options: {
    level?: LogLevel;
    shopId?: string;
    requestId?: string;
  } = {}
): Logger {
  let minLevel = options.level ?? resolveLogLevel();
  let boundShopId = options.shopId;
  let boundRequestId = options.requestId;

  function shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[minLevel];
  }

  function formatConsoleEntry(entry: LogEntry): string {
    const color = LEVEL_COLORS[entry.level];
    const label = LEVEL_LABELS[entry.level];
    const timeStr = entry.timestamp.replace("T", " ").replace("Z", "");

    let output = `${COLORS.gray}${timeStr}${COLORS.reset} ${COLORS.bold}${color}${label}${COLORS.reset}`;

    if (entry.shopId) {
      output += ` ${COLORS.dim}[shop:${entry.shopId}]${COLORS.reset}`;
    }
    if (entry.requestId) {
      output += ` ${COLORS.dim}[req:${entry.requestId}]${COLORS.reset}`;
    }

    output += ` ${COLORS.dim}${entry.context}${COLORS.reset}`;
    output += ` ${entry.message}`;

    if (entry.meta && Object.keys(entry.meta).length > 0) {
      output += `\n${safeStringify(entry.meta, 2)}`;
    }

    return output;
  }

  function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      ...(boundShopId && { shopId: boundShopId }),
      ...(boundRequestId && { requestId: boundRequestId }),
      ...(meta && Object.keys(meta).length > 0 && { meta }),
    };

    // Always output structured JSON to stdout
    process.stdout.write(safeStringify(entry) + "\n");

    // Also pretty-print to console in development
    if (isDevMode()) {
      const consoleLine = formatConsoleEntry(entry);

      switch (level) {
        case "debug":
          console.debug(consoleLine);
          break;
        case "info":
          console.info(consoleLine);
          break;
        case "warn":
          console.warn(consoleLine);
          break;
        case "error":
          console.error(consoleLine);
          break;
        case "fatal":
          console.error(consoleLine);
          break;
      }
    }
  }

  function child(additionalContext: string): Logger {
    const childContext = context
      ? `${context}:${additionalContext}`
      : additionalContext;

    return createLogger(childContext, {
      level: minLevel,
      shopId: boundShopId,
      requestId: boundRequestId,
    });
  }

  return {
    debug: (message: string, meta?: Record<string, unknown>) =>
      log("debug", message, meta),
    info: (message: string, meta?: Record<string, unknown>) =>
      log("info", message, meta),
    warn: (message: string, meta?: Record<string, unknown>) =>
      log("warn", message, meta),
    error: (message: string, meta?: Record<string, unknown>) =>
      log("error", message, meta),
    fatal: (message: string, meta?: Record<string, unknown>) =>
      log("fatal", message, meta),
    child,
    getLevel: () => minLevel,
    setLevel: (newLevel: LogLevel) => {
      minLevel = newLevel;
    },
    setRequestId: (requestId: string) => {
      boundRequestId = requestId;
    },
    setShopId: (shopId: string) => {
      boundShopId = shopId;
    },
    clearBindings: () => {
      boundShopId = undefined;
      boundRequestId = undefined;
    },
  };
}

/**
 * Creates a request-scoped logger with pre-bound requestId and shopId.
 *
 * Ideal for use in API route handlers where each request has a unique ID
 * and is associated with a Shopify shop.
 *
 * @param requestId - Unique identifier for the current request
 * @param shopId - The Shopify shop domain (e.g., "my-store.myshopify.com")
 * @param baseContext - Optional base context string (defaults to "request")
 * @returns A Logger instance with requestId and shopId pre-bound
 *
 * @example
 * ```ts
 * // In a Next.js middleware or API route:
 * const requestId = crypto.randomUUID();
 * const log = createRequestLogger(requestId, shop);
 * log.info("Processing order creation webhook");
 * // Output: {"timestamp":"...","level":"info","message":"...","context":"request","shopId":"store.myshopify.com","requestId":"..."}
 * ```
 */
export function createRequestLogger(
  requestId: string,
  shopId?: string,
  baseContext: string = "request"
): Logger {
  return createLogger(baseContext, {
    shopId,
    requestId,
  });
}

/**
 * Creates a child logger from an existing parent logger instance.
 *
 * The child inherits the parent's log level, shopId, and requestId bindings
 * while adding its own context namespace segment.
 *
 * @param parent - The parent logger instance
 * @param additionalContext - Context string to append (e.g., "send", "retry")
 * @returns A new child Logger instance
 *
 * @example
 * ```ts
 * const smsLogger = createLogger("sms-gateway");
 * const twilioLogger = childLogger(smsLogger, "twilio");
 *
 * smsLogger.info("Connecting to SMS gateway");      // context: "sms-gateway"
 * twilioLogger.info("Sending SMS via Twilio");       // context: "sms-gateway:twilio"
 * ```
 */
export function childLogger(parent: Logger, additionalContext: string): Logger {
  return parent.child(additionalContext);
}

// ─── Default Logger Export ────────────────────────────────────────────────────

/**
 * Default logger instance for general-purpose application logging.
 * Context is set to "sms-shield".
 *
 * @example
 * ```ts
 * import { logger } from "@/lib/logger";
 * logger.info("Application started", { version: "1.0.0", env: process.env.NODE_ENV });
 * ```
 */
export const logger: Logger = createLogger("sms-shield");
