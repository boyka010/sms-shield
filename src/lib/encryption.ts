/**
 * SMS-Shield Encryption Utility
 *
 * AES-256-GCM encryption for protecting sensitive data at rest:
 * - API keys (Twilio, Vonage, etc.)
 * - Phone numbers (PII)
 * - OAuth tokens
 * - Any config secrets stored in the database
 *
 * Uses PBKDF2 key derivation with SHA-512 for turning master passwords
 * into cryptographically strong 256-bit AES keys.
 */

import * as crypto from "node:crypto";
import {
  EncryptionError,
  DecryptionError,
  ValidationError,
} from "./errors";

// ─── Constants ────────────────────────────────────────────────────────────────

/** AES-256-GCM algorithm identifier */
const ALGORITHM = "aes-256-gcm";

/** PBKDF2 hash function */
const KDF_HASH = "sha512";

/** PBKDF2 iteration count (OWASP recommended minimum: 100,000) */
const KDF_ITERATIONS = 100_000;

/** Derived key length in bytes (256 bits for AES-256) */
const KEY_LENGTH = 32;

/** Salt length in bytes (128 bits) */
const SALT_LENGTH = 16;

/** GCM IV length in bytes (96 bits — NIST recommended) */
const IV_LENGTH = 12;

/** Expected hex length of a valid encryption key (32 bytes = 64 hex chars) */
const EXPECTED_KEY_HEX_LENGTH = KEY_LENGTH * 2;

/**
 * Wire format separator for the encrypted output.
 * Output: base64(salt + ":" + iv + ":" + authTag + ":" + ciphertext)
 */
const FORMAT_SEPARATOR = ":";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Structured parts of an encrypted payload */
interface EncryptedParts {
  salt: Buffer;
  iv: Buffer;
  authTag: Buffer;
  ciphertext: Buffer;
}

// ─── Validation Helpers ───────────────────────────────────────────────────────

/**
 * Validates that a string is non-empty after trimming.
 * @throws {ValidationError} if the value is empty or whitespace-only.
 */
function requireNonEmpty(value: string, label: string): void {
  if (typeof value !== "string") {
    throw new ValidationError(`"${label}" must be a string, received ${typeof value}`);
  }
  if (value.trim().length === 0) {
    throw new ValidationError(`"${label}" must not be empty`);
  }
}

/**
 * Validates that an encryption key is a properly formatted hex string.
 * @throws {ValidationError} if the key format is invalid.
 */
function validateKey(key: string): void {
  requireNonEmpty(key, "encryption key");

  // Strip any "0x" prefix if present
  const cleanKey = key.startsWith("0x") ? key.slice(2) : key;

  if (!/^[0-9a-fA-F]+$/.test(cleanKey)) {
    throw new ValidationError(
      "Encryption key must be a valid hexadecimal string"
    );
  }

  if (cleanKey.length !== EXPECTED_KEY_HEX_LENGTH) {
    throw new ValidationError(
      `Encryption key must be ${KEY_LENGTH} bytes (${EXPECTED_KEY_HEX_LENGTH} hex characters), got ${cleanKey.length} hex characters`
    );
  }
}

// ─── Encryption Functions ─────────────────────────────────────────────────────

/**
 * Generates a new random encryption key suitable for AES-256.
 *
 * The key is returned as a 64-character hex string and can be stored
 * in environment variables or a secrets manager.
 *
 * @returns A hex-encoded 256-bit (32-byte) random key
 * @throws {EncryptionError} if key generation fails
 *
 * @example
 * ```ts
 * const key = await generateEncryptionKey();
 * process.env.ENCRYPTION_KEY = key;
 * ```
 */
export async function generateEncryptionKey(): Promise<string> {
  try {
    const key = crypto.randomBytes(KEY_LENGTH);
    return key.toString("hex");
  } catch (err) {
    throw new EncryptionError("Failed to generate encryption key", {
      cause: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Encrypts plaintext using AES-256-GCM with PBKDF2 key derivation.
 *
 * The encryption key is run through PBKDF2 with a random salt to produce
 * a derived key, which is then used with AES-256-GCM for authenticated
 * encryption. The output format is:
 *
 * ```
 * base64(salt:iv:authTag:ciphertext)
 * ```
 *
 * @param plaintext - The string to encrypt (API key, phone number, etc.)
 * @param key - Hex-encoded encryption key (from generateEncryptionKey)
 * @returns Base64-encoded encrypted string
 * @throws {ValidationError} if plaintext or key is empty/invalid
 * @throws {EncryptionError} if the encryption operation fails
 *
 * @example
 * ```ts
 * const encrypted = await encrypt("SK-12345-api-key", encryptionKey);
 * // => "dGhpcyBpcyBhIHNhbHQ..."
 * ```
 */
export async function encrypt(
  plaintext: string,
  key: string
): Promise<string> {
  requireNonEmpty(plaintext, "plaintext");
  validateKey(key);

  try {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive the actual encryption key using PBKDF2
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.pbkdf2(
        key,
        salt,
        KDF_ITERATIONS,
        KEY_LENGTH,
        KDF_HASH,
        (err, derivedKey) => {
          if (err) {
            reject(err);
          } else {
            resolve(derivedKey);
          }
        }
      );
    });

    // Create cipher and encrypt
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Combine parts into wire format
    const parts: EncryptedParts = { salt, iv, authTag, ciphertext };
    const wire = serializeEncrypted(parts);

    return Buffer.from(wire, "utf8").toString("base64");
  } catch (err) {
    if (err instanceof ValidationError) {
      throw err;
    }
    throw new EncryptionError("Failed to encrypt data", {
      operation: "encrypt",
      cause: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Decrypts data that was encrypted with the encrypt() function.
 *
 * Parses the base64-encoded wire format, extracts the salt, IV, auth tag,
 * and ciphertext, then derives the key using PBKDF2 and verifies+decrypts
 * using AES-256-GCM.
 *
 * @param encryptedData - Base64-encoded encrypted string from encrypt()
 * @param key - The same hex-encoded key used for encryption
 * @returns The original plaintext string
 * @throws {ValidationError} if encryptedData or key is empty/invalid/malformed
 * @throws {DecryptionError} if decryption or auth tag verification fails
 *
 * @example
 * ```ts
 * const decrypted = await decrypt(encryptedData, encryptionKey);
 * // => "SK-12345-api-key"
 * ```
 */
export async function decrypt(
  encryptedData: string,
  key: string
): Promise<string> {
  requireNonEmpty(encryptedData, "encryptedData");
  validateKey(key);

  try {
    // Decode from base64 and parse wire format
    const wire = Buffer.from(encryptedData, "base64").toString("utf8");
    const parts = parseEncrypted(wire);

    // Derive the same encryption key using PBKDF2
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.pbkdf2(
        key,
        parts.salt,
        KDF_ITERATIONS,
        KEY_LENGTH,
        KDF_HASH,
        (err, derivedKey) => {
          if (err) {
            reject(err);
          } else {
            resolve(derivedKey);
          }
        }
      );
    });

    // Create decipher and decrypt
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, parts.iv);
    decipher.setAuthTag(parts.authTag);

    const plaintext = Buffer.concat([
      decipher.update(parts.ciphertext),
      decipher.final(),
    ]);

    return plaintext.toString("utf8");
  } catch (err) {
    if (err instanceof ValidationError) {
      throw err;
    }
    throw new DecryptionError(
      err instanceof RangeError || err instanceof TypeError
        ? "Encrypted data is corrupted or tampered with"
        : "Failed to decrypt data",
      {
        operation: "decrypt",
        cause: err instanceof Error ? err.message : String(err),
      }
    );
  }
}

/**
 * Hashes a phone number using SHA-256 for deduplication purposes.
 *
 * The phone number is normalized before hashing:
 * - Strips all non-digit characters
 * - If the number starts with "0", prepends "+2" (Egypt country code assumption)
 *
 * @param phone - Phone number in any common format
 * @returns Hex-encoded SHA-256 hash
 * @throws {ValidationError} if phone is empty
 *
 * @example
 * ```ts
 * hashPhone("010 1234 5678");  // All normalize to same hash
 * hashPhone("+201012345678"); // Same hash
 * ```
 */
export function hashPhone(phone: string): string {
  requireNonEmpty(phone, "phone");

  const digitsOnly = phone.replace(/\D/g, "");

  if (digitsOnly.length === 0) {
    throw new ValidationError("Phone number contains no digits");
  }

  // Normalize to a consistent format for hashing:
  // - Strip leading "00" (international prefix) → prepend "+"
  // - Strip leading "20" (Egypt country code) → prepend "+"
  // - Leading "0" (local format) → prepend "+2"
  // - Otherwise assume bare digits → prepend "+20"
  let normalized: string;
  if (digitsOnly.startsWith("00")) {
    normalized = "+" + digitsOnly.slice(2);
  } else if (digitsOnly.startsWith("0")) {
    normalized = "+2" + digitsOnly;
  } else if (digitsOnly.startsWith("20")) {
    normalized = "+" + digitsOnly;
  } else {
    normalized = "+20" + digitsOnly;
  }

  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Computes a generic SHA-256 hash of arbitrary data.
 *
 * Useful for creating checksums, deduplication keys, or
 * content-addressable identifiers.
 *
 * @param data - String data to hash
 * @returns Hex-encoded SHA-256 hash
 * @throws {ValidationError} if data is empty
 */
export function hashData(data: string): string {
  requireNonEmpty(data, "data");
  return crypto.createHash("sha256").update(data).digest("hex");
}

// ─── Wire Format Serialization ────────────────────────────────────────────────

/**
 * Serializes encrypted parts into the wire format string: salt:iv:authTag:ciphertext
 */
function serializeEncrypted(parts: EncryptedParts): string {
  return [
    parts.salt.toString("hex"),
    parts.iv.toString("hex"),
    parts.authTag.toString("hex"),
    parts.ciphertext.toString("hex"),
  ].join(FORMAT_SEPARATOR);
}

/**
 * Parses the wire format string back into encrypted parts.
 * @throws {ValidationError} if the format is invalid
 */
function parseEncrypted(wire: string): EncryptedParts {
  const segments = wire.split(FORMAT_SEPARATOR);

  if (segments.length !== 4) {
    throw new ValidationError(
      `Invalid encrypted data format: expected 4 parts separated by "${FORMAT_SEPARATOR}", got ${segments.length}`
    );
  }

  const [saltHex, ivHex, authTagHex, ciphertextHex] = segments;

  // Validate that all segments are valid hex strings
  for (const [name, hex] of [
    ["salt", saltHex],
    ["iv", ivHex],
    ["authTag", authTagHex],
    ["ciphertext", ciphertextHex],
  ] as const) {
    if (!/^[0-9a-fA-F]+$/.test(hex)) {
      throw new ValidationError(
        `Invalid encrypted data: "${name}" segment contains non-hex characters`
      );
    }
    if (hex.length === 0) {
      throw new ValidationError(
        `Invalid encrypted data: "${name}" segment is empty`
      );
    }
  }

  return {
    salt: Buffer.from(saltHex, "hex"),
    iv: Buffer.from(ivHex, "hex"),
    authTag: Buffer.from(authTagHex, "hex"),
    ciphertext: Buffer.from(ciphertextHex, "hex"),
  };
}
