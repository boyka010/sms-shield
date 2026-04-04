// =============================================================================
// SMS-Shield Discount Code Generator
// Generates unique discount codes and persists them to the database
// =============================================================================

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import * as crypto from "node:crypto";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Alphabet for generating random suffixes (uppercase alphanumeric, no ambiguous chars) */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Default length of the random suffix portion */
const DEFAULT_SUFFIX_LENGTH = 6;

/** Default prefix for auto-generated codes */
const DEFAULT_PREFIX = "WELCOME";

/** Maximum attempts to generate a unique code before giving up */
const MAX_UNIQUENESS_ATTEMPTS = 10;

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Generates a unique random discount code with the given prefix.
 *
 * Format: `{PREFIX}-{SUFFIX}` (e.g., "WELCOME-A7X9K2")
 * The suffix is a 6-character alphanumeric string generated from
 * a cryptographically secure random source.
 *
 * Uniqueness is verified against the database for the shop.
 *
 * @param prefix - Optional prefix (defaults to "WELCOME")
 * @returns A unique discount code string
 *
 * @example
 * ```ts
 * const code = await generateDiscountCode("VIP");
 * // => "VIP-K3M7X9"
 * ```
 */
export async function generateDiscountCode(prefix?: string): Promise<string> {
  const effectivePrefix = prefix ?? DEFAULT_PREFIX;

  for (let attempt = 1; attempt <= MAX_UNIQUENESS_ATTEMPTS; attempt++) {
    const suffix = generateRandomSuffix(DEFAULT_SUFFIX_LENGTH);
    const code = `${effectivePrefix}-${suffix}`;

    // Check uniqueness in the database
    const existing = await db.discountCode.findFirst({
      where: { code },
    });

    if (!existing) {
      return code;
    }

    logger.warn("Discount code collision, regenerating", {
      code,
      attempt,
      maxAttempts: MAX_UNIQUENESS_ATTEMPTS,
    });
  }

  // Fallback: use a UUID-based suffix to guarantee uniqueness
  const fallback = `${effectivePrefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  logger.warn("Used fallback UUID-based discount code", {
    code: fallback,
    reason: "max_uniqueness_attempts_exceeded",
  });

  return fallback;
}

/**
 * Creates a DiscountCode record in the database linked to a subscriber.
 *
 * Generates a unique discount code, persists it, and optionally
 * links it to the subscriber's discountCodeId for tracking.
 *
 * @param shopId - The shop's database ID
 * @param subscriberId - The subscriber's database ID
 * @param type - Discount type: "percentage" | "fixed_amount" | "free_shipping"
 * @param value - The discount value (percentage number, fixed amount, or 0 for free shipping)
 * @returns The generated discount code string
 *
 * @example
 * ```ts
 * const code = await createDiscountCodeForSubscriber(
 *   "shop_abc123",
 *   "sub_xyz789",
 *   "percentage",
 *   10
 * );
 * // => "WELCOME-K3M7X9"
 * ```
 */
export async function createDiscountCodeForSubscriber(
  shopId: string,
  subscriberId: string,
  type: string,
  value: number
): Promise<string> {
  const code = await generateDiscountCode();

  const discountCode = await db.discountCode.create({
    data: {
      shopId,
      code,
      discountType: type,
      discountValue: value,
      isActive: true,
      startsAt: new Date(),
    },
  });

  // Link the discount code to the subscriber
  await db.subscriber.update({
    where: { id: subscriberId },
    data: { discountCodeId: discountCode.id },
  });

  logger.info("Discount code created for subscriber", {
    shopId,
    subscriberId,
    discountCodeId: discountCode.id,
    code,
    type,
    value,
  });

  return code;
}

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

/**
 * Generates a random alphanumeric string of the specified length
 * using a cryptographically secure random source.
 */
function generateRandomSuffix(length: number): string {
  const bytes = crypto.randomBytes(length);
  let result = "";

  for (let i = 0; i < length; i++) {
    const byte = bytes[i]!;
    const index = byte % CODE_ALPHABET.length;
    result += CODE_ALPHABET[index];
  }

  return result;
}
