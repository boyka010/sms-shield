import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;

export function verifyHmacSignature(
  payload: string,
  hmacHeader: string,
  secret: string
): boolean {
  if (!hmacHeader || !secret) {
    return false;
  }

  const generatedHmac = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(hmacHeader),
    Buffer.from(generatedHmac)
  );
}

export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  try {
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(generatedSignature)
    );
  } catch {
    return false;
  }
}

export function encryptApiKey(apiKey: string, masterKey: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha512');
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  const result = Buffer.concat([
    salt,
    iv,
    authTag,
    Buffer.from(encrypted, 'hex')
  ]);
  
  return result.toString('base64');
}

export function decryptApiKey(encryptedData: string, masterKey: string): string {
  const buffer = Buffer.from(encryptedData, 'base64');
  
  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = buffer.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  
  const key = crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha512');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function hashPhoneNumber(phone: string): string {
  const normalized = phone.replace(/\D/g, '');
  return crypto
    .createHash('sha256')
    .update(normalized)
    .digest('hex');
}

export function hashEmail(email: string): string {
  return crypto
    .createHash('sha256')
    .update(email.toLowerCase().trim())
    .digest('hex');
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function maskPhoneNumber(phone: string): string {
  const normalized = phone.replace(/\D/g, '');
  if (normalized.length < 4) return '****';
  return normalized.slice(0, -4).replace(/./g, '*') + normalized.slice(-4);
}

export function hash(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

export function validateEgyptianPhone(phone: string): boolean {
  const egyptianPhoneRegex = /^(?:\+20|0)?(10|11|12|15)\d{8}$/;
  const normalized = phone.replace(/\s/g, '');
  return egyptianPhoneRegex.test(normalized);
}

export function normalizeEgyptianPhone(phone: string): string {
  const normalized = phone.replace(/\D/g, '');
  
  if (normalized.startsWith('20')) {
    return normalized;
  }
  
  if (normalized.startsWith('0')) {
    return '20' + normalized.slice(1);
  }
  
  return '20' + normalized;
}
