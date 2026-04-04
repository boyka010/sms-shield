/**
 * SMS-Shield HMAC Verification Utility
 *
 * Provides Shopify webhook signature verification and app proxy
 * authentication using HMAC-SHA256. All comparison operations
 * use timing-safe functions to prevent timing attacks.
 *
 * @see https://shopify.dev/docs/api/shopify-app-remix/authenticate/webhooks
 * @see https://shopify.dev/docs/apps/online-store/app-proxy
 */

import * as crypto from "node:crypto";
import { WebhookVerificationError, ValidationError } from "./errors";

// ─── Webhook Verification ─────────────────────────────────────────────────────

/**
 * Verifies a Shopify webhook request by comparing the HMAC signature
 * in the `X-Shopify-Hmac-Sha256` header against a locally computed digest.
 *
 * Uses `crypto.timingSafeEqual` to prevent timing side-channel attacks.
 * The comparison is done on base64-encoded digests to ensure both
 * values have the same encoding before comparison.
 *
 * @param rawBody - The raw string body of the incoming request (not parsed JSON)
 * @param shopifyHmacHeader - The value of the `X-Shopify-Hmac-Sha256` header
 * @param clientSecret - Your app's client secret (from Shopify Partner Dashboard)
 * @returns `true` if the signature is valid, `false` otherwise
 * @throws {ValidationError} if any input parameter is empty
 *
 * @example
 * ```ts
 * // In a Next.js API route:
 * const rawBody = await request.text();
 * const hmacHeader = request.headers.get("x-shopify-hmac-sha256") ?? "";
 *
 * if (!verifyShopifyWebhook(rawBody, hmacHeader, process.env.SHOPIFY_API_SECRET!)) {
 *   return new Response("Unauthorized", { status: 401 });
 * }
 *
 * const payload = JSON.parse(rawBody);
 * // Process webhook...
 * ```
 */
export function verifyShopifyWebhook(
  rawBody: string,
  shopifyHmacHeader: string,
  clientSecret: string
): boolean {
  // Validate inputs
  if (typeof rawBody !== "string" || rawBody.length === 0) {
    throw new ValidationError("rawBody must be a non-empty string");
  }

  if (
    typeof shopifyHmacHeader !== "string" ||
    shopifyHmacHeader.length === 0
  ) {
    throw new ValidationError(
      "shopifyHmacHeader must be a non-empty string (X-Shopify-Hmac-Sha256 header value)"
    );
  }

  if (typeof clientSecret !== "string" || clientSecret.length === 0) {
    throw new ValidationError("clientSecret must be a non-empty string");
  }

  try {
    // Compute HMAC-SHA256 of the raw body using the client secret
    const computedHmac = crypto
      .createHmac("sha256", clientSecret)
      .update(rawBody, "utf8")
      .digest("base64");

    // Both values are base64 strings — compare as UTF-8 buffers
    return timingSafeEqual(computedHmac, shopifyHmacHeader);
  } catch (err) {
    throw new WebhookVerificationError(
      "HMAC computation failed",
      {
        cause: err instanceof Error ? err.message : String(err),
      }
    );
  }
}

// ─── App Proxy Verification ───────────────────────────────────────────────────

/**
 * Verifies a Shopify App Proxy request by validating the HMAC signature
 * in the query parameters.
 *
 * Shopify's app proxy signs requests by:
 * 1. Sorting all query parameters alphabetically (excluding `signature` and `hmac`)
 * 2. Joining them as `key=value` pairs with `&`
 * 3. Computing HMAC-SHA256 of the resulting string
 * 4. Comparing with the `signature` query parameter
 *
 * @param queryParams - All query parameters from the incoming request
 * @param sharedSecret - Your app's client secret
 * @returns `true` if the signature is valid, `false` otherwise
 * @throws {ValidationError} if inputs are empty or signature is missing
 *
 * @example
 * ```ts
 * // In a Next.js API route:
 * const { searchParams } = new URL(request.url);
 * const params = Object.fromEntries(searchParams.entries());
 *
 * if (!verifyShopifyAppProxy(params, process.env.SHOPIFY_API_SECRET!)) {
 *   return new Response("Forbidden", { status: 403 });
 * }
 * ```
 */
export function verifyShopifyAppProxy(
  queryParams: Record<string, string>,
  sharedSecret: string
): boolean {
  if (!queryParams || typeof queryParams !== "object") {
    throw new ValidationError("queryParams must be a non-null object");
  }

  if (typeof sharedSecret !== "string" || sharedSecret.length === 0) {
    throw new ValidationError("sharedSecret must be a non-empty string");
  }

  // Shopify uses either "signature" or "hmac" parameter
  const signature =
    queryParams.signature ?? queryParams.hmac ?? null;

  if (!signature) {
    throw new ValidationError(
      'Query parameters must contain either "signature" or "hmac" field'
    );
  }

  try {
    const expectedSignature = generateAppProxySignature(
      queryParams,
      sharedSecret
    );

    return timingSafeEqual(expectedSignature, signature);
  } catch (err) {
    if (err instanceof ValidationError) {
      throw err;
    }
    throw new WebhookVerificationError(
      "App proxy signature computation failed",
      {
        cause: err instanceof Error ? err.message : String(err),
      }
    );
  }
}

/**
 * Generates the expected HMAC-SHA256 signature for a Shopify App Proxy request.
 *
 * This is useful for debugging or when you need to construct signed
 * URLs for app proxy navigation.
 *
 * @param queryParams - All query parameters (including `signature`/`hmac`)
 * @param sharedSecret - Your app's client secret
 * @returns Hex-encoded HMAC-SHA256 signature
 * @throws {ValidationError} if inputs are invalid
 *
 * @example
 * ```ts
 * const sig = generateAppProxySignature(
 *   { shop: "myshop.myshopify.com", path_prefix: "/apps/sms-shield", timestamp: "1234567890" },
 *   process.env.SHOPIFY_API_SECRET!
 * );
 * ```
 */
export function generateAppProxySignature(
  queryParams: Record<string, string>,
  sharedSecret: string
): string {
  if (!queryParams || typeof queryParams !== "object") {
    throw new ValidationError("queryParams must be a non-null object");
  }

  if (typeof sharedSecret !== "string" || sharedSecret.length === 0) {
    throw new ValidationError("sharedSecret must be a non-empty string");
  }

  // Collect all params except signature and hmac
  const paramsToSign: Array<[string, string]> = [];

  for (const [key, value] of Object.entries(queryParams)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === "signature" || lowerKey === "hmac") {
      continue;
    }
    paramsToSign.push([key, value]);
  }

  // Sort alphabetically by key
  paramsToSign.sort(([a], [b]) => a.localeCompare(b));

  // Build the signature string: key=value&key=value
  const signatureString = paramsToSign
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  // Compute HMAC-SHA256 hex digest
  return crypto
    .createHmac("sha256", sharedSecret)
    .update(signatureString, "utf8")
    .digest("hex");
}

// ─── Timing-Safe Comparison ───────────────────────────────────────────────────

/**
 * Compares two strings in constant time to prevent timing attacks.
 *
 * Falls back to a non-constant-time comparison if the buffers have
 * different lengths (since timingSafeEqual requires equal-length buffers).
 * This is acceptable because length differences are typically revealed
 * by encoding (base64) length checks.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns `true` if strings are equal, `false` otherwise
 */
function timingSafeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");

  // If lengths differ, the strings cannot be equal.
  // We still do a comparison to avoid timing leaks based on length.
  if (bufferA.length !== bufferB.length) {
    // Perform a fake comparison to keep timing consistent
    crypto.timingSafeEqual(bufferA, bufferA);
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}
