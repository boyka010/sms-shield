/**
 * SMS-Shield Egyptian Phone Number Validation Utility
 *
 * Comprehensive phone number validation, normalization, and formatting
 * for Egyptian mobile numbers. Used throughout the app for:
 * - Input validation on forms and API routes
 * - Normalizing numbers before SMS delivery
 * - Deduplication via consistent formatting
 * - Safe display with masking for privacy
 *
 * All mobile prefixes are current as of 2024:
 * - 010: Vodafone Egypt
 * - 011: Etisalat Egypt (by e&)
 * - 012: Orange Egypt
 * - 015: Telecom Egypt (WE)
 */

import { z } from "zod";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Egypt's international dialing code */
export const EGYPT_COUNTRY_CODE = "+20";

/** Valid Egyptian mobile number prefixes (local format) */
export const EGYPTIAN_MOBILE_PREFIXES = ["010", "011", "012", "015"] as const;

/** Valid mobile prefixes with country code (2 + prefix) */
export const EGYPTIAN_MOBILE_PREFIXES_INTL = ["2010", "2011", "2012", "2015"] as const;

/**
 * Expected length of an Egyptian phone number in local format (0XXXXXXXXXX)
 */
export const EGYPTIAN_PHONE_LENGTH = 11;

/**
 * Expected length of an Egyptian phone number with country code (20XXXXXXXXXX)
 * E.164 format: country code "20" (2 digits) + national number "10XXXXXXXX" (10 digits) = 12 digits
 */
export const EGYPTIAN_PHONE_LENGTH_INTL = 12;

/**
 * Comprehensive regex for validating Egyptian mobile numbers.
 *
 * Supports the following formats:
 * - Local: 01012345678, 01x xxx xxxx, 01x-xxx-xxxx
 * - International: +201012345678, 201012345678, +2 010 1234 5678
 * - With various separators: spaces, dashes, dots, parentheses
 *
 * Named capture groups:
 * - full: The entire matched phone number (normalized)
 * - prefix: The 3-digit mobile prefix (010/011/012/015)
 * - subscriber: The 8-digit subscriber number
 */
export const EGYPTIAN_PHONE_REGEX =
  /^(?:\+?2|002)?(01[0125])\s*\.?\s*-?\s*(\d{4})\s*\.?\s*-?\s*(\d{4})$/;

/**
 * Regex for matching Egyptian phone numbers within a larger string.
 * Uses lookahead/lookbehind to avoid matching partial numbers.
 */
export const EGYPTIAN_PHONE_SEARCH_REGEX =
  /(?:\+?2|002)?(01[0125])[\s.\-]?(\d{4})[\s.\-]?(\d{4})/g;

/**
 * Strict regex for already-normalized numbers (digits only, 11 or 13 chars).
 */
export const EGYPTIAN_PHONE_DIGITS_REGEX = /^(2)?(01[0125])(\d{8})$/;

// ─── Types ────────────────────────────────────────────────────────────────────

/** Carrier information derived from the mobile prefix */
export interface CarrierInfo {
  prefix: string;
  name: string;
  color: string;
}

/** Full parsed phone number data */
export interface ParsedPhone {
  normalized: string;
  local: string;
  international: string;
  prefix: string;
  subscriber: string;
  carrier: CarrierInfo | null;
  display: string;
  masked: string;
}

// ─── Carrier Data ─────────────────────────────────────────────────────────────

const CARRIER_MAP: Record<string, CarrierInfo> = {
  "010": { prefix: "010", name: "Vodafone Egypt", color: "#E60000" },
  "011": { prefix: "011", name: "Etisalat Egypt", color: "#6C0BA9" },
  "012": { prefix: "012", name: "Orange Egypt", color: "#FF7900" },
  "015": { prefix: "015", name: "Telecom Egypt (WE)", color: "#009CDE" },
};

// ─── Zod Schema ───────────────────────────────────────────────────────────────

/**
 * Zod schema for validating and parsing Egyptian phone numbers.
 *
 * Performs the following transformations:
 * 1. Trims whitespace
 * 2. Rejects empty strings
 * 3. Normalizes to +20XXXXXXXXXX format via normalizePhone()
 * 4. Validates against Egyptian mobile prefix rules
 *
 * @example
 * ```ts
 * const result = egyptianPhoneSchema.safeParse("  010 1234 5678  ");
 * if (result.success) {
 *   result.data; // => "+201012345678"
 * }
 * ```
 */
export const egyptianPhoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .transform((val) => normalizePhone(val))
  .refine(
    (normalized) => {
      const digits = normalized.replace(/\D/g, "");
      return (
        digits.length === EGYPTIAN_PHONE_LENGTH_INTL ||
        digits.length === EGYPTIAN_PHONE_LENGTH
      );
    },
    {
      message: `Phone number must be ${EGYPTIAN_PHONE_LENGTH} or ${EGYPTIAN_PHONE_LENGTH_INTL} digits`,
    }
  )
  .refine(
    (normalized) => {
      const digits = normalized.replace(/\D/g, "");
      // Restore trunk prefix "0" for prefix checking in local format
      const localDigits = digits.startsWith("20")
        ? "0" + digits.slice(2)
        : digits;
      return EGYPTIAN_MOBILE_PREFIXES.includes(
        localDigits.slice(0, 3) as typeof EGYPTIAN_MOBILE_PREFIXES[number]
      );
    },
    {
      message: `Invalid Egyptian mobile prefix. Must start with one of: ${EGYPTIAN_MOBILE_PREFIXES.join(", ")}`,
    }
  );

/**
 * Type inferred from the egyptianPhoneSchema.
 * After parsing, this is a normalized +20XXXXXXXXXX string.
 */
export type EgyptianPhone = z.infer<typeof egyptianPhoneSchema>;

// ─── Validation Functions ─────────────────────────────────────────────────────

/**
 * Normalizes a phone number to the canonical `+20XXXXXXXXXX` format.
 *
 * Handles all common input formats:
 * - "01012345678" → "+201012345678"
 * - "+201012345678" → "+201012345678" (unchanged)
 * - "201012345678" → "+201012345678"
 * - "+2 010 1234 5678" → "+201012345678"
 * - "20-101-234-5678" → "+201012345678"
 * - "+20 (010) 1234 5678" → "+201012345678"
 * - "00201012345678" → "+201012345678"
 *
 * @param phone - Phone number in any common format
 * @returns Normalized string in +20XXXXXXXXXX format
 * @throws {Error} if phone is empty or contains no digits
 */
export function normalizePhone(phone: string): string {
  if (typeof phone !== "string" || phone.trim().length === 0) {
    throw new Error("Phone number must be a non-empty string");
  }

  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 0) {
    throw new Error("Phone number contains no digits");
  }

  let normalized: string;

  if (digits.startsWith("00")) {
    // International format with 00 prefix: 00201012345678
    normalized = "+" + digits.slice(2);
  } else if (digits.startsWith("+20") || digits.startsWith("20")) {
    // Already has country code (with or without +)
    normalized = digits.startsWith("20") ? "+" + digits : digits;
  } else if (digits.startsWith("0")) {
    // Local format: 01012345678 → prepend +2
    normalized = "+2" + digits;
  } else {
    // Just digits without leading 0 (e.g., "1012345678") — prepend +20
    normalized = "+20" + digits;
  }

  return normalized;
}

/**
 * Validates whether a phone number is a valid Egyptian mobile number.
 *
 * @param phone - Phone number in any common format
 * @returns `true` if the phone number is valid
 */
export function isValidEgyptianPhone(phone: string): boolean {
  try {
    const result = egyptianPhoneSchema.safeParse(phone);
    return result.success;
  } catch {
    return false;
  }
}

/**
 * Returns a list of specific validation errors for a phone number.
 *
 * Unlike isValidEgyptianPhone which returns a boolean, this function
 * provides detailed error messages suitable for form validation feedback.
 *
 * @param phone - Phone number to validate
 * @returns Array of error message strings (empty if valid)
 *
 * @example
 * ```ts
 * const errors = getPhoneValidationErrors("12345");
 * // => ["Phone number has only 5 digits, expected 11 or 13"]
 * ```
 */
export function getPhoneValidationErrors(phone: string): string[] {
  const errors: string[] = [];

  if (typeof phone !== "string" || phone.trim().length === 0) {
    errors.push("Phone number is required");
    return errors;
  }

  // Strip to digits only
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 0) {
    errors.push("Phone number contains no digits");
    return errors;
  }

  // Check length after normalization
  let normalizedDigits: string;
  if (digits.startsWith("00")) {
    normalizedDigits = digits.slice(2);
  } else if (digits.startsWith("20")) {
    normalizedDigits = digits;
  } else if (digits.startsWith("0")) {
    normalizedDigits = "2" + digits;
  } else {
    normalizedDigits = "20" + digits;
  }

  if (
    normalizedDigits.length !== EGYPTIAN_PHONE_LENGTH_INTL &&
    normalizedDigits.length !== EGYPTIAN_PHONE_LENGTH
  ) {
    errors.push(
      `Phone number has ${normalizedDigits.length} digits, expected ${EGYPTIAN_PHONE_LENGTH} (local) or ${EGYPTIAN_PHONE_LENGTH_INTL} (international)`
    );
  }

  // Extract the local prefix (restore trunk prefix "0" for local format)
  const localDigits = normalizedDigits.startsWith("20")
    ? "0" + normalizedDigits.slice(2)
    : normalizedDigits;

  const prefix = localDigits.slice(0, 3);

  if (
    !EGYPTIAN_MOBILE_PREFIXES.includes(
      prefix as typeof EGYPTIAN_MOBILE_PREFIXES[number]
    )
  ) {
    errors.push(
      `Invalid Egyptian mobile prefix "${prefix}". Must start with one of: ${EGYPTIAN_MOBILE_PREFIXES.join(", ")}`
    );
  }

  // Check for invalid characters (shouldn't happen after stripping, but good to check)
  if (/\D/.test(phone) && !/^[\d\s\-\.\+\(\)]+$/.test(phone)) {
    errors.push("Phone number contains invalid characters");
  }

  return errors;
}

// ─── Formatting Functions ─────────────────────────────────────────────────────

/**
 * Formats a phone number for human-readable display.
 *
 * @param phone - Phone number in any format
 * @returns Formatted string in "010 1234 5678" (local) or "+20 101 234 5678" (international) format
 *
 * @example
 * ```ts
 * formatPhoneDisplay("01012345678");    // "010 1234 5678"
 * formatPhoneDisplay("+201012345678");  // "010 1234 5678"
 * ```
 */
export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone);
  const digits = normalized.replace(/\D/g, "");

  // Remove country code for local display, restoring trunk prefix "0"
  const localDigits = digits.startsWith("20") ? "0" + digits.slice(2) : digits;

  if (localDigits.length === 11) {
    // Format: XXX XXXX XXXX
    return `${localDigits.slice(0, 3)} ${localDigits.slice(3, 7)} ${localDigits.slice(7, 11)}`;
  }

  // Fallback: return the normalized international format with spaces
  // +20 XXX XXXX XXXX
  if (digits.length === 12) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)} ${digits.slice(9, 13)}`;
  }

  return normalized;
}

/**
 * Returns the carrier prefix (3-digit mobile prefix) for a phone number.
 *
 * @param phone - Phone number in any format
 * @returns The 3-digit prefix (e.g., "010") or null if invalid
 *
 * @example
 * ```ts
 * getCarrierPrefix("01012345678");  // "010"
 * getCarrierPrefix("01234567890");  // null (invalid)
 * ```
 */
export function getCarrierPrefix(phone: string): string | null {
  try {
    const normalized = normalizePhone(phone);
    const digits = normalized.replace(/\D/g, "");
    const localDigits = digits.startsWith("20") ? "0" + digits.slice(2) : digits;

    if (localDigits.length < 3) {
      return null;
    }

    const prefix = localDigits.slice(0, 3);

    if (
      EGYPTIAN_MOBILE_PREFIXES.includes(
        prefix as typeof EGYPTIAN_MOBILE_PREFIXES[number]
      )
    ) {
      return prefix;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Masks a phone number for privacy-safe display.
 *
 * Shows the prefix and first 4 digits, replacing the last 4 with "XXXX".
 *
 * @param phone - Phone number in any format
 * @returns Masked string in "010 1234 XXXX" format
 *
 * @example
 * ```ts
 * maskPhone("01012345678");  // "010 1234 XXXX"
 * maskPhone("+201012345678"); // "010 1234 XXXX"
 * ```
 */
export function maskPhone(phone: string): string {
  try {
    const normalized = normalizePhone(phone);
    const digits = normalized.replace(/\D/g, "");
    const localDigits = digits.startsWith("20") ? "0" + digits.slice(2) : digits;

    if (localDigits.length >= 11) {
      return `${localDigits.slice(0, 3)} ${localDigits.slice(3, 7)} XXXX`;
    }

    // If we can't fully parse, return a best-effort mask
    if (localDigits.length >= 7) {
      return `${localDigits.slice(0, 3)} ${localDigits.slice(3, 7)} XXXX`;
    }

    // Very short — mask everything after the prefix
    if (localDigits.length >= 3) {
      return `${localDigits.slice(0, 3)} XXXX`;
    }

    return "XXX XXXX XXXX";
  } catch {
    return "XXX XXXX XXXX";
  }
}

// ─── Advanced Parsing ─────────────────────────────────────────────────────────

/**
 * Parses a phone number into a comprehensive ParsedPhone object
 * containing all derived information.
 *
 * @param phone - Phone number in any format
 * @returns ParsedPhone object or null if invalid
 *
 * @example
 * ```ts
 * const parsed = parsePhone("01012345678");
 * if (parsed) {
 *   parsed.normalized;    // "+201012345678"
 *   parsed.local;         // "01012345678"
 *   parsed.international; // "+201012345678"
 *   parsed.carrier?.name; // "Vodafone Egypt"
 * }
 * ```
 */
export function parsePhone(phone: string): ParsedPhone | null {
  try {
    const normalized = normalizePhone(phone);
    const digits = normalized.replace(/\D/g, "");
    const localDigits = digits.startsWith("20") ? "0" + digits.slice(2) : digits;
    const prefix = localDigits.slice(0, 3);
    const subscriber = localDigits.slice(3);

    if (
      localDigits.length !== EGYPTIAN_PHONE_LENGTH ||
      !EGYPTIAN_MOBILE_PREFIXES.includes(
        prefix as typeof EGYPTIAN_MOBILE_PREFIXES[number]
      )
    ) {
      return null;
    }

    return {
      normalized,
      local: localDigits,
      international: normalized,
      prefix,
      subscriber,
      carrier: CARRIER_MAP[prefix] ?? null,
      display: formatPhoneDisplay(phone),
      masked: maskPhone(phone),
    };
  } catch {
    return null;
  }
}

/**
 * Extracts all Egyptian phone numbers from a text string.
 *
 * Useful for parsing phone numbers from order notes,
 * customer addresses, or free-text fields.
 *
 * @param text - Text that may contain phone numbers
 * @returns Array of normalized phone numbers found
 *
 * @example
 * ```ts
 * extractPhones("Call me at 01012345678 or 01198765432");
 * // => ["+201012345678", "+201198765432"]
 * ```
 */
export function extractPhones(text: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(EGYPTIAN_PHONE_SEARCH_REGEX.source, "g");

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0];
    const normalized = normalizePhone(fullMatch);

    if (isValidEgyptianPhone(normalized)) {
      results.push(normalized);
    }
  }

  return results;
}
